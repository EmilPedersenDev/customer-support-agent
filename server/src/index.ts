import cors from "cors";
import express from "express";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

import { ingestMarkdown } from "./ingest/pipeline.ts";

const app = express();
const port = Number(process.env.PORT) || 3000;

const filesToIngest = [
  {
    customerId: 1,
    pageId: 1,
    filePath: path.join(
      import.meta.dirname,
      "..",
      "data",
      "intelligence-analysis.md",
    ),
  },
  {
    customerId: 1,
    pageId: 2,
    filePath: path.join(
      import.meta.dirname,
      "..",
      "data",
      "command-platform.md",
    ),
  },
  {
    customerId: 1,
    pageId: 3,
    filePath: path.join(
      import.meta.dirname,
      "..",
      "data",
      "secure-communication.md",
    ),
  },
  {
    customerId: 1,
    pageId: 4,
    filePath: path.join(
      import.meta.dirname,
      "..",
      "data",
      "drone-operations.md",
    ),
  },
  {
    customerId: 1,
    pageId: 5,
    filePath: path.join(import.meta.dirname, "..", "data", "about.md"),
  },
  {
    customerId: 1,
    pageId: 6,
    filePath: path.join(import.meta.dirname, "..", "data", "surveillance.md"),
  },
];

const ollamaBase = (
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
).replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL ?? "gemma3";

const MAX_MESSAGES = 200;
const MAX_TOTAL_CHARS = 1_000_000;

type ChatRole = "user" | "assistant";

type ChatMessage = { role: ChatRole; content: string };

function parseChatMessages(
  body: unknown,
): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (
    body === null ||
    typeof body !== "object" ||
    !("messages" in body) ||
    !Array.isArray((body as { messages: unknown }).messages)
  ) {
    return { ok: false, error: "Expected JSON body with `messages` array" };
  }

  const raw = (body as { messages: unknown[] }).messages;
  if (raw.length === 0) {
    return { ok: false, error: "`messages` must be non-empty" };
  }
  if (raw.length > MAX_MESSAGES) {
    return { ok: false, error: `Too many messages (max ${MAX_MESSAGES})` };
  }

  const messages: ChatMessage[] = [];
  let totalChars = 0;

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (item === null || typeof item !== "object") {
      return { ok: false, error: `Invalid message at index ${i}` };
    }
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") {
      return {
        ok: false,
        error: `Invalid role at index ${i} (expected user or assistant)`,
      };
    }
    if (typeof content !== "string") {
      return { ok: false, error: `Invalid content at index ${i}` };
    }
    totalChars += content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return { ok: false, error: "Total message length exceeds limit" };
    }
    messages.push({ role, content });
  }

  if (messages[messages.length - 1].role !== "user") {
    return { ok: false, error: "Last message must be from the user" };
  }

  return { ok: true, messages };
}

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  const parsed = parseChatMessages(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { messages } = parsed;

  const controller = new AbortController();
  const abort = () => controller.abort();
  res.on("close", abort);

  let ollamaRes: Response;
  try {
    ollamaRes = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    res.removeListener("close", abort);
    const message =
      e instanceof Error ? e.message : "Failed to reach Ollama. Is it running?";
    res.status(502).json({ error: message });
    return;
  }

  if (!ollamaRes.ok) {
    res.removeListener("close", abort);
    const details = await ollamaRes.text();
    res.status(502).json({
      error: `Ollama returned ${ollamaRes.status}`,
      details,
    });
    return;
  }

  if (!ollamaRes.body) {
    res.removeListener("close", abort);
    res.status(502).json({ error: "Empty body from Ollama" });
    return;
  }

  res.setHeader(
    "Content-Type",
    ollamaRes.headers.get("content-type") ?? "application/x-ndjson",
  );
  res.setHeader("Cache-Control", "no-cache");

  try {
    await pipeline(Readable.fromWeb(ollamaRes.body as WebReadableStream), res);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      // client disconnected
    } else if (!res.headersSent) {
      res.status(502).json({
        error: e instanceof Error ? e.message : "Stream error",
      });
    }
  } finally {
    res.removeListener("close", abort);
  }
});

app.post("/pages", async (req, res) => {
  const customerId = (req.body as { customerId?: unknown })?.customerId;
  if (
    typeof customerId !== "number" ||
    !Number.isInteger(customerId) ||
    customerId <= 0
  ) {
    res.status(400).json({ error: "`customerId` must be a positive integer" });
    return;
  }

  try {
    for (const file of filesToIngest) {
      await ingestMarkdown(file);
    }
    res.sendStatus(200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingestion failed";
    console.error("Ingestion error:", e);
    res.status(500).json({ error: message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Ollama: ${ollamaBase} (model: ${ollamaModel})`);
});
