
import {
  submitCacServiceRequest,
  getCustomerServiceRequests,
  getCustomerServiceRequestDetails,
  getCustomerServiceDocumentDownload,
} from "./services.service.js";

// =========================================================
// GET AUTHENTICATED CUSTOMER ID
// =========================================================

function getUserId(req) {
  return (
    req?.user?.id ||
    req?.user?.userId ||
    req?.auth?.userId ||
    req?.auth?.id ||
    null
  );
}

// =========================================================
// ERROR RESPONSE
// =========================================================

function sendError(res, error, fallbackMessage) {
  console.error("CUSTOMER SERVICES ERROR:", error);

  const status =
    Number(error?.status || error?.statusCode) || 500;

  return res.status(status).json({
    success: false,
    message: error?.message || fallbackMessage,
    code: error?.code || "SERVICE_REQUEST_FAILED",
  });
}

// =========================================================
// SUBMIT CAC REQUEST
// =========================================================

export async function submitCacRequestController(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const result = await submitCacServiceRequest({
      userId,
      body: req.body,
      files: req.files || {},
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to submit CAC registration request."
    );
  }
}

// =========================================================
// LIST CUSTOMER SERVICE REQUESTS
// =========================================================

export async function listCustomerServiceRequests(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const result = await getCustomerServiceRequests({
      userId,
      limit: req.query.limit,
      offset: req.query.offset,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load your service requests."
    );
  }
}

// =========================================================
// GET ONE CUSTOMER SERVICE REQUEST
// =========================================================

export async function getCustomerServiceRequestController(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const result = await getCustomerServiceRequestDetails({
      userId,
      requestId: req.params.requestId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load service request details."
    );
  }
}

// =========================================================
// GET CUSTOMER DOCUMENT DOWNLOAD LINK
// =========================================================

export async function getCustomerServiceDocumentController(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const result = await getCustomerServiceDocumentDownload({
      userId,
      requestId: req.params.requestId,
      documentId: req.params.documentId,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to generate document download link."
    );
  }
}
