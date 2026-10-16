/**
 * =========================================================
 * eVAULT NIN SERVICE
 * =========================================================
 *
 * Supports:
 *
 * 1. NetworkDataSub NIN verification
 *    - Standard
 *    - Regular
 *    - Premium
 *    - VNIN Slip
 *
 * 2. NetworkDataSub NIN recovery
 *    - Phone search
 *
 * 3. Existing InstantIPE compatibility
 *    - Existing webhook can continue importing
 *      refundFailedNinRequest()
 *
 * IMPORTANT:
 * - NetworkDataSub API credentials remain server-side.
 * - Customer pricing comes from EVAULT_NIN_* environment
 *   variables.
 * - Provider pricing is NEVER used as a customer-price
 *   fallback. If an eVault price is missing, the request
 *   is rejected instead of charging a provider price.
 * - Existing identity_requests schema is preserved.
 * =========================================================
 */

import crypto from "crypto";

import db from "../../config/database.js";

import {
  findWalletForUpdateByUserId,
  findWalletForUpdate,
  debitWallet,
  creditWallet,
} from "../wallet/wallet.repository.js";

import {
  createTransaction,
  updateTransactionStatus,
  findTransactionByReference,
} from "../transactions/transaction.repository.js";

import {
  createIdentityRequest,
  findIdentityRequestById,
  findIdentityRequestByIdempotencyKey,
  findIdentityRequestByProviderReference,
  findIdentityRequestsByUserId,
  findUserIdentityRequestById,
  updateIdentityRequestResult,
  updateProviderReference,
  updateIdentityRequestStatus,
  markIdentityRequestFailed,
} from "./identityRequest.repository.js";

import {
  upsertNinVerification,
  updateNin,
  markNinAsVerified,
} from "./identity.repository.js";

import { verifyTransactionPin } from "../profile/profile.service.js";

import { createNotification } from "../notification/notification.repository.js";

import {
  verifyNinByCardType,
  searchNinByPhone,
} from "./providers/networkdatasub/networkdatasub.client.js";


/**
 * =========================================================
 * PROVIDERS / TYPES
 * =========================================================
 */

const NETWORKDATASUB_PROVIDER = "networkdatasub";

/*
 * Existing InstantIPE configuration remains compatible.
 *
 * The current NIN provider flow below uses NetworkDataSub,
 * but existing InstantIPE webhook code may still call:
 *
 * refundFailedNinRequest(request.id, error)
 *
 * Therefore this service keeps that export and calling style.
 */
const INSTANTIPE_PROVIDER = "instantipe";

const REQUEST_TYPE_NIN = "NIN_VERIFICATION";
const REQUEST_TYPE_NIN_RECOVERY = "NIN_PHONE_RECOVERY";

const TRANSACTION_TYPE = "PAYMENT";
const REFUND_TYPE = "REFUND";

const SUCCESS_STATUS = "SUCCESS";
const PENDING_STATUS = "PENDING";
const PROCESSING_STATUS = "PROCESSING";
const FAILED_STATUS = "FAILED";

const SUPPORTED_CARD_TYPES = [
  "standard",
  "regular",
  "premium",
  "vnin_slip",
];


/**
 * =========================================================
 * CUSTOMER PRICE ENVIRONMENT VARIABLES
 * =========================================================
 */

const CUSTOMER_PRICE_ENV = {
  standard: "EVAULT_NIN_STANDARD_PRICE",
  regular: "EVAULT_NIN_REGULAR_PRICE",
  premium: "EVAULT_NIN_PREMIUM_PRICE",
  vnin_slip: "EVAULT_NIN_VNIN_PRICE",
};

const LEGACY_CUSTOMER_PRICE_ENV =
  "EVAULT_NIN_VALIDATION_PRICE";


/**
 * =========================================================
 * PHONE RECOVERY CUSTOMER PRICE ENVIRONMENT VARIABLES
 * =========================================================
 */

const PHONE_RECOVERY_PRICE_ENV = {
  standard: "EVAULT_NIN_PHONE_STANDARD_PRICE",
  regular: "EVAULT_NIN_PHONE_REGULAR_PRICE",
  premium: "EVAULT_NIN_PHONE_PREMIUM_PRICE",
  vnin_slip: "EVAULT_NIN_PHONE_VNIN_PRICE",
};


/**
 * =========================================================
 * NORMALIZATION
 * =========================================================
 */

function normalizeNin(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
}


function normalizePhone(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "");
}


function normalizeCardType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");

  if (normalized === "vnin") {
    return "vnin_slip";
  }

  return normalized;
}


function normalizeValidationType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized || "full";
}


/**
 * =========================================================
 * VALIDATION
 * =========================================================
 */

function validateNin(nin) {
  if (!/^\d{11}$/.test(nin)) {
    const error = new Error(
      "NIN must contain exactly 11 digits."
    );

    error.code = "INVALID_NIN";

    throw error;
  }
}


function validatePhone(phone) {
  /*
   * Accept:
   *
   * +2348012345678
   * 2348012345678
   * 08012345678
   *
   * 10-15 digits with optional leading +.
   */
  if (!/^\+?\d{10,15}$/.test(phone)) {
    const error = new Error(
      "Enter a valid phone number."
    );

    error.code = "INVALID_PHONE";

    throw error;
  }
}


function validateCardType(cardType) {
  if (!SUPPORTED_CARD_TYPES.includes(cardType)) {
    const error = new Error(
      `Unsupported NIN card type: ${cardType}`
    );

    error.code = "UNSUPPORTED_CARD_TYPE";

    throw error;
  }
}


/**
 * =========================================================
 * HASHING
 * =========================================================
 */

function hashIdentifier(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");
}


/**
 * =========================================================
 * REFERENCE
 * =========================================================
 */

function createRequestReference(prefix = "NIN") {
  return `${prefix}-${Date.now()}-${crypto
    .randomBytes(6)
    .toString("hex")
    .toUpperCase()}`;
}


/**
 * =========================================================
 * MASKING
 * =========================================================
 */

function maskNin(nin) {
  if (!nin) {
    return null;
  }

  const value = String(nin);

  if (value.length <= 4) {
    return "****";
  }

  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}


function maskPhone(phone) {
  if (!phone) {
    return null;
  }

  const value = String(phone);

  if (value.length <= 4) {
    return "****";
  }

  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}


/**
 * =========================================================
 * CARD LABEL
 * =========================================================
 */

function getCardLabel(cardType) {
  const labels = {
    standard: "Standard NIN",
    regular: "Regular NIN",
    premium: "Premium NIN",
    vnin_slip: "VNIN Slip",
  };

  return labels[cardType] || cardType;
}


/**
 * =========================================================
 * PRICE HELPERS
 * =========================================================
 */

