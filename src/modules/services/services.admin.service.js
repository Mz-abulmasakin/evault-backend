import db from "../../config/database.js";

import {
  listAdminServiceRequests,
  findAdminServiceRequest,
  updateAdminServiceRequestStatus,
} from "./services.admin.repository.js";

import {
  createServiceRequestDocument,
} from "./services.repository.js";

import {
  createNotification,
} from "../notification/notification.repository.js";

import {
  uploadPrivateDocument,
  createPrivateDocumentUrl,
  deletePrivateDocument,
  downloadPrivateDocument,
} from "../../services/supabase.storage.service.js";

// =========================================================
// HELPERS
// =========================================================

function makeError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toPositiveInteger(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function cleanSearch(value) {
  return typeof value === "string"
    ? value.trim().slice(0, 120)
    : "";
}

function pagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

function safeFileName(name) {
  const cleaned = String(name || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);

  return cleaned || "document";
}

// =========================================================
// FILE SIGNATURE VALIDATION
// =========================================================

function validateCompletedDocument(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw makeError("An uploaded document is invalid.", 400);
  }

  if (file.buffer.length > 10 * 1024 * 1024) {
    throw makeError("Each document must not exceed 10 MB.", 400);
  }

  const mimeType = file.mimetype;
  const buffer = file.buffer;

  // JPEG validation
  if (mimeType === "image/jpeg") {
    if (
      buffer.length < 3 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8 ||
      buffer[2] !== 0xff
    ) {
      throw makeError("An uploaded JPEG file is invalid.", 400);
    }

    return;
  }

  // PNG validation
  if (mimeType === "image/png") {
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47,
      0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    if (
      buffer.length < 8 ||
      !buffer.subarray(0, 8).equals(pngSignature)
    ) {
      throw makeError("An uploaded PNG file is invalid.", 400);
    }

    return;
  }

  // PDF validation
  if (mimeType === "application/pdf") {
    if (
      buffer.length < 5 ||
      buffer.subarray(0, 5).toString() !== "%PDF-"
    ) {
      throw makeError("An uploaded PDF file is invalid.", 400);
    }

    return;
  }

  throw makeError(
    "Only PDF, JPEG and PNG documents are allowed.",
    400
  );
}

// =========================================================
// LIST SERVICE REQUESTS
// =========================================================

export async function getAdminServiceRequests(query = {}) {
  const page = toPositiveInteger(query.page, 1, 1000000);
  const limit = toPositiveInteger(query.limit, 20, 100);

  const search = cleanSearch(query.search);

  const serviceType = cleanSearch(
    query.serviceType
  ).toUpperCase();

  const status = cleanSearch(
    query.status
  ).toUpperCase();

  const allowedTypes = ["CAC", "TIN", "SCUML"];

  if (serviceType && !allowedTypes.includes(serviceType)) {
    throw makeError("Invalid service type filter.", 400);
  }

  const result = await listAdminServiceRequests({
    page,
    limit,
    search,
    serviceType,
    status,
  });

  return {
    data: result.rows,
    pagination: pagination(page, limit, result.total),
  };
}

// =========================================================
// SECURE DOCUMENT LINKS
// =========================================================

async function attachDocumentLinks(documents = []) {
  return Promise.all(
    documents.map(async (document) => {
      const signedUrl = await createPrivateDocumentUrl(
        document.storage_path
      );

      const {
        storage_path,
        storage_bucket,
        ...safeDocument
      } = document;

      return {
        ...safeDocument,
        downloadUrl: signedUrl.url,
        downloadUrlExpiresIn: signedUrl.expiresIn,
      };
    })
  );
}

// =========================================================
// GET SERVICE REQUEST DETAILS
// =========================================================

export async function getAdminServiceRequestDetails(requestId) {
  if (!requestId) {
    throw makeError("Service request ID is required.", 400);
  }

  const request = await findAdminServiceRequest(requestId);

  if (!request) {
    throw makeError("Service request not found.", 404);
  }

  return {
    ...request,
    documents: await attachDocumentLinks(request.documents),
  };
}

// =========================================================
// PROCESS SERVICE REQUEST
// =========================================================

export async function processAdminServiceRequest({
  requestId,
  adminId,
  status,
  adminNotes,
  rejectionReason,
}) {
  if (!requestId) {
    throw makeError("Service request ID is required.", 400);
  }

  if (!adminId) {
    throw makeError("Administrator ID is required.", 400);
  }

  const allowedStatuses = [
    "UNDER_REVIEW",
    "PROCESSING",
    "REJECTED",
  ];

  if (!allowedStatuses.includes(status)) {
    throw makeError("Invalid service processing status.", 400);
  }

  if (
    status === "REJECTED" &&
    (!rejectionReason || !String(rejectionReason).trim())
  ) {
    throw makeError("A rejection reason is required.", 400);
  }

  const updated = await updateAdminServiceRequestStatus({
    requestId,
    adminId,
    status,
    adminNotes: adminNotes
      ? String(adminNotes).trim()
      : null,
    rejectionReason: status === "REJECTED"
      ? String(rejectionReason).trim()
      : null,
  });

  if (!updated) {
    throw makeError("Service request not found.", 404);
  }

  return updated;
}

