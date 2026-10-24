const IMAGE_OPTIONS = [
  ["", "Tự động theo danh mục"],
  ["/images/products/laptop.svg", "Laptop"],
  ["/images/products/phone.svg", "Điện thoại"],
  ["/images/products/tablet.svg", "Tablet"],
  ["/images/products/headphones.svg", "Tai nghe"],
  ["/images/products/watch.svg", "Đồng hồ"],
  ["/images/products/mouse.svg", "Chuột"],
  ["/images/products/keyboard.svg", "Bàn phím"],
  ["/images/products/box.svg", "Hộp sản phẩm"]
];

const VIEW_TITLES = {
  dashboard: "Tổng quan",
  products: "Quản lý sản phẩm",
  orders: "Quản lý đơn hàng",
  users: "Khách hàng",
  system: "Giám sát hệ thống"
};

const NEXT_ACTIONS = {
  pending: [["confirmed", "Xác nhận", "btn-primary"], ["cancelled", "Hủy", "btn-danger-ghost"]],
  confirmed: [["completed", "Hoàn thành", "btn-primary"], ["cancelled", "Hủy", "btn-danger-ghost"]]
};

const admin = {
  products: [],
  categories: [],
  orders: [],
  users: [],
  orderFilter: "all",
  productSearch: "",
  editingId: null
};

// =====================================================
// Helpers
// =====================================================

