# Cơ sở dữ liệu MySQL: Thiết kế, phân quyền và câu lệnh demo

Toàn bộ script nằm trong thư mục `database/` và được MySQL chạy **tự động theo thứ tự tên file** khi khởi tạo lần đầu (`/docker-entrypoint-initdb.d`):

| File | Nội dung |
| :--- | :--- |
| `01-schema.sql` | 6 bảng, khóa chính/ngoại, `CHECK`, `INDEX`, `utf8mb4` |
| `02-views.sql` | 6 view báo cáo (doanh thu, sản phẩm, danh mục, khách hàng...) |
| `03-procedures-triggers.sql` | 3 stored procedure + 3 trigger |
| `04-seed-data.sql` | Dữ liệu mẫu: 6 danh mục, 14 sản phẩm, 4 khách hàng, 12 đơn hàng |
| `05-permissions.sql` | Phân quyền tối thiểu theo **từng bảng** cho `ecommerce_app` |
| `07-create-report-user.sh` | Tài khoản `report_user` chỉ đọc view báo cáo |

> Script chỉ chạy khi volume `mysql_data` còn trống. Muốn chạy lại: `docker compose down -v` rồi `docker compose up -d`.

---

## 1. Sơ đồ quan hệ (ERD)

```text
 users 1───n orders 1───n order_items n───1 products n───1 categories
                │
                └──1───n order_status_history   (ghi bởi TRIGGER)
```

| Bảng | Mô tả | Ràng buộc chính |
| :--- | :--- | :--- |
| `users` | Tài khoản khách hàng / admin | `email` UNIQUE, `role` ENUM, mật khẩu băm scrypt |
| `categories` | Danh mục | `name` UNIQUE |
| `products` | Sản phẩm | FK → categories, `CHECK price >= 0`, `CHECK stock >= 0`, index `(is_active, category_id)` |
| `orders` | Đơn hàng | FK → users, `status` ENUM, index `(status, created_at)` |
| `order_items` | Chi tiết đơn | FK → orders (CASCADE), FK → products, `CHECK quantity > 0` |
| `order_status_history` | Lịch sử trạng thái | FK → orders, ghi tự động bởi trigger |

## 2. Tài khoản CSDL & phân quyền (Least Privilege)

| Tài khoản | Dùng cho | Quyền |
| :--- | :--- | :--- |
| `root` | Quản trị (chỉ dùng khi cần) | Toàn quyền, mật khẩu trong `.env` |
| `ecommerce_app` | Backend Node.js | Chỉ DML cần thiết theo từng bảng, **không DDL, không DELETE đơn hàng, không UPDATE users** |
| `report_user` | Xem báo cáo trong phpMyAdmin | Chỉ `SELECT` trên **view** và `EXECUTE` procedure báo cáo, **không đọc được bảng `users`** |

Chi tiết quyền của `ecommerce_app`:

| Bảng | SELECT | INSERT | UPDATE | DELETE |
| :--- | :---: | :---: | :---: | :---: |
| users | ✅ | ✅ | ❌ | ❌ |
| categories | ✅ | ❌ | ❌ | ❌ |
| products | ✅ | ✅ | ✅ | ✅ |
| orders | ✅ | ✅ | ✅ | ❌ |
| order_items | ✅ | ✅ | ❌ | ❌ |
| order_status_history | ✅ | ❌ (trigger ghi) | ❌ | ❌ |
| 6 view báo cáo | ✅ | – | – | – |

Kiểm tra phân quyền (đăng nhập phpMyAdmin bằng `ecommerce_app`, tab **SQL**):

```sql
SHOW GRANTS FOR CURRENT_USER();

CREATE TABLE hack (id INT);          -- ERROR 1142: CREATE command denied
DROP TABLE orders;                   -- ERROR 1142: DROP command denied
DELETE FROM orders WHERE id = 1;     -- ERROR 1142: DELETE command denied
UPDATE users SET role = 'admin';     -- ERROR 1142: UPDATE command denied
```

