
import { ZipArchive } from "archiver";

import {
  getAdminServiceRequests,
  getAdminServiceRequestDetails,
  processAdminServiceRequest,
  uploadCompletedServiceDocuments,
  getAdminServiceRequestZip,
} from "./services.admin.service.js";

// =========================================================
// ERROR HANDLER
// =========================================================

function sendError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (res.headersSent) {
    return res.destroy(error);
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallbackMessage,
  });
}

// =========================================================
// LIST SERVICE REQUESTS
// =========================================================

export async function listServiceRequests(req, res) {
  try {
    const result = await getAdminServiceRequests(req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve service requests."
    );
  }
}

// =========================================================
// GET SERVICE REQUEST DETAILS
// =========================================================

export async function getServiceRequestDetails(req, res) {
  try {
    const result = await getAdminServiceRequestDetails(
      req.params.identifier
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve service request details."
    );
  }
}

// =========================================================
// UPDATE SERVICE REQUEST STATUS
// =========================================================

export async function processServiceRequest(req, res) {
  try {
    const result = await processAdminServiceRequest({
      requestId: req.params.identifier,
      adminId: req.admin.adminId,
      status: req.body?.status,
      adminNotes: req.body?.adminNotes,
      rejectionReason: req.body?.rejectionReason,
    });

    return res.status(200).json({
      success: true,
      message: "Service request updated successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to update service request."
    );
  }
}

// =========================================================
// UPLOAD COMPLETED SERVICE DOCUMENTS
// =========================================================

export async function uploadServiceDocuments(req, res) {
  try {
    const result = await uploadCompletedServiceDocuments({
      requestId: req.params.identifier,
      adminId: req.admin.adminId,
      files: req.files || [],
      adminNotes: req.body?.adminNotes,
    });

    return res.status(200).json({
      success: true,
      message: "Service documents uploaded successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to upload service documents."
    );
  }
}

// =========================================================
// DOWNLOAD SERVICE REQUEST DOCUMENTS AS ZIP
// =========================================================

export async function downloadServiceRequestZip(req, res) {
  try {
    const result = await getAdminServiceRequestZip(
      req.params.identifier
    );

    if (!result || !Array.isArray(result.files) || result.files.length === 0) {
      const error = new Error("No downloadable documents were found.");
      error.statusCode = 404;
      throw error;
    }

    const safeReference = String(
      result.reference || "service-request"
    ).replace(/[^a-zA-Z0-9_-]/g, "_");

    // Archiver v8 uses the ZipArchive class.
    const archive = new ZipArchive({
      zlib: { level: 6 },
    });

    archive.on("warning", (error) => {
      console.warn("ZIP archive warning:", error);

      if (error.code !== "ENOENT") {
        archive.destroy(error);
      }
    });

    archive.on("error", (error) => {
      console.error("ZIP archive error:", error);
      res.destroy(error);
    });

    res.status(200);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeReference}_documents.zip"`
    );

    archive.pipe(res);

    for (const file of result.files) {
      archive.append(file.buffer, {
        name: file.name,
      });
    }

    await archive.finalize();
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to download service request documents."
    );
  }
}
