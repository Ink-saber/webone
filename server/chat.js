/* ============================================================
   chat.js —— 任务 4 + 任务 5
   任务 4：流式对话
   任务 5：工具调用（让模型真的去读写待办数据）

   工具调用是怎么回事（一句话）：
   模型自己不会动数据库。我们给它两个「按钮」，并告诉它每个按钮是干什么的；
   它判断该按哪个、传什么参数，由我们的服务器真的去执行，再把结果告诉它，
   最后由它用自然语言总结。

   完整链路：
     用户说一句自然话
       → 模型返回 tool_calls（要按哪个按钮、传什么）
       → 服务器执行，真的改了 data.json
       → 结果作为 role:"tool" 的消息回填给模型
       → 模型再输出一段自然语言总结

   为了避免无穷循环，最多连续调工具 3 轮。
   ============================================================ */

const store = require("./store");

const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

const MAX_MESSAGES = 12;
const MAX_TOTAL_CHARS = 4000;
const MAX_TOOL_ROUNDS = 3;

/* ============================================================
   系统提示词
   ============================================================ */
const SYSTEM_PROMPT = [
  "你是一个待办清单应用的助手。",
  "用户会跟你聊他的开发任务和待办事项。",
  "",
  "你有两个工具可以真的操作他的待办清单：",
  "- add_item：新增一条待办",
  "- query_items：查询待办（可以按「是否完成」和「关键字」筛）",
  "",
  "什么时候用工具：",
  "- 他说「帮我记一条」「加个待办」「把这个写进去」→ 用 add_item，标题照他的话说，不要自己编",
  "- 他问「我还有哪些任务」「有几条没做完」「有没有关于部署的」→ 用 query_items",
  "- 只是闲聊或问方法（比如「怎么做部署」）→ 不要用工具，直接回答",
  "",
  "用工具之后的回答要求：",
  "1. 先说结果，用一两句话说清楚你做了什么、查到了什么。",
  "2. 查到多条时用列表，每条一行，带上「已完成/待办」状态。",
  "3. 没查到就说没查到，不要编。",
  "",
  "其他要求：用简体中文，简洁直接，不啰嗦。不确定的事直接说不知道。"
].join("\n");

/* ============================================================
   工具定义：告诉模型「有哪些按钮、每个按钮要什么参数」
   description 写得越具体，模型越不容易用错——这是调优的关键
   ============================================================ */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "add_item",
      description:
        "往用户的待办清单里新增一条待办。当用户明确要求记录某事时调用，" +
        "例如「帮我记一条」「加个待办」「把这个任务记下来」。标题用用户的原话，不要改写。",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "待办标题，一句话，最多 100 个字。用用户的原话，不要编造。"
          },
          note: {
            type: "string",
            description: "补充说明，可选，最多 500 个字。"
          }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_items",
      description:
        "查询用户的待办清单，返回符合条件的所有条目。" +
        "当用户询问自己的任务情况时调用，例如「我还有哪些任务」「有几条没做完」「有没有关于部署的待办」。",
      parameters: {
        type: "object",
        properties: {
          done: {
            type: "boolean",
            description: "true 表示只查已完成的，false 表示只查未完成的，不传表示全部。"
          },
          keyword: {
            type: "string",
            description: "按标题里的关键字筛选，可选。"
          }
        },
        required: []
      }
    }
  }
];

/* ============================================================
   执行工具：模型只负责「决定」，真正干活的是这里
   返回给模型的内容必须是它看得懂的文字（JSON 字符串）
   ============================================================ */
function runTool(name, args, userId) {
  if (name === "add_item") {
    const title = typeof args.title === "string" ? args.title.trim() : "";
    if (!title) {
      return { ok: false, error: "title 不能为空，请先向用户确认要记什么" };
    }
    if (title.length > 100) {
      return { ok: false, error: "title 超过 100 个字，请精简后再调用" };
    }

    const item = store.create(userId, {
      title: title,
      note: typeof args.note === "string" ? args.note : "",
      done: false
    });

    return {
      ok: true,
      data: item,
      summary: "已新增第 " + item.id + " 条：" + item.title
    };
  }

  if (name === "query_items") {
    const opts = {};
    if (typeof args.done === "boolean") opts.done = args.done;
    if (typeof args.keyword === "string" && args.keyword.trim()) {
      opts.q = args.keyword.trim();
    }

    const rows = store.list(userId, opts);

    return {
      ok: true,
      data: {
        总数: rows.length,
        条目: rows.map(function (r) {
          return { 编号: r.id, 标题: r.title, 状态: r.done ? "已完成" : "待办" };
        })
      },
      summary: "查到 " + rows.length + " 条"
    };
  }

  return { ok: false, error: "没有叫 " + name + " 的工具" };
}

/* ---------- 历史裁剪 ---------- */
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

  let result = cleaned.slice(-MAX_MESSAGES);

  let total = result.reduce(function (sum, m) { return sum + m.content.length; }, 0);
  while (total > MAX_TOTAL_CHARS && result.length > 1) {
    const dropped = result.shift();
    total -= dropped.content.length;
  }

  return result;
}

