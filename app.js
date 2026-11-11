/* ============================================================
   这个文件是网页的「动作」部分，只做两件事：
     1. 列表页：把 7 条数据画成一列，并支持搜索筛选
     2. 详情页：从网址里取出 ?id=N，找到那一条，画出详情
   页面一打开会判断自己是谁（看 <body data-page="...">），
   然后只运行对应的那一个函数。
   ============================================================ */


/* ---------- 一、数据 ---------- */

// 暂时直接写在代码里（任务 3 会改成从服务器读取）
// 每条数据有 4 个项目：
//   id   编号，唯一，详情页靠它找到这一条
//   title 标题，显示在列表里
//   done 是否完成，true=已完成，false=待办
//   note 说明，只有详情页显示
const items = [
  { id: 1, title: "任务1：静态页面上线", done: true,
    note: "已经拿到 https 网址，抓包和 404 截图都做了。" },
  { id: 2, title: "任务2：写 3 个接口，数据落盘", done: false,
    note: "查看列表 / 新增 / 删除三个通道，服务重启后数据还在。" },
  { id: 3, title: "任务3：前后端联调，做出增删查闭环", done: false,
    note: "加载中、空数据、请求失败三种状态都要有。" },
  { id: 4, title: "任务4：接入大模型，做流式对话页", done: false,
    note: "文字一个一个蹦出来，密钥只放在服务器上。" },
  { id: 5, title: "任务5：工具调用，让模型操作数据", done: false,
    note: "一句自然语言，数据库真的多一条。" },
  { id: 6, title: "任务6：整合交付与答辩", done: false,
    note: "README 能让别人 10 分钟跑起来。" },
  { id: 7, title: "贯穿全程：每天一次提交 + 周记", done: false,
    note: "提交记录就是本周的真实进度。" }
];


/* ---------- 二、列表页 ---------- */

// 在列表页被调用一次
function showList() {

  // 先在页面上找到 4 个需要用到的地方
  const listEl   = document.getElementById("list");    // 放列表的空盒子 <ul>
  const countEl  = document.getElementById("count");   // 显示「共几条」
  const emptyEl  = document.getElementById("empty");   // 「没有匹配」的提示
  const searchEl = document.getElementById("search");  // 搜索框

  // draw 的意思是「画一遍」。给它一个关键字，它按关键字重新画整个列表
  function draw(keyword) {

    const kw = keyword.trim();   // 去掉首尾空格

    // 从 7 条里挑出标题包含关键字的那些
    // 关键字是空的时候，每一条都包含空字符串，所以 7 条全留下
    const shown = items.filter(function (it) {
      return it.title.includes(kw);
    });

    // 画之前先清空，否则每输入一个字就往下叠一遍
    listEl.innerHTML = "";

    // 把挑出来的每一条，画成一个 <li>
    shown.forEach(function (it) {

      const li = document.createElement("li");   // 造一个「一行」的盒子

      // 1) 状态标签：已完成绿色，待办红色
      const badge = document.createElement("span");
      badge.className = it.done ? "badge done" : "badge";
      badge.textContent = it.done ? "已完成" : "待办";

      // 2) 可点的标题，点了跳到详情页，网址带上这条的编号
      const a = document.createElement("a");
      a.className = "item-title";
      if (it.done) a.classList.add("done-text");   // 已完成的标题加删除线
      a.href = "detail.html?id=" + it.id;
      a.textContent = it.title;

      // 3) 把标签和标题挂到这一行里，再把这一行挂到列表里
      li.appendChild(badge);
      li.appendChild(a);
      listEl.appendChild(li);
    });

    // 更新上面那行「共 N 条，显示 M 条」
    countEl.textContent = "共 " + items.length + " 条，显示 " + shown.length + " 条";

    // 一条都没剩下的时候，把「没有匹配」的提示显示出来
    emptyEl.hidden = shown.length !== 0;
  }

  // 这是任务书要求的「1 处 JS 交互」：
  // 搜索框内容一变化（每敲一个字），就按当前内容重画一次
  searchEl.addEventListener("input", function (e) {
    draw(e.target.value);
  });

  // 打开页面时不会自动画，必须主动叫它画一次
  draw("");
}


/* ---------- 三、详情页 ---------- */

// 在详情页被调用一次
function showDetail() {

  const box = document.getElementById("detail");   // 放内容的空盒子

  // 从网址里取出 id。比如网址是 detail.html?id=3，
  // location.search 是 "?id=3"，取出字符串 "3" 再用 Number 变成数字
  const id = Number(new URLSearchParams(location.search).get("id"));

  // 在 7 条数据里找编号等于 id 的那一条
  const item = items.find(function (it) {
    return it.id === id;
  });

  // 找不到（比如网址被改成了 ?id=999）
  if (!item) {
    const tip = document.createElement("p");
    tip.className = "empty";
    tip.textContent = "找不到这条，id 可能是错的。";
    box.appendChild(tip);
    return;   // 后面的不用做了
  }

  // 找得到：标题、编号和状态、说明、返回链接
  const title = document.createElement("h2");
  title.textContent = item.title;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = "编号 #" + item.id + " · " + (item.done ? "已完成" : "待办");

  const note = document.createElement("p");
  note.textContent = item.note;

  const back = document.createElement("p");
  const backLink = document.createElement("a");
  backLink.href = "index.html";
  backLink.textContent = "← 返回列表";
  back.appendChild(backLink);

  box.appendChild(title);
  box.appendChild(meta);
  box.appendChild(note);
  box.appendChild(back);
}


/* ---------- 四、入口 ---------- */

// 两个页面共用这一个文件，靠 <body data-page="list|detail"> 区分该跑哪段
if (document.body.dataset.page === "list") {
  showList();
}
if (document.body.dataset.page === "detail") {
  showDetail();
}
