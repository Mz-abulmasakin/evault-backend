/**
 * =========================================================
 * NETWORKDATASUB API CLIENT
 * =========================================================
 *
 * Server-side only.
 *
 * IMPORTANT:
 * NETWORKDATASUB_API_TOKEN must NEVER be exposed to
 * the React Native / Expo application.
 * =========================================================
 */

const API_URL = (
  process.env.NETWORKDATASUB_API_URL ||
  "https://www.networkdatasub.com/api"
).replace(/\/+$/, "");

const API_TOKEN =
  process.env.NETWORKDATASUB_API_TOKEN;

const TIMEOUT_MS = Number(
  process.env.NETWORKDATASUB_TIMEOUT_MS ||
    30000
);

if (!API_TOKEN) {
  console.warn(
    "WARNING: NETWORKDATASUB_API_TOKEN is not configured."
  );
}


/**
 * =========================================================
 * PDF HELPERS
 * =========================================================
 */

function stripDataUri(value) {
  if (typeof value !== "string") {
    return null;
  }

  let clean = value.trim();

  if (!clean) {
    return null;
  }

  if (clean.startsWith("data:")) {
    const commaIndex =
      clean.indexOf(",");

    if (commaIndex === -1) {
      return null;
    }

    clean =
      clean.slice(
        commaIndex + 1
      );
  }

  clean =
    clean.replace(
      /\s+/g,
      ""
    );

  return clean || null;
}


/**
 * ---------------------------------------------------------
 * Extract a PDF from Base64.
 *
 * Accepts:
 *
 * 1. Pure PDF Base64
 * 2. Data URI PDF
 * 3. Base64 content containing PDF bytes
 *
 * We do NOT require %%EOF to be present.
 * The PDF may still be valid even when the returned byte
 * sequence does not contain the EOF marker in the exact
 * place expected by the older extractor.
 * ---------------------------------------------------------
 */
