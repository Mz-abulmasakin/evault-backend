// src/modules/identity/ipe.service.js

import crypto from "crypto";

import db from "../../config/database.js";

import instantIpe from "./providers/instantipe/instantipe.client.js";

import {
  createIdentityRequest,
  findIdentityRequestById,
  findIdentityRequestByIdempotencyKey,
  updateProviderReference,
  updateIdentityRequestResult,
  findIdentityRequestsByUserId,
  findUserIdentityRequestById,
} from "./identityRequest.repository.js";

import {
  findWalletByUserId,
  findWalletForUpdate,
  debitWallet,
  creditWallet,
} from "../wallet/wallet.repository.js";

import {
  createTransaction,
  updateTransactionStatus,
} from "../transactions/transaction.repository.js";

import {
  verifyTransactionPin,
} from "../profile/profile.service.js";


/**
 * =========================================================
 * EVAULT IPE PRICE
 * =========================================================
 *
 * Customer-facing Evault price.
 *
 * This is NOT the provider's internal price.
 * =========================================================
 */
const EVAULT_IPE_PRICE =
  Number(
    process.env.EVAULT_IPE_CLEARANCE_PRICE ||
      550
  );


/**
 * =========================================================
 * NORMALIZE TRACKING ID
 * =========================================================
 */
function normalizeTrackingId(
  trackingId
) {
  const value =
    String(
      trackingId || ""
    )
      .trim()
      .replace(/\s+/g, "");

  if (!value) {
    throw new Error(
      "Tracking ID is required."
    );
  }

  if (value.length > 40) {
    throw new Error(
      "Tracking ID cannot exceed 40 characters."
    );
  }

  return value;
}


/**
 * =========================================================
 * NORMALIZE NIN
 * =========================================================
 */
function normalizeOptionalNin(
  nin
) {
  if (
    nin === null ||
    nin === undefined ||
    nin === ""
  ) {
    return null;
  }

  const value =
    String(nin)
      .replace(/\D/g, "");

  if (
    !/^\d{11}$/.test(value)
  ) {
    throw new Error(
      "NIN must contain exactly 11 digits."
    );
  }

  return value;
}


/**
 * =========================================================
 * HASH IDENTIFIER
 * =========================================================
 *
 * We do not store the raw Tracking ID in
 * identity_requests.identifier_hash.
 * =========================================================
 */
function hashIdentifier(
  value
) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}


/**
 * =========================================================
 * INTERNAL TRANSACTION REFERENCE
 * =========================================================
 */
function createTransactionReference() {
  return (
    "EVAULT-IPE-" +
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 24)
      .toUpperCase()
  );
}


/**
 * =========================================================
 * IDEMPOTENCY KEY
 * =========================================================
 */
function createIdempotencyKey() {
  return (
    "evault-ipe-" +
    crypto.randomUUID()
  );
}


/**
 * =========================================================
 * NORMALIZE IDEMPOTENCY KEY
 * =========================================================
 */
function normalizeIdempotencyKey(
  idempotencyKey
) {
  if (
    idempotencyKey === null ||
    idempotencyKey === undefined ||
    String(idempotencyKey).trim() === ""
  ) {
    return createIdempotencyKey();
  }

  const value =
    String(idempotencyKey).trim();

  if (value.length > 255) {
    throw new Error(
      "Idempotency key cannot exceed 255 characters."
    );
  }

  return value;
}


/**
 * =========================================================
 * MAP PROVIDER STATE
 * =========================================================
 */
function mapProviderState(
  state
) {
  switch (
    String(state || "")
      .toLowerCase()
  ) {
    case "pending":
      return "PENDING";

    case "processing":
      return "PROCESSING";

    case "done":
    case "success":
    case "successful":
    case "completed":
      return "SUCCESS";

    case "failed":
    case "failure":
    case "cancelled":
    case "canceled":
      return "FAILED";

    default:
      return "PENDING";
  }
}


/**
 * =========================================================
 * EXTRACT PROVIDER DATA
 * =========================================================
 */
function getProviderData(
  response
) {
  return (
    response?.data ||
    response
  );
}


/**
 * =========================================================
 * EXTRACT PROVIDER REFERENCE
 * =========================================================
 */
