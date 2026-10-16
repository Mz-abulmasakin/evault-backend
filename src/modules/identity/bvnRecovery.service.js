
/**
 * =========================================================
 * eVAULT BVN PHONE RECOVERY SERVICE
 * =========================================================
 *
 * Purpose:
 *
 * Recover BVN using the customer's phone number.
 *
 * Flow:
 *
 * React Native
 *      ↓
 * authenticated eVault API
 *      ↓
 * transaction PIN
 *      ↓
 * eVault customer price
 *      ↓
 * wallet debit
 *      ↓
 * PAYMENT transaction
 *      ↓
 * identity_requests
 *      ↓
 * NetworkDataSub /verification/bvn/phone-search
 *      ↓
 * SUCCESS
 *      ↓
 * save provider response
 *      ↓
 * notification
 *
 * IMPORTANT:
 *
 * - This is NOT the existing BVN validation flow.
 * - Existing /identity/bvn remains untouched.
 * - NetworkDataSub provider price is NOT used.
 * - Customer price comes from
 *   EVAULT_BVN_PHONE_SEARCH_PRICE.
 * - No card_type is sent to NetworkDataSub.
 * =========================================================
 */

import crypto from "crypto";

import db from "../../config/database.js";

import {
  findWalletForUpdateByUserId,
  debitWallet,
} from "../wallet/wallet.repository.js";

import {
  createTransaction,
  updateTransactionStatus,
} from "../transactions/transaction.repository.js";

import {
  createIdentityRequest,
  findIdentityRequestByIdempotencyKey,
  findIdentityRequestById,
  updateIdentityRequestResult,
  updateProviderReference,
} from "./identityRequest.repository.js";

import {
  upsertIdentityVerification,
} from "./identity.repository.js";

import {
  verifyTransactionPin,
} from "../profile/profile.service.js";

import {
  createNotification,
} from "../notification/notification.repository.js";

import {
  searchBvnByPhone,
} from "./providers/networkdatasub/bvn-phone.client.js";

import {
  refundFailedBvnRequest,
} from "./bvn.service.js";


/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const PROVIDER =
  "networkdatasub";

const IDENTITY_TYPE =
  "BVN";

const TRANSACTION_PAYMENT =
  "PAYMENT";

const STATUS_PENDING =
  "PENDING";

const STATUS_PROCESSING =
  "PROCESSING";

const STATUS_SUCCESS =
  "SUCCESS";

const STATUS_FAILED =
  "FAILED";

const VALIDATION_TYPE =
  "phone";

const SLIP_TYPE =
  "phone_search";


/**
 * =========================================================
 * NORMALIZATION
 * =========================================================
 */

function normalizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
}


/**
 * =========================================================
 * VALIDATION
 * =========================================================
 */

function validatePhone(phone) {
  /**
   * NetworkDataSub documentation specifies
   * an 11-digit Nigerian phone number.
   */

  if (!/^0\d{10}$/.test(phone)) {
    const error =
      new Error(
        "Phone number must contain exactly 11 digits and start with 0."
      );

    error.code =
      "INVALID_PHONE";

    error.status = 400;

    throw error;
  }
}


/**
 * =========================================================
 * CUSTOMER PRICE
 * =========================================================
 *
 * IMPORTANT:
 *
 * We deliberately do NOT use:
 *
 * 300
 *
 * from NetworkDataSub.
 *
 * The eVault customer price must be configured
 * separately.
 * =========================================================
 */

function requireCustomerPrice() {
  const envName =
    "EVAULT_BVN_PHONE_SEARCH_PRICE";

  const raw =
    process.env[envName];

  const amount =
    Number(raw);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    const error =
      new Error(
        `eVault BVN phone-search customer price is not configured. Set ${envName} in the backend .env file.`
      );

    error.code =
      "BVN_PHONE_PRICE_NOT_CONFIGURED";

    error.status = 503;

    throw error;
  }

  return amount;
}


/**
 * =========================================================
 * REFERENCE
 * =========================================================
 */

function createReference(
  prefix
) {
  return (
    `${prefix}-` +
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 24)
      .toUpperCase()
  );
}


/**
 * =========================================================
 * IDEMPOTENCY
 * =========================================================
 */

function createIdempotencyKey({
  userId,
  phone,
}) {
  return crypto
    .createHash("sha256")
    .update(
      [
        userId,
        phone,
        Date.now(),
        crypto.randomUUID(),
      ].join(":")
    )
    .digest("hex");
}


/**
 * =========================================================
 * HASH
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
 * MASK PHONE
 * =========================================================
 */

