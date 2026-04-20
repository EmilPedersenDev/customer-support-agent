import { readFile } from "node:fs/promises";

import { pool } from "../db.ts";
import { chunkMarkdownByH2 } from "./chunk.ts";
import { embedBatch } from "./embed.ts";
import { sha256 } from "./hash.ts";
import { normalize } from "./normalize.ts";
import { upsertPage } from "./store.ts";

type IngestInput = { customerId: number; pageId: number; filePath: string };

export type IngestResult = {
  total: number;
  inserted: number;
  updated: number;
};

export async function ingestMarkdown(
  input: IngestInput,
): Promise<IngestResult> {
  const { customerId, pageId, filePath } = input;

  const raw = await readFile(filePath, "utf8");
  const sections = chunkMarkdownByH2(raw);

  const chunks = sections.map(normalize).filter((s) => s.length > 0);

  if (chunks.length === 0) {
    return { total: 0, inserted: 0, updated: 0 };
  }

  const hashes = chunks.map(sha256);
  const embeddings = await embedBatch(chunks);

  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  try {
    await client.query("BEGIN");
    for (let i = 0; i < chunks.length; i++) {
      const result = await upsertPage(client, {
        customerId,
        pageId,
        content: chunks[i],
        contentHash: hashes[i],
        embedding: embeddings[i],
      });
      if (result.inserted) inserted += 1;
      else updated += 1;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  return { total: chunks.length, inserted, updated };
}
