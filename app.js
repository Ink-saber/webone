/* ============================================================
   app.js —— 任务 3：数据不再写死在文件里，改成向服务器要

   和任务 1 最大的区别：
     任务 1  数据在文件里  → 打开页面直接画
     任务 3  数据在服务器  → 打开页面先发请求，等它回来再画

   所以多了「等待」这件事，页面就有了三种状态：
     加载中（loading）  请求已发出，结果还没回来
     空数据（empty）    回来了，但一条都没有
     请求失败（error）  没成功，给个「重试」按钮
   ============================================================ */

// 后端地址来自 config.js，不写死在这里
const API = CONFIG.API_BASE;


/* ============================================================
   一、列表页
   ============================================================ */
function initListPage() {

  // 把页面上要用到的元素先找好，后面直接用
  const el = {
    form:     document.getElementById("add-form"),
    newTitle: document.getElementById("new-title"),
    addBtn:   document.getElementById("add-btn"),
    search:   document.getElementById("search"),
    onlyTodo: document.getElementById("only-todo"),
    count:    document.getElementById("count"),
    list:     document.getElementById("list"),
    loading:  document.getElementById("loading"),
    empty:    document.getElementById("empty"),
    errorBox: document.getElementById("error"),
    errorMsg: document.getElementById("error-msg"),
    retry:    document.getElementById("retry")
  };

  // 内存里存一份服务器给的数据，筛选时不用反复请求
  let allItems = [];
  let keyword = "";
  let onlyTodoOn = false;


  /* ---------- 控制四种显示状态 ---------- */
  function setState(state) {
    el.loading.hidden = state !== "loading";
    el.empty.hidden   = state !== "empty";
    el.errorBox.hidden = state !== "error";
    el.list.hidden    = state === "loading" || state === "empty" || state === "error";
  }


  /* ---------- 向服务器要数据 ---------- */
  async function loadItems() {
    setState("loading");
    el.count.textContent = "";
    el.list.innerHTML = "";

    try {
      const res = await fetch(API + "/items");

      // 第一层判断：HTTP 状态码是不是 2xx
      if (!res.ok) {
        throw new Error("服务器返回状态码 " + res.status);
      }

      const json = await res.json();

      // 第二层判断：接口自己的 code 是不是 0
      if (json.code !== 0) {
        throw new Error(json.msg || "接口返回失败");
      }

      allItems = json.data || [];
      render();
    } catch (err) {
      el.errorMsg.textContent =
        "加载失败：" + err.message +
        "。请确认后端已经在 " + API + " 启动。";
      setState("error");
    }
  }


  /* ---------- 按当前筛选条件画列表 ---------- */
  function render() {
    const kw = keyword.trim().toLowerCase();

    const shown = allItems.filter(function (it) {
      if (onlyTodoOn && it.done) return false;
      return String(it.title).toLowerCase().indexOf(kw) !== -1;
    });

    el.list.innerHTML = "";
    shown.forEach(function (it) {
      el.list.appendChild(createRow(it));
    });

    el.count.textContent = "共 " + allItems.length + " 条，显示 " + shown.length + " 条";

    if (shown.length === 0) {
      el.empty.textContent = allItems.length === 0
        ? "还没有待办，在上面输入一条试试"
        : "没有符合筛选条件的待办";
      setState("empty");
      return;
    }

    setState("data");
  }


  /* ---------- 画一条 ---------- */
  function createRow(it) {
    const li = document.createElement("li");

    const badge = document.createElement("span");
    badge.className = it.done ? "badge done" : "badge";
    badge.textContent = it.done ? "已完成" : "待办";

    const a = document.createElement("a");
    a.className = "item-title";
    if (it.done) a.classList.add("done-text");
    a.href = "detail.html?id=" + it.id;
    a.textContent = it.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "删除";
    del.addEventListener("click", function () {
      deleteItem(it, del);
    });

    li.appendChild(badge);
    li.appendChild(a);
    li.appendChild(del);
    return li;
  }


  /* ---------- 删除一条 ---------- */
  async function deleteItem(it, btn) {
    if (!window.confirm("确定删除「" + it.title + "」？")) return;

    btn.disabled = true;
    btn.textContent = "删除中";

    try {
      const res = await fetch(API + "/items/" + it.id, { method: "DELETE" });
      const json = await res.json().catch(function () { return {}; });

      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      // 删完重新拉一遍列表，保证页面和数据库一致
      await loadItems();
    } catch (err) {
      window.alert("删除失败：" + err.message);
      btn.disabled = false;
      btn.textContent = "删除";
    }
  }


  /* ---------- 新增一条 ---------- */
  el.form.addEventListener("submit", async function (e) {
    e.preventDefault();   // 阻止表单默认的「刷新页面」行为

    const title = el.newTitle.value.trim();
    if (!title) {
      window.alert("标题不能为空");
      return;
    }

    el.addBtn.disabled = true;
    el.addBtn.textContent = "提交中";

    try {
      const res = await fetch(API + "/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // JSON.stringify 负责把对象变成文字，中文和引号都不用你操心
        body: JSON.stringify({ title: title })
      });

      const json = await res.json().catch(function () { return {}; });

      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      el.newTitle.value = "";
      await loadItems();
    } catch (err) {
      window.alert("新增失败：" + err.message);
    } finally {
      el.addBtn.disabled = false;
      el.addBtn.textContent = "新增";
    }
  });


  /* ---------- 筛选、只看未完成、重试 ---------- */
  el.search.addEventListener("input", function (e) {
    keyword = e.target.value;
    render();
  });

  el.onlyTodo.addEventListener("change", function (e) {
    onlyTodoOn = e.target.checked;
    render();
  });

  el.retry.addEventListener("click", function () {
    loadItems();
  });


  // 页面一打开就去要数据
  loadItems();
}


