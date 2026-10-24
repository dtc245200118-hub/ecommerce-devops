#!/bin/bash
# =====================================================
# Sinh chứng chỉ HTTPS tự ký cho Nginx
# - Tạo 1 CA nội bộ (ca.crt) -> import vào máy để trình duyệt tin cậy
# - Chứng chỉ server cho localhost / 127.0.0.1 ký bởi CA đó
# Chạy tự động qua service "cert-init" trong docker-compose.
# =====================================================
set -euo pipefail

CERT_DIR="${CERT_DIR:-/certs}"
DAYS_CA=3650
DAYS_SERVER=825

mkdir -p "$CERT_DIR"
cd "$CERT_DIR"

if [ ! -f ca.key ] || [ ! -f ca.crt ]; then
  echo "[cert-init] Generating local CA..."
  openssl genrsa -out ca.key 4096 2>/dev/null
  openssl req -x509 -new -nodes -key ca.key -sha256 -days "$DAYS_CA" \
    -subj "/C=VN/O=TechZone DevOps Lab/CN=TechZone Local CA" \
    -out ca.crt
fi

# Tạo lại chứng chỉ server nếu chưa có, thiếu khóa, không khớp CA hoặc sắp hết hạn (< 30 ngày)
if [ ! -f server.crt ] || [ ! -f server.key ] \
  || ! openssl verify -CAfile ca.crt server.crt >/dev/null 2>&1 \
  || ! openssl x509 -checkend 2592000 -noout -in server.crt >/dev/null; then
  echo "[cert-init] Generating server certificate..."
  cat > server.ext <<EXT
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EXT

  openssl genrsa -out server.key 2048 2>/dev/null
  openssl req -new -key server.key \
    -subj "/C=VN/O=TechZone DevOps Lab/CN=localhost" \
    -out server.csr
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -days "$DAYS_SERVER" -sha256 -extfile server.ext -out server.crt 2>/dev/null
  rm -f server.csr server.ext
fi

cat server.crt ca.crt > fullchain.crt
chmod 644 ca.crt server.crt fullchain.crt
chmod 600 ca.key server.key

echo "[cert-init] Done. Import ${CERT_DIR}/ca.crt into your trusted root CAs to remove browser warnings."
