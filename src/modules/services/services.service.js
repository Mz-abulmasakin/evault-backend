
import { randomBytes } from "node:crypto";

import db from "../../config/database.js";

import {
  createServiceRequest,
  createServiceRequestDocument,
  findServiceRequestByUser,
  findServiceRequestsByUser,
  findCustomerServiceDocument,
  findCustomerServiceDocuments,
} from "./services.repository.js";

import {
  createNotification,
} from "../notification/notification.repository.js";

import {
  uploadPrivateDocument,
  createPrivateDocumentUrl,
  deletePrivateDocument,
} from "../../services/supabase.storage.service.js";

// =========================================================
// ERROR HELPER
// =========================================================

function serviceError(
  message,
  status = 400,
  code = "SERVICE_REQUEST_ERROR"
) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  return error;
}

// =========================================================
// CUSTOMER AUTHENTICATION VALIDATION
// =========================================================

function validateUserId(userId) {
  if (!userId) {
    throw serviceError(
      "Authenticated user is required.",
      401,
      "USER_ID_REQUIRED"
    );
  }
}

// =========================================================
// PARSE REQUEST DETAILS
// =========================================================

function parseDetails(body = {}) {
  let details = body.details ?? body;

  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      throw serviceError("Invalid service request details.");
    }
  }

  if (
    !details ||
    typeof details !== "object" ||
    Array.isArray(details)
  ) {
    throw serviceError(
      "Valid service request details are required."
    );
  }

  let personnel = details.personnel;

  if (typeof personnel === "string") {
    try {
      personnel = JSON.parse(personnel);
    } catch {
      throw serviceError("Invalid personnel information.");
    }
  }

  if (!Array.isArray(personnel)) {
    throw serviceError(
      "Personnel information is required."
    );
  }

  return {
    ...details,
    personnel,
  };
}

// =========================================================
// VALIDATE IMAGE CONTENT
// =========================================================

function validateImageFile(file, label) {
  if (
    !file ||
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length === 0
  ) {
    throw serviceError(`${label} is required.`);
  }

  if (file.buffer.length > 10 * 1024 * 1024) {
    throw serviceError(
      `${label} must not exceed 10 MB.`
    );
  }

  const buffer = file.buffer;

  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;

  const isPng =
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([
        137, 80, 78, 71,
        13, 10, 26, 10,
      ])
    );

  if (!isJpeg && !isPng) {
    throw serviceError(
      `${label} must be a valid JPEG or PNG image.`
    );
  }

  const actualMime = isJpeg
    ? "image/jpeg"
    : "image/png";

  if (file.mimetype !== actualMime) {
    throw serviceError(
      `${label} file type does not match its actual contents.`
    );
  }

  return actualMime;
}

// =========================================================
// SANITIZE FILE NAME
// =========================================================

