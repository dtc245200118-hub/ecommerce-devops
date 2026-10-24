-- =====================================================
-- 03-PROCEDURES & TRIGGERS
-- =====================================================
SET NAMES utf8mb4;
USE ecommerce_db;

DELIMITER $$

-- -----------------------------------------------------
-- TRIGGER: ghi lịch sử khi tạo đơn hàng
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_after_insert $$
CREATE TRIGGER trg_orders_after_insert
AFTER INSERT ON orders
FOR EACH ROW
BEGIN
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_at)
    VALUES (NEW.id, NULL, NEW.status, NEW.created_at);
END $$

-- -----------------------------------------------------
-- TRIGGER: ghi lịch sử mỗi khi trạng thái đơn thay đổi
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_after_update $$
CREATE TRIGGER trg_orders_after_update
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF NOT (OLD.status <=> NEW.status) THEN
        INSERT INTO order_status_history (order_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
END $$

-- -----------------------------------------------------
-- TRIGGER: chặn sửa trạng thái của đơn đã kết thúc
-- (bảo vệ dữ liệu ở tầng CSDL, kể cả khi sửa tay trong phpMyAdmin)
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_before_update $$
CREATE TRIGGER trg_orders_before_update
BEFORE UPDATE ON orders
FOR EACH ROW
BEGIN
    IF OLD.status IN ('completed', 'cancelled') AND NOT (OLD.status <=> NEW.status) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order is already completed or cancelled';
    END IF;
END $$

-- -----------------------------------------------------
-- PROCEDURE: báo cáo doanh thu theo khoảng ngày
-- CALL sp_revenue_report('2026-01-01', '2026-12-31');
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS sp_revenue_report $$
CREATE PROCEDURE sp_revenue_report(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT order_day, total_orders, revenue
    FROM v_daily_revenue
    WHERE order_day BETWEEN p_from AND p_to
    ORDER BY order_day;

    SELECT
        COUNT(*)                        AS total_orders,
        COALESCE(SUM(total_amount), 0)  AS total_revenue,
        COALESCE(AVG(total_amount), 0)  AS avg_order_value
    FROM orders
    WHERE status <> 'cancelled'
      AND DATE(created_at) BETWEEN p_from AND p_to;
END $$

-- -----------------------------------------------------
-- PROCEDURE: top sản phẩm bán chạy
-- CALL sp_top_products(5);
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS sp_top_products $$
CREATE PROCEDURE sp_top_products(IN p_limit INT)
BEGIN
    SELECT product_id, product_name, category_name, sold_quantity, revenue
    FROM v_product_sales
    WHERE sold_quantity > 0
    ORDER BY sold_quantity DESC, revenue DESC
    LIMIT p_limit;
END $$

-- -----------------------------------------------------
-- PROCEDURE: lịch sử mua hàng của một khách
-- CALL sp_customer_orders('an.nguyen@example.com');
-- -----------------------------------------------------
DROP PROCEDURE IF EXISTS sp_customer_orders $$
CREATE PROCEDURE sp_customer_orders(IN p_email VARCHAR(150))
BEGIN
    SELECT order_id, order_date, status, product_name, quantity, unit_price, line_total
    FROM v_order_details
    WHERE customer_email = p_email
    ORDER BY order_date DESC, order_id DESC;
END $$

DELIMITER ;
