import crypto from "crypto";

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";

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
} from "../transactions/transaction.repository.js";

import {
  createIdentityRequest,
  findIdentityRequestById,
  findIdentityRequestByIdempotencyKey,
  findIdentityRequestsByUserId,
  findUserIdentityRequestById,
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
  getBvnPricing,
  verifyBvnByCardType,
} from "./providers/networkdatasub/bvn.client.js";

const PROVIDER = "networkdatasub";

const IDENTITY_TYPE = "BVN";

const TRANSACTION_PAYMENT = "PAYMENT";
const TRANSACTION_REFUND = "REFUND";

const STATUS_PENDING = "PENDING";
const STATUS_PROCESSING = "PROCESSING";
const STATUS_SUCCESS = "SUCCESS";
const STATUS_FAILED = "FAILED";

const SUPPORTED_CARD_TYPES = [
  "standard",
  "premium",
];

const CUSTOMER_PRICE_ENV = {
  standard: "EVAULT_BVN_STANDARD_PRICE",
  premium: "EVAULT_BVN_PREMIUM_PRICE",
};

function normalizeBvn(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .trim();
}

function normalizeCardType(value) {
  return String(value || "standard")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_");
}

function validateBvn(bvn) {
  if (!/^\d{11}$/.test(bvn)) {
    const error = new Error(
      "BVN must contain exactly 11 digits."
    );

    error.code = "INVALID_BVN";
    error.status = 400;

    throw error;
  }
}

function validateCardType(cardType) {
  if (!SUPPORTED_CARD_TYPES.includes(cardType)) {
    const error = new Error(
      "BVN slip type must be standard or premium."
    );

    error.code = "INVALID_BVN_CARD_TYPE";
    error.status = 400;

    throw error;
  }
}

function requireCustomerPrice(cardType) {
  const envName = CUSTOMER_PRICE_ENV[cardType];

  const raw = envName
    ? process.env[envName]
    : null;

  const amount = Number(raw);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    const error = new Error(
      `Customer price is not configured for BVN ${cardType}. Set ${envName} in the backend .env file.`
    );

    error.code =
      "BVN_CUSTOMER_PRICE_NOT_CONFIGURED";

    error.status = 503;

    throw error;
  }

  return amount;
}

function createReference(prefix) {
  return (
    `${prefix}-` +
    crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 24)
      .toUpperCase()
  );
}

function createIdempotencyKey({
  userId,
  bvn,
  cardType,
}) {
  return crypto
    .createHash("sha256")
    .update(
      [
        userId,
        bvn,
        cardType,
        crypto.randomUUID(),
        Date.now(),
      ].join(":")
    )
    .digest("hex");
}

