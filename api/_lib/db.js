import { createPool } from "@vercel/postgres";

let pool;

const getConnectionString = () => {
  return process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
};

const isPooledConnectionString = (value) => {
  return value.includes("-pooler.");
};

const getPool = () => {
  if (pool) {
    return pool;
  }

  const connectionString = getConnectionString();

  if (!connectionString) {
    throw new Error("Database not configured");
  }

  if (!isPooledConnectionString(connectionString)) {
    throw new Error("Database connection must use pooler");
  }

  pool = createPool({ connectionString });
  return pool;
};

export const sql = async (strings, ...values) => {
  const db = getPool();
  return db.sql(strings, ...values);
};
