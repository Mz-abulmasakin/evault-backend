// src/config/database.js

import pg from "pg";
import env from "./env.js";

const { Pool } = pg;

const database = env.database || {};

const databaseUrl = String(database.url || "").trim();

const hasSslMode =
  /[?&]sslmode=/i.test(databaseUrl);

const isNeon =
  /\.neon\.tech(?:[/:?]|$)/i.test(databaseUrl);

// =========================================================
// DATABASE CONFIGURATION
// =========================================================

let poolConfig;

if (databaseUrl) {
  // -------------------------------------------------------
  // RENDER + NEON
  // -------------------------------------------------------

  poolConfig = {
    connectionString: databaseUrl,

    // Neon connection strings should normally include
    // sslmode=require. Do not override SSL options already
    // supplied in the URL.
    ...(
      isNeon && !hasSslMode
        ? {
            ssl: {
              rejectUnauthorized: false,
            },
          }
        : {}
    ),

    max: database.poolMax || 10,

    idleTimeoutMillis:
      database.idleTimeoutMillis || 30000,

    connectionTimeoutMillis:
      database.connectionTimeoutMillis || 15000,

    keepAlive: true,
  };
} else {
  // -------------------------------------------------------
  // LOCAL POSTGRESQL FALLBACK
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
}

// =========================================================
// CREATE POOL
// =========================================================

const pool = new Pool(poolConfig);

// =========================================================
// CONNECTION EVENTS
// =========================================================

pool.on("connect", () => {
  console.log(
    "[DATABASE] PostgreSQL client connected."
  );
});

pool.on("error", (error) => {
  console.error(
    "[DATABASE] Unexpected database error:",
    error.message,
    error.code || ""
  );
});

// =========================================================
// VERIFY CONNECTION
// =========================================================

pool
  .query("SELECT 1 AS connected")
  .then(() => {
    console.log(
      databaseUrl
        ? "[DATABASE] Neon/DATABASE_URL connection successful."
        : "[DATABASE] Host-based PostgreSQL connection successful."
    );
  })
  .catch((error) => {
    console.error(
      "[DATABASE] Connection test failed:",
      error.message,
      error.code || ""
    );
  });

export default pool;