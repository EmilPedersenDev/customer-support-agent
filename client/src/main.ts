type ChatMessage = { role: "user" | "assistant"; content: string };

const form = document.querySelector<HTMLFormElement>("#ask-form");
const questionInput = document.querySelector<HTMLInputElement>("#question");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const chatLogEl = document.querySelector<HTMLDivElement>("#chat-log");

if (!form || !questionInput || !statusEl || !chatLogEl) {
  throw new Error("Missing required DOM nodes");
}

/** Log container (narrowed after guard). */
const chatLog: HTMLDivElement = chatLogEl;

let messages: ChatMessage[] = [];

/** Remove the empty assistant bubble (last child) after a failed request. User message stays. */
function removeAssistantPlaceholder() {
  chatLog.lastElementChild?.remove();
}

function appendMessageBubble(
  role: "user" | "assistant",
  content: string,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `msg msg-${role}`;
  const roleEl = document.createElement("div");
  roleEl.className = "msg-role";
  roleEl.textContent = role === "user" ? "You" : "Assistant";
  const textEl = document.createElement("div");
  textEl.className = "msg-text";
  textEl.textContent = content;
  wrap.append(roleEl, textEl);
  chatLog.appendChild(wrap);
  chatLog.scrollTop = chatLog.scrollHeight;
  return textEl;
}

/** Ollama /api/chat stream: one JSON object per line (NDJSON). */
function appendOllamaLine(line: string, text: string): string {
  if (!line.trim()) return text;
  let obj: {
    error?: string;
    message?: { content?: string };
    done?: boolean;
  };
  try {
    obj = JSON.parse(line) as typeof obj;
  } catch {
    return text;
  }
  if (typeof obj.error === "string") {
    throw new Error(obj.error);
  }
  const delta = obj.message?.content;
  if (typeof delta === "string" && delta.length > 0) {
    text += delta;
  }
  return text;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = questionInput.value.trim();
  if (!text) return;

  statusEl.textContent = "Streaming…";

  messages = [...messages, { role: "user", content: text }];
  appendMessageBubble("user", text);
  questionInput.value = "";

  const assistantTextEl = appendMessageBubble("assistant", "");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: 1, messages }),
    });

    if (!res.ok) {
      const raw = await res.text();
      let display = raw;
      try {
        display = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        // keep raw
      }
      removeAssistantPlaceholder();
      const short =
        display.length > 400 ? `${display.slice(0, 400)}…` : display;
      statusEl.textContent = `Error (${res.status}): ${short}`;
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      removeAssistantPlaceholder();
      statusEl.textContent = "Error: no response body";
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        try {
          accumulated = appendOllamaLine(line, accumulated);
          assistantTextEl.textContent = accumulated;
          chatLog.scrollTop = chatLog.scrollHeight;
        } catch (err) {
          removeAssistantPlaceholder();
          statusEl.textContent = "Error";
          statusEl.title =
            err instanceof Error ? err.message : "Unknown stream error";
          return;
        }
      }
    }

    if (buffer.trim()) {
      try {
        accumulated = appendOllamaLine(buffer, accumulated);
        assistantTextEl.textContent = accumulated;
      } catch (err) {
        removeAssistantPlaceholder();
        statusEl.textContent = "Error";
        statusEl.title =
          err instanceof Error ? err.message : "Unknown stream error";
        return;
      }
    }

    messages = [...messages, { role: "assistant", content: accumulated }];
    statusEl.textContent = "Done";
    statusEl.title = "";
  } catch (err) {
    removeAssistantPlaceholder();
    statusEl.textContent = "Request failed";
    statusEl.title = err instanceof Error ? err.message : "Unknown error";
  }
});
