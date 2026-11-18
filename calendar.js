/* ============================================================
   calendar.js —— 日历页

   一个月一个网格，有安排的日期下面有小点：
     未完成 → 深色点
     全部完成 → 灰色点
   点某一天，下面列出那天的全部安排（长期和短期都算）。
   ============================================================ */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function initCalendarPage() {
  const el = {
    title: document.getElementById("cal-title"),
    prev: document.getElementById("cal-prev"),
    next: document.getElementById("cal-next"),
    todayBtn: document.getElementById("cal-today"),
    grid: document.getElementById("cal-grid"),
    dayTitle: document.getElementById("day-title"),
    dayAdd: document.getElementById("day-add"),
    dayList: document.getElementById("day-list"),
    errorBox: document.getElementById("cal-error"),
    errorMsg: document.getElementById("cal-error-msg"),
    retry: document.getElementById("cal-retry")
  };

  let allItems = [];

  const today = new Date();
  let calYear = today.getFullYear();
  let calMonth = today.getMonth();          // 0-11
  let selectedDate = toDateStr(today);

  async function load() {
    el.errorBox.hidden = true;

    try {
      const res = await apiFetch("/items");
      if (!res.ok) throw new Error("服务器返回状态码 " + res.status);

      const json = await res.json();
      if (json.code !== 0) throw new Error(json.msg || "接口返回失败");

      allItems = json.data || [];
      renderCalendar();
      renderDayPanel();
    } catch (err) {
      el.errorMsg.textContent = "加载失败：" + err.message + "。请检查网络，或稍后点重试。";
      el.errorBox.hidden = false;
    }
  }

  /* ---------- 月视图 ---------- */
  function renderCalendar() {
    el.title.textContent = calYear + " 年 " + (calMonth + 1) + " 月";

    const todayStr = toDateStr(new Date());
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // 周一为 0

    // 每天有几条，用来决定打什么点
    const counts = {};
    allItems.forEach(function (it) {
      if (!it.due) return;
      const d = String(it.due).slice(0, 10);
      if (!counts[d]) counts[d] = { total: 0, undone: 0 };
      counts[d].total++;
      if (!it.done) counts[d].undone++;
    });

    el.grid.innerHTML = "";

    ["一", "二", "三", "四", "五", "六", "日"].forEach(function (w) {
      const head = document.createElement("div");
      head.className = "cal-weekday";
      head.textContent = w;
      el.grid.appendChild(head);
    });

    for (let i = 0; i < startOffset; i++) {
      const blank = document.createElement("div");
      blank.className = "cal-cell blank";
      el.grid.appendChild(blank);
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

      el.grid.appendChild(cell);
    }
  }

  /* ---------- 当天的安排 ---------- */
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

  /* ---------- 交互 ---------- */
  el.prev.addEventListener("click", function () {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });

  el.next.addEventListener("click", function () {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });

  el.todayBtn.addEventListener("click", function () {
    const t = new Date();
    calYear = t.getFullYear();
    calMonth = t.getMonth();
    selectedDate = toDateStr(t);
    renderCalendar();
    renderDayPanel();
  });

  el.retry.addEventListener("click", load);

  load();
}

if (document.body.dataset.page === "calendar") {
  initCalendarPage();
}
