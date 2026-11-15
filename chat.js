/* ============================================================
   chat.js —— 对话页

   要点：
   1. 凭证由 apiFetch 自动带上，Key 在服务器上，前端碰不到
   2. 用 getReader() 边读边显示，实现逐字出现
   3. 「停止生成」= 中断这个 fetch，后端会跟着中断上游
   4. 工具调用会以 { tool: {...} } 事件推送过来，单独显示成一行日志
   ============================================================ */

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");
const statusEl = document.getElementById("chat-status");
let hintEl = document.getElementById("chat-hint");
const turnEl = document.getElementById("turn-count");
const newChatBtn = document.getElementById("new-chat-btn");

const history = [];
let controller = null;
let busy = false;

/* ---------- 小工具 ---------- */

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

function renderToolEvent(reply, tool) {
  let log = reply.wrap.querySelector(".tool-log");

  if (!log) {
    log = document.createElement("div");
    log.className = "tool-log";
    reply.wrap.insertBefore(log, reply.p);
  }

  const line = document.createElement("p");
  line.className = "tool-line";

  if (tool.phase === "start") {
    const hasArgs = tool.args && Object.keys(tool.args).length > 0;
    line.textContent = "调用 " + tool.name + " " + (hasArgs ? JSON.stringify(tool.args) : "（无参数）");
  } else {
    line.textContent = (tool.ok ? "成功 · " : "失败 · ") + tool.summary;
    line.classList.add(tool.ok ? "ok" : "bad");
  }

  log.appendChild(line);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateTurnCount() {
  const turns = history.filter(function (m) { return m.role === "user"; }).length;
  turnEl.textContent = turns > 0 ? "已进行 " + turns + " 轮" : "";
}

function startNewChat() {
  if (busy && controller) controller.abort();

  history.length = 0;
  messagesEl.innerHTML = "";

  hintEl = document.createElement("p");
  hintEl.className = "state";
  hintEl.id = "chat-hint";
  hintEl.textContent = "新的对话。有什么要记的，直接说。";
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
  setStatus("正在想…");

  const reply = addBubble("assistant", "");
  let acc = "";
  let errorMsg = "";

  controller = new AbortController();

  try {
    const res = await apiFetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal
    });

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const json = await res.json().catch(function () { return {}; });
      throw new Error(json.msg || ("服务器返回 " + res.status));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

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
        if (json.tool) {
          renderToolEvent(reply, json.tool);
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

/* ---------- 事件 ---------- */

form.addEventListener("submit", function (e) {
  e.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(input.value);
  }
});

stopBtn.addEventListener("click", function () {
  if (controller) controller.abort();
});

input.addEventListener("input", function () {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});
