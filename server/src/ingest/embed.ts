const EMBEDDING_DIMS = 768;

const ollamaBase = (
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
).replace(/\/$/, "");

const embeddingModel =
  process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text-v2-moe";

/** Batch-embed inputs via Ollama `/api/embed`. Returns one 768-dim vector per input. */
export async function embedBatch(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const res = await fetch(`${ollamaBase}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: embeddingModel, input: inputs }),
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Ollama embed ${res.status}: ${details.slice(0, 500)}`);
  }

  const data = (await res.json()) as { embeddings?: unknown };
  if (!Array.isArray(data.embeddings) || data.embeddings.length !== inputs.length) {
    throw new Error(
      `Ollama embed returned ${
        Array.isArray(data.embeddings) ? data.embeddings.length : "no"
      } embeddings for ${inputs.length} inputs`,
    );
  }

  return data.embeddings.map((vec, i) => {
    if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIMS) {
      throw new Error(
        `Embedding at index ${i} has ${
          Array.isArray(vec) ? vec.length : "non-array"
        } dims, expected ${EMBEDDING_DIMS}`,
      );
    }
    for (const n of vec) {
      if (typeof n !== "number" || !Number.isFinite(n)) {
        throw new Error(`Embedding at index ${i} contains non-finite value`);
      }
    }
    return vec as number[];
  });
}