function extractProviderReference(
  response
) {
  const data =
    getProviderData(response);

  return (
    data?.reference ||
    data?.request?.reference ||
    data?.data?.reference ||
    null
  );
}


/**
 * =========================================================
 * EXTRACT PROVIDER STATE
 * =========================================================
 */
function extractProviderState(
  response
) {
  const data =
    getProviderData(response);

  return (
    data?.state ||
    data?.status ||
    data?.request?.state ||
    data?.request?.status ||
    "pending"
  );
}


/**
 * =========================================================
 * EXTRACT IPE RESULT
 * =========================================================
 */
function extractResult(
  response
) {
  const data =
    getProviderData(response);

  return {
    text:
      data?.text ||
      data?.result?.text ||
      null,

    download:
      data?.download ||
      data?.document_url ||
      data?.result?.download ||
      data?.result?.document_url ||
      null,

    new_tracking_id:
      data?.new_tracking_id ||
      data?.result?.new_tracking_id ||
      null,

    nin:
      data?.nin ||
      data?.result?.nin ||
      null,

    raw:
      data,
  };
}


/**
 * =========================================================
 * GET IPE SERVICE
 * =========================================================
 */
export async function getIpeService() {
  return {
    service: "ipe",

    name:
      "IPE Clearance",

    amount:
      EVAULT_IPE_PRICE,

    currency:
      "NGN",

    description:
      "Clear an Ineligible Person Error on a NIMC enrolment and obtain the issued NIN and new Tracking ID.",
  };
}


/**
 * =========================================================
 * SUBMIT IPE CLEARANCE
 * =========================================================
 */
