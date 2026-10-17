// src/database/connection.js

import pg from "pg";
import env from "../config/env.js";

const { Pool } = pg;

// =========================================================
// DATABASE CONFIGURATION
// =========================================================

const database = env.database || {};

const rawDatabaseUrl = String(
  database.url ||
  process.env.DATABASE_URL ||
  process.env.DB_URL ||
  ""
).trim();

const isNeon = /\.neon\.tech$/i.test(
  (() => {
    try {
      return new URL(rawDatabaseUrl).hostname;
    } catch {
      return "";
    }
  })()
);

// =========================================================
// NORMALIZE NEON SSL MODE
// =========================================================

function prepareConnectionString(connectionString) {
  if (!connectionString) {
    return "";
  }

  try {
    const parsedUrl = new URL(connectionString);

    if (isNeon) {
      // Explicit certificate and hostname verification.
      // Avoid the legacy sslmode=require warning.
      parsedUrl.searchParams.set(
        "sslmode",
        "verify-full"
      );
    }

    return parsedUrl.toString();
  } catch {
    throw new Error(
      "DATABASE_URL is not a valid PostgreSQL connection URL."
    );
  }
}

const databaseUrl =
  prepareConnectionString(rawDatabaseUrl);

// =========================================================
// BUILD POOL CONFIGURATION
// =========================================================

let poolConfig;

if (databaseUrl) {
  // -------------------------------------------------------
  // PRODUCTION: RENDER + NEON
  // -------------------------------------------------------

  poolConfig = {
    connectionString: databaseUrl,

    max: database.poolMax || 10,

    idleTimeoutMillis:
      database.idleTimeoutMillis || 30000,

    connectionTimeoutMillis:
      database.connectionTimeoutMillis || 15000,

    keepAlive: true,
  };
} else if (database.host) {
  // -------------------------------------------------------
  // DEVELOPMENT: HOST-BASED POSTGRESQL
  // -------------------------------------------------------

  poolConfig = {
    host: database.host,

    port: database.port || 5432,

    database: database.name,

    user: database.user,

    password: database.password,

    ...(database.ssl
      ? {
          ssl: {
            rejectUnauthorized: false,
          },
        }
      : {}),

    max: database.poolMax || 10,

    idleTimeoutMillis:
      database.idleTimeoutMillis || 30000,

    connectionTimeoutMillis:
      database.connectionTimeoutMillis || 15000,

    keepAlive: true,
  };
} else {
  // Keep the backend from silently attempting to connect
  // without valid database configuration.
  throw new Error(
    "[DATABASE] Configuration missing: set DATABASE_URL in Render or DB_HOST for local PostgreSQL."
  );
}

// =========================================================
// CREATE CONNECTION POOL
// =========================================================

const pool = new Pool(poolConfig);

// =========================================================
// POOL EVENTS
// =========================================================

pool.on("connect", () => {
  console.log(
    "[DATABASE] PostgreSQL client connected."
  );
});

pool.on("error", (error) => {
  console.error(
    "[DATABASE] Unexpected pool error:",
    error.message,
    error.code || ""
  );
});

// =========================================================
// VERIFY CONNECTION BEFORE STARTING SERVER
// =========================================================

export async function connectDatabase() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        NOW() AS connected_at
    `);

    console.log(
      "[DATABASE] PostgreSQL connection successful."
    );

    console.log(
      "[DATABASE] Connection source:",
      databaseUrl
        ? "DATABASE_URL (Neon/hosted PostgreSQL)"
        : "Local PostgreSQL host configuration"
    );

    console.log(
      "[DATABASE] Database:",
      result.rows[0].database_name
    );

    return true;
  } catch (error) {
    console.error(
      "[DATABASE] PostgreSQL Connection Failed"
    );

    console.error(
      "[DATABASE] Message:",
      error.message
    );

    console.error(
      "[DATABASE] Code:",
      error.code || "N/A"
    );

    console.error(
      "[DATABASE] Detail:",
      error.detail || "N/A"
    );

    console.error(
      "[DATABASE] Hint:",
      error.hint || "N/A"
    );

    console.error(
      "[DATABASE] DATABASE_URL configured:",
      Boolean(databaseUrl)
    );

    console.error(
      "[DATABASE] Neon detected:",
      isNeon
    );

    // Do not start the application with a failed DB connection.
    throw error;
  }
}

export default pool;