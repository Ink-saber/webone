/* ============================================================
   index.js —— 接口服务本体
   跑起来之后，它会在 http://localhost:4000 上等你来问
   一共五个接口 + 一个自检页，全部返回 { code, data, msg }

   任务 3 相比任务 2 改了两处：
     1. 加了跨域（CORS）响应头，浏览器才允许网页来取数据
     2. 加了 GET /api/items/:id，详情页要按编号查一条
   ============================================================ */

const express = require("express");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

/* ============================================================
   跨域（CORS）—— 任务 3 的核心坑

   问题长这样：网页在 http://localhost:3000，接口在 http://localhost:4000，
   端口不同就算「不同源」，浏览器默认不许网页去拿另一个源的数据，会报
   blocked by CORS policy。

   解决办法只有一个：由服务端明确告诉浏览器「我允许别人来拿」。
   也就是下面这三个响应头。绝对不要靠关浏览器安全策略糊过去。
   ============================================================ */
app.use(function (req, res, next) {
  // 允许任何来源来访问（作业项目够用；真实项目要写具体域名）
  res.setHeader("Access-Control-Allow-Origin", "*");
  // 允许使用这些方法
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  // 允许前端带 Content-Type 这个请求头
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 浏览器在发真正的请求前，会先发一个 OPTIONS 探路，必须回它 204
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

// 让 express 自动把请求体里的 JSON 解析成 req.body
app.use(express.json());

/* ---------- 两个通用回复函数，保证格式统一 ---------- */

function ok(res, data, msg, status) {
  res.status(status || 200).json({ code: 0, data: data, msg: msg || "ok" });
}

function fail(res, status, code, msg) {
  res.status(status).json({ code: code, data: null, msg: msg });
}

/* ---------- 数据库一行 → 前端好用的形状 ---------- */
function toItem(row) {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    done: row.done === 1,
    createdAt: row.created_at
  };
}

/* ============================================================
   接口 1：GET /api/items —— 查列表
   可选查询参数：
     ?done=true       只看已完成的
     ?done=false      只看待办的
     ?q=接口          只看标题里含"接口"的
   ============================================================ */
app.get("/api/items", function (req, res) {
  const conditions = [];
  const params = [];

  if (req.query.done === "true" || req.query.done === "false") {
    conditions.push("done = ?");
    params.push(req.query.done === "true" ? 1 : 0);
  }

  if (req.query.q) {
    conditions.push("title LIKE ?");
    params.push("%" + req.query.q + "%");
  }

  let sql = "SELECT * FROM items";
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY id";

  const rows = db.prepare(sql).all(...params);

  ok(res, rows.map(toItem), "共 " + rows.length + " 条");
});

/* ============================================================
   接口 2：GET /api/items/:id —— 查某一条（任务 3 新增）
   详情页就是靠它拿到那一条的
   ============================================================ */
app.get("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id);

  if (!row) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, toItem(row));
});

/* ============================================================
   接口 3：POST /api/items —— 新增一条
   请求体（JSON）：
     title  必填，1~100 个字
     note   可选，最多 500 个字
     done   可选，true 或 false，默认 false
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

  const info = db
    .prepare("INSERT INTO items (title, note, done) VALUES (?, ?, ?)")
    .run(title, note, done ? 1 : 0);

  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid);

  ok(res, toItem(row), "新增成功", 201);
});

/* ============================================================
   接口 4：DELETE /api/items/:id —— 删除一条
   ============================================================ */
app.delete("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const info = db.prepare("DELETE FROM items WHERE id = ?").run(id);

  if (info.changes === 0) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, null, "删除成功");
});

/* ============================================================
   接口 5：PUT /api/items/:id —— 修改一条（选做）
   只传要改的字段就行，没传的保持原样
   ============================================================ */
app.put("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!row) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  const body = req.body || {};

  const title = body.title === undefined
    ? row.title
    : (typeof body.title === "string" ? body.title.trim() : "");
  if (!title) {
    return fail(res, 400, 4001, "title 不能改成空字符串");
  }
  if (title.length > 100) {
    return fail(res, 400, 4001, "title 最多 100 个字");
  }

  const note = body.note === undefined
    ? row.note
    : (typeof body.note === "string" ? body.note.trim() : "");
  if (note.length > 500) {
    return fail(res, 400, 4001, "note 最多 500 个字");
  }

  let done = row.done === 1;
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") {
      return fail(res, 400, 4001, "done 必须是 true 或 false");
    }
    done = body.done;
  }

  db.prepare("UPDATE items SET title = ?, note = ?, done = ? WHERE id = ?")
    .run(title, note, done ? 1 : 0, id);

  const updated = db.prepare("SELECT * FROM items WHERE id = ?").get(id);
  ok(res, toItem(updated), "修改成功");
});

/* ============================================================
   自检页
   ============================================================ */
app.get("/", function (req, res) {
  ok(res, { service: "webone 待办清单接口", task: "任务3" }, "服务正在运行");
});

/* ============================================================
   兜底 1：访问了不存在的路径
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
app.listen(PORT, function () {
  console.log("");
  console.log("  接口服务已启动");
  console.log("  地址：http://localhost:" + PORT);
  console.log("  已开启跨域（CORS），网页可以来取数据了");
  console.log("  停止：按 Ctrl + C");
  console.log("");
});
