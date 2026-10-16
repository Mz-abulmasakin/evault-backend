
/**
 * =========================================================
 * eVAULT NETWORKDATASUB BVN PHONE SEARCH CLIENT
 * =========================================================
 *
 * Server-side only.
 *
 * NetworkDataSub documented endpoint:
 *
 * POST /verification/bvn/phone-search
 *
 * Request:
 * {
 *   phone: "08012345678"
 * }
 *
 * IMPORTANT:
 * - No card_type is sent for BVN phone search.
 * - API token never reaches React Native.
 * - Provider price is NOT used as eVault customer price.
 * =========================================================
 */

const API_URL =
  process.env.NETWORKDATASUB_API_URL ||
  "https://www.networkdatasub.com/api";

const API_TOKEN =
  process.env.NETWORKDATASUB_API_TOKEN;

const TIMEOUT_MS = Number(
  process.env.NETWORKDATASUB_TIMEOUT_MS ||
    30000
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
 * PHONE NORMALIZATION
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
 * REQUEST
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
    `${path.startsWith("/")
      ? path
      : `/${path}`}`;

  try {
    console.log(
      "NETWORKDATASUB BVN PHONE REQUEST:",
      {
        method,
        path,
        url,
        body,
      }
    );

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

    console.log(
      "NETWORKDATASUB BVN PHONE RESPONSE:",
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
          typeof parsed.data ===
            "object"
            ? Object.keys(
                parsed.data
              )
            : [],

        success:
          parsed?.success,

        message:
          parsed?.message,

        reference:
          parsed?.data?.reference ||
          null,

        bvn:
          parsed?.data?.bvn ||
          null,

        hasImage:
          parsed?.data?.has_image ||
          false,

        detailsKeys:
          parsed?.data?.details &&
          typeof parsed.data.details ===
            "object"
            ? Object.keys(
                parsed.data.details
              )
            : [],
      }
    );

    if (!response.ok) {
      const error =
        new Error(
          parsed?.message ||
            "NetworkDataSub BVN phone search failed."
        );

      error.status =
        response.status;

      error.code =
        parsed?.errors
          ? "NETWORKDATASUB_VALIDATION_ERROR"
          : "NETWORKDATASUB_BVN_PHONE_ERROR";

      error.providerResponse =
        parsed;

      throw error;
    }

    if (
      parsed &&
      parsed.success === false
    ) {
      const error =
        new Error(
          parsed.message ||
            "NetworkDataSub BVN phone search failed."
        );

      error.status = 400;

      error.code =
        "NETWORKDATASUB_BVN_PHONE_FAILED";

      error.providerResponse =
        parsed;

      throw error;
    }

    return parsed;

  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "NetworkDataSub BVN phone search request timed out."
        );

      timeoutError.code =
        "NETWORKDATASUB_TIMEOUT";

      timeoutError.status =
        504;

      throw timeoutError;
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}


/**
 * =========================================================
 * SEARCH BVN BY PHONE
 * =========================================================
 *
 * NetworkDataSub documented request:
 *
 * POST /verification/bvn/phone-search
 *
 * {
 *   phone
 * }
 *
 * NO card_type is sent.
 * =========================================================
 */

export async function searchBvnByPhone({
  phone,
}) {
  const normalizedPhone =
    normalizePhone(phone);

  return request(
    "POST",
    "/verification/bvn/phone-search",
    {
      phone:
        normalizedPhone,
    }
  );
}


export default {
  searchBvnByPhone,
};
