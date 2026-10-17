// src/config/env.js

import dotenv from "dotenv";

dotenv.config();

// =========================================================
// HELPERS
// =========================================================

function positiveNumber(value, fallback) {
  const number = Number(value);

  return Number.isFinite(number) && number > 0
    ? number
    : fallback;
}

function booleanValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value).trim().toLowerCase() === "true";
}

// =========================================================
// ENVIRONMENT CONFIGURATION
// =========================================================

const env = {
  // -------------------------------------------------------
  // SERVER
  // Render supplies PORT. Locally, default to 5000.
  // -------------------------------------------------------

  server: {
    port: positiveNumber(process.env.PORT, 5000),

    nodeEnv:
      process.env.NODE_ENV || "development",
  },

  // -------------------------------------------------------
  // DATABASE — NEON / POSTGRESQL
  // -------------------------------------------------------

  database: {
    // Production: Neon connection string
    url:
      process.env.DATABASE_URL ||
      process.env.DB_URL ||
      "",

    // Local-development fallback
    host:
      process.env.DB_HOST || "",

    port:
      positiveNumber(process.env.DB_PORT, 5432),

    name:
      process.env.DB_NAME || "",

    user:
      process.env.DB_USER || "",

    password:
      process.env.DB_PASSWORD || "",

    // Used by database.js for the host-based connection.
    // Neon connection strings should include sslmode=require.
    ssl:
      booleanValue(process.env.DB_SSL, false),

    poolMax:
      positiveNumber(process.env.DB_POOL_MAX, 10),

    idleTimeoutMillis:
      positiveNumber(
        process.env.DB_IDLE_TIMEOUT_MS,
        30000
      ),

    connectionTimeoutMillis:
      positiveNumber(
        process.env.DB_CONNECTION_TIMEOUT_MS,
        15000
      ),
  },

  // -------------------------------------------------------
  // JWT
  // -------------------------------------------------------

  jwt: {
    secret:
      process.env.JWT_SECRET,

    expiresIn:
      process.env.JWT_EXPIRES_IN || "7d",

    adminSecret:
      process.env.ADMIN_JWT_SECRET,

    adminExpiresIn:
      process.env.ADMIN_JWT_EXPIRES_IN || "8h",
  },

  // -------------------------------------------------------
  // STORAGE
  // -------------------------------------------------------

  storage: {
    uploadPath:
      process.env.UPLOAD_PATH || "uploads",
  },

  // -------------------------------------------------------
  // INTEGRATIONS
  // -------------------------------------------------------

  integrations: {
    monnify: {
      apiKey:
        process.env.MONNIFY_API_KEY,

      secretKey:
        process.env.MONNIFY_SECRET_KEY,

      contractCode:
        process.env.MONNIFY_CONTRACT_CODE,

      baseUrl:
        process.env.MONNIFY_BASE_URL,
    },

    alrahuzdata: {
      apiKey:
        process.env.ALRAHUZDATA_API_KEY,

      baseUrl:
        process.env.ALRAHUZDATA_BASE_URL ||
        "https://alrahuzdata.com.ng",
    },

    instantipe: {
      baseUrl:
        process.env.INSTANTIPE_BASE_URL ||
        "https://instantipe.com.ng",

      apiKey:
        process.env.INSTANTIPE_API_KEY || null,
    },

    sms: {
      apiKey:
        process.env.SMS_API_KEY,
    },

    email: {
      apiKey:
        process.env.EMAIL_API_KEY,
    },
  },
};

export default env;