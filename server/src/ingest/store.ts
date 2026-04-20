import type { PoolClient } from "pg";

/** pgvector text literal, e.g. "[0.1,0.2,...]". */
function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

type UpsertPageInput = {
  customerId: number;
  pageId: number;
  content: string;
  contentHash: string;
  embedding: number[];
};

type UpsertPageResult = { id: number; inserted: boolean };

/**
 * Insert a page or update content/embedding on (customer_id, content_hash) conflict.
 * `inserted` is true for new rows, false for updates (via the `xmax = 0` trick).
 */
export async function upsertPage(
  client: PoolClient,
  input: UpsertPageInput,
): Promise<UpsertPageResult> {
  const { rows } = await client.query<{ id: number; inserted: boolean }>(
    `INSERT INTO pages (customer_id, page_id, content, embedding, content_hash)
     VALUES ($1, $2, $3, $4::vector, $5)
     ON CONFLICT (customer_id, content_hash)
     DO UPDATE SET content = EXCLUDED.content,
                   embedding = EXCLUDED.embedding
     RETURNING id, (xmax = 0) AS inserted`,
    [
      input.customerId,
      input.pageId,
      input.content,
      toVectorLiteral(input.embedding),
      input.contentHash,
    ],
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Upsert returned no row");
  }
  return row;
}
