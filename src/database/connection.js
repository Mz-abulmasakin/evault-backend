import pkg from "pg";
import env from "../config/env.js";

const { Pool } = pkg;

const pool = new Pool({
  host: env.database.host,
  port: env.database.port,
  database: env.database.name,
  user: env.database.user,
  password: env.database.password,
});

export async function connectDatabase() {
  try {
    await pool.query("SELECT NOW()");
    console.log("✅ PostgreSQL Connected");
  } catch (error) {
    console.error("❌ PostgreSQL Connection Failed");
    console.error(error.message);
    process.exit(1);
  }
}

export default pool;