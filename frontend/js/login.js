const RULES = {
  length: (value) => value.length >= 8,
  upper: (value) => /[A-Z]/.test(value),
  lower: (value) => /[a-z]/.test(value),
  digit: (value) => /\d/.test(value)
};

// Chỉ cho phép chuyển hướng nội bộ (chống open redirect)
function nextUrl(user) {
  const fallback = user.role === "admin" ? "/admin.html" : "/";
  const next = new URLSearchParams(location.search).get("next") || "";
  if (!next.startsWith("/")) return fallback;

  // Trình duyệt hiểu "/\evil.com" hay "/<tab>/evil.com" là trang ngoài -> so origin sau khi phân tích URL
  let url;
  try {
    url = new URL(next, location.origin);
  } catch {
    return fallback;
  }
  // "/.//evil.com" chuẩn hóa thành "//evil.com" (URL không giao thức) -> gộp các "/" ở đầu
  const pathname = url.pathname.replace(/^\/{2,}/, "/");
  if (url.origin !== location.origin || pathname.startsWith("/login")) return fallback;
  if (user.role === "admin" && !pathname.startsWith("/admin")) return "/admin.html";
  return pathname + url.search + url.hash;
}

function showTab(name) {
  const login = name === "login";
  $("tabLogin").setAttribute("aria-selected", String(login));
  $("tabRegister").setAttribute("aria-selected", String(!login));
  $("loginForm").hidden = !login;
  $("registerForm").hidden = login;
  (login ? $("loginEmail") : $("registerName")).focus();
}

function setBusy(form, busy) {
  const button = form.querySelector("button[type=submit]");
  button.disabled = busy;
  button.dataset.label = button.dataset.label || button.textContent;
  button.textContent = busy ? "Đang xử lý..." : button.dataset.label;
}

function markInvalid(inputs) {
  inputs.forEach((input) => input.setAttribute("aria-invalid", "true"));
  if (inputs[0]) inputs[0].focus();
}

$("tabLogin").addEventListener("click", () => showTab("login"));
$("tabRegister").addEventListener("click", () => showTab("register"));

document.querySelectorAll(".toggle-password").forEach((button) => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.target);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Ẩn" : "Hiện";
  });
});

document.querySelectorAll(".auth-form input").forEach((input) => {
  input.addEventListener("input", () => input.removeAttribute("aria-invalid"));
});

// Hiển thị độ mạnh mật khẩu
$("registerPassword").addEventListener("input", (event) => {
  const value = event.target.value;
  let passed = 0;
  document.querySelectorAll("#passwordRules li").forEach((item) => {
    const ok = RULES[item.dataset.rule](value);
    item.classList.toggle("ok", ok);
    if (ok) passed += 1;
  });
  $("strengthBar").className = `level-${passed}`;
});

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const email = $("loginEmail");
  const password = $("loginPassword");
  $("loginError").textContent = "";

  const invalid = [email, password].filter((input) => !input.checkValidity() || !input.value.trim());
  if (invalid.length) {
    $("loginError").textContent = "Vui lòng nhập email và mật khẩu hợp lệ.";
    markInvalid(invalid);
    return;
  }

  setBusy(form, true);
  try {
    const result = await api("/auth/login", {
      method: "POST",
      body: { email: email.value.trim(), password: password.value }
    });
    window.location.href = nextUrl(result.user);
  } catch (error) {
    $("loginError").textContent = error.message;
    password.value = "";
    password.focus();
  } finally {
    setBusy(form, false);
  }
});

$("registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const name = $("registerName");
  const email = $("registerEmail");
  const password = $("registerPassword");
  const confirm = $("registerConfirm");
  const error = $("registerError");
  error.textContent = "";

  const invalid = [name, email].filter((input) => !input.checkValidity() || !input.value.trim());
  if (invalid.length) {
    error.textContent = "Vui lòng nhập họ tên và email hợp lệ.";
    markInvalid(invalid);
    return;
  }

  if (!Object.values(RULES).every((rule) => rule(password.value))) {
    error.textContent = "Mật khẩu chưa đủ mạnh.";
    markInvalid([password]);
    return;
  }

  if (password.value !== confirm.value) {
    error.textContent = "Mật khẩu nhập lại không khớp.";
    markInvalid([confirm]);
    return;
  }

  setBusy(form, true);
  try {
    const result = await api("/auth/register", {
      method: "POST",
      body: { name: name.value.trim(), email: email.value.trim(), password: password.value }
    });
    window.location.href = nextUrl(result.user);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    setBusy(form, false);
  }
});

if (location.hash === "#register") showTab("register");
