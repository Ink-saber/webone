/* ============================================================
   index.js —— 接口服务本体
   跑起来之后，它会在 PORT 指定的端口上等你来问
   一共五个接口 + 一个自检页，全部返回 { code, data, msg }

   存储换成 store.js（纯 JS 的 JSON 文件），不再依赖 node:sqlite，
   所以在任何 Node 版本、任何云平台上都能起来。
   ============================================================ */

const express = require("express");
const store = require("./store");

const app = express();
const PORT = process.env.PORT || 4000;

/* ============================================================
   跨域（CORS）
   网页在 3000，接口在 4000，端口不同就算不同源，浏览器默认不放行。
   必须由服务端明确返回「允许」的响应头。
   ============================================================ */
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 浏览器发 POST 前会先发 OPTIONS 探路，直接回 204
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
   接口 1：GET /api/items —— 查列表
   可选参数：?done=true|false  ?q=关键字
   ============================================================ */
app.get("/api/items", function (req, res) {
  const opts = {};

  if (req.query.done === "true") opts.done = true;
  if (req.query.done === "false") opts.done = false;
  if (req.query.q) opts.q = req.query.q;

  const rows = store.list(opts);
  ok(res, rows, "共 " + rows.length + " 条");
});

/* ============================================================
   接口 2：GET /api/items/:id —— 查某一条
   ============================================================ */
app.get("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const item = store.get(id);
  if (!item) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, item);
});

/* ============================================================
   接口 3：POST /api/items —— 新增一条
   ============================================================ */
app.post("/api/items", function (req, res) {
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

  const item = store.create({ title: title, note: note, done: done });
  ok(res, item, "新增成功", 201);
});

/* ============================================================
   接口 4：DELETE /api/items/:id —— 删除一条
   ============================================================ */
app.delete("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const removed = store.remove(id);
  if (!removed) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, null, "删除成功");
});

/* ============================================================
   接口 5：PUT /api/items/:id —— 修改一条
   ============================================================ */
app.put("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const row = store.get(id);
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

  const updated = store.update(id, patch);
  ok(res, updated, "修改成功");
});

/* ============================================================
   自检页
   ============================================================ */
app.get("/", function (req, res) {
  ok(res, { service: "webone 待办清单接口", task: "任务3" }, "服务正在运行");
});

/* ============================================================
   兜底 1：不存在的路径
   ============================================================ */
app.use(function (req, res) {
  fail(res, 404, 4004, "没有这个接口：" + req.method + " " + req.path);
});

/* ============================================================
   兜底 2：全局错误处理
   ============================================================ */
app.use(function (err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return fail(res, 400, 4001, "请求体不是合法的 JSON");
  }

  console.error("[服务器错误]", err);
  fail(res, 500, 5000, "服务器内部错误，详情看服务端日志");
});

/* ============================================================
   启动
   ============================================================ */
app.listen(PORT, "0.0.0.0", function () {
  console.log("");
  console.log("  接口服务已启动");
  console.log("  端口：" + PORT);
  console.log("  停止：按 Ctrl + C");
  console.log("");
});