// =========================================================
// UPLOAD COMPLETED SERVICE DOCUMENTS
// =========================================================

export async function uploadCompletedServiceDocuments({
  requestId,
  adminId,
  files = [],
  adminNotes = null,
}) {
  if (!requestId) {
    throw makeError("Service request ID is required.", 400);
  }

  if (!adminId) {
    throw makeError("Administrator ID is required.", 400);
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw makeError("Please select at least one document.", 400);
  }

  if (files.length > 10) {
    throw makeError("You can upload a maximum of 10 documents.", 400);
  }

  for (const file of files) {
    validateCompletedDocument(file);
  }

  const client = await db.connect();
  const uploadedObjects = [];

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `SELECT
         id,
         user_id,
         reference,
         service_type,
         status
       FROM service_requests
       WHERE id::text = $1 OR reference = $1
       LIMIT 1
       FOR UPDATE`,
      [String(requestId)]
    );

    const request = requestResult.rows[0];

    if (!request) {
      throw makeError("Service request not found.", 404);
    }

    if (request.status === "COMPLETED") {
      throw makeError(
        "This service request is already completed.",
        409
      );
    }

    if (request.status === "REJECTED") {
      throw makeError(
        "Rejected requests cannot be completed.",
        409
      );
    }

    const savedDocuments = [];

    for (const file of files) {
      const uploaded = await uploadPrivateDocument({
        buffer: file.buffer,
        mimeType: file.mimetype,
        folder: `service-requests/${request.id}/completed`,
      });

      uploadedObjects.push(uploaded);

      const document = await createServiceRequestDocument(
        {
          requestId: request.id,
          uploadedByAdminId: adminId,
          documentType: "COMPLETED_DOCUMENT",
          fileName: safeFileName(file.originalname),
          mimeType: file.mimetype,
          fileSize: file.buffer.length,
          storageBucket: uploaded.bucket,
          storagePath: uploaded.path,
          visibility: "CUSTOMER",
          metadata: {
            originalName: file.originalname,
            uploadedAs: "completed_service_document",
          },
        },
        client
      );

      savedDocuments.push(document);
    }

    const completedResult = await client.query(
      `UPDATE service_requests
       SET
         status = 'COMPLETED',
         assigned_admin_id = $1,
         admin_notes = COALESCE($2, admin_notes),
         completed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING
         id,
         user_id,
         reference,
         service_type,
         entity_type,
         status,
         payment_status,
         completed_at,
         updated_at`,
      [
        adminId,
        adminNotes ? String(adminNotes).trim() : null,
        request.id,
      ]
    );

    const completedRequest = completedResult.rows[0];

    await createNotification(
      {
        userId: request.user_id,
        title: "Service Request Completed",
        message: `Your ${request.service_type} service request (${request.reference}) has been completed. Your documents are now available in eVault.`,
        type: "INFO",
        metadata: {
          serviceRequestId: request.id,
          reference: request.reference,
          serviceType: request.service_type,
        },
      },
      client
    );

    await client.query("COMMIT");

    return {
      request: completedRequest,

      documents: savedDocuments.map((document) => {
        const {
          storage_path,
          storage_bucket,
          ...safeDocument
        } = document;

        return safeDocument;
      }),

      message:
        "Documents uploaded and service request completed successfully.",
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Service request rollback failed:",
        rollbackError
      );
    }

    for (const uploaded of uploadedObjects) {
      try {
        await deletePrivateDocument(uploaded.path);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up uploaded document:",
          cleanupError
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

// =========================================================
// DOWNLOAD ALL SERVICE REQUEST DOCUMENTS AS ZIP
// =========================================================

export async function getAdminServiceRequestZip(requestId) {
  if (!requestId) {
    throw makeError("Service request ID is required.", 400);
  }

  const request = await findAdminServiceRequest(requestId);

  if (!request) {
    throw makeError("Service request not found.", 404);
  }

  if (!request.documents || request.documents.length === 0) {
    throw makeError(
      "No documents are available for this application.",
      404
    );
  }

  const files = [];

  for (let index = 0; index < request.documents.length; index++) {
    const document = request.documents[index];

    if (!document.storage_path) {
      continue;
    }

    const buffer = await downloadPrivateDocument(
      document.storage_path,
      document.storage_bucket
    );

    const safeName = safeFileName(document.file_name);

    const folder = document.uploaded_by_admin_id
      ? "Completed Documents"
      : "Submitted Documents";

    files.push({
      name: `${folder}/${String(index + 1).padStart(2, "0")}_${safeName}`,
      buffer,
    });
  }

  if (files.length === 0) {
    throw makeError(
      "No downloadable documents were found.",
      404
    );
  }

  return {
    reference: request.reference,
    serviceType: request.service_type,
    files,
  };
}