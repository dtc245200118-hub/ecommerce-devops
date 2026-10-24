const CART_KEY = "techzone_cart";
const LOW_STOCK = 5;

const state = {
  user: null,
  products: [],
  category: "all",
  search: "",
  sort: "newest",
  cart: new Map() // product_id -> quantity
};

const els = {
  productList: $("productList"),
  message: $("message"),
  categoryFilter: $("categoryFilter"),
  emptyState: $("emptyState"),
  searchForm: $("searchForm"),
  searchInput: $("searchInput"),
  sortSelect: $("sortSelect"),
  cartButton: $("cartButton"),
  cartCount: $("cartCount"),
  drawer: $("cartDrawer"),
  overlay: $("drawerOverlay"),
  cartView: $("cartView"),
  cartItems: $("cartItems"),
  cartEmpty: $("cartEmpty"),
  drawerFoot: $("drawerFoot"),
  cartSubtotal: $("cartSubtotal"),
  cartTotal: $("cartTotal"),
  checkoutButton: $("checkoutButton"),
  checkoutForm: $("checkoutForm"),
  checkoutMessage: $("checkoutMessage"),
  successView: $("successView"),
  orderId: $("orderId"),
  adminNotice: $("adminNotice")
};

const isAdmin = () => state.user?.role === "admin";

// =====================================================
// Products
// =====================================================

function renderSkeleton(count = 8) {
  els.productList.replaceChildren();
  for (let i = 0; i < count; i += 1) {
    const card = el("div", "product-card skeleton");
    const body = el("div", "product-body");
    body.append(el("div", "sk-line w-40"), el("div", "sk-line w-80"), el("div", "sk-line w-60"));
    card.append(el("div", "product-media"), body);
    els.productList.appendChild(card);
  }
}

async function loadProducts({ silent = false } = {}) {
  if (!silent) {
    renderSkeleton();
    els.message.textContent = "Đang tải sản phẩm...";
  }

  try {
    const result = await api("/products");
    state.products = result.data;
    syncCartWithStock();
    renderCategories();
    renderProducts();
  } catch (error) {
    console.error(error);
    els.productList.replaceChildren();
    els.message.textContent = "Không thể kết nối API sản phẩm. Vui lòng thử lại sau.";
  }
}

function renderCategories() {
  const names = [...new Map(
    [...state.products]
      .filter((p) => p.category_name)
      .sort((a, b) => a.category_id - b.category_id)
      .map((p) => [p.category_name, p.category_name])
  ).keys()];
  const categories = [["all", "Tất cả"], ...names.map((name) => [name, name])];

  if (!categories.some(([value]) => value === state.category)) {
    state.category = "all";
  }

  els.categoryFilter.replaceChildren(
    ...categories.map(([value, label]) => {
      const chip = el("button", "chip", label);
      chip.type = "button";
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", String(value === state.category));
      chip.addEventListener("click", () => {
        state.category = value;
        renderCategories();
        renderProducts();
      });
      return chip;
    })
  );
}

function visibleProducts() {
  const keyword = normalize(state.search.trim());

  const list = state.products.filter((p) => {
    if (state.category !== "all" && p.category_name !== state.category) return false;
    if (!keyword) return true;
    return normalize(`${p.name} ${p.description} ${p.category_name}`).includes(keyword);
  });

  const sorters = {
    newest: (a, b) => b.id - a.id,
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    name: (a, b) => a.name.localeCompare(b.name, "vi")
  };

  return list.sort(sorters[state.sort]);
}

function productCard(product, index) {
  const card = el("article", "product-card");

  const media = el("div", `product-media tone-${(product.category_id || index) % 6 + 1}`);
  const img = el("img");
  img.src = productImage(product);
  img.alt = product.name;
  img.loading = "lazy";
  img.addEventListener("error", () => { img.src = "/images/products/box.svg"; }, { once: true });
  media.appendChild(img);

  if (product.stock <= 0) {
    media.appendChild(el("span", "tag tag-out", "Hết hàng"));
  } else if (product.stock <= LOW_STOCK) {
    media.appendChild(el("span", "tag tag-low", `Chỉ còn ${product.stock}`));
  } else if (Number(product.price) >= 20000000) {
    media.appendChild(el("span", "tag tag-hot", "Bán chạy"));
  }

  const body = el("div", "product-body");
  body.append(
    el("span", "product-category", product.category_name || "Sản phẩm"),
    el("h3", "product-name", product.name),
    el("p", "product-desc", product.description || "")
  );

  const foot = el("div", "product-foot");
  const info = el("div");
  info.append(
    el("div", "price", formatMoney(product.price)),
    el("div", "stock", product.stock > 0 ? `Còn ${product.stock} sản phẩm` : "Tạm hết hàng")
  );
  foot.appendChild(info);

  // Admin không mua hàng -> không hiển thị nút thêm vào giỏ
  if (!isAdmin()) {
    const button = el("button", "btn btn-primary add-btn");
    button.type = "button";
    button.setAttribute("aria-label", `Thêm ${product.name} vào giỏ hàng`);
    button.title = "Thêm vào giỏ hàng";
    button.disabled = product.stock <= 0;
    button.appendChild(icon(ICONS.plus));
    button.addEventListener("click", () => addToCart(product.id));
    foot.appendChild(button);
  }

  body.appendChild(foot);
  card.append(media, body);
  return card;
}

