// Chỉ ASCII: MySQL (utf8mb4_unicode_ci) so khớp bỏ qua dấu/độ rộng chữ, sẽ lệch với khóa rate limit
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const PHONE_RE = /^(\+84|0)\d{9,10}$/;
const IMAGE_RE = /^\/images\/[a-z0-9/_-]+\.(svg|png|jpe?g|webp)$/i;

const isText = (value, min, max) =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

const isEmail = (value) =>
  typeof value === "string" && value.length <= 150 && EMAIL_RE.test(value.trim());

const isPhone = (value) => typeof value === "string" && PHONE_RE.test(value.replace(/\s/g, ""));

const isImagePath = (value) => typeof value === "string" && IMAGE_RE.test(value) && !value.includes("..");

const isInt = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = { isText, isEmail, isPhone, isImagePath, isInt, httpError };
