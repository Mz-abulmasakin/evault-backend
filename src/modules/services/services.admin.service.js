
import db from "../../config/database.js";
import PDFDocument from "pdfkit";

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
// PDF FORMATTING HELPERS
// =========================================================

function formatPdfLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPdfValue(value) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "object") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

function renderPdfObject(doc, object, depth = 0) {
  if (!object || typeof object !== "object") return;

  const entries = Array.isArray(object)
    ? object.map((value, index) => [String(index + 1), value])
    : Object.entries(object);

  for (const [key, value] of entries) {
    if (depth > 8) return;

    const label = formatPdfLabel(key);
    const indent = Math.min(depth * 14, 70);

    if (Array.isArray(value)) {
      doc.moveDown(0.3);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#2a5fd3")
        .text(`${label} (${value.length})`, {
          indent,
        });

      if (value.length === 0) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#555555")
          .text("No records available.", {
            indent: indent + 12,
          });
      } else {
        value.forEach((item, index) => {
          doc.moveDown(0.2);

          doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .fillColor("#333333")
            .text(`${label} ${index + 1}`, {
              indent: indent + 12,
            });

          if (item && typeof item === "object") {
            renderPdfObject(doc, item, depth + 1);
          } else {
            doc
              .font("Helvetica")
              .fontSize(9)
              .fillColor("#444444")
              .text(formatPdfValue(item), {
                indent: indent + 24,
                width: 450 - indent,
              });
          }
        });
      }

      continue;
    }

    if (value && typeof value === "object") {
      doc.moveDown(0.25);

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor("#2a5fd3")
        .text(label, {
          indent,
        });

      renderPdfObject(doc, value, depth + 1);
      continue;
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#333333")
      .text(`${label}:`, {
        indent,
      });

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#444444")
      .text(formatPdfValue(value), {
        indent: indent + 8,
        width: 480 - indent,
      });

    doc.moveDown(0.2);
  }
}

// =========================================================
// CREATE BRANDED PDF
// =========================================================

