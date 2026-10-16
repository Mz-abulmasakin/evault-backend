export const shorthands = undefined;

export async function up(pgm) {

  pgm.createTable("monnify_accounts", {

    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    user_id: {
      type: "uuid",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },

    wallet_id: {
      type: "uuid",
      notNull: true,
      references: "wallets",
      onDelete: "CASCADE",
    },

    account_reference: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },

    account_number: {
      type: "varchar(20)",
      notNull: true,
      unique: true,
    },

    account_name: {
      type: "varchar(200)",
      notNull: true,
    },

    bank_name: {
      type: "varchar(100)",
      notNull: true,
    },

    reservation_reference: {
      type: "varchar(200)",
      notNull: true,
    },

    status: {
      type: "varchar(20)",
      default: "ACTIVE",
    },

    created_at: {
      type: "timestamp",
      default: pgm.func("CURRENT_TIMESTAMP"),
    }

  });

}

export async function down(pgm) {

  pgm.dropTable("monnify_accounts");

}