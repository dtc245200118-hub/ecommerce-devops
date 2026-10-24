-- =====================================================
-- 05-PERMISSIONS: Least Privilege cho tài khoản ứng dụng
-- Tên tài khoản và database dùng theo cấu hình mặc định của dự án.
-- Mỗi bảng chỉ cấp đúng quyền mà backend cần, KHÔNG có quyền DDL
-- (CREATE, DROP, ALTER), KHÔNG có quyền GRANT, FILE, SUPER.
-- =====================================================
USE ecommerce_db;

REVOKE ALL PRIVILEGES, GRANT OPTION FROM 'ecommerce_app'@'%';

-- Đăng ký, đăng nhập, tạo admin (không cần UPDATE/DELETE user)
GRANT SELECT, INSERT ON ecommerce_db.users TO 'ecommerce_app'@'%';

-- Danh mục chỉ đọc
GRANT SELECT ON ecommerce_db.categories TO 'ecommerce_app'@'%';

-- Admin quản lý sản phẩm (thêm, sửa, ẩn, xóa); đặt hàng trừ tồn kho
GRANT SELECT, INSERT, UPDATE, DELETE ON ecommerce_db.products TO 'ecommerce_app'@'%';

-- Đơn hàng: tạo và đổi trạng thái, không được xóa
GRANT SELECT, INSERT, UPDATE ON ecommerce_db.orders TO 'ecommerce_app'@'%';
GRANT SELECT, INSERT ON ecommerce_db.order_items TO 'ecommerce_app'@'%';

-- Lịch sử trạng thái do TRIGGER ghi, ứng dụng chỉ đọc
GRANT SELECT ON ecommerce_db.order_status_history TO 'ecommerce_app'@'%';

-- View báo cáo
GRANT SELECT ON ecommerce_db.v_order_details      TO 'ecommerce_app'@'%';
GRANT SELECT ON ecommerce_db.v_daily_revenue      TO 'ecommerce_app'@'%';
GRANT SELECT ON ecommerce_db.v_product_sales      TO 'ecommerce_app'@'%';
GRANT SELECT ON ecommerce_db.v_category_revenue   TO 'ecommerce_app'@'%';
GRANT SELECT ON ecommerce_db.v_low_stock_products TO 'ecommerce_app'@'%';
GRANT SELECT ON ecommerce_db.v_customer_summary   TO 'ecommerce_app'@'%';

FLUSH PRIVILEGES;
