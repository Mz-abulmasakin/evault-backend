 // src/modules/identity/ipe.controller.js

import {
  getIpeService,
  submitIpe,
  checkIpeStatus,
  getIpeHistory,
  getIpeRequest,
} from "./ipe.service.js";


/**
 * =========================================================
 * GET IPE SERVICE
 * =========================================================
 *
 * GET /identity/ipe/service
 * =========================================================
 */
export async function getIpeServiceController(
  req,
  res
) {
  try {
    const service =
      await getIpeService();

    return res.status(200).json({
      success: true,
      data: service,
    });

  } catch (error) {
    console.error(
      "GET IPE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load IPE Clearance service.",
    });
  }
}


/**
 * =========================================================
 * SUBMIT IPE
 * =========================================================
 *
 * POST /identity/ipe
 * =========================================================
 */
export async function submitIpeController(
  req,
  res
) {
  try {
    const userId =
      req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user is required.",
      });
    }

    const {
      trackingId,
      oldTrackingId,
      nin,
      fullName,
      phoneNumber,
      note,
      transactionPin,
      ownershipConfirmed,
      idempotencyKey,
    } = req.body || {};


    const result =
      await submitIpe({
        userId,

        trackingId,

        oldTrackingId,

        nin,

        fullName,

        phoneNumber,

        note,

        transactionPin,

        ownershipConfirmed,

        idempotencyKey,
      });


    return res.status(201).json({
      success: true,

      message:
        result.status === "SUCCESS"
          ? "IPE Clearance completed successfully."
          : "IPE Clearance request submitted successfully.",

      data: result,
    });

  } catch (error) {
    console.error(
      "SUBMIT IPE ERROR:",
      error
    );

    const message =
      error.message ||
      "Unable to submit IPE Clearance.";

    let status = 400;

    if (
      message
        .toLowerCase()
        .includes("authenticated user")
    ) {
      status = 401;
    }

    return res.status(status).json({
      success: false,
      message,
    });
  }
}


/**
 * =========================================================
 * GET IPE STATUS
 * =========================================================
 *
 * GET /identity/ipe/:id
 * =========================================================
 */
export async function getIpeStatusController(
  req,
  res
) {
  try {
    const userId =
      req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user is required.",
      });
    }

    const requestId =
      req.params.id;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message:
          "IPE request ID is required.",
      });
    }


    const result =
      await checkIpeStatus({
        userId,
        requestId,
      });


    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "GET IPE STATUS ERROR:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message ||
        "IPE Clearance request not found.",
    });
  }
}


/**
 * =========================================================
 * GET IPE HISTORY
 * =========================================================
 *
 * GET /identity/ipe/history
 * =========================================================
 */
export async function getIpeHistoryController(
  req,
  res
) {
  try {
    const userId =
      req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user is required.",
      });
    }

    const limit =
      Number(
        req.query.limit || 20
      );

    const offset =
      Number(
        req.query.offset || 0
      );


    const requests =
      await getIpeHistory({
        userId,
        limit,
        offset,
      });


    return res.status(200).json({
      success: true,
      data: requests,
    });

  } catch (error) {
    console.error(
      "GET IPE HISTORY ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to load IPE history.",
    });
  }
}


/**
 * =========================================================
 * GET ONE IPE REQUEST
 * =========================================================
 *
 * GET /identity/ipe/request/:id
 * =========================================================
 */
export async function getIpeRequestController(
  req,
  res
) {
  try {
    const userId =
      req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user is required.",
      });
    }

    const requestId =
      req.params.id;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message:
          "IPE request ID is required.",
      });
    }


    const result =
      await getIpeRequest({
        userId,
        requestId,
      });


    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "GET IPE REQUEST ERROR:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message ||
        "IPE Clearance request not found.",
    });
  }
}


/**
 * =========================================================
 * DOWNLOAD IPE RESULT
 * =========================================================
 *
 * The route should point to this controller using:
 *
 * GET /identity/ipe/:id/download
 * =========================================================
 */
export async function downloadIpeController(
  req,
  res
) {
  try {
    const userId =
      req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authenticated user is required.",
      });
    }

    const requestId =
      req.params.id;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        message:
          "IPE request ID is required.",
      });
    }


    const request =
      await getIpeRequest({
        userId,
        requestId,
      });


    if (
      request.status !==
      "SUCCESS"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "The IPE Clearance document is not available yet.",
      });
    }


    if (
      !request.document_url
    ) {
      return res.status(404).json({
        success: false,
        message:
          "The IPE Clearance document is no longer available.",
      });
    }


    return res.status(200).json({
      success: true,

      data: {
        documentUrl:
          request.document_url,
      },
    });

  } catch (error) {
    console.error(
      "DOWNLOAD IPE ERROR:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message ||
        "Unable to retrieve IPE document.",
    });
  }
}