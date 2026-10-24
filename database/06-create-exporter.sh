#!/bin/bash
set -euo pipefail

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}"
: "${MYSQL_EXPORTER_PASSWORD:?MYSQL_EXPORTER_PASSWORD is required}"

echo "Initializing MySQL exporter account..."

# Escape password safely for a MySQL SQL string literal.
# Convert it to hexadecimal so characters such as ', $, #, ! are supported.
PASSWORD_HEX="$(printf '%s' "$MYSQL_EXPORTER_PASSWORD" | od -An -tx1 | tr -d ' \n')"

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql \
  --protocol=socket \
  -uroot <<SQL

CREATE USER IF NOT EXISTS 'exporter'@'%'
IDENTIFIED BY RANDOM PASSWORD;

ALTER USER 'exporter'@'%'
IDENTIFIED BY RANDOM PASSWORD;

SET @exporter_password = CONVERT(UNHEX('${PASSWORD_HEX}') USING utf8mb4);
SET @sql = CONCAT(
  "ALTER USER 'exporter'@'%' IDENTIFIED BY ",
  QUOTE(@exporter_password)
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

GRANT SELECT, PROCESS, REPLICATION CLIENT
ON *.* TO 'exporter'@'%';

SQL

echo "MySQL exporter account initialized successfully."
