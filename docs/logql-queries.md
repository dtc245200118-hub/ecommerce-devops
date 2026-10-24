# LogQL Queries — E-commerce DevOps

## 1. Toàn bộ log E-commerce

```logql
{job="ecommerce-docker"}
```

Mục đích: Theo dõi log tập trung của các container thuộc dự án.

## 2. Log Nginx

```logql
{job="ecommerce-docker",service="nginx"}
```

Mục đích: Kiểm tra các HTTP request, mã trạng thái và hoạt động của Reverse Proxy.

## 3. Log MySQL

```logql
{job="ecommerce-docker",service="mysql"}
```

Mục đích: Theo dõi quá trình khởi động, cảnh báo và các sự kiện của MySQL.

**Cách chạy:** Grafana → Explore → Loki → nhập LogQL → Run query.

Lưu ý: Sử dụng thời gian Last 6 hours khi cần xem log khởi động MySQL.

---

## 4. Đăng nhập thất bại (phát hiện dò mật khẩu)

```logql
{job="ecommerce-docker",service="backend"} |= "[auth] login failed"
```

Mục đích: Phát hiện các lần đăng nhập sai, email bị nhắm tới và IP nguồn.

## 5. Đếm số lần đăng nhập thất bại theo thời gian

```logql
sum(count_over_time({job="ecommerce-docker",service="backend"} |= "[auth] login failed" [5m]))
```

Mục đích: Vẽ biểu đồ/đặt cảnh báo khi số lần đăng nhập sai tăng đột biến.

## 6. Nhật ký thao tác của quản trị viên (audit log)

```logql
{job="ecommerce-docker",service="backend"} |= "[admin]"
```

Mục đích: Truy vết ai đã thêm/sửa/xóa sản phẩm và đổi trạng thái đơn hàng.

## 7. Nhật ký thao tác của khách hàng

```logql
{job="ecommerce-docker",service="backend"} |= "[user]"
```

Mục đích: Truy vết khách hàng đăng ký, đặt hàng, hủy đơn và đăng xuất (không ghi mật khẩu).

## 8. Request bị chặn bởi rate limit / phân quyền tại Nginx

```logql
{job="ecommerce-docker",service="nginx"} |~ "\" (401|403|429) "
```

Mục đích: Theo dõi các request bị từ chối do chưa xác thực, sai quyền hoặc vượt giới hạn tốc độ.

## 9. Thống kê mã trạng thái HTTP

```logql
sum by (status) (count_over_time({job="ecommerce-docker",service="nginx"} | regexp `" (?P<status>[0-9]{3}) ` [1h]))
```

Mục đích: Tỷ lệ request thành công / lỗi của website.

