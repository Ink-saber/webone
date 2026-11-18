/* ============================================================
   store.js —— 数据层（多用户版）

   数据结构（都在这一个 JSON 文件里）：
   {
     nextItemId, nextUserId,
     users:    [{ id, username, salt, hash, createdAt }],
     items:    [{ id, userId, title, note, done, createdAt }],
     sessions: { token: { userId, createdAt } }
   }

   三条保险：
     1. 优先写文件；写不进去降级成内存，服务照常跑
     2. 文件坏了不让服务崩
     3. 旧版本没有 userId 的待办会被丢弃（新版本按用户隔离数据）
   ============================================================ */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const filePath = process.env.DB_PATH || path.join(__dirname, "data.json");

// 登录凭证有效期 7 天
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

let db = { nextItemId: 1, nextUserId: 1, items: [], users: [], sessions: {} };
let persistent = false;

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function save() {
  if (!persistent) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.warn("[store] 写入失败，转为内存模式：" + e.message);
    persistent = false;
  }
}

function init() {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (data && typeof data === "object") db = data;
    }
    persistent = true;
    console.log("[store] 数据文件：" + filePath);
  } catch (e) {
    console.warn("[store] 无法访问数据文件，使用内存模式：" + e.message);
    persistent = false;
  }

  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.items)) db.items = [];
  if (!db.sessions || typeof db.sessions !== "object") db.sessions = {};
  if (!Number.isInteger(db.nextUserId) || db.nextUserId < 1) db.nextUserId = db.users.length + 1;
  if (!Number.isInteger(db.nextItemId) || db.nextItemId < 1) db.nextItemId = db.items.length + 1;

  // 旧版本的数据没有归属用户，直接丢弃（新版本按用户隔离）
  const before = db.items.length;
  db.items = db.items.filter(function (it) {
    return it && Number.isInteger(it.userId);
  });
  if (before !== db.items.length) {
    console.log("[store] 已清理 " + (before - db.items.length) + " 条无归属的旧待办");
  }

  // 老数据补新字段：默认都是长期任务、无截止日期
  let migrated = 0;
  db.items.forEach(function (it) {
    if (it.kind !== "long" && it.kind !== "short") {
      it.kind = "long";
      migrated++;
    }
    if (typeof it.due !== "string") it.due = "";
  });
  if (migrated) {
    console.log("[store] 已为 " + migrated + " 条旧待办补上任务类型（默认长期）");
  }

  // 软删除超过 30 天的，真正删掉
  const beforePurge = db.items.length;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  db.items = db.items.filter(function (it) {
    if (!it.deletedAt) return true;
    const t = Date.parse(String(it.deletedAt).replace(" ", "T"));
    return !isNaN(t) && t > cutoff;
  });
  if (beforePurge !== db.items.length) {
    console.log("[store] 已彻底清除 " + (beforePurge - db.items.length) + " 条删除超过 30 天的待办");
  }

  save();
  console.log("[store] 用户 " + db.users.length + " 个，待办 " + db.items.length + " 条");
}

init();

/* ============================================================
   用户
   ============================================================ */

function createUser(username, salt, hash) {
  const user = {
    id: db.nextUserId++,
    username: username,
    salt: salt,
    hash: hash,
    createdAt: now()
  };
  db.users.push(user);
  save();
  return user;
}

function findUserByName(username) {
  const lower = String(username).toLowerCase();
  return db.users.find(function (u) { return u.username.toLowerCase() === lower; }) || null;
}

function getUserById(id) {
  return db.users.find(function (u) { return u.id === id; }) || null;
}

/* ============================================================
   会话（登录凭证）
   token 是随机串，客户端存在浏览器里，每次请求带上
   ============================================================ */

function createSession(userId) {
  const token = crypto.randomBytes(24).toString("hex");
  db.sessions[token] = { userId: userId, createdAt: Date.now() };
  save();
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = db.sessions[token];
  if (!s) return null;

  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    delete db.sessions[token];
    save();
    return null;
  }
  return s;
}

function deleteSession(token) {
  if (token && db.sessions[token]) {
    delete db.sessions[token];
    save();
  }
}

// 清理过期会话，避免 sessions 无限增长
function cleanExpiredSessions() {
  const deadline = Date.now() - SESSION_TTL_MS;
  let removed = 0;
  for (const token of Object.keys(db.sessions)) {
    if (db.sessions[token].createdAt < deadline) {
      delete db.sessions[token];
      removed++;
    }
  }
  if (removed) save();
}

/* ============================================================
   待办（全部按用户隔离）
   ============================================================ */

function list(userId, opts) {
  const done = opts && opts.done;
  const q = opts && opts.q ? String(opts.q).toLowerCase() : "";
  const kind = opts && opts.kind;
  const date = opts && opts.date;

  return db.items
    .filter(function (it) {
      if (it.userId !== userId) return false;
      if (it.deletedAt) return false;
      if (kind && it.kind !== kind) return false;
      // date 形如 2026-11-20，匹配 due 的前 10 位
      if (date && String(it.due || "").slice(0, 10) !== date) return false;
      if (done === true && !it.done) return false;
      if (done === false && it.done) return false;
      if (q) {
        const hay = (String(it.title) + " " + String(it.note || "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .slice()
    .sort(function (a, b) { return a.id - b.id; });
}

function get(userId, id) {
  return db.items.find(function (it) {
    return it.id === id && it.userId === userId && !it.deletedAt;
  }) || null;
}

function create(userId, input) {
  const item = {
    id: db.nextItemId++,
    userId: userId,
    kind: input.kind === "short" ? "short" : "long",
    due: typeof input.due === "string" ? input.due : "",
    title: input.title,
    note: input.note || "",
    done: input.done === true,
    createdAt: now()
  };
  db.items.push(item);
  save();
  return item;
}

function update(userId, id, patch) {
  const item = get(userId, id);
  if (!item) return null;

  if (patch.kind !== undefined) item.kind = patch.kind;
  if (patch.due !== undefined) item.due = patch.due;
  if (patch.title !== undefined) item.title = patch.title;
  if (patch.note !== undefined) item.note = patch.note;
  if (patch.done !== undefined) item.done = patch.done;

  save();
  return item;
}

// 软删除：只打标记，不真的删，这样前端可以「撤销」
function remove(userId, id) {
  const item = get(userId, id);
  if (!item) return false;
  item.deletedAt = now();
  save();
  return true;
}

// 撤销删除
function restore(userId, id) {
  const item = db.items.find(function (it) {
    return it.id === id && it.userId === userId && it.deletedAt;
  });
  if (!item) return false;
  delete item.deletedAt;
  save();
  return true;
}

module.exports = {
  createUser,
  findUserByName,
  getUserById,
  createSession,
  getSession,
  deleteSession,
  cleanExpiredSessions,
  list,
  get,
  create,
  update,
  remove,
  restore,
  filePath
};
