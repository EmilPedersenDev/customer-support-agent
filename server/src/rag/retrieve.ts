import { pool } from "../db.ts";

type ContextRow = { content: string; distance: number };

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

export async function retrieveContext(
  customerId: number,
  queryEmbedding: number[],
  limit = 5,
): Promise<ContextRow[]> {
  const { rows } = await pool.query<ContextRow>(
    `SELECT content, embedding <-> $2::vector AS distance
     FROM pages
     WHERE customer_id = $1
     ORDER BY distance ASC
     LIMIT $3`,
    [customerId, toVectorLiteral(queryEmbedding), limit],
  );
  return rows;
}
