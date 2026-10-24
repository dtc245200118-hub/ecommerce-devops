const pool = require("../config/database");
const { COOKIE_NAME, verifyToken, parseCookies } = require("../utils/session");

// Đọc cookie phiên và nạp user hiện tại (role luôn lấy từ DB, không tin client)
async function loadUser(req, res, next) {
  req.user = null;

  const session = verifyToken(parseCookies(req.headers.cookie)[COOKIE_NAME]);
  if (!session) return next();

  try {
    const [rows] = await pool.execute(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [session.uid]
    );
    req.user = rows[0] || null;
    next();
  } catch (error) {
    next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Vui lòng đăng nhập" });
  }
  next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Vui lòng đăng nhập" });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ success: false, message: "Bạn không có quyền thực hiện thao tác này" });
    }
    next();
  };
}

// Bảo vệ trang HTML: chưa đăng nhập/không đủ quyền thì chuyển hướng
function requirePage(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect(`/login.html?next=${encodeURIComponent(req.path)}`);
    if (role && req.user.role !== role) return res.redirect("/");
    next();
  };
}

module.exports = { loadUser, requireAuth, requireRole, requirePage };
