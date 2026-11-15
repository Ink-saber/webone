/* ============================================================
   branding.js —— 品牌文字、登录状态、统一请求

   每个页面都在 config.js 之后、业务脚本之前引入它。
   它做三件事：
     1. 把页面上的文字换成 config.js 里配的名字
     2. 检查有没有登录，没有就跳登录页
     3. 提供 apiFetch()，自动带上登录凭证
   ============================================================ */

const TOKEN_KEY = "todo_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/* ---------- 1. 品牌文字 ---------- */

function applyBranding() {
  const page = document.body.dataset.page || "list";

  const setAll = function (selector, text) {
    document.querySelectorAll(selector).forEach(function (el) {
      el.textContent = text;
    });
  };

  setAll("[data-site-name]", CONFIG.SITE_NAME);
  setAll("[data-tagline]", CONFIG.TAGLINE);
  setAll("[data-ai-name]", CONFIG.AI_NAME);
  setAll("[data-ai-tagline]", CONFIG.AI_TAGLINE);

  const titles = {
    list: CONFIG.SITE_NAME,
    detail: "详情 · " + CONFIG.SITE_NAME,
    new: "新建 · " + CONFIG.SITE_NAME,
    chat: CONFIG.AI_NAME + " · " + CONFIG.SITE_NAME,
    login: "登录 · " + CONFIG.SITE_NAME
  };
  document.title = titles[page] || CONFIG.SITE_NAME;
}

/* ---------- 2. 登录状态 ---------- */

async function initAuth() {
  const page = document.body.dataset.page;

  if (page === "login") return;

  if (!getToken()) {
    location.replace("login.html");
    return;
  }

  try {
    const res = await fetch(CONFIG.API_BASE + "/auth/me", {
      headers: { Authorization: "Bearer " + getToken() }
    });

    if (!res.ok) throw new Error("无效登录");

    const json = await res.json();
    const nameEl = document.getElementById("user-name");
    if (nameEl) nameEl.textContent = json.data.username;
  } catch (e) {
    clearToken();
    location.replace("login.html");
  }
}

/* ---------- 3. 统一请求 ---------- */

async function apiFetch(path, options) {
  const opts = Object.assign({}, options || {});
  opts.headers = Object.assign({}, (options && options.headers) || {}, {
    Authorization: "Bearer " + getToken()
  });

  const res = await fetch(CONFIG.API_BASE + path, opts);

  if (res.status === 401) {
    clearToken();
    location.replace("login.html");
    throw new Error("登录已失效，请重新登录");
  }

  return res;
}

/* ---------- 退出登录 ---------- */

function bindLogout() {
  const btn = document.getElementById("logout-btn");
  if (!btn) return;

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    try {
      await fetch(CONFIG.API_BASE + "/auth/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + getToken() }
      });
    } catch (e) {
      // 退出失败也把本地凭证清掉
    }
    clearToken();
    location.replace("login.html");
  });
}

/* ---------- 页面一加载就执行 ---------- */

applyBranding();
bindLogout();
initAuth();
