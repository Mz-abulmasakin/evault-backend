// src/config/database.js
// Adjust the path if your existing database.js is in another folder.

import pg from "pg";
import env from "./env.js";

const { Pool } = pg;

// =========================================================
// DATABASE CONFIGURATION
// =========================================================

const database = env.database || {};

// Prefer DATABASE_URL for Neon or another hosted PostgreSQL.
// Keep compatibility with optional URL fields in env.js.
const databaseUrl =
  process.env.DATABASE_URL ||
  database.url ||
  database.databaseUrl ||
  database.connectionString ||
  "";

// Detect SSL options already supplied inside the URL.
// node-postgres warns that URL SSL parameters can override
// an explicitly supplied ssl object.
const hasSslOptionsInUrl =
  /[?&](sslmode|sslcert|sslkey|sslrootcert)=/i.test(
    databaseUrl
  );

// Detect a Neon connection string.
const isNeon =
  typeof databaseUrl === "string" &&
  /\.neon\.tech(?:[/:?]|$)/i.test(databaseUrl);

// Enable SSL for Neon, or when explicitly requested.
const useSsl =
  isNeon ||
  process.env.DB_SSL === "true" ||
  database.ssl === true;

// If the URL already specifies SSL settings, allow pg to
// interpret them instead of overriding them with an object.
const sslConfig =
  useSsl && !hasSslOptionsInUrl
    ? { rejectUnauthorized: false }
    : undefined;

// =========================================================
// POOL OPTIONS
// =========================================================

const poolConfig = databaseUrl
  ? {
      // Neon connection string
      connectionString: databaseUrl,

      ...(sslConfig ? { ssl: sslConfig } : {}),

      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    }
  : {
      // Existing host-based PostgreSQL configuration
      host: database.host,
      port: Number(database.port || 5432),
      database: database.name,
      user: database.user,
      password: database.password,

      ...(useSsl
        ? {
            ssl:
              typeof database.ssl === "object"
                ? database.ssl
                : { rejectUnauthorized: false },
          }
        : {}),

      max: Number(process.env.DB_POOL_MAX || 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
    };

// =========================================================
// CREATE POOL
// =========================================================

const pool = new Pool(poolConfig);

const connectionSource = databaseUrl
  ? isNeon
    ? "Neon PostgreSQL using DATABASE_URL"
    : "PostgreSQL using DATABASE_URL"
  : "PostgreSQL using host configuration";

// =========================================================
// CONNECTION EVENTS
// =========================================================

pool.on("connect", () => {
  console.log("[DATABASE] PostgreSQL client connected.");
});

pool.on("error", (error) => {
  console.error(
    "[DATABASE] Unexpected idle-client error:",
    error.message,
    error.code || ""
  );
});

// =========================================================
// TEST ACTUAL CONNECTION
// =========================================================

pool
  .query("SELECT 1 AS connected")
  .then(() => {
    console.log(
      `[DATABASE] Connection test successful: ${connectionSource}`
    );
  })
  .catch((error) => {
    console.error(
      `[DATABASE] Connection test failed: ${connectionSource}`,
      error.message,
      error.code || ""
    );
  });

export default pool;