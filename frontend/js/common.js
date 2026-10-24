// =====================================================
// Tiện ích dùng chung cho mọi trang (storefront, login, orders, admin)
// =====================================================

const API_URL = "/api";
const SVG_NS = "http://www.w3.org/2000/svg";

const $ = (id) => document.getElementById(id);

const formatMoney = (value) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND"
  }).format(Number(value));

const formatDate = (value) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(paths) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  paths.forEach((d) => {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  });
  return svg;
}

const ICONS = {
  check: ["m5 12 5 5 9-10"],
  alert: ["M12 8v5", "M12 16.5v.01"],
  user: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"],
  box: ["M21 8 12 3 3 8v8l9 5 9-5z", "M3 8l9 5 9-5", "M12 13v8"],
  logout: ["M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4", "M10 17l-5-5 5-5", "M5 12h11"],
  dashboard: ["M4 4h7v9H4z", "M13 4h7v5h-7z", "M13 11h7v9h-7z", "M4 15h7v5H4z"],
  plus: ["M12 5v14", "M5 12h14"]
};

function toast(text, type = "success") {
  let container = $("toastContainer");
  if (!container) {
    container = el("div", "toasts");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  if (container.children.length >= 3) container.firstElementChild.remove();

  const node = el("div", `toast toast-${type}`);
  node.append(icon(type === "success" ? ICONS.check : ICONS.alert), el("span", "", text));
  container.appendChild(node);

  setTimeout(() => {
    node.classList.add("hide");
    setTimeout(() => node.remove(), 300);
  }, 2800);
}

// Gọi API: tự gửi cookie phiên, ném lỗi kèm message tiếng Việt từ server
async function api(path, { method = "GET", body } = {}) {
  const options = { method, credentials: "same-origin", headers: {} };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  let result = {};
  try {
    result = await response.json();
  } catch {
    // Phản hồi không phải JSON (vd. 429 từ Nginx)
  }

  if (!response.ok || result.success === false) {
    const message =
      result.message ||
      (response.status === 429 ? "Bạn thao tác quá nhanh, vui lòng thử lại sau" : "Có lỗi xảy ra, vui lòng thử lại");
    const error = new Error(message);
    error.status = response.status;
    error.data = result;
    throw error;
  }

  return result;
}

// Ảnh mặc định theo danh mục khi sản phẩm chưa có image_url
const PRODUCT_IMAGES = [
  ["laptop", "laptop.svg"],
  ["dien thoai", "phone.svg"],
  ["tablet", "tablet.svg"],
  ["am thanh", "headphones.svg"],
  ["dong ho", "watch.svg"],
  ["ban phim", "keyboard.svg"],
  ["phu kien", "mouse.svg"]
];

function productImage(product) {
  if (product.image_url) return product.image_url;
  const haystack = normalize(`${product.category_name} ${product.name}`);
  const match = PRODUCT_IMAGES.find(([key]) => haystack.includes(key));
  return `/images/products/${match ? match[1] : "box.svg"}`;
}

// =====================================================
// Xác thực
// =====================================================

const Auth = {
  user: null,

  async load() {
    try {
      const result = await api("/auth/me");
      this.user = result.user;
    } catch {
      this.user = null;
    }
    return this.user;
  },

  async logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      localStorage.removeItem("techzone_cart");
      window.location.href = "/";
    }
  }
};

function menuLink(href, text, iconPaths) {
  const link = el("a", "menu-item");
  link.href = href;
  link.append(icon(iconPaths), el("span", "", text));
  return link;
}

// Hiển thị khu vực tài khoản trên header theo vai trò
function renderAccount(container, user) {
  if (!container) return;
  container.replaceChildren();

  if (!user) {
    const login = el("a", "btn btn-ghost account-login");
    login.href = `/login.html?next=${encodeURIComponent(location.pathname)}`;
    login.append(icon(ICONS.user), el("span", "account-label", "Đăng nhập"));
    container.appendChild(login);
    return;
  }

  const details = el("details", "account-menu");
  const summary = el("summary", "account-trigger");
  const avatar = el("span", "avatar", user.name.trim().charAt(0).toUpperCase());
  const label = el("span", "account-label", user.name);
  summary.append(avatar, label);

  const menu = el("div", "menu");
  const head = el("div", "menu-head");
  head.append(el("strong", "", user.name), el("span", "", user.email));
  const role = el("span", `role-badge role-${user.role}`, user.role === "admin" ? "Quản trị viên" : "Khách hàng");
  head.appendChild(role);
  menu.appendChild(head);

  if (user.role === "admin") {
    menu.append(menuLink("/admin.html", "Trang quản trị", ICONS.dashboard), menuLink("/", "Xem cửa hàng", ICONS.box));
  } else {
    menu.append(menuLink("/orders.html", "Đơn mua của tôi", ICONS.box));
  }

  const logout = el("button", "menu-item danger");
  logout.type = "button";
  logout.append(icon(ICONS.logout), el("span", "", "Đăng xuất"));
  logout.addEventListener("click", () => Auth.logout());
  menu.appendChild(logout);

  details.append(summary, menu);
  container.appendChild(details);

  // Đóng menu khi click ra ngoài
  document.addEventListener("click", (event) => {
    if (!details.contains(event.target)) details.open = false;
  });
}

const ORDER_STATUS = {
  pending: { label: "Chờ xác nhận", className: "status-pending" },
  confirmed: { label: "Đang giao", className: "status-confirmed" },
  completed: { label: "Hoàn thành", className: "status-completed" },
  cancelled: { label: "Đã hủy", className: "status-cancelled" }
};

function statusBadge(status) {
  const info = ORDER_STATUS[status] || { label: status, className: "" };
  return el("span", `status ${info.className}`, info.label);
}
