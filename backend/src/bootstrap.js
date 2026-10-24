const pool = require("./config/database");
const { hashPassword, isStrongPassword } = require("./utils/password");

// Tạo tài khoản admin từ biến môi trường nếu chưa tồn tại.
// Không lưu mật khẩu admin trong mã nguồn hay init.sql.
async function ensureAdmin() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    console.warn("[bootstrap] ADMIN_EMAIL/ADMIN_PASSWORD not set, skip creating admin");
    return;
  }

  if (!isStrongPassword(password)) {
    console.error("[bootstrap] ADMIN_PASSWORD is too weak (>= 8 chars, upper, lower, digit)");
    process.exit(1);
  }

  const [rows] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);
  if (rows.length > 0) return;

  await pool.execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    ["Administrator", email, await hashPassword(password)]
  );
  console.log(`[bootstrap] admin account created: ${email}`);
}

// MySQL có thể chưa sẵn sàng ngay khi container khởi động -> thử lại vài lần
async function bootstrap(retries = 10) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await ensureAdmin();
      return;
    } catch (error) {
      console.error(`[bootstrap] attempt ${attempt} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

module.exports = bootstrap;
