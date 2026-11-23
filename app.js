/* ============================================================
   app.js —— 清单页 与 详情页

   增删查改的几处手感优化：
     增：快速添加支持「填了时间就是短期任务」、可展开说明、加完保持焦点
     删：不弹确认框，直接删 + 底部「撤销」（后端是软删除）
     查：搜索跨类型、命中高亮、三种排序、全部/长期/短期三个 tab
     改：双击标题原地改、标记完成不整页刷新
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

// 把标题按关键字切段，命中的部分包 <mark>
function appendHighlighted(parent, text, kw) {
  if (!kw) {
    parent.textContent = text;
    return;
  }

  const lowerText = String(text).toLowerCase();
  const lowerKw = kw.toLowerCase();

  let from = 0;
  while (true) {
    const at = lowerText.indexOf(lowerKw, from);
    if (at === -1) {
      parent.appendChild(document.createTextNode(String(text).slice(from)));
      break;
    }
    if (at > from) {
      parent.appendChild(document.createTextNode(String(text).slice(from, at)));
    }
    const mark = document.createElement("mark");
    mark.textContent = String(text).slice(at, at + kw.length);
    parent.appendChild(mark);
    from = at + kw.length;
  }
}

/* ============================================================
   一、清单页
   ============================================================ */
function initListPage() {

  const el = {
    form: document.getElementById("add-form"),
    newTitle: document.getElementById("new-title"),
    newDue: document.getElementById("new-due"),
    newNote: document.getElementById("new-note"),
    toggleNote: document.getElementById("toggle-note"),
    addBtn: document.getElementById("add-btn"),
    tabs: document.getElementById("kind-tabs"),
    search: document.getElementById("search"),
    sortBy: document.getElementById("sort-by"),
    onlyTodo: document.getElementById("only-todo"),
    count: document.getElementById("count"),
    list: document.getElementById("list"),
    loading: document.getElementById("loading"),
    empty: document.getElementById("empty"),
    errorBox: document.getElementById("error"),
    errorMsg: document.getElementById("error-msg"),
    retry: document.getElementById("retry"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toast-text"),
    toastUndo: document.getElementById("toast-undo"),
    trashToggle: document.getElementById("trash-toggle"),
    trashList: document.getElementById("trash-list"),
    trashCount: document.getElementById("trash-count")
  };

  let allItems = [];
  let kind = "all";
  let sortBy = "due";
  let keyword = "";
  let onlyTodoOn = false;
  let showDone = false;

  let firstLoad = true;
  let undoItem = null;
  let undoTimer = null;
  let trashItems = [];
  let trashOpen = false;

  /* ---------- 状态 ---------- */
  function setState(state) {
    el.loading.hidden = state !== "loading";
    el.empty.hidden = state !== "empty";
    el.errorBox.hidden = state !== "error";
    el.list.hidden = state === "loading" || state === "empty" || state === "error";
  }

  /* ---------- 底部提示条 ---------- */
  function hideToast() {
    el.toast.hidden = true;
    undoItem = null;
  }

  function showUndo(item) {
    clearTimeout(undoTimer);
    undoItem = item;
    el.toastText.textContent = "已删除「" + item.title + "」";
    el.toast.hidden = false;
    undoTimer = setTimeout(hideToast, 8000);
  }

  el.toastUndo.addEventListener("click", async function () {
    if (!undoItem) return;
    const item = undoItem;

    clearTimeout(undoTimer);
    hideToast();

    try {
      const res = await apiFetch("/items/" + item.id + "/restore", { method: "POST" });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }
      await loadItems();
    } catch (err) {
      window.alert("撤销失败：" + err.message);
    }
  });

  /* ---------- 拉数据 ---------- */
  async function loadItems() {
    if (firstLoad) setState("loading");

    try {
      const res = await apiFetch("/items");
      if (!res.ok) throw new Error("服务器返回状态码 " + res.status);

      const json = await res.json();
      if (json.code !== 0) throw new Error(json.msg || "接口返回失败");

      allItems = json.data || [];
      renderList();
      loadTrash();

      if (firstLoad) {
        firstLoad = false;
        restoreScroll();
      }
    } catch (err) {
      el.errorMsg.textContent = "加载失败：" + err.message + "。请检查网络，或稍后点重试。";
      setState("error");
    }
  }

  /* ---------- 回到列表时恢复滚动位置 ---------- */
  function restoreScroll() {
    try {
      const saved = Number(sessionStorage.getItem("list_scroll") || 0);
      if (saved > 0) window.scrollTo(0, saved);
    } catch (e) {
      // 忽略
    }
  }

  function rememberScroll() {
    try {
      sessionStorage.setItem("list_scroll", String(window.scrollY));
    } catch (e) {
      // 忽略
    }
  }

  /* ---------- 排序 ---------- */
  function sortItems(arr) {
    return arr.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;

      if (sortBy === "priority") {
        const rank = { high: 0, normal: 1, low: 2 };
        const ra = rank[a.priority] === undefined ? 1 : rank[a.priority];
        const rb = rank[b.priority] === undefined ? 1 : rank[b.priority];
        if (ra !== rb) return ra - rb;
      }

      if (sortBy === "title") {
        return String(a.title).localeCompare(String(b.title), "zh");
      }
      if (sortBy === "created") {
        return b.id - a.id;   // 新建的在前
      }
      // 按时间：有时间的在前，没时间的垫底
      const ad = String(a.due || "\uffff");
      const bd = String(b.due || "\uffff");
      if (ad !== bd) return ad < bd ? -1 : 1;
      return a.id - b.id;
    });
  }

  /* ---------- 渲染 ---------- */
  function renderList() {
    const kw = keyword.trim().toLowerCase();
    const nowStr = toDateTimeStr(new Date());

    // tab 计数
    const counts = {
      all: allItems.filter(function (it) { return !it.done; }).length,
      long: allItems.filter(function (it) { return it.kind === "long" && !it.done; }).length,
      short: allItems.filter(function (it) { return it.kind === "short" && !it.done; }).length
    };

    Array.prototype.forEach.call(el.tabs.children, function (btn) {
      const k = btn.dataset.kind;
      btn.classList.toggle("active", k === kind);
      const num = btn.querySelector(".tab-num");
      if (num) num.textContent = counts[k];
    });

    // 搜索时跨类型，不受当前 tab 限制
    const effectiveKind = kw ? "all" : kind;

    const inScope = allItems.filter(function (it) {
      return effectiveKind === "all" || it.kind === effectiveKind;
    });

    const shown = sortItems(inScope.filter(function (it) {
      if (onlyTodoOn && it.done) return false;
      if (!kw) return true;
      const hay = (it.title + " " + (it.note || "")).toLowerCase();
      return hay.indexOf(kw) !== -1;
    }));

    const undone = shown.filter(function (it) { return !it.done; });
    const finished = shown.filter(function (it) { return it.done; });

    el.list.innerHTML = "";

    undone.forEach(function (it) {
      el.list.appendChild(createRow(it, nowStr, kw));
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
          el.list.appendChild(createRow(it, nowStr, kw));
        });
      }
    }

    const scopeUndone = inScope.filter(function (it) { return !it.done; }).length;
    el.count.textContent = inScope.length > 0
      ? "共 " + inScope.length + " 条 · 未完成 " + scopeUndone + " 条" +
        (kw ? "（搜索中，已跨类型）" : "")
      : "";

    if (shown.length === 0) {
      el.empty.textContent = inScope.length === 0
        ? "这里还是空的。上面输入一条试试，或者点「＋ 新建待办」。"
        : "没有符合条件的任务";
      setState("empty");
      return;
    }

    setState("data");
  }

  /* ---------- 一行 ---------- */
  function createRow(it, nowStr, kw) {
    const li = document.createElement("li");
    li.className = "item-row";
    if (it.priority === "high") li.classList.add("pri-high");
    if (it.priority === "low") li.classList.add("pri-low");

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
    a.title = "双击可以直接改标题";
    appendHighlighted(a, it.title, kw);

    a.addEventListener("click", rememberScroll);
    a.addEventListener("dblclick", function (e) {
      e.preventDefault();
      beginInlineEdit(it, a, top);
    });

    top.appendChild(badge);

    if (it.priority === "high" || it.priority === "low") {
      const pri = document.createElement("span");
      pri.className = "pri-chip " + it.priority;
      pri.textContent = it.priority === "high" ? "高" : "低";
      top.appendChild(pri);
    }

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
    toggle.addEventListener("click", function () { toggleDone(it); });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-danger";
    del.textContent = "删除";
    del.addEventListener("click", function () { deleteItem(it); });

    actions.appendChild(toggle);
    actions.appendChild(del);

    li.appendChild(main);
    li.appendChild(actions);
    return li;
  }

  /* ---------- 原地改标题 ---------- */
  function beginInlineEdit(it, titleEl, top) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "inline-edit";
    input.maxLength = 100;
    input.value = it.title;

    top.replaceChild(input, titleEl);
    input.focus();
    input.select();

    let settled = false;

    async function finish(save) {
      if (settled) return;
      settled = true;

      const value = input.value.trim();

      if (!save || !value || value === it.title) {
        renderList();
        return;
      }

      try {
        const res = await apiFetch("/items/" + it.id, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: value })
        });

        const json = await res.json().catch(function () { return {}; });
        if (!res.ok || json.code !== 0) {
          throw new Error(json.msg || ("服务器返回 " + res.status));
        }

        it.title = json.data.title;
      } catch (err) {
        window.alert("改标题失败：" + err.message);
      }

      renderList();
    }

    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); finish(true); }
      if (e.key === "Escape") { e.preventDefault(); finish(false); }
    });

    input.addEventListener("blur", function () { finish(true); });
  }

  /* ---------- 标记完成（先改界面，再同步） ---------- */
  async function toggleDone(it) {
    const previous = it.done;
    it.done = !it.done;
    renderList();

    try {
      const res = await apiFetch("/items/" + it.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: it.done })
      });

      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      Object.assign(it, json.data);
      renderList();
    } catch (err) {
      it.done = previous;
      renderList();
      window.alert("修改失败：" + err.message);
    }
  }

  /* ---------- 删除（不弹确认，可撤销） ---------- */
  async function deleteItem(it) {
    const index = allItems.findIndex(function (x) { return x.id === it.id; });
    if (index === -1) return;

    allItems.splice(index, 1);
    renderList();

    try {
      const res = await apiFetch("/items/" + it.id, { method: "DELETE" });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }
      showUndo(it);
      loadTrash();
    } catch (err) {
      allItems.splice(index, 0, it);
      renderList();
      window.alert("删除失败：" + err.message);
    }
  }

  /* ---------- 快速添加 ---------- */
  el.toggleNote.addEventListener("click", function () {
    const willShow = el.newNote.hidden;
    el.newNote.hidden = !willShow;
    el.toggleNote.textContent = willShow ? "－ 收起说明" : "＋ 说明";
    if (willShow) el.newNote.focus();
  });

  el.form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const title = el.newTitle.value.trim();
    if (!title) {
      el.newTitle.focus();
      return;
    }

    const dueRaw = el.newDue.value;            // "2026-11-20T14:30" 或空
    const isShort = Boolean(dueRaw);
    const due = dueRaw ? dueRaw.replace("T", " ") : "";
    const note = el.newNote.value.trim();

    el.addBtn.disabled = true;
    el.addBtn.textContent = "添加中";

    try {
      const res = await apiFetch("/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title,
          note: note,
          kind: isShort ? "short" : "long",
          due: due
        })
      });

      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }

      allItems.push(json.data);

      el.newTitle.value = "";
      el.newDue.value = "";
      el.newNote.value = "";
      el.newNote.hidden = true;
      el.toggleNote.textContent = "＋ 说明";

      renderList();
      el.newTitle.focus();   // 加完继续保持焦点，可以连着敲
    } catch (err) {
      window.alert("添加失败：" + err.message);
    } finally {
      el.addBtn.disabled = false;
      el.addBtn.textContent = "快速添加";
    }
  });

  /* ---------- 筛选 / 排序 / tab ---------- */
  el.search.addEventListener("input", function (e) {
    keyword = e.target.value;
    renderList();
  });

  el.sortBy.addEventListener("change", function (e) {
    sortBy = e.target.value;
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
    renderList();
  });

  el.retry.addEventListener("click", function () {
    firstLoad = true;
    loadItems();
  });

  /* ---------- 回收站 ---------- */

  async function loadTrash() {
    try {
      const res = await apiFetch("/items?deleted=1");
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) throw new Error(json.msg || "加载失败");
      trashItems = json.data || [];
    } catch (e) {
      trashItems = [];
    }
    renderTrash();
  }

  function daysAgo(str) {
    if (!str) return "";
    const t = Date.parse(String(str).replace(" ", "T"));
    if (isNaN(t)) return "";
    const d = Math.floor((Date.now() - t) / 86400000);
    if (d <= 0) return "今天删除";
    return d + " 天前删除";
  }

  function renderTrash() {
    el.trashCount.textContent = trashItems.length ? "(" + trashItems.length + ")" : "";
    const caret = el.trashToggle.querySelector(".trash-caret");
    if (caret) caret.textContent = trashOpen ? "▾" : "▸";
    el.trashList.hidden = !trashOpen;

    if (!trashOpen) return;

    el.trashList.innerHTML = "";

    if (trashItems.length === 0) {
      const p = document.createElement("p");
      p.className = "trash-empty";
      p.textContent = "没有删除的记录。删掉的东西会在这里留 30 天。";
      el.trashList.appendChild(p);
      return;
    }

    trashItems
      .slice()
      .sort(function (a, b) { return String(b.deletedAt).localeCompare(String(a.deletedAt)); })
      .forEach(function (it) {
        const row = document.createElement("div");
        row.className = "trash-item";

        const title = document.createElement("span");
        title.className = "t-title";
        title.textContent = it.title;

        const when = document.createElement("span");
        when.className = "t-when";
        when.textContent = daysAgo(it.deletedAt);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-ghost";
        btn.textContent = "恢复";
        btn.addEventListener("click", function () { restoreItem(it, btn); });

        row.appendChild(title);
        row.appendChild(when);
        row.appendChild(btn);
        el.trashList.appendChild(row);
      });
  }

  async function restoreItem(it, btn) {
    btn.disabled = true;
    btn.textContent = "恢复中";

    try {
      const res = await apiFetch("/items/" + it.id + "/restore", { method: "POST" });
      const json = await res.json().catch(function () { return {}; });
      if (!res.ok || json.code !== 0) {
        throw new Error(json.msg || ("服务器返回 " + res.status));
      }
      await loadItems();
    } catch (err) {
      window.alert("恢复失败：" + err.message);
      btn.disabled = false;
      btn.textContent = "恢复";
    }
  }

  el.trashToggle.addEventListener("click", function () {
    trashOpen = !trashOpen;
    renderTrash();
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

    // 类型
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
    let curPriority = it.priority || "normal";

    // 优先级
    const priField = document.createElement("div");
    priField.className = "field";
    const priLabel = document.createElement("span");
    priLabel.textContent = "优先级";
    const priWrap = document.createElement("div");
    priWrap.className = "segmented";

    [["high", "高"], ["normal", "中"], ["low", "低"]].forEach(function (pair) {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.priority = pair[0];
      b.textContent = pair[1];
      b.addEventListener("click", function () {
        curPriority = pair[0];
        paintPriority();
      });
      priWrap.appendChild(b);
    });

    priField.appendChild(priLabel);
    priField.appendChild(priWrap);

    function paintPriority() {
      Array.prototype.forEach.call(priWrap.children, function (b) {
        b.classList.toggle("active", b.dataset.priority === curPriority);
      });
    }

    // 标题
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

    // 时间
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

    // 说明 + 字数提示
    const noteField = document.createElement("label");
    noteField.className = "field";
    const noteLabel = document.createElement("span");
    noteLabel.textContent = "说明（可选）";
    const noteInput = document.createElement("textarea");
    noteInput.rows = 4;
    noteInput.maxLength = 500;
    noteInput.value = it.note || "";
    const noteCount = document.createElement("em");
    noteCount.className = "field-hint char-count";
    noteCount.textContent = noteInput.value.length + " / 500";

    noteInput.addEventListener("input", function () {
      noteCount.textContent = noteInput.value.length + " / 500";
    });

    noteField.appendChild(noteLabel);
    noteField.appendChild(noteInput);
    noteField.appendChild(noteCount);

    // 完成
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
    form.appendChild(priField);
    form.appendChild(titleField);
    form.appendChild(dueField);
    form.appendChild(noteField);
    form.appendChild(doneLabel);
    form.appendChild(err);
    form.appendChild(actions);

    optLong.addEventListener("click", function () { curKind = "long"; paintKind(); });
    optShort.addEventListener("click", function () { curKind = "short"; paintKind(); });
    paintKind();
    paintPriority();

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
            due: dueValue,
            priority: curPriority
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
