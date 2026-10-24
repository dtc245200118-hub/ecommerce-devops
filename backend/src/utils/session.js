const crypto = require("crypto");

const COOKIE_NAME = "tz_session";
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 giờ

const secret = process.env.SESSION_SECRET || "";

if (secret.length < 32) {
  console.error("SESSION_SECRET must be at least 32 characters");
  process.exit(1);
}

const sign = (data) =>
  crypto.createHmac("sha256", secret).update(data).digest("base64url");

// Token = base64url(payload).signature (HMAC-SHA256)
function createToken(user) {
  const payload = Buffer.from(
    JSON.stringify({
      uid: user.id,
      exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== "string") return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!Number.isSafeInteger(data.uid) || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

function parseCookies(header) {
  const cookies = {};
  String(header || "")
    .split(";")
    .forEach((part) => {
      const index = part.indexOf("=");
      if (index > 0) {
        const value = part.slice(index + 1).trim();
        try {
          cookies[part.slice(0, index).trim()] = decodeURIComponent(value);
        } catch {
          // Cookie của ứng dụng khác trên localhost có thể chứa '%' sai định dạng -> giữ nguyên
          cookies[part.slice(0, index).trim()] = value;
        }
      }
    });
  return cookies;
}

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: MAX_AGE_SECONDS * 1000
};

function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, createToken(user), cookieOptions);
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
}

module.exports = {
  COOKIE_NAME,
  verifyToken,
  parseCookies,
  setSessionCookie,
  clearSessionCookie
};
