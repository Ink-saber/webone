/* ============================================================
   config.js —— 只放「会变的东西」

   任务书要求：后端地址要抽成配置项，不许写死在业务代码里。
   换地址只改这一个文件，别的代码一个字不用动。
   ============================================================ */

const CONFIG = {
  // 后端已部署到 Railway（代码在 github.com/Ink-saber/webone-server）
  API_BASE: "https://webone-server-production.up.railway.app/api"

  // 本地开发时改成下面这一行，然后先在本地把后端跑起来：
  // API_BASE: "http://localhost:4000/api"
};
