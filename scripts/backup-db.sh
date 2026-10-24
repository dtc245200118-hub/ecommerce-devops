#!/bin/bash
# Sao lưu CSDL (schema + dữ liệu + view + procedure + trigger) ra thư mục backups/
# Dùng: ./scripts/backup-db.sh
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/ecommerce_db_$(date +%Y%m%d_%H%M%S).sql"

# Mật khẩu root lấy từ biến môi trường BÊN TRONG container, không lộ trên dòng lệnh host
docker compose exec -T mysql sh -c '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot \
    --single-transaction --routines --triggers --events \
    --set-gtid-purged=OFF --default-character-set=utf8mb4 \
    --databases "$MYSQL_DATABASE" > /tmp/backup.sql'

docker compose cp mysql:/tmp/backup.sql "$FILE"
# Dọn file tạm bên trong container (đặt trong sh -c để Git Bash không đổi đường dẫn /tmp)
docker compose exec -T mysql sh -c 'rm -f /tmp/backup.sql'

echo "Backup saved to $FILE"
