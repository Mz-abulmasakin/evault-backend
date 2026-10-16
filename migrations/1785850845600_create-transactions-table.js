/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */

export const up = (pgm) => {
  pgm.createTable("transactions", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    wallet_id: {
      type: "uuid",
      notNull: true,
      references: "wallets(id)",
      onDelete: "CASCADE",
    },

    reference: {
      type: "varchar(50)",
      notNull: true,
      unique: true,
    },

    type: {
      type: "varchar(20)",
      notNull: true,
    },

    amount: {
      type: "numeric(18,2)",
      notNull: true,
    },

    balance_before: {
      type: "numeric(18,2)",
      notNull: true,
    },

    balance_after: {
      type: "numeric(18,2)",
      notNull: true,
    },

    status: {
      type: "varchar(20)",
      notNull: true,
      default: "SUCCESS",
    },

    description: {
      type: "text",
    },

    metadata: {
      type: "jsonb",
      default: "{}",
    },

    created_at: {
      type: "timestamp with time zone",
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: "timestamp with time zone",
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("transactions", "wallet_id");
  pgm.createIndex("transactions", "reference");
  pgm.createIndex("transactions", "created_at");
};

export const down = (pgm) => {
  pgm.dropTable("transactions");
};