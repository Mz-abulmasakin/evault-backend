/**
 * =========================================================
 * eVAULT EDUCATION / EXAMINATION RESULT PIN
 * VTUGATE PROVIDER CLIENT
 * =========================================================
 *
 * VERIFIED ENDPOINTS:
 *
 * POST /fetchallservices
 * POST /geteducationtypeprice
 * POST /buyeducation
 *
 * PRICE BODY:
 *   service_id
 *
 * PURCHASE BODY:
 *   service_id
 *   phone
 *   quantity
 *   product_code
 *
 * AUTH:
 *   Authorization: Bearer {API_KEY}
 *
 * CONTENT TYPE:
 *   application/x-www-form-urlencoded
 * =========================================================
 */

import axios from "axios";

const API_URL = String(
  process.env.VTUGATE_API_URL ||
    "https://api.vtugate.com/api/v1"
)
  .trim()
  .replace(/\/+$/, "");

const API_TOKEN = String(
  process.env.VTUGATE_API_TOKEN ||
    process.env.VTUGATE_API_KEY ||
    ""
).trim();

const TIMEOUT_MS = Number(
  process.env.VTUGATE_TIMEOUT_MS || 30000
);

const ALLOWED_PRODUCT_CODES = [
  "waec",
  "neco",
  "jamb",
  "nabteb",
];

const educationServiceCache = new Map();

/**
 * =========================================================
 * ERROR HELPER
 * =========================================================
 */

function createProviderError(
  message,
  code = "VTUGATE_EDUCATION_ERROR",
  status = null,
  providerResponse = null
) {
  const error = new Error(
    message ||
      "VTUGATE Education request failed."
  );

  error.code = code;

  if (
    status !== null &&
    status !== undefined
  ) {
    error.status = status;
  }

  error.providerResponse =
    providerResponse;

  return error;
}

/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

function toStringValue(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value).trim();
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getProviderMessage(body) {
  if (typeof body === "string") {
    return body;
  }

  return (
    body?.message ||
    body?.error ||
    body?.detail ||
    body?.data?.message ||
    body?.data?.error ||
    body?.data?.provider_message ||
    body?.data?.description ||
    "VTUGATE Education request failed."
  );
}

function getProviderCode(body) {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return null;
  }

  return (
    body?.code ||
    body?.error_code ||
    body?.errorCode ||
    body?.data?.code ||
    body?.data?.error_code ||
    body?.data?.errorCode ||
    null
  );
}

/**
 * =========================================================
 * ARRAY EXTRACTION
 * =========================================================
 */

function extractArray(
  body,
  keys = []
) {
  if (Array.isArray(body)) {
    return body;
  }

  for (const key of keys) {
    if (Array.isArray(body?.[key])) {
      return body[key];
    }

    if (
      Array.isArray(body?.data?.[key])
    ) {
      return body.data[key];
    }
  }

  if (Array.isArray(body?.data)) {
    return body.data;
  }

  if (Array.isArray(body?.items)) {
    return body.items;
  }

  if (Array.isArray(body?.services)) {
    return body.services;
  }

  return [];
}

/**
 * =========================================================
 * PRODUCT CODE
 * =========================================================
 */

function normalizeProductCode(...values) {
  const combined = values
    .filter(
      (value) =>
        value !== null &&
        value !== undefined
    )
    .map(
      (value) =>
        String(value)
          .trim()
          .toLowerCase()
    )
    .join(" ")
    .replace(/[_-]+/g, " ");

  for (
    const code of ALLOWED_PRODUCT_CODES
  ) {
    const pattern = new RegExp(
      `(^|[^a-z])${code}([^a-z]|$)`,
      "i"
    );

    if (pattern.test(combined)) {
      return code;
    }
  }

  return null;
}

/**
 * =========================================================
 * NORMALIZE EDUCATION SERVICE
 * =========================================================
 */

