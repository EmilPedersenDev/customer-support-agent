const form = document.querySelector<HTMLFormElement>("#ask-form");
const questionInput = document.querySelector<HTMLInputElement>("#question");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const outputEl = document.querySelector<HTMLPreElement>("#output");

if (!form || !questionInput || !statusEl || !outputEl) {
  throw new Error("Missing required DOM nodes");
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
  statusEl.textContent = "Streaming…";
  outputEl.textContent = "";

  const question = questionInput.value.trim();
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      const raw = await res.text();
      let display = raw;
      try {
        display = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        // keep raw
      }
      statusEl.textContent = `Error (${res.status})`;
      outputEl.textContent = display;
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      statusEl.textContent = "Error";
      outputEl.textContent = "No response body";
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
          outputEl.textContent = accumulated;
        } catch (err) {
          statusEl.textContent = "Error";
          outputEl.textContent =
            accumulated +
            (accumulated ? "\n\n" : "") +
            (err instanceof Error ? err.message : "Unknown error");
          return;
        }
      }
    }

    if (buffer.trim()) {
      try {
        accumulated = appendOllamaLine(buffer, accumulated);
        outputEl.textContent = accumulated;
      } catch (err) {
        statusEl.textContent = "Error";
        outputEl.textContent =
          accumulated +
          (accumulated ? "\n\n" : "") +
          (err instanceof Error ? err.message : "Unknown error");
        return;
      }
    }

    statusEl.textContent = "Done";
  } catch (err) {
    statusEl.textContent = "Request failed";
    outputEl.textContent =
      err instanceof Error ? err.message : "Unknown error";
  }
});
