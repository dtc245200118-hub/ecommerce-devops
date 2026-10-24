const express = require("express");
const pool = require("../config/database");
const rateLimit = require("../utils/rateLimit");
const { hashPassword, verifyPassword, isStrongPassword } = require("../utils/password");
const { setSessionCookie, clearSessionCookie } = require("../utils/session");
const { isText, isEmail } = require("../utils/validate");

const router = express.Router();

// Chống brute-force: tối đa 10 lần đăng nhập / 15 phút cho mỗi IP + email
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`,
  message: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút."
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: (req) => req.ip,
  message: "Bạn đã tạo quá nhiều tài khoản. Vui lòng thử lại sau."
});

// Hash giả để thời gian phản hồi như nhau khi email không tồn tại
const DUMMY_HASH =
  "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role
});

// GET /api/auth/me - Thông tin người dùng hiện tại
router.get("/me", (req, res) => {
  res.json({ success: true, user: req.user ? publicUser(req.user) : null });
});

// POST /api/auth/register - Đăng ký tài khoản khách hàng
router.post("/register", registerLimiter, async (req, res, next) => {
  const { name, email, password } = req.body || {};

  if (!isText(name, 2, 100) || !isEmail(email)) {
    return res.status(400).json({ success: false, message: "Họ tên hoặc email không hợp lệ" });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      success: false,
      message: "Mật khẩu phải từ 8 ký tự, gồm chữ hoa, chữ thường và số"
    });
  }

  try {
    const passwordHash = await hashPassword(password);

    // Role luôn là 'customer' - không cho client tự chọn role
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')",
      [name.trim(), email.trim().toLowerCase(), passwordHash]
    );

    const user = { id: result.insertId, name: name.trim(), email: email.trim().toLowerCase(), role: "customer" };
    console.log(`[user] registered user_id=${user.id} ip=${req.ip}`);
    setSessionCookie(res, user);
    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Email đã được sử dụng" });
    }
    next(error);
  }
});

// POST /api/auth/login - Đăng nhập
router.post("/login", loginLimiter, async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!isEmail(email) || typeof password !== "string" || password.length > 72) {
    return res.status(400).json({ success: false, message: "Email hoặc mật khẩu không đúng" });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const [rows] = await pool.execute(
      "SELECT id, name, email, role, password_hash FROM users WHERE email = ?",
      [normalizedEmail]
    );

    // So khớp chính xác (collation của MySQL không phân biệt dấu) để trùng với khóa rate limit
    const user = rows.find((row) => row.email === normalizedEmail);
    const valid = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);

    if (!user || !valid) {
      console.warn(`[auth] login failed email=${JSON.stringify(email)} ip=${req.ip}`);
      return res.status(401).json({ success: false, message: "Email hoặc mật khẩu không đúng" });
    }

    console.log(`[auth] login success user_id=${user.id} role=${user.role} ip=${req.ip}`);
    setSessionCookie(res, user);
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Đăng xuất
router.post("/logout", (req, res) => {
  if (req.user) console.log(`[user] logout user_id=${req.user.id} role=${req.user.role} ip=${req.ip}`);
  clearSessionCookie(res);
  res.json({ success: true });
});

module.exports = router;