function extractPdfFromBase64(
  value
) {
  const clean =
    stripDataUri(
      value
    );

  if (!clean) {
    return null;
  }

  try {
    const sourceBuffer =
      Buffer.from(
        clean,
        "base64"
      );

    if (
      sourceBuffer.length < 5
    ) {
      return null;
    }

    const pdfHeader =
      Buffer.from(
        "%PDF-",
        "ascii"
      );

    const eofMarker =
      Buffer.from(
        "%%EOF",
        "ascii"
      );

    const pdfStart =
      sourceBuffer.indexOf(
        pdfHeader
      );

    if (
      pdfStart === -1
    ) {
      return null;
    }

    const eofPosition =
      sourceBuffer.lastIndexOf(
        eofMarker
      );

    let pdfBuffer;

    if (
      eofPosition !== -1 &&
      eofPosition >= pdfStart
    ) {
      pdfBuffer =
        sourceBuffer.subarray(
          pdfStart,
          eofPosition +
            eofMarker.length
        );
    } else {
      /*
       * If %%EOF is not present, keep everything from
       * the PDF header to the end of the decoded value.
       */
      pdfBuffer =
        sourceBuffer.subarray(
          pdfStart
        );
    }

    if (
      pdfBuffer.length < 10
    ) {
      return null;
    }

    if (
      pdfBuffer
        .subarray(
          0,
          5
        )
        .toString(
          "ascii"
        ) !== "%PDF-"
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


/**
 * =========================================================
 * FIND PDF ANYWHERE IN PROVIDER RESPONSE
 * =========================================================
 */

function getProviderPdfBase64(
  response
) {
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

  const visited =
    new Set();

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

    /*
     * -------------------------------------------------------
     * STRING
     * -------------------------------------------------------
     */
    if (
      typeof value === "string"
    ) {
      const direct =
        extractPdfFromBase64(
          value
        );

      if (direct) {
        return direct;
      }

      const normalizedKey =
        String(
          keyName || ""
        ).toLowerCase();

      const looksLikeDocument =
        normalizedKey.includes("pdf") ||
        normalizedKey.includes("slip") ||
        normalizedKey.includes("document") ||
        normalizedKey.includes("photo") ||
        normalizedKey.includes("image") ||
        normalizedKey.includes("base64");

      if (
        looksLikeDocument
      ) {
        return extractPdfFromBase64(
          value
        );
      }

      return null;
    }

    /*
     * -------------------------------------------------------
     * NON-OBJECT
     * -------------------------------------------------------
     */
    if (
      typeof value !== "object"
    ) {
      return null;
    }

    /*
     * -------------------------------------------------------
     * CIRCULAR REFERENCE PROTECTION
     * -------------------------------------------------------
     */
    if (
      visited.has(value)
    ) {
      return null;
    }

    visited.add(value);

    /*
     * -------------------------------------------------------
     * ARRAY
     * -------------------------------------------------------
     */
    if (
      Array.isArray(value)
    ) {
      for (
        const item
        of value
      ) {
        const found =
          walk(
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

    /*
     * -------------------------------------------------------
     * PRIORITIZE DOCUMENT FIELDS
     * -------------------------------------------------------
     */
    for (
      const key
      of preferredKeys
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          value,
          key
        )
      ) {
        const found =
          walk(
            value[key],
            key,
            depth + 1
          );

        if (found) {
          return found;
        }
      }
    }

    /*
     * -------------------------------------------------------
     * SEARCH EVERYTHING ELSE
     * -------------------------------------------------------
     */
    for (
      const [
        key,
        child
      ]
      of Object.entries(
        value
      )
    ) {
      if (
        preferredKeys.includes(
          key
        )
      ) {
        continue;
      }

      const found =
        walk(
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

  return walk(
    response
  );
}


/**
 * =========================================================
 * NORMALIZE NIN VERIFICATION RESPONSE
 * =========================================================
 *
 * NetworkDataSub documents:
 *
 * data.pdf_base64
 * data.has_pdf
 *
 * We preserve the complete response while normalizing the
 * PDF fields so nin.service.js gets a consistent result.
 * =========================================================
 */

function normalizeNinVerificationResponse(
  response
) {
  if (
    !response ||
    typeof response !== "object"
  ) {
    return response;
  }

  const data =
    response.data &&
    typeof response.data === "object" &&
    !Array.isArray(
      response.data
    )
      ? response.data
      : null;

  const extractedPdf =
    getProviderPdfBase64(
      response
    );

  /*
   * -------------------------------------------------------
   * Response without data object
   * -------------------------------------------------------
   */
  if (!data) {
    if (!extractedPdf) {
      return response;
    }

    return {
      ...response,
      pdf_base64:
        extractedPdf,
      has_pdf:
        true,
    };
  }

  /*
   * -------------------------------------------------------
   * Existing provider PDF
   * -------------------------------------------------------
   */
  const existingPdf =
    data.pdf_base64 ||
    data.pdfBase64 ||
    null;

  const finalPdf =
    extractedPdf ||
    existingPdf ||
    null;

  return {
    ...response,

    data: {
      ...data,

      pdf_base64:
        finalPdf,

      has_pdf:
        Boolean(
          finalPdf
        ),
    },
  };
}


/**
 * =========================================================
 * RESPONSE DEBUG SUMMARY
 * =========================================================
 */

function getResponseSummary(
  response
) {
  const data =
    response?.data &&
    typeof response.data === "object"
      ? response.data
      : null;

  return {
    topLevelKeys:
      response &&
      typeof response === "object"
        ? Object.keys(response)
        : [],

    dataKeys:
      data
        ? Object.keys(data)
        : [],

    success:
      response?.success ?? null,

    message:
      response?.message ?? null,

    dataHasPdf:
      data?.has_pdf ?? null,

    dataPdfBase64Length:
      typeof data?.pdf_base64 === "string"
        ? data.pdf_base64.length
        : 0,
  };
}


/**
 * =========================================================
 * GENERIC HTTP REQUEST
 * =========================================================
 */

async function request(
  method,
  path,
  body = null
) {
  if (!API_TOKEN) {
    const error =
      new Error(
        "NETWORKDATASUB_API_TOKEN is not configured."
      );

    error.code =
      "NETWORKDATASUB_TOKEN_MISSING";

    throw error;
  }

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => {
        controller.abort();
      },
      TIMEOUT_MS
    );

  const url =
    `${API_URL}${path}`;

  try {
    console.log(
      "NETWORKDATASUB REQUEST:",
      {
        method,
        path,
        url,
      }
    );

    const headers = {
      Authorization:
        `Token ${String(
          API_TOKEN
        ).trim()}`,

      Accept:
        "application/json",

      "Content-Type":
        "application/json",

      "User-Agent":
        "eVault/1.0",
    };

    const response =
      await fetch(
        url,
        {
          method,
          headers,

          body:
            body !== null
              ? JSON.stringify(
                  body
                )
              : undefined,

          signal:
            controller.signal,

          redirect:
            "follow",
        }
      );

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    let responseBody;

    try {
      responseBody =
        await response.json();
    } catch {
      responseBody = {
        success: false,
        message:
          "NetworkDataSub returned an invalid JSON response.",
      };
    }

    console.log(
      "NETWORKDATASUB RESPONSE:",
      {
        method,
        path,
        status:
          response.status,
        ok:
          response.ok,
        contentType,
        summary:
          getResponseSummary(
            responseBody
          ),
      }
    );

    /*
     * -------------------------------------------------------
     * IMPORTANT:
     * Show the COMPLETE provider error body for failed
     * requests so Premium 400 can be diagnosed from the
     * provider's actual response rather than guessed.
     * -------------------------------------------------------
     */
    if (!response.ok) {
      console.error(
        "NETWORKDATASUB ERROR BODY:",
        JSON.stringify(
          responseBody,
          null,
          2
        )
      );

      const error =
        new Error(
          responseBody?.message ||
          responseBody?.error ||
          responseBody?.detail ||
          `NetworkDataSub request failed with status ${response.status}`
        );

      error.status =
        response.status;

      error.statusCode =
        response.status;

      error.providerResponse =
        responseBody;

      error.path =
        path;

      error.method =
        method;

      throw error;
    }

    return responseBody;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      const timeoutError =
        new Error(
          "NetworkDataSub request timed out."
        );

      timeoutError.code =
        "NETWORKDATASUB_TIMEOUT";

      timeoutError.path =
        path;

      timeoutError.method =
        method;

      throw timeoutError;
    }

    if (
      error?.code ===
        "ENOTFOUND" ||
      error?.code ===
        "ECONNRESET" ||
      error?.code ===
        "ECONNREFUSED"
    ) {
      const networkError =
        new Error(
          `Unable to connect to NetworkDataSub: ${error.message}`
        );

      networkError.code =
        "NETWORKDATASUB_NETWORK_ERROR";

      networkError.path =
        path;

      networkError.method =
        method;

      networkError.cause =
        error;

      throw networkError;
    }

    throw error;
  } finally {
    clearTimeout(
      timeout
    );
  }
}


/**
 * =========================================================
 * GET NIN PRICING
 * =========================================================
 */

export async function getNinPricing() {
  return request(
    "GET",
    "/verification/nin/pricing"
  );
}


/**
 * =========================================================
 * VERIFY NIN - GENERIC DOCUMENTED ENDPOINT
 * =========================================================
 *
 * NetworkDataSub documents:
 *
 * POST /verification/nin
 *
 * {
 *   nin,
 *   card_type
 * }
 *
 * The response contains the verification details and
 * PDF Base64 in data.pdf_base64.
 * =========================================================
 */

export async function verifyNin({
  nin,
  cardType,
}) {
  const response =
    await request(
      "POST",
      "/verification/nin",
      {
        nin,
        card_type:
          cardType,
      }
    );

  return normalizeNinVerificationResponse(
    response
  );
}


/**
 * =========================================================
 * VERIFY NIN - CARD TYPE ENTRY POINT
 * =========================================================
 *
 * We keep this function name so the rest of eVault does not
 * need to change.
 *
 * The actual provider call now uses the documented generic
 * endpoint because the live card-specific endpoint was
 * returning 200 without the documented PDF payload.
 * =========================================================
 */

export async function verifyNinByCardType({
  nin,
  cardType,
}) {
  const normalizedCardType =
    String(
      cardType || ""
    )
      .trim()
      .toLowerCase();

  const supportedTypes = [
    "standard",
    "regular",
    "premium",
    "vnin_slip",
  ];

  if (
    !supportedTypes.includes(
      normalizedCardType
    )
  ) {
    const error =
      new Error(
        `Unsupported NIN card type: ${cardType}`
      );

    error.code =
      "UNSUPPORTED_CARD_TYPE";

    throw error;
  }

  const response =
    await verifyNin({
      nin,
      cardType:
        normalizedCardType,
    });

  const normalized =
    normalizeNinVerificationResponse(
      response
    );

  const pdfCandidate =
    normalized?.data?.pdf_base64 ||
    normalized?.pdf_base64 ||
    null;

  console.log(
    "NETWORKDATASUB NIN VERIFICATION RESULT:",
    {
      cardType:
        normalizedCardType,

      success:
        normalized?.success ?? null,

      message:
        normalized?.message ?? null,

      providerHasPdf:
        normalized?.data?.has_pdf ??
        normalized?.has_pdf ??
        false,

      pdfLength:
        typeof pdfCandidate === "string"
          ? pdfCandidate.length
          : 0,
    }
  );

  return normalized;
}


/**
 * =========================================================
 * SEARCH NIN BY PHONE
 * =========================================================
 */

export async function searchNinByPhone({
  phone,
  cardType,
}) {
  const response =
    await request(
      "POST",
      "/verification/nin/phone-search",
      {
        phone,
        card_type:
          cardType,
      }
    );

  return normalizeNinVerificationResponse(
    response
  );
}


/**
 * =========================================================
 * GENERATE NIN SLIP
 * =========================================================
 *
 * This remains a separate NetworkDataSub operation.
 *
 * DO NOT automatically call this after a regular/premium
 * verification because NetworkDataSub documents it as its
 * own service operation.
 * =========================================================
 */

export async function generateNinSlip({
  nin,
}) {
  const response =
    await request(
      "POST",
      "/verification/nin/slip",
      {
        nin,
      }
    );

  return normalizeNinVerificationResponse(
    response
  );
}


/**
 * =========================================================
 * NIN HISTORY
 * =========================================================
 */

export async function getNinHistory() {
  return request(
    "GET",
    "/verification/nin/history"
  );
}


/**
 * =========================================================
 * NIN DETAILS
 * =========================================================
 */

export async function getNinDetails(
  id
) {
  if (!id) {
    throw new Error(
      "NIN verification ID is required."
    );
  }

  return request(
    "GET",
    `/verification/nin/${encodeURIComponent(
      id
    )}`
  );
}


/**
 * =========================================================
 * NETWORKDATASUB WALLET
 * =========================================================
 */

export async function getProviderWallet() {
  return request(
    "GET",
    "/wallet"
  );
}


/**
 * =========================================================
 * NETWORKDATASUB USER / ACCOUNT
 * =========================================================
 */

export async function getProviderAccount() {
  return request(
    "GET",
    "/user"
  );
}


/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getNinPricing,
  verifyNin,
  verifyNinByCardType,
  searchNinByPhone,
  generateNinSlip,
  getNinHistory,
  getNinDetails,
  getProviderWallet,
  getProviderAccount,
};