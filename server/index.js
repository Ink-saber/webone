/* ============================================================
   index.js —— 接口服务本体（多用户版）

   公开接口：/api/auth/register、/api/auth/login、/api/auth/logout、/
   需要登录：/api/items*、/api/chat、/api/auth/me

   鉴权方式：请求头 Authorization: Bearer <token>
   ============================================================ */

require("./env");               // 先读 .env，拿到 DEEPSEEK_API_KEY

const express = require("express");
const store = require("./store");
const auth = require("./auth");
const chat = require("./chat");

const app = express();
const PORT = process.env.PORT || 4000;

/* ---------- 任务类型与时间格式 ---------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;                 // 2026-11-20
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/; // 2026-11-20 14:30

// 返回 null 表示合法，否则返回一句人话
function checkDue(kind, due) {
  if (kind === "short") {
    if (!due) return "短期任务必须设置提醒时间，格式 YYYY-MM-DD HH:mm";
    if (!DATETIME_RE.test(due)) return "提醒时间格式应为 YYYY-MM-DD HH:mm，例如 2026-11-20 14:30";
    return null;
  }
  if (due && !DATE_RE.test(due)) {
    return "截止日期格式应为 YYYY-MM-DD，例如 2026-11-20";
  }
  return null;
}

/* ---------- 跨域 ---------- */
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

/* ---------- 统一回复 ---------- */
function ok(res, data, msg, status) {
  res.status(status || 200).json({ code: 0, data: data, msg: msg || "ok" });
}

function fail(res, status, code, msg) {
  res.status(status).json({ code: code, data: null, msg: msg });
}

/* ============================================================
   注册 / 登录 / 退出 / 当前用户
   ============================================================ */
auth.register(app, fail);

/* ============================================================
   待办：全部要登录，且只看得到自己的数据
   ============================================================ */

// 查列表
app.get("/api/items", auth.requireAuth, function (req, res) {
  const opts = {};

  if (req.query.done === "true") opts.done = true;
  if (req.query.done === "false") opts.done = false;
  if (req.query.q) opts.q = req.query.q;
  if (req.query.kind === "long" || req.query.kind === "short") opts.kind = req.query.kind;
  if (req.query.date && DATE_RE.test(req.query.date)) opts.date = req.query.date;

  const rows = store.list(req.userId, opts);
  ok(res, rows, "共 " + rows.length + " 条");
});

// 查某一条
app.get("/api/items/:id", auth.requireAuth, function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const item = store.get(req.userId, id);
  if (!item) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, item);
});

// 新增
app.post("/api/items", auth.requireAuth, function (req, res) {
  const body = req.body || {};

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return fail(res, 400, 4001, "title 必填，且必须是字符串");
  }
  if (title.length > 100) {
    return fail(res, 400, 4001, "title 最多 100 个字");
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 500) {
    return fail(res, 400, 4001, "note 最多 500 个字");
  }

  let done = false;
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") {
      return fail(res, 400, 4001, "done 必须是 true 或 false");
    }
    done = body.done;
  }

  const kind = body.kind === "short" ? "short" : "long";
  const due = typeof body.due === "string" ? body.due.trim() : "";
  const dueProblem = checkDue(kind, due);
  if (dueProblem) return fail(res, 400, 4001, dueProblem);

  const item = store.create(req.userId, {
    title: title,
    note: note,
    done: done,
    kind: kind,
    due: due
  });
  ok(res, item, "新增成功", 201);
});

// 删除
app.delete("/api/items/:id", auth.requireAuth, function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const removed = store.remove(req.userId, id);
  if (!removed) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, null, "删除成功");
});

// 修改
app.put("/api/items/:id", auth.requireAuth, function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const row = store.get(req.userId, id);
  if (!row) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  const body = req.body || {};
  const patch = {};

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return fail(res, 400, 4001, "title 不能改成空字符串");
    if (title.length > 100) return fail(res, 400, 4001, "title 最多 100 个字");
    patch.title = title;
  }

  if (body.note !== undefined) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 500) return fail(res, 400, 4001, "note 最多 500 个字");
    patch.note = note;
  }

  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") {
      return fail(res, 400, 4001, "done 必须是 true 或 false");
    }
    patch.done = body.done;
  }

  const nextKind = body.kind === undefined ? row.kind : (body.kind === "short" ? "short" : "long");
  let nextDue = body.due === undefined
    ? row.due
    : (typeof body.due === "string" ? body.due.trim() : "");

  // 短期改长期时，原来的「日期 时刻」自动截成日期，不然会校验不过
  if (nextKind === "long" && DATETIME_RE.test(nextDue)) {
    nextDue = nextDue.slice(0, 10);
  }

  const dueProblem = checkDue(nextKind, nextDue);
  if (dueProblem) return fail(res, 400, 4001, dueProblem);

  patch.kind = nextKind;
  patch.due = nextDue;

  const updated = store.update(req.userId, id, patch);
  ok(res, updated, "修改成功");
});

/* ============================================================
   对话 + 工具调用（要登录，工具只动自己的数据）
   ============================================================ */
chat.register(app, fail, auth.requireAuth);

/* ============================================================
   自检
   ============================================================ */
app.get("/", function (req, res) {
  ok(
    res,
    {
      service: "todo-list api",
      version: "v2",
      hasApiKey: Boolean(process.env.DEEPSEEK_API_KEY)
    },
    "服务正在运行"
  );
});

/* ---------- 兜底 ---------- */
app.use(function (req, res) {
  fail(res, 404, 4004, "没有这个接口：" + req.method + " " + req.path);
});

app.use(function (err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return fail(res, 400, 4001, "请求体不是合法的 JSON");
  }
  console.error("[服务器错误]", err);
  fail(res, 500, 5000, "服务器内部错误，详情看服务端日志");
});

/* ---------- 启动 ---------- */
app.listen(PORT, "0.0.0.0", function () {
  store.cleanExpiredSessions();
  setInterval(store.cleanExpiredSessions, 60 * 60 * 1000).unref();

  console.log("");
  console.log("  接口服务已启动");
  console.log("  端口：" + PORT);
  console.log("  大模型：" + (process.env.DEEPSEEK_API_KEY ? "已配置 Key" : "未配置 Key（/api/chat 会提示）"));
  console.log("  停止：按 Ctrl + C");
  console.log("");
});
