# 待办清单接口文档（任务 2）

- 本地地址：`http://localhost:4000`
- 数据存储：SQLite，数据库文件 `server/data.db`
- 所有接口返回格式统一为 `{ code, data, msg }`

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
| 2 | POST | `/api/items` | 新增一条 | 请求体 JSON：`title`（必填）、`note`、`done` | 201 |
| 3 | DELETE | `/api/items/:id` | 删除一条 | 路径参数 `id` | 200 |
| 4 | PUT | `/api/items/:id` | 修改一条（选做） | 路径参数 `id` + 请求体任意字段 | 200 |
| 5 | GET | `/` | 自检服务是否活着 | 无 | 200 |

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
      "note": "已经拿到 https 网址，抓包和 404 截图都做了。",
      "done": true,
      "createdAt": "2026-11-12 20:05:11"
    }
  ],
  "msg": "共 7 条"
}
```

**带筛选**

```bash
curl.exe "http://localhost:4000/api/items?done=false"
curl.exe "http://localhost:4000/api/items?q=接口"
```

---

## 2. POST /api/items —— 新增一条

**参数（请求体 JSON）**

| 参数 | 必填 | 类型 | 限制 |
| --- | --- | --- | --- |
| `title` | 是 | 字符串 | 去掉首尾空格后 1~100 个字 |
| `note` | 否 | 字符串 | 最多 500 个字，默认空 |
| `done` | 否 | 布尔 | 默认 `false` |

**请求**

```bash
curl.exe -X POST http://localhost:4000/api/items ^
  -H "Content-Type: application/json" ^
  -d '{"title":"test from curl","note":"hello","done":false}'
```

> PowerShell 里用反引号 `` ` `` 换行更稳；或者干脆写成一整行。
> 中文可能因终端编码变乱码，测试时先用英文，要测中文先执行 `chcp 65001`。

**返回示例（201）**

```json
{
  "code": 0,
  "data": {
    "id": 8,
    "title": "test from curl",
    "note": "hello",
    "done": false,
    "createdAt": "2026-11-12 20:10:32"
  },
  "msg": "新增成功"
}
```

**参数错误（400）**

```bash
curl.exe -X POST http://localhost:4000/api/items -H "Content-Type: application/json" -d '{}'
```

```json
{ "code": 4001, "data": null, "msg": "title 必填，且必须是字符串" }
```

```bash
curl.exe -X POST http://localhost:4000/api/items -H "Content-Type: application/json" -d '{"title":123}'
```

```json
{ "code": 4001, "data": null, "msg": "title 必填，且必须是字符串" }
```

---

## 3. DELETE /api/items/:id —— 删除一条

**参数**

| 参数 | 位置 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- | --- |
| `id` | 路径 | 是 | 正整数 | 要删除的编号 |

**请求**

```bash
curl.exe -X DELETE http://localhost:4000/api/items/8
```

**返回示例（200）**

```json
{ "code": 0, "data": null, "msg": "删除成功" }
```

**编号不存在（404）**

```bash
curl.exe -X DELETE http://localhost:4000/api/items/99999
```

```json
{ "code": 4004, "data": null, "msg": "没有编号为 99999 的待办" }
```

---

## 4. PUT /api/items/:id —— 修改一条（选做）

只传要改的字段，没传的保持原样。

**请求**

```bash
curl.exe -X PUT http://localhost:4000/api/items/2 ^
  -H "Content-Type: application/json" ^
  -d '{"done":true}'
```

**返回示例（200）**

```json
{
  "code": 0,
  "data": { "id": 2, "title": "任务2：写 3 个接口，数据落盘", "note": "...", "done": true },
  "msg": "修改成功"
}
```

---

## 5. GET / —— 自检

```bash
curl.exe http://localhost:4000
```

```json
{ "code": 0, "data": { "service": "webone 待办清单接口", "task": "任务2" }, "msg": "服务正在运行" }
```

---

## 兜底行为

**访问不存在的路径**

```bash
curl.exe http://localhost:4000/api/nothing
```

```json
{ "code": 4004, "data": null, "msg": "没有这个接口：GET /api/nothing" }
```

**请求体不是合法 JSON**

```bash
curl.exe -X POST http://localhost:4000/api/items -H "Content-Type: application/json" -d '{bad json'
```

```json
{ "code": 4001, "data": null, "msg": "请求体不是合法的 JSON" }
```

---

## 启动方式

```powershell
cd D:\webone\server
npm install        # 只需第一次
npm start
```

看到这段说明启动成功：

```
  接口服务已启动
  地址：http://localhost:4000
```

停止：`Ctrl + C`。

---

## 自测清单（对应任务书验收标准）

- [ ] `curl.exe http://localhost:4000/api/items` 返回 7 条，`code` 是 0
- [ ] 新增一条后，再查列表能多一条
- [ ] 删除刚新增那条，能删掉
- [ ] 删一个不存在的 id，返回 404 而不是崩掉
- [ ] 传空 `title`，返回 400 并说明原因，服务没崩
- [ ] `Ctrl + C` 停服务，再 `npm start`，**之前新增的数据还在**（这就是"数据落盘"）
- [ ] 访问 `/api/nothing`，返回 JSON 而不是 HTML 报错页

---

## 已知行为（不是 bug）

**没有开跨域（CORS）。** 用 `curl` 测试不受影响；但任务 3 在浏览器里让前端直接调这个接口时，浏览器会拦下请求并报 `blocked by CORS policy`。这是任务 3 要专门处理的事——任务书要求"撞到 CORS，要在服务端加跨域响应头解决"，所以这里故意先不加。

**数据库文件 `data.db` 不进 git。** 它在 `.gitignore` 里。所以别人 clone 下来第一次运行时会自动建表并写入 7 条种子数据（见 `db.js`），不会打开是空的。

**端口是 4000，不是 3000。** 因为任务 3 会用 `npx serve .` 起前端，它默认占用 3000，两个都用 3000 会冲突。