Đăng nhập bằng `report_user`:

```sql
SELECT password_hash FROM users;     -- ERROR 1142: SELECT command denied
SELECT * FROM v_customer_summary;    -- OK (view không chứa password_hash)
```

## 3. View báo cáo

```sql
-- Doanh thu theo ngày (không tính đơn hủy)
SELECT * FROM v_daily_revenue ORDER BY order_day DESC;

-- Doanh số từng sản phẩm
SELECT * FROM v_product_sales ORDER BY sold_quantity DESC;

-- Doanh thu theo danh mục
SELECT * FROM v_category_revenue ORDER BY revenue DESC;

-- Sản phẩm sắp hết hàng
SELECT * FROM v_low_stock_products;

-- Khách hàng chi tiêu nhiều nhất
SELECT name, email, order_count, total_spent
FROM v_customer_summary
ORDER BY total_spent DESC
LIMIT 5;

-- Chi tiết các dòng sản phẩm trong đơn hàng
SELECT * FROM v_order_details WHERE order_id = 1;
```

## 4. Stored Procedure

```sql
-- Báo cáo doanh thu 7 ngày gần nhất (trả về 2 bảng: theo ngày + tổng hợp)
CALL sp_revenue_report(CURDATE() - INTERVAL 7 DAY, CURDATE());

-- Top 5 sản phẩm bán chạy
CALL sp_top_products(5);

-- Lịch sử mua hàng của một khách
CALL sp_customer_orders('an.nguyen@example.com');
```

## 5. Trigger

| Trigger | Thời điểm | Chức năng |
| :--- | :--- | :--- |
| `trg_orders_after_insert` | AFTER INSERT orders | Ghi trạng thái đầu tiên vào `order_status_history` |
| `trg_orders_after_update` | AFTER UPDATE orders | Ghi lại mỗi lần đổi trạng thái (old → new) |
| `trg_orders_before_update` | BEFORE UPDATE orders | Chặn sửa trạng thái đơn đã `completed`/`cancelled` (kể cả sửa tay) |

Demo:

```sql
-- Xem lịch sử trạng thái của đơn 1
SELECT * FROM order_status_history WHERE order_id = 1 ORDER BY changed_at;

-- Đổi trạng thái đơn đang chờ -> trigger tự ghi lịch sử
UPDATE orders SET status = 'confirmed' WHERE id = 11;
SELECT * FROM order_status_history WHERE order_id = 11;

-- Thử sửa đơn đã hoàn thành -> bị trigger chặn
UPDATE orders SET status = 'pending' WHERE id = 1;
-- ERROR 1644 (45000): Order is already completed or cancelled
```

## 6. Câu truy vấn nghiệp vụ hay dùng

```sql
-- Đơn hàng chờ xác nhận (dùng index idx_orders_status_created)
EXPLAIN SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC;

-- Doanh thu tháng hiện tại
SELECT SUM(total_amount) AS revenue
FROM orders
WHERE status <> 'cancelled'
  AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01');

-- Giá trị đơn hàng trung bình theo khách hàng
SELECT customer_email, COUNT(*) AS orders, ROUND(AVG(total_amount)) AS avg_value
FROM orders
WHERE status <> 'cancelled'
GROUP BY customer_email
ORDER BY avg_value DESC;

-- Sản phẩm chưa từng được bán
SELECT p.id, p.name
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.id
WHERE oi.id IS NULL;
```

## 7. Sao lưu & khôi phục

```powershell
# Windows PowerShell
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 backups\ecommerce_db_YYYYMMDD_HHMMSS.sql
```

```bash
# Linux / macOS / Git Bash
./scripts/backup-db.sh
./scripts/restore-db.sh backups/ecommerce_db_YYYYMMDD_HHMMSS.sql
```

Bản backup dùng `mysqldump --single-transaction --routines --triggers` nên giữ đủ dữ liệu, view, procedure và trigger. Thư mục `backups/` đã được loại khỏi Git.
