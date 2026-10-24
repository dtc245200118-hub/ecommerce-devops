# Giải thích dashboard Grafana

Dashboard **E-Commerce System Monitoring** (`https://localhost:3005/d/ecommerce-devops-auto`) được Grafana tự nạp từ file `grafana/dashboards/ecommerce-monitoring.json`. Dashboard có 7 panel, tự làm mới 10 giây một lần và hiển thị dữ liệu 15 phút gần nhất. Panel 1-6 lấy dữ liệu từ Prometheus, panel 7 lấy log từ Loki.

| # | Panel | Câu truy vấn | Giải thích |
| :---: | :--- | :--- | :--- |
| 1 | Nginx Status | `nginx_up` | Bằng 1 (hiện UP) khi Nginx đang chạy, bằng 0 (hiện DOWN) khi Nginx dừng. |
| 2 | MySQL Status | `mysql_up` | Bằng 1 (hiện UP) khi kết nối được MySQL, bằng 0 (hiện DOWN) khi MySQL dừng. |
| 3 | Nginx Connections | `nginx_connections_active` | Số kết nối đang mở tới Nginx. |
| 4 | MySQL Connections | `mysql_global_status_threads_connected` | Số kết nối đang mở tới MySQL. |
| 5 | Container CPU (%) | `rate(container_cpu_usage_seconds_total{container_label_com_docker_compose_service=~"nginx\|backend\|mysql\|phpmyadmin"}[1m]) * 100` | Phần trăm CPU mà 4 container nginx, backend, mysql, phpmyadmin đang dùng. |
| 6 | Container Memory | `container_memory_working_set_bytes{container_label_com_docker_compose_service=~"nginx\|backend\|mysql\|phpmyadmin"}` | Dung lượng RAM mà 4 container trên đang dùng. |
| 7 | Application Logs | `{service=~"nginx\|backend"}` | Các dòng log mới nhất của Nginx và backend, lấy từ Loki. |

## 1. "_up" là gì

`nginx_up` và `mysql_up` do exporter tạo ra. Mỗi lần Prometheus thu thập số liệu (15 giây một lần), nginx-exporter thử đọc trang trạng thái của Nginx, còn mysqld-exporter thử kết nối vào MySQL. Làm được thì giá trị là 1, không được thì là 0. Trên dashboard em cấu hình value mapping để 1 hiện chữ UP màu xanh, 0 hiện chữ DOWN màu đỏ. Ví dụ chạy `docker compose stop mysql` thì sau khoảng 15 giây ô MySQL Status chuyển sang DOWN.

## 2. "rate(...[1m]) * 100" là gì

`container_cpu_usage_seconds_total` là một counter, tức là tổng số giây CPU container đã dùng từ lúc chạy, giá trị chỉ tăng dần nên nhìn trực tiếp không biết container đang bận hay rảnh. Hàm `rate(...[1m])` tính xem trong 1 phút gần nhất con số này tăng trung bình bao nhiêu mỗi giây. Nếu mỗi giây container dùng 0,05 giây CPU thì nó đang dùng 5% của một nhân CPU, vì vậy nhân thêm 100 để đổi ra phần trăm.

## 3. "=~" và dấu "|" là gì

`=~` là so khớp nhãn theo biểu thức chính quy (regex), còn dấu `|` trong regex nghĩa là "hoặc". Vì vậy `container_label_com_docker_compose_service=~"nginx|backend|mysql|phpmyadmin"` nghĩa là chỉ lấy các container có tên dịch vụ trong Docker Compose là nginx hoặc backend hoặc mysql hoặc phpmyadmin. Nhãn này do Docker Compose tự gắn vào mỗi container và cAdvisor đọc lại. Tương tự, `{service=~"nginx|backend"}` trong panel 7 là lấy log của Nginx hoặc backend.