/* ---------- 把上游错误翻成人话 ---------- */
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
  if (status >= 500) return "模型服务出错了（" + status + "），稍后再试。";
  if (status === 400) return "请求格式有问题（400）：" + String(detail).slice(0, 200);
  return "模型接口返回 " + status + "：" + String(detail).slice(0, 200);
}

/* ============================================================
   调一次模型（流式），把文字边收边交给 onText，
   同时把 tool_calls 拼完整返回。
   ============================================================ */
async function callModel(messages, tools, onText, signal) {
  const payload = {
    model: MODEL,
    messages: messages,
    stream: true,
    temperature: 0.7
  };

  if (tools) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

  const upstream = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.DEEPSEEK_API_KEY
    },
    body: JSON.stringify(payload),
    signal: signal
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(function () { return ""; });
    return { error: readableError(upstream.status, detail), text: "", toolCalls: [] };
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let text = "";
  const toolCalls = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      let json;
      try {
        json = JSON.parse(data);
      } catch (e) {
        continue;
      }

      const choice = json.choices && json.choices[0];
      if (!choice) continue;

      const delta = choice.delta || {};

      if (delta.content) {
        text += delta.content;
        onText(delta.content);
      }

      // tool_calls 是分片到达的，要按 index 拼起来
      if (delta.tool_calls) {
        for (const piece of delta.tool_calls) {
          const idx = typeof piece.index === "number" ? piece.index : 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
          }
          if (piece.id) toolCalls[idx].id = piece.id;
          if (piece.function && piece.function.name) {
            toolCalls[idx].function.name += piece.function.name;
          }
          if (piece.function && piece.function.arguments) {
            toolCalls[idx].function.arguments += piece.function.arguments;
          }
        }
      }
    }
  }

  return { text: text, toolCalls: toolCalls.filter(Boolean) };
}

/* ============================================================
   注册路由
   ============================================================ */
function register(app, fail, requireAuth) {
  app.post("/api/chat", requireAuth, async function (req, res) {
    if (!process.env.DEEPSEEK_API_KEY) {
      return fail(
        res, 500, 5001,
        "服务器还没有配置 DEEPSEEK_API_KEY。本地请在 server/.env 里加一行；线上请在平台的 Environment Variables 里加。"
      );
    }

    const body = req.body || {};
    const history = trimHistory(Array.isArray(body.messages) ? body.messages : []);

    if (history.length === 0) {
      return fail(res, 400, 4001, "messages 不能为空，至少要有一条 user 消息");
    }

    /* ---------- 切 SSE ---------- */
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (res.socket) res.socket.setNoDelay(true);

    let lastWriteAt = Date.now();

    const send = function (obj) {
      lastWriteAt = Date.now();
      res.write("data: " + JSON.stringify(obj) + "\n\n");
    };

    // 心跳：防止云平台代理攒包，表现成「卡一下、哗啦一大片」
    const heartbeat = setInterval(function () {
      if (Date.now() - lastWriteAt > 200) {
        lastWriteAt = Date.now();
        res.write(": ping\n\n");
      }
    }, 200);

    const controller = new AbortController();
    res.on("close", function () {
      if (!res.writableEnded) controller.abort();
    });

    try {
      // 对话上下文，会随着工具调用不断追加
      const conversation = [{ role: "system", content: SYSTEM_PROMPT }].concat(history);

      let rounds = 0;

      while (rounds <= MAX_TOOL_ROUNDS) {
        const result = await callModel(
          conversation,
          TOOLS,
          function (chunk) { send({ text: chunk }); },
          controller.signal
        );

        if (result.error) {
          send({ error: result.error });
          break;
        }

        // 没有要调工具 → 回答已经边收边发完了，结束
        if (result.toolCalls.length === 0) break;

        // 要把模型「要求调工具」这件事记进对话，否则下一轮它不知道
        conversation.push({
          role: "assistant",
          content: result.text || null,
          tool_calls: result.toolCalls
        });

        // ---------- 真的执行 ----------
        for (const call of result.toolCalls) {
          const name = call.function.name;

          let args = {};
          try {
            args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          } catch (e) {
            // 模型偶尔会给出坏 JSON，如实回填让它自己纠正
            args = null;
          }

          send({ tool: { phase: "start", name: name, args: args } });

          let outcome;
          if (args === null) {
            outcome = { ok: false, error: "参数不是合法 JSON，请重新按 schema 生成" };
          } else {
            outcome = runTool(name, args, req.userId);
          }

          send({
            tool: {
              phase: "end",
              name: name,
              ok: outcome.ok,
              summary: outcome.ok ? outcome.summary : outcome.error
            }
          });

          // 结果以 role:"tool" 回填
          conversation.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(
              outcome.ok ? { 成功: true, 结果: outcome.data } : { 成功: false, 原因: outcome.error }
            )
          });
        }

        rounds++;

        if (rounds > MAX_TOOL_ROUNDS) {
          send({ text: "\n（工具调用次数超过上限，先停在这里）" });
          break;
        }
      }

      send({ done: true });
      res.end();
    } catch (err) {
      if (err.name === "AbortError") {
        res.end();
        return;
      }
      send({ error: "连接模型服务失败：" + err.message });
      send({ done: true });
      res.end();
    } finally {
      clearInterval(heartbeat);
    }
  });
}

module.exports = { register, SYSTEM_PROMPT, trimHistory, TOOLS, runTool };
