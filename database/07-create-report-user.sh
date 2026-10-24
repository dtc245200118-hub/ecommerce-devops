#!/bin/bash
# =====================================================
# 07-REPORT USER: tài khoản chỉ đọc báo cáo (dùng trong phpMyAdmin)
# - Chỉ SELECT trên các VIEW và EXECUTE các procedure báo cáo
# - KHÔNG đọc được bảng users (password_hash), KHÔNG sửa/xóa dữ liệu
# =====================================================
set -euo pipefail

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${MYSQL_REPORT_PASSWORD:?MYSQL_REPORT_PASSWORD is required}"

echo "Initializing read-only report account..."

# Mã hóa hex để mật khẩu chứa ký tự đặc biệt vẫn an toàn trong SQL
PASSWORD_HEX="$(printf '%s' "$MYSQL_REPORT_PASSWORD" | od -An -tx1 | tr -d ' \n')"

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
CREATE USER IF NOT EXISTS 'report_user'@'%' IDENTIFIED BY RANDOM PASSWORD;

SET @report_password = CONVERT(UNHEX('${PASSWORD_HEX}') USING utf8mb4);
SET @sql = CONCAT("ALTER USER 'report_user'@'%' IDENTIFIED BY ", QUOTE(@report_password));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

GRANT SELECT ON ecommerce_db.v_order_details      TO 'report_user'@'%';
GRANT SELECT ON ecommerce_db.v_daily_revenue      TO 'report_user'@'%';
GRANT SELECT ON ecommerce_db.v_product_sales      TO 'report_user'@'%';
GRANT SELECT ON ecommerce_db.v_category_revenue   TO 'report_user'@'%';
GRANT SELECT ON ecommerce_db.v_low_stock_products TO 'report_user'@'%';
GRANT SELECT ON ecommerce_db.v_customer_summary   TO 'report_user'@'%';

GRANT EXECUTE ON PROCEDURE ecommerce_db.sp_revenue_report  TO 'report_user'@'%';
GRANT EXECUTE ON PROCEDURE ecommerce_db.sp_top_products    TO 'report_user'@'%';
GRANT EXECUTE ON PROCEDURE ecommerce_db.sp_customer_orders TO 'report_user'@'%';

FLUSH PRIVILEGES;
SQL

echo "Report account initialized successfully."