function getConfiguredPrice(envName) {
  const raw = process.env[envName];

  if (
    raw === undefined ||
    raw === null ||
    String(raw).trim() === ""
  ) {
    return null;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}


function getCustomerNinPrice(cardType) {
  const envName = CUSTOMER_PRICE_ENV[cardType];

  if (envName) {
    const configured = getConfiguredPrice(envName);

    if (configured !== null) {
      return configured;
    }
  }

  // Backward-compatible single customer price.
  // It is still an eVault price, never a provider price.
  return getConfiguredPrice(
    LEGACY_CUSTOMER_PRICE_ENV
  );
}


function getCustomerPhoneRecoveryPrice(cardType) {
  const envName = PHONE_RECOVERY_PRICE_ENV[cardType];

  if (envName) {
    const configured = getConfiguredPrice(envName);

    if (configured !== null) {
      return configured;
    }
  }

  // If a phone-specific customer price is not configured,
  // use the matching eVault verification price.
  return getCustomerNinPrice(cardType);
}


function requireCustomerNinPrice(cardType) {
  const amount = getCustomerNinPrice(cardType);

  if (amount === null) {
    const error = new Error(
      `eVault NIN customer price is not configured for ${cardType}.`
    );

    error.code = "NIN_PRICE_NOT_CONFIGURED";
    error.statusCode = 503;

    throw error;
  }

  return Number(amount);
}


function requireCustomerPhoneRecoveryPrice(cardType) {
  const amount = getCustomerPhoneRecoveryPrice(cardType);

  if (amount === null) {
    const error = new Error(
      `eVault NIN recovery customer price is not configured for ${cardType}.`
    );

    error.code = "NIN_RECOVERY_PRICE_NOT_CONFIGURED";
    error.statusCode = 503;

    throw error;
  }

  return Number(amount);
}


/**
 * =========================================================
 * PROVIDER RESPONSE HELPERS
 * =========================================================
 */

function getProviderData(response) {
  return (
    response?.data ??
    response?.result ??
    response
  );
}


function getProviderMessage(response) {
  return (
    response?.message ??
    response?.error ??
    response?.detail ??
    response?.data?.message ??
    response?.data?.error ??
    "NetworkDataSub request failed."
  );
}


function getProviderErrorCode(response) {
  return (
    response?.error_code ??
    response?.errorCode ??
    response?.code ??
    response?.data?.error_code ??
    response?.data?.errorCode ??
    null
  );
}


function getProviderReference(response) {
  const data = getProviderData(response);

  return (
    response?.reference ??
    response?.transaction_reference ??
    response?.transactionReference ??
    response?.provider_reference ??
    response?.providerReference ??
    data?.reference ??
    data?.transaction_reference ??
    data?.transactionReference ??
    data?.provider_reference ??
    data?.providerReference ??
    data?.id ??
    null
  );
}


function getProviderStatus(response) {
  const data = getProviderData(response);

  return String(
    response?.status ??
    response?.state ??
    data?.status ??
    data?.state ??
    ""
  ).toLowerCase();
}


function getProviderDocument(response) {
  const data = getProviderData(response);

  return (
    response?.document_url ??
    response?.documentUrl ??
    response?.slip_url ??
    response?.slipUrl ??
    data?.document_url ??
    data?.documentUrl ??
    data?.slip_url ??
    data?.slipUrl ??
    null
  );
}


function stripDataUri(value) {
  if (typeof value !== "string") {
    return null;
  }

  let clean = value.trim();

  if (!clean) {
    return null;
  }

  if (clean.startsWith("data:")) {
    const commaIndex = clean.indexOf(",");

    if (commaIndex === -1) {
      return null;
    }

    clean = clean.slice(commaIndex + 1);
  }

  clean = clean.replace(/\s+/g, "");

  return clean || null;
}


function extractPdfFromBase64(value) {
  const clean = stripDataUri(value);

  if (!clean) {
    return null;
  }

  try {
    const sourceBuffer = Buffer.from(
      clean,
      "base64"
    );

    if (sourceBuffer.length < 5) {
      return null;
    }

    const pdfHeader = Buffer.from(
      "%PDF-",
      "ascii"
    );

    const eofMarker = Buffer.from(
      "%%EOF",
      "ascii"
    );

    const pdfStart =
      sourceBuffer.indexOf(pdfHeader);

    if (pdfStart === -1) {
      return null;
    }

    const eofPosition =
      sourceBuffer.lastIndexOf(
        eofMarker
      );

    if (
      eofPosition === -1 ||
      eofPosition < pdfStart
    ) {
      return null;
    }

    const pdfBuffer =
      sourceBuffer.subarray(
        pdfStart,
        eofPosition +
          eofMarker.length
      );

    if (pdfBuffer.length < 10) {
      return null;
    }

    if (
      pdfBuffer
        .subarray(0, 5)
        .toString("ascii") !==
      "%PDF-"
    ) {
      return null;
    }

    return pdfBuffer.toString(
      "base64"
    );
  } catch {
    return null;
  }
}


function getProviderPdfBase64(response) {
  if (!response) {
    return null;
  }

  const preferredKeys = [
    "pdf_base64",
    "pdfBase64",
    "pdf",
    "slip_base64",
    "slipBase64",
    "document_base64",
    "documentBase64",
    "photo",
    "image",
    "document",
    "slip",
  ];

  const visited = new Set();

  function walk(
    value,
    keyName = "",
    depth = 0
  ) {
    if (
      value === null ||
      value === undefined ||
      depth > 12
    ) {
      return null;
    }

    if (typeof value === "string") {
      const direct =
        extractPdfFromBase64(value);

      if (direct) {
        return direct;
      }

      const normalizedKey = String(
        keyName || ""
      ).toLowerCase();

      const looksLikeDocument =
        normalizedKey.includes("pdf") ||
        normalizedKey.includes("slip") ||
        normalizedKey.includes("document") ||
        normalizedKey.includes("photo") ||
        normalizedKey.includes("image") ||
        normalizedKey.includes("base64");

      if (looksLikeDocument) {
        return extractPdfFromBase64(
          value
        );
      }

      return null;
    }

    if (typeof value !== "object") {
      return null;
    }

    if (visited.has(value)) {
      return null;
    }

    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(
          item,
          keyName,
          depth + 1
        );

        if (found) {
          return found;
        }
      }

      return null;
    }

    for (const key of preferredKeys) {
      if (
        Object.prototype.hasOwnProperty.call(
          value,
          key
        )
      ) {
        const found = walk(
          value[key],
          key,
          depth + 1
        );

        if (found) {
          return found;
        }
      }
    }

    for (const [key, child] of Object.entries(
      value
    )) {
      if (preferredKeys.includes(key)) {
        continue;
      }

      const found = walk(
        child,
        key,
        depth + 1
      );

      if (found) {
        return found;
      }
    }

    return null;
  }

  return walk(response);
}


/**
 * =========================================================
 * PROVIDER STATUS
 * =========================================================
 */

function isProviderSuccessful(response) {
  if (!response) {
    return false;
  }

  if (response.success === true) {
    return true;
  }

  if (response.verified === true) {
    return true;
  }

  const statuses = [
    response?.status,
    response?.state,
    response?.data?.status,
    response?.data?.state,
    response?.result?.status,
    response?.result?.state,
  ];

  return statuses.some((status) => {
    const value = String(status || "").toLowerCase();

    return [
      "success",
      "successful",
      "completed",
      "complete",
      "done",
      "verified",
    ].includes(value);
  });
}


function isProviderPending(response) {
  if (!response) {
    return false;
  }

  const statuses = [
    response?.status,
    response?.state,
    response?.data?.status,
    response?.data?.state,
    response?.result?.status,
    response?.result?.state,
  ];

  return statuses.some((status) => {
    const value = String(status || "").toLowerCase();

    return [
      "pending",
      "processing",
      "queued",
      "in_progress",
      "in-progress",
    ].includes(value);
  });
}