function maskPhone(phone) {
  if (!phone) {
    return null;
  }

  return (
    `${phone.slice(0, 3)}` +
    "*****" +
    `${phone.slice(-3)}`
  );
}


/**
 * =========================================================
 * PROVIDER DATA
 * =========================================================
 */

function getProviderData(
  response
) {
  return (
    response?.data ??
    response ??
    {}
  );
}


/**
 * =========================================================
 * PROVIDER REFERENCE
 * =========================================================
 */

function getProviderReference(
  providerData
) {
  return (
    providerData?.reference ??
    providerData?.transaction_id ??
    providerData?.verification_id ??
    null
  );
}


/**
 * =========================================================
 * PROVIDER BVN
 * =========================================================
 *
 * We only treat an actual 11-digit BVN as a recovered
 * BVN for persistent identity storage.
 *
 * If NetworkDataSub returns a masked BVN such as:
 *
 * ***********
 *
 * we do NOT store that as the user's BVN.
 * =========================================================
 */

function extractActualBvn(
  providerData
) {
  const candidates = [
    providerData?.bvn,

    providerData?.details?.bvn,

    providerData?.details?.BVN,

    providerData?.details?.bvn_number,

    providerData?.details?.bvnNumber,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate === null ||
      candidate === undefined
    ) {
      continue;
    }

    const normalized =
      String(candidate)
        .replace(/\D/g, "")
        .trim();

    if (
      /^\d{11}$/.test(
        normalized
      )
    ) {
      return normalized;
    }
  }

  return null;
}


/**
 * =========================================================
 * SAFE NOTIFICATION
 * =========================================================
 */

async function safeNotification(
  data
) {
  try {
    await createNotification(
      data
    );
  } catch (error) {
    console.error(
      "BVN recovery notification error:",
      error
    );
  }
}


/**
 * =========================================================
 * GET PHONE RECOVERY SERVICE
 * =========================================================
 */

export async function getBvnPhoneRecoveryService() {
  const amount =
    Number(
      process.env
        .EVAULT_BVN_PHONE_SEARCH_PRICE
    );

  return {
    success:
      Number.isFinite(amount) &&
      amount > 0,

    provider:
      PROVIDER,

    identityType:
      IDENTITY_TYPE,

    method:
      "PHONE",

    service:
      "BVN_PHONE_RECOVERY",

    currency:
      "NGN",

    price:
      Number.isFinite(amount) &&
      amount > 0
        ? amount
        : null,

    pricingSource:
      "eVault environment variables",

    endpoint:
      "phone-search",
  };
}


/**
 * =========================================================
 * RECOVER BVN BY PHONE
 * =========================================================
 */