function normalizeEducationService(item) {
  if (
    !item ||
    typeof item !== "object"
  ) {
    return null;
  }

  const serviceId =
    item.service_id ??
    item.serviceId ??
    item.id ??
    item.provider_id ??
    item.providerId ??
    null;

  const name =
    item.service_name ??
    item.serviceName ??
    item.name ??
    item.title ??
    item.description ??
    "";

  const code =
    item.product_code ??
    item.productCode ??
    item.service_code ??
    item.serviceCode ??
    item.code ??
    item.slug ??
    null;

  const serviceType = String(
    item.service_type ??
      item.serviceType ??
      item.type ??
      item.category ??
      ""
  )
    .trim()
    .toLowerCase();

  const price = toNumber(
    item.price ??
      item.amount ??
      item.cost ??
      item.selling_price ??
      item.sellingPrice
  );

  const productCode =
    normalizeProductCode(
      item.product_code,
      item.productCode,
      item.service_code,
      item.serviceCode,
      item.code,
      item.slug,
      name,
      item.description
    );

  return {
    id: serviceId,
    serviceId,

    name: toStringValue(name),
    code: toStringValue(code),

    productCode,
    serviceType,

    price,
    amount: price,

    provider: "VTUGATE",

    raw: item,
  };
}

/**
 * =========================================================
 * IDENTIFY EDUCATION SERVICE
 * =========================================================
 */

function isEducationService(item) {
  const type = String(
    item?.service_type ??
      item?.serviceType ??
      item?.type ??
      item?.category ??
      ""
  )
    .trim()
    .toLowerCase();

  if (type === "education") {
    return true;
  }

  const name = String(
    item?.service_name ??
      item?.serviceName ??
      item?.name ??
      item?.title ??
      item?.description ??
      item?.product_code ??
      item?.code ??
      ""
  )
    .trim()
    .toLowerCase();

  return [
    "waec",
    "neco",
    "jamb",
    "nabteb",
    "result checker",
    "result",
    "education",
    "exam",
    "examination",
  ].some(
    (keyword) => name.includes(keyword)
  );
}

/**
 * =========================================================
 * GENERIC VTUGATE REQUEST
 * =========================================================
 */

async function request(
  path,
  body = {}
) {
  if (!API_TOKEN) {
    throw createProviderError(
      "VTUGATE_API_TOKEN is not configured.",
      "VTUGATE_TOKEN_MISSING",
      500
    );
  }

  const normalizedPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  const url =
    `${API_URL}${normalizedPath}`;

  const form = new URLSearchParams();

  Object.entries(body || {}).forEach(
    ([key, value]) => {
      if (
        value === undefined ||
        value === null
      ) {
        return;
      }

      form.append(
        key,
        String(value)
      );
    }
  );

  console.log(
    "VTUGATE EDUCATION REQUEST:",
    {
      method: "POST",
      path: normalizedPath,
      url,
      bodyKeys: Object.keys(body || {}),
    }
  );

  try {
    const response = await axios.post(
      url,
      form.toString(),
      {
        timeout:
          Number.isFinite(TIMEOUT_MS) &&
          TIMEOUT_MS > 0
            ? TIMEOUT_MS
            : 30000,

        headers: {
          Authorization:
            `Bearer ${API_TOKEN}`,

          Accept: "application/json",

          "Content-Type":
            "application/x-www-form-urlencoded",

          "User-Agent": "eVault/1.0",
        },

        validateStatus: () => true,
      }
    );

    const responseBody =
      response?.data ?? null;

    console.log(
      "VTUGATE EDUCATION RESPONSE:",
      {
        status: response?.status,

        providerStatus:
          responseBody?.status,

        providerSubStatus:
          responseBody?.data?.provider_status,

        message:
          responseBody?.message || null,
      }
    );

    if (
      response.status < 200 ||
      response.status >= 300
    ) {
      throw createProviderError(
        getProviderMessage(responseBody),

        getProviderCode(responseBody) ||
          "VTUGATE_EDUCATION_HTTP_ERROR",

        response.status,

        responseBody
      );
    }

    if (
      responseBody?.status === false ||
      responseBody?.success === false
    ) {
      throw createProviderError(
        getProviderMessage(responseBody),

        getProviderCode(responseBody) ||
          "VTUGATE_EDUCATION_PROVIDER_FAILED",

        response.status,

        responseBody
      );
    }

    return responseBody;
  } catch (error) {
    if (error?.providerResponse) {
      throw error;
    }

    console.error(
      "VTUGATE EDUCATION REQUEST ERROR:",
      {
        message: error?.message,
        code: error?.code,

        response:
          error?.response?.data || null,
      }
    );

    throw createProviderError(
      error?.response?.data
        ? getProviderMessage(
            error.response.data
          )
        : error?.message ||
            "VTUGATE Education request failed.",

      error?.response?.data
        ? (
            getProviderCode(
              error.response.data
            ) ||
            "VTUGATE_EDUCATION_REQUEST_FAILED"
          )
        : error?.code ||
            "VTUGATE_EDUCATION_REQUEST_FAILED",

      error?.response?.status ?? null,

      error?.response?.data ?? null
    );
  }
}

