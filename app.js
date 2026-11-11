// ===== 你的 7 条数据 =====
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

// ===== 列表页：把数据画到页面上 =====
function showList() {
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("count");
  const emptyEl = document.getElementById("empty");
  const searchEl = document.getElementById("search");

  function draw(keyword) {
    const kw = keyword.trim();
    const shown = items.filter(function (it) {
      return it.title.includes(kw);
    });

    listEl.innerHTML = "";                 // 先清空，不然会重复叠加

    shown.forEach(function (it) {
      const li = document.createElement("li");

      const badge = document.createElement("span");
      badge.className = it.done ? "badge done" : "badge";
      badge.textContent = it.done ? "已完成" : "待办";

      const a = document.createElement("a");
      a.className = "item-title";
      if (it.done) a.classList.add("done-text");
      a.href = "detail.html?id=" + it.id;
      a.textContent = it.title;

      li.appendChild(badge);
      li.appendChild(a);
      listEl.appendChild(li);
    });

    countEl.textContent = "共 " + items.length + " 条，显示 " + shown.length + " 条";
    emptyEl.hidden = shown.length !== 0;
  }

  // 输入框每变一次就重画
  searchEl.addEventListener("input", function (e) {
    draw(e.target.value);
  });

  draw("");   // 打开页面先画一次完整的
}

// ===== 详情页：从网址里取 id，找那一条 =====
function showDetail() {
  const box = document.getElementById("detail");
  const id = Number(new URLSearchParams(location.search).get("id"));
  const item = items.find(function (it) { return it.id === id; });

  if (!item) {
    box.innerHTML = "<p class='empty'>找不到这条，id 可能是错的。</p>";
    return;
  }

  box.innerHTML =
    "<h2>" + item.title + "</h2>" +
    "<p class='meta'>编号 #" + item.id + " · " + (item.done ? "已完成" : "待办") + "</p>" +
    "<p>" + item.note + "</p>" +
    "<p><a href='index.html'>← 返回列表</a></p>";
}

// ===== 页面一打开，判断该跑哪一段 =====
if (document.body.dataset.page === "list") showList();
if (document.body.dataset.page === "detail") showDetail();