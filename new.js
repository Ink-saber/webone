/* ============================================================
   new.js —— 新建页

   两种类型，必填项不一样：
     长期：标题必填，截止日期可选
     短期：标题必填，日期 + 时刻必填
   ============================================================ */

const form = document.getElementById("new-form");
const kindSeg = document.getElementById("kind-seg");
const kindHint = document.getElementById("kind-hint");
const titleEl = document.getElementById("title");
const dueField = document.getElementById("due-field");
const dueLabel = document.getElementById("due-label");
const dueInput = document.getElementById("due");
const dueHint = document.getElementById("due-hint");
const noteEl = document.getElementById("note");
const doneEl = document.getElementById("done");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

let kind = "long";

function paintKind() {
  Array.prototype.forEach.call(kindSeg.children, function (btn) {
    btn.classList.toggle("active", btn.dataset.kind === kind);
  });

  const isShort = kind === "short";

  dueLabel.textContent = isShort ? "提醒时间（必填）" : "截止日期（可选）";
  dueInput.type = isShort ? "datetime-local" : "date";
  dueInput.required = isShort;

  dueHint.textContent = isShort
    ? "到点提醒你要做这件事，两者都要填"
    : "不填表示没有截止日期，可以无限期";

  kindHint.textContent = isShort
    ? "有明确时刻要做的事，比如「周五 14:30 开会」"
    : "没有固定时刻，可以慢慢做，也可以设个截止日期";

  // 换类型时清掉旧值，避免「日期」和「日期+时刻」格式打架
  dueInput.value = "";
}

kindSeg.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-kind]");
  if (!btn) return;
  kind = btn.dataset.kind;
  paintKind();
});

/* ---------- 从日历或快速添加带过来的预填 ---------- */

const q = new URLSearchParams(location.search);

if (q.get("kind") === "short") kind = "short";
paintKind();

if (q.get("title")) {
  titleEl.value = q.get("title");
}

if (q.get("date")) {
  if (kind === "short") {
    dueInput.value = q.get("date") + "T09:00";
  } else {
    dueInput.value = q.get("date");
  }
}

/* ---------- 提交 ---------- */

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  errorEl.hidden = true;

  const title = titleEl.value.trim();
  const isShort = kind === "short";

  if (!title) {
    errorEl.textContent = "标题不能为空";
    errorEl.hidden = false;
    titleEl.focus();
    return;
  }

  // datetime-local 给的是 2026-11-20T14:30，后端要 2026-11-20 14:30
  const due = dueInput.value
    ? (isShort ? dueInput.value.replace("T", " ") : dueInput.value)
    : "";

  if (isShort && !due) {
    errorEl.textContent = "短期任务必须设置日期和时间";
    errorEl.hidden = false;
    dueInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "创建中…";

  try {
    const res = await apiFetch("/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title,
        note: noteEl.value.trim(),
        done: doneEl.checked,
        kind: kind,
        due: due
      })
    });

    const json = await res.json().catch(function () { return {}; });
    if (!res.ok || json.code !== 0) {
      throw new Error(json.msg || ("服务器返回 " + res.status));
    }

    location.replace("index.html");
  } catch (err) {
    errorEl.textContent = "创建失败：" + err.message;
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "创建";
  }
});

titleEl.focus();