/**
 * =========================================================
 * FETCH ALL EDUCATION SERVICES
 * =========================================================
 */

export async function getEducationServices() {
  const body = await request(
    "/fetchallservices"
  );

  const rawServices = extractArray(
    body,
    [
      "services",
      "items",
      "providers",
    ]
  );

  const services = rawServices
    .filter(isEducationService)
    .map(normalizeEducationService)
    .filter(Boolean);

  for (const service of services) {
    if (
      service.serviceId !== null &&
      service.serviceId !== undefined
    ) {
      educationServiceCache.set(
        String(service.serviceId),
        service
      );
    }
  }

  return {
    success:
      body?.status !== false &&
      body?.success !== false,

    message:
      body?.message ||
      "Education services retrieved successfully.",

    data: services,

    raw: body,
  };
}

/**
 * =========================================================
 * GET EDUCATION PRICE
 * =========================================================
 *
 * VTUGATE DOCUMENTED BODY:
 *   service_id
 *
 * VTUGATE returns the per-PIN price.
 * eVault calculates total = price * quantity.
 *
 * IMPORTANT:
 * If the unit price is zero or invalid, the selected
 * service is treated as unavailable.
 * =========================================================
 */

export async function getEducationPrice({
  serviceId,
  quantity = 1,
}) {
  const normalizedServiceId =
    Number(serviceId);

  const normalizedQuantity =
    Number(quantity);

  if (
    !Number.isInteger(
      normalizedServiceId
    ) ||
    normalizedServiceId <= 0
  ) {
    throw createProviderError(
      "A valid Education service ID is required.",
      "INVALID_EDUCATION_SERVICE_ID",
      400
    );
  }

  if (
    !Number.isInteger(
      normalizedQuantity
    ) ||
    normalizedQuantity <= 0
  ) {
    throw createProviderError(
      "Education quantity must be at least 1.",
      "INVALID_EDUCATION_QUANTITY",
      400
    );
  }

  // Correct endpoint:
  // POST /api/v1/geteducationtypeprice
  //
  // The documented request requires service_id only.

  const body = await request(
    "/geteducationtypeprice",
    {
      service_id:
        normalizedServiceId,
    }
  );

  const data =
    body?.data &&
    typeof body.data === "object"
      ? body.data
      : body;

  if (data?.provider_status === false) {
    throw createProviderError(
      "This examination PIN service is currently unavailable. Please select another service or try again later.",

      "VTUGATE_EDUCATION_SERVICE_UNAVAILABLE",

      503,

      body
    );
  }

  const unitPrice = toNumber(
    data?.price ??
      data?.unit_price ??
      data?.unitPrice ??
      data?.amount ??
      body?.price ??
      body?.amount
  );

  /**
   * SERVICE UNAVAILABLE GUARD
   *
   * Do not display ₦0.00 as a valid price.
   * Do not proceed to purchase using a zero price.
   */

  if (
    unitPrice === null ||
    unitPrice <= 0
  ) {
    console.warn(
      "VTUGATE EDUCATION SERVICE UNAVAILABLE:",
      {
        serviceId:
          normalizedServiceId,

        providerType:
          data?.type || null,

        description:
          data?.description || null,

        returnedPrice:
          unitPrice,
      }
    );

    throw createProviderError(
      "This examination PIN service is currently unavailable. Please select another service or try again later.",

      "VTUGATE_EDUCATION_SERVICE_UNAVAILABLE",

      503,

      body
    );
  }

  const totalPrice =
    unitPrice * normalizedQuantity;

  if (
    !Number.isFinite(totalPrice) ||
    totalPrice <= 0
  ) {
    throw createProviderError(
      "This examination PIN service is currently unavailable. Please select another service or try again later.",

      "VTUGATE_EDUCATION_SERVICE_UNAVAILABLE",

      503,

      body
    );
  }

  return {
    success: true,

    message:
      body?.message ||
      "Education price retrieved successfully.",

    serviceId:
      normalizedServiceId,

    quantity:
      normalizedQuantity,

    unitPrice,

    totalPrice,

    data,

    raw: body,
  };
}

