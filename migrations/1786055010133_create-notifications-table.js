export const shorthands = undefined;

export async function up(pgm) {
  pgm.createTable("notifications", {
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

    title: {
      type: "varchar(150)",
      notNull: true,
    },

    message: {
      type: "text",
      notNull: true,
    },

    type: {
      type: "varchar(30)",
      notNull: true,
      default: "INFO",
    },

    is_read: {
      type: "boolean",
      notNull: true,
      default: false,
    },

    data: {
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

  pgm.createIndex("notifications", "user_id");
  pgm.createIndex("notifications", "created_at");
  pgm.createIndex("notifications", "is_read");
}

export async function down(pgm) {
  pgm.dropTable("notifications");
}