import { Pool } from "pg";

let pool: Pool | null = null;

export const getPool = () => {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
};

export const db = {
  query: async (
    text: string,
    params?: Array<string | number | string[] | number[] | null>
  ) => {
    const activePool = getPool();
    if (!activePool) {
      throw new Error("DATABASE_URL is not configured");
    }

    return activePool.query(text, params);
  },
};
