/* ============================================================
   login.js —— 登录 / 注册页

   只有一个表单，靠 mode 切换调哪个接口。
   成功后把 token 存进 localStorage，跳到清单页。
   ============================================================ */

const form = document.getElementById("login-form");
const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const errorEl = document.getElementById("login-error");
const submitBtn = document.getElementById("submit-btn");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");

let mode = "login";

function setMode(next) {
  mode = next;

  const isLogin = mode === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);

  submitBtn.textContent = isLogin ? "登录" : "注册并进入";

  passwordEl.autocomplete = isLogin ? "current-password" : "new-password";
  passwordEl.placeholder = isLogin ? "" : "至少 6 位";

  hideError();
}

function showError(text) {
  errorEl.textContent = text;
  errorEl.hidden = false;
}

function hideError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

tabLogin.addEventListener("click", function () { setMode("login"); });
tabRegister.addEventListener("click", function () { setMode("register"); });

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  hideError();

  const username = usernameEl.value.trim();
  const password = passwordEl.value;

  if (!username || !password) {
    showError("用户名和密码都要填");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = mode === "login" ? "登录中…" : "注册中…";

  try {
    const res = await fetch(
      CONFIG.API_BASE + (mode === "login" ? "/auth/login" : "/auth/register"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password })
      }
    );

    const json = await res.json().catch(function () { return {}; });

    if (!res.ok || json.code !== 0) {
      throw new Error(json.msg || ("服务器返回 " + res.status));
    }

    setToken(json.data.token);
    location.replace("index.html");
  } catch (err) {
    // 网络错误时 fetch 抛的是 TypeError，给它一句人话
    const msg = err.message === "Failed to fetch"
      ? "连不上服务器，检查一下网络或稍后再试"
      : err.message;
    showError(msg);
    submitBtn.disabled = false;
    submitBtn.textContent = mode === "login" ? "登录" : "注册并进入";
  }
});

/* 已经登录过的话，直接进清单页 */
(async function skipIfLoggedIn() {
  if (!getToken()) return;

  try {
    const res = await fetch(CONFIG.API_BASE + "/auth/me", {
      headers: { Authorization: "Bearer " + getToken() }
    });
    if (res.ok) {
      location.replace("index.html");
      return;
    }
  } catch (e) {
    // 忽略，正常显示登录框
  }
  clearToken();
})();

setMode("login");
