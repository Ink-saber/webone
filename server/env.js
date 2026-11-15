/* ============================================================
   env.js —— 读取同目录下的 .env 文件

   为什么要自己写：不想为了读一个配置文件再装一个 npm 包。
   .env 的格式就是一行一个 KEY=VALUE，# 开头是注释。

   注意：这个文件里的内容绝对不能提交到 GitHub。
   仓库根目录的 .gitignore 里已经写了 .env。
   ============================================================ */

const fs = require("node:fs");
const path = require("node:path");

const envPath = path.join(__dirname, ".env");

// 已经存在的环境变量优先（云平台上一般是直接在面板里配的）
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // 去掉可能存在的引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  console.log("[env] 已读取 .env");
} else {
  console.log("[env] 没有 .env 文件，使用系统环境变量");
}
