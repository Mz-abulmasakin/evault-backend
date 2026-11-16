
import db from "../../config/database.js";

// =========================================================
// CREATE SERVICE REQUEST
// =========================================================

export async function createServiceRequest(
  data,
  client = db
) {
  const {
    userId,
    reference,
    serviceType,
    entityType = null,
    details = {},
    amount = 0,
    currency = "NGN",
    status = "SUBMITTED",
    paymentStatus = "PENDING",
  } = data;

  const result = await client.query(
    `
    INSERT INTO service_requests (
      user_id,
      reference,
      service_type,
      entity_type,
      details,
      amount,
      currency,
      status,
      payment_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      userId,
      reference,
      serviceType,
      entityType,
      JSON.stringify(details),
      amount,
      currency,
      status,
      paymentStatus,
    ]
  );

  return result.rows[0];
}

// =========================================================
// SAVE SERVICE REQUEST DOCUMENT
// =========================================================

export async function createServiceRequestDocument(
  data,
  client = db
) {
  const {
    requestId,
    uploadedByUserId = null,
    uploadedByAdminId = null,
    documentType,
    fileName,
    mimeType,
    fileSize,
    storageBucket,
    storagePath,
    visibility = "CUSTOMER",
    metadata = {},
  } = data;

  const result = await client.query(
    `
    INSERT INTO service_request_documents (
      request_id,
      uploaded_by_user_id,
      uploaded_by_admin_id,
      document_type,
      file_name,
      mime_type,
      file_size,
      storage_bucket,
      storage_path,
      visibility,
      metadata
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
    `,
    [
      requestId,
      uploadedByUserId,
      uploadedByAdminId,
      documentType,
      fileName,
      mimeType,
      fileSize,
      storageBucket,
      storagePath,
      visibility,
      JSON.stringify(metadata),
    ]
  );

  return result.rows[0];
}

// =========================================================
// FIND CUSTOMER REQUEST
// =========================================================

export async function findServiceRequestByUser(
  requestId,
  userId,
  client = db
) {
  const result = await client.query(
    `
    SELECT *
    FROM service_requests
    WHERE id = $1
      AND user_id = $2
    LIMIT 1
    `,
    [requestId, userId]
  );

  return result.rows[0] || null;
}

// =========================================================
// LIST CUSTOMER REQUESTS
// =========================================================

export async function findServiceRequestsByUser(
  userId,
  limit = 50,
  offset = 0,
  client = db
) {
  const result = await client.query(
    `
    SELECT *
    FROM service_requests
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    OFFSET $3
    `,
    [
      userId,
      limit,
      offset,
    ]
  );

  return result.rows;
}

// =========================================================
// FIND CUSTOMER-VISIBLE DOCUMENT
// =========================================================

export async function findCustomerServiceDocument(
  requestId,
  documentId,
  userId,
  client = db
) {
  const result = await client.query(
    `
    SELECT
      d.*
    FROM service_request_documents d
    INNER JOIN service_requests r
      ON r.id = d.request_id
    WHERE d.id = $1
      AND d.request_id = $2
      AND r.user_id = $3
      AND d.visibility = 'CUSTOMER'
    LIMIT 1
    `,
    [
      documentId,
      requestId,
      userId,
    ]
  );

  return result.rows[0] || null;
}

// =========================================================
// LIST CUSTOMER-VISIBLE DOCUMENTS
// =========================================================

export async function findCustomerServiceDocuments(
  requestId,
  userId,
  client = db
) {
  const result = await client.query(
    `
    SELECT
      d.id,
      d.request_id,
      d.document_type,
      d.file_name,
      d.mime_type,
      d.file_size,
      d.storage_path,
      d.created_at
    FROM service_request_documents d
    INNER JOIN service_requests r
      ON r.id = d.request_id
    WHERE d.request_id = $1
      AND r.user_id = $2
      AND d.visibility = 'CUSTOMER'
    ORDER BY d.created_at DESC
    `,
    [
      requestId,
      userId,
    ]
  );

  return result.rows;
}
