# 待办清单接口文档（任务 2 + 任务 3）

- 本地地址：`http://localhost:4000`
- 数据存储：SQLite，数据库文件 `server/data.db`
- 所有接口返回格式统一为 `{ code, data, msg }`
- 已开启跨域（CORS），网页可以直接调用

| 字段 | 含义 |
| --- | --- |
| `code` | `0` 表示成功；非 0 表示失败（4001 参数错误 / 4004 找不到 / 5000 服务器错误） |
| `data` | 成功时是数据，失败时固定为 `null` |
| `msg` | 给人看的一句话说明 |

HTTP 状态码同时使用：`200`/`201` 成功、`400` 参数错误、`404` 找不到、`500` 服务器错误。

---

## 接口一览

| # | 方法 | 路径 | 作用 | 参数 | 成功状态码 |
| --- | --- | --- | --- | --- | --- |
| 1 | GET | `/api/items` | 查列表 | 可选查询参数 `done`、`q` | 200 |
| 2 | GET | `/api/items/:id` | 查某一条 | 路径参数 `id` | 200 |
| 3 | POST | `/api/items` | 新增一条 | 请求体 JSON：`title`（必填）、`note`、`done` | 201 |
| 4 | DELETE | `/api/items/:id` | 删除一条 | 路径参数 `id` | 200 |
| 5 | PUT | `/api/items/:id` | 修改一条（选做） | 路径参数 `id` + 请求体任意字段 | 200 |
| 6 | GET | `/` | 自检服务是否活着 | 无 | 200 |

---

## 1. GET /api/items —— 查列表

**参数**

| 参数 | 位置 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- | --- |
| `done` | 查询字符串 | 否 | `true` / `false` | 只看已完成 / 只看待办 |
| `q` | 查询字符串 | 否 | 字符串 | 标题包含这个关键字的才返回 |

**请求**

```bash
curl.exe http://localhost:4000/api/items
```

**返回示例（200）**

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "title": "任务1：静态页面上线",
      "note": "已经拿到 https 网址。",
      "done": true,
      "createdAt": "2026-11-12 20:05:16"
    }
  ],
  "msg": "共 8 条"
}
```

**带筛选**

```bash
curl.exe "http://localhost:4000/api/items?done=false"
curl.exe "http://localhost:4000/api/items?q=接口"
```

---

## 2. GET /api/items/:id —— 查某一条（任务 3 新增）

详情页就是靠它拿到数据。

**参数**

| 参数 | 位置 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | 路径 | 是 | 正整数 | 待办编号 |

**请求**

```bash
curl.exe http://localhost:4000/api/items/1
```

**返回示例（200）**

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "title": "任务1：静态页面上线",
    "note": "已经拿到 https 网址。",
    "done": true,
    "createdAt": "2026-11-12 20:05:16"
  },
  "msg": "ok"
}
```

**编号不存在（404）**

```bash
curl.exe http://localhost:4000/api/items/9999
```

```json
{ "code": 4004, "data": null, "msg": "没有编号为 9999 的待办" }
```

---

## 3. POST /api/items —— 新增一条

**参数（请求体 JSON）**

| 参数 | 必填 | 类型 | 限制 |
| --- | --- | --- | --- |
| `title` | 是 | 字符串 | 去掉首尾空格后 1~100 个字 |
| `note` | 否 | 字符串 | 最多 500 个字，默认空 |
| `done` | 否 | 布尔 | 默认 `false` |

**请求**（Windows 命令行里 JSON 带引号容易被吃掉，所以写进文件再发）

```powershell
[IO.File]::WriteAllText("$env:TEMP\body.json", '{"title":"curl test","note":"hello"}', [Text.UTF8Encoding]::new($false))
curl.exe -X POST http://localhost:4000/api/items -H Content-Type:application/json --data-binary "@$env:TEMP\body.json"
```

**返回示例（201）**

```json
{
  "code": 0,
  "data": {
    "id": 11,
    "title": "curl test",
    "note": "hello",
    "done": false,
    "createdAt": "2026-11-13 20:14:02"
  },
  "msg": "新增成功"
}
```

**参数错误（400）**：发空对象 `{}` 或 `{"title":123}`

```json
{ "code": 4001, "data": null, "msg": "title 必填，且必须是字符串" }
```

---

## 4. DELETE /api/items/:id —— 删除一条

```bash
curl.exe -X DELETE http://localhost:4000/api/items/11
```

```json
{ "code": 0, "data": null, "msg": "删除成功" }
```

编号不存在返回 404：

```json
{ "code": 4004, "data": null, "msg": "没有编号为 99999 的待办" }
```

---

## 5. PUT /api/items/:id —— 修改一条（选做）

只传要改的字段，没传的保持原样。

```powershell
[IO.File]::WriteAllText("$env:TEMP\b2.json", '{"done":true}', [Text.UTF8Encoding]::new($false))
curl.exe -X PUT http://localhost:4000/api/items/2 -H Content-Type:application/json --data-binary "@$env:TEMP\b2.json"
```

```json
{
  "code": 0,
  "data": { "id": 2, "title": "任务2：写 3 个接口，数据落盘", "note": "...", "done": true },
  "msg": "修改成功"
}
```

---

## 6. GET / —— 自检

```bash
curl.exe http://localhost:4000
```

```json
{ "code": 0, "data": { "service": "webone 待办清单接口", "task": "任务3" }, "msg": "服务正在运行" }
```

---

## 跨域（CORS）

**问题现象**：网页在 `http://localhost:3000`，接口在 `http://localhost:4000`，端口不同就算不同源。浏览器控制台会红字报：

```
Access to fetch at 'http://localhost:4000/api/items' from origin
'http://localhost:3000' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**原因**：这是浏览器的安全策略，不是接口写错了。`curl` 测试完全正常，只有浏览器会拦。

**解决**：必须由服务端明确允许。`server/index.js` 里加了这段中间件：

```js
app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});
```

**验证方法**

```bash
curl.exe -i -H "Origin: http://localhost:3000" http://localhost:4000/api/items
```

返回头里应该出现 `Access-Control-Allow-Origin: *`。

浏览器在发 POST 之前还会先发一个 `OPTIONS` 探路请求，所以那段中间件要单独回它 `204`，否则 POST 会失败但 GET 正常——这是很容易漏的一点。

---

## 启动方式

```powershell
cd D:\webone\server
npm install      # 只需第一次
npm start
```

停止：`Ctrl + C`。

---

## 自测清单

- [ ] `curl.exe http://localhost:4000/api/items` 返回 `code: 0`
- [ ] 新增一条后，再查列表能多一条
- [ ] 删除刚新增那条，能删掉
- [ ] `curl.exe http://localhost:4000/api/items/1` 能按编号查到
- [ ] 删一个不存在的 id，返回 404 而不是崩掉
- [ ] 传空 `title`，返回 400 并说明原因，服务没崩
- [ ] `Ctrl + C` 停服务再 `npm start`，之前新增的数据还在
- [ ] 带 `Origin` 头请求时，响应里有 `Access-Control-Allow-Origin`
