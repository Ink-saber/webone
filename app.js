/* ============================================================
   app.js —— 清单页（日历 + 长期/短期两类列表）与详情页

   任务分两类：
     long  长期任务：没有具体时刻，截止日期可选
     short 短期任务：必须在某个日期和时间完成

   当天有安排的任务（两类都算）会在日历对应日期上打点，
   点某一天，下方列出那天的全部安排。
   ============================================================ */

/* ---------- 日期小工具 ---------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function toDateTimeStr(d) {
  return toDateStr(d) + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// "2026-11-20 14:30" → "11-20 14:30"；"2026-11-20" → "11-20"
function shortDue(due) {
  if (!due) return "";
  if (due.length > 10) return due.slice(5);
  return due.slice(5);
}

/* ============================================================
   一、清单页
   ============================================================ */
function initListPage() {

  const el = {
    // 日历
    calTitle: document.getElementById("cal-title"),
    calPrev: document.getElementById("cal-prev"),
    calNext: document.getElementById("cal-next"),
    calGrid: document.getElementById("cal-grid"),
    dayTitle: document.getElementById("day-title"),
    dayAdd: document.getElementById("day-add"),
    dayList: document.getElementById("day-list"),
    // 列表
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

  const today = new Date();
  let calYear = today.getFullYear();
  let calMonth = today.getMonth();          // 0-11
  let selectedDate = toDateStr(today);

  /* ---------- 状态显示 ---------- */
  function setState(state) {
    el.loading.hidden = state !== "loading";
    el.empty.hidden = state !== "empty";
    el.errorBox.hidden = state !== "error";
    el.list.hidden = state === "loading" || state === "empty" || state === "error";
  }

  /* ---------- 拉数据 ---------- */
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
      renderAll();
    } catch (err) {
      el.errorMsg.textContent = "加载失败：" + err.message + "。请检查网络，或稍后点重试。";
      setState("error");
    }
  }

  function renderAll() {
    renderCalendar();
    renderDayPanel();
    renderList();
  }

  /* ============================================================
     日历
     ============================================================ */
  function renderCalendar() {
    el.calTitle.textContent = calYear + " 年 " + (calMonth + 1) + " 月";

    const todayStr = toDateStr(new Date());
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // 周一为 0

    // 每一天有几条安排
    const counts = {};
    allItems.forEach(function (it) {
      if (!it.due) return;
      const d = String(it.due).slice(0, 10);
      if (!counts[d]) counts[d] = { total: 0, undone: 0 };
      counts[d].total++;
      if (!it.done) counts[d].undone++;
    });

    el.calGrid.innerHTML = "";

    ["一", "二", "三", "四", "五", "六", "日"].forEach(function (w) {
      const head = document.createElement("div");
      head.className = "cal-weekday";
      head.textContent = w;
      el.calGrid.appendChild(head);
    });

    for (let i = 0; i < startOffset; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell blank";
      el.calGrid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const ds = calYear + "-" + pad2(calMonth + 1) + "-" + pad2(day);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cal-cell";
      cell.textContent = String(day);

      if (ds === todayStr) cell.classList.add("today");
      if (ds === selectedDate) cell.classList.add("selected");
      if (counts[ds]) {
        cell.classList.add("has-task");
        const dot = document.createElement("span");
        dot.className = "cal-dot" + (counts[ds].undone === 0 ? " all-done" : "");
        cell.appendChild(dot);
      }

      cell.addEventListener("click", function () {
        selectedDate = ds;
        renderCalendar();
        renderDayPanel();
      });

      el.calGrid.appendChild(cell);
    }
  }

  function renderDayPanel() {
    const d = new Date(selectedDate + "T00:00:00");
    const week = "日一二三四五六"[d.getDay()];
    const isToday = selectedDate === toDateStr(new Date());

    el.dayTitle.textContent =
      (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · 周" + week +
      (isToday ? " · 今天" : "");

    el.dayAdd.href = "new.html?kind=short&date=" + selectedDate;

    const items = allItems
      .filter(function (it) {
        return it.due && String(it.due).slice(0, 10) === selectedDate;
      })
      .sort(function (a, b) {
        return String(a.due).localeCompare(String(b.due));
      });

    el.dayList.innerHTML = "";

    if (items.length === 0) {
      const p = document.createElement("p");
      p.className = "day-empty";
      p.textContent = "这天没有安排";
      el.dayList.appendChild(p);
      return;
    }

    items.forEach(function (it) {
      const row = document.createElement("a");
      row.className = "day-item" + (it.done ? " is-done" : "");
      row.href = "detail.html?id=" + it.id;

      const time = document.createElement("span");
      time.className = "day-time";
      time.textContent = (it.kind === "short" && it.due.length > 10)
        ? it.due.slice(11)
        : "全天";

      const title = document.createElement("span");
      title.className = "day-title";
      title.textContent = it.title;

      const badge = document.createElement("span");
      badge.className = "badge " + (it.kind === "short" ? "short" : "long");
      badge.textContent = it.kind === "short" ? "短期" : "长期";

      row.appendChild(time);
      row.appendChild(title);
      row.appendChild(badge);
      el.dayList.appendChild(row);
    });
  }

  el.calPrev.addEventListener("click", function () {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  el.calNext.addEventListener("click", function () {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  /* ============================================================
     列表
     ============================================================ */
  function renderList() {
    const kw = keyword.trim().toLowerCase();
    const nowStr = toDateTimeStr(new Date());

    // 先把 tab 上的数字更新掉
    const longCount = allItems.filter(function (it) { return it.kind === "long" && !it.done; }).length;
    const shortCount = allItems.filter(function (it) { return it.kind === "short" && !it.done; }).length;

    Array.prototype.forEach.call(el.tabs.children, function (btn) {
      const k = btn.dataset.kind;
      btn.classList.toggle("active", k === kind);
      const label = btn.querySelector(".tab-label");
      const num = btn.querySelector(".tab-num");
      if (label && num) num.textContent = k === "long" ? longCount : shortCount;
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
        // 有时间的按时间排，没时间的放后面
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
      ? "共 " + inTab.length + " 条 · 未完成 " + inTab.filter(function (it) { return !it.done; }).length + " 条"
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

      // 未完成且时间已过 → 标成逾期
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

  /* ---------- 增删改 ---------- */

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

  /* ---------- 快速添加 ---------- */

  el.form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const title = el.newTitle.value.trim();
    if (!title) {
      window.alert("先写点什么再提交");
      return;
    }

    // 当前在「短期」tab 时，快速添加没法确定时间，直接带着标题去完整表单
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

  /* ---------- 筛选与 tab ---------- */

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

  // 输入框提示跟着 tab 变
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

  /* ---------- 编辑 ---------- */
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
    optLong.dataset.kind = "long";

    const optShort = document.createElement("button");
    optShort.type = "button";
    optShort.textContent = "短期任务";
    optShort.dataset.kind = "short";

    kindWrap.appendChild(optLong);
    kindWrap.appendChild(optShort);
    kindField.appendChild(kindLabel);
    kindField.appendChild(kindWrap);

    let curKind = it.kind;

    function paintKind() {
      optLong.classList.toggle("active", curKind === "long");
      optShort.classList.toggle("active", curKind === "short");
      dueField.style.display = "block";
      dueLabel.textContent = curKind === "short" ? "提醒时间（必填）" : "截止日期（可选）";
      dueInput.type = curKind === "short" ? "datetime-local" : "date";
      dueInput.required = curKind === "short";
      dueHint.textContent = curKind === "short"
        ? "到点提醒你要做这件事"
        : "不填表示没有截止日期";
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

    // 说明
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