function renderProducts() {
  const list = visibleProducts();
  els.productList.replaceChildren(...list.map(productCard));
  els.emptyState.hidden = list.length > 0;
  els.message.textContent = `Hiển thị ${list.length} / ${state.products.length} sản phẩm`;
}

// =====================================================
// Cart
// =====================================================

const findProduct = (id) => state.products.find((p) => p.id === id);

function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify([...state.cart]));
  } catch {
    // localStorage có thể bị chặn (chế độ ẩn danh) - bỏ qua
  }
}

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    saved.forEach(([id, qty]) => {
      if (Number.isSafeInteger(id) && Number.isSafeInteger(qty) && qty > 0) {
        state.cart.set(id, qty);
      }
    });
  } catch {
    state.cart.clear();
  }
}

// Loại bỏ sản phẩm không còn bán và giới hạn theo tồn kho mới nhất
function syncCartWithStock() {
  state.cart.forEach((qty, id) => {
    const product = findProduct(id);
    if (!product || product.stock <= 0) {
      state.cart.delete(id);
    } else if (qty > product.stock) {
      state.cart.set(id, product.stock);
    }
  });
  updateCart();
}

function addToCart(id) {
  const product = findProduct(id);
  const quantity = state.cart.get(id) || 0;

  if (!product || quantity >= product.stock) {
    toast("Không đủ hàng trong kho", "error");
    return;
  }

  state.cart.set(id, quantity + 1);
  updateCart();
  toast(`Đã thêm "${product.name}" vào giỏ hàng`);

  els.cartCount.classList.remove("bump");
  void els.cartCount.offsetWidth; // khởi động lại animation
  els.cartCount.classList.add("bump");
}

function setQuantity(id, quantity) {
  const product = findProduct(id);
  if (!product) return;

  if (quantity <= 0) {
    state.cart.delete(id);
  } else {
    state.cart.set(id, Math.min(quantity, product.stock));
  }
  updateCart();
}

function cartItem(product, quantity) {
  const row = el("div", "cart-item");

  const thumb = el("div", "cart-thumb");
  const img = el("img");
  img.src = productImage(product);
  img.alt = "";
  thumb.appendChild(img);

  const info = el("div", "cart-info");
  const qty = el("div", "qty");

  const minus = el("button", "", "−");
  minus.type = "button";
  minus.setAttribute("aria-label", "Giảm số lượng");
  minus.addEventListener("click", () => setQuantity(product.id, quantity - 1));

  const plus = el("button", "", "+");
  plus.type = "button";
  plus.setAttribute("aria-label", "Tăng số lượng");
  plus.disabled = quantity >= product.stock;
  plus.addEventListener("click", () => setQuantity(product.id, quantity + 1));

  qty.append(minus, el("span", "", String(quantity)), plus);
  info.append(el("h4", "", product.name), el("div", "unit", formatMoney(product.price)), qty);

  const side = el("div", "cart-side");
  const remove = el("button", "remove-btn", "Xóa");
  remove.type = "button";
  remove.addEventListener("click", () => setQuantity(product.id, 0));
  side.append(el("strong", "", formatMoney(product.price * quantity)), remove);

  row.append(thumb, info, side);
  return row;
}

function updateCart() {
  let count = 0;
  let total = 0;
  const rows = [];

  state.cart.forEach((quantity, id) => {
    const product = findProduct(id);
    if (!product) return;
    count += quantity;
    total += Number(product.price) * quantity;
    rows.push(cartItem(product, quantity));
  });

  els.cartItems.replaceChildren(...rows);
  els.cartCount.textContent = count;
  els.cartSubtotal.textContent = formatMoney(total);
  els.cartTotal.textContent = formatMoney(total);

  const empty = count === 0;
  els.cartEmpty.hidden = !empty;
  if (els.successView.hidden) {
    els.drawerFoot.hidden = empty;
    if (empty) showStep("cart");
  }

  saveCart();
}

// =====================================================
// Drawer & checkout steps
// =====================================================

let lastFocus = null;

function openCart() {
  lastFocus = document.activeElement;
  els.overlay.hidden = false;
  els.drawer.inert = false;
  els.drawer.setAttribute("aria-hidden", "false");
  els.drawer.classList.add("open");
  document.body.classList.add("no-scroll");
  $("closeCart").focus();
}

