
import db from "../../config/database.js";

// =========================================================
// ADMIN SERVICES - LIST REQUESTS
// =========================================================

export async function listAdminServiceRequests({
  page = 1,
  limit = 20,
  search = "",
  serviceType = "",
  status = "",
}) {
  const conditions = [];
  const values = [];

  if (search) {
    values.push(`%${search}%`);
    const p = `$${values.length}`;

    conditions.push(`(
      sr.reference ILIKE ${p}
      OR COALESCE(u.full_name, '') ILIKE ${p}
      OR COALESCE(u.email, '') ILIKE ${p}
      OR COALESCE(u.phone_number, '') ILIKE ${p}
    )`);
  }

  if (serviceType) {
    values.push(serviceType);
    conditions.push(`sr.service_type = $${values.length}`);
  }

  if (status) {
    values.push(status);
    conditions.push(`sr.status = $${values.length}`);
  }

  const whereSql = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const limitIndex = values.length + 1;
  const offsetIndex = values.length + 2;
  const offset = (page - 1) * limit;

  const [rowsResult, countResult] = await Promise.all([
    db.query(
      `SELECT
         sr.id, sr.user_id, sr.reference,
         sr.service_type, sr.entity_type,
         sr.status, sr.payment_status,
         sr.amount, sr.currency,
         sr.submitted_at, sr.completed_at,
         sr.created_at, sr.updated_at,
         u.full_name AS customer_name,
         u.username AS customer_username,
         u.email AS customer_email,
         u.phone_number AS customer_phone
       FROM service_requests sr
       INNER JOIN users u ON u.id = sr.user_id
       ${whereSql}
       ORDER BY sr.created_at DESC
       LIMIT $${limitIndex}
       OFFSET $${offsetIndex}`,
      [...values, limit, offset]
    ),

    db.query(
      `SELECT COUNT(*)::int AS total
       FROM service_requests sr
       INNER JOIN users u ON u.id = sr.user_id
       ${whereSql}`,
      values
    ),
  ]);

  return {
    rows: rowsResult.rows,
    total: Number(countResult.rows[0]?.total || 0),
  };
}

// =========================================================
// ADMIN SERVICES - REQUEST DETAILS
// =========================================================

export async function findAdminServiceRequest(requestId) {
  const requestResult = await db.query(
    `SELECT
       sr.*,
       u.full_name AS customer_name,
       u.username AS customer_username,
       u.email AS customer_email,
       u.phone_number AS customer_phone
     FROM service_requests sr
     INNER JOIN users u ON u.id = sr.user_id
     WHERE sr.id::text = $1 OR sr.reference = $1
     LIMIT 1`,
    [String(requestId)]
  );

  const request = requestResult.rows[0];

  if (!request) return null;

  const documentsResult = await db.query(
    `SELECT
       id, request_id,
       uploaded_by_user_id,
       uploaded_by_admin_id,
       document_type,
       file_name,
       mime_type,
       file_size,
       storage_bucket,
       storage_path,
       visibility,
       metadata,
       created_at
     FROM service_request_documents
     WHERE request_id = $1
     ORDER BY created_at ASC`,
    [request.id]
  );

  return {
    ...request,
    documents: documentsResult.rows,
  };
}

// =========================================================
// UPDATE SERVICE REQUEST STATUS
// =========================================================

export async function updateAdminServiceRequestStatus({
  requestId,
  adminId,
  status,
  adminNotes = null,
  rejectionReason = null,
}) {
  const result = await db.query(
    `UPDATE service_requests
     SET
       status = $1,
       assigned_admin_id = COALESCE($2, assigned_admin_id),
       admin_notes = COALESCE($3, admin_notes),
       rejection_reason = $4,
       updated_at = CURRENT_TIMESTAMP
     WHERE id::text = $5 OR reference = $5
     RETURNING
       id, user_id, reference,
       service_type, entity_type,
       status, payment_status,
       assigned_admin_id,
       admin_notes, rejection_reason,
       submitted_at, completed_at, updated_at`,
    [
      status,
      adminId || null,
      adminNotes,
      rejectionReason,
      String(requestId),
    ]
  );

  return result.rows[0] || null;
}