export async function submitIpe({
  userId,
  trackingId,
  oldTrackingId = null,
  nin = null,
  fullName = null,
  phoneNumber = null,
  note = null,
  transactionPin,
  ownershipConfirmed = false,
  idempotencyKey = null,
}) {

  /**
   * -------------------------------------------------------
   * USER
   * -------------------------------------------------------
   */
  if (!userId) {
    throw new Error(
      "Authenticated user is required."
    );
  }


  /**
   * -------------------------------------------------------
   * OWNERSHIP
   * -------------------------------------------------------
   */
  if (
    ownershipConfirmed !== true
  ) {
    throw new Error(
      "You must confirm that this tracking ID belongs to you."
    );
  }


  /**
   * -------------------------------------------------------
   * TRACKING ID
   * -------------------------------------------------------
   */
  const cleanTrackingId =
    normalizeTrackingId(
      trackingId
    );


  /**
   * -------------------------------------------------------
   * OPTIONAL OLD TRACKING ID
   * -------------------------------------------------------
   */
  let cleanOldTrackingId =
    null;

  if (
    oldTrackingId !== null &&
    oldTrackingId !== undefined &&
    String(oldTrackingId).trim()
  ) {
    cleanOldTrackingId =
      normalizeTrackingId(
        oldTrackingId
      );
  }


  /**
   * -------------------------------------------------------
   * OPTIONAL NIN
   * -------------------------------------------------------
   */
  const cleanNin =
    normalizeOptionalNin(
      nin
    );


  /**
   * -------------------------------------------------------
   * TRANSACTION PIN
   * -------------------------------------------------------
   */
  if (
    !/^\d{4}$/.test(
      String(
        transactionPin || ""
      )
    )
  ) {
    throw new Error(
      "Transaction PIN must be exactly 4 digits."
    );
  }

  await verifyTransactionPin(
    userId,
    String(transactionPin)
  );


  /**
   * -------------------------------------------------------
   * PRICE
   * -------------------------------------------------------
   */
  const amount =
    EVAULT_IPE_PRICE;

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "IPE Clearance price is not configured correctly."
    );
  }


  /**
   * -------------------------------------------------------
   * IDEMPOTENCY
   * -------------------------------------------------------
   *
   * Use the client-provided key when available.
   *
   * If the frontend does not provide one,
   * generate one on the backend.
   * -------------------------------------------------------
   */
  const normalizedIdempotencyKey =
    normalizeIdempotencyKey(
      idempotencyKey
    );


  /**
   * -------------------------------------------------------
   * DUPLICATE CHECK
   * -------------------------------------------------------
   */
  const existing =
    await findIdentityRequestByIdempotencyKey(
      normalizedIdempotencyKey
    );

  if (existing) {
    return existing;
  }


  /**
   * -------------------------------------------------------
   * WALLET
   * -------------------------------------------------------
   */
  const existingWallet =
    await findWalletByUserId(
      userId
    );

  if (!existingWallet) {
    throw new Error(
      "Wallet not found."
    );
  }

  if (
    existingWallet.status !==
    "ACTIVE"
  ) {
    throw new Error(
      "Wallet is not active."
    );
  }


  /**
   * -------------------------------------------------------
   * REFERENCES
   * -------------------------------------------------------
   */
  const transactionReference =
    createTransactionReference();

  const identifierHash =
    hashIdentifier(
      cleanTrackingId
    );


  /**
   * -------------------------------------------------------
   * DATABASE TRANSACTION
   *
   * Debit wallet + create PAYMENT + create
   * identity request together.
   * -------------------------------------------------------
   */
  const client =
    await db.connect();

  let wallet;
  let identityRequest;

  try {
    await client.query(
      "BEGIN"
    );


    /**
     * -----------------------------------------------------
     * LOCK WALLET
     * -----------------------------------------------------
     */
    wallet =
      await findWalletForUpdate(
        existingWallet.id,
        client
      );

    if (!wallet) {
      throw new Error(
        "Wallet not found."
      );
    }


    /**
     * -----------------------------------------------------
     * BALANCE
     * -----------------------------------------------------
     */
    const balanceBefore =
      Number(
        wallet.available_balance || 0
      );


    if (
      balanceBefore < amount
    ) {
      throw new Error(
        `Insufficient wallet balance. You need ₦${amount.toLocaleString()} for IPE Clearance.`
      );
    }


    /**
     * -----------------------------------------------------
     * DEBIT
     * -----------------------------------------------------
     */
    const debitedWallet =
      await debitWallet(
        wallet.id,
        amount,
        client
      );

    if (!debitedWallet) {
      throw new Error(
        "Unable to debit wallet."
      );
    }


    const balanceAfter =
      Number(
        debitedWallet.available_balance
      );


    /**
     * -----------------------------------------------------
     * PAYMENT TRANSACTION
     * -----------------------------------------------------
     */
    await createTransaction(
      {
        walletId:
          wallet.id,

        reference:
          transactionReference,

        type:
          "PAYMENT",

        amount,

        balanceBefore,

        balanceAfter,

        status:
          "PENDING",

        description:
          "IPE Clearance",

        metadata: {
          service:
            "IPE_CLEARANCE",

          identityType:
            "NIN",

          provider:
            "INSTANTIPE",

          trackingId:
            cleanTrackingId,

          idempotencyKey:
            normalizedIdempotencyKey,

          identityRequestId:
            null,
        },
      },
      client
    );


    /**
     * -----------------------------------------------------
     * IDENTITY REQUEST
     * -----------------------------------------------------
     */
    identityRequest =
      await createIdentityRequest(
        {
          userId,

          identityType:
            "NIN",

          provider:
            "INSTANTIPE",

          identifierHash,

          amount,

          currency:
            "NGN",

          status:
            "PENDING",

          transactionReference,

          idempotencyKey:
            normalizedIdempotencyKey,

          ownershipConfirmed:
            true,
        },
        client
      );


    if (!identityRequest) {
      throw new Error(
        "Unable to create IPE request."
      );
    }


    /**
     * -----------------------------------------------------
     * COMMIT
     * -----------------------------------------------------
     *
     * We commit before calling InstantIPE.
     *
     * This means the PostgreSQL transaction is NOT left
     * open while waiting for the external provider.
     * -----------------------------------------------------
     */
    await client.query(
      "COMMIT"
    );

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    throw error;

  } finally {
    client.release();
  }


  /**
   * -------------------------------------------------------
   * CALL INSTANTIPE
   *
   * IMPORTANT:
   * No PostgreSQL transaction is open here.
   * -------------------------------------------------------
   */
  let providerResponse;

  try {

    providerResponse =
      await instantIpe
        .submitIPEClearance({
          trackingId:
            cleanTrackingId,

          oldTrackingId:
            cleanOldTrackingId,

          nin:
            cleanNin,

          fullName:
            fullName || null,

          phoneNumber:
            phoneNumber || null,

          note:
            note || null,

          idempotencyKey:
            normalizedIdempotencyKey,
        });

  } catch (providerError) {

    await failAndRefundIpe({
      identityRequestId:
        identityRequest.id,

      reason:
        providerError.message,

      errorCode:
        providerError.code ||
        `HTTP_${providerError.status || 500}`,
    });

    throw new Error(
      "IPE Clearance could not be submitted. Your wallet has been refunded."
    );
  }


  /**
   * -------------------------------------------------------
   * PROVIDER RESPONSE
   * -------------------------------------------------------
   */
  const providerData =
    getProviderData(
      providerResponse
    );

  const providerReference =
    extractProviderReference(
      providerResponse
    );

  const providerState =
    extractProviderState(
      providerResponse
    );

  const status =
    mapProviderState(
      providerState
    );


  /**
   * -------------------------------------------------------
   * PROVIDER REFERENCE
   * -------------------------------------------------------
   */
  if (
    !providerReference
  ) {

    await failAndRefundIpe({
      identityRequestId:
        identityRequest.id,

      reason:
        "InstantIPE did not return an IPE reference.",

      errorCode:
        "MISSING_PROVIDER_REFERENCE",
    });

    throw new Error(
      "IPE Clearance provider did not return a request reference. Your wallet has been refunded."
    );
  }


  /**
   * -------------------------------------------------------
   * UPDATE PROVIDER REFERENCE
   * -------------------------------------------------------
   */
  await updateProviderReference(
    identityRequest.id,
    providerReference,
    String(
      providerState || ""
    ).toLowerCase() ||
      "pending"
  );


  /**
   * -------------------------------------------------------
   * TERMINAL SUCCESS
   * -------------------------------------------------------
   */
  if (
    status === "SUCCESS"
  ) {

    const result =
      extractResult(
        providerResponse
      );


    await updateIdentityRequestResult(
      identityRequest.id,
      {
        status:
          "SUCCESS",

        providerStatus:
          String(
            providerState
          ).toLowerCase(),

        result,

        documentUrl:
          result.download,

        errorCode:
          null,

        errorMessage:
          null,
      }
    );


    await markPaymentSuccess(
      transactionReference,
      {
        providerReference,

        providerResponse:
          providerData,
      }
    );


  /**
   * -------------------------------------------------------
   * TERMINAL FAILURE
   * -------------------------------------------------------
   */
  } else if (
    status === "FAILED"
  ) {

    await failAndRefundIpe({
      identityRequestId:
        identityRequest.id,

      reason:
        providerData?.reason ||
        providerData?.message ||
        "InstantIPE rejected the IPE request.",

      errorCode:
        providerData?.code ||
        "PROVIDER_FAILED",
    });


  /**
   * -------------------------------------------------------
   * PENDING / PROCESSING
   * -------------------------------------------------------
   */
  } else {

    await updateIdentityRequestResult(
      identityRequest.id,
      {
        status,

        providerStatus:
          String(
            providerState
          ).toLowerCase(),

        result:
          null,

        documentUrl:
          null,

        errorCode:
          null,

        errorMessage:
          null,
      }
    );
  }


  /**
   * -------------------------------------------------------
   * RETURN CURRENT REQUEST
   * -------------------------------------------------------
   */
  return await findIdentityRequestById(
    identityRequest.id
  );
}


