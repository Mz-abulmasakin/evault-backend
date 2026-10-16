
/**
 * =========================================================
 * eVAULT BVN CONTROLLER
 * =========================================================
 */

import {
  getBvnService,
  submitBvn,
  getBvnRequest,
  getBvnHistory,
  getBvnDocument,
} from "./bvn.service.js";

import {
  getBvnPhoneRecoveryService,
  recoverBvnByPhone,
  getBvnRecoveryRequest,
} from "./bvnRecovery.service.js";


function getUserId(req) {
  return (
    req.user?.id ??
    req.user?.userId
  );
}


function sendError(
  res,
  error,
  fallbackMessage
) {
  return res.status(
    error?.status ||
      error?.statusCode ||
      500
  ).json({
    success: false,

    message:
      error?.message ||
      fallbackMessage,

    code:
      error?.code ||
      null,
  });
}


/**
 * =========================================================
 * GET BVN SERVICE
 * =========================================================
 */

export async function getBvnServiceController(
  req,
  res
) {
  try {
    const result =
      await getBvnService();

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN service controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to load BVN service."
    );
  }
}


/**
 * =========================================================
 * POST BVN VALIDATION
 * =========================================================
 *
 * EXISTING FLOW.
 *
 * DO NOT CHANGE.
 * =========================================================
 */

export async function submitBvnController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    const {
      bvn,
      cardType,
      slipType,
      transactionPin,
      ownershipConfirmed =
        false,
      idempotencyKey =
        null,
    } = req.body || {};

    const result =
      await submitBvn({
        userId,

        bvn,

        cardType:
          cardType ||
          slipType ||
          "standard",

        transactionPin,

        ownershipConfirmed,

        idempotencyKey,
      });

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN submit controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to validate BVN."
    );
  }
}


/**
 * =========================================================
 * GET BVN STATUS
 * =========================================================
 */

export async function getBvnStatusController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    const result =
      await getBvnRequest(
        req.params.id,
        userId
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN status controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to retrieve BVN validation."
    );
  }
}


/**
 * =========================================================
 * GET BVN HISTORY
 * =========================================================
 */

export async function getBvnHistoryController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    const result =
      await getBvnHistory(
        userId
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN history controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to retrieve BVN history."
    );
  }
}


/**
 * =========================================================
 * GET BVN DOWNLOAD
 * =========================================================
 */

export async function downloadBvnController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    const document =
      await getBvnDocument(
        req.params.id,
        userId
      );

    const pdfBuffer =
      Buffer.from(
        document.pdfBase64,
        "base64"
      );

    if (
      pdfBuffer.length < 4 ||
      pdfBuffer
        .subarray(0, 4)
        .toString() !== "%PDF"
    ) {
      const error =
        new Error(
          "Stored BVN document is not a valid PDF."
        );

      error.status = 500;

      throw error;
    }

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${document.fileName}"`
    );

    res.setHeader(
      "Content-Length",
      String(
        pdfBuffer.length
      )
    );

    return res
      .status(200)
      .send(pdfBuffer);

  } catch (error) {
    console.error(
      "BVN download controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to download BVN slip."
    );
  }
}


/**
 * =========================================================
 * GET BVN PHONE RECOVERY SERVICE
 * =========================================================
 *
 * GET
 * /api/v1/identity/bvn/phone-recovery/service
 * =========================================================
 */

export async function getBvnPhoneRecoveryServiceController(
  req,
  res
) {
  try {
    const result =
      await getBvnPhoneRecoveryService();

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN phone recovery service controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to load BVN recovery service."
    );
  }
}


/**
 * =========================================================
 * POST BVN PHONE RECOVERY
 * =========================================================
 *
 * POST
 * /api/v1/identity/bvn/phone-recovery
 *
 * Body:
 *
 * {
 *   phone,
 *   phoneNumber,
 *   transactionPin,
 *   ownershipConfirmed,
 *   idempotencyKey
 * }
 * =========================================================
 */

export async function recoverBvnByPhoneController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    const {
      phone,
      phoneNumber,
      transactionPin,
      ownershipConfirmed =
        false,
      idempotencyKey =
        null,
    } = req.body || {};

    const result =
      await recoverBvnByPhone({
        userId,

        phone,

        phoneNumber,

        transactionPin,

        ownershipConfirmed,

        idempotencyKey,
      });

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN phone recovery controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to recover BVN using phone number."
    );
  }
}


/**
 * =========================================================
 * GET BVN RECOVERY REQUEST
 * =========================================================
 */

export async function getBvnRecoveryRequestController(
  req,
  res
) {
  try {
    const userId =
      getUserId(req);

    const result =
      await getBvnRecoveryRequest(
        req.params.id,
        userId
      );

    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "BVN recovery status controller error:",
      error
    );

    return sendError(
      res,
      error,
      "Unable to retrieve BVN recovery request."
    );
  }
}


export default {
  getBvnServiceController,

  submitBvnController,

  getBvnStatusController,

  getBvnHistoryController,

  downloadBvnController,

  getBvnPhoneRecoveryServiceController,

  recoverBvnByPhoneController,

  getBvnRecoveryRequestController,
};