/**
 * =========================================================
 * RECOVER NIN FROM PROVIDER RESPONSE
 * =========================================================
 */

function extractRecoveredNin(response) {
  const data = getProviderData(response);

  const possibleValues = [
    response?.nin,
    response?.NIN,
    response?.nin_number,
    response?.ninNumber,

    data?.nin,
    data?.NIN,
    data?.nin_number,
    data?.ninNumber,

    data?.details?.nin,
    data?.details?.NIN,
    data?.details?.nin_number,
    data?.details?.ninNumber,

    response?.result?.nin,
    response?.result?.NIN,
    response?.result?.nin_number,
    response?.result?.ninNumber,
  ];

  for (const value of possibleValues) {
    if (value === undefined || value === null) {
      continue;
    }

    const normalized = normalizeNin(value);

    if (/^\d{11}$/.test(normalized)) {
      return normalized;
    }
  }

  return null;
}


/**
 * =========================================================
 * NIN SERVICE INFORMATION
 * =========================================================
 */

export async function getNinService() {
  const prices = {};
  let pricingComplete = true;

  for (const cardType of SUPPORTED_CARD_TYPES) {
    const amount = getCustomerNinPrice(cardType);

    prices[cardType] = amount;

    if (amount === null) {
      pricingComplete = false;
    }
  }

  return {
    provider: NETWORKDATASUB_PROVIDER,
    available: true,
    pricingSource: pricingComplete
      ? "eVault-env"
      : "eVault-env-incomplete",
    currency: "NGN",
    prices,
    cardTypes: SUPPORTED_CARD_TYPES,
    supportedCardTypes: SUPPORTED_CARD_TYPES,
    recovery: {
      phone: true,
      demographic: false,
    },
  };
}


/**
 * =========================================================
 * VERIFY NIN BY NUMBER
 * =========================================================
 */

export async function verifyNinByNumber({
  userId,
  nin,
  cardType = null,
  slipType = null,
  transactionPin,
  idempotencyKey,
  validationType = "full",
}) {
  return submitNin({
    userId,
    nin,
    cardType: cardType ?? slipType,
    slipType,
    transactionPin,
    idempotencyKey,
    validationType,
  });
}


/**
 * =========================================================
 * SUBMIT NIN
 * =========================================================
 */

