import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:password@localhost:5433/customer_support";

export const pool = new pg.Pool({ connectionString });
