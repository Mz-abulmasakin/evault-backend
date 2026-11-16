
import {
  getAdminServiceRequests,
  getAdminServiceRequestDetails,
  processAdminServiceRequest,
  uploadCompletedServiceDocuments,
} from "./services.admin.service.js";

function sendError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode
      ? error.message
      : fallbackMessage,
  });
}

// =========================================================
// LIST SERVICE REQUESTS
// =========================================================

export async function listServiceRequests(req, res) {
  try {
    const result = await getAdminServiceRequests(
      req.query || {}
    );

    return res.status(200).json({
      success: true,
      message: "Service requests retrieved successfully.",
      ...result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to retrieve service requests."
    );
  }
}

// =========================================================
// GET SERVICE REQUEST DETAILS
// =========================================================

export async function getServiceRequestDetails(req, res) {
  try {
    const request = await getAdminServiceRequestDetails(
      req.params.identifier
    );

    return res.status(200).json({
      success: true,
      message: "Service request retrieved successfully.",
      data: request,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to retrieve service request."
    );
  }
}

// =========================================================
// PROCESS SERVICE REQUEST
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
      message: "Service request status updated successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update service request."
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
      message: result.message,
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to upload completed service documents."
    );
  }
}
