/* ============================================================
   app.js —— 清单页 + 详情页

   数据全部来自后端（apiFetch 会自动带上登录凭证）。
   三种状态：加载中 / 空 / 失败（带重试）。
   ============================================================ */

/* ============================================================
   一、清单页
   ============================================================ */
function initListPage() {
  const el = {
    form: document.getElementById("add-form"),
    newTitle: document.getElementById("new-title"),
    addBtn: document.getElementById("add-btn"),
    search: document.getElementById("search"),
    onlyTodo: document.getElementById("only-todo"),
    count: document.getElementById("count"),
    list: document.getElementById("list"),
    loading: document.getElementById("loading"),
    empty: document.getElementById("empty"),
    errorBox: document.getElementById("error"),
    errorMsg: document.getElementById("error-msg"),
    retry: document.getElementById("retry")
  };

  let allItems = [];
  let keyword = "";
  let onlyTodoOn = false;

  function setState(state) {
    el.loading.hidden = state !== "loading";
    el.empty.hidden = state !== "empty";
    el.errorBox.hidden = state !== "error";
    el.list.hidden = state === "loading" || state === "empty" || state === "error";
  }

  async function loadItems() {
    setState("loading");
    el.count.textContent = "";
    el.list.innerHTML = "";

    try {
      const res = await apiFetch("/items");

      if (!res.ok) throw new Error("服务器返回状态码 " + res.status);

      const json = await res.json();
      if (json.code !== 0) throw new Error(json.msg || "接口返回失败");

      allItems = json.data || [];
      render();
    } catch (err) {
      el.errorMsg.textContent =
        "加载失败：" + err.message + "。请检查网络，或稍后点重试。";
      setState("error");
    }
  }

  function render() {
    const kw = keyword.trim().toLowerCase();

    const shown = allItems.filter(function (it) {
      if (onlyTodoOn && it.done) return false;
      const hay = (it.title + " " + (it.note || "")).toLowerCase();
      return hay.indexOf(kw) !== -1;
    });

    el.list.innerHTML = "";
    shown.forEach(function (it) {
      el.list.appendChild(createRow(it));
    });

    el.count.textContent = allItems.length > 0
      ? "共 " + allItems.length + " 条，显示 " + shown.length + " 条"
      : "";

    if (shown.length === 0) {
      el.empty.textContent = allItems.length === 0
        ? "这里还是空的。上面输入一条试试，或者去「" + CONFIG.AI_NAME + "」说一声。"
        : "没有符合筛选条件的待办";
      setState("empty");
      return;
    }

    setState("data");
  }

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

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn-ghost";
    toggle.textContent = it.done ? "取消完成" : "完成";
    toggle.addEventListener("click", function () {
      toggleDone(it, toggle);
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger";
    del.textContent = "删除";
    del.addEventListener("click", function () {
      deleteItem(it, del);
    });

    li.appendChild(badge);
    li.appendChild(a);
    li.appendChild(toggle);
    li.appendChild(del);
    return li;
  }

  async function toggleDone(it, btn) {
    btn.disabled = true;
    btn.textContent = "处理中";

    try {
      const res = await apiFetch("/items/" + it.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !it.done })
      });

      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      await loadItems();
    } catch (err) {
      window.alert("修改失败：" + err.message);
      btn.disabled = false;
      btn.textContent = it.done ? "取消完成" : "完成";
    }
  }

  async function deleteItem(it, btn) {
    if (!window.confirm("确定删除「" + it.title + "」？")) return;

    btn.disabled = true;
    btn.textContent = "删除中";

    try {
      const res = await apiFetch("/items/" + it.id, { method: "DELETE" });
      const json = await res.json().catch(function () { return {}; });

      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      await loadItems();
    } catch (err) {
      window.alert("删除失败：" + err.message);
      btn.disabled = false;
      btn.textContent = "删除";
    }
  }

  el.form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const title = el.newTitle.value.trim();
    if (!title) {
      window.alert("先写点什么再提交");
      return;
    }

    el.addBtn.disabled = true;
    el.addBtn.textContent = "添加中";

    try {
      const res = await apiFetch("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title })
      });

      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      el.newTitle.value = "";
      await loadItems();
    } catch (err) {
      window.alert("添加失败：" + err.message);
    } finally {
      el.addBtn.disabled = false;
      el.addBtn.textContent = "添加";
    }
  });

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
    p.className = "back-line";
    const a = document.createElement("a");
    a.href = "index.html";
    a.textContent = "← 返回清单";
    p.appendChild(a);
    box.appendChild(p);
  }

  async function load() {
    showMessage("加载中…", false);

    if (!Number.isInteger(id) || id <= 0) {
      showMessage("网址里的 id 不对", true);
      showBack();
      return;
    }

    try {
      const res = await apiFetch("/items/" + id);
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

  function renderDetail(it) {
    box.innerHTML = "";

    const status = document.createElement("span");
    status.className = it.done ? "badge done" : "badge";
    status.textContent = it.done ? "已完成" : "待办";

    const h2 = document.createElement("h2");
    h2.textContent = it.title;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = it.createdAt ? "创建于 " + it.createdAt : "";

    const note = document.createElement("p");
    note.className = "note-text";
    note.textContent = it.note ? it.note : "（这条没有写说明）";

    box.appendChild(status);
    box.appendChild(h2);
    box.appendChild(meta);
    box.appendChild(note);
    showBack();
  }

  load();
}

/* ============================================================
   三、入口
   ============================================================ */
if (document.body.dataset.page === "list") {
  initListPage();
}
if (document.body.dataset.page === "detail") {
  initDetailPage();
}
