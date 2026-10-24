-- =====================================================
-- 04-SEED DATA: Dữ liệu mẫu phục vụ demo
-- Tài khoản khách hàng demo: mật khẩu Customer@2026
-- Tài khoản admin KHÔNG nằm ở đây: backend tự tạo từ ADMIN_EMAIL/ADMIN_PASSWORD
-- =====================================================
SET NAMES utf8mb4;
USE ecommerce_db;

INSERT IGNORE INTO categories (id, name) VALUES
(1, 'Laptop'),
(2, 'Điện thoại'),
(3, 'Phụ kiện'),
(4, 'Tablet'),
(5, 'Âm thanh'),
(6, 'Đồng hồ thông minh');

INSERT IGNORE INTO products
(id, category_id, name, description, price, stock, image_url)
VALUES
(1, 1, 'MacBook Air 13 M4', 'Chip Apple M4, RAM 16GB, SSD 256GB, màn hình Liquid Retina 13.6 inch, pin 18 giờ.', 26990000, 10, '/images/products/laptop.svg'),
(2, 2, 'iPhone 16', 'Chip A18, camera kép 48MP, nút Camera Control, Dynamic Island, USB-C.', 18990000, 15, '/images/products/phone.svg'),
(3, 3, 'Logitech MX Master 3S', 'Chuột không dây cao cấp, cảm biến 8000 DPI, click siêu êm, sạc USB-C.', 2490000, 20, '/images/products/mouse.svg'),
(4, 1, 'Dell XPS 14', 'Intel Core Ultra 7, RAM 32GB, SSD 1TB, màn hình OLED 3.2K cảm ứng.', 45990000, 4, '/images/products/laptop.svg'),
(5, 1, 'ASUS ROG Zephyrus G14', 'Laptop gaming Ryzen 9, RTX 4070, màn hình OLED 120Hz, thiết kế mỏng nhẹ.', 42490000, 6, '/images/products/laptop.svg'),
(6, 2, 'Samsung Galaxy S25 Ultra', 'Snapdragon 8 Elite, camera 200MP, bút S Pen, Galaxy AI, khung titan.', 28990000, 12, '/images/products/phone.svg'),
(7, 2, 'Xiaomi 15', 'Ống kính Leica, Snapdragon 8 Elite, sạc nhanh 90W, màn hình 6.36 inch.', 17990000, 3, '/images/products/phone.svg'),
(8, 4, 'iPad Air 11 M3', 'Chip M3, màn hình Liquid Retina 11 inch, hỗ trợ Apple Pencil Pro.', 16490000, 9, '/images/products/tablet.svg'),
(9, 4, 'Samsung Galaxy Tab S10', 'Màn hình Dynamic AMOLED 2X, kèm bút S Pen, kháng nước IP68.', 19990000, 7, '/images/products/tablet.svg'),
(10, 5, 'Sony WH-1000XM5', 'Tai nghe chống ồn hàng đầu, pin 30 giờ, âm thanh Hi-Res, sạc nhanh.', 7490000, 18, '/images/products/headphones.svg'),
(11, 5, 'AirPods Pro 2', 'Chống ồn chủ động, âm thanh không gian, hộp sạc USB-C, kháng nước IP54.', 5990000, 25, '/images/products/headphones.svg'),
(12, 6, 'Apple Watch Series 10', 'Màn hình lớn hơn, mỏng nhất từ trước tới nay, theo dõi sức khỏe toàn diện.', 10990000, 11, '/images/products/watch.svg'),
(13, 6, 'Garmin Forerunner 265', 'Đồng hồ chạy bộ GPS, màn hình AMOLED, pin 13 ngày.', 9490000, 0, '/images/products/watch.svg'),
(14, 3, 'Bàn phím Keychron K2 Pro', 'Bàn phím cơ không dây 75%, hot-swap, đèn nền RGB, tương thích Mac/Windows.', 2690000, 14, '/images/products/keyboard.svg');

-- Khách hàng demo (mật khẩu: Customer@2026, đã băm bằng scrypt)
INSERT IGNORE INTO users (id, name, email, password_hash, role) VALUES
(1, 'Nguyễn Văn An',  'an.nguyen@example.com',  'scrypt$f4b48c63e8309edc4fc4b8f94490dc35$b81e0f4ef2f8e3a9b1f876ad388414dbc0797998dc37308c52586d441acad0ac7c55755d32c46313f19f57e5f7d9cd4b182a79db99d3dabd53e67572255c7134', 'customer'),
(2, 'Trần Thị Bình',  'binh.tran@example.com',  'scrypt$382ccf4fad8d85b6987f6801c10fa3a2$1e913eeb2cb4130d9e7039202fafab0b16c506ca746dfa67b4409b838857469bdb8a67b92e59de29cf37d8509851bb50858b8e5f1565adf889e9e89504c3b45a', 'customer'),
(3, 'Lê Minh Cường',  'cuong.le@example.com',   'scrypt$61c4c17a6310cc0b4409b953b57eaf2f$a8ecf9afa0d2ae1b2b94423d3298d57b0688949eafeccdac16c7cacc988c8b58cee03c1e0c4b61bdcfffec4c09cccd302c2d18cf57f4f1e9a8c8808ff20e3f5f', 'customer'),
(4, 'Phạm Thu Dung',  'dung.pham@example.com',  'scrypt$85e5166fa8d0c0398eac959c0179e3b9$3be7f050efb8107ad5285bee18628022d245c690fea92de52eda3e440e195a2cefd73d985a0c866851d2b812e2d850af9af06cb865b1465f6237838d8ac25ca9', 'customer');

