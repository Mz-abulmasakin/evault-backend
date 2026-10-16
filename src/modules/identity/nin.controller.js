/**
 * =========================================================
 * eVAULT NIN CONTROLLER
 * =========================================================
 */

import {
  getNinService,
  submitNin,
  getNinRequestStatus,
  getNinHistory,
  getNinDocument,
  recoverNinByPhone,
  recoverNinByDemographics,
} from "./nin.service.js";

function getAuthenticatedUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

function getErrorStatus(error, fallback = 500) {
  return (
    Number(error?.statusCode) ||
    Number(error?.status) ||
    fallback
  );
}

/**
 * GET /api/v1/identity/nin/service
 */
export async function getNinServiceController(
  req,
  res
) {
  try {
    const service = await getNinService();

    return res.status(200).json({
      success: true,
      data: service,
    });
  } catch (error) {
    console.error(
      "GET NIN SERVICE ERROR:",
      error
    );

    return res
      .status(getErrorStatus(error))
      .json({
        success: false,
        code:
          error?.code ||
          "NIN_SERVICE_ERROR",
        message:
          error?.message ||
          "Unable to load the NIN service.",
      });
  }
}

/**
 * POST /api/v1/identity/nin
 */
export async function submitNinController(
  req,
  res
) {
  try {
    const userId =
      getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        code:
          "AUTHENTICATION_REQUIRED",
        message:
          "Authentication required.",
      });
    }

    const {
      nin,
      validationType = "full",
      slipType = null,
      cardType = null,
      transactionPin,
      idempotencyKey = null,
    } = req.body || {};

    const result = await submitNin({
      userId,
      nin,
      validationType,
      cardType:
        cardType ??
        slipType ??
        "standard",
      slipType,
      transactionPin,
      idempotencyKey,
    });

    return res.status(201).json({
      success: true,
      message:
        result?.status === "SUCCESS"
          ? "NIN verification completed successfully."
          : "NIN verification submitted successfully.",
      data: result,
    });
  } catch (error) {
    console.error(
      "SUBMIT NIN ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(error, 400)
      )
      .json({
        success: false,
        code:
          error?.code ||
          "NIN_SUBMIT_ERROR",
        message:
          error?.message ||
          "Unable to submit NIN verification.",
      });
  }
}

/**
 * GET /api/v1/identity/nin/:id
 */
export async function getNinStatusController(
  req,
  res
) {
  try {
    const userId =
      getAuthenticatedUserId(req);

    const requestId =
      req.params?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code:
          "AUTHENTICATION_REQUIRED",
        message:
          "Authentication required.",
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        code:
          "NIN_REQUEST_ID_REQUIRED",
        message:
          "NIN request ID is required.",
      });
    }

    const result =
      await getNinRequestStatus(
        requestId,
        userId
      );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(
      "GET NIN STATUS ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(error, 400)
      )
      .json({
        success: false,
        code:
          error?.code ||
          "NIN_STATUS_ERROR",
        message:
          error?.message ||
          "Unable to retrieve the NIN verification status.",
      });
  }
}

/**
 * GET /api/v1/identity/nin/history
 */
export async function getNinHistoryController(
  req,
  res
) {
  try {
    const userId =
      getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        code:
          "AUTHENTICATION_REQUIRED",
        message:
          "Authentication required.",
      });
    }

    const history =
      await getNinHistory(userId);

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error(
      "GET NIN HISTORY ERROR:",
      error
    );

    return res
      .status(getErrorStatus(error))
      .json({
        success: false,
        code:
          error?.code ||
          "NIN_HISTORY_ERROR",
        message:
          error?.message ||
          "Unable to load NIN history.",
      });
  }
}

/**
 * POST /api/v1/identity/nin/recover/phone
 */
export async function recoverNinByPhoneController(
  req,
  res
) {
  try {
    const userId =
      getAuthenticatedUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        code:
          "AUTHENTICATION_REQUIRED",
        message:
          "Authentication required.",
      });
    }

    const {
      phone,
      cardType = "standard",
      slipType = null,
      transactionPin,
      idempotencyKey = null,
    } = req.body || {};

    const result =
      await recoverNinByPhone({
        userId,
        phone,
        cardType:
          cardType ??
          slipType ??
          "standard",
        transactionPin,
        idempotencyKey,
      });

    return res.status(201).json({
      success: true,
      message:
        result?.status === "SUCCESS"
          ? "NIN recovery completed successfully."
          : "NIN recovery submitted successfully.",
      data: result,
    });
  } catch (error) {
    console.error(
      "RECOVER NIN BY PHONE ERROR:",
      error
    );

    return res
      .status(
        getErrorStatus(error, 400)
      )
      .json({
        success: false,
        code:
          error?.code ||
          "NIN_RECOVERY_ERROR",
        message:
          error?.message ||
          "Unable to recover NIN by phone number.",
      });
  }
}

