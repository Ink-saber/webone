/* ============================================================
   app.js —— 清单页 与 详情页

   日历在单独的 calendar.html / calendar.js 里。
   ============================================================ */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateTimeStr(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) +
    " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// "2026-11-20 14:30" → "11-20 14:30"；"2026-11-20" → "11-20"
function shortDue(due) {
  return due.slice(5);
}

/* ============================================================
   一、清单页
   ============================================================ */
function initListPage() {

  const el = {
    form: document.getElementById("add-form"),
    newTitle: document.getElementById("new-title"),
    addBtn: document.getElementById("add-btn"),
    tabs: document.getElementById("kind-tabs"),
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
  let kind = "long";              // 当前 tab
  let keyword = "";
  let onlyTodoOn = false;
  let showDone = false;

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
      renderList();
    } catch (err) {
      el.errorMsg.textContent = "加载失败：" + err.message + "。请检查网络，或稍后点重试。";
      setState("error");
    }
  }

  function renderList() {
    const kw = keyword.trim().toLowerCase();
    const nowStr = toDateTimeStr(new Date());

    // tab 上的未完成数量
    const longCount = allItems.filter(function (it) { return it.kind === "long" && !it.done; }).length;
    const shortCount = allItems.filter(function (it) { return it.kind === "short" && !it.done; }).length;

    Array.prototype.forEach.call(el.tabs.children, function (btn) {
      const k = btn.dataset.kind;
      btn.classList.toggle("active", k === kind);
      const num = btn.querySelector(".tab-num");
      if (num) num.textContent = k === "long" ? longCount : shortCount;
    });

    const inTab = allItems.filter(function (it) { return it.kind === kind; });

    const shown = inTab
      .filter(function (it) {
        if (onlyTodoOn && it.done) return false;
        const hay = (it.title + " " + (it.note || "")).toLowerCase();
        return hay.indexOf(kw) !== -1;
      })
      .sort(function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const ad = String(a.due || "\uffff");
        const bd = String(b.due || "\uffff");
        if (ad !== bd) return ad < bd ? -1 : 1;
        return a.id - b.id;
      });

    const undone = shown.filter(function (it) { return !it.done; });
    const finished = shown.filter(function (it) { return it.done; });

    el.list.innerHTML = "";

    undone.forEach(function (it) {
      el.list.appendChild(createRow(it, nowStr));
    });

    if (finished.length > 0) {
      const head = document.createElement("li");
      head.className = "group-head";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = (showDone ? "▾ " : "▸ ") + "已完成 " + finished.length + " 条";
      btn.addEventListener("click", function () {
        showDone = !showDone;
        renderList();
      });

      head.appendChild(btn);
      el.list.appendChild(head);

      if (showDone) {
        finished.forEach(function (it) {
          el.list.appendChild(createRow(it, nowStr));
        });
      }
    }

    el.count.textContent = inTab.length > 0
      ? "共 " + inTab.length + " 条 · 未完成 " +
        inTab.filter(function (it) { return !it.done; }).length + " 条"
      : "";

    if (shown.length === 0) {
      el.empty.textContent = inTab.length === 0
        ? (kind === "long"
            ? "还没有长期任务。上面输入一条，或者点「＋ 新建待办」。"
            : "还没有短期任务。点「＋ 新建待办」，选短期并设置时间。")
        : "没有符合筛选条件的任务";
      setState("empty");
      return;
    }

    setState("data");
  }

  function createRow(it, nowStr) {
    const li = document.createElement("li");
    li.className = "item-row";

    const main = document.createElement("div");
    main.className = "item-main";

    const top = document.createElement("div");
    top.className = "item-top";

    const badge = document.createElement("span");
    badge.className = "badge " + (it.kind === "short" ? "short" : "long");
    badge.textContent = it.kind === "short" ? "短期" : "长期";

    const a = document.createElement("a");
    a.className = "item-title";
    if (it.done) a.classList.add("done-text");
    a.href = "detail.html?id=" + it.id;
    a.textContent = it.title;

    top.appendChild(badge);
    top.appendChild(a);
    main.appendChild(top);

    if (it.due) {
      const meta = document.createElement("div");
      meta.className = "item-meta";

      const time = document.createElement("span");
      time.textContent = it.kind === "short" ? shortDue(it.due) : "截止 " + shortDue(it.due);

      if (!it.done && it.due < nowStr) {
        time.classList.add("overdue");
        time.textContent += " · 已逾期";
      }

      meta.appendChild(time);
      main.appendChild(meta);
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn-ghost";
    toggle.textContent = it.done ? "取消完成" : "完成";
    toggle.addEventListener("click", function () { toggleDone(it, toggle); });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger";
    del.textContent = "删除";
    del.addEventListener("click", function () { deleteItem(it, del); });

    actions.appendChild(toggle);
    actions.appendChild(del);

    li.appendChild(main);
    li.appendChild(actions);
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

    // 短期任务必须选时间，跳去完整表单
    if (kind === "short") {
      location.href = "new.html?kind=short&title=" + encodeURIComponent(title);
      return;
    }

    el.addBtn.disabled = true;
    el.addBtn.textContent = "添加中";

    try {
      const res = await apiFetch("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title, kind: "long" })
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
      el.addBtn.textContent = "快速添加";
    }
  });

  el.search.addEventListener("input", function (e) {
    keyword = e.target.value;
    renderList();
  });

  el.onlyTodo.addEventListener("change", function (e) {
    onlyTodoOn = e.target.checked;
    renderList();
  });

  el.tabs.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-kind]");
    if (!btn) return;
    kind = btn.dataset.kind;
    el.newTitle.placeholder = kind === "long"
      ? "写一件长期要做的事，按回车添加"
      : "短期任务需要时间，回车后去设置";
    renderList();
  });

  el.retry.addEventListener("click", function () {
    loadItems();
  });

  el.newTitle.placeholder = "写一件长期要做的事，按回车添加";

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

  function dueText(it) {
    if (!it.due) return "未设置时间";
    if (it.kind === "short") return it.due;
    return "截止 " + it.due;
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

    const head = document.createElement("div");
    head.className = "detail-head";

    const kindBadge = document.createElement("span");
    kindBadge.className = "badge " + (it.kind === "short" ? "short" : "long");
    kindBadge.textContent = it.kind === "short" ? "短期任务" : "长期任务";

    const status = document.createElement("span");
    status.className = it.done ? "badge done" : "badge";
    status.textContent = it.done ? "已完成" : "待办";

    head.appendChild(kindBadge);
    head.appendChild(status);

    const h2 = document.createElement("h2");
    h2.textContent = it.title;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = dueText(it) + (it.createdAt ? " · 创建于 " + it.createdAt : "");

    const note = document.createElement("p");
    note.className = "note-text";
    note.textContent = it.note ? it.note : "（这条没有写说明）";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-ghost";
    editBtn.textContent = "编辑";
    editBtn.addEventListener("click", function () { renderEditForm(it); });

    const actions = document.createElement("p");
    actions.className = "detail-actions";
    actions.appendChild(editBtn);

    box.appendChild(head);
    box.appendChild(h2);
    box.appendChild(meta);
    box.appendChild(note);
    box.appendChild(actions);
    showBack();
  }

  function renderEditForm(it) {
    box.innerHTML = "";

    const form = document.createElement("form");
    form.className = "stack-form";

    const kindField = document.createElement("div");
    kindField.className = "field";
    const kindLabel = document.createElement("span");
    kindLabel.textContent = "类型";
    const kindWrap = document.createElement("div");
    kindWrap.className = "segmented";

    const optLong = document.createElement("button");
    optLong.type = "button";
    optLong.textContent = "长期任务";

    const optShort = document.createElement("button");
    optShort.type = "button";
    optShort.textContent = "短期任务";

    kindWrap.appendChild(optLong);
    kindWrap.appendChild(optShort);
    kindField.appendChild(kindLabel);
    kindField.appendChild(kindWrap);

    let curKind = it.kind;

    const titleField = document.createElement("label");
    titleField.className = "field";
    const titleLabel = document.createElement("span");
    titleLabel.textContent = "标题";
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.maxLength = 100;
    titleInput.value = it.title;
    titleInput.required = true;
    titleField.appendChild(titleLabel);
    titleField.appendChild(titleInput);

    const dueField = document.createElement("label");
    dueField.className = "field";
    const dueLabel = document.createElement("span");
    const dueInput = document.createElement("input");
    const dueHint = document.createElement("em");
    dueHint.className = "field-hint";
    dueField.appendChild(dueLabel);
    dueField.appendChild(dueInput);
    dueField.appendChild(dueHint);

    if (it.due) {
      dueInput.value = it.kind === "short" ? it.due.replace(" ", "T") : it.due;
    }

    function paintKind() {
      optLong.classList.toggle("active", curKind === "long");
      optShort.classList.toggle("active", curKind === "short");
      dueLabel.textContent = curKind === "short" ? "提醒时间（必填）" : "截止日期（可选）";
      dueInput.type = curKind === "short" ? "datetime-local" : "date";
      dueInput.required = curKind === "short";
      dueHint.textContent = curKind === "short"
        ? "到点提醒你要做这件事"
        : "不填表示没有截止日期";
    }

    const noteField = document.createElement("label");
    noteField.className = "field";
    const noteLabel = document.createElement("span");
    noteLabel.textContent = "说明（可选）";
    const noteInput = document.createElement("textarea");
    noteInput.rows = 4;
    noteInput.maxLength = 500;
    noteInput.value = it.note || "";
    noteField.appendChild(noteLabel);
    noteField.appendChild(noteInput);

    const doneLabel = document.createElement("label");
    doneLabel.className = "check";
    const doneBox = document.createElement("input");
    doneBox.type = "checkbox";
    doneBox.checked = it.done;
    doneLabel.appendChild(doneBox);
    doneLabel.appendChild(document.createTextNode(" 已完成"));

    const err = document.createElement("p");
    err.className = "login-error";
    err.hidden = true;

    const actions = document.createElement("div");
    actions.className = "form-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "btn-ghost";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", function () { renderDetail(it); });

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.className = "btn-primary";
    saveBtn.textContent = "保存";

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    form.appendChild(kindField);
    form.appendChild(titleField);
    form.appendChild(dueField);
    form.appendChild(noteField);
    form.appendChild(doneLabel);
    form.appendChild(err);
    form.appendChild(actions);

    optLong.addEventListener("click", function () { curKind = "long"; paintKind(); });
    optShort.addEventListener("click", function () { curKind = "short"; paintKind(); });
    paintKind();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      err.hidden = true;

      const dueValue = dueInput.value
        ? (curKind === "short" ? dueInput.value.replace("T", " ") : dueInput.value)
        : "";

      if (curKind === "short" && !dueValue) {
        err.textContent = "短期任务必须设置日期和时间";
        err.hidden = false;
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = "保存中";

      try {
        const res = await apiFetch("/items/" + it.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleInput.value.trim(),
            note: noteInput.value.trim(),
            done: doneBox.checked,
            kind: curKind,
            due: dueValue
          })
        });

        const json = await res.json().catch(function () { return {}; });
        if (!res.ok || json.code !== 0) {
          throw new Error(json.msg || ("服务器返回 " + res.status));
        }

        renderDetail(json.data);
      } catch (e2) {
        err.textContent = "保存失败：" + e2.message;
        err.hidden = false;
        saveBtn.disabled = false;
        saveBtn.textContent = "保存";
      }
    });

    box.appendChild(form);
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