/* ============================================================
   二、详情页
   ============================================================ */
function initDetailPage() {

  const box = document.getElementById("detail");
  const id = Number(new URLSearchParams(location.search).get("id"));

  function showMessage(text, isError) {
    box.innerHTML = "";
    const p = document.createElement("p");
    p.className = isError ? "state error" : "state";
    p.textContent = text;
    box.appendChild(p);
  }

  function showBack() {
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.href = "index.html";
    a.textContent = "← 返回列表";
    p.appendChild(a);
    box.appendChild(p);
  }

  function renderDetail(it) {
    box.innerHTML = "";

    const status = document.createElement("span");
    status.className = it.done ? "badge done" : "badge";
    status.textContent = it.done ? "已完成" : "待办";

    const h2 = document.createElement("h2");
    h2.textContent = it.title;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = "编号 #" + it.id + (it.createdAt ? " · 创建于 " + it.createdAt : "");

    const note = document.createElement("p");
    note.textContent = it.note ? it.note : "（这条没有写说明）";

    box.appendChild(status);
    box.appendChild(h2);
    box.appendChild(meta);
    box.appendChild(note);
    showBack();
  }

  async function load() {
    showMessage("加载中…", false);

    if (!Number.isInteger(id) || id <= 0) {
      showMessage("网址里的 id 不对，应该是 detail.html?id=1 这种形式", true);
      showBack();
      return;
    }

    try {
      const res = await fetch(API + "/items/" + id);
      const json = await res.json().catch(function () { return {}; });

      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      renderDetail(json.data);
    } catch (err) {
      showMessage("加载失败：" + err.message, true);
      showBack();
    }
  }

  load();
}


/* ============================================================
   三、入口：两个页面共用这一个文件，靠 <body data-page> 区分
   ============================================================ */
if (document.body.dataset.page === "list") {
  initListPage();
}
if (document.body.dataset.page === "detail") {
  initDetailPage();
}
