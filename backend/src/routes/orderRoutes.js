const express = require("express");
const { requireRole } = require("../middleware/auth");
const { withTransaction, changeStatus, listOrders } = require("../services/orderService");
const { isText, isPhone, isInt, httpError } = require("../utils/validate");

const router = express.Router();

// Chỉ tài khoản khách hàng mới được mua hàng
router.use(requireRole("customer"));

// GET /api/orders/my - Đơn mua của tôi
router.get("/my", async (req, res, next) => {
  try {
    const orders = await listOrders({ userId: req.user.id });
    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders - Tạo đơn hàng mới
router.post("/", async (req, res, next) => {
  const { customer_name, phone, shipping_address, items } = req.body || {};

  if (!isText(customer_name, 2, 100) || !isPhone(phone) || !isText(shipping_address, 5, 255)) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập đúng họ tên, số điện thoại và địa chỉ giao hàng"
    });
  }

  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    return res.status(400).json({ success: false, message: "Giỏ hàng không hợp lệ" });
  }

  // Gộp sản phẩm trùng và kiểm tra số lượng
  const cart = new Map();
  for (const item of items) {
    if (!item || !isInt(item.product_id, 1, Number.MAX_SAFE_INTEGER) || !isInt(item.quantity, 1, 100)) {
      return res.status(400).json({ success: false, message: "Sản phẩm hoặc số lượng không hợp lệ" });
    }
    const quantity = (cart.get(item.product_id) || 0) + item.quantity;
    if (quantity > 100) {
      return res.status(400).json({ success: false, message: "Số lượng sản phẩm vượt giới hạn" });
    }
    cart.set(item.product_id, quantity);
  }

  try {
    const order = await withTransaction(async (connection) => {
      let totalAmount = 0;
      const orderItems = [];

      // Khóa sản phẩm theo thứ tự id để tránh deadlock
      const productIds = [...cart.keys()].sort((a, b) => a - b);

      for (const productId of productIds) {
        const quantity = cart.get(productId);
        const [rows] = await connection.execute(
          "SELECT id, name, price, stock FROM products WHERE id = ? AND is_active = 1 FOR UPDATE",
          [productId]
        );

        const product = rows[0];
        if (!product) throw httpError(400, "Sản phẩm không tồn tại hoặc đã ngừng bán");
        if (product.stock < quantity) {
          throw httpError(400, `Không đủ tồn kho cho sản phẩm: ${product.name}`);
        }

        totalAmount += Number(product.price) * quantity;
        if (totalAmount > 9999999999.99) throw httpError(400, "Tổng tiền không hợp lệ");

        orderItems.push({ productId, quantity, unitPrice: product.price });
      }

      const [orderResult] = await connection.execute(
        `INSERT INTO orders
         (user_id, customer_name, customer_email, phone, shipping_address, total_amount, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          req.user.id,
          customer_name.trim(),
          req.user.email,
          phone.replace(/\s/g, ""),
          shipping_address.trim(),
          totalAmount
        ]
      );

      for (const item of orderItems) {
        await connection.execute(
          "INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
          [orderResult.insertId, item.productId, item.quantity, item.unitPrice]
        );
        await connection.execute(
          "UPDATE products SET stock = stock - ? WHERE id = ?",
          [item.quantity, item.productId]
        );
      }

      return { id: orderResult.insertId, total: totalAmount };
    });

    console.log(`[user] order created order_id=${order.id} user_id=${req.user.id} total=${order.total}`);

    res.status(201).json({
      success: true,
      message: "Đặt hàng thành công",
      order_id: order.id,
      total_amount: order.total
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/orders/:id/cancel - Khách tự hủy đơn khi còn "pending"
router.post("/:id/cancel", async (req, res, next) => {
  const orderId = Number(req.params.id);
  if (!isInt(orderId, 1, Number.MAX_SAFE_INTEGER)) {
    return res.status(400).json({ success: false, message: "Mã đơn không hợp lệ" });
  }

  try {
    const result = await changeStatus(orderId, "cancelled", req.user.id);
    console.log(`[user] order cancelled order_id=${orderId} user_id=${req.user.id}`);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
