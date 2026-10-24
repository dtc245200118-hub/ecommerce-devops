# HỆ THỐNG THƯƠNG MẠI ĐIỆN TỬ — TRIỂN KHAI DEVOPS VỚI DOCKER COMPOSE

**Học phần:** Triển khai và Quản trị Hệ thống Phần mềm · **Đề tài số 09:** Website Thương mại điện tử (E-commerce)

| Thông tin | Chi tiết |
| :--- | :--- |
| Sinh viên | **Nguyễn Hồng Phúc** |
| Mã số sinh viên | **DTC245200118** |
| Lớp | CNTT K23A — Khoa Công nghệ Thông tin |
| Email | dtc245200118@ictu.edu.vn |
| Trường | Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU) |
| Năm học | 2025 – 2026 |
| Repository | [github.com/dtc245200118-hub/ecommerce-devops](https://github.com/dtc245200118-hub/ecommerce-devops) |

Website bán hàng **TechZone** (sản phẩm, giỏ hàng, đơn hàng) xây dựng bằng Node.js + MySQL, quản trị CSDL bằng phpMyAdmin, đặt sau Nginx reverse proxy với HTTPS và được giám sát bằng Prometheus + Grafana. Toàn bộ hệ thống triển khai bằng Docker Compose.

## Mục lục

1. [Đối chiếu yêu cầu đề bài](#1-đối-chiếu-yêu-cầu-đề-bài)
2. [Kiến trúc hệ thống](#2-kiến-trúc-hệ-thống)
3. [Hướng dẫn chạy](#3-hướng-dẫn-chạy)
4. [Commit 1 — Ứng dụng web, MySQL và phpMyAdmin](#4-commit-1--ứng-dụng-web-mysql-và-phpmyadmin)
5. [Commit 1 — Nginx reverse proxy, HTTPS và security headers](#5-commit-1--nginx-reverse-proxy-https-và-security-headers)
6. [Commit 2 — Giám sát với Prometheus và Grafana](#6-commit-2--giám-sát-với-prometheus-và-grafana)
7. [Hardening](#7-hardening)
8. [Kịch bản demo](#8-kịch-bản-demo)
9. [Cấu trúc thư mục](#9-cấu-trúc-thư-mục)

## 1. Đối chiếu yêu cầu đề bài

| # | Yêu cầu của đề | Thực hiện trong dự án | Commit |
| :---: | :--- | :--- | :---: |
| 1 | Quản lý mã nguồn trên GitHub, commit rõ ràng, có README | Repository này; README hướng dẫn chạy và mô tả hệ thống | — |
| 2 | Triển khai web + Database + công cụ quản lý DB | Node.js 24 (Express 5), MySQL 8.0, phpMyAdmin 5.2 | commit 1 |
| 3 | Nginx reverse proxy, HTTPS tự ký, security headers | Nginx là cổng vào duy nhất; CA nội bộ tự sinh; TLS 1.2/1.3; HSTS, CSP… | commit 1 |
| 4 | Prometheus + Grafana giám sát container, web server, database | cAdvisor, nginx-exporter, mysqld-exporter; dashboard Grafana tự nạp | commit 2 |
| 6 | Hardening | Non-root, cô lập mạng, mật khẩu mạnh, security headers, phân quyền CSDL tối thiểu | mọi commit |

## 2. Kiến trúc hệ thống

| Dịch vụ | Image | Vai trò |
| :--- | :--- | :--- |
| `nginx` | `nginx:stable-alpine` | Reverse proxy, kết thúc HTTPS, security headers, rate limit |
| `cert-init` | `mysql:8.0` (dùng `openssl`) | Chạy một lần để sinh CA nội bộ và chứng chỉ HTTPS cho `localhost` |
| `backend` | build từ `backend/` (Node.js 24) | REST API và giao diện website |
| `mysql` | `mysql:8.0` | Cơ sở dữ liệu |
| `phpmyadmin` | `phpmyadmin:5.2-apache` | Công cụ quản trị MySQL |
| `prometheus` | `prom/prometheus:v3.5.0` | Thu thập metrics |
| `grafana` | `grafana/grafana:12.1.0` | Trực quan hóa metrics và log |
| `cadvisor` | `ghcr.io/google/cadvisor:0.57.0` | Metrics của container |
| `nginx-exporter` | `nginx/nginx-prometheus-exporter:1.4.2` | Metrics của web server |
| `mysql-exporter` | `prom/mysqld-exporter:v0.17.2` | Metrics của database |

- **Nginx là cổng vào duy nhất** và chỉ mở cổng trên `127.0.0.1`; MySQL, backend và các dịch vụ khác không mở cổng ra ngoài.
- Hệ thống tách thành hai mạng: `backend_network` (ứng dụng, CSDL) và `monitoring_network` (giám sát, log); chỉ Nginx và mysqld-exporter nối cả hai mạng.

## 3. Hướng dẫn chạy

**Yêu cầu:** Windows 10/11 có **Docker Desktop** (đang chạy) và **Git**; các cổng `80`, `443`, `3005`, `8080`, `8081`, `9095` trên máy chưa bị chương trình khác sử dụng.

**Bước 1 — Lấy mã nguồn**

```powershell
git clone https://github.com/dtc245200118-hub/ecommerce-devops.git
cd ecommerce-devops
```

**Bước 2 — Tạo file biến môi trường `.env`** từ file mẫu (đã có sẵn mật khẩu mặc định cho môi trường demo):

```powershell
Copy-Item .env.example .env
```

**Bước 3 — Khởi động hệ thống** (lần đầu mất vài phút để tải image):

```powershell
docker compose up -d --build
docker compose ps -a
```

Kết quả đúng: 9 container ở trạng thái `Up` và `cert-init` ở trạng thái `Exited (0)` (container chỉ chạy một lần để sinh chứng chỉ).

**Bước 4 — Tin cậy chứng chỉ HTTPS tự ký:** nhấp đúp `scripts\install-ca-cert.bat`, chọn **Yes** ở các hộp thoại, rồi mở lại trình duyệt. Nếu bỏ qua bước này, trình duyệt vẫn mở được trang nhưng hiện cảnh báo chứng chỉ.

**Địa chỉ truy cập** (mật khẩu mặc định trong `.env`):

| Dịch vụ | Địa chỉ | Tài khoản |
| :--- | :--- | :--- |
| Website | [https://localhost](https://localhost) | Admin: `admin@techzone.local` / `Admin@2026` |
| phpMyAdmin | [https://localhost:8081](https://localhost:8081) | `root` / `Root@2026`, `ecommerce_app` / `App@2026`, `report_user` / `Report@2026` |
| Grafana | [https://localhost:3005](https://localhost:3005) | `admin` / `Grafana@2026` |
| Prometheus | [https://localhost:9095](https://localhost:9095) | Không cần (chỉ mở trên máy local) |
| cAdvisor | [https://localhost:8080](https://localhost:8080) | Không cần (chỉ mở trên máy local) |

Tài khoản khách hàng mẫu: `an.nguyen@example.com`, `binh.tran@example.com`, `cuong.le@example.com`, `dung.pham@example.com` — mật khẩu `Customer@2026`.

**Lệnh thường dùng:**

```powershell
docker compose stop                 # tạm dừng hệ thống (giữ dữ liệu)
docker compose start                # chạy lại
docker compose logs -f backend      # xem log của một dịch vụ
docker compose down -v              # xóa container và dữ liệu, khởi tạo lại từ đầu (cần khi đổi mật khẩu trong .env)
```

## 4. Commit 1 — Ứng dụng web, MySQL và phpMyAdmin

**Chức năng website:** khách xem, tìm kiếm, lọc sản phẩm và thêm vào giỏ hàng; khách hàng đặt hàng, xem và hủy đơn của mình; quản trị viên xem thống kê doanh thu, quản lý sản phẩm và đơn hàng, xem danh sách khách hàng.

**Cơ sở dữ liệu MySQL** (script khởi tạo trong `database/`, chạy tự động ở lần khởi động đầu):

- 6 bảng: `users`, `categories`, `products`, `orders`, `order_items`, `order_status_history`.
- 6 view báo cáo (doanh thu theo ngày, sản phẩm bán chạy, doanh thu theo danh mục…), 3 stored procedure và 3 trigger (ghi lịch sử trạng thái, chặn sửa đơn đã hoàn thành).

| Tài khoản MySQL | Quyền |
| :--- | :--- |
| `root` | Toàn quyền, chỉ dùng để quản trị |
| `ecommerce_app` | Tài khoản của backend: chỉ thêm/đọc/sửa/xóa dữ liệu trên các bảng cần thiết, không có quyền tạo/sửa/xóa bảng (DDL) |
| `report_user` | Chỉ đọc 6 view báo cáo và gọi 3 procedure báo cáo, không đọc trực tiếp bảng gốc |
| `exporter` | Tài khoản của mysqld-exporter: `SELECT`, `PROCESS`, `REPLICATION CLIENT` (mức quyền mysqld-exporter yêu cầu), không có quyền ghi hay DDL |

**phpMyAdmin:** truy cập [https://localhost:8081](https://localhost:8081) và đăng nhập bằng một trong các tài khoản trên. Mô tả chi tiết và câu SQL mẫu: [`docs/sql-queries.md`](docs/sql-queries.md).

## 5. Commit 1 — Nginx reverse proxy, HTTPS và security headers

| Thành phần | Cấu hình |
| :--- | :--- |
| Reverse proxy | `:443` → website (backend), `:8081` → phpMyAdmin, `:3005` → Grafana, `:9095` → Prometheus, `:8080` → cAdvisor |
| HTTPS tự ký | `cert-init` sinh CA nội bộ và chứng chỉ server cho `localhost`; CA được cài vào Windows bằng `scripts\install-ca-cert.bat` |
| TLS | Chỉ cho phép TLS 1.2 và TLS 1.3; HTTP (`:80`) tự chuyển hướng sang HTTPS |
| Security headers | `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; website có thêm `Content-Security-Policy` |
| Rate limit | Đăng nhập/đăng ký: 10 request/phút cho mỗi IP; API: 30 request/giây; vượt ngưỡng trả về `429` |

Cấu hình: [`nginx/nginx.conf`](nginx/nginx.conf), [`nginx/snippets/`](nginx/snippets), [`scripts/generate-certs.sh`](scripts/generate-certs.sh).

## 6. Commit 2 — Giám sát với Prometheus và Grafana

Prometheus thu thập metrics mỗi 15 giây từ các nguồn:

| Đối tượng giám sát | Nguồn metrics | Job Prometheus |
| :--- | :--- | :--- |
| Container (CPU, RAM, mạng) | cAdvisor | `cadvisor` |
| Web server Nginx (kết nối, request) | nginx-exporter | `nginx` |
| Database MySQL (kết nối, truy vấn) | mysqld-exporter | `mysql` |
| Chính Prometheus | Prometheus | `prometheus` |

Grafana tự nạp datasource Prometheus và 1 dashboard **E-Commerce System Monitoring** ([https://localhost:3005/d/ecommerce-devops-auto](https://localhost:3005/d/ecommerce-devops-auto)) gồm 6 panel:

| Panel | Câu truy vấn | Ý nghĩa |
| :--- | :--- | :--- |
| Nginx Status | `nginx_up` | UP (1) = Nginx đang chạy, DOWN (0) = dừng |
| MySQL Status | `mysql_up` | UP (1) = MySQL đang chạy, DOWN (0) = dừng |
| Nginx Connections | `nginx_connections_active` | Số kết nối đang mở tới Nginx |
| MySQL Connections | `mysql_global_status_threads_connected` | Số kết nối đang mở tới MySQL |
| Container CPU (%) | `rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service=~"nginx\|backend\|mysql\|phpmyadmin"}[1m]) * 100` | % CPU của 4 container chính |
| Container Memory | `container_memory_working_set_bytes{container_label_com_docker_compose_service=~"nginx\|backend\|mysql\|phpmyadmin"}` | RAM của 4 container chính |

Giải thích chi tiết từng câu truy vấn: [`docs/dashboard-queries.md`](docs/dashboard-queries.md). Cấu hình: [`prometheus/prometheus.yml`](prometheus/prometheus.yml), [`grafana/`](grafana).

## 7. Hardening

| Biện pháp | Thực hiện | Cách kiểm tra |
| :--- | :--- | :--- |
| Container không chạy bằng root | Backend chạy bằng user `node` (`USER node` trong `backend/Dockerfile`) | `docker compose exec backend whoami` → `node` |
| Chống leo thang đặc quyền | `no-new-privileges:true` cho mọi container, trừ cAdvisor (chạy `privileged` để đọc thông tin container của máy host) | `docker inspect -f "{{.HostConfig.SecurityOpt}}" ecommerce_nginx` → `[no-new-privileges:true]` |
| Hạn chế cổng mở | Chỉ Nginx mở cổng, và chỉ trên `127.0.0.1`; MySQL và backend không mở cổng ra ngoài | `docker compose ps` |
| Cô lập mạng | Ứng dụng/CSDL ở `backend_network`, giám sát ở `monitoring_network`; chỉ Nginx và mysqld-exporter nối hai mạng | `docker compose exec prometheus wget -T 2 -qO- http://mysql:3306` → `bad address 'mysql:3306'` |
| Phân quyền CSDL tối thiểu | `ecommerce_app` không có quyền DDL; `report_user` chỉ đọc view | `ecommerce_app` chạy `CREATE TABLE ecommerce_db.t(id INT);` → lỗi `#1142` |
| Mật khẩu mạnh, tách bí mật khỏi mã nguồn | Mật khẩu nằm trong `.env` (không commit; `.env.example` chỉ chứa mật khẩu demo, phải đổi khi triển khai thật); mật khẩu người dùng băm bằng `scrypt`, bắt buộc đủ mạnh | Đăng ký với mật khẩu yếu → bị từ chối |
| HTTPS và security headers | Xem mục Commit 1 | `curl.exe -kI https://localhost` |
| Bảo vệ ứng dụng | Cookie phiên `HttpOnly`, `Secure`, `SameSite=Strict`; kiểm tra quyền phía server; chống CSRF, SQL injection; giới hạn số lần đăng nhập | Khách hàng gọi `/api/admin/stats` → `403` |

## 8. Kịch bản demo

| # | Nội dung | Cách làm | Kết quả mong đợi |
| :---: | :--- | :--- | :--- |
| 1 | Hệ thống chạy đủ | `docker compose ps -a` | Container `Up`, `cert-init` `Exited (0)` |
| 2 | HTTPS | `curl.exe -I http://localhost` | `301` chuyển sang `https://localhost/` |
| 3 | Security headers | `curl.exe -kI https://localhost` | Có `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`… |
| 4 | Mua hàng | Đăng nhập khách hàng mẫu → thêm giỏ → đặt hàng | Đơn hàng được tạo, tồn kho giảm |
| 5 | Phân quyền | Khách hàng mở `https://localhost/admin.html` | Bị chuyển về trang chủ |
| 6 | phpMyAdmin | Đăng nhập `root` | Thấy CSDL `ecommerce_db` (6 bảng, 6 view) |
| 7 | Quyền tối thiểu | Đăng nhập `ecommerce_app` / `MYSQL_PASSWORD`, chạy `CREATE TABLE ecommerce_db.t(id INT);` | Lỗi `#1142` |
| 8 | Trigger | Đăng nhập `root`, chạy `UPDATE ecommerce_db.orders SET status='pending' WHERE id=1;` | Lỗi `#1644` (đơn đã hoàn thành không được sửa) |
| 9 | Non-root | `docker compose exec backend whoami` | `node` |
| 10 | Prometheus | Mở `https://localhost:9095/targets` | 4 target đều **UP** |
| 11 | Grafana | Mở dashboard **E-Commerce System Monitoring** (`https://localhost:3005/d/ecommerce-devops-auto`) | 6 panel đều có dữ liệu; Nginx/MySQL Status hiện `UP` |

## 9. Cấu trúc thư mục

```text
ecommerce-devops/
├── docker-compose.yml     # Khai báo toàn bộ dịch vụ
├── .env.example           # Mẫu biến môi trường
├── backend/               # Mã nguồn Node.js (Express) và Dockerfile
├── frontend/              # Giao diện website (HTML, CSS, JavaScript)
├── database/              # Script khởi tạo CSDL: bảng, view, procedure, trigger, phân quyền
├── nginx/                 # Cấu hình Nginx, HTTPS và security headers
├── prometheus/            # Cấu hình thu thập metrics
├── grafana/               # Datasource và dashboard tự nạp
├── scripts/               # Sinh chứng chỉ, cài CA, sao lưu/khôi phục CSDL
└── docs/                  # Tài liệu SQL
```
