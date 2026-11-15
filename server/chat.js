/* ============================================================
   chat.js —— 任务 4：和大模型对话（流式）

   前端只发「用户说过的话」，不接触 Key。
   Key 从服务器环境变量 DEEPSEEK_API_KEY 读，永远不会出现在网页里。

   流程：
     浏览器 ──POST /api/chat──▶ 本服务 ──▶ DeepSeek 接口（stream: true）
                                    ◀── 一段一段文字 ──┘
     本服务把每一小段用 SSE 推回浏览器，浏览器边收边显示
   ============================================================ */

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

// 最多保留最近几条消息（太多会很贵，也会超上下文）
const MAX_MESSAGES = 12;
// 所有消息加起来的字符上限，超了从最早的开始丢
const MAX_TOTAL_CHARS = 4000;

/* ============================================================
   系统提示词：给模型立的规矩
   - 说清它是谁
   - 说清能做什么、不能做什么
   - 说清回答风格
   ============================================================ */
const SYSTEM_PROMPT = [
  "你是一个待办清单应用的助手。",
  "用户会跟你聊他的开发任务和待办事项。",
  "",
  "回答要求：",
  "1. 用简体中文，简洁直接，一般不超过三句话。",
  "2. 不要编造用户的数据。你看不到他的待办列表，除非他告诉你。",
  "3. 他问怎么做某件事时，给具体可执行的步骤，不要只讲道理。",
  "4. 不确定的事情直接说不知道，不要瞎猜。"
].join("\n");

/* ---------- 把历史记录裁到允许的长度 ---------- */
function trimHistory(rawMessages) {
  const cleaned = [];

  for (const m of rawMessages) {
    if (!m || typeof m !== "object") continue;
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content !== "string") continue;

    const content = m.content.trim();
    if (!content) continue;

    cleaned.push({ role: m.role, content: content });
  }

  // 先按条数截断：只留最后 MAX_MESSAGES 条
  let result = cleaned.slice(-MAX_MESSAGES);

  // 再按总字数截断：从最早的一条开始丢，直到不超限
  let total = result.reduce((sum, m) => sum + m.content.length, 0);
  while (total > MAX_TOTAL_CHARS && result.length > 1) {
    const dropped = result.shift();
    total -= dropped.content.length;
  }

  return result;
}

/* ---------- 把上游的错误翻成人话 ---------- */
function readableError(status, detail) {
  switch (status) {
    case 401:
      return "API Key 无效或已过期（401）。请检查服务器上的 DEEPSEEK_API_KEY。";
    case 402:
      return "账户余额不足（402），请到模型平台充值后再试。";
    case 429:
      return "请求太频繁，被限流了（429）。等几秒再试。";
    case 503:
      return "模型服务暂时不可用（503），稍后再试。";
  }
  if (status >= 500) {
    return "模型服务出错了（" + status + "），稍后再试。";
  }
  if (status === 400) {
    return "请求格式有问题（400）：" + String(detail).slice(0, 200);
  }
  return "模型接口返回 " + status + "：" + String(detail).slice(0, 200);
}

/* ============================================================
   注册路由
   ============================================================ */
function register(app, fail) {
  app.post("/api/chat", async function (req, res) {
    const key = process.env.DEEPSEEK_API_KEY;

    // 没配 Key 就直接告诉用户，别让它变成看不懂的 500
    if (!key) {
      return fail(
        res, 500, 5001,
        "服务器还没有配置 DEEPSEEK_API_KEY。本地请在 server/.env 里加一行；线上请在平台的 Environment Variables 里加。"
      );
    }

    const body = req.body || {};
    const messages = trimHistory(Array.isArray(body.messages) ? body.messages : []);

    if (messages.length === 0) {
      return fail(res, 400, 4001, "messages 不能为空，至少要有一条 user 消息");
    }

    // ---------- 切到 SSE，开始往浏览器推 ----------
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");   // 让代理不要攒着不发
    res.flushHeaders();

    const send = function (obj) {
      res.write("data: " + JSON.stringify(obj) + "\n\n");
    };

    // 用户点「停止生成」时，浏览器会断开连接，我们把上游请求也中断
    const controller = new AbortController();
    req.on("close", function () {
      controller.abort();
    });

    try {
      const upstream = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + key
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "system", content: SYSTEM_PROMPT }].concat(messages),
          stream: true,
          temperature: 0.7
        }),
        signal: controller.signal
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(function () { return ""; });
        send({ error: readableError(upstream.status, detail) });
        send({ done: true });
        res.end();
        return;
      }

      // ---------- 读上游的流，一段一段转给前端 ----------
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE 是一行一行的，最后一段可能不完整，先留在 buffer 里
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;

          try {
            const json = JSON.parse(payload);
            const delta = json.choices && json.choices[0] &&
                          json.choices[0].delta && json.choices[0].delta.content;
            if (delta) send({ text: delta });
          } catch (e) {
            // 上游偶尔会发半截 JSON，忽略即可
          }
        }
      }

      send({ done: true });
      res.end();
    } catch (err) {
      if (err.name === "AbortError") {
        // 用户主动停止，正常结束
        res.end();
        return;
      }
      send({ error: "连接模型服务失败：" + err.message });
      send({ done: true });
      res.end();
    }
  });
}

module.exports = { register, SYSTEM_PROMPT, trimHistory };
