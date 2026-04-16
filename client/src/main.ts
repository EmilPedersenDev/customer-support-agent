const form = document.querySelector<HTMLFormElement>("#ask-form");
const questionInput = document.querySelector<HTMLInputElement>("#question");
const statusEl = document.querySelector<HTMLParagraphElement>("#status");
const outputEl = document.querySelector<HTMLPreElement>("#output");

if (!form || !questionInput || !statusEl || !outputEl) {
  throw new Error("Missing required DOM nodes");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "Sending…";
  outputEl.textContent = "";

  const question = questionInput.value.trim();
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });

    const text = await res.text();
    let display = text;
    try {
      display = JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      // Not JSON; show raw text
    }

    if (!res.ok) {
      statusEl.textContent = `Error (${res.status})`;
      outputEl.textContent = display;
      return;
    }

    statusEl.textContent = "Done";
    outputEl.textContent = display;
  } catch (err) {
    statusEl.textContent = "Request failed";
    outputEl.textContent =
      err instanceof Error ? err.message : "Unknown error";
  }
});