function closeCart() {
  els.drawer.classList.remove("open");
  els.drawer.inert = true;
  els.drawer.setAttribute("aria-hidden", "true");
  els.overlay.hidden = true;
  document.body.classList.remove("no-scroll");
  if (!els.successView.hidden) showStep("cart");
  if (lastFocus) lastFocus.focus();
}

function showStep(step) {
  els.cartView.hidden = step !== "cart";
  els.checkoutForm.hidden = step !== "checkout";
  els.successView.hidden = step !== "success";
  els.drawerFoot.hidden = step === "success" || state.cart.size === 0;
  els.checkoutButton.textContent =
    step === "checkout" ? "Xác nhận đặt hàng" : "Tiến hành đặt hàng";
  els.checkoutMessage.textContent = "";
}

function goToCheckout() {
  // Chưa đăng nhập -> chuyển sang trang đăng nhập, giỏ hàng vẫn được giữ lại
  if (!state.user) {
    toast("Vui lòng đăng nhập để đặt hàng", "error");
    setTimeout(() => {
      window.location.href = "/login.html?next=/%23checkout";
    }, 700);
    return;
  }

  showStep("checkout");
  const name = $("customerName");
  if (!name.value) name.value = state.user.name;
  $("customerEmail").value = state.user.email;
  $("customerPhone").focus();
}

function validateField(input) {
  const valid = input.checkValidity() && input.value.trim() !== "";
  input.setAttribute("aria-invalid", String(!valid));
  return valid;
}

async function submitOrder() {
  const fields = ["customerName", "customerPhone", "customerAddress"].map($);
  const invalid = fields.filter((input) => !validateField(input));

  if (invalid.length) {
    els.checkoutMessage.textContent = "Vui lòng nhập đầy đủ họ tên, số điện thoại và địa chỉ giao hàng.";
    invalid[0].focus();
    return;
  }

  if (state.cart.size === 0) {
    els.checkoutMessage.textContent = "Giỏ hàng đang trống";
    return;
  }

  const [name, phone, address] = fields.map((input) => input.value.trim());

  els.checkoutButton.disabled = true;
  els.checkoutButton.textContent = "Đang xử lý...";
  els.checkoutMessage.textContent = "";

  try {
    const result = await api("/orders", {
      method: "POST",
      body: {
        customer_name: name,
        phone,
        shipping_address: address,
        items: [...state.cart].map(([product_id, quantity]) => ({ product_id, quantity }))
      }
    });

    els.orderId.textContent = `#${result.order_id}`;
    state.cart.clear();
    els.checkoutForm.reset();
    showStep("success");
    updateCart();
    loadProducts({ silent: true });
  } catch (error) {
    if (error.status === 401) {
      window.location.href = "/login.html?next=/%23checkout";
      return;
    }
    els.checkoutButton.textContent = "Xác nhận đặt hàng";
    els.checkoutMessage.textContent = error.message;
  } finally {
    els.checkoutButton.disabled = false;
  }
}

// =====================================================
// Events
// =====================================================

els.cartButton.addEventListener("click", openCart);
$("closeCart").addEventListener("click", closeCart);
els.overlay.addEventListener("click", closeCart);
$("continueShopping").addEventListener("click", closeCart);
$("doneButton").addEventListener("click", closeCart);
$("backToCart").addEventListener("click", () => showStep("cart"));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && els.drawer.classList.contains("open")) closeCart();
});

els.checkoutButton.addEventListener("click", () => {
  if (els.checkoutForm.hidden) {
    goToCheckout();
  } else {
    submitOrder();
  }
});

els.checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitOrder();
});

["customerName", "customerPhone", "customerAddress"].forEach((id) => {
  $(id).addEventListener("input", (event) => event.target.removeAttribute("aria-invalid"));
});

let searchTimer;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = els.searchInput.value;
    renderProducts();
  }, 200);
});

els.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.search = els.searchInput.value;
  renderProducts();
  $("products").scrollIntoView();
});

els.sortSelect.addEventListener("change", () => {
  state.sort = els.sortSelect.value;
  renderProducts();
});

$("resetFilter").addEventListener("click", () => {
  state.search = "";
  state.category = "all";
  els.searchInput.value = "";
  renderCategories();
  renderProducts();
});

$("newsletterForm").addEventListener("submit", (event) => {
  event.preventDefault();
  event.target.reset();
  toast("Cảm ơn bạn đã đăng ký nhận tin!");
});

// =====================================================
// Init
// =====================================================

async function init() {
  state.user = await Auth.load();
  renderAccount($("accountArea"), state.user);

  if (isAdmin()) {
    els.cartButton.hidden = true;
    els.adminNotice.hidden = false;
  } else {
    loadCart();
  }

  await loadProducts();

  // Quay lại sau khi đăng nhập để thanh toán
  if (location.hash === "#checkout" && state.user && !isAdmin() && state.cart.size > 0) {
    history.replaceState(null, "", "/");
    openCart();
    goToCheckout();
  }
}

init();
