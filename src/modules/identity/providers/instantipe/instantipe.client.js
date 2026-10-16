
// src/modules/identity/providers/instantipe/instantipe.client.js

/**
 * =========================================================
 * INSTANTIPE API CLIENT
 * =========================================================
 *
 * Server-side client only.
 *
 * IMPORTANT:
 * The InstantIPE API key must NEVER be exposed to
 * the React Native application.
 * =========================================================
 */

const API_URL =
  process.env.INSTANTIPE_API_URL ||
  "https://instantipe.com.ng/api/v1";

const API_KEY =
  process.env.INSTANTIPE_API_KEY;

if (!API_KEY) {
  console.warn(
    "WARNING: INSTANTIPE_API_KEY is not configured."
  );
}

/**
 * =========================================================
 * EXTRACT PROVIDER ERROR CODE
 * =========================================================
 *
 * InstantIPE may return the error code in different forms:
 *
 * {
 *   "code": "insufficient_funds"
 * }
 *
 * OR
 *
 * {
 *   "error": "insufficient_funds"
 * }
 *
 * OR
 *
 * {
 *   "error": {
 *     "code": "insufficient_funds",
 *     "message": "..."
 *   }
 * }
 *
 * We normalize all of them here.
 * =========================================================
 */
function extractProviderErrorCode(data) {
  if (!data) {
    return null;
  }

  if (
    typeof data.code === "string" &&
    data.code.trim()
  ) {
    return data.code.trim();
  }

  if (
    typeof data.error === "string" &&
    data.error.trim()
  ) {
    return data.error.trim();
  }

  if (
    data.error &&
    typeof data.error === "object"
  ) {
    if (
      typeof data.error.code === "string" &&
      data.error.code.trim()
    ) {
      return data.error.code.trim();
    }

    if (
      typeof data.error.type === "string" &&
      data.error.type.trim()
    ) {
      return data.error.type.trim();
    }
  }

  if (
    typeof data.error_code === "string" &&
    data.error_code.trim()
  ) {
    return data.error_code.trim();
  }

  if (
    typeof data.status_code === "string" &&
    data.status_code.trim()
  ) {
    return data.status_code.trim();
  }

  return null;
}

/**
 * =========================================================
 * EXTRACT PROVIDER ERROR MESSAGE
 * =========================================================
 */
function extractProviderErrorMessage(
  data,
  fallback
) {
  if (!data) {
    return fallback;
  }

  if (
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return data.message.trim();
  }

  if (
    typeof data.error_message === "string" &&
    data.error_message.trim()
  ) {
    return data.error_message.trim();
  }

  if (
    data.error &&
    typeof data.error === "object"
  ) {
    if (
      typeof data.error.message === "string" &&
      data.error.message.trim()
    ) {
      return data.error.message.trim();
    }

    if (
      typeof data.error.detail === "string" &&
      data.error.detail.trim()
    ) {
      return data.error.detail.trim();
    }
  }

  if (
    typeof data.detail === "string" &&
    data.detail.trim()
  ) {
    return data.detail.trim();
  }

  if (
    typeof data.error === "string" &&
    data.error.trim() &&
    ![
      "insufficient_funds",
      "unauthorized",
      "forbidden",
      "validation_error",
      "duplicate_request",
      "idempotency_conflict",
      "request_in_progress",
      "rate_limited",
      "wallet_error",
      "service_unavailable",
      "server_error",
    ].includes(
      data.error.trim().toLowerCase()
    )
  ) {
    return data.error.trim();
  }

  return fallback;
}

/**
 * =========================================================
 * REQUEST
 * =========================================================
 */
