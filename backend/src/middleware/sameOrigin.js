// Chống CSRF: request thay đổi dữ liệu phải đến từ cùng origin
// (kết hợp với cookie SameSite=Strict)
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function sameOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const source = req.headers.origin || req.headers.referer;
  if (source) {
    try {
      if (new URL(source).host === req.headers.host) return next();
    } catch {
      // URL không hợp lệ -> từ chối bên dưới
    }
  } else if (req.headers["sec-fetch-site"] === "same-origin") {
    return next();
  }

  return res.status(403).json({ success: false, message: "Yêu cầu không hợp lệ (CSRF)" });
}

module.exports = sameOrigin;
