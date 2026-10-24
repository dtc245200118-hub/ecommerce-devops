require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const path = require("path");

const { loadUser, requirePage } = require("./src/middleware/auth");
const sameOrigin = require("./src/middleware/sameOrigin");
const bootstrap = require("./src/bootstrap");

// Import API routes
const authRoutes = require("./src/routes/authRoutes");
const productRoutes = require("./src/routes/productRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Backend chỉ nhận request qua Nginx (1 proxy) -> lấy đúng IP client
app.set("trust proxy", 1);
app.disable("x-powered-by");

// 1. Security middleware
app.use(helmet());

// 2. Body parser (giới hạn kích thước payload)
app.use(express.json({ limit: "20kb" }));

// 3. Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ecommerce-backend"
  });
});

// 4. Session + CSRF protection
app.use(loadUser);
app.use("/api", sameOrigin);

// Không cache dữ liệu API (đặc biệt là dữ liệu cá nhân)
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// 5. API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// 6. Frontend - các trang cần đăng nhập được kiểm tra phía server
const frontendPath =
  process.env.NODE_ENV === "production"
    ? "/frontend"
    : path.join(__dirname, "../frontend");

const sendPage = (file) => (req, res) => res.sendFile(path.join(frontendPath, file));

app.get(["/admin", "/admin.html"], requirePage("admin"), sendPage("admin.html"));
app.get(["/orders", "/orders.html"], requirePage("customer"), sendPage("orders.html"));
app.get(["/login", "/login.html"], (req, res, next) => {
  if (req.user) return res.redirect(req.user.role === "admin" ? "/admin.html" : "/");
  next();
}, sendPage("login.html"));

// express.static chỉ được phục vụ file công khai; admin.html/orders.html chỉ đi qua route kiểm tra quyền ở trên.
// Dùng danh sách cho phép trên đường dẫn gốc (chưa giải mã) vì /%61dmin.html, tên ngắn ADMIN~1.HTM hay
// admin.html::$DATA (frontend mount từ ổ NTFS) vẫn trỏ được tới file trang quản trị
const PUBLIC_FILE = /^\/(?:index\.html|login\.html|(?:css|js|images)\/[\w/-]+\.(?:css|js|svg|png|jpe?g|webp))?$/;
app.use((req, res, next) => {
  if (PUBLIC_FILE.test(req.path)) return next();
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(express.static(frontendPath, { index: "index.html" }));

// 7. Handle unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

// 8. Error handler - không lộ chi tiết lỗi nội bộ ra ngoài
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
    return res.status(400).json({ success: false, message: "Dữ liệu gửi lên không hợp lệ" });
  }

  if (!error.status) console.error(`[error] ${req.method} ${req.originalUrl}:`, error);

  res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : "Có lỗi xảy ra, vui lòng thử lại sau"
  });
});

// 9. Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`E-Commerce backend running on port ${PORT}`);
  bootstrap();
});