async function request(
  method,
  path,
  {
    body = undefined,
    idempotencyKey = null,
  } = {}
) {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  };

  if (body !== undefined) {
    headers["Content-Type"] =
      "application/json";
  }

  if (idempotencyKey) {
    headers["Idempotency-Key"] =
      idempotencyKey;
  }

  let response;

  try {
    response = await fetch(
      `${API_URL}${path}`,
      {
        method,
        headers,
        body:
          body !== undefined
            ? JSON.stringify(body)
            : undefined,
      }
    );
  } catch (networkError) {
    const error = new Error(
      networkError?.message ||
        "Unable to connect to InstantIPE."
    );

    error.code = "NETWORK_ERROR";
    error.status = 0;
    error.providerResponse = null;

    throw error;
  }

  const text =
    await response.text();

  let data = null;

  try {
    data = text
      ? JSON.parse(text)
      : null;
  } catch {
    data = text;
  }

  /**
   * =======================================================
   * PROVIDER ERROR
   * =======================================================
   */
  if (!response.ok) {
    const fallbackMessage =
      `InstantIPE request failed with HTTP ${response.status}`;

    const providerCode =
      extractProviderErrorCode(data);

    const providerMessage =
      extractProviderErrorMessage(
        data,
        fallbackMessage
      );

    const error =
      new Error(providerMessage);

    /**
     * HTTP status
     */
    error.status =
      response.status;

    /**
     * Normalized provider error code
     */
    error.code =
      providerCode ||
      `HTTP_${response.status}`;

    /**
     * Keep complete provider response
     */
    error.providerResponse =
      data;

    /**
     * Keep useful fields separately
     */
    error.providerCode =
      providerCode;

    error.providerMessage =
      providerMessage;

    /**
     * Special flag for the most important
     * provider wallet error.
     */
    error.isInsufficientFunds =
      String(providerCode || "")
        .toLowerCase() ===
      "insufficient_funds";

    console.error(
      "INSTANTIPE API ERROR:",
      {
        method,
        path,
        status:
          response.status,
        code:
          error.code,
        message:
          providerMessage,
        providerResponse:
          data,
      }
    );

    throw error;
  }

  /**
   * =======================================================
   * SUCCESS
   * =======================================================
   */
  return data;
}

/**
 * =========================================================
 * GET
 * =========================================================
 */
async function get(
  path
) {
  return request(
    "GET",
    path
  );
}

/**
 * =========================================================
 * POST
 * =========================================================
 */
async function post(
  path,
  body,
  idempotencyKey = null
) {
  return request(
    "POST",
    path,
    {
      body,
      idempotencyKey,
    }
  );
}

/**
 * =========================================================
 * SERVICE CATALOGUE
 * =========================================================
 */
async function getServices(
  service = null
) {
  const path =
    service
      ? `/services?service=${encodeURIComponent(
          service
        )}`
      : "/services";

  return get(path);
}

/**
 * =========================================================
 * NIN VALIDATION
 * =========================================================
 */
async function submitNinValidation({
  nin,
  validationType = "full",
  slipType = "standard",
  fullName = null,
  phoneNumber = null,
  note = null,
  idempotencyKey = null,
}) {
  return post(
    "/validation",
    {
      nin,
      validation_type:
        validationType,
      slip_type:
        slipType,

      ...(fullName
        ? {
            full_name:
              fullName,
          }
        : {}),

      ...(phoneNumber
        ? {
            phone_number:
              phoneNumber,
          }
        : {}),

      ...(note
        ? {
            note,
          }
        : {}),
    },
    idempotencyKey
  );
}

/**
 * =========================================================
 * NIN STATUS
 * =========================================================
 */
async function getNinValidation(
  reference
) {
  return get(
    `/validation?reference=${encodeURIComponent(
      reference
    )}`
  );
}

/**
 * =========================================================
 * IPE CLEARANCE
 * =========================================================
 */
async function submitIPEClearance({
  trackingId,
  oldTrackingId = null,
  nin = null,
  fullName = null,
  phoneNumber = null,
  note = null,
  idempotencyKey = null,
}) {
  return post(
    "/ipe",
    {
      tracking_id:
        trackingId,

      ...(oldTrackingId
        ? {
            old_tracking_id:
              oldTrackingId,
          }
        : {}),

      ...(nin
        ? {
            nin,
          }
        : {}),

      ...(fullName
        ? {
            full_name:
              fullName,
          }
        : {}),

      ...(phoneNumber
        ? {
            phone_number:
              phoneNumber,
          }
        : {}),

      ...(note
        ? {
            note,
          }
        : {}),
    },
    idempotencyKey
  );
}

/**
 * =========================================================
 * IPE STATUS
 * =========================================================
 */
async function getIPEClearance(
  reference
) {
  return get(
    `/ipe?reference=${encodeURIComponent(
      reference
    )}`
  );
}

/**
 * =========================================================
 * EXPORT
 * =========================================================
 */
const instantIpe = {
  get,
  post,

  getServices,

  submitNinValidation,
  getNinValidation,

  submitIPEClearance,
  getIPEClearance,
};

export default instantIpe;