function createReadablePdf({
  title,
  reference,
  serviceType,
  sections,
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: {
        top: 55,
        bottom: 55,
        left: 50,
        right: 50,
      },
      bufferPages: true,
      info: {
        Title: title,
        Author: "eVault - iServeBay Ltd",
        Subject: `${serviceType} Service Request`,
      },
    });

    const chunks = [];
    let settled = false;

    doc.on("data", (chunk) => {
      chunks.push(chunk);
    });

    doc.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    doc.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });

    try {
      // eVault branding
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#2a5fd3")
        .text("eVault", {
          align: "center",
        });

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#666666")
        .text("Electronic Vault | Powered by iServeBay Ltd", {
          align: "center",
        });

      doc.moveDown(1);

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#222222")
        .text(title, {
          align: "center",
        });

      doc.moveDown(0.7);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#555555")
        .text(`Application Reference: ${reference || "N/A"}`);

      doc.text(`Service Type: ${serviceType || "N/A"}`);

      doc.text(
        `Generated: ${new Date().toLocaleString("en-NG")}`
      );

      doc.moveDown(1);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#2a5fd3")
        .lineWidth(1.5)
        .stroke();

      doc.moveDown(1);

      for (const section of sections) {
        doc
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#2a5fd3")
          .text(section.heading);

        doc.moveDown(0.4);

        renderPdfObject(doc, section.data);

        doc.moveDown(0.7);
      }

      // Footer on every page
      const range = doc.bufferedPageRange();

      for (
        let page = range.start;
        page < range.start + range.count;
        page++
      ) {
        doc.switchToPage(page);

        const footerY = doc.page.height - 35;

        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor("#777777")
          .text(
            `eVault | ${reference || "Service Request"} | Page ${page + 1}`,
            50,
            footerY,
            {
              width: 495,
              align: "center",
            }
          );
      }

      doc.end();
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error);
      }

      doc.destroy();
    }
  });
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

  // Parse PostgreSQL JSONB application details.
  let applicationDetails = request.details ?? {};

  if (typeof applicationDetails === "string") {
    try {
      applicationDetails = JSON.parse(applicationDetails);
    } catch {
      applicationDetails = {
        originalDetails: applicationDetails,
      };
    }
  }

  if (
    !applicationDetails ||
    typeof applicationDetails !== "object"
  ) {
    applicationDetails = {
      applicationDetails,
    };
  }

  const files = [];

  // -------------------------------------------------------
  // 1. APPLICATION DETAILS PDF
  // -------------------------------------------------------

  const applicationInformation = {
    reference: request.reference,
    serviceType: request.service_type,
    entityType: request.entity_type,
    status: request.status,
    paymentStatus: request.payment_status,
    amount: request.amount,
    currency: request.currency,
    submittedAt: request.submitted_at,
    completedAt: request.completed_at,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
  };

  const applicationPdf = await createReadablePdf({
    title: "Application Details",
    reference: request.reference,
    serviceType: request.service_type,
    sections: [
      {
        heading: "Application Information",
        data: applicationInformation,
      },
      {
        heading: "Submitted Application Details",
        data: applicationDetails,
      },
    ],
  });

  files.push({
    name: "Application Details.pdf",
    buffer: applicationPdf,
  });

  // -------------------------------------------------------
  // 2. CUSTOMER INFORMATION PDF
  // -------------------------------------------------------

  const customerInformation = {
    fullName: request.customer_name,
    username: request.customer_username,
    email: request.customer_email,
    phoneNumber: request.customer_phone,
  };

  const customerPdf = await createReadablePdf({
    title: "Customer Information",
    reference: request.reference,
    serviceType: request.service_type,
    sections: [
      {
        heading: "Customer Details",
        data: customerInformation,
      },
    ],
  });

  files.push({
    name: "Customer Information.pdf",
    buffer: customerPdf,
  });

  // -------------------------------------------------------
  // 3. DOWNLOAD ORIGINAL SUPABASE DOCUMENTS
  // -------------------------------------------------------

  const documents = Array.isArray(request.documents)
    ? request.documents
    : [];

  let submittedCount = 0;
  let completedCount = 0;

  const manifestDocuments = [];

  for (let index = 0; index < documents.length; index++) {
    const document = documents[index];

    if (!document.storage_path) {
      console.warn(
        "Skipping document without storage path:",
        document.id
      );
      continue;
    }

    const buffer = await downloadPrivateDocument(
      document.storage_path,
      document.storage_bucket
    );

    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error(
        `Downloaded document is empty: ${document.file_name}`
      );
    }

    const isAdminDocument = Boolean(
      document.uploaded_by_admin_id
    );

    const folder = isAdminDocument
      ? "Completed Documents"
      : "Submitted Documents";

    if (isAdminDocument) {
      completedCount++;
    } else {
      submittedCount++;
    }

    const safeName = safeFileName(document.file_name);
    const number = String(index + 1).padStart(2, "0");

    files.push({
      name: `${folder}/${number}_${safeName}`,
      buffer,
    });

    manifestDocuments.push({
      fileName: document.file_name,
      documentType: document.document_type,
      mimeType: document.mime_type,
      fileSize: document.file_size,
      uploadedBy: isAdminDocument ? "ADMIN" : "CUSTOMER",
      uploadedAt: document.created_at,
    });
  }

  // -------------------------------------------------------
  // 4. DOCUMENT MANIFEST PDF
  // -------------------------------------------------------

  const manifest = {
    reference: request.reference,
    serviceType: request.service_type,
    totalDocuments: submittedCount + completedCount,
    submittedDocuments: submittedCount,
    completedDocuments: completedCount,
  };

  const manifestPdf = await createReadablePdf({
    title: "Document Manifest",
    reference: request.reference,
    serviceType: request.service_type,
    sections: [
      {
        heading: "Document Summary",
        data: manifest,
      },
      {
        heading: "Document Register",
        data: {
          documents: manifestDocuments,
        },
      },
    ],
  });

  files.push({
    name: "Document Manifest.pdf",
    buffer: manifestPdf,
  });

  return {
    reference: request.reference,
    serviceType: request.service_type,
    files,
  };
}
