/* ============================================================
   new.js —— 新建页

   两种类型，必填项不一样：
     长期：标题必填，截止日期可选
     短期：标题必填，日期 + 时刻必填

   底部有两个按钮：「创建」回清单，「保存并再加一条」留在本页继续。
   ============================================================ */

const form = document.getElementById("new-form");
const kindSeg = document.getElementById("kind-seg");
const kindHint = document.getElementById("kind-hint");
const titleEl = document.getElementById("title");
const dueLabel = document.getElementById("due-label");
const dueInput = document.getElementById("due");
const dueHint = document.getElementById("due-hint");
const noteEl = document.getElementById("note");
const noteCount = document.getElementById("note-count");
const doneEl = document.getElementById("done");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");
const saveMoreBtn = document.getElementById("save-more");

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

  dueInput.value = "";
}

kindSeg.addEventListener("click", function (e) {
  const btn = e.target.closest("[data-kind]");
  if (!btn) return;
  kind = btn.dataset.kind;
  paintKind();
});

/* ---------- 字数提示 ---------- */

function paintNoteCount() {
  noteCount.textContent = noteEl.value.length + " / 500";
}
noteEl.addEventListener("input", paintNoteCount);

/* ---------- 从日历或快速添加带过来的预填 ---------- */

const q = new URLSearchParams(location.search);

if (q.get("kind") === "short") kind = "short";
paintKind();
paintNoteCount();

if (q.get("title")) titleEl.value = q.get("title");

if (q.get("date")) {
  dueInput.value = kind === "short" ? q.get("date") + "T09:00" : q.get("date");
}

/* ---------- 创建 ---------- */

async function create(keepGoing) {
  errorEl.hidden = true;

  const title = titleEl.value.trim();
  const isShort = kind === "short";

  if (!title) {
    errorEl.textContent = "标题不能为空";
    errorEl.hidden = false;
    titleEl.focus();
    return;
  }

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
  saveMoreBtn.disabled = true;
  const originalText = submitBtn.textContent;
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

    if (keepGoing) {
      // 留在本页，清空内容继续写
      titleEl.value = "";
      noteEl.value = "";
      doneEl.checked = false;
      dueInput.value = "";
      paintNoteCount();
      titleEl.focus();
      submitBtn.textContent = originalText;
    } else {
      location.replace("index.html");
    }
  } catch (err) {
    errorEl.textContent = "创建失败：" + err.message;
    errorEl.hidden = false;
    submitBtn.textContent = originalText;
  } finally {
    submitBtn.disabled = false;
    saveMoreBtn.disabled = false;
  }
}

form.addEventListener("submit", function (e) {
  e.preventDefault();
  create(false);
});

saveMoreBtn.addEventListener("click", function () {
  create(true);
});

titleEl.focus();