/**
 * =========================================================
 * MARK PAYMENT SUCCESS
 * =========================================================
 */
async function markPaymentSuccess(
  transactionReference,
  metadata = {}
) {
  await updateTransactionStatus(
    transactionReference,
    "SUCCESS",
    metadata
  );
}


/**
 * =========================================================
 * REFUND IPE
 * =========================================================
 */
export async function failAndRefundIpe({
  identityRequestId,
  reason,
  errorCode = "PROVIDER_FAILED",
}) {

  const client =
    await db.connect();

  try {

    await client.query(
      "BEGIN"
    );


    /**
     * -----------------------------------------------------
     * LOCK IDENTITY REQUEST
     * -----------------------------------------------------
     *
     * This prevents two concurrent refund attempts
     * from refunding the same request twice.
     * -----------------------------------------------------
     */
    const requestResult =
      await client.query(
        `
          SELECT *
          FROM identity_requests
          WHERE id = $1
          FOR UPDATE
        `,
        [
          identityRequestId,
        ]
      );


    const identityRequest =
      requestResult.rows[0];


    if (!identityRequest) {
      throw new Error(
        "IPE identity request not found while refunding."
      );
    }


    /**
     * -----------------------------------------------------
     * NEVER REFUND SUCCESSFUL REQUEST
     * -----------------------------------------------------
     */
    if (
      identityRequest.status ===
      "SUCCESS"
    ) {

      await client.query(
        "COMMIT"
      );

      return identityRequest;
    }


    /**
     * -----------------------------------------------------
     * CHECK EXISTING REFUND
     * -----------------------------------------------------
     */
    const refundCheck =
      await client.query(
        `
          SELECT id
          FROM transactions
          WHERE type = 'REFUND'
          AND metadata->>'identityRequestId' = $1
          LIMIT 1
        `,
        [
          identityRequestId,
        ]
      );


    /**
     * -----------------------------------------------------
     * REFUND ALREADY EXISTS
     * -----------------------------------------------------
     */
    if (
      refundCheck.rows.length > 0
    ) {

      await updateIdentityRequestResult(
        identityRequestId,
        {
          status:
            "FAILED",

          providerStatus:
            "failed",

          errorCode,

          errorMessage:
            reason,

          result:
            null,

          documentUrl:
            null,
        },
        client
      );


      await client.query(
        "COMMIT"
      );


      return identityRequest;
    }


    /**
     * -----------------------------------------------------
     * FIND AND LOCK WALLET
     * -----------------------------------------------------
     */
    const walletResult =
      await client.query(
        `
          SELECT *
          FROM wallets
          WHERE user_id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [
          identityRequest.user_id,
        ]
      );


    const wallet =
      walletResult.rows[0];


    if (!wallet) {
      throw new Error(
        "Wallet not found while refunding IPE."
      );
    }


    /**
     * -----------------------------------------------------
     * REFUND AMOUNT
     * -----------------------------------------------------
     */
    const amount =
      Number(
        identityRequest.amount
      );


    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw new Error(
        "Invalid IPE refund amount."
      );
    }


    const balanceBefore =
      Number(
        wallet.available_balance || 0
      );


    /**
     * -----------------------------------------------------
     * CREDIT WALLET
     * -----------------------------------------------------
     */
    const refundedWallet =
      await creditWallet(
        wallet.id,
        amount,
        client
      );


    if (!refundedWallet) {
      throw new Error(
        "Unable to refund IPE wallet."
      );
    }


    const balanceAfter =
      Number(
        refundedWallet.available_balance
      );


    /**
     * -----------------------------------------------------
     * REFUND REFERENCE
     * -----------------------------------------------------
     */
    const refundReference =
      "EVAULT-REFUND-" +
      crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 24)
        .toUpperCase();


    /**
     * -----------------------------------------------------
     * REFUND TRANSACTION
     * -----------------------------------------------------
     */
    await createTransaction(
      {
        walletId:
          wallet.id,

        reference:
          refundReference,

        type:
          "REFUND",

        amount,

        balanceBefore,

        balanceAfter,

        status:
          "SUCCESS",

        description:
          "Refund for failed IPE Clearance",

        metadata: {
          service:
            "IPE_CLEARANCE",

          identityType:
            "NIN",

          provider:
            "INSTANTIPE",

          identityRequestId,

          originalTransactionReference:
            identityRequest.transaction_reference,

          reason,
        },
      },
      client
    );


    /**
     * -----------------------------------------------------
     * MARK ORIGINAL PAYMENT FAILED
     * -----------------------------------------------------
     */
    await updateTransactionStatus(
      identityRequest.transaction_reference,
      "FAILED",
      {
        identityRequestId,

        refundReference,

        refunded:
          true,

        refundAmount:
          amount,

        failureReason:
          reason,
      },
      client
    );


    /**
     * -----------------------------------------------------
     * MARK IDENTITY REQUEST FAILED
     * -----------------------------------------------------
     */
    await updateIdentityRequestResult(
      identityRequestId,
      {
        status:
          "FAILED",

        providerStatus:
          "failed",

        result:
          null,

        documentUrl:
          null,

        errorCode,

        errorMessage:
          reason,
      },
      client
    );


    await client.query(
      "COMMIT"
    );


    return {
      refunded:
        true,

      amount,

      refundReference,
    };


  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "CRITICAL IPE REFUND ERROR:",
      {
        identityRequestId,
        error:
          error.message,
      }
    );

    throw error;

  } finally {
    client.release();
  }
}


/**
 * =========================================================
 * CHECK IPE STATUS
 * =========================================================
 */
export async function checkIpeStatus({
  userId,
  requestId,
}) {

  const request =
    await findUserIdentityRequestById(
      requestId,
      userId
    );


  if (!request) {
    throw new Error(
      "IPE Clearance request not found."
    );
  }


  /**
   * -------------------------------------------------------
   * ALREADY TERMINAL
   * -------------------------------------------------------
   */
  if (
    request.status === "SUCCESS" ||
    request.status === "FAILED"
  ) {
    return request;
  }


  /**
   * -------------------------------------------------------
   * NO PROVIDER REFERENCE
   * -------------------------------------------------------
   */
  if (
    !request.provider_reference
  ) {
    return request;
  }


  let providerResponse;


  try {

    providerResponse =
      await instantIpe
        .getIPEClearance(
          request.provider_reference
        );

  } catch (error) {

    console.error(
      "IPE status check failed:",
      error.message
    );

    /**
     * Do NOT refund merely because the status
     * request failed temporarily.
     */
    return request;
  }


  const providerData =
    getProviderData(
      providerResponse
    );


  const providerState =
    extractProviderState(
      providerResponse
    );


  const status =
    mapProviderState(
      providerState
    );


  /**
   * -------------------------------------------------------
   * SUCCESS
   * -------------------------------------------------------
   */
  if (
    status === "SUCCESS"
  ) {

    const result =
      extractResult(
        providerResponse
      );


    await updateIdentityRequestResult(
      request.id,
      {
        status:
          "SUCCESS",

        providerStatus:
          String(
            providerState
          ).toLowerCase(),

        result,

        documentUrl:
          result.download,

        errorCode:
          null,

        errorMessage:
          null,
      }
    );


    await markPaymentSuccess(
      request.transaction_reference,
      {
        providerReference:
          request.provider_reference,

        providerResponse:
          providerData,
      }
    );


  /**
   * -------------------------------------------------------
   * FAILED
   * -------------------------------------------------------
   */
  } else if (
    status === "FAILED"
  ) {

    await failAndRefundIpe({
      identityRequestId:
        request.id,

      reason:
        providerData?.reason ||
        providerData?.message ||
        "IPE Clearance failed.",

      errorCode:
        providerData?.code ||
        "PROVIDER_FAILED",
    });


  /**
   * -------------------------------------------------------
   * PENDING / PROCESSING
   * -------------------------------------------------------
   */
  } else {

    await updateIdentityRequestResult(
      request.id,
      {
        status,

        providerStatus:
          String(
            providerState
          ).toLowerCase(),

        result:
          null,

        documentUrl:
          null,

        errorCode:
          null,

        errorMessage:
          null,
      }
    );
  }


  return await findIdentityRequestById(
    request.id
  );
}


/**
 * =========================================================
 * IPE HISTORY
 * =========================================================
 */
export async function getIpeHistory({
  userId,
  limit = 20,
  offset = 0,
}) {

  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 20,
        1
      ),
      100
    );

  const safeOffset =
    Math.max(
      Number(offset) || 0,
      0
    );


  return findIdentityRequestsByUserId(
    userId,
    safeLimit,
    safeOffset,
    "NIN"
  );
}


/**
 * =========================================================
 * GET ONE IPE REQUEST
 * =========================================================
 */
export async function getIpeRequest({
  userId,
  requestId,
}) {

  const request =
    await findUserIdentityRequestById(
      requestId,
      userId
    );


  if (!request) {
    throw new Error(
      "IPE Clearance request not found."
    );
  }


  return request;
}