/**
 * =========================================================
 * FIND EDUCATION SERVICE
 * =========================================================
 */

async function findEducationService(
  serviceId
) {
  const cached =
    educationServiceCache.get(
      String(serviceId)
    );

  if (cached) {
    return cached;
  }

  // Re-fetch services after a server restart
  // if the service cache is empty.

  const result =
    await getEducationServices();

  return (
    result.data.find(
      (service) =>
        String(service.serviceId) ===
        String(serviceId)
    ) || null
  );
}

/**
 * =========================================================
 * PHONE NORMALIZATION
 * =========================================================
 */

function normalizeProviderPhone(value) {
  const original =
    toStringValue(value);

  if (!original) {
    return "";
  }

  return original
    .replace(/(?!^\+)\D/g, "")
    .replace(/[^\d+]/g, "");
}

/**
 * =========================================================
 * BUY EDUCATION PINS
 * =========================================================
 *
 * VTUGATE DOCUMENTED BODY:
 *   service_id
 *   phone
 *   quantity
 *   product_code
 *
 * The actual customer's phone number should be
 * passed from the backend education service.
 *
 * VTUGATE_EDUCATION_PHONE is only a fallback.
 * =========================================================
 */

export async function purchaseEducationPins({
  serviceId,
  quantity = 1,
  phone,
  productCode,
  serviceCode,
  serviceName,
}) {
  const normalizedServiceId =
    Number(serviceId);

  const normalizedQuantity =
    Number(quantity);

  if (
    !Number.isInteger(
      normalizedServiceId
    ) ||
    normalizedServiceId <= 0
  ) {
    throw createProviderError(
      "A valid Education service ID is required.",
      "INVALID_EDUCATION_SERVICE_ID",
      400
    );
  }

  if (
    !Number.isInteger(
      normalizedQuantity
    ) ||
    normalizedQuantity <= 0
  ) {
    throw createProviderError(
      "Education quantity must be at least 1.",
      "INVALID_EDUCATION_QUANTITY",
      400
    );
  }

  const resolvedPhone =
    normalizeProviderPhone(
      phone ||
        process.env.VTUGATE_EDUCATION_PHONE ||
        ""
    );

  if (
    !/^\+?\d{10,15}$/.test(
      resolvedPhone
    )
  ) {
    throw createProviderError(
      "A valid customer phone number is required for VTUGATE Education PIN purchase.",

      "VTUGATE_EDUCATION_PHONE_REQUIRED",

      400
    );
  }

  const cachedService =
    await findEducationService(
      normalizedServiceId
    );

  const resolvedProductCode =
    normalizeProductCode(
      productCode,
      serviceCode,
      serviceName,

      cachedService?.productCode,
      cachedService?.code,
      cachedService?.name,

      cachedService?.raw?.product_code,
      cachedService?.raw?.productCode
    );

  if (!resolvedProductCode) {
    throw createProviderError(
      "Could not determine the examination product code. The service must identify WAEC, NECO, JAMB, or NABTEB.",

      "VTUGATE_EDUCATION_PRODUCT_CODE_REQUIRED",

      400,

      {
        serviceId:
          normalizedServiceId,

        cachedService,
      }
    );
  }

  // Correct endpoint:
  // POST /api/v1/buyeducation

  const body = await request(
    "/buyeducation",
    {
      service_id:
        normalizedServiceId,

      phone:
        resolvedPhone,

      quantity:
        normalizedQuantity,

      product_code:
        resolvedProductCode,
    }
  );

  const providerData =
    body?.data &&
    typeof body.data === "object"
      ? body.data
      : body;

  if (
    providerData?.provider_status === false
  ) {
    throw createProviderError(
      providerData?.provider_message ||
        getProviderMessage(body),

      getProviderCode(body) ||
        "VTUGATE_EDUCATION_PURCHASE_FAILED",

      502,

      body
    );
  }

  return {
    success:
      body?.status === true &&
      providerData?.provider_status !== false,

    message:
      body?.message ||
      "Education PIN purchase was successful.",

    serviceId:
      normalizedServiceId,

    quantity:
      normalizedQuantity,

    productCode:
      resolvedProductCode,

    data:
      providerData,

    raw: body,
  };
}