function table(target, headers, rows, emptyText) {
  const thead = el("thead");
  const headRow = el("tr");
  headers.forEach((text) => headRow.appendChild(el("th", "", text)));
  thead.appendChild(headRow);

  const tbody = el("tbody");
  if (rows.length === 0) {
    const tr = el("tr");
    const td = el("td", "table-empty", emptyText);
    td.colSpan = headers.length;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    rows.forEach((cells) => {
      const tr = el("tr");
      cells.forEach((cell) => {
        const td = el("td");
        if (cell instanceof Node) td.appendChild(cell);
        else td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  target.replaceChildren(thead, tbody);
}

function button(text, className, onClick) {
  const node = el("button", `btn btn-sm ${className}`, text);
  node.type = "button";
  node.addEventListener("click", onClick);
  return node;
}

function group(...children) {
  const node = el("div", "cell-actions");
  node.append(...children);
  return node;
}

function productCell(product) {
  const wrap = el("div", "cell-product");
  const thumb = el("div", "cart-thumb sm");
  const img = el("img");
  img.src = productImage(product);
  img.alt = "";
  thumb.appendChild(img);
  const text = el("div");
  text.append(el("strong", "", product.name), el("span", "muted", product.category_name || "—"));
  wrap.append(thumb, text);
  return wrap;
}

function handleAuthError(error) {
  if (error.status === 401 || error.status === 403) {
    window.location.href = "/login.html?next=/admin.html";
    return true;
  }
  return false;
}

// =====================================================
// Navigation
// =====================================================

function showView(view) {
  Object.keys(VIEW_TITLES).forEach((name) => {
    $(`view-${name}`).hidden = name !== view;
  });
  document.querySelectorAll(".side-link[data-view]").forEach((link) => {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("viewTitle").textContent = VIEW_TITLES[view];
  history.replaceState(null, "", `#${view}`);

  const loaders = {
    dashboard: loadDashboard,
    products: loadProducts,
    orders: loadOrders,
    users: loadUsers,
    system: renderSystem
  };
  loaders[view]();
}

// =====================================================
// Dashboard
// =====================================================

function statCard(label, value, hint, tone) {
  const card = el("div", `stat-card tone-${tone}`);
  card.append(el("span", "stat-label", label), el("strong", "stat-value", value), el("span", "stat-hint", hint));
  return card;
}

async function loadDashboard() {
  try {
    const [{ data: stats }, { data: orders }] = await Promise.all([api("/admin/stats"), api("/admin/orders")]);
    admin.orders = orders;
    updatePendingBadge();

    $("statGrid").replaceChildren(
      statCard("Doanh thu", formatMoney(stats.revenue), "Không tính đơn đã hủy", 1),
      statCard("Đơn hàng", String(stats.total_orders), `${stats.pending_orders} đơn chờ xác nhận`, 2),
      statCard("Khách hàng", String(stats.total_customers), "Tài khoản đã đăng ký", 3),
      statCard("Sản phẩm", String(stats.total_products), `${stats.low_stock} sản phẩm sắp hết hàng`, 4)
    );

    table(
      $("recentOrders"),
      ["Mã đơn", "Khách hàng", "Tổng tiền", "Trạng thái"],
      orders.slice(0, 6).map((order) => [`#${order.id}`, order.customer_name, formatMoney(order.total_amount), statusBadge(order.status)]),
      "Chưa có đơn hàng"
    );

    renderRevenueChart(stats.daily_revenue);

    table(
      $("categoryTable"),
      ["Danh mục", "Đã bán", "Doanh thu"],
      stats.category_revenue.map((row) => [row.category_name, String(row.sold_quantity), formatMoney(row.revenue)]),
      "Chưa có dữ liệu"
    );

    const top = $("topProducts");
    top.replaceChildren(
      ...stats.top_products.map((product) => {
        const li = el("li");
        li.append(el("span", "", product.name), el("strong", "", `${product.sold} đã bán`));
        return li;
      })
    );
    if (stats.top_products.length === 0) top.appendChild(el("li", "muted", "Chưa có dữ liệu bán hàng"));
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
  }
}

// Biểu đồ cột doanh thu 7 ngày (CSSOM -> không vi phạm CSP style-src 'self')
function renderRevenueChart(rows) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86400000);
    days.push(date.toISOString().slice(0, 10));
  }

  const values = days.map((day) => Number(byDay.get(day)?.revenue || 0));
  const max = Math.max(...values, 1);

  $("revenueChart").replaceChildren(
    ...days.map((day, index) => {
      const column = el("div", "bar-col");
      const value = values[index];
      const orders = byDay.get(day)?.total_orders || 0;

      const bar = el("div", "bar");
      bar.style.height = `${Math.max((value / max) * 100, value ? 4 : 0)}%`;
      bar.title = `${formatMoney(value)} · ${orders} đơn`;

      const track = el("div", "bar-track");
      track.appendChild(bar);

      const [, month, date] = day.split("-");
      column.append(
        el("span", "bar-value", value ? `${(value / 1e6).toFixed(1)}tr` : "0"),
        track,
        el("span", "bar-label", `${date}/${month}`)
      );
      return column;
    })
  );
}

function updatePendingBadge() {
  const pending = admin.orders.filter((order) => order.status === "pending").length;
  const badge = $("pendingBadge");
  badge.textContent = pending;
  badge.hidden = pending === 0;
}

// =====================================================
// Products
// =====================================================

async function loadProducts() {
  try {
    const [{ data: products }, { data: categories }] = await Promise.all([
      api("/admin/products"),
      api("/products/categories")
    ]);
    admin.products = products;
    admin.categories = categories;
    renderProducts();
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
  }
}

function renderProducts() {
  const keyword = normalize(admin.productSearch);
  const list = admin.products.filter((p) => normalize(`${p.name} ${p.category_name}`).includes(keyword));

  table(
    $("productTable"),
    ["Sản phẩm", "Giá", "Tồn kho", "Đã đặt", "Trạng thái", ""],
    list.map((product) => {
      const stock = el("span", product.stock <= 5 ? "text-warning" : "", String(product.stock));
      const status = el(
        "span",
        `status ${product.is_active ? "status-completed" : "status-cancelled"}`,
        product.is_active ? "Đang bán" : "Đã ẩn"
      );

      return [
        productCell(product),
        formatMoney(product.price),
        stock,
        String(product.order_count),
        status,
        group(
          button("Sửa", "btn-ghost", () => openProductDialog(product)),
          button(product.is_active ? "Ẩn" : "Hiện", "btn-ghost", () => toggleProduct(product)),
          button("Xóa", "btn-danger-ghost", () => deleteProduct(product))
        )
      ];
    }),
    "Không có sản phẩm"
  );
}

async function toggleProduct(product) {
  try {
    await api(`/admin/products/${product.id}/active`, {
      method: "PATCH",
      body: { is_active: !product.is_active }
    });
    toast(product.is_active ? `Đã ẩn "${product.name}"` : `Đã hiển thị "${product.name}"`);
    loadProducts();
  } catch (error) {
    toast(error.message, "error");
    if (error.status === 404) loadProducts();
  }
}

async function deleteProduct(product) {
  if (!confirm(`Xóa vĩnh viễn sản phẩm "${product.name}"?`)) return;
  try {
    await api(`/admin/products/${product.id}`, { method: "DELETE" });
    toast(`Đã xóa "${product.name}"`);
    loadProducts();
  } catch (error) {
    toast(error.message, "error");
  }
}

function fillSelect(select, options, value) {
  select.replaceChildren(
    ...options.map(([optionValue, label]) => {
      const option = el("option", "", label);
      option.value = optionValue;
      return option;
    })
  );
  select.value = value;
}

function updatePreview() {
  const category = admin.categories.find((c) => String(c.id) === $("pCategory").value);
  $("pPreview").src = productImage({
    image_url: $("pImage").value,
    category_name: category?.name,
    name: $("pName").value
  });
}

function openProductDialog(product = null) {
  admin.editingId = product ? product.id : null;
  admin.editingStock = product ? product.stock : null;
  $("productDialogTitle").textContent = product ? `Sửa sản phẩm #${product.id}` : "Thêm sản phẩm";
  $("productError").textContent = "";

  fillSelect($("pCategory"), admin.categories.map((c) => [String(c.id), c.name]), String(product?.category_id || admin.categories[0]?.id || ""));
  fillSelect($("pImage"), IMAGE_OPTIONS, product?.image_url || "");

  $("pName").value = product?.name || "";
  $("pPrice").value = product ? Number(product.price) : "";
  $("pStock").value = product ? product.stock : "";
  $("pDescription").value = product?.description || "";
  $("pActive").checked = product ? Boolean(product.is_active) : true;

  document.querySelectorAll("#productForm [aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
  updatePreview();
  $("productDialog").showModal();
  $("pName").focus();
}

async function saveProduct(event) {
  event.preventDefault();

  const inputs = ["pName", "pCategory", "pPrice", "pStock"].map($);
  const invalid = inputs.filter((input) => !input.checkValidity() || !String(input.value).trim());
  inputs.forEach((input) => input.setAttribute("aria-invalid", String(invalid.includes(input))));

  if (invalid.length) {
    $("productError").textContent = "Vui lòng kiểm tra lại các trường được đánh dấu.";
    invalid[0].focus();
    return;
  }

  const body = {
    name: $("pName").value.trim(),
    description: $("pDescription").value.trim(),
    price: Number($("pPrice").value),
    stock: Number($("pStock").value),
    category_id: Number($("pCategory").value),
    image_url: $("pImage").value || null,
    is_active: $("pActive").checked
  };

  const save = $("saveProduct");
  save.disabled = true;
  try {
    if (admin.editingId) {
      await api(`/admin/products/${admin.editingId}`, { method: "PUT", body: { ...body, expected_stock: admin.editingStock } });
      toast("Đã cập nhật sản phẩm");
    } else {
      await api("/admin/products", { method: "POST", body });
      toast("Đã thêm sản phẩm mới");
    }
    $("productDialog").close();
    loadProducts();
  } catch (error) {
    $("productError").textContent = error.message;
    if (error.status === 409 && Number.isInteger(error.data?.current_stock)) {
      // Cập nhật tồn kho mới nhất; giữ số admin tự nhập nếu họ đã sửa ô Tồn kho
      if (Number($("pStock").value) === admin.editingStock) $("pStock").value = error.data.current_stock;
      admin.editingStock = error.data.current_stock;
      loadProducts();
    } else if (error.status === 404) {
      $("productDialog").close();
      toast(error.message, "error");
      loadProducts();
    }
  } finally {
    save.disabled = false;
  }
}

// =====================================================
// Orders
// =====================================================

async function loadOrders() {
  try {
    const { data } = await api("/admin/orders");
    admin.orders = data;
    updatePendingBadge();
    renderOrders();
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
  }
}

function renderOrders() {
  const filters = [["all", "Tất cả"], ...Object.entries(ORDER_STATUS).map(([key, info]) => [key, info.label])];
  $("orderFilter").replaceChildren(
    ...filters.map(([value, label]) => {
      const count = value === "all" ? admin.orders.length : admin.orders.filter((o) => o.status === value).length;
      const chip = el("button", "chip", `${label} (${count})`);
      chip.type = "button";
      chip.setAttribute("aria-selected", String(value === admin.orderFilter));
      chip.addEventListener("click", () => {
        admin.orderFilter = value;
        renderOrders();
      });
      return chip;
    })
  );

  const list = admin.orders.filter((o) => admin.orderFilter === "all" || o.status === admin.orderFilter);

  table(
    $("orderTable"),
    ["Mã đơn", "Khách hàng", "Sản phẩm", "Tổng tiền", "Ngày đặt", "Trạng thái", ""],
    list.map((order) => {
      const customer = el("div", "cell-stack");
      customer.append(
        el("strong", "", order.customer_name),
        el("span", "muted", order.customer_email),
        el("span", "muted", [order.phone, order.shipping_address].filter(Boolean).join(" · "))
      );

      const items = el("div", "cell-stack");
      order.items.forEach((item) => items.appendChild(el("span", "", `${item.name} × ${item.quantity}`)));

      const actions = (NEXT_ACTIONS[order.status] || []).map(([status, label, style]) =>
        button(label, style, () => updateOrderStatus(order, status))
      );

      return [
        `#${order.id}`,
        customer,
        items,
        formatMoney(order.total_amount),
        formatDate(order.created_at),
        statusBadge(order.status),
        group(...actions)
      ];
    }),
    "Không có đơn hàng"
  );
}

async function updateOrderStatus(order, status) {
  if (status === "cancelled" && !confirm(`Hủy đơn hàng #${order.id}? Tồn kho sẽ được hoàn lại.`)) return;

  try {
    await api(`/admin/orders/${order.id}/status`, { method: "PATCH", body: { status } });
    toast(`Đơn #${order.id}: ${ORDER_STATUS[status].label}`);
    loadOrders();
  } catch (error) {
    toast(error.message, "error");
  }
}

// =====================================================
// Users
// =====================================================

async function loadUsers() {
  try {
    const { data } = await api("/admin/users");
    table(
      $("userTable"),
      ["ID", "Họ tên", "Email", "Vai trò", "Số đơn", "Tổng chi tiêu", "Ngày tạo"],
      data.map((user) => [
        `#${user.id}`,
        user.name,
        user.email,
        el("span", `role-badge role-${user.role}`, user.role === "admin" ? "Quản trị viên" : "Khách hàng"),
        String(user.order_count),
        formatMoney(user.total_spent),
        formatDate(user.created_at)
      ]),
      "Chưa có tài khoản"
    );
  } catch (error) {
    if (!handleAuthError(error)) toast(error.message, "error");
  }
}

// =====================================================
// System links (tất cả qua HTTPS)
// =====================================================

function renderSystem() {
  const host = location.hostname;
  const services = [
    ["Grafana", "Dashboard giám sát container, web server, database và log", 3005, "Tài khoản Grafana"],
    ["Prometheus", "Thu thập và truy vấn metrics", 9095, "Chỉ mở trên máy local"],
    ["phpMyAdmin", "Quản trị cơ sở dữ liệu MySQL", 8081, "Tài khoản MySQL"],
    ["cAdvisor", "Theo dõi CPU, RAM, network của container", 8080, "Chỉ mở trên máy local"],
    // Loki không mở cổng riêng: log tập trung được tra cứu trong Grafana Explore
    ["Loki", "Log tập trung của mọi container, tra cứu bằng LogQL", 3005, "Tài khoản Grafana", "/explore"]
  ];

  $("systemGrid").replaceChildren(
    ...services.map(([name, description, port, auth, page = "/"]) => {
      const url = `https://${host}:${port}${page}`;
      const card = el("a", "system-card");
      card.href = url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      const head = el("div", "system-card-head");
      head.append(el("strong", "", name), el("span", "lock", "HTTPS"));
      card.append(head, el("p", "muted", description), el("code", "", url), el("span", "system-auth", auth));
      return card;
    })
  );
}

// =====================================================
// Events & init
// =====================================================

document.querySelectorAll(".side-link[data-view]").forEach((link) => {
  link.addEventListener("click", () => showView(link.dataset.view));
});
document.querySelectorAll("[data-goto]").forEach((link) => {
  link.addEventListener("click", () => showView(link.dataset.goto));
});

$("addProduct").addEventListener("click", () => openProductDialog());
$("productForm").addEventListener("submit", saveProduct);
$("closeProductDialog").addEventListener("click", () => $("productDialog").close());
$("cancelProduct").addEventListener("click", () => $("productDialog").close());
["pImage", "pCategory", "pName"].forEach((id) => $(id).addEventListener("input", updatePreview));
$("productSearch").addEventListener("input", (event) => {
  admin.productSearch = event.target.value;
  renderProducts();
});

(async () => {
  const user = await Auth.load();
  if (!user || user.role !== "admin") {
    window.location.href = "/login.html?next=/admin.html";
    return;
  }
  renderAccount($("accountArea"), user);

  const view = location.hash.slice(1);
  showView(VIEW_TITLES[view] ? view : "dashboard");
})();
