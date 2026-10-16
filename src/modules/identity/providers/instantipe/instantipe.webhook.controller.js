 import {
  findIdentityRequestByProviderReference,
  updateIdentityRequestResult,
} from "../../identityRequest.repository.js";

import {
  findTransactionByReference,
  updateTransactionStatus,
} from "../../../transactions/transaction.repository.js";

import {
  refundFailedNinRequest,
} from "../../nin.service.js";

import {
  verifyInstantIPEWebhook,
} from "./instantipe.webhook.js";

/**
 * =========================================================
 * EXTRACT WEBHOOK REFERENCE
 * =========================================================
 */
function getReference(payload) {
  return (
    payload?.data?.reference ||
    payload?.data?.request?.reference ||
    payload?.reference ||
    payload?.request?.reference ||
    null
  );
}

/**
 * =========================================================
 * EXTRACT WEBHOOK STATE
 * =========================================================
 */
function getState(payload) {
  return (
    payload?.data?.state ||
    payload?.data?.status ||
    payload?.state ||
    payload?.status ||
    null
  );
}

/**
 * =========================================================
 * EXTRACT DOCUMENT
 * =========================================================
 */
function getDocumentUrl(payload) {
  return (
    payload?.data?.result?.download ||
    payload?.data?.result?.document?.download ||
    payload?.data?.download ||
    payload?.data?.document_url ||
    null
  );
}

/**
 * =========================================================
 * HANDLE WEBHOOK
 * =========================================================
 */
export async function instantIPEWebhookController(
  req,
  res
) {
  try {
    const rawBody =
      Buffer.isBuffer(
        req.body
      )
        ? req.body.toString(
            "utf8"
          )
        : String(
            req.body || ""
          );

    const signature =
      req.headers[
        "x-instantipe-signature"
      ];

    const valid =
      verifyInstantIPEWebhook(
        rawBody,
        signature
      );

    if (!valid) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid webhook signature.",
      });
    }

    let payload;

    try {
      payload =
        JSON.parse(
          rawBody
        );
    } catch {
      return res.status(400).json({
        success: false,
        message:
          "Invalid JSON payload.",
      });
    }

    const event =
      req.headers[
        "x-instantipe-event"
      ] ||
      payload?.event ||
      null;

    const providerReference =
      getReference(
        payload
      );

    if (!providerReference) {
      /**
       * Acknowledge malformed/irrelevant event
       * rather than allowing InstantIPE to endlessly retry.
       */
      return res.status(200).json({
        success: true,
        message:
          "Webhook received without provider reference.",
      });
    }

    const request =
      await findIdentityRequestByProviderReference(
        providerReference
      );

    if (!request) {
      return res.status(200).json({
        success: true,
        message:
          "Webhook received. No matching Evault request.",
      });
    }

    const state =
      String(
        getState(payload) ||
          ""
      ).toLowerCase();

    const documentUrl =
      getDocumentUrl(
        payload
      );

    /**
     * -------------------------------------------------------
     * FAILURE
     * -------------------------------------------------------
     */
    if (
      state === "failed" ||
      event ===
        "validation.failed"
    ) {
      const providerError =
        payload?.data?.error ||
        payload?.error ||
        {};

      await refundFailedNinRequest(
        request.id,
        {
          errorCode:
            providerError?.code ||
            "PROVIDER_FAILED",

          errorMessage:
            providerError?.message ||
            payload?.data?.message ||
            payload?.message ||
            "NIN validation failed.",
        }
      );

      return res.status(200).json({
        success: true,

        message:
          "NIN failure processed and refund handled.",
      });
    }

    /**
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */
    if (
      state === "done" ||
      state === "success" ||
      state === "successful" ||
      state === "completed" ||
      event ===
        "validation.completed"
    ) {
      const updated =
        await updateIdentityRequestResult(
          request.id,
          {
            providerReference,

            providerStatus:
              state ||
              "done",

            status:
              "SUCCESS",

            result:
              payload?.data ||
              payload,

            documentUrl,

            documentExpiresAt:
              payload?.data
                ?.result
                ?.expires_at ||
              null,
          }
        );

      const payment =
        await findTransactionByReference(
          request.transaction_reference
        );

      if (
        payment &&
        payment.status !==
          "SUCCESS"
      ) {
        await updateTransactionStatus(
          payment.id,
          "SUCCESS"
        );
      }

      return res.status(200).json({
        success: true,

        message:
          "NIN validation completed.",

        requestId:
          updated.id,
      });
    }

    /**
     * -------------------------------------------------------
     * PROCESSING / PENDING
     * -------------------------------------------------------
     */
    const mappedStatus =
      state ===
      "processing"
        ? "PROCESSING"
        : "PENDING";

    await updateIdentityRequestResult(
      request.id,
      {
        providerReference,

        providerStatus:
          state ||
          "pending",

        status:
          mappedStatus,

        result:
          payload?.data ||
          payload,

        documentUrl,
      }
    );

    return res.status(200).json({
      success: true,

      message:
        "NIN validation status recorded.",
    });
  } catch (error) {
    console.error(
      "InstantIPE webhook error:",
      error
    );

    /**
     * Return 500 so provider can retry.
     */
    return res.status(500).json({
      success: false,

      message:
        "Webhook processing failed.",
    });
  }
}