/**
 * =========================================================
 * NORMALIZE PIN ITEM
 * =========================================================
 *
 * VTUGATE can return PIN strings or PIN objects
 * containing PIN and serial values.
 * =========================================================
 */

function normalizePinItem(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  if (typeof value !== "object") {
    return String(value).trim();
  }

  const pin =
    value.pin ??
    value.pin_code ??
    value.pinCode ??
    value.code ??
    value.voucher_code;

  const serial =
    value.serial ??
    value.serial_number ??
    value.serialNumber ??
    value.sn;

  if (
    pin !== undefined &&
    serial !== undefined
  ) {
    return (
      `PIN: ${String(pin)} | ` +
      `Serial: ${String(serial)}`
    );
  }

  if (pin !== undefined) {
    return String(pin).trim();
  }

  if (serial !== undefined) {
    return `Serial: ${String(serial)}`;
  }

  return toStringValue(
    value.value ??
      value.number ??
      value.voucher
  );
}

/**
 * =========================================================
 * EXTRACT EDUCATION PINS
 * =========================================================
 */

export function extractEducationPins(
  response
) {
  const data =
    response?.data ??
    response ??
    {};

  const candidates = [
    data?.pins,
    data?.pin_codes,
    data?.pinCodes,
    data?.result_pins,
    data?.resultPins,
    data?.result_pin,
    data?.resultPin,
    data?.pin,
    data?.voucher,
    data?.vouchers,

    response?.pins,
    response?.pin_codes,
    response?.pinCodes,
    response?.result_pins,
    response?.resultPins,
    response?.result_pin,
    response?.resultPin,
    response?.pin,
    response?.voucher,
    response?.vouchers,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
        .map(normalizePinItem)
        .filter(Boolean);
    }

    if (
      candidate !== null &&
      candidate !== undefined &&
      candidate !== ""
    ) {
      const normalized =
        normalizePinItem(candidate);

      return normalized
        ? [normalized]
        : [];
    }
  }

  return [];
}

/**
 * =========================================================
 * EXTRACT PROVIDER REFERENCE
 * =========================================================
 */

export function extractEducationReference(
  response
) {
  const data =
    response?.data ??
    response ??
    {};

  return (
    data?.external_reference ||
    data?.externalReference ||
    data?.reference ||
    data?.transaction_reference ||
    data?.transactionReference ||
    data?.transaction_id ||
    data?.transactionId ||
    data?.id ||

    response?.external_reference ||
    response?.externalReference ||
    response?.reference ||
    response?.transaction_reference ||
    response?.transactionReference ||
    response?.transaction_id ||
    response?.transactionId ||
    response?.id ||

    null
  );
}

/**
 * =========================================================
 * EXTRACT PROVIDER AMOUNT
 * =========================================================
 */

export function extractEducationAmount(
  response
) {
  const data =
    response?.data ??
    response ??
    {};

  return toNumber(
    data?.amount ??
      data?.price ??
      data?.total_amount ??
      data?.totalAmount ??
      response?.amount ??
      response?.price ??
      response?.total_amount ??
      response?.totalAmount
  );
}

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getEducationServices,
  getEducationPrice,
  purchaseEducationPins,

  extractEducationPins,
  extractEducationReference,
  extractEducationAmount,
};