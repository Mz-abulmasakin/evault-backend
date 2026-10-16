import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import db from "../src/config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(
  __dirname,
  "migrations"
);

async function createMigrationTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      migration_name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getExecutedMigrations() {
  const result = await db.query(`
    SELECT migration_name
    FROM schema_migrations
    ORDER BY id ASC
  `);

  return new Set(
    result.rows.map(
      (row) => row.migration_name
    )
  );
}

async function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js"))
    .sort();
}

async function runMigration(file) {
  const migrationPath =
    path.join(migrationsDir, file);

  const migration =
    await import(`file://${migrationPath}`);

  const migrationModule =
    migration.default || migration;

  if (
    typeof migrationModule.up !==
    "function"
  ) {
    throw new Error(
      `Migration ${file} does not export up()`
    );
  }

  const migrationName =
    migrationModule.migrationName ||
    file;

  console.log(
    `Running migration: ${migrationName}`
  );

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await migrationModule.up();

    await client.query(
      `
      INSERT INTO schema_migrations (
        migration_name
      )
      VALUES ($1)
      ON CONFLICT (migration_name)
      DO NOTHING
      `,
      [migrationName]
    );

    await client.query("COMMIT");

    console.log(
      `✓ Migration completed: ${migrationName}`
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      `✗ Migration failed: ${migrationName}`
    );

    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log(
      "Starting database migration..."
    );

    await createMigrationTable();

    const executed =
      await getExecutedMigrations();

    const files =
      await getMigrationFiles();

    for (const file of files) {
      const migrationPath =
        path.join(migrationsDir, file);

      const migration =
        await import(
          `file://${migrationPath}`
        );

      const migrationModule =
        migration.default || migration;

      const migrationName =
        migrationModule.migrationName ||
        file;

      if (executed.has(migrationName)) {
        console.log(
          `Skipping: ${migrationName}`
        );

        continue;
      }

      await runMigration(file);
    }

    console.log(
      "Database migrations completed successfully."
    );
  } catch (error) {
    console.error(
      "Migration error:",
      error
    );

    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();