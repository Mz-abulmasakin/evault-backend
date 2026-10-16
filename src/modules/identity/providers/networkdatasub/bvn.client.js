/**
 * =========================================================
 * eVAULT NETWORKDATASUB BVN CLIENT
 * =========================================================
 *
 * Server-side only.
 *
 * NetworkDataSub contract used here:
 *
 * POST /verification/bvn
 * GET  /verification/bvn/pricing
 *
 * IMPORTANT:
 * - The NetworkDataSub API token NEVER reaches React Native.
 * - BVN values are masked in logs.
 * - Request payload is logged in sanitized form.
 * - Provider response details are logged only in sanitized form.
 * =========================================================
 */

const API_URL =
  process.env.NETWORKDATASUB_API_URL ||
  "https://www.networkdatasub.com/api";

const API_TOKEN =
  process.env.NETWORKDATASUB_API_TOKEN;

const TIMEOUT_MS = Number(
  process.env.NETWORKDATASUB_TIMEOUT_MS || 30000
);

/**
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

function assertConfigured() {
  if (!API_TOKEN) {
    const error = new Error(
      "NETWORKDATASUB_API_TOKEN is not configured."
    );

    error.code =
      "NETWORKDATASUB_TOKEN_MISSING";

    error.status = 500;

    throw error;
  }
}

/**
 * =========================================================
 * MASK BVN
 * =========================================================
 */

function maskBvn(value) {
  if (
    typeof value !== "string" ||
    value.length !== 11
  ) {
    return value;
  }

  return (
    `${value.slice(0, 3)}` +
    "******" +
    `${value.slice(-2)}`
  );
}

/**
 * =========================================================
 * SANITIZE REQUEST BODY
 * =========================================================
 */

function getSafeRequestBody(body) {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return body;
  }

  return {
    ...body,

    bvn:
      typeof body.bvn === "string"
        ? maskBvn(body.bvn)
        : body.bvn,
  };
}

/**
 * =========================================================
 * SANITIZE PROVIDER DETAILS FOR LOGGING
 * =========================================================
 *
 * We do NOT print the customer's complete identity data.
 *
 * This only shows the structure and useful non-sensitive
 * diagnostic fields.
 * =========================================================
 */

function getSafeProviderDetails(details) {
  if (
    !details ||
    typeof details !== "object"
  ) {
    return details;
  }

  const safe = {
    keys: Object.keys(details),
  };

  /**
   * Keep only useful diagnostic fields if present.
   */
  const allowedFields = [
    "bvn",
    "has_pdf",
    "pdf_base64",
    "reference",
    "verification_id",
    "provider",
    "amount",
    "status",
    "message",
  ];

  for (const field of allowedFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        details,
        field
      )
    ) {
      if (field === "bvn") {
        safe[field] =
          maskBvn(details[field]);
      } else if (
        field === "pdf_base64"
      ) {
        safe[field] =
          typeof details[field] ===
          "string"
            ? `[BASE64 LENGTH: ${details[field].length}]`
            : details[field];
      } else {
        safe[field] =
          details[field];
      }
    }
  }

  return safe;
}

/**
 * =========================================================
 * NETWORKDATASUB REQUEST
 * =========================================================
 */

