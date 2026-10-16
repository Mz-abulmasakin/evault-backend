// migration: add transaction PIN fields to users table

export const shorthands = undefined;

export async function up(pgm) {

  pgm.addColumns("users", {

    transaction_pin_hash: {
      type: "text",
      notNull: false,
    },

    pin_created_at: {
      type: "timestamp with time zone",
      notNull: false,
    },

    pin_updated_at: {
      type: "timestamp with time zone",
      notNull: false,
    },

  });

}



export async function down(pgm) {

  pgm.dropColumns(
    "users",
    [
      "transaction_pin_hash",
      "pin_created_at",
      "pin_updated_at",
    ]
  );

}