export async function submitNin({
  userId,
  nin,
  cardType = null,
  slipType = null,
  transactionPin,
  idempotencyKey,
  validationType = "full",
}) {
  const normalizedNin = normalizeNin(nin);

  const normalizedCardType =
    normalizeCardType(cardType ?? slipType ?? "standard");

  const normalizedValidationType =
    normalizeValidationType(validationType);

  validateNin(normalizedNin);
  validateCardType(normalizedCardType);

  if (!userId) {
    const error = new Error(
      "User ID is required."
    );

    error.code = "USER_ID_REQUIRED";

    throw error;
  }

  if (!transactionPin) {
    const error = new Error(
      "Transaction PIN is required."
    );

    error.code = "TRANSACTION_PIN_REQUIRED";

    throw error;
  }

  const finalIdempotencyKey =
    idempotencyKey ||
    createRequestReference("NIN");

  /**
   * -------------------------------------------------------
   * IDEMPOTENCY CHECK
   * -------------------------------------------------------
   */

  const existingRequest =
    await findIdentityRequestByIdempotencyKey(
      finalIdempotencyKey
    );

  if (existingRequest) {
    return {
      success:
        existingRequest.status === SUCCESS_STATUS,

      duplicate: true,

      request: {
        id: existingRequest.id,
        status: existingRequest.status,
        provider: existingRequest.provider,
        providerReference:
          existingRequest.provider_reference,
        transactionReference:
          existingRequest.transaction_reference,
        amount: Number(
          existingRequest.amount
        ),
        result:
          sanitizeNinResultForClient(
            existingRequest.result
          ),
        hasPdf: Boolean(
          getResultPdfBase64(
            existingRequest.result
          )
        ),
      },

      status: existingRequest.status,

      requestId: existingRequest.id,
      amount: Number(existingRequest.amount),
    };
  }

  /**
   * -------------------------------------------------------
   * CUSTOMER PRICE
   * -------------------------------------------------------
   */

  const amount = requireCustomerNinPrice(
    normalizedCardType
  );

  /**
   * -------------------------------------------------------
   * DATABASE TRANSACTION
   * -------------------------------------------------------
   */

  const client = await db.connect();

  let requestId;
  let transactionReference;

  try {
    await client.query("BEGIN");

    /**
     * -----------------------------------------------------
     * LOCK USER WALLET
     * -----------------------------------------------------
     */

    const wallet =
      await findWalletForUpdateByUserId(
        userId,
        client
      );

    if (!wallet) {
      const error = new Error(
        "Wallet not found."
      );

      error.code = "WALLET_NOT_FOUND";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * VERIFY TRANSACTION PIN
     * -----------------------------------------------------
     */

    const pinValid =
      await verifyTransactionPin(
        userId,
        transactionPin
      );

    if (!pinValid) {
      const error = new Error(
        "Invalid transaction PIN."
      );

      error.code = "INVALID_TRANSACTION_PIN";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * CHECK BALANCE
     * -----------------------------------------------------
     */

    const balanceBefore = Number(
      wallet.available_balance
    );

    if (!Number.isFinite(balanceBefore)) {
      const error = new Error(
        "Invalid wallet balance."
      );

      error.code = "INVALID_WALLET_BALANCE";

      throw error;
    }

    if (balanceBefore < amount) {
      const error = new Error(
        "Insufficient wallet balance."
      );

      error.code = "INSUFFICIENT_BALANCE";

      throw error;
    }

    const balanceAfter =
      balanceBefore - amount;

    /**
     * -----------------------------------------------------
     * PAYMENT TRANSACTION
     * -----------------------------------------------------
     *
     * IMPORTANT:
     * The transactions table does not use a currency
     * column in the current Evault schema.
     */

    transactionReference =
      createRequestReference("NINPAY");

    await createTransaction(
      {
        userId,
        walletId: wallet.id,
        reference: transactionReference,
        type: TRANSACTION_TYPE,
        amount,
        status: PENDING_STATUS,
        balanceBefore,
        balanceAfter,
        description:
          `${getCardLabel(
            normalizedCardType
          )} verification`,
        metadata: {
          provider: NETWORKDATASUB_PROVIDER,
          identityType: "NIN",
          cardType: normalizedCardType,
          nin: maskNin(normalizedNin),
          validationType:
            normalizedValidationType,
          idempotencyKey:
            finalIdempotencyKey,
          customerPriceSource: "eVault-env",
        },
      },
      client
    );

    /**
     * -----------------------------------------------------
     * IDENTITY REQUEST
     * -----------------------------------------------------
     *
     * identity_requests DOES have currency.
     */

    const identityRequest =
      await createIdentityRequest(
        {
          userId,
          identityType: "NIN",
          provider: NETWORKDATASUB_PROVIDER,
          providerReference: null,
          identifierHash:
            hashIdentifier(normalizedNin),
          validationType:
            normalizedValidationType,
          slipType:
            normalizedCardType,
          amount,
          currency: "NGN",
          status: PENDING_STATUS,
          transactionReference,
          idempotencyKey:
            finalIdempotencyKey,
          ownershipConfirmed: false,
          result: null,
          documentUrl: null,
          documentExpires: null,
          errorCode: null,
          errorMessage: null,
        },
        client
      );

    requestId =
      identityRequest.id;

    /**
     * -----------------------------------------------------
     * CREATE / UPDATE NIN RECORD
     * -----------------------------------------------------
     */

    await upsertNinVerification({
      userId,
      nin: normalizedNin,
      ninVerified: false,
      status: PENDING_STATUS,
    });

    /**
     * -----------------------------------------------------
     * DEBIT WALLET
     * -----------------------------------------------------
     */

    await debitWallet(
      wallet.id,
      amount,
      client
    );

    /**
     * -----------------------------------------------------
     * PAYMENT -> PROCESSING
     * -----------------------------------------------------
     */

    await updateTransactionStatus(
      transactionReference,
      PROCESSING_STATUS,
      client
    );

    await updateIdentityRequestStatus(
      requestId,
      PROCESSING_STATUS,
      client
    );

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {}

    throw error;
  } finally {
    client.release();
  }

  /**
   * =======================================================
   * PROVIDER REQUEST
   * =======================================================
   */

  let providerResponse;

  try {
    providerResponse =
      await verifyNinByCardType({
        nin: normalizedNin,
        cardType: normalizedCardType,
      });
  } catch (providerError) {
    return handleNinProviderFailure({
      requestId,
      userId,
      transactionReference,
      providerError,
      errorCode:
        providerError?.providerResponse
          ? getProviderErrorCode(
              providerError.providerResponse
            )
          : providerError?.code,
      errorMessage:
        providerError?.providerResponse
          ? getProviderMessage(
              providerError.providerResponse
            )
          : providerError?.message,
      providerResponse:
        providerError?.providerResponse ||
        null,
    });
  }

  /**
   * -------------------------------------------------------
   * PROVIDER REFERENCE
   * -------------------------------------------------------
   */

  const providerReference =
    getProviderReference(
      providerResponse
    );

  if (providerReference) {
    await updateProviderReference(
      requestId,
      providerReference
    );
  }

  /**
   * -------------------------------------------------------
   * PENDING
   * -------------------------------------------------------
   */

  if (
    isProviderPending(
      providerResponse
    ) &&
    !isProviderSuccessful(
      providerResponse
    )
  ) {
    await updateIdentityRequestResult(
      requestId,
      {
        status: PENDING_STATUS,
        provider: NETWORKDATASUB_PROVIDER,
        providerReference,
        response: providerResponse,
      }
    );

    await updateTransactionStatus(
      transactionReference,
      PENDING_STATUS
    );

    return {
      success: false,
      pending: true,
      status: PENDING_STATUS,
      requestId,
      transactionReference,
      providerReference,
      amount,
    };
  }

  /**
   * -------------------------------------------------------
   * PROVIDER FAILURE
   * -------------------------------------------------------
   */

  if (
    !isProviderSuccessful(
      providerResponse
    )
  ) {
    return handleNinProviderFailure({
      requestId,
      userId,
      transactionReference,
      providerResponse,
      errorCode:
        getProviderErrorCode(
          providerResponse
        ),
      errorMessage:
        getProviderMessage(
          providerResponse
        ),
    });
  }

  /**
   * -------------------------------------------------------
   * SUCCESS
   * -------------------------------------------------------
   */

  const documentUrl =
    getProviderDocument(
      providerResponse
    );

  const pdfBase64 =
    getProviderPdfBase64(
      providerResponse
    );

  const result = {
    status: SUCCESS_STATUS,
    provider: NETWORKDATASUB_PROVIDER,
    providerReference,
    cardType: normalizedCardType,
    validationType:
      normalizedValidationType,
    documentUrl,
    pdfBase64: pdfBase64 || null,
    hasPdf: Boolean(pdfBase64),
  };

  await updateIdentityRequestResult(
    requestId,
    result
  );

  await updateIdentityRequestStatus(
    requestId,
    SUCCESS_STATUS
  );

  await updateTransactionStatus(
    transactionReference,
    SUCCESS_STATUS
  );

  await updateNin(
    userId,
    normalizedNin,
    true
  );

  await markNinAsVerified(
    userId
  );

  await createIdentityNotification({
    userId,
    title: "NIN Verification Successful",
    message:
      `${getCardLabel(
        normalizedCardType
      )} verification was completed successfully.`,
    type: "IDENTITY",
    metadata: {
      requestId,
      transactionReference,
      providerReference,
      downloadAvailable: Boolean(pdfBase64),
    },
  });

  return {
    success: true,
    status: SUCCESS_STATUS,
    requestId,
    transactionReference,
    providerReference,
    amount,
    currency: "NGN",
    cardType: normalizedCardType,
    cardLabel:
      getCardLabel(
        normalizedCardType
      ),
    nin:
      maskNin(normalizedNin),
    documentUrl,
    hasPdf: Boolean(pdfBase64),
  };
}


/**
 * =========================================================
 * RECOVER NIN BY PHONE
 * =========================================================
 */

export async function recoverNin({
  userId,
  phone,
  cardType = "standard",
  transactionPin,
  idempotencyKey,
}) {
  const normalizedPhone =
    normalizePhone(phone);

  const normalizedCardType =
    normalizeCardType(cardType);

  validatePhone(normalizedPhone);
  validateCardType(normalizedCardType);

  if (!userId) {
    const error = new Error(
      "User ID is required."
    );

    error.code = "USER_ID_REQUIRED";

    throw error;
  }

  if (!transactionPin) {
    const error = new Error(
      "Transaction PIN is required."
    );

    error.code =
      "TRANSACTION_PIN_REQUIRED";

    throw error;
  }

  const finalIdempotencyKey =
    idempotencyKey ||
    createRequestReference("NINREC");

  const existingRequest =
    await findIdentityRequestByIdempotencyKey(
      finalIdempotencyKey
    );

  if (existingRequest) {
    return {
      success:
        existingRequest.status ===
        SUCCESS_STATUS,

      duplicate: true,

      request: {
        id: existingRequest.id,
        status:
          existingRequest.status,
        provider:
          existingRequest.provider,
        providerReference:
          existingRequest.provider_reference,
        transactionReference:
          existingRequest.transaction_reference,
        amount:
          Number(existingRequest.amount),
        result:
          sanitizeNinResultForClient(
            existingRequest.result
          ),
        hasPdf: Boolean(
          getResultPdfBase64(
            existingRequest.result
          )
        ),
      },

      status:
        existingRequest.status,

      requestId:
        existingRequest.id,
      amount:
        Number(existingRequest.amount),
    };
  }

  const amount =
    requireCustomerPhoneRecoveryPrice(
      normalizedCardType
    );

  const client = await db.connect();

  let requestId;
  let transactionReference;

  try {
    await client.query("BEGIN");

    const wallet =
      await findWalletForUpdateByUserId(
        userId,
        client
      );

    if (!wallet) {
      const error = new Error(
        "Wallet not found."
      );

      error.code =
        "WALLET_NOT_FOUND";

      throw error;
    }

    const pinValid =
      await verifyTransactionPin(
        userId,
        transactionPin
      );

    if (!pinValid) {
      const error = new Error(
        "Invalid transaction PIN."
      );

      error.code =
        "INVALID_TRANSACTION_PIN";

      throw error;
    }

    const balanceBefore =
      Number(
        wallet.available_balance
      );

    if (!Number.isFinite(balanceBefore)) {
      const error = new Error(
        "Invalid wallet balance."
      );

      error.code =
        "INVALID_WALLET_BALANCE";

      throw error;
    }

    if (balanceBefore < amount) {
      const error = new Error(
        "Insufficient wallet balance."
      );

      error.code =
        "INSUFFICIENT_BALANCE";

      throw error;
    }

    const balanceAfter =
      balanceBefore - amount;

    transactionReference =
      createRequestReference(
        "NINREC"
      );

    await createTransaction(
      {
        userId,
        walletId: wallet.id,
        reference:
          transactionReference,
        type: TRANSACTION_TYPE,
        amount,
        status: PENDING_STATUS,
        balanceBefore,
        balanceAfter,
        description:
          `${getCardLabel(
            normalizedCardType
          )} NIN recovery`,
        metadata: {
          provider:
            NETWORKDATASUB_PROVIDER,
          identityType:
            REQUEST_TYPE_NIN_RECOVERY,
          cardType:
            normalizedCardType,
          phone:
            maskPhone(
              normalizedPhone
            ),
          idempotencyKey:
            finalIdempotencyKey,
          customerPriceSource:
            "eVault-env",
        },
      },
      client
    );

    const identityRequest =
      await createIdentityRequest(
        {
          userId,
          identityType:
            "NIN",
          provider:
            NETWORKDATASUB_PROVIDER,
          providerReference:
            null,
          identifierHash:
            hashIdentifier(
              normalizedPhone
            ),
          validationType:
            "phone",
          slipType:
            normalizedCardType,
          amount,
          currency:
            "NGN",
          status:
            PENDING_STATUS,
          transactionReference,
          idempotencyKey:
            finalIdempotencyKey,
          ownershipConfirmed:
            false,
          result:
            null,
          documentUrl:
            null,
          documentExpires:
            null,
          errorCode:
            null,
          errorMessage:
            null,
        },
        client
      );

    requestId =
      identityRequest.id;

    await debitWallet(
      wallet.id,
      amount,
      client
    );

    await updateTransactionStatus(
      transactionReference,
      PROCESSING_STATUS,
      client
    );

    await updateIdentityRequestStatus(
      requestId,
      PROCESSING_STATUS,
      client
    );

    await client.query("COMMIT");
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

  let providerResponse;

  try {
    providerResponse =
      await searchNinByPhone({
        phone: normalizedPhone,
        cardType:
          normalizedCardType,
      });
  } catch (providerError) {
    return handleNinProviderFailure({
      requestId,
      userId,
      transactionReference,
      providerError,
      errorCode:
        providerError?.code,
      errorMessage:
        providerError?.message,
      providerResponse:
        providerError?.providerResponse ||
        null,
    });
  }

  const providerReference =
    getProviderReference(
      providerResponse
    );

  if (providerReference) {
    await updateProviderReference(
      requestId,
      providerReference
    );
  }

  if (
    isProviderPending(
      providerResponse
    ) &&
    !isProviderSuccessful(
      providerResponse
    )
  ) {
    await updateIdentityRequestResult(
      requestId,
      {
        status:
          PENDING_STATUS,
        provider:
          NETWORKDATASUB_PROVIDER,
        providerReference,
        response:
          providerResponse,
      }
    );

    await updateTransactionStatus(
      transactionReference,
      PENDING_STATUS
    );

    return {
      success: false,
      pending: true,
      status:
        PENDING_STATUS,
      requestId,
      transactionReference,
      providerReference,
      amount,
    };
  }

  if (
    !isProviderSuccessful(
      providerResponse
    )
  ) {
    return handleNinProviderFailure({
      requestId,
      userId,
      transactionReference,
      providerResponse,
      errorCode:
        getProviderErrorCode(
          providerResponse
        ),
      errorMessage:
        getProviderMessage(
          providerResponse
        ),
    });
  }

  const recoveredNin =
    extractRecoveredNin(
      providerResponse
    );

  const documentUrl =
    getProviderDocument(
      providerResponse
    );

  const pdfBase64 =
    getProviderPdfBase64(
      providerResponse
    );

  const result = {
    status:
      SUCCESS_STATUS,

    provider:
      NETWORKDATASUB_PROVIDER,

    providerReference,

    cardType:
      normalizedCardType,

    documentUrl,

    pdfBase64:
      pdfBase64 || null,

    hasPdf:
      Boolean(pdfBase64),

    recoveredNin:
      recoveredNin
        ? maskNin(recoveredNin)
        : null,
  };

  await updateIdentityRequestResult(
    requestId,
    result
  );

  await updateIdentityRequestStatus(
    requestId,
    SUCCESS_STATUS
  );

  await updateTransactionStatus(
    transactionReference,
    SUCCESS_STATUS
  );

  if (recoveredNin) {
    await updateNin(
      userId,
      recoveredNin,
      true
    );

    await markNinAsVerified(
      userId
    );
  }

  await createIdentityNotification({
    userId,
    title:
      "NIN Recovery Successful",
    message:
      recoveredNin
        ? "Your NIN has been successfully recovered."
        : "Your NIN recovery request was completed successfully.",
    type:
      "IDENTITY",
    metadata: {
      requestId,
      transactionReference,
      providerReference,
      downloadAvailable: Boolean(pdfBase64),
    },
  });

  return {
    success: true,
    status:
      SUCCESS_STATUS,

    requestId,

    transactionReference,

    providerReference,

    amount,

    currency: "NGN",

    cardType:
      normalizedCardType,

    cardLabel:
      getCardLabel(
        normalizedCardType
      ),

    nin:
      recoveredNin
        ? maskNin(recoveredNin)
        : null,

    documentUrl,

    hasPdf:
      Boolean(pdfBase64),
  };
}


/**
 * =========================================================
 * PROVIDER FAILURE HANDLER
 * =========================================================
 */

async function handleNinProviderFailure({
  requestId,
  userId,
  transactionReference,
  providerError,
  providerResponse = null,
  errorCode = null,
  errorMessage = null,
}) {
  const response =
    providerResponse ||
    providerError?.providerResponse ||
    null;

  const finalErrorCode =
    errorCode ||
    (
      response
        ? getProviderErrorCode(
            response
          )
        : null
    ) ||
    providerError?.code ||
    "NIN_PROVIDER_ERROR";

  const finalErrorMessage =
    errorMessage ||
    (
      response
        ? getProviderMessage(
            response
          )
        : null
    ) ||
    providerError?.message ||
    "NIN provider request failed.";

  const existingRequest =
    await findIdentityRequestById(
      requestId
    );

  if (!existingRequest) {
    throw new Error(
      "NIN identity request was not found."
    );
  }

  /**
   * Preserve failed NIN state.
   */

  if (
    existingRequest.identity_type ===
    "NIN"
  ) {
    await upsertNinVerification({
      userId,
      nin: null,
      ninVerified: false,
      status:
        FAILED_STATUS,
    }).catch(() => {
      /*
       * Do not prevent the refund flow if
       * the auxiliary NIN record update fails.
       */
    });
  }

  /**
   * Refund customer payment.
   *
   * This also remains compatible with:
   *
   * refundFailedNinRequest(request.id, error)
   */

  const refund =
    await refundFailedNinRequest(
      requestId,
      {
        errorCode:
          finalErrorCode,

        errorMessage:
          finalErrorMessage,

        providerResponse:
          response,
      }
    );

  return {
    success: false,

    status:
      FAILED_STATUS,

    requestId,

    transactionReference,

    refunded: true,

    refund,

    errorCode:
      finalErrorCode,

    message:
      finalErrorMessage,
  };
}


/**
 * =========================================================
 * REFUND FAILED NIN REQUEST
 * =========================================================
 *
 * Supports BOTH:
 *
 * 1. Object style:
 *
 * refundFailedNinRequest({
 *   requestId,
 *   errorCode,
 *   errorMessage
 * })
 *
 * 2. Existing InstantIPE webhook style:
 *
 * refundFailedNinRequest(request.id, error)
 *
 * DO NOT REMOVE THE SECOND FORM.
 * =========================================================
 */

export async function refundFailedNinRequest(
  requestIdOrOptions,
  legacyError = {}
) {
  let requestId;
  let errorCode;
  let errorMessage;
  let providerResponse;

  if (
    requestIdOrOptions &&
    typeof requestIdOrOptions ===
      "object"
  ) {
    requestId =
      requestIdOrOptions.requestId ??
      requestIdOrOptions.id;

    errorCode =
      requestIdOrOptions.errorCode ??
      requestIdOrOptions.error_code ??
      null;

    errorMessage =
      requestIdOrOptions.errorMessage ??
      requestIdOrOptions.error_message ??
      null;

    providerResponse =
      requestIdOrOptions.providerResponse ??
      null;
  } else {
    requestId =
      requestIdOrOptions;

    errorCode =
      legacyError?.errorCode ??
      legacyError?.error_code ??
      null;

    errorMessage =
      legacyError?.errorMessage ??
      legacyError?.error_message ??
      null;

    providerResponse =
      legacyError?.providerResponse ??
      null;
  }

  if (!requestId) {
    const error = new Error(
      "Identity request ID is required for refund."
    );

    error.code =
      "IDENTITY_REQUEST_ID_REQUIRED";

    throw error;
  }

  const client =
    await db.connect();

  let refundTransaction;

  try {
    await client.query(
      "BEGIN"
    );

    /**
     * -----------------------------------------------------
     * FIND REQUEST
     * -----------------------------------------------------
     */

    const request =
      await findIdentityRequestById(
        requestId,
        client
      );

    if (!request) {
      const error = new Error(
        "Identity request not found."
      );

      error.code =
        "IDENTITY_REQUEST_NOT_FOUND";

      throw error;
    }

    const userId =
      request.user_id;

    const originalTransactionReference =
      request.transaction_reference;

    if (
      !originalTransactionReference
    ) {
      const error = new Error(
        "Original transaction reference is missing."
      );

      error.code =
        "ORIGINAL_TRANSACTION_REFERENCE_MISSING";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * FIND ORIGINAL TRANSACTION
     * -----------------------------------------------------
     */

    const originalTransaction =
      await findTransactionByReference(
        originalTransactionReference,
        client
      );

    if (!originalTransaction) {
      const error = new Error(
        "Original NIN transaction was not found."
      );

      error.code =
        "ORIGINAL_TRANSACTION_NOT_FOUND";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * DO NOT REFUND SUCCESSFUL TRANSACTION
     * -----------------------------------------------------
     */

    if (
      String(
        originalTransaction.status
      ).toUpperCase() ===
      SUCCESS_STATUS
    ) {
      const error = new Error(
        "A successful NIN transaction cannot be refunded."
      );

      error.code =
        "SUCCESS_TRANSACTION_REFUND_BLOCKED";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * LOCK WALLET
     * -----------------------------------------------------
     *
     * We lock the wallet before checking/creating the
     * refund so concurrent refund attempts cannot both
     * credit the wallet.
     * -----------------------------------------------------
     */

    const wallet =
      await findWalletForUpdate(
        originalTransaction.wallet_id,
        client
      );

    if (!wallet) {
      const error = new Error(
        "Wallet not found for refund."
      );

      error.code =
        "REFUND_WALLET_NOT_FOUND";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * DUPLICATE REFUND PROTECTION
     * -----------------------------------------------------
     *
     * IMPORTANT:
     *
     * transactions uses wallet_id.
     *
     * Do NOT query transactions.user_id.
     * -----------------------------------------------------
     */

    const existingRefundResult =
      await client.query(
        `
        SELECT id, reference
        FROM transactions
        WHERE wallet_id = $1
          AND type = $2
          AND metadata->>'originalReference' = $3
        LIMIT 1
        `,
        [
          wallet.id,
          REFUND_TYPE,
          originalTransactionReference,
        ]
      );

    if (
      existingRefundResult.rows.length >
      0
    ) {
      await client.query(
        "COMMIT"
      );

      return {
        success: true,

        alreadyRefunded: true,

        refundTransaction:
          existingRefundResult
            .rows[0],
      };
    }

    /**
     * -----------------------------------------------------
     * REFUND AMOUNT
     * -----------------------------------------------------
     */

    const refundAmount =
      Number(
        originalTransaction.amount
      );

    if (
      !Number.isFinite(
        refundAmount
      ) ||
      refundAmount <= 0
    ) {
      const error = new Error(
        "Invalid original transaction amount."
      );

      error.code =
        "INVALID_REFUND_AMOUNT";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * BALANCE
     * -----------------------------------------------------
     */

    const balanceBefore =
      Number(
        wallet.available_balance
      );

    if (
      !Number.isFinite(
        balanceBefore
      )
    ) {
      const error = new Error(
        "Invalid wallet balance during NIN refund."
      );

      error.code =
        "INVALID_REFUND_WALLET_BALANCE";

      throw error;
    }

    const balanceAfter =
      balanceBefore +
      refundAmount;

    /**
     * -----------------------------------------------------
     * MARK ORIGINAL PAYMENT FAILED
     * -----------------------------------------------------
     */

    await updateTransactionStatus(
      originalTransactionReference,
      FAILED_STATUS,
      client
    );

    /**
     * -----------------------------------------------------
     * MARK IDENTITY REQUEST FAILED
     * -----------------------------------------------------
     */

    await markIdentityRequestFailed(
      requestId,
      {
        errorCode:
          errorCode ||
          "NIN_PROVIDER_ERROR",

        errorMessage:
          errorMessage ||
          "NIN provider request failed.",

        result: {
          provider:
            request.provider,

          providerResponse:
            providerResponse ||
            null,
        },
      },
      client
    );

    /**
     * -----------------------------------------------------
     * CREDIT WALLET
     * -----------------------------------------------------
     */

    const creditedWallet =
      await creditWallet(
        wallet.id,
        refundAmount,
        client
      );

    if (!creditedWallet) {
      const error = new Error(
        "Unable to credit wallet during NIN refund."
      );

      error.code =
        "REFUND_WALLET_CREDIT_FAILED";

      throw error;
    }

    /**
     * -----------------------------------------------------
     * REFUND TRANSACTION
     * -----------------------------------------------------
     *
     * IMPORTANT:
     *
     * Your transactions table does NOT have a currency
     * column.
     *
     * Therefore currency is intentionally NOT included
     * in this createTransaction() payload.
     *
     * identity_requests DOES have currency, so its
     * currency field remains "NGN".
     * -----------------------------------------------------
     */

    const refundReference =
      createRequestReference(
        "NINREF"
      );

    refundTransaction =
      await createTransaction(
        {
          userId:
            userId,

          walletId:
            originalTransaction.wallet_id,

          reference:
            refundReference,

          type:
            REFUND_TYPE,

          amount:
            refundAmount,

          status:
            SUCCESS_STATUS,

          balanceBefore,

          balanceAfter,

          description:
            "Refund for failed NIN request",

          metadata: {
            originalReference:
              originalTransactionReference,

            identityRequestId:
              requestId,

            provider:
              request.provider,

            errorCode:
              errorCode ||
              "NIN_PROVIDER_ERROR",

            reason:
              errorMessage ||
              "NIN provider request failed.",
          },
        },
        client
      );

    /**
     * -----------------------------------------------------
     * COMMIT
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
   * REFUND NOTIFICATION
   * -------------------------------------------------------
   */

  try {
    const request =
      await findIdentityRequestById(
        requestId
      );

    if (request?.user_id) {
      await createIdentityNotification({
        userId:
          request.user_id,

        title:
          "NIN Verification Refunded",

        message:
          "Your NIN request could not be completed. The payment has been refunded to your wallet.",

        type:
          "IDENTITY",

        metadata: {
          requestId,

          refundTransaction:
            refundTransaction?.reference ||
            null,

          errorCode:
            errorCode ||
            "NIN_PROVIDER_ERROR",

          downloadAvailable: false,
        },
      });
    }
  } catch {
    /*
     * Notification failure must never reverse
     * a successful wallet refund.
     */
  }

  return {
    success: true,

    refunded: true,

    refundTransaction,
  };
}


/**
 * =========================================================
 * GET NIN REQUEST
 * =========================================================
 *
 * Supports:
 *
 * getNinRequest(requestId)
 *
 * and:
 *
 * getNinRequest({ requestId })
 * =========================================================
 */

export async function getNinRequest(
  requestIdOrOptions,
  userId = null
) {
  const requestId =
    requestIdOrOptions &&
    typeof requestIdOrOptions === "object"
      ? (
          requestIdOrOptions.requestId ??
          requestIdOrOptions.id
        )
      : requestIdOrOptions;

  const effectiveUserId =
    requestIdOrOptions &&
    typeof requestIdOrOptions === "object"
      ? (
          requestIdOrOptions.userId ??
          userId
        )
      : userId;

  if (!requestId) {
    const error = new Error(
      "NIN request ID is required."
    );

    error.code =
      "NIN_REQUEST_ID_REQUIRED";
    error.statusCode = 400;

    throw error;
  }

  if (effectiveUserId) {
    return findUserIdentityRequestById(
      requestId,
      effectiveUserId
    );
  }

  return findIdentityRequestById(
    requestId
  );
}


/**
 * =========================================================
 * GET NIN REQUEST STATUS
 * =========================================================
 */

export async function getNinRequestStatus(
  requestId,
  userId = null
) {
  const request = userId
    ? await findUserIdentityRequestById(
        requestId,
        userId
      )
    : await getNinRequest(requestId);

  if (!request) {
    const error = new Error(
      "NIN request not found."
    );

    error.code =
      "NIN_REQUEST_NOT_FOUND";
    error.statusCode = 404;

    throw error;
  }

  const pdfBase64 =
    getResultPdfBase64(request.result);

  return {
    success: true,
    requestId: request.id,
    status: request.status,
    provider: request.provider,
    providerReference:
      request.provider_reference,
    transactionReference:
      request.transaction_reference,
    amount: Number(request.amount),
    currency: request.currency || "NGN",
    result:
      sanitizeNinResultForClient(
        request.result
      ),
    documentUrl: request.document_url,
    documentExpiresAt:
      request.document_expires_at,
    hasPdf: Boolean(pdfBase64),
    errorCode: request.error_code,
    errorMessage: request.error_message,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
  };
}


/**
 * =========================================================
 * GET USER NIN HISTORY
 * =========================================================
 */

export async function getNinHistory(
  userId
) {
  if (!userId) {
    const error = new Error(
      "User ID is required."
    );

    error.code =
      "USER_ID_REQUIRED";

    throw error;
  }

  const requests =
    await findIdentityRequestsByUserId(
      userId
    );

  return requests.map(
    (request) => ({
      ...request,
      result:
        sanitizeNinResultForClient(
          request?.result
        ),
      hasPdf: Boolean(
        getResultPdfBase64(
          request?.result
        )
      ),
    })
  );
}


/**
 * =========================================================
 * GET NIN DOCUMENT
 * =========================================================
 */

function sanitizeNinResultForClient(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  return {
    status:
      result.status ??
      null,

    provider:
      result.provider ??
      null,

    providerReference:
      result.providerReference ??
      result.provider_reference ??
      null,

    cardType:
      result.cardType ??
      result.card_type ??
      null,

    validationType:
      result.validationType ??
      result.validation_type ??
      null,

    documentUrl:
      result.documentUrl ??
      result.document_url ??
      null,

    hasPdf:
      Boolean(
        result.hasPdf ||
        getResultPdfBase64(result)
      ),

    recoveredNin:
      result.recoveredNin ??
      result.recovered_nin ??
      null,
  };
}


function getResultPdfBase64(result) {
  if (!result || typeof result !== "object") {
    return null;
  }

  const directCandidates = [
    result.pdfBase64,
    result.pdf_base64,
    result.response?.pdfBase64,
    result.response?.pdf_base64,
    result.response?.data?.pdfBase64,
    result.response?.data?.pdf_base64,
    result.data?.pdfBase64,
    result.data?.pdf_base64,
    result.data?.response?.pdfBase64,
    result.data?.response?.pdf_base64,
  ];

  for (const candidate of directCandidates) {
    const pdf = extractPdfFromBase64(
      candidate
    );

    if (pdf) {
      return pdf;
    }
  }

  return getProviderPdfBase64(
    result.response ||
      result.data?.response ||
      result
  );
}


function getStoredNinDocumentUrl(
  request,
  result
) {
  const candidates = [
    request?.document_url,
    request?.documentUrl,

    result?.documentUrl,
    result?.document_url,

    result?.download,
    result?.downloadUrl,
    result?.download_url,

    result?.document?.download,
    result?.document?.downloadUrl,
    result?.document?.download_url,

    result?.response?.download,
    result?.response?.downloadUrl,
    result?.response?.download_url,

    result?.response?.document?.download,
    result?.response?.document?.downloadUrl,
    result?.response?.document?.download_url,

    result?.response?.data?.download,
    result?.response?.data?.downloadUrl,
    result?.response?.data?.download_url,

    result?.response?.data?.document?.download,
    result?.response?.data?.document?.downloadUrl,
    result?.response?.data?.document?.download_url,
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      /^https?:\/\//i.test(
        value.trim()
      )
    ) {
      return value.trim();
    }
  }

  return null;
}


async function fetchStoredNinDocumentAsPdfBase64(
  documentUrl
) {
  if (!documentUrl) {
    return null;
  }

  let url;

  try {
    url = new URL(documentUrl);
  } catch {
    const error = new Error(
      "The stored NIN document URL is invalid."
    );

    error.code =
      "NIN_DOCUMENT_URL_INVALID";
    error.statusCode = 502;

    throw error;
  }

  if (
    !["http:", "https:"].includes(
      url.protocol
    )
  ) {
    const error = new Error(
      "The stored NIN document URL is not supported."
    );

    error.code =
      "NIN_DOCUMENT_URL_UNSUPPORTED";
    error.statusCode = 502;

    throw error;
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    30000
  );

  try {
    const response = await fetch(
      url,
      {
        method: "GET",
        headers: {
          Accept:
            "application/pdf,*/*",
        },
        redirect: "follow",
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const error = new Error(
        `Unable to retrieve the stored NIN document (HTTP ${response.status}).`
      );

      error.code =
        "NIN_DOCUMENT_FETCH_FAILED";
      error.statusCode = 502;

      throw error;
    }

    const maxBytes =
      25 * 1024 * 1024;

    const contentLength = Number(
      response.headers.get(
        "content-length"
      ) || 0
    );

    if (contentLength > maxBytes) {
      const error = new Error(
        "The stored NIN document is too large to download."
      );

      error.code =
        "NIN_DOCUMENT_TOO_LARGE";
      error.statusCode = 502;

      throw error;
    }

    const arrayBuffer =
      await response.arrayBuffer();

    const buffer = Buffer.from(
      arrayBuffer
    );

    if (buffer.length > maxBytes) {
      const error = new Error(
        "The stored NIN document is too large to download."
      );

      error.code =
        "NIN_DOCUMENT_TOO_LARGE";
      error.statusCode = 502;

      throw error;
    }

    if (
      buffer
        .subarray(0, 5)
        .toString("ascii") !==
      "%PDF-"
    ) {
      const error = new Error(
        "The stored NIN document is not a valid PDF."
      );

      error.code =
        "INVALID_NIN_PDF";
      error.statusCode = 502;

      throw error;
    }

    return buffer.toString(
      "base64"
    );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "The stored NIN document download timed out."
        );

      timeoutError.code =
        "NIN_DOCUMENT_FETCH_TIMEOUT";
      timeoutError.statusCode = 504;

      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


async function findNinDocumentRequest(
  identifier,
  userId
) {
  if (!identifier || !userId) {
    return null;
  }

  const cleanIdentifier = String(
    identifier
  ).trim();

  if (!cleanIdentifier) {
    return null;
  }

  try {
    const byId =
      await findUserIdentityRequestById(
        cleanIdentifier,
        userId
      );

    if (byId) {
      return byId;
    }
  } catch {
    /*
     * Historical notifications may contain
     * a transaction/provider reference rather
     * than the UUID request ID.
     */
  }

  const result = await db.query(
    `
      SELECT *
      FROM identity_requests
      WHERE user_id = $1
        AND identity_type = 'NIN'
        AND (
          transaction_reference = $2
          OR provider_reference = $2
        )
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [
      userId,
      cleanIdentifier,
    ]
  );

  return result.rows[0] || null;
}


export async function getNinDocument(
  requestIdentifier,
  userId = null
) {
  const request = userId
    ? await findNinDocumentRequest(
        requestIdentifier,
        userId
      )
    : await getNinRequest(
        requestIdentifier
      );

  if (!request) {
    const error = new Error(
      "NIN request not found."
    );

    error.code =
      "NIN_REQUEST_NOT_FOUND";
    error.statusCode = 404;

    throw error;
  }

  if (
    String(request.status || "").toUpperCase() !==
    SUCCESS_STATUS
  ) {
    const error = new Error(
      "NIN document is not available until the request is successful."
    );

    error.code =
      "NIN_DOCUMENT_NOT_AVAILABLE";
    error.statusCode = 409;

    throw error;
  }

  const result =
    request.result || {};

  let pdfBase64 =
    getResultPdfBase64(result);

  const documentUrl =
    getStoredNinDocumentUrl(
      request,
      result
    );

  if (
    !pdfBase64 &&
    documentUrl
  ) {
    pdfBase64 =
      await fetchStoredNinDocumentAsPdfBase64(
        documentUrl
      );
  }

  console.log(
    "NIN DOCUMENT RESOLUTION:",
    {
      requestedIdentifier:
        requestIdentifier,
      resolvedRequestId:
        request.id,
      transactionReference:
        request.transaction_reference,
      providerReference:
        request.provider_reference,
      hasPdf:
        Boolean(pdfBase64),
      pdfLength:
        pdfBase64?.length || 0,
      hasDocumentUrl:
        Boolean(documentUrl),
    }
  );

  if (!pdfBase64) {
    const error = new Error(
      "The NIN verification succeeded, but the stored PDF document is not available."
    );

    error.code =
      "NIN_PDF_NOT_AVAILABLE";
    error.statusCode = 409;

    throw error;
  }

  return {
    requestId:
      request.id,
    status:
      request.status,
    transactionReference:
      request.transaction_reference,
    providerReference:
      request.provider_reference,
    documentUrl,
    documentExpiresAt:
      request.document_expires_at,
    pdfBase64,
    result,
  };
}


/**
 * =========================================================
 * GET NIN PRICING
 * =========================================================
 */

export async function getNinServicePricing() {
  const service =
    await getNinService();

  return {
    provider:
      service.provider,

    currency:
      service.currency,

    prices:
      service.prices,

    cardTypes:
      service.cardTypes,

    pricingSource:
      service.pricingSource,
  };
}


/**
 * =========================================================
 * RECOVER NIN BY PHONE
 * =========================================================
 *
 * Public service wrapper used by nin.controller.js.
 *
 * The actual recovery logic remains inside recoverNin().
 * =========================================================
 */

export async function recoverNinByPhone({
  userId,
  phone,
  cardType,
  transactionPin,
  idempotencyKey,
}) {
  return recoverNin({
    userId,
    phone,
    cardType,
    transactionPin,
    idempotencyKey,
  });
}


/**
 * =========================================================
 * DEMOGRAPHIC NIN RECOVERY
 * =========================================================
 *
 * NetworkDataSub client currently supports phone search.
 *
 * Do NOT invent a demographic endpoint.
 * =========================================================
 */

export async function recoverNinByDemographics() {
  const error = new Error(
    "Demographic NIN recovery is not currently supported by the configured NetworkDataSub client. Please use phone-number recovery."
  );

  error.code =
    "DEMOGRAPHIC_RECOVERY_NOT_SUPPORTED";

  error.status = 501;

  throw error;
}


/**
 * =========================================================
 * CREATE IDENTITY NOTIFICATION
 * =========================================================
 */

async function createIdentityNotification({
  userId,
  title,
  message,
  type,
  metadata,
}) {
  try {
    await createNotification({
      userId,
      title,
      message,
      type,
      metadata,
    });
  } catch (error) {
    /*
     * Notification failure must never make an otherwise
     * successful financial/identity transaction fail.
     */

    console.error(
      "NIN notification error:",
      error
    );
  }
}


/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getNinService,

  getNinServicePricing,

  verifyNinByNumber,

  submitNin,

  recoverNinByPhone,

  recoverNin,

  recoverNinByDemographics,

  refundFailedNinRequest,

  getNinRequest,

  getNinRequestStatus,

  getNinHistory,

  getNinDocument,
};