function safeFileName(name) {
  return String(name || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
}

// =========================================================
// VALIDATE CAC INFORMATION
// =========================================================

function validateCacDetails(details) {
  const entityType = String(details.entityType || "")
    .trim()
    .toLowerCase();

  const supportedTypes = [
    "business",
    "ltd",
    "ngo",
  ];

  if (!supportedTypes.includes(entityType)) {
    throw serviceError("Invalid CAC entity type.");
  }

  const proposedNames = Array.isArray(details.proposedNames)
    ? details.proposedNames
    : [];

  const requiredNames = entityType === "ngo" ? 3 : 2;

  if (
    proposedNames.filter(
      (name) =>
        typeof name === "string" && name.trim()
    ).length < requiredNames
  ) {
    throw serviceError(
      `Please provide at least ${requiredNames} proposed names.`
    );
  }

  if (!String(details.officeAddress || "").trim()) {
    throw serviceError("Office address is required.");
  }

  if (!String(details.businessNature || "").trim()) {
    throw serviceError("Business nature is required.");
  }

  if (entityType === "ltd") {
    const capital = Number(details.shareCapital);

    if (!Number.isFinite(capital) || capital < 1000000) {
      throw serviceError(
        "Limited liability company share capital must be at least ₦1,000,000."
      );
    }
  }

  const minimumPersonnel = entityType === "business" ? 1 : 2;

  if (details.personnel.length < minimumPersonnel) {
    throw serviceError(
      `At least ${minimumPersonnel} personnel record(s) are required.`
    );
  }

  if (details.personnel.length > 10) {
    throw serviceError(
      "A maximum of 10 personnel records is allowed."
    );
  }

  details.personnel.forEach((person, index) => {
    if (!String(person.fullName || "").trim()) {
      throw serviceError(
        `Personnel ${index + 1}: full name is required.`
      );
    }

    if (!/^\d{11}$/.test(String(person.nin || "").trim())) {
      throw serviceError(
        `Personnel ${index + 1}: valid 11-digit NIN is required.`
      );
    }

    if (!String(person.role || "").trim()) {
      throw serviceError(
        `Personnel ${index + 1}: role is required.`
      );
    }
  });

  return entityType;
}

// =========================================================
// GENERATE SERVICE REFERENCE
// =========================================================

function generateReference() {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  const random = randomBytes(4)
    .toString("hex")
    .toUpperCase();

  return `EVS-CAC-${date}-${random}`;
}

// =========================================================
// SUBMIT CAC REQUEST
// =========================================================

export async function submitCacServiceRequest({
  userId,
  body,
  files = {},
}) {
  if (!userId) {
    throw serviceError(
      "Authenticated user is required.",
      401,
      "USER_ID_REQUIRED"
    );
  }

  const details = parseDetails(body);
  const entityType = validateCacDetails(details);

  const personnel = details.personnel;

  // Check all required documents before uploading.
  const documentsToUpload = [];

  personnel.forEach((person, index) => {
    const passportField = `personnel_${index}_passport`;
    const signatureField = `personnel_${index}_signature`;

    const passport = files[passportField]?.[0];
    const signature = files[signatureField]?.[0];

    if (!passport) {
      throw serviceError(
        `Passport photograph is missing for personnel ${index + 1}.`
      );
    }

    if (!signature) {
      throw serviceError(
        `Signature is missing for personnel ${index + 1}.`
      );
    }

    documentsToUpload.push({
      file: passport,
      type: `PERSONNEL_${index + 1}_PASSPORT`,
      label: `Personnel ${index + 1} passport`,
      personIndex: index,
    });

    documentsToUpload.push({
      file: signature,
      type: `PERSONNEL_${index + 1}_SIGNATURE`,
      label: `Personnel ${index + 1} signature`,
      personIndex: index,
    });
  });

  // Validate image contents before database or storage work.
  for (const document of documentsToUpload) {
    document.mimeType = validateImageFile(
      document.file,
      document.label
    );
  }

  const reference = generateReference();
  const uploadedObjects = [];
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Create request.
    const request = await createServiceRequest(
      {
        userId,
        reference,
        serviceType: "CAC",
        entityType,
        details: {
          proposedNames: details.proposedNames,
          officeAddress: details.officeAddress,
          businessNature: details.businessNature,
          shareCapital: details.shareCapital ?? null,
          personnel: personnel.map((person) => ({
            fullName: String(person.fullName).trim(),
            nin: String(person.nin).trim(),
            role: String(person.role).trim(),
          })),
        },
        amount: 0,
        currency: "NGN",
        status: "SUBMITTED",
        paymentStatus: "PENDING",
      },
      client
    );

    // Upload private personnel documents.
    for (const document of documentsToUpload) {
      const uploaded = await uploadPrivateDocument({
        buffer: document.file.buffer,
        mimeType: document.mimeType,
        folder: `service-requests/${request.id}`,
      });

      uploadedObjects.push(uploaded.path);

      await createServiceRequestDocument(
        {
          requestId: request.id,
          uploadedByUserId: userId,
          documentType: document.type,
          fileName: safeFileName(
            document.file.originalname
          ),
          mimeType: uploaded.mimeType,
          fileSize: uploaded.size,
          storageBucket: uploaded.bucket,
          storagePath: uploaded.path,
          visibility: "ADMIN",
          metadata: {
            personnelIndex: document.personIndex,
          },
        },
        client
      );
    }

    // Notify customer.
    await createNotification(
      {
        userId,
        title: "CAC Registration Submitted",
        message: `Your CAC registration request ${reference} has been submitted successfully and is awaiting processing.`,
        type: "INFO",
        metadata: {
          serviceType: "CAC",
          requestId: request.id,
          reference,
          status: "SUBMITTED",
        },
      },
      client
    );

    await client.query("COMMIT");

    return {
      request: {
        id: request.id,
        reference: request.reference,
        serviceType: request.service_type,
        entityType: request.entity_type,
        status: request.status,
        paymentStatus: request.payment_status,
        amount: Number(request.amount),
        submittedAt: request.submitted_at,
      },
      message:
        "CAC registration request submitted successfully.",
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    // Remove uploaded files if request creation fails.
    for (const objectPath of uploadedObjects) {
      try {
        await deletePrivateDocument(objectPath);
      } catch (cleanupError) {
        console.error(
          "CAC DOCUMENT CLEANUP ERROR:",
          cleanupError.message
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

// =========================================================
// CUSTOMER: LIST SERVICE REQUESTS
// =========================================================

export async function getCustomerServiceRequests({
  userId,
  limit = 50,
  offset = 0,
}) {
  validateUserId(userId);

  const safeLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || 50, 1),
    100
  );

  const safeOffset = Math.max(
    Number.parseInt(offset, 10) || 0,
    0
  );

  const requests = await findServiceRequestsByUser(
    userId,
    safeLimit,
    safeOffset
  );

  return {
    requests,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: requests.length,
      hasMore: requests.length === safeLimit,
    },
  };
}

// =========================================================
// CUSTOMER: VIEW ONE SERVICE REQUEST
// =========================================================

export async function getCustomerServiceRequestDetails({
  userId,
  requestId,
}) {
  validateUserId(userId);

  if (!requestId) {
    throw serviceError(
      "Service request ID is required."
    );
  }

  // Repository checks request ownership.
  const request = await findServiceRequestByUser(
    requestId,
    userId
  );

  if (!request) {
    throw serviceError(
      "Service request not found.",
      404,
      "SERVICE_REQUEST_NOT_FOUND"
    );
  }

  // Only CUSTOMER-visible documents are returned.
  const documents = await findCustomerServiceDocuments(
    request.id,
    userId
  );

  const documentsWithLinks = await Promise.all(
    documents.map(async (document) => {
      const signedUrl = await createPrivateDocumentUrl(
        document.storage_path
      );

      return {
        id: document.id,
        requestId: document.request_id,
        documentType: document.document_type,
        fileName: document.file_name,
        mimeType: document.mime_type,
        fileSize: Number(document.file_size),
        createdAt: document.created_at,
        downloadUrl: signedUrl.url,
        downloadUrlExpiresIn: signedUrl.expiresIn,
      };
    })
  );

  return {
    request,
    documents: documentsWithLinks,
  };
}

// =========================================================
// CUSTOMER: GET ONE DOCUMENT DOWNLOAD LINK
// =========================================================

export async function getCustomerServiceDocumentDownload({
  userId,
  requestId,
  documentId,
}) {
  validateUserId(userId);

  if (!requestId || !documentId) {
    throw serviceError(
      "Service request ID and document ID are required."
    );
  }

  // This query checks:
  // 1. The document belongs to the specified request.
  // 2. The request belongs to the authenticated customer.
  // 3. The document visibility is CUSTOMER.
  const document = await findCustomerServiceDocument(
    requestId,
    documentId,
    userId
  );

  if (!document) {
    throw serviceError(
      "Document not found or access denied.",
      404,
      "SERVICE_DOCUMENT_NOT_FOUND"
    );
  }

  const signedUrl = await createPrivateDocumentUrl(
    document.storage_path
  );

  return {
    document: {
      id: document.id,
      requestId: document.request_id,
      documentType: document.document_type,
      fileName: document.file_name,
      mimeType: document.mime_type,
      fileSize: Number(document.file_size),
      createdAt: document.created_at,
    },
    downloadUrl: signedUrl.url,
    downloadUrlExpiresIn: signedUrl.expiresIn,
  };
}
