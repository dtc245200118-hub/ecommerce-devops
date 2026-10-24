# Khôi phục CSDL trên Windows PowerShell
# Dùng: .\scripts\restore-db.ps1 backups\ecommerce_db_YYYYMMDD_HHMMSS.sql
param([Parameter(Mandatory = $true)][string]$File)
$ErrorActionPreference = "Stop"
$File = (Resolve-Path $File).Path
Set-Location (Join-Path $PSScriptRoot "..")

docker compose cp $File mysql:/tmp/restore.sql
if ($LASTEXITCODE -ne 0) { throw "Không copy được file vào container mysql - container có đang chạy không?" }
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot --default-character-set=utf8mb4 < /tmp/restore.sql; status=$?; rm -f /tmp/restore.sql; exit $status'
if ($LASTEXITCODE -ne 0) { throw "Khôi phục thất bại" }

Write-Host "Restored from $File"
