const express = require("express");
const pool = require("../config/database");
const { requireRole } = require("../middleware/auth");
const { changeStatus, listOrders, TRANSITIONS } = require("../services/orderService");
const { isText, isImagePath, isInt } = require("../utils/validate");

const router = express.Router();

// Toàn bộ API quản trị chỉ dành cho admin
router.use(requireRole("admin"));

const parseId = (value) => {
  const id = Number(value);
  return isInt(id, 1, Number.MAX_SAFE_INTEGER) ? id : null;
};

// GET /api/admin/stats - Số liệu tổng quan cho dashboard
router.get("/stats", async (req, res, next) => {
  try {
    const [[orders]] = await pool.query(
      `SELECT COUNT(*) AS total_orders,
              SUM(status = 'pending') AS pending_orders,
              COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN total_amount END), 0) AS revenue
       FROM orders`
    );
    const [[users]] = await pool.query(
      "SELECT COUNT(*) AS total_customers FROM users WHERE role = 'customer'"
    );
    const [[products]] = await pool.query("SELECT COUNT(*) AS total_products FROM products");
    const [[lowStock]] = await pool.query("SELECT COUNT(*) AS low_stock FROM v_low_stock_products");

    // Số liệu báo cáo lấy từ các VIEW trong CSDL
    const [topProducts] = await pool.query(
      `SELECT product_id AS id, product_name AS name, sold_quantity AS sold
       FROM v_product_sales
       WHERE sold_quantity > 0
       ORDER BY sold_quantity DESC, revenue DESC
       LIMIT 5`
    );
    const [dailyRevenue] = await pool.query(
      `SELECT DATE_FORMAT(order_day, '%Y-%m-%d') AS day, total_orders, revenue
       FROM v_daily_revenue
       WHERE order_day >= CURDATE() - INTERVAL 6 DAY
       ORDER BY order_day`
    );
    const [categoryRevenue] = await pool.query(
      `SELECT category_name, sold_quantity, revenue
       FROM v_category_revenue
       ORDER BY revenue DESC`
    );

    res.json({
      success: true,
      data: {
        ...orders,
        pending_orders: Number(orders.pending_orders || 0),
        ...users,
        ...products,
        low_stock: Number(lowStock.low_stock || 0),
        top_products: topProducts,
        daily_revenue: dailyRevenue,
        category_revenue: categoryRevenue
      }
    });
  } catch (error) {
    next(error);
  }
});

// ===================== Sản phẩm =====================

function readProduct(body) {
  const { name, description = "", price, stock, category_id, image_url = null, is_active = true } = body || {};
  const errors = [];

  if (!isText(name, 2, 200)) errors.push("Tên sản phẩm từ 2-200 ký tự");
  if (typeof description !== "string" || description.length > 2000) errors.push("Mô tả tối đa 2000 ký tự");
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 9999999999) {
    errors.push("Giá không hợp lệ");
  }
  if (!isInt(stock, 0, 100000)) errors.push("Tồn kho phải là số nguyên 0-100000");
  if (!isInt(category_id, 1, Number.MAX_SAFE_INTEGER)) errors.push("Danh mục không hợp lệ");
  if (image_url !== null && image_url !== "" && !isImagePath(image_url)) {
    errors.push("Ảnh phải là đường dẫn nội bộ dạng /images/...");
  }
  if (typeof is_active !== "boolean") errors.push("Trạng thái không hợp lệ");

  return {
    errors,
    values: [
      typeof name === "string" ? name.trim() : name,
      typeof description === "string" ? description.trim() : description,
      price,
      stock,
      category_id,
      image_url || null,
      is_active ? 1 : 0
    ]
  };
}

// GET /api/admin/products - Tất cả sản phẩm (kể cả đang ẩn)
router.get("/products", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.category_id, c.name AS category_name, p.name, p.description,
              p.price, p.stock, p.image_url, p.is_active, p.created_at,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.product_id = p.id) AS order_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/products - Thêm sản phẩm
