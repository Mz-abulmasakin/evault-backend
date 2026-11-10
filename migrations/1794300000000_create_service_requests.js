
export const shorthands = undefined;

export async function up(pgm) {
  // =====================================================
  // SERVICE REQUESTS
  // =====================================================

  pgm.createTable("service_requests", {
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

    reference: {
      type: "varchar(60)",
      notNull: true,
      unique: true,
    },

    service_type: {
      type: "varchar(20)",
      notNull: true,
    },

    entity_type: {
      type: "varchar(30)",
    },

    details: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },

    status: {
      type: "varchar(30)",
      notNull: true,
      default: "SUBMITTED",
    },

    payment_status: {
      type: "varchar(20)",
      notNull: true,
      default: "PENDING",
    },

    amount: {
      type: "numeric(14,2)",
      notNull: true,
      default: 0,
    },

    currency: {
      type: "varchar(3)",
      notNull: true,
      default: "NGN",
    },

    transaction_reference: {
      type: "varchar(100)",
    },

    assigned_admin_id: {
      type: "uuid",
    },

    admin_notes: {
      type: "text",
    },

    rejection_reason: {
      type: "text",
    },

    submitted_at: {
      type: "timestamptz",
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

    completed_at: {
      type: "timestamptz",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("service_requests", "user_id");
  pgm.createIndex("service_requests", "reference");
  pgm.createIndex("service_requests", "service_type");
  pgm.createIndex("service_requests", "status");
  pgm.createIndex("service_requests", "payment_status");
  pgm.createIndex("service_requests", "created_at");
  pgm.createIndex("service_requests", "assigned_admin_id");

  // =====================================================
  // SERVICE REQUEST DOCUMENTS
  // =====================================================

  pgm.createTable("service_request_documents", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    request_id: {
      type: "uuid",
      notNull: true,
      references: "service_requests",
      onDelete: "CASCADE",
    },

    uploaded_by_user_id: {
      type: "uuid",
      references: "users",
      onDelete: "SET NULL",
    },

    // Admin ID is stored without a foreign key because
    // the admin_users schema has not yet been inspected.
    uploaded_by_admin_id: {
      type: "uuid",
    },

    document_type: {
      type: "varchar(60)",
      notNull: true,
    },

    file_name: {
      type: "varchar(255)",
      notNull: true,
    },

    mime_type: {
      type: "varchar(100)",
      notNull: true,
    },

    file_size: {
      type: "bigint",
      notNull: true,
    },

    storage_bucket: {
      type: "varchar(150)",
      notNull: true,
    },

    storage_path: {
      type: "text",
      notNull: true,
      unique: true,
    },

    visibility: {
      type: "varchar(20)",
      notNull: true,
      default: "CUSTOMER",
    },

    metadata: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'{}'::jsonb"),
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.createIndex("service_request_documents", "request_id");
  pgm.createIndex("service_request_documents", "document_type");
  pgm.createIndex("service_request_documents", "visibility");
}

export async function down(pgm) {
  pgm.dropTable("service_request_documents");
  pgm.dropTable("service_requests");
}