/**
 * POST /api/v1/identity/nin/recover/demographics
 *
 * This is intentionally not implemented
 * against NetworkDataSub.
 */
export async function recoverNinByDemographicsController(
  req,
  res
) {
  try {
    await recoverNinByDemographics(
      req.body || {}
    );

    return res.status(501).json({
      success: false,
      code:
        "DEMOGRAPHIC_RECOVERY_NOT_SUPPORTED",
      message:
        "Demographic NIN recovery is not currently supported. Please use phone-number recovery.",
    });
  } catch (error) {
    return res
      .status(
        getErrorStatus(error, 501)
      )
      .json({
        success: false,
        code:
          error?.code ||
          "DEMOGRAPHIC_RECOVERY_NOT_SUPPORTED",
        message:
          error?.message ||
          "Demographic NIN recovery is not currently supported.",
      });
  }
}

/**
 * GET /api/v1/identity/nin/:id/download
 *
 * The provider PDF is stored server-side as
 * Base64 in identity_requests.result.
 *
 * The mobile app receives only binary PDF
 * bytes from this authenticated endpoint.
 */
export async function downloadNinController(
  req,
  res
) {
  try {
    const userId =
      getAuthenticatedUserId(req);

    const requestId =
      req.params?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code:
          "AUTHENTICATION_REQUIRED",
        message:
          "Authenticated user is required.",
      });
    }

    if (!requestId) {
      return res.status(400).json({
        success: false,
        code:
          "NIN_REQUEST_ID_REQUIRED",
        message:
          "NIN request ID is required.",
      });
    }

    const document =
      await getNinDocument(
        requestId,
        userId
      );

    const encodedPdf =
      document?.pdfBase64;

    if (
      typeof encodedPdf !==
        "string" ||
      !encodedPdf.trim()
    ) {
      return res.status(409).json({
        success: false,
        code:
          "NIN_PDF_NOT_AVAILABLE",
        message:
          "The NIN verification succeeded, but the stored PDF document is not available.",
      });
    }

    let cleanBase64 =
      encodedPdf.trim();

    if (
      cleanBase64.startsWith(
        "data:application/pdf"
      )
    ) {
      const commaIndex =
        cleanBase64.indexOf(",");

      if (commaIndex !== -1) {
        cleanBase64 =
          cleanBase64.slice(
            commaIndex + 1
          );
      }
    }

    cleanBase64 =
      cleanBase64.replace(
        /\s+/g,
        ""
      );

    const pdfBuffer =
      Buffer.from(
        cleanBase64,
        "base64"
      );

    const pdfHeader =
      pdfBuffer
        .subarray(0, 5)
        .toString("ascii");

    if (pdfHeader !== "%PDF-") {
      return res.status(500).json({
        success: false,
        code:
          "INVALID_NIN_PDF",
        message:
          "The stored NIN document is not a valid PDF.",
      });
    }

    const resolvedRequestId =
      document?.requestId ||
      requestId;

    const fileName =
      `NIN-${resolvedRequestId}.pdf`;

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "X-NIN-Request-Id",
      String(
        resolvedRequestId
      )
    );

    res.setHeader(
      "Access-Control-Expose-Headers",
      "Content-Disposition, X-NIN-Request-Id"
    );

    res.setHeader(
      "Content-Length",
      String(pdfBuffer.length)
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    res.setHeader(
      "Cache-Control",
      "private, no-store, max-age=0"
    );

    return res.send(pdfBuffer);
  } catch (error) {
    console.error(
      "DOWNLOAD NIN CONTROLLER ERROR:",
      error
    );

    if (
      error?.code ===
      "NIN_REQUEST_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        code: error.code,
        message:
          "NIN request not found.",
      });
    }

    if (
      error?.code ===
      "NIN_DOCUMENT_NOT_AVAILABLE"
    ) {
      return res.status(409).json({
        success: false,
        code: error.code,
        message:
          "NIN document is not available because the request was not completed successfully.",
      });
    }

    return res
      .status(
        getErrorStatus(error)
      )
      .json({
        success: false,
        code:
          error?.code ||
          "NIN_DOWNLOAD_ERROR",
        message:
          error?.message ||
          "Unable to download NIN document.",
      });
  }
}