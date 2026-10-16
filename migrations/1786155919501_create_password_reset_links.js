
import db from "../../src/config/database.js";

const migrationName =
  "1791940000000_create_password_reset_links";

async function up(client = db) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS password_reset_links (
      id UUID PRIMARY KEY,

      user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

      token_hash CHAR(64) NOT NULL UNIQUE,

      expires_at TIMESTAMPTZ NOT NULL,

      used_at TIMESTAMPTZ,

      created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS
      idx_password_reset_links_user_created
      ON password_reset_links (user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS
      idx_password_reset_links_expiry
      ON password_reset_links (expires_at);
  `);

  console.log("password_reset_links table is ready.");
}

async function down(client = db) {
  await client.query(`
    DROP TABLE IF EXISTS password_reset_links;
  `);
}

export default {
  migrationName,
  up,
  down,
};
