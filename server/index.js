/* ============================================================
   index.js —— 接口服务本体
   跑起来之后，它会在 http://localhost:4000 上等你来问
   一共四个接口 + 一个自检页，全部返回 { code, data, msg }

   注意：这里没有开跨域（CORS）。
   用 curl 测试不需要它；等任务 3 前端联调时，浏览器会拦住请求，
   那时候再处理——那是任务 3 要亲手撞一次的坑。
   ============================================================ */

const express = require("express");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 4000;

// 让 express 自动把请求体里的 JSON 解析成 req.body
app.use(express.json());

/* ---------- 两个通用回复函数，保证格式统一 ---------- */

// 成功：code 固定为 0
function ok(res, data, msg, status) {
  res.status(status || 200).json({ code: 0, data: data, msg: msg || "ok" });
}

// 失败：code 非 0，data 固定为 null
function fail(res, status, code, msg) {
  res.status(status).json({ code: code, data: null, msg: msg });
}

/* ---------- 数据库一行 → 前端好用的形状 ----------
   数据库里 done 存的是 0/1，转成 true/false；
   字段名 created_at 转成 createdAt（前端习惯驼峰命名） */
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
  const conditions = [];   // 存放 WHERE 的各个条件
  const params = [];       // 存放和 ? 一一对应的值

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
   接口 2：POST /api/items —— 新增一条
   请求体（JSON）：
     title  必填，1~100 个字的字符串
     note   可选，最多 500 个字
     done   可选，true 或 false，默认 false
   ============================================================ */
app.post("/api/items", function (req, res) {
  const body = req.body || {};

  // 校验 title：必须是字符串，去掉首尾空格后不能为空
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return fail(res, 400, 4001, "title 必填，且必须是字符串");
  }
  if (title.length > 100) {
    return fail(res, 400, 4001, "title 最多 100 个字");
  }

  // 校验 note：可以不传，传了就必须是字符串
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 500) {
    return fail(res, 400, 4001, "note 最多 500 个字");
  }

  // 校验 done：可以不传，传了就必须是 true/false
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

  // 插完之后把这条完整读回来，返回给前端
  const row = db.prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid);

  ok(res, toItem(row), "新增成功", 201);
});

/* ============================================================
   接口 3：DELETE /api/items/:id —— 删除一条
   ============================================================ */
app.delete("/api/items/:id", function (req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, 400, 4001, "id 必须是正整数");
  }

  const info = db.prepare("DELETE FROM items WHERE id = ?").run(id);

  // changes 是"实际删掉了几行"。为 0 说明这条根本不存在
  if (info.changes === 0) {
    return fail(res, 404, 4004, "没有编号为 " + id + " 的待办");
  }

  ok(res, null, "删除成功");
});

/* ============================================================
   接口 4：PUT /api/items/:id —— 修改一条（任务书说"想加更好，不强求"）
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

  // 没传的字段沿用原来的值
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
   自检页：打开 http://localhost:4000 能看到这句，说明服务活着
   ============================================================ */
app.get("/", function (req, res) {
  ok(res, { service: "webone 待办清单接口", task: "任务2" }, "服务正在运行");
});

/* ============================================================
   兜底 1：访问了不存在的路径
   没有这段的话，express 会返回一段 HTML 报错，前端解析不了
   ============================================================ */
app.use(function (req, res) {
  fail(res, 404, 4004, "没有这个接口：" + req.method + " " + req.path);
});

/* ============================================================
   兜底 2：全局错误处理
   任何没被抓住的异常都会掉到这里，返回 JSON 而不是 HTML 报错栈
   ============================================================ */
app.use(function (err, req, res, next) {
  // 前端传过来的 JSON 写坏了（少个括号之类）
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
  console.log("  自检：curl http://localhost:" + PORT + "/api/items");
  console.log("  停止：按 Ctrl + C");
  console.log("");
});
