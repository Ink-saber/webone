/* ============================================================
   new.js —— 新建页

   清单页那个输入框只能快速加标题；
   想写说明、想直接标成已完成，就用这个页面。
   ============================================================ */

const form = document.getElementById("new-form");
const titleEl = document.getElementById("title");
const noteEl = document.getElementById("note");
const doneEl = document.getElementById("done");
const errorEl = document.getElementById("form-error");
const submitBtn = document.getElementById("submit-btn");

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  errorEl.hidden = true;

  const title = titleEl.value.trim();
  if (!title) {
    errorEl.textContent = "标题不能为空";
    errorEl.hidden = false;
    titleEl.focus();
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
        done: doneEl.checked
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

// 打开就聚焦到标题，少一次点击
titleEl.focus();