async function request(
  method,
  path,
  body = undefined
) {
  assertConfigured();

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  const url =
    `${API_URL.replace(/\/+$/, "")}` +
    `${path.startsWith("/") ? path : `/${path}`}`;

  try {
    /**
     * -------------------------------------------------------
     * REQUEST LOG
     * -------------------------------------------------------
     */

    console.log(
      "NETWORKDATASUB BVN REQUEST:",
      {
        method,
        path,
        url,
        body:
          getSafeRequestBody(body),
      }
    );

    /**
     * -------------------------------------------------------
     * HTTP REQUEST
     * -------------------------------------------------------
     */

    const response =
      await fetch(
        url,
        {
          method,

          headers: {
            Authorization:
              `Token ${API_TOKEN}`,

            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            body === undefined
              ? undefined
              : JSON.stringify(body),

          signal:
            controller.signal,
        }
      );

    /**
     * -------------------------------------------------------
     * RESPONSE BODY
     * -------------------------------------------------------
     */

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    const raw =
      await response.text();

    let parsed;

    try {
      parsed = raw
        ? JSON.parse(raw)
        : null;
    } catch {
      parsed = {
        success: false,

        message:
          raw ||
          "NetworkDataSub returned a non-JSON response.",
      };
    }

    /**
     * -------------------------------------------------------
     * EXTRACT DETAILS
     * -------------------------------------------------------
     */

    const providerDetails =
      parsed?.data?.details;

    /**
     * -------------------------------------------------------
     * RESPONSE LOG
     * -------------------------------------------------------
     */

    console.log(
      "NETWORKDATASUB BVN RESPONSE:",
      {
        method,

        path,

        status:
          response.status,

        ok:
          response.ok,

        contentType,

        topLevelKeys:
          parsed &&
          typeof parsed === "object"
            ? Object.keys(parsed)
            : [],

        dataKeys:
          parsed?.data &&
          typeof parsed.data === "object"
            ? Object.keys(
                parsed.data
              )
            : [],

        success:
          parsed?.success,

        message:
          parsed?.message,

        providerReference:
          parsed?.data?.reference ||
          null,

        providerAmount:
          parsed?.data?.amount ||
          null,

        providerName:
          parsed?.data?.provider ||
          null,

        verificationId:
          parsed?.data?.verification_id ||
          null,

        /**
         * -----------------------------------------------
         * DETAILS DIAGNOSTICS
         * -----------------------------------------------
         */

        detailsKeys:
          providerDetails &&
          typeof providerDetails === "object"
            ? Object.keys(
                providerDetails
              )
            : [],

        details:
          getSafeProviderDetails(
            providerDetails
          ),

        /**
         * -----------------------------------------------
         * PDF DIAGNOSTICS
         * -----------------------------------------------
         */

        hasPdf:
          Boolean(
            parsed?.data?.pdf_base64
          ) ||
          parsed?.data?.has_pdf === true,

        providerHasPdfFlag:
          parsed?.data?.has_pdf,

        dataPdfBase64Length:
          typeof parsed?.data
            ?.pdf_base64 === "string"
            ? parsed.data
                .pdf_base64.length
            : 0,
      }
    );

    /**
     * -------------------------------------------------------
     * HTTP ERROR
     * -------------------------------------------------------
     */

    if (!response.ok) {
      const error =
        new Error(
          parsed?.message ||
          "NetworkDataSub BVN request failed."
        );

      error.status =
        response.status;

      error.code =
        parsed?.errors
          ? "NETWORKDATASUB_VALIDATION_ERROR"
          : "NETWORKDATASUB_ERROR";

      error.providerResponse =
        parsed;

      throw error;
    }

    /**
     * -------------------------------------------------------
     * PROVIDER BUSINESS ERROR
     * -------------------------------------------------------
     */

    if (
      parsed &&
      parsed.success === false
    ) {
      const error =
        new Error(
          parsed.message ||
          "NetworkDataSub BVN service failed."
        );

      error.status = 400;

      error.code =
        "NETWORKDATASUB_BVN_FAILED";

      error.providerResponse =
        parsed;

      throw error;
    }

    /**
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    return parsed;
  } catch (error) {
    /**
     * -------------------------------------------------------
     * TIMEOUT
     * -------------------------------------------------------
     */

    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "NetworkDataSub BVN request timed out."
        );

      timeoutError.code =
        "NETWORKDATASUB_TIMEOUT";

      timeoutError.status = 504;

      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * =========================================================
 * GET BVN PRICING
 * =========================================================
 */

export async function getBvnPricing() {
  return request(
    "GET",
    "/verification/bvn/pricing"
  );
}

/**
 * =========================================================
 * VERIFY BVN
 * =========================================================
 *
 * NetworkDataSub expects:
 *
 * {
 *   bvn: "11-digit BVN",
 *   card_type: "standard" | "premium"
 * }
 * =========================================================
 */

export async function verifyBvnByCardType({
  bvn,
  cardType,
}) {
  const payload = {
    bvn,

    card_type:
      cardType,
  };

  return request(
    "POST",
    "/verification/bvn",
    payload
  );
}

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getBvnPricing,
  verifyBvnByCardType,
};