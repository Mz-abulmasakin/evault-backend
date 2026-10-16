import env from "./src/config/env.js";

export default {
  databaseUrl: `postgres://${env.database.user}:${env.database.password}@${env.database.host}:${env.database.port}/${env.database.name}`,

  migrationsTable: "pgmigrations",

  dir: "src/database/migrations",

  direction: "up",

  migrationsSchema: "public",
};