function hashIdentifier(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function maskBvn(bvn) {
  return `${bvn.slice(0, 3)}******${bvn.slice(-2)}`;
}

function extractProviderData(response) {
  return (
    response?.data ??
    response ??
    {}
  );
}

function extractPdfBase64(providerData) {
  const value =
    providerData?.pdf_base64;

  if (
    typeof value !== "string" ||
    !value
  ) {
    return null;
  }

  return value;
}

function extractProviderReference(providerData) {
  return (
    providerData?.reference ??
    providerData?.transaction_id ??
    providerData?.verification_id ??
    null
  );
}

function extractProviderAmount(providerData) {
  const amount = Number(
    providerData?.amount
  );

  return Number.isFinite(amount)
    ? amount
    : null;
}


/* =========================================================
 * eVAULT BVN PDF GENERATION
 * ========================================================= */

function normalizePdfImageBase64(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const trimmed = value.trim();

  if (
    trimmed.startsWith("data:image/")
  ) {
    const commaIndex =
      trimmed.indexOf(",");

    if (commaIndex >= 0) {
      return trimmed.slice(
        commaIndex + 1
      );
    }
  }

  return trimmed;
}

function isJpegBase64(value) {
  const normalized =
    normalizePdfImageBase64(value);

  if (!normalized) {
    return false;
  }

  try {
    const buffer = Buffer.from(
      normalized,
      "base64"
    );

    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  } catch {
    return false;
  }
}

function safePdfText(
  value,
  fallback = "Not provided"
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  return String(value)
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function drawPdfField(
  page,
  label,
  value,
  x,
  y,
  fonts
) {
  page.drawText(
    `${label}:`,
    {
      x,
      y,
      font: fonts.bold,
      size: 9,
      color: rgb(
        0.20,
        0.25,
        0.32
      ),
    }
  );

  page.drawText(
    safePdfText(value),
    {
      x: x + 105,
      y,
      font: fonts.regular,
      size: 9,
      color: rgb(
        0.12,
        0.16,
        0.22
      ),
      maxWidth: 390,
    }
  );
}

async function generateEvaultBvnPdf({
  requestId,
  transactionReference,
  providerReference,
  cardType,
  providerData,
}) {
  const pdfDoc =
    await PDFDocument.create();

  const regular =
    await pdfDoc.embedFont(
      StandardFonts.Helvetica
    );

  const bold =
    await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    );

  const page =
    pdfDoc.addPage([
      595.28,
      841.89,
    ]);

  const {
    width,
    height,
  } = page.getSize();

  const fonts = {
    regular,
    bold,
  };

  const margin = 42;

  let y = height - 52;

  page.drawText(
    "eVault",
    {
      x: margin,
      y,
      font: bold,
      size: 22,
      color: rgb(
        0.05,
        0.18,
        0.35
      ),
    }
  );

  y -= 28;

  page.drawText(
    "BVN VERIFICATION RESULT",
    {
      x: margin,
      y,
      font: bold,
      size: 15,
      color: rgb(
        0.10,
        0.12,
        0.16
      ),
    }
  );

  y -= 18;

  page.drawText(
    "eVault-generated document based on a successful BVN verification.",
    {
      x: margin,
      y,
      font: regular,
      size: 8.5,
      color: rgb(
        0.35,
        0.39,
        0.45
      ),
    }
  );

  y -= 28;

  page.drawLine({
    start: {
      x: margin,
      y,
    },
    end: {
      x: width - margin,
      y,
    },
    thickness: 1,
    color: rgb(
      0.78,
      0.81,
      0.85
    ),
  });

  y -= 25;

  const details =
    providerData?.details &&
    typeof providerData.details ===
      "object"
      ? providerData.details
      : {};

  const verificationId =
    providerData?.verification_id ??
    null;

  const metaFields = [
    [
      "Request ID",
      requestId,
    ],
    [
      "Verification ID",
      verificationId,
    ],
    [
      "Provider Reference",
      providerReference,
    ],
    [
      "Transaction Reference",
      transactionReference,
    ],
    [
      "Card Type",
      cardType,
    ],
    [
      "Status",
      "SUCCESS",
    ],
    [
      "Verification Date",
      new Date().toISOString(),
    ],
  ];

  for (
    const [label, value]
    of metaFields
  ) {
    drawPdfField(
      page,
      label,
      value,
      margin,
      y,
      fonts
    );

    y -= 18;
  }

  y -= 12;

  page.drawText(
    "IDENTITY DETAILS",
    {
      x: margin,
      y,
      font: bold,
      size: 11,
      color: rgb(
        0.10,
        0.12,
        0.16
      ),
    }
  );

  y -= 22;

  const fields = [
    [
      "First Name",
      details.firstName,
    ],
    [
      "Middle Name",
      details.middleName,
    ],
    [
      "Last Name",
      details.lastName,
    ],
    [
      "Name on Card",
      details.nameOnCard,
    ],
    [
      "Date of Birth",
      details.birthday,
    ],
    [
      "Gender",
      details.gender,
    ],
    [
      "Marital Status",
      details.maritalStatus,
    ],
    [
      "Nationality",
      details.nationality,
    ],
    [
      "State of Origin",
      details.stateOfOrigin,
    ],
    [
      "LGA of Origin",
      details.lgaOfOrigin,
    ],
    [
      "State of Residence",
      details.stateOfResidence,
    ],
    [
      "LGA of Residence",
      details.lgaOfResidence,
    ],
    [
      "Registration Date",
      details.registrationDate,
    ],
    [
      "Watch Listed",
      details.watchListed,
    ],
  ];

  for (
    const [label, value]
    of fields
  ) {
    if (y < 95) {
      break;
    }

    drawPdfField(
      page,
      label,
      value,
      margin,
      y,
      fonts
    );

    y -= 17;
  }

  /*
   * =======================================================
   * BVN PHOTO
   * =======================================================
   *
   * We use the photo already returned by the successful
   * BVN provider response stored in identity_requests.result.
   *
   * No new BVN verification is performed here.
   */

  const photoBase64 =
    details?.photo ||
    details?.image ||
    details?.photo_base64 ||
    null;

  if (
    isJpegBase64(
      photoBase64
    )
  ) {
    try {
      const imageBytes =
        Buffer.from(
          normalizePdfImageBase64(
            photoBase64
          ),
          "base64"
        );

      const image =
        await pdfDoc.embedJpg(
          imageBytes
        );

      const imageWidth = 105;

      const imageHeight =
        image.width > 0
          ? (
              image.height /
              image.width
            ) *
            imageWidth
          : 130;

      const photoX =
        width -
        margin -
        imageWidth;

      const photoY =
        height - 225;

      page.drawRectangle({
        x: photoX - 4,
        y: photoY - 4,
        width:
          imageWidth + 8,
        height:
          imageHeight + 8,
        borderWidth: 1,
        borderColor: rgb(
          0.75,
          0.78,
          0.82
        ),
      });

      page.drawImage(
        image,
        {
          x: photoX,
          y: photoY,
          width: imageWidth,
          height: imageHeight,
        }
      );

      page.drawText(
        "Verification photo",
        {
          x: photoX,
          y: photoY - 16,
          font: regular,
          size: 7.5,
          color: rgb(
            0.40,
            0.43,
            0.48
          ),
        }
      );
    } catch (
      photoError
    ) {
      console.error(
        "BVN PDF photo embedding failed:",
        photoError?.message ||
          photoError
      );
    }
  } else {
    console.log(
      "BVN PDF: no JPEG photo found in stored BVN details.",
      {
        availableDetailKeys:
          Object.keys(details || {}),
      }
    );
  }

  const footerY = 34;

  page.drawLine({
    start: {
      x: margin,
      y: footerY + 14,
    },
    end: {
      x: width - margin,
      y: footerY + 14,
    },
    thickness: 0.7,
    color: rgb(
      0.82,
      0.84,
      0.87
    ),
  });

  page.drawText(
    "This document was generated by eVault from a successful BVN verification response.",
    {
      x: margin,
      y: footerY,
      font: regular,
      size: 7.5,
      color: rgb(
        0.40,
        0.43,
        0.48
      ),
    }
  );

  const pdfBytes =
    await pdfDoc.save();

  return Buffer.from(
    pdfBytes
  ).toString("base64");
}


/* =========================================================
 * NOTIFICATION
 * ========================================================= */

async function safeNotification(
  data
) {
  try {
    console.log(
      "BVN NOTIFICATION ATTEMPT:",
      {
        userId: data?.userId,
        title: data?.title,
        type: data?.type,
        metadata: data?.metadata,
      }
    );

    const result =
      await createNotification(
        data
      );

    console.log(
      "BVN NOTIFICATION CREATED:",
      {
        userId: data?.userId,
        title: data?.title,
        result,
      }
    );

    return result;
  } catch (
    notificationError
  ) {
    console.error(
      "BVN notification error:",
      notificationError
    );

    return null;
  }
}


/* =========================================================
 * GET BVN SERVICE
 * ========================================================= */

export async function getBvnService() {
  let providerPricing = [];

  try {
    const response =
      await getBvnPricing();

    providerPricing =
      Array.isArray(
        response?.data
      )
        ? response.data
        : [];
  } catch (
    pricingError
  ) {
    console.error(
      "BVN provider pricing lookup failed:",
      pricingError.message
    );
  }

  const prices = {};

  for (
    const cardType of
    SUPPORTED_CARD_TYPES
  ) {
    const envName =
      CUSTOMER_PRICE_ENV[
        cardType
      ];

    const customerPrice =
      Number(
        process.env[envName]
      );

    prices[cardType] =
      Number.isFinite(
        customerPrice
      ) &&
      customerPrice > 0
        ? customerPrice
        : null;
  }

  return {
    success: true,
    provider: PROVIDER,
    identityType:
      IDENTITY_TYPE,
    currency: "NGN",
    cardTypes:
      SUPPORTED_CARD_TYPES,
    prices,
    pricingSource:
      "eVault environment variables",
    providerPricing,
  };
}


/* =========================================================
 * SUBMIT BVN
 * ========================================================= */

export async function submitBvn({
  userId,
  bvn,
  cardType = "standard",
  transactionPin,
  idempotencyKey = null,
  ownershipConfirmed = false,
}) {
  console.log(
    "========== BVN SUBMIT ENTERED =========="
  );

  console.log(
    "BVN submit input:",
    {
      userId,
      bvn: maskBvn(
        normalizeBvn(bvn)
      ),
      cardType,
      transactionPinProvided:
        Boolean(
          transactionPin
        ),
      ownershipConfirmed,
    }
  );

  if (!userId) {
    const error = new Error(
      "User ID is required."
    );

    error.code =
      "USER_ID_REQUIRED";

    error.status = 400;

    throw error;
  }

  const normalizedBvn =
    normalizeBvn(bvn);

  const normalizedCardType =
    normalizeCardType(
      cardType
    );

  validateBvn(
    normalizedBvn
  );

  validateCardType(
    normalizedCardType
  );

  if (!transactionPin) {
    const error = new Error(
      "Transaction PIN is required."
    );

    error.code =
      "TRANSACTION_PIN_REQUIRED";

    error.status = 400;

    throw error;
  }

  await verifyTransactionPin(
    userId,
    transactionPin
  );

  const amount =
    requireCustomerPrice(
      normalizedCardType
    );

  const finalIdempotencyKey =
    idempotencyKey ||
    createIdempotencyKey({
      userId,
      bvn: normalizedBvn,
      cardType:
        normalizedCardType,
    });

  if (idempotencyKey) {
    const existingRequest =
      await findIdentityRequestByIdempotencyKey(
        finalIdempotencyKey
      );

    if (existingRequest) {
      if (
        String(
          existingRequest.status ||
            ""
        ).toUpperCase() ===
        STATUS_SUCCESS
      ) {
        return {
          success: true,
          duplicate: true,
          requestId:
            existingRequest.id,
          status:
            existingRequest.status,
          amount:
            Number(
              existingRequest.amount
            ),
          request:
            existingRequest,
          hasPdf:
            Boolean(
              existingRequest
                .result
                ?.data
                ?.evault_pdf_base64 ||
              existingRequest
                .result
                ?.data
                ?.pdf_base64 ||
              existingRequest
                .result
                ?.evault_pdf_base64 ||
              existingRequest
                .result
                ?.pdf_base64
            ),
        };
      }
    }
  }

  const transactionReference =
    createReference(
      "EVAULT-BVNPAY"
    );

  let transaction = null;
  let identityRequest = null;

  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN"
    );

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

      error.status = 404;

      throw error;
    }

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
      const error = new Error(
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

    const debitedWallet =
      await debitWallet(
        wallet.id,
        amount,
        client
      );

    if (!debitedWallet) {
      const error = new Error(
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
            `BVN validation - ${normalizedCardType}`,

          metadata: {
            service:
              "BVN_VALIDATION",

            identityType:
              IDENTITY_TYPE,

            provider:
              PROVIDER,

            cardType:
              normalizedCardType,

            bvn:
              maskBvn(
                normalizedBvn
              ),
          },
        },
        client
      );

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
              normalizedBvn
            ),

          validationType:
            "full",

          slipType:
            normalizedCardType,

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
  } catch (
    error
  ) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    throw error;
  } finally {
    client.release();
  }

  console.log(
    "========== CALLING NETWORKDATASUB BVN =========="
  );

  console.log(
    "BVN provider payload:",
    {
      bvn: maskBvn(
        normalizedBvn
      ),
      cardType:
        normalizedCardType,
      requestId:
        identityRequest.id,
      transactionReference,
    }
  );

  let providerResponse;

  try {
    providerResponse =
      await verifyBvnByCardType(
        {
          bvn:
            normalizedBvn,

          cardType:
            normalizedCardType,
        }
      );
  } catch (
    providerError
  ) {
    console.error(
      "BVN NetworkDataSub provider error:",
      providerError
    );

    try {
      await refundFailedBvnRequest({
        userId,

        request:
          identityRequest,

        transaction,

        reason:
          providerError.message,

        providerResponse:
          providerError.providerResponse ??
          null,
      });
    } catch (
      refundError
    ) {
      console.error(
        "BVN refund after provider error failed:",
        refundError
      );
    }

    throw providerError;
  }

  console.log(
    "========== NETWORKDATASUB BVN RETURNED =========="
  );

  console.log(
    {
      success:
        providerResponse?.success,

      message:
        providerResponse?.message,

      hasData:
        Boolean(
          providerResponse?.data
        ),

      hasPdf:
        Boolean(
          providerResponse
            ?.data
            ?.pdf_base64
        ),

      pdfLength:
        typeof providerResponse
          ?.data
          ?.pdf_base64 ===
        "string"
          ? providerResponse
              .data
              .pdf_base64.length
          : 0,
    }
  );

  const providerData =
    extractProviderData(
      providerResponse
    );

  const providerReference =
    extractProviderReference(
      providerData
    );

  const providerAmount =
    extractProviderAmount(
      providerData
    );

  const providerPdfBase64 =
    extractPdfBase64(
      providerData
    );

  if (
    !providerResponse?.success
  ) {
    const error = new Error(
      providerResponse?.message ||
      "NetworkDataSub BVN validation failed."
    );

    error.code =
      "BVN_PROVIDER_FAILED";

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

  let evaultPdfBase64 =
    null;

  if (!providerPdfBase64) {
    try {
      console.log(
        "NETWORKDATASUB returned no PDF. Generating eVault BVN PDF."
      );

      evaultPdfBase64 =
        await generateEvaultBvnPdf({
          requestId:
            identityRequest.id,

          transactionReference,

          providerReference,

          cardType:
            normalizedCardType,

          providerData,
        });

      console.log(
        "eVault BVN PDF generated:",
        {
          requestId:
            identityRequest.id,

          pdfLength:
            evaultPdfBase64.length,
        }
      );
    } catch (
      pdfError
    ) {
      console.error(
        "eVault BVN PDF generation failed:",
        pdfError
      );
    }
  }

  const storedResult =
    providerPdfBase64 ||
    evaultPdfBase64
      ? {
          ...providerResponse,

          data: {
            ...(providerResponse?.data ||
              {}),

            evault_pdf_base64:
              evaultPdfBase64,

            evault_pdf_generated:
              Boolean(
                evaultPdfBase64
              ),

            evault_pdf_source:
              evaultPdfBase64
                ? "eVault"
                : null,
          },
        }
      : providerResponse;

  await updateIdentityRequestResult(
    identityRequest.id,
    storedResult,
    null,
    null
  );

  if (providerReference) {
    await updateProviderReference(
      identityRequest.id,
      String(
        providerReference
      )
    );
  }

  const finalDocumentPdfBase64 =
    providerPdfBase64 ||
    evaultPdfBase64 ||
    null;

  await db.query(
    `
      UPDATE identity_requests
      SET
        status = $2,
        error_code = NULL,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [
      identityRequest.id,
      STATUS_SUCCESS,
    ]
  );

  await updateTransactionStatus(
    transaction.id,
    STATUS_SUCCESS
  );

  try {
    await upsertIdentityVerification(
      {
        userId,

        bvn:
          normalizedBvn,

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
    identityStateError
  ) {
    console.error(
      "BVN persistent identity update failed:",
      identityStateError
    );
  }

  await safeNotification({
    userId,

    title:
      "BVN Validation Successful",

    message:
      finalDocumentPdfBase64
        ? "Your BVN has been successfully validated and your BVN slip is ready to download."
        : "Your BVN has been successfully validated.",

    type:
      "IDENTITY",

    metadata: {
      identityType:
        IDENTITY_TYPE,

      requestId:
        identityRequest.id,

      transactionReference,

      providerReference,

      downloadAvailable:
        Boolean(
          finalDocumentPdfBase64
        ),
    },
  });

  return {
    success: true,

    status:
      STATUS_SUCCESS,

    requestId:
      identityRequest.id,

    transactionReference,

    providerReference,

    amount,

    currency:
      "NGN",

    cardType:
      normalizedCardType,

    bvn:
      maskBvn(
        normalizedBvn
      ),

    hasPdf:
      Boolean(
        finalDocumentPdfBase64
      ),

    documentUrl:
      null,

    result:
      providerResponse,

    providerAmount,
  };
}


/* =========================================================
 * GET BVN REQUEST STATUS
 * ========================================================= */

export async function getBvnRequest(
  requestId,
  userId
) {
  const request =
    await findUserIdentityRequestById(
      requestId,
      userId
    );

  if (
    !request ||
    request.identity_type !==
      IDENTITY_TYPE
  ) {
    const error = new Error(
      "BVN validation request not found."
    );

    error.code =
      "BVN_REQUEST_NOT_FOUND";

    error.status = 404;

    throw error;
  }

  return {
    ...request,

    hasPdf:
      Boolean(
        request.result
          ?.data
          ?.evault_pdf_base64 ||

        request.result
          ?.data
          ?.pdf_base64 ||

        request.result
          ?.evault_pdf_base64 ||

        request.result
          ?.pdf_base64
      ),
  };
}


/* =========================================================
 * BVN HISTORY
 * ========================================================= */

export async function getBvnHistory(
  userId
) {
  const rows =
    await findIdentityRequestsByUserId(
      userId
    );

  return rows.filter(
    (row) =>
      row.identity_type ===
      IDENTITY_TYPE
  );
}


/* =========================================================
 * GET BVN DOCUMENT
 *
 * IMPORTANT:
 *
 * This function is used by the notification download.
 *
 * It NEVER:
 * - calls NetworkDataSub
 * - charges the wallet
 * - creates a transaction
 * - performs another BVN verification
 *
 * It first uses an existing stored PDF.
 *
 * If an older successful BVN request does not have a stored
 * PDF, it generates an eVault PDF directly from the BVN
 * response already stored in identity_requests.result.
 * ========================================================= */

export async function getBvnDocument(
  requestId,
  userId
) {
  const request =
    await findUserIdentityRequestById(
      requestId,
      userId
    );

  if (
    !request ||
    request.identity_type !==
      IDENTITY_TYPE
  ) {
    const error = new Error(
      "BVN validation request not found."
    );

    error.code =
      "BVN_REQUEST_NOT_FOUND";

    error.status = 404;

    throw error;
  }

  if (
    String(
      request.status || ""
    ).toUpperCase() !==
    STATUS_SUCCESS
  ) {
    const error = new Error(
      "BVN slip is not available until validation succeeds."
    );

    error.code =
      "BVN_DOCUMENT_NOT_AVAILABLE";

    error.status = 409;

    throw error;
  }

  const result =
    request.result || {};

  /*
   * identity_requests.result can contain either:
   *
   * {
   *   data: {
   *     details: {...}
   *   }
   * }
   *
   * or the provider response directly.
   */
  const providerData =
    result?.data &&
    typeof result.data ===
      "object"
      ? result.data
      : result;

  /*
   * ---------------------------------------------------------
   * 1. USE AN ALREADY STORED PDF IF ONE EXISTS
   * ---------------------------------------------------------
   */

  let pdfBase64 =
    providerData?.evault_pdf_base64 ||
    providerData?.pdf_base64 ||
    result?.evault_pdf_base64 ||
    result?.pdf_base64 ||
    null;

  let source = null;

  if (
    providerData?.evault_pdf_base64 ||
    result?.evault_pdf_base64
  ) {
    source = "eVault";
  } else if (
    providerData?.pdf_base64 ||
    result?.pdf_base64
  ) {
    source = "NetworkDataSub";
  }

  /*
   * ---------------------------------------------------------
   * 2. NO PDF STORED
   *
   * Generate one from the successful BVN data already
   * stored in the database.
   *
   * NO PROVIDER CALL.
   * NO WALLET DEBIT.
   * NO NEW TRANSACTION.
   * ---------------------------------------------------------
   */

  if (!pdfBase64) {
    console.log(
      "================================================="
    );

    console.log(
      "BVN NOTIFICATION DOWNLOAD: STORED PDF NOT FOUND"
    );

    console.log(
      "Generating eVault PDF from stored BVN result..."
    );

    console.log(
      {
        requestId:
          request.id,

        userId,

        status:
          request.status,

        hasResult:
          Boolean(
            request.result
          ),

        resultKeys:
          result &&
          typeof result ===
            "object"
            ? Object.keys(
                result
              )
            : [],

        providerDataKeys:
          providerData &&
          typeof providerData ===
            "object"
            ? Object.keys(
                providerData
              )
            : [],

        detailKeys:
          providerData?.details &&
          typeof providerData.details ===
            "object"
            ? Object.keys(
                providerData.details
              )
            : [],
      }
    );

    console.log(
      "================================================="
    );

    /*
     * The original transaction reference is already stored
     * with the identity request.
     */
    const transactionReference =
      request.transaction_reference ||
      providerData?.transaction_reference ||
      result?.transaction_reference ||
      null;

    /*
     * Provider reference is already stored on the identity
     * request in normal successful BVN records.
     *
     * The fallbacks below also support older records where
     * the reference exists only inside result.data.
     */
    const providerReference =
      request.provider_reference ||
      providerData?.reference ||
      providerData?.transaction_id ||
      providerData?.verification_id ||
      result?.reference ||
      result?.transaction_id ||
      result?.verification_id ||
      null;

    /*
     * slip_type is the existing identity request column.
     */
    const cardType =
      request.slip_type ||
      providerData?.card_type ||
      providerData?.cardType ||
      "standard";

    /*
     * Make sure we actually have stored BVN information
     * before attempting PDF generation.
     */
    const hasStoredDetails =
      providerData?.details &&
      typeof providerData.details ===
        "object" &&
      Object.keys(
        providerData.details
      ).length > 0;

    if (!hasStoredDetails) {
      console.error(
        "BVN notification download: stored BVN details are missing.",
        {
          requestId:
            request.id,

          providerDataKeys:
            providerData &&
            typeof providerData ===
              "object"
              ? Object.keys(
                  providerData
                )
              : [],
        }
      );

      const error = new Error(
        "The stored BVN verification details are not available for document generation."
      );

      error.code =
        "BVN_DATA_NOT_AVAILABLE";

      error.status = 404;

      throw error;
    }

    try {
      pdfBase64 =
        await generateEvaultBvnPdf({
          requestId:
            request.id,

          transactionReference,

          providerReference,

          cardType,

          providerData,
        });

      source = "eVault";

      console.log(
        "================================================="
      );

      console.log(
        "BVN NOTIFICATION PDF GENERATED SUCCESSFULLY"
      );

      console.log(
        {
          requestId:
            request.id,

          source,

          pdfLength:
            typeof pdfBase64 ===
            "string"
              ? pdfBase64.length
              : 0,
        }
      );

      console.log(
        "================================================="
      );
    } catch (
      pdfError
    ) {
      console.error(
        "================================================="
      );

      console.error(
        "BVN NOTIFICATION PDF GENERATION FAILED"
      );

      console.error(
        {
          requestId:
            request.id,

          error:
            pdfError?.message ||
            pdfError,

          stack:
            pdfError?.stack,
        }
      );

      console.error(
        "================================================="
      );

      const error = new Error(
        "Unable to generate the BVN slip from the stored verification details."
      );

      error.code =
        "BVN_PDF_GENERATION_FAILED";

      error.status = 500;

      throw error;
    }
  }

  /*
   * ---------------------------------------------------------
   * 3. FINAL PDF VALIDATION
   * ---------------------------------------------------------
   */

  if (
    typeof pdfBase64 !==
      "string" ||
    !pdfBase64.trim()
  ) {
    const error = new Error(
      "BVN slip could not be generated from the stored verification details."
    );

    error.code =
      "BVN_PDF_GENERATION_FAILED";

    error.status = 500;

    throw error;
  }

  /*
   * ---------------------------------------------------------
   * 4. SAVE GENERATED eVAULT PDF BACK INTO DATABASE
   *
   * This means the next notification download will use the
   * stored PDF directly and will not have to regenerate it.
   *
   * If saving fails, we DO NOT fail the download because we
   * already have a valid PDF to return to the customer.
   * ---------------------------------------------------------
   */

  if (source === "eVault") {
    try {
      const existingData =
        result?.data &&
        typeof result.data ===
          "object"
          ? result.data
          : {};

      const updatedResult = {
        ...result,

        data: {
          ...existingData,

          evault_pdf_base64:
            pdfBase64,

          evault_pdf_generated:
            true,

          evault_pdf_source:
            "eVault",
        },
      };

      await updateIdentityRequestResult(
        request.id,
        updatedResult,
        null,
        null
      );

      console.log(
        "BVN generated PDF saved back to identity request:",
        {
          requestId:
            request.id,

          pdfLength:
            pdfBase64.length,
        }
      );
    } catch (
      saveError
    ) {
      /*
       * Do not block the current download.
       *
       * The PDF has already been generated successfully.
       */
      console.error(
        "BVN generated PDF could not be persisted:",
        {
          requestId:
            request.id,

          error:
            saveError?.message ||
            saveError,
        }
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * 5. RETURN PDF TO THE EXISTING NOTIFICATION CONTROLLER
   * ---------------------------------------------------------
   */

  return {
    requestId:
      request.id,

    status:
      request.status,

    fileName:
      `evault-bvn-${request.id}.pdf`,

    mimeType:
      "application/pdf",

    pdfBase64,

    source,
  };
}


/* =========================================================
 * REFUND FAILED BVN REQUEST
 * ========================================================= */

export async function refundFailedBvnRequest({
  userId,
  request,
  transaction,
  reason,
  providerResponse = null,
}) {
  if (
    !request ||
    !transaction
  ) {
    throw new Error(
      "BVN refund requires both request and transaction."
    );
  }

  const refundClient =
    await db.connect();

  try {
    await refundClient.query(
      "BEGIN"
    );

    const currentRequest =
      await findIdentityRequestById(
        request.id,
        refundClient
      );

    if (
      currentRequest?.status ===
      STATUS_SUCCESS
    ) {
      await refundClient.query(
        "ROLLBACK"
      );

      return {
        refunded: false,
        alreadySuccessful: true,
      };
    }

    const wallet =
      await findWalletForUpdate(
        transaction.wallet_id ||
          transaction.walletId,
        refundClient
      );

    if (!wallet) {
      throw new Error(
        "Wallet not found during BVN refund."
      );
    }

    const refundAmount =
      Number(
        transaction.amount
      );

    if (
      !Number.isFinite(
        refundAmount
      ) ||
      refundAmount <= 0
    ) {
      throw new Error(
        "Invalid BVN refund amount."
      );
    }

    const balanceBefore =
      Number(
        wallet.available_balance
      );

    const refundedWallet =
      await creditWallet(
        wallet.id,
        refundAmount,
        refundClient
      );

    if (!refundedWallet) {
      throw new Error(
        "Unable to refund BVN wallet."
      );
    }

    const balanceAfter =
      Number(
        refundedWallet.available_balance
      );

    const refundReference =
      createReference(
        "EVAULT-BVNREFUND"
      );

    await createTransaction(
      {
        walletId:
          wallet.id,

        reference:
          refundReference,

        type:
          TRANSACTION_REFUND,

        amount:
          refundAmount,

        balanceBefore,

        balanceAfter,

        status:
          STATUS_SUCCESS,

        description:
          "Refund for failed BVN validation",

        metadata: {
          service:
            "BVN_VALIDATION",

          identityType:
            IDENTITY_TYPE,

          provider:
            PROVIDER,

          originalTransactionReference:
            transaction.reference,

          identityRequestId:
            request.id,

          reason,
        },
      },
      refundClient
    );

    await refundClient.query(
      `
        UPDATE transactions
        SET
          status = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [
        transaction.id,
        STATUS_FAILED,
      ]
    );

    await updateIdentityRequestResult(
      request.id,
      providerResponse,
      null,
      null,
      refundClient
    );

    await refundClient.query(
      `
        UPDATE identity_requests
        SET
          status = $2,
          error_code = $3,
          error_message = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [
        request.id,

        STATUS_FAILED,

        "BVN_PROVIDER_FAILED",

        String(
          reason ||
          "BVN validation failed."
        ).slice(
          0,
          1000
        ),
      ]
    );

    await refundClient.query(
      "COMMIT"
    );

    await safeNotification({
      userId,

      title:
        "BVN Validation Failed",

      message:
        "BVN validation failed. Your eVault wallet has been refunded.",

      type:
        "IDENTITY",

      metadata: {
        identityType:
          IDENTITY_TYPE,

        requestId:
          request.id,

        refundReference,

        refundAmount,
      },
    });

    return {
      refunded: true,

      refundReference,

      refundAmount,
    };
  } catch (
    error
  ) {
    try {
      await refundClient.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "CRITICAL BVN REFUND ERROR:",
      {
        requestId:
          request?.id,

        transactionReference:
          transaction?.reference,

        error:
          error.message,
      }
    );

    throw error;
  } finally {
    refundClient.release();
  }
}

export default {
  getBvnService,
  submitBvn,
  getBvnRequest,
  getBvnHistory,
  getBvnDocument,
  refundFailedBvnRequest,
};