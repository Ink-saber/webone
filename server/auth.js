/* ============================================================
   auth.js —— 注册、登录、退出、鉴权中间件

   密码不存明文：用 Node 自带的 scrypt 加盐哈希。
   scrypt 是专门为「抵抗暴力破解」设计的，比 md5/sha1 安全得多。

   登录成功后发一个随机 token，客户端存在浏览器里，
   之后每个请求都在请求头带上 Authorization: Bearer <token>。
   ============================================================ */

const crypto = require("node:crypto");
const store = require("./store");

const USERNAME_MIN = 2;
const USERNAME_MAX = 20;
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 64;

function hashPassword(password, salt) {
  // 64 字节的哈希；salt 是每个用户独立的随机串
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function checkPassword(password, user) {
  const hash = hashPassword(password, user.salt);
  // 用定时安全比较，避免通过响应时间猜密码
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function validateCredentials(username, password) {
  if (typeof username !== "string" || typeof password !== "string") {
    return "用户名和密码都必须是字符串";
  }

  const name = username.trim();

  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) {
    return "用户名要 " + USERNAME_MIN + "~" + USERNAME_MAX + " 个字符";
  }
  if (/\s/.test(name)) {
    return "用户名不能包含空格";
  }
  if (password.length < PASSWORD_MIN) {
    return "密码至少 " + PASSWORD_MIN + " 位";
  }
  if (password.length > PASSWORD_MAX) {
    return "密码最多 " + PASSWORD_MAX + " 位";
  }
  return null;
}

function publicUser(user) {
  return { id: user.id, username: user.username, createdAt: user.createdAt };
}

function register(app, fail) {
  /* ---------- 注册 ---------- */
  app.post("/api/auth/register", function (req, res) {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const problem = validateCredentials(username, password);
    if (problem) return fail(res, 400, 4001, problem);

    if (store.findUserByName(username)) {
      return fail(res, 409, 4009, "这个用户名已经被占用了");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const user = store.createUser(username, salt, hashPassword(password, salt));
    const token = store.createSession(user.id);

    res.status(201).json({
      code: 0,
      data: { token: token, user: publicUser(user) },
      msg: "注册成功"
    });
  });

  /* ---------- 登录 ---------- */
  app.post("/api/auth/login", function (req, res) {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return fail(res, 400, 4001, "请填写用户名和密码");
    }

    const user = store.findUserByName(username);

    // 用户不存在和密码错误给同一句提示，避免暴露「这个用户名存在」
    if (!user || !checkPassword(password, user)) {
      return fail(res, 401, 4003, "用户名或密码不对");
    }

    const token = store.createSession(user.id);

    res.json({
      code: 0,
      data: { token: token, user: publicUser(user) },
      msg: "登录成功"
    });
  });

  /* ---------- 退出 ---------- */
  app.post("/api/auth/logout", function (req, res) {
    const token = readToken(req);
    if (token) store.deleteSession(token);
    res.json({ code: 0, data: null, msg: "已退出登录" });
  });

  /* ---------- 当前用户 ---------- */
  app.get("/api/auth/me", requireAuth, function (req, res) {
    const user = store.getUserById(req.userId);
    if (!user) return fail(res, 401, 4003, "登录已失效，请重新登录");
    res.json({ code: 0, data: publicUser(user), msg: "ok" });
  });
}

/* ---------- 从请求头里取 token ---------- */
function readToken(req) {
  const header = req.headers.authorization || "";
  if (typeof header !== "string") return "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

/* ---------- 鉴权中间件 ---------- */
function requireAuth(req, res, next) {
  const token = readToken(req);
  const session = store.getSession(token);

  if (!session) {
    res.status(401).json({ code: 4003, data: null, msg: "请先登录" });
    return;
  }

  req.userId = session.userId;
  req.token = token;
  next();
}

module.exports = { register, requireAuth, readToken };
