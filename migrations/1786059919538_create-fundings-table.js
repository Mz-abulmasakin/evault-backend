export const shorthands = undefined;


export async function up(pgm) {

  pgm.createTable("fundings", {

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


    reference: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },


    amount: {
      type: "numeric(18,2)",
      notNull: true,
    },


    provider: {
      type: "varchar(30)",
      notNull: true,
      default: "MONNIFY",
    },


    status: {
      type: "varchar(30)",
      notNull: true,
      default: "PENDING",
    },


    payment_method: {
      type: "varchar(50)",
      default: "BANK_TRANSFER",
    },


    metadata: {
      type: "jsonb",
      default: "{}",
    },


    created_at: {
      type: "timestamp",
      default: pgm.func("CURRENT_TIMESTAMP"),
    },


    updated_at: {
      type: "timestamp",
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

  });



  pgm.createIndex(
    "fundings",
    "user_id"
  );


  pgm.createIndex(
    "fundings",
    "wallet_id"
  );


  pgm.createIndex(
    "fundings",
    "reference"
  );


  pgm.createIndex(
    "fundings",
    "status"
  );

}



export async function down(pgm) {

  pgm.dropTable("fundings");

}