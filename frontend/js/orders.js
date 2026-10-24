const ordersState = { orders: [], filter: "all" };

const FILTERS = [
  ["all", "Tất cả"],
  ["pending", "Chờ xác nhận"],
  ["confirmed", "Đang giao"],
  ["completed", "Hoàn thành"],
  ["cancelled", "Đã hủy"]
];

function renderFilters() {
  $("statusFilter").replaceChildren(
    ...FILTERS.map(([value, label]) => {
      const count = value === "all"
        ? ordersState.orders.length
        : ordersState.orders.filter((order) => order.status === value).length;
      const chip = el("button", "chip", `${label} (${count})`);
      chip.type = "button";
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", String(value === ordersState.filter));
      chip.addEventListener("click", () => {
        ordersState.filter = value;
        render();
      });
      return chip;
    })
  );
}

async function cancelOrder(order, button) {
  if (!confirm(`Bạn chắc chắn muốn hủy đơn hàng #${order.id}?`)) return;

  button.disabled = true;
  try {
    await api(`/orders/${order.id}/cancel`, { method: "POST" });
    toast(`Đã hủy đơn hàng #${order.id}`);
    await loadOrders();
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
}

function orderCard(order) {
  const card = el("article", "order-card");

  const head = el("div", "order-head");
  const title = el("div");
  title.append(el("strong", "", `Đơn hàng #${order.id}`), el("span", "muted", ` · ${formatDate(order.created_at)}`));
  head.append(title, statusBadge(order.status));

  const items = el("div", "order-items");
  order.items.forEach((item) => {
    const row = el("div", "order-item");
    const thumb = el("div", "cart-thumb");
    const img = el("img");
    img.src = productImage(item);
    img.alt = "";
    thumb.appendChild(img);

    const info = el("div", "order-item-info");
    info.append(el("strong", "", item.name), el("span", "muted", `${formatMoney(item.unit_price)} × ${item.quantity}`));
    row.append(thumb, info, el("strong", "", formatMoney(item.unit_price * item.quantity)));
    items.appendChild(row);
  });

  // Lịch sử trạng thái (ghi tự động bởi TRIGGER trong MySQL)
  const timeline = el("ol", "timeline");
  (order.history || []).forEach((entry) => {
    const step = el("li", `timeline-step ${ORDER_STATUS[entry.new_status]?.className || ""}`);
    step.append(
      el("strong", "", ORDER_STATUS[entry.new_status]?.label || entry.new_status),
      el("span", "muted", formatDate(entry.changed_at))
    );
    timeline.appendChild(step);
  });

  const foot = el("div", "order-foot");
  const shipping = el("div", "order-shipping muted");
  shipping.textContent = [order.customer_name, order.phone, order.shipping_address].filter(Boolean).join(" · ");

  const right = el("div", "order-total");
  right.append(el("span", "muted", "Thành tiền: "), el("strong", "", formatMoney(order.total_amount)));

  if (order.status === "pending") {
    const cancel = el("button", "btn btn-ghost btn-danger-ghost", "Hủy đơn");
    cancel.type = "button";
    cancel.addEventListener("click", () => cancelOrder(order, cancel));
    right.appendChild(cancel);
  }

  foot.append(shipping, right);
  card.append(head, items);
  if (timeline.children.length) card.appendChild(timeline);
  card.appendChild(foot);
  return card;
}

function render() {
  renderFilters();
  const list = ordersState.orders.filter(
    (order) => ordersState.filter === "all" || order.status === ordersState.filter
  );
  $("orderList").replaceChildren(...list.map(orderCard));
  $("ordersEmpty").hidden = list.length > 0;

  const spent = ordersState.orders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total_amount), 0);
  $("ordersSummary").textContent =
    `${ordersState.orders.length} đơn hàng · Tổng chi tiêu ${formatMoney(spent)}`;
}

async function loadOrders() {
  try {
    const result = await api("/orders/my");
    ordersState.orders = result.data;
    render();
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "/login.html?next=/orders.html";
      return;
    }
    $("ordersSummary").textContent = error.message;
  }
}

(async () => {
  const user = await Auth.load();
  renderAccount($("accountArea"), user);
  loadOrders();
})();
