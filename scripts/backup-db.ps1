# Sao lưu CSDL trên Windows PowerShell
# Dùng: .\scripts\backup-db.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
New-Item -ItemType Directory -Force -Path backups | Out-Null
$file = "backups/ecommerce_db_$(Get-Date -Format yyyyMMdd_HHmmss).sql"

docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --events --set-gtid-purged=OFF --default-character-set=utf8mb4 --databases "$MYSQL_DATABASE" > /tmp/backup.sql'
if ($LASTEXITCODE -ne 0) { throw "mysqldump thất bại - container mysql có đang chạy không?" }
docker compose cp mysql:/tmp/backup.sql $file
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $file)) { throw "Không copy được file backup ra máy host" }
docker compose exec -T mysql rm -f /tmp/backup.sql

Write-Host "Backup saved to $file"