-- Đơn hàng demo trong 7 ngày gần nhất (tổng tiền tính lại ở cuối file)
INSERT IGNORE INTO orders
(id, user_id, customer_name, customer_email, phone, shipping_address, total_amount, status, created_at)
VALUES
(1,  1, 'Nguyễn Văn An', 'an.nguyen@example.com', '0901234567', '12 Lê Lợi, Quận 1, TP.HCM',          0, 'pending', NOW() - INTERVAL 6 DAY - INTERVAL 3 HOUR),
(2,  2, 'Trần Thị Bình', 'binh.tran@example.com', '0912345678', '45 Trần Phú, Ba Đình, Hà Nội',       0, 'pending', NOW() - INTERVAL 6 DAY),
(3,  3, 'Lê Minh Cường', 'cuong.le@example.com',  '0987654321', '8 Hùng Vương, TP. Thái Nguyên',      0, 'pending', NOW() - INTERVAL 5 DAY),
(4,  1, 'Nguyễn Văn An', 'an.nguyen@example.com', '0901234567', '12 Lê Lợi, Quận 1, TP.HCM',          0, 'pending', NOW() - INTERVAL 4 DAY - INTERVAL 5 HOUR),
(5,  4, 'Phạm Thu Dung', 'dung.pham@example.com', '0934567890', '102 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 0, 'pending', NOW() - INTERVAL 4 DAY),
(6,  2, 'Trần Thị Bình', 'binh.tran@example.com', '0912345678', '45 Trần Phú, Ba Đình, Hà Nội',       0, 'pending', NOW() - INTERVAL 3 DAY),
(7,  3, 'Lê Minh Cường', 'cuong.le@example.com',  '0987654321', '8 Hùng Vương, TP. Thái Nguyên',      0, 'pending', NOW() - INTERVAL 2 DAY - INTERVAL 6 HOUR),
(8,  4, 'Phạm Thu Dung', 'dung.pham@example.com', '0934567890', '102 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 0, 'pending', NOW() - INTERVAL 2 DAY),
(9,  1, 'Nguyễn Văn An', 'an.nguyen@example.com', '0901234567', '12 Lê Lợi, Quận 1, TP.HCM',          0, 'pending', NOW() - INTERVAL 1 DAY),
(10, 2, 'Trần Thị Bình', 'binh.tran@example.com', '0912345678', '45 Trần Phú, Ba Đình, Hà Nội',       0, 'pending', NOW() - INTERVAL 20 HOUR),
(11, 3, 'Lê Minh Cường', 'cuong.le@example.com',  '0987654321', '8 Hùng Vương, TP. Thái Nguyên',      0, 'pending', NOW() - INTERVAL 3 HOUR),
(12, 4, 'Phạm Thu Dung', 'dung.pham@example.com', '0934567890', '102 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', 0, 'pending', NOW() - INTERVAL 1 HOUR);

-- Chi tiết đơn hàng: lấy đúng giá bán hiện tại của sản phẩm
INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT d.order_id, d.product_id, d.quantity, p.price
FROM (
    SELECT 1 AS order_id, 1 AS product_id, 1 AS quantity UNION ALL
    SELECT 1, 3, 1   UNION ALL
    SELECT 2, 2, 1   UNION ALL
    SELECT 2, 11, 1  UNION ALL
    SELECT 3, 10, 2  UNION ALL
    SELECT 4, 8, 1   UNION ALL
    SELECT 5, 6, 1   UNION ALL
    SELECT 5, 12, 1  UNION ALL
    SELECT 6, 14, 2  UNION ALL
    SELECT 7, 5, 1   UNION ALL
    SELECT 8, 11, 2  UNION ALL
    SELECT 9, 2, 1   UNION ALL
    SELECT 10, 9, 1  UNION ALL
    SELECT 11, 3, 1  UNION ALL
    SELECT 11, 14, 1 UNION ALL
    SELECT 12, 12, 1
) d
JOIN products p ON p.id = d.product_id
WHERE NOT EXISTS (SELECT 1 FROM order_items x WHERE x.order_id = d.order_id);

-- Tính tổng tiền đơn hàng từ chi tiết
UPDATE orders o
JOIN (
    SELECT order_id, SUM(quantity * unit_price) AS total
    FROM order_items
    GROUP BY order_id
) t ON t.order_id = o.id
SET o.total_amount = t.total;

-- Cập nhật trạng thái -> TRIGGER tự ghi vào order_status_history
UPDATE orders SET status = 'confirmed' WHERE id IN (1, 2, 3, 4, 5, 6, 7, 9, 10) AND status = 'pending';
UPDATE orders SET status = 'completed' WHERE id IN (1, 2, 3, 4, 5, 6, 9) AND status = 'confirmed';
UPDATE orders SET status = 'cancelled' WHERE id IN (8) AND status = 'pending';
