/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    username: {
      type: "varchar(50)",
      notNull: true,
      unique: true,
    },

    full_name: {
      type: "varchar(150)",
      notNull: true,
    },

    email: {
      type: "varchar(150)",
      notNull: true,
      unique: true,
    },

    phone_number: {
      type: "varchar(20)",
      notNull: true,
      unique: true,
    },

    password_hash: {
      type: "text",
      notNull: true,
    },

    status: {
      type: "varchar(20)",
      notNull: true,
      default: "ACTIVE",
    },

    is_email_verified: {
      type: "boolean",
      notNull: true,
      default: false,
    },

    is_phone_verified: {
      type: "boolean",
      notNull: true,
      default: false,
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

    deleted_at: {
      type: "timestamp with time zone",
    },
  });
};

export const down = (pgm) => {
  pgm.dropTable("users");
};