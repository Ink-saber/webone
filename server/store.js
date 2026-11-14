/* ============================================================
   store.js —— 存数据这一层（任务书允许的「本地 JSON 文件」方案）

   为什么不用 SQLite：
   SQLite 需要 Node 自带的 node:sqlite，而云平台（函数计算）的 Node 版本
   可能低于 22.5，还会限制文件写入，一启动就退出。
   换成纯 JS 的 JSON 文件，不依赖任何原生模块，任何 Node 都能跑。

   设计成三级保险：
     1. 优先写到 DB_PATH 指定的文件（本地默认 server/data.json）
     2. 写不进去（云上目录只读）→ 降级成内存模式，服务照常跑，只是不持久
     3. 读到的文件坏了 → 丢掉重来，不让服务崩
   ============================================================ */

const fs = require("node:fs");
const path = require("node:path");

const filePath = process.env.DB_PATH || path.join(__dirname, "data.json");

let items = [];
let nextId = 1;
let persistent = false;

const SEED = [
  { title: "任务1：静态页面上线", note: "已经拿到 https 网址，抓包和 404 截图都做了。", done: true },
  { title: "任务2：写 3 个接口，数据落盘", note: "查看列表 / 新增 / 删除三个通道，服务重启后数据还在。", done: false },
  { title: "任务3：前后端联调，做出增删查闭环", note: "加载中、空数据、请求失败三种状态都要有。", done: false },
  { title: "任务4：接入大模型，做流式对话页", note: "文字一个一个蹦出来，密钥只放在服务器上。", done: false },
  { title: "任务5：工具调用，让模型操作数据", note: "一句自然语言，数据库真的多一条。", done: false },
  { title: "任务6：整合交付与答辩", note: "README 能让别人 10 分钟跑起来。", done: false },
  { title: "贯穿全程：每天一次提交 + 周记", note: "提交记录就是本周的真实进度。", done: false }
];

function now() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function seed() {
  items = SEED.map((it, i) => ({
    id: i + 1,
    title: it.title,
    note: it.note,
    done: it.done,
    createdAt: now()
  }));
  nextId = items.length + 1;
}

function save() {
  if (!persistent) return;
  try {
    fs.writeFileSync(filePath, JSON.stringify({ nextId, items }, null, 2), "utf8");
  } catch (e) {
    console.warn("[store] 写入失败，转为内存模式：" + e.message);
    persistent = false;
  }
}

function init() {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);
      if (Array.isArray(data.items)) {
        items = data.items;
        nextId = Number(data.nextId) || items.length + 1;
      }
    }
    persistent = true;
    console.log("[store] 数据文件：" + filePath);
  } catch (e) {
    console.warn("[store] 无法访问数据文件，使用内存模式（重启后数据重置）：" + e.message);
    persistent = false;
  }

  if (!Array.isArray(items) || items.length === 0) {
    seed();
    save();
    console.log("[store] 已写入 " + items.length + " 条初始数据");
  } else {
    console.log("[store] 已载入 " + items.length + " 条数据");
  }
}

init();

/* ---------------- 对外提供的操作 ---------------- */

function list(opts) {
  const done = opts && opts.done;
  const q = opts && opts.q ? String(opts.q).toLowerCase() : "";

  return items
    .filter((it) => {
      if (done === true && !it.done) return false;
      if (done === false && it.done) return false;
      if (q && !String(it.title).toLowerCase().includes(q)) return false;
      return true;
    })
    .slice()
    .sort((a, b) => a.id - b.id);
}

function get(id) {
  return items.find((it) => it.id === id) || null;
}

function create(input) {
  const item = {
    id: nextId++,
    title: input.title,
    note: input.note || "",
    done: input.done === true,
    createdAt: now()
  };
  items.push(item);
  save();
  return item;
}

function update(id, patch) {
  const item = get(id);
  if (!item) return null;

  if (patch.title !== undefined) item.title = patch.title;
  if (patch.note !== undefined) item.note = patch.note;
  if (patch.done !== undefined) item.done = patch.done;

  save();
  return item;
}

function remove(id) {
  const idx = items.findIndex((it) => it.id === id);
  if (idx === -1) return false;
  items.splice(idx, 1);
  save();
  return true;
}

module.exports = { list, get, create, update, remove, filePath };
