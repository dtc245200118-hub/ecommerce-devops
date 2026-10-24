const pool = require("../config/database");
const { httpError } = require("../utils/validate");

// Chuyển trạng thái hợp lệ của đơn hàng
const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

// Chạy fn trong transaction, tự rollback khi lỗi
async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Rollback error:", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

// Đổi trạng thái đơn; nếu hủy đơn thì hoàn lại tồn kho.
// userId != null nghĩa là khách tự hủy -> chỉ được hủy đơn của chính mình.
async function changeStatus(orderId, nextStatus, userId = null) {
  return withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT id, user_id, status FROM orders WHERE id = ? FOR UPDATE",
      [orderId]
    );

    const order = rows[0];
    if (!order || (userId !== null && order.user_id !== userId)) {
      throw httpError(404, "Không tìm thấy đơn hàng");
    }

    // Khách hàng chỉ được hủy đơn khi đơn còn chờ xác nhận
    if (userId !== null && order.status !== "pending") {
      throw httpError(400, "Chỉ có thể hủy đơn hàng đang chờ xác nhận");
    }

    if (!TRANSITIONS[order.status].includes(nextStatus)) {
      throw httpError(400, `Không thể chuyển đơn từ "${order.status}" sang "${nextStatus}"`);
    }

    if (nextStatus === "cancelled") {
      await connection.execute(
        `UPDATE products p
         JOIN order_items oi ON oi.product_id = p.id
         SET p.stock = p.stock + oi.quantity
         WHERE oi.order_id = ?`,
        [orderId]
      );
    }

    await connection.execute("UPDATE orders SET status = ? WHERE id = ?", [nextStatus, orderId]);
    return { id: orderId, status: nextStatus };
  });
}

// Lấy đơn hàng kèm danh sách sản phẩm
async function listOrders({ userId = null, limit = 200 } = {}) {
  const where = userId === null ? "" : "WHERE o.user_id = ?";
  const params = userId === null ? [] : [userId];

  const [orders] = await pool.query(
    `SELECT o.id, o.user_id, o.customer_name, o.customer_email, o.phone,
            o.shipping_address, o.total_amount, o.status, o.created_at
     FROM orders o
     ${where}
     ORDER BY o.id DESC
     LIMIT ${Number(limit)}`,
    params
  );

  if (orders.length === 0) return [];

  const [items] = await pool.query(
    `SELECT oi.order_id, oi.product_id, oi.quantity, oi.unit_price,
            p.name, p.image_url
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id IN (?)`,
    [orders.map((order) => order.id)]
  );

  // Lịch sử trạng thái do TRIGGER trong CSDL ghi lại
  const [history] = await pool.query(
    `SELECT order_id, old_status, new_status, changed_at
     FROM order_status_history
     WHERE order_id IN (?)
     ORDER BY changed_at, id`,
    [orders.map((order) => order.id)]
  );

  const byOrder = new Map(orders.map((order) => [order.id, { ...order, items: [], history: [] }]));
  items.forEach((item) => byOrder.get(item.order_id).items.push(item));
  history.forEach((entry) => byOrder.get(entry.order_id).history.push(entry));
  return [...byOrder.values()];
}

module.exports = { withTransaction, changeStatus, listOrders, TRANSITIONS };