export async function recoverBvnByPhone({
  userId,
  phone,
  phoneNumber,
  transactionPin,
  ownershipConfirmed = false,
  idempotencyKey = null,
}) {
  if (!userId) {
    const error =
      new Error(
        "User ID is required."
      );

    error.code =
      "USER_ID_REQUIRED";

    error.status = 400;

    throw error;
  }

  const normalizedPhone =
    normalizePhone(
      phone ||
      phoneNumber
    );

  validatePhone(
    normalizedPhone
  );

  if (
    !transactionPin
  ) {
    const error =
      new Error(
        "Transaction PIN is required."
      );

    error.code =
      "TRANSACTION_PIN_REQUIRED";

    error.status = 400;

    throw error;
  }

  if (
    !ownershipConfirmed
  ) {
    const error =
      new Error(
        "Please confirm that you are authorized to recover this BVN."
      );

    error.code =
      "OWNERSHIP_CONFIRMATION_REQUIRED";

    error.status = 400;

    throw error;
  }

  const amount =
    requireCustomerPrice();

  const finalIdempotencyKey =
    idempotencyKey ||
    createIdempotencyKey({
      userId,
      phone:
        normalizedPhone,
    });


  /**
   * -------------------------------------------------------
   * IDEMPOTENCY CHECK
   * -------------------------------------------------------
   */

  const existingRequest =
    await findIdentityRequestByIdempotencyKey(
      finalIdempotencyKey
    );

  if (
    existingRequest
  ) {
    return {
      success:
        existingRequest.status ===
        STATUS_SUCCESS,

      duplicate:
        true,

      requestId:
        existingRequest.id,

      status:
        existingRequest.status,

      amount:
        Number(
          existingRequest.amount
        ),

      transactionReference:
        existingRequest.transaction_reference,

      providerReference:
        existingRequest.provider_reference,

      result:
        existingRequest.result,

      phone:
        maskPhone(
          normalizedPhone
        ),
    };
  }


  /**
   * -------------------------------------------------------
   * CREATE PAYMENT + IDENTITY REQUEST
   * -------------------------------------------------------
   */

  const transactionReference =
    createReference(
      "EVAULT-BVNREC"
    );

  let transaction;
  let identityRequest;

  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN"
    );


    /**
     * Wallet lock.
     */

    const wallet =
      await findWalletForUpdateByUserId(
        userId,
        client
      );

    if (!wallet) {
      const error =
        new Error(
          "Wallet not found."
        );

      error.code =
        "WALLET_NOT_FOUND";

      error.status = 404;

      throw error;
    }


    /**
     * Verify PIN while transaction is active.
     */

    await verifyTransactionPin(
      userId,
      transactionPin
    );


    const balanceBefore =
      Number(
        wallet.available_balance
      );

    if (
      !Number.isFinite(
        balanceBefore
      )
    ) {
      const error =
        new Error(
          "Unable to read wallet balance."
        );

      error.code =
        "INVALID_WALLET_BALANCE";

      error.status = 500;

      throw error;
    }


    if (
      balanceBefore < amount
    ) {
      const error =
        new Error(
          `Insufficient wallet balance. Required ₦${amount.toFixed(
            2
          )}. Available ₦${balanceBefore.toFixed(
            2
          )}.`
        );

      error.code =
        "INSUFFICIENT_BALANCE";

      error.status = 400;

      throw error;
    }


    /**
     * Debit wallet.
     */

    const debitedWallet =
      await debitWallet(
        wallet.id,
        amount,
        client
      );

    if (
      !debitedWallet
    ) {
      const error =
        new Error(
          "Unable to debit wallet."
        );

      error.code =
        "WALLET_DEBIT_FAILED";

      error.status = 500;

      throw error;
    }


    const balanceAfter =
      Number(
        debitedWallet.available_balance
      );


    /**
     * PAYMENT transaction.
     */

    transaction =
      await createTransaction(
        {
          walletId:
            wallet.id,

          reference:
            transactionReference,

          type:
            TRANSACTION_PAYMENT,

          amount,

          balanceBefore,

          balanceAfter,

          status:
            STATUS_PENDING,

          description:
            "BVN recovery by phone",

          metadata: {
            service:
              "BVN_PHONE_RECOVERY",

            identityType:
              IDENTITY_TYPE,

            provider:
              PROVIDER,

            verificationMethod:
              "PHONE",

            identifier:
              "PHONE_SEARCH",

            phone:
              maskPhone(
                normalizedPhone
              ),

            customerPriceSource:
              "eVault environment variables",

            idempotencyKey:
              finalIdempotencyKey,
          },
        },
        client
      );


    /**
     * identity_requests.
     *
     * We use the existing schema.
     */

    identityRequest =
      await createIdentityRequest(
        {
          userId,

          identityType:
            IDENTITY_TYPE,

          provider:
            PROVIDER,

          identifierHash:
            hashIdentifier(
              normalizedPhone
            ),

          validationType:
            VALIDATION_TYPE,

          slipType:
            SLIP_TYPE,

          amount,

          currency:
            "NGN",

          status:
            STATUS_PROCESSING,

          transactionReference,

          idempotencyKey:
            finalIdempotencyKey,

          ownershipConfirmed:
            Boolean(
              ownershipConfirmed
            ),
        },
        client
      );


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
   * CALL NETWORKDATASUB
   * -------------------------------------------------------
   *
   * This is the ONLY provider call.
   *
   * It sends:
   *
   * {
   *   phone
   * }
   *
   * No card_type.
   */

  let providerResponse;

  try {
    providerResponse =
      await searchBvnByPhone(
        {
          phone:
            normalizedPhone,
        }
      );

  } catch (
    providerError
  ) {
    await refundFailedBvnRequest({
      userId,

      request:
        identityRequest,

      transaction,

      reason:
        providerError?.message ||
        "BVN phone search failed.",

      providerResponse:
        providerError?.providerResponse ||
        null,
    });

    throw providerError;
  }


  const providerData =
    getProviderData(
      providerResponse
    );

  const providerReference =
    getProviderReference(
      providerData
    );


  if (
    providerReference
  ) {
    await updateProviderReference(
      identityRequest.id,
      String(
        providerReference
      )
    );
  }


  /**
   * -------------------------------------------------------
   * PROVIDER SUCCESS
   * -------------------------------------------------------
   */

  if (
    providerResponse?.success !== true
  ) {
    const error =
      new Error(
        providerResponse?.message ||
          "NetworkDataSub BVN phone search failed."
      );

    error.code =
      "BVN_PHONE_PROVIDER_FAILED";

    error.status = 502;

    await refundFailedBvnRequest({
      userId,

      request:
        identityRequest,

      transaction,

      reason:
        error.message,

      providerResponse,
    });

    throw error;
  }


  /**
   * -------------------------------------------------------
   * EXTRACT ACTUAL BVN
   * -------------------------------------------------------
   */

  const recoveredBvn =
    extractActualBvn(
      providerData
    );


  /**
   * -------------------------------------------------------
   * STORE COMPLETE PROVIDER RESPONSE
   * -------------------------------------------------------
   */

  const storedResult = {
    status:
      STATUS_SUCCESS,

    provider:
      PROVIDER,

    method:
      "PHONE",

    verificationMethod:
      "PHONE",

    providerReference,

    phone:
      maskPhone(
        normalizedPhone
      ),

    recoveredBvn:
      recoveredBvn || null,

    data:
      providerData,

    response:
      providerResponse,

    hasImage:
      Boolean(
        providerData?.has_image
      ),

    /**
     * NetworkDataSub's documented BVN
     * phone-search response does not
     * use the normal BVN PDF response.
     */
    hasPdf:
      Boolean(
        providerData?.pdf_base64
      ),
  };


  await updateIdentityRequestResult(
    identityRequest.id,
    storedResult
  );


  /**
   * -------------------------------------------------------
   * MARK PAYMENT SUCCESS
   * -------------------------------------------------------
   */

  await updateTransactionStatus(
    transaction.id,
    STATUS_SUCCESS
  );


  /**
   * -------------------------------------------------------
   * PERSIST BVN ONLY IF PROVIDER RETURNED
   * AN ACTUAL 11-DIGIT BVN
   * -------------------------------------------------------
   */

  if (
    recoveredBvn
  ) {
    try {
      await upsertIdentityVerification(
        {
          userId,

          bvn:
            recoveredBvn,

          bvnVerified:
            true,

          nin:
            null,

          ninVerified:
            false,

          status:
            STATUS_SUCCESS,
        }
      );
    } catch (
      identityError
    ) {
      console.error(
        "BVN recovery persistent identity update failed:",
        identityError
      );
    }
  }


  /**
   * -------------------------------------------------------
   * SUCCESS NOTIFICATION
   * -------------------------------------------------------
   */

  await safeNotification({
    userId,

    title:
      "BVN Recovery Successful",

    message:
      recoveredBvn
        ? "Your BVN has been successfully recovered using your phone number."
        : "Your BVN phone recovery request was completed successfully.",

    type:
      "IDENTITY",

    metadata: {
      identityType:
        IDENTITY_TYPE,

      requestId:
        identityRequest.id,

      transactionReference,

      providerReference,

      verificationMethod:
        "PHONE",

      identifier:
        "PHONE_SEARCH",

      downloadAvailable:
        false,
    },
  });


  /**
   * -------------------------------------------------------
   * RETURN CLIENT RESPONSE
   * -------------------------------------------------------
   */

  return {
    success:
      true,

    status:
      STATUS_SUCCESS,

    requestId:
      identityRequest.id,

    transactionReference,

    providerReference,

    amount,

    currency:
      "NGN",

    method:
      "PHONE",

    verificationMethod:
      "PHONE",

    phone:
      maskPhone(
        normalizedPhone
      ),

    /**
     * If the provider returns the real BVN,
     * return it.
     *
     * If it returns only a masked value,
     * return the provider's masked value.
     */
    bvn:
      recoveredBvn ||
      providerData?.bvn ||
      null,

    details:
      providerData?.details ||
      {},

    hasImage:
      Boolean(
        providerData?.has_image
      ),

    hasPdf:
      Boolean(
        providerData?.pdf_base64
      ),

    provider:
      PROVIDER,
  };
}


/**
 * =========================================================
 * GET RECOVERY REQUEST
 * =========================================================
 */

export async function getBvnRecoveryRequest(
  requestId,
  userId
) {
  const request =
    await findIdentityRequestById(
      requestId
    );

  if (
    !request ||
    request.user_id !== userId ||
    request.identity_type !==
      IDENTITY_TYPE
  ) {
    const error =
      new Error(
        "BVN recovery request not found."
      );

    error.code =
      "BVN_RECOVERY_REQUEST_NOT_FOUND";

    error.status = 404;

    throw error;
  }

  return request;
}


/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getBvnPhoneRecoveryService,

  recoverBvnByPhone,

  getBvnRecoveryRequest,
};
