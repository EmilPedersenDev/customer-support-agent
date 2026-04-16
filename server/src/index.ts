import cors from "cors";
import express from "express";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";

const app = express();
const port = Number(process.env.PORT) || 3000;

const ollamaBase = (
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
).replace(/\/$/, "");
const ollamaModel = process.env.OLLAMA_MODEL ?? "gemma3";

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

app.post("/api/ask", async (req, res) => {
  const question =
    typeof req.body?.question === "string" ? req.body.question : "";

  if (!question.trim()) {
    res.status(400).json({ error: "Missing or invalid `question`" });
    return;
  }

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
        messages: [{ role: "user", content: question }],
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
    await pipeline(
      Readable.fromWeb(ollamaRes.body as WebReadableStream),
      res,
    );
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

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Ollama: ${ollamaBase} (model: ${ollamaModel})`);
});