router.post("/products", async (req, res, next) => {
  const { errors, values } = readProduct(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });

  try {
    const [result] = await pool.execute(
      `INSERT INTO products (name, description, price, stock, category_id, image_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values
    );
    console.log(`[admin] product created id=${result.insertId} by user_id=${req.user.id}`);
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({ success: false, message: "Danh mục không tồn tại" });
    }
    next(error);
  }
});

// PUT /api/admin/products/:id - Cập nhật sản phẩm
router.put("/products/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Mã sản phẩm không hợp lệ" });

  const { errors, values } = readProduct(req.body);
  // expected_stock: tồn kho admin nhìn thấy khi mở form -> không ghi đè nếu đơn hàng đã làm nó thay đổi
  const expectedStock = req.body?.expected_stock;
  if (expectedStock !== undefined && !isInt(expectedStock, 0, Number.MAX_SAFE_INTEGER)) {
    errors.push("Tồn kho ban đầu không hợp lệ");
  }
  if (errors.length) return res.status(400).json({ success: false, message: errors.join(". ") });

  // Admin không sửa ô Tồn kho -> giữ nguyên tồn kho hiện tại (có thể đã đổi do đơn hàng), không cần kiểm tra
  const [name, description, price, stock, categoryId, imageUrl, isActive] = values;
  const keepStock = expectedStock !== undefined && stock === expectedStock;
  const checkStock = expectedStock !== undefined && !keepStock;

  try {
    const [result] = await pool.execute(
      `UPDATE products
       SET name = ?, description = ?, price = ?, ${keepStock ? "" : "stock = ?, "}category_id = ?, image_url = ?, is_active = ?
       WHERE id = ?${checkStock ? " AND stock = ?" : ""}`,
      [
        name, description, price,
        ...(keepStock ? [] : [stock]),
        categoryId, imageUrl, isActive, id,
        ...(checkStock ? [expectedStock] : [])
      ]
    );
    if (result.affectedRows === 0) {
      const [rows] = await pool.execute("SELECT stock FROM products WHERE id = ?", [id]);
      if (rows.length > 0) {
        return res.status(409).json({
          success: false,
          current_stock: rows[0].stock,
          message: `Tồn kho vừa thay đổi (đơn hàng mới, hủy đơn hoặc admin khác), hiện còn ${rows[0].stock}. Kiểm tra lại ô Tồn kho rồi bấm Lưu.`
        });
      }
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    console.log(`[admin] product updated id=${id} by user_id=${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
      return res.status(400).json({ success: false, message: "Danh mục không tồn tại" });
    }
    next(error);
  }
});

// PATCH /api/admin/products/:id/active - Ẩn/hiện sản phẩm (không đụng tới tồn kho)
router.patch("/products/:id/active", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Mã sản phẩm không hợp lệ" });
  if (typeof req.body?.is_active !== "boolean") {
    return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ" });
  }

  try {
    const [result] = await pool.execute("UPDATE products SET is_active = ? WHERE id = ?", [req.body.is_active ? 1 : 0, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    console.log(`[admin] product ${req.body.is_active ? "shown" : "hidden"} id=${id} by user_id=${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/products/:id - Xóa sản phẩm chưa từng được đặt
router.delete("/products/:id", async (req, res, next) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: "Mã sản phẩm không hợp lệ" });

  try {
    const [result] = await pool.execute("DELETE FROM products WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy sản phẩm" });
    }
    console.log(`[admin] product deleted id=${id} by user_id=${req.user.id}`);
    res.json({ success: true });
  } catch (error) {
    // User ít quyền nhận mã lỗi không có hậu tố _2
    if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        success: false,
        message: "Sản phẩm đã có trong đơn hàng, không thể xóa. Hãy chuyển sang trạng thái Ẩn."
      });
    }
    next(error);
  }
});

// ===================== Đơn hàng =====================

// GET /api/admin/orders - Tất cả đơn hàng
router.get("/orders", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listOrders(), transitions: TRANSITIONS });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/orders/:id/status - Cập nhật trạng thái đơn
router.patch("/orders/:id/status", async (req, res, next) => {
  const id = parseId(req.params.id);
  const { status } = req.body || {};

  if (!id || !Object.hasOwn(TRANSITIONS, status)) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ" });
  }

  try {
    const result = await changeStatus(id, status);
    console.log(`[admin] order id=${id} status=${status} by user_id=${req.user.id}`);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ===================== Người dùng =====================

// GET /api/admin/users - Danh sách tài khoản (không trả password_hash)
router.get("/users", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, email, role, created_at, order_count, total_spent, last_order_at
       FROM v_customer_summary
       ORDER BY id DESC`
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
