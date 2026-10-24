-- =====================================================
-- 02-VIEWS: Các view phục vụ báo cáo & dashboard quản trị
-- View không chứa password_hash -> user báo cáo chỉ được đọc view
-- =====================================================
SET NAMES utf8mb4;
USE ecommerce_db;

-- Chi tiết từng dòng sản phẩm trong đơn hàng
CREATE OR REPLACE VIEW v_order_details AS
SELECT
    o.id            AS order_id,
    o.created_at    AS order_date,
    o.status,
    o.customer_name,
    o.customer_email,
    o.phone,
    o.shipping_address,
    p.id            AS product_id,
    p.name          AS product_name,
    c.name          AS category_name,
    oi.quantity,
    oi.unit_price,
    oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
JOIN products p     ON p.id = oi.product_id
LEFT JOIN categories c ON c.id = p.category_id;

-- Doanh thu theo ngày (không tính đơn đã hủy)
CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT
    DATE(o.created_at)  AS order_day,
    COUNT(*)            AS total_orders,
    SUM(o.total_amount) AS revenue
FROM orders o
WHERE o.status <> 'cancelled'
GROUP BY DATE(o.created_at);

-- Doanh số theo sản phẩm (chỉ tính đơn chưa hủy)
CREATE OR REPLACE VIEW v_product_sales AS
SELECT
    p.id                                    AS product_id,
    p.name                                  AS product_name,
    c.name                                  AS category_name,
    p.stock,
    COALESCE(SUM(s.quantity), 0)            AS sold_quantity,
    COALESCE(SUM(s.quantity * s.unit_price), 0) AS revenue
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN (
    SELECT oi.product_id, oi.quantity, oi.unit_price
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status <> 'cancelled'
) s ON s.product_id = p.id
GROUP BY p.id, p.name, c.name, p.stock;

-- Doanh thu theo danh mục
CREATE OR REPLACE VIEW v_category_revenue AS
SELECT
    c.id   AS category_id,
    c.name AS category_name,
    COUNT(DISTINCT ps.product_id)        AS total_products,
    COALESCE(SUM(ps.sold_quantity), 0)   AS sold_quantity,
    COALESCE(SUM(ps.revenue), 0)         AS revenue
FROM categories c
LEFT JOIN products p ON p.category_id = c.id
LEFT JOIN v_product_sales ps ON ps.product_id = p.id
GROUP BY c.id, c.name;

-- Sản phẩm sắp hết hàng (đang bán, tồn kho <= 5)
CREATE OR REPLACE VIEW v_low_stock_products AS
SELECT p.id, p.name, c.name AS category_name, p.stock, p.price
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
WHERE p.is_active = 1 AND p.stock <= 5;

-- Tổng hợp khách hàng (KHÔNG có password_hash)
CREATE OR REPLACE VIEW v_customer_summary AS
SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.created_at,
    COUNT(o.id) AS order_count,
    COALESCE(SUM(CASE WHEN o.status <> 'cancelled' THEN o.total_amount END), 0) AS total_spent,
    MAX(o.created_at) AS last_order_at
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name, u.email, u.role, u.created_at;
