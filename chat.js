/* ============================================================
   chat.js —— 任务 4：流式对话页

   关键点：
   1. API Key 不在这里，也不在任何前端文件里。前端只发「对话内容」，
      由后端替我们去调模型。
   2. 用 fetch 读到的是「一段一段来的字节流」，不是一次性返回的 JSON，
      所以要用 getReader() 边读边显示。
   3. 「停止生成」= 中断这个 fetch，后端会发现连接断了，进而中断上游请求。
   ============================================================ */

const API = CONFIG.API_BASE;

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");
const statusEl = document.getElementById("chat-status");
let hintEl = document.getElementById("chat-hint");
const turnEl = document.getElementById("turn-count");
const newChatBtn = document.getElementById("new-chat-btn");

// 浏览器这边保存的对话历史，每轮把完整历史发给后端（后端会裁剪长度）
const history = [];

let controller = null;
let busy = false;

/* ---------- 界面小工具 ---------- */

function setStatus(text) {
  statusEl.textContent = text || "";
}

function setBusy(flag) {
  busy = flag;
  sendBtn.disabled = flag;
  stopBtn.hidden = !flag;
}

function addBubble(role, text) {
  if (hintEl && hintEl.parentNode) hintEl.remove();

  const wrap = document.createElement("div");
  wrap.className = "bubble " + role;

  const p = document.createElement("p");
  p.textContent = text || "";
  wrap.appendChild(p);

  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  return { wrap, p };
}

/* ---------- 轮数与新对话 ---------- */

function updateTurnCount() {
  const turns = history.filter(function (m) { return m.role === "user"; }).length;
  turnEl.textContent = turns > 0 ? "已进行 " + turns + " 轮" : "";
}

function startNewChat() {
  // 如果正在生成，先停掉
  if (busy && controller) controller.abort();

  // 清空浏览器这边的历史，下一句话就是全新的开始
  history.length = 0;
  messagesEl.innerHTML = "";

  hintEl = document.createElement("p");
  hintEl.className = "state";
  hintEl.id = "chat-hint";
  hintEl.textContent = "新的对话。之前的内容已清空。";
  messagesEl.appendChild(hintEl);

  setStatus("");
  updateTurnCount();
}

newChatBtn.addEventListener("click", startNewChat);


/* ---------- 发一条消息 ---------- */

async function sendMessage(text) {
  const content = text.trim();
  if (!content || busy) return;

  history.push({ role: "user", content: content });
  addBubble("user", content);

  input.value = "";
  input.style.height = "";

  setBusy(true);
  setStatus("正在生成…");

  const reply = addBubble("assistant", "");
  let acc = "";
  let errorMsg = "";

  controller = new AbortController();

  try {
    const res = await fetch(API + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal
    });

    // 如果后端没走 SSE（比如没配 Key、参数错），它返回的是普通 JSON
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const json = await res.json().catch(function () { return {}; });
      throw new Error(json.msg || ("服务器返回 " + res.status));
    }

    // ---------- 边收边显示 ----------
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 一条条消息之间用空行分隔
      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;

        let json;
        try {
          json = JSON.parse(line.slice(5).trim());
        } catch (e) {
          continue;
        }

        if (json.text) {
          acc += json.text;
          reply.p.textContent = acc;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        if (json.error) {
          errorMsg = json.error;
        }
      }
    }

    if (errorMsg) throw new Error(errorMsg);

    if (!acc) {
      reply.p.textContent = "（没有收到内容，可能被中断了）";
    } else {
      history.push({ role: "assistant", content: acc });
    }

    setStatus("");
  } catch (err) {
    if (err.name === "AbortError") {
      // 用户点了「停止生成」：已经收到的部分保留下来，也算一轮对话
      if (acc) {
        history.push({ role: "assistant", content: acc });
        setStatus("已停止生成");
      } else {
        reply.wrap.remove();
        setStatus("已停止");
      }
    } else {
      reply.wrap.classList.add("error");
      reply.p.textContent = "出错了：" + err.message;
      setStatus("请求失败");
    }
  } finally {
    setBusy(false);
    controller = null;
    updateTurnCount();
  }
}

/* ---------- 事件绑定 ---------- */

form.addEventListener("submit", function (e) {
  e.preventDefault();
  sendMessage(input.value);
});

// Enter 发送，Shift + Enter 换行
input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(input.value);
  }
});

stopBtn.addEventListener("click", function () {
  if (controller) controller.abort();
});

// 输入框随内容自动长高
input.addEventListener("input", function () {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});
