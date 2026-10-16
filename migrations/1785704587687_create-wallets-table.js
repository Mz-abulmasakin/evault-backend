export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable("wallets", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
      unique: true,
    },

    wallet_number: {
      type: "varchar(20)",
      notNull: true,
      unique: true,
    },

    available_balance: {
      type: "numeric(18,2)",
      notNull: true,
      default: 0,
    },

    ledger_balance: {
      type: "numeric(18,2)",
      notNull: true,
      default: 0,
    },

    currency: {
      type: "varchar(3)",
      notNull: true,
      default: "NGN",
    },

    status: {
      type: "varchar(20)",
      notNull: true,
      default: "ACTIVE",
    },

    created_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: "timestamp with time zone",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("wallets", "wallet_number");
  pgm.createIndex("wallets", "user_id");
}

export async function down(pgm) {
  pgm.dropTable("wallets");
}