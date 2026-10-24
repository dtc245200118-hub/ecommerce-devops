#!/bin/bash
# Khôi phục CSDL từ file backup
# Dùng: ./scripts/restore-db.sh backups/ecommerce_db_YYYYMMDD_HHMMSS.sql
set -euo pipefail

FILE="${1:?Usage: $0 <backup.sql>}"
# Đổi sang đường dẫn tuyệt đối trước khi cd về thư mục dự án
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
cd "$(dirname "$0")/.."

docker compose cp "$FILE" mysql:/tmp/restore.sql
docker compose exec -T mysql sh -c '
  MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 < /tmp/restore.sql
  rm -f /tmp/restore.sql'

echo "Restored from $FILE"
