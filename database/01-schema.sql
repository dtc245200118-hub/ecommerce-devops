-- =====================================================
-- 01-SCHEMA: Cơ sở dữ liệu Website Thương mại điện tử
-- Chạy tự động khi MySQL khởi tạo lần đầu (docker-entrypoint-initdb.d)
-- =====================================================

-- Đọc file này bằng UTF-8 để tiếng Việt không bị lỗi font
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS ecommerce_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ecommerce_db;

-- -----------------------------------------------------
-- Tài khoản người dùng (khách hàng / quản trị viên)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL COMMENT 'scrypt$salt$hash - không lưu mật khẩu dạng rõ',
    role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_role (role)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Danh mục sản phẩm
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Sản phẩm
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(12,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(500),
    is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '0 = ẩn khỏi cửa hàng',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_category
      FOREIGN KEY (category_id) REFERENCES categories(id)
      ON UPDATE CASCADE ON DELETE SET NULL,
    CONSTRAINT chk_price CHECK (price >= 0),
    CONSTRAINT chk_stock CHECK (stock >= 0),
    INDEX idx_products_active_category (is_active, category_id),
    INDEX idx_products_name (name)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Đơn hàng
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NULL,
    shipping_address VARCHAR(255) NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    status ENUM('pending','confirmed','completed','cancelled')
      NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_user
      FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE SET NULL,
    CONSTRAINT chk_total CHECK (total_amount >= 0),
    INDEX idx_orders_status_created (status, created_at),
    INDEX idx_orders_created (created_at)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Chi tiết đơn hàng
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL COMMENT 'Giá tại thời điểm đặt hàng',
    CONSTRAINT fk_item_order
      FOREIGN KEY (order_id) REFERENCES orders(id)
      ON DELETE CASCADE,
    CONSTRAINT fk_item_product
      FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT chk_quantity CHECK (quantity > 0),
    CONSTRAINT chk_unit_price CHECK (unit_price >= 0)
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Lịch sử trạng thái đơn hàng (ghi tự động bởi TRIGGER)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS order_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    old_status VARCHAR(20) NULL,
    new_status VARCHAR(20) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_order
      FOREIGN KEY (order_id) REFERENCES orders(id)
      ON DELETE CASCADE,
    INDEX idx_history_order (order_id, changed_at)
) ENGINE=InnoDB;
