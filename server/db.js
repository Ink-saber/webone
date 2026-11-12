/* ============================================================
   db.js —— 数据库这一层，只做一件事：开库、建表、第一次运行时塞种子数据
   数据库用的是 Node 自带的 node:sqlite（Node 22.5 以上都有），
   不需要 npm 装任何东西，所以不会有"编译原生模块失败"的问题。
   ============================================================ */

const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// 数据库文件就放在 server 目录下，叫 data.db
// 一个文件就是整个数据库，删掉它数据就没了，备份它就是备份数据
const dbPath = path.join(__dirname, "data.db");
const db = new DatabaseSync(dbPath);

// ---------- 建表 ----------
// IF NOT EXISTS 的意思是：表已经存在就不做，所以每次启动跑这句都安全
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,   -- 编号，自动递增，不会重复
    title      TEXT    NOT NULL,                    -- 标题，必填
    note       TEXT    NOT NULL DEFAULT '',         -- 说明，可以空
    done       INTEGER NOT NULL DEFAULT 0,          -- 是否完成：0=待办 1=已完成
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

// ---------- 第一次运行时塞种子数据 ----------
// 为什么要这一步：换台电脑、重新 clone、或者部署到免费平台被清盘时，
// 表是空的，页面会一条都看不到。塞 7 条初始数据，任何环境打开都有内容。
const count = db.prepare("SELECT COUNT(*) AS n FROM items").get().n;

if (count === 0) {
  const insert = db.prepare(
    "INSERT INTO items (title, note, done) VALUES (?, ?, ?)"
  );

  const seed = [
    { title: "任务1：静态页面上线", note: "已经拿到 https 网址，抓包和 404 截图都做了。", done: 1 },
    { title: "任务2：写 3 个接口，数据落盘", note: "查看列表 / 新增 / 删除三个通道，服务重启后数据还在。", done: 0 },
    { title: "任务3：前后端联调，做出增删查闭环", note: "加载中、空数据、请求失败三种状态都要有。", done: 0 },
    { title: "任务4：接入大模型，做流式对话页", note: "文字一个一个蹦出来，密钥只放在服务器上。", done: 0 },
    { title: "任务5：工具调用，让模型操作数据", note: "一句自然语言，数据库真的多一条。", done: 0 },
    { title: "任务6：整合交付与答辩", note: "README 能让别人 10 分钟跑起来。", done: 0 },
    { title: "贯穿全程：每天一次提交 + 周记", note: "提交记录就是本周的真实进度。", done: 0 }
  ];

  // 用 ? 占位符再传值，这叫"参数化查询"
  // 千万不要用字符串拼接把用户输入塞进 SQL，那叫 SQL 注入，别人能删你的库
  for (const it of seed) {
    insert.run(it.title, it.note, it.done);
  }

  console.log(`[db] 首次运行，已写入 ${seed.length} 条初始数据`);
} else {
  console.log(`[db] 数据库已存在，共 ${count} 条数据`);
}

console.log(`[db] 数据库文件：${dbPath}`);

module.exports = db;
