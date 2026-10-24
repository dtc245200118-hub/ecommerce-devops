# Script tự động cài đặt chứng chỉ CA của dự án vào Windows Trusted Root Certification Authorities
$certPath = Join-Path $PSScriptRoot "..\nginx\certs\ca.crt"

if (-not (Test-Path $certPath)) {
    Write-Host "Lỗi: Không tìm thấy tệp chứng chỉ CA tại: $certPath" -ForegroundColor Red
    Pause
    exit 1
}

# Kiểm tra quyền Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Đang yêu cầu quyền Administrator để cài đặt chứng chỉ..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

try {
    $resolvedPath = (Resolve-Path $certPath).Path
    Import-Certificate -FilePath $resolvedPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Import-Certificate -FilePath $resolvedPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    Write-Host ""
    Write-Host "=========================================================================" -ForegroundColor Green
    Write-Host " [THÀNH CÔNG] ĐÃ CÀI ĐẶT CHỨNG CHỈ CA VÀO HỆ THỐNG WINDOWS!" -ForegroundColor Green
    Write-Host "=========================================================================" -ForegroundColor Green
    Write-Host " Trình duyệt Edge / Chrome sẽ nhận diện kết nối là AN TOÀN (Bảo mật HTTPS)." -ForegroundColor White
    Write-Host " BƯỚC TIẾP THEO: Hãy ĐÓNG HOÀN TOÀN trình duyệt Edge/Chrome và mở lại." -ForegroundColor Cyan
    Write-Host " Sau đó truy cập lại: https://localhost" -ForegroundColor Yellow
    Write-Host "=========================================================================" -ForegroundColor Green
} catch {
    Write-Host "Lỗi khi cài đặt chứng chỉ: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Nhấn phím bất kỳ để đóng cửa sổ này..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
