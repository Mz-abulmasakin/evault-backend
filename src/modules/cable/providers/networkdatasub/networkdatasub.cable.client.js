/**
 * =========================================================
 * eVAULT CABLE TV
 * VTUGATE PROVIDER CLIENT
 * =========================================================
 *
 * File:
 * src/modules/cable/providers/networkdatasub/
 * networkdatasub.cable.client.js
 *
 * VTUGATE endpoints:
 *
 * POST /api/v1/fetchallservices
 * POST /api/v1/verifycabletv
 * POST /api/v1/buycabletv
 * POST /api/v1/transactionstatus
 * POST /api/v1/transactionhistory
 *
 * Authentication:
 * Authorization: Bearer <VTUGATE_API_TOKEN>
 *
 * Content-Type:
 * application/x-www-form-urlencoded
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

const PROVIDER_NAME = "vtugate";

/**
 * =========================================================
 * ERROR HELPERS
 * =========================================================
 */

function createProviderError(
  message,
  code = "VTUGATE_ERROR",
  status = null,
  providerResponse = null,
  extra = {}
) {
  const error = new Error(
    message ||
      "VTUGATE cable request failed."
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

  if (
    extra &&
    typeof extra === "object"
  ) {
    Object.assign(
      error,
      extra
    );
  }

  return error;
}

function getProviderResponse(error) {
  return (
    error?.providerResponse ??
    error?.response?.data ??
    {
      status: false,
      message:
        error?.message ||
        "VTUGATE request failed.",
      code: error?.code || null,
    }
  );
}

function getProviderMessage(body) {
  if (
    typeof body === "string"
  ) {
    return body;
  }

  return (
    body?.message ||
    body?.error ||
    body?.detail ||
    body?.data?.message ||
    body?.data?.error ||
    "VTUGATE request failed."
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

function extractArray(
  body,
  keys = []
) {
  if (
    Array.isArray(body)
  ) {
    return body;
  }

  for (
    const key of keys
  ) {
    if (
      Array.isArray(
        body?.[key]
      )
    ) {
      return body[key];
    }

    if (
      Array.isArray(
        body?.data?.[key]
      )
    ) {
      return body.data[key];
    }
  }

  if (
    Array.isArray(
      body?.data
    )
  ) {
    return body.data;
  }

  if (
    Array.isArray(
      body?.items
    )
  ) {
    return body.items;
  }

  return [];
}

/**
 * =========================================================
 * PROVIDER NORMALIZER
 * =========================================================
 */

function normalizeProvider(
  provider
) {
  if (
    !provider ||
    typeof provider !== "object"
  ) {
    return null;
  }

  const serviceId =
    provider.service_id ??
    provider.serviceId ??
    provider.id ??
    provider.provider_id ??
    provider.providerId ??
    null;

  const name =
    provider.service_name ??
    provider.serviceName ??
    provider.tv_name ??
    provider.tvName ??
    provider.name ??
    provider.title ??
    "";

  const code =
    provider.service_code ??
    provider.serviceCode ??
    provider.code ??
    provider.slug ??
    null;

  const serviceType =
    String(
      provider.service_type ??
        provider.serviceType ??
        provider.type ??
        ""
    )
      .trim()
      .toLowerCase();

  return {
    id: serviceId,

    providerId:
      serviceId,

    serviceId,

    name:
      toStringValue(name),

    code:
      toStringValue(code),

    serviceType,

    provider:
      PROVIDER_NAME,

    raw:
      provider,
  };
}

/**
 * =========================================================
 * CHECK WHETHER A VTUGATE SERVICE IS CABLE TV
 * =========================================================
 */

function isCableProvider(
  provider
) {
  const type =
    String(
      provider?.service_type ??
        provider?.serviceType ??
        provider?.type ??
        ""
    )
      .trim()
      .toLowerCase();

  if (
    type === "tv" ||
    type === "cable" ||
    type === "cabletv" ||
    type === "cable_tv"
  ) {
    return true;
  }

  if (type) {
    return false;
  }

  const name =
    String(
      provider?.service_name ??
        provider?.serviceName ??
        provider?.tv_name ??
        provider?.tvName ??
        provider?.name ??
        ""
    )
      .trim()
      .toLowerCase();

  return [
    "dstv",
    "gotv",
    "startimes",
    "cable tv",
    "cabletv",
  ].some(
    (value) =>
      name.includes(value)
  );
}

/**
 * =========================================================
 * PLAN NORMALIZER
 * =========================================================
 */

function normalizePlan(
  plan,
  fallbackServiceId = null
) {
  if (
    !plan ||
    typeof plan !== "object"
  ) {
    return null;
  }

  const serviceId =
    plan.service_id ??
    plan.serviceId ??
    plan.provider_id ??
    plan.providerId ??
    fallbackServiceId ??
    null;

  const code =
    plan.code ??
    plan.plan_code ??
    plan.planCode ??
    "";

  const name =
    plan.name ??
    plan.plan_name ??
    plan.planName ??
    plan.title ??
    "";

  const price =
    toNumber(
      plan.price ??
        plan.amount ??
        plan.cost ??
        plan.selling_price
    );

  return {
    id:
      code ||
      name ||
      `${serviceId || "cable"}-${
        price || "0"
      }`,

    planId:
      code || null,

    code:
      toStringValue(code),

    planCode:
      toStringValue(code),

    name:
      toStringValue(name),

    planName:
      toStringValue(name),

    price,

    amount:
      price,

    serviceId,

    providerId:
      serviceId,

    provider:
      PROVIDER_NAME,

    raw:
      plan,
  };
}

/**
 * =========================================================
 * EXTRACT PLANS FROM VERIFY RESPONSE
 * =========================================================
 */

function getCablePlansFromVerifyResponse(
  body,
  serviceId
) {
  const plans =
    body?.data?.cable_plans ??
    body?.data?.cablePlans ??
    body?.cable_plans ??
    body?.cablePlans ??
    [];

  if (
    !Array.isArray(plans)
  ) {
    return [];
  }

  return plans
    .map(
      (plan) =>
        normalizePlan(
          plan,
          serviceId
        )
    )
    .filter(Boolean);
}

/**
 * =========================================================
 * FORM ENCODER
 * =========================================================
 */

function buildFormBody(
  data = {}
) {
  const params =
    new URLSearchParams();

  for (
    const [key, value] of
      Object.entries(data)
  ) {
    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    params.append(
      key,
      String(value)
    );
  }

  return params.toString();
}

/**
 * =========================================================
 * VTUGATE REQUEST
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
      500,
      {
        status: false,
        message:
          "VTUGATE_API_TOKEN is not configured.",
      }
    );
  }

  const normalizedPath =
    path.startsWith("/")
      ? path
      : `/${path}`;

  const timeoutMs =
    Number.isFinite(TIMEOUT_MS) &&
    TIMEOUT_MS > 0
      ? TIMEOUT_MS
      : 30000;

  const url =
    `${API_URL}${normalizedPath}`;

  console.log(
    "VTUGATE CABLE REQUEST:",
    {
      method: "POST",
      path: normalizedPath,
      url,
      timeoutMs,
      hasToken:
        Boolean(API_TOKEN),
      bodyKeys:
        Object.keys(
          body || {}
        ),
    }
  );

  try {
    const response =
      await axios.post(
        url,
        buildFormBody(body),
        {
          timeout:
            timeoutMs,

          headers: {
            Authorization:
              `Bearer ${API_TOKEN}`,

            Accept:
              "application/json",

            "Content-Type":
              "application/x-www-form-urlencoded",

            "User-Agent":
              "eVault/1.0",
          },

          validateStatus:
            () => true,
        }
      );

    const responseBody =
      response?.data ?? null;

    console.log(
      "VTUGATE CABLE RESPONSE:",
      {
        path:
          normalizedPath,

        status:
          response?.status ??
          null,

        providerStatus:
          responseBody?.data
            ?.provider_status ??
          responseBody?.status ??
          null,

        message:
          getProviderMessage(
            responseBody
          ),

        rootKeys:
          responseBody &&
          typeof responseBody ===
            "object"
            ? Object.keys(
                responseBody
              )
            : [],

        dataKeys:
          responseBody?.data &&
          typeof responseBody.data ===
            "object"
            ? Object.keys(
                responseBody.data
              )
            : [],
      }
    );

    if (
      !response ||
      response.status < 200 ||
      response.status >= 300
    ) {
      throw createProviderError(
        getProviderMessage(
          responseBody
        ),
        "VTUGATE_HTTP_ERROR",
        response?.status ??
          null,
        responseBody
      );
    }

    if (
      responseBody &&
      typeof responseBody ===
        "object" &&
      responseBody.status !== true
    ) {
      throw createProviderError(
        getProviderMessage(
          responseBody
        ),
        "VTUGATE_PROVIDER_ERROR",
        response.status,
        responseBody,
        {
          providerCode:
            getProviderCode(
              responseBody
            ),
        }
      );
    }

    return responseBody;
  } catch (error) {
    if (
      error?.code ===
        "VTUGATE_HTTP_ERROR" ||
      error?.code ===
        "VTUGATE_PROVIDER_ERROR" ||
      error?.code ===
        "VTUGATE_TOKEN_MISSING"
    ) {
      throw error;
    }

    const timeout =
      error?.code ===
        "ECONNABORTED" ||
      error?.code ===
        "ETIMEDOUT" ||
      error?.code ===
        "ECONNRESET" ||
      error?.cause?.code ===
        "ETIMEDOUT";

    if (timeout) {
      throw createProviderError(
        "VTUGATE cable service connection timed out.",
        "VTUGATE_TIMEOUT",
        504,
        {
          status: false,
          message:
            "VTUGATE cable service connection timed out.",
          code:
            error?.code || null,
          causeCode:
            error?.cause?.code ||
            null,
        },
        {
          originalError:
            error,
        }
      );
    }

    const responseBody =
      getProviderResponse(error);

    throw createProviderError(
      getProviderMessage(
        responseBody
      ),
      "VTUGATE_REQUEST_FAILED",
      error?.response
        ?.status ?? null,
      responseBody,
      {
        providerCode:
          getProviderCode(
            responseBody
          ),

        originalError:
          error,
      }
    );
  }
}

/**
 * =========================================================
 * GET CABLE PROVIDERS
 * =========================================================
 */

export async function getCableProviders() {
  const body =
    await request(
      "/fetchallservices"
    );

  const services =
    extractArray(
      body,
      [
        "services",
        "providers",
        "items",
      ]
    );

  const providers =
    services
      .filter(
        isCableProvider
      )
      .map(
        normalizeProvider
      )
      .filter(
        (provider) =>
          provider &&
          provider.id !==
            null &&
          provider.id !==
            undefined
      );

  return {
    success:
      body?.status === true,

    message:
      body?.message ||
      "Cable providers retrieved successfully.",

    provider:
      PROVIDER_NAME,

    data:
      providers,

    raw:
      body,
  };
}

/**
 * =========================================================
 * VERIFY CABLE TV
 * =========================================================
 */

export async function verifyCableSmartcard({
  providerId,
  serviceId,
  phone,
  smartCardNumber,
  smartcardNumber,
}) {
  const normalizedServiceId =
    Number(
      serviceId ??
        providerId
    );

  const normalizedPhone =
    toStringValue(
      phone
    ).replace(
      /\s+/g,
      ""
    );

  const normalizedSmartcard =
    toStringValue(
      smartCardNumber ??
        smartcardNumber
    ).replace(
      /\D/g,
      ""
    );

  if (
    !Number.isInteger(
      normalizedServiceId
    ) ||
    normalizedServiceId <= 0
  ) {
    throw createProviderError(
      "A valid VTUGATE cable service ID is required.",
      "INVALID_CABLE_SERVICE_ID",
      400
    );
  }

  if (
    !/^0\d{10}$/.test(
      normalizedPhone
    )
  ) {
    throw createProviderError(
      "A valid Nigerian phone number is required.",
      "INVALID_CABLE_PHONE",
      400
    );
  }

  if (
    !normalizedSmartcard
  ) {
    throw createProviderError(
      "Smartcard number is required.",
      "SMARTCARD_NUMBER_REQUIRED",
      400
    );
  }

  const body =
    await request(
      "/verifycabletv",
      {
        service_id:
          normalizedServiceId,

        phone:
          normalizedPhone,

        smartcard_number:
          normalizedSmartcard,
      }
    );

  const data =
    body?.data ?? {};

  const plans =
    getCablePlansFromVerifyResponse(
      body,
      normalizedServiceId
    );

  const providerStatus =
    data?.provider_status ===
    true;

  if (
    !providerStatus
  ) {
    throw createProviderError(
      data?.provider_message ||
        body?.message ||
        "Cable smartcard verification failed.",
      "CABLE_SMARTCARD_NOT_VERIFIED",
      400,
      body
    );
  }

  return {
    success: true,

    message:
      body?.message ||
      "Verification was successful",

    provider:
      PROVIDER_NAME,

    serviceId:
      normalizedServiceId,

    providerId:
      normalizedServiceId,

    phone:
      normalizedPhone,

    smartCardNumber:
      normalizedSmartcard,

    data: {
      ...data,

      provider_status:
        providerStatus,

      cable_plans:
        plans,
    },

    plans,

    raw:
      body,
  };
}

/**
 * =========================================================
 * COMPATIBILITY PLAN METHODS
 * =========================================================
 *
 * VTUGATE returns authoritative plans from
 * /verifycabletv.
 *
 * We do NOT invent a cable-plans endpoint.
 * =========================================================
 */

export async function getAllCablePlans() {
  return {
    success: true,

    message:
      "VTUGATE returns cable plans from Verify Cable TV. Verify the smartcard to retrieve authoritative plans.",

    provider:
      PROVIDER_NAME,

    data: [],

    raw: null,
  };
}

export async function getCablePlansByProvider(
  providerId
) {
  const normalizedServiceId =
    Number(providerId);

  if (
    !Number.isInteger(
      normalizedServiceId
    ) ||
    normalizedServiceId <= 0
  ) {
    throw createProviderError(
      "A valid VTUGATE cable service ID is required.",
      "INVALID_CABLE_SERVICE_ID",
      400
    );
  }

  return {
    success: true,

    message:
      "VTUGATE returns cable plans from Verify Cable TV. Verify the smartcard to retrieve authoritative plans.",

    provider:
      PROVIDER_NAME,

    providerId:
      normalizedServiceId,

    serviceId:
      normalizedServiceId,

    data: [],

    raw: null,
  };
}

/**
 * =========================================================
 * BUY CABLE TV
 * =========================================================
 */

export async function purchaseCable({
  serviceId,
  providerId,
  phone,
  smartCardNumber,
  smartcardNumber,
  amount,
  planCode,
  plan_code,
  planName,
  plan_name,
}) {
  const normalizedServiceId =
    Number(
      serviceId ??
        providerId
    );

  const normalizedPhone =
    toStringValue(
      phone
    ).replace(
      /\s+/g,
      ""
    );

  const normalizedSmartcard =
    toStringValue(
      smartCardNumber ??
        smartcardNumber
    ).replace(
      /\D/g,
      ""
    );

  const normalizedAmount =
    Number(amount);

  const normalizedPlanCode =
    toStringValue(
      planCode ??
        plan_code
    );

  const normalizedPlanName =
    toStringValue(
      planName ??
        plan_name
    );

  if (
    !Number.isInteger(
      normalizedServiceId
    ) ||
    normalizedServiceId <= 0
  ) {
    throw createProviderError(
      "A valid VTUGATE cable service ID is required.",
      "INVALID_CABLE_SERVICE_ID",
      400
    );
  }

  if (
    !/^0\d{10}$/.test(
      normalizedPhone
    )
  ) {
    throw createProviderError(
      "A valid Nigerian phone number is required.",
      "INVALID_CABLE_PHONE",
      400
    );
  }

  if (
    !normalizedSmartcard
  ) {
    throw createProviderError(
      "Smartcard number is required.",
      "SMARTCARD_NUMBER_REQUIRED",
      400
    );
  }

  if (
    !Number.isFinite(
      normalizedAmount
    ) ||
    normalizedAmount <= 0
  ) {
    throw createProviderError(
      "A valid cable plan amount is required.",
      "INVALID_CABLE_AMOUNT",
      400
    );
  }

  if (
    !normalizedPlanCode ||
    !normalizedPlanName
  ) {
    throw createProviderError(
      "Cable plan code and plan name are required.",
      "CABLE_PLAN_REQUIRED",
      400
    );
  }

  const body =
    await request(
      "/buycabletv",
      {
        service_id:
          normalizedServiceId,

        phone:
          normalizedPhone,

        smartcard_number:
          normalizedSmartcard,

        amount:
          normalizedAmount,

        plan_code:
          normalizedPlanCode,

        plan_name:
          normalizedPlanName,
      }
    );

  const data =
    body?.data ?? {};

  if (
    data?.provider_status !==
    true
  ) {
    throw createProviderError(
      data?.provider_message ||
        body?.message ||
        "Cable purchase failed.",
      "CABLE_PURCHASE_FAILED",
      400,
      body
    );
  }

  return {
    success: true,

    message:
      body?.message ||
      "Cable purchase was successful",

    provider:
      PROVIDER_NAME,

    serviceId:
      normalizedServiceId,

    providerId:
      normalizedServiceId,

    data,

    amount:
      toNumber(
        data?.amount
      ) ??
      normalizedAmount,

    planCode:
      normalizedPlanCode,

    planName:
      toStringValue(
        data?.plan_name
      ) ||
      normalizedPlanName,

    externalReference:
      data?.external_reference ??
      null,

    transactionId:
      data?.transaction_id ??
      null,

    raw:
      body,
  };
}

/**
 * =========================================================
 * TRANSACTION STATUS
 * =========================================================
 */

export async function getCableTransactionStatus({
  transactionId,
  externalReference,
  reference,
}) {
  const normalizedTransactionId =
    toStringValue(
      transactionId
    );

  const normalizedExternalReference =
    toStringValue(
      externalReference ??
        reference
    );

  if (
    !normalizedTransactionId &&
    !normalizedExternalReference
  ) {
    throw createProviderError(
      "VTUGATE transaction ID or external reference is required.",
      "VTUGATE_TRANSACTION_REFERENCE_REQUIRED",
      400
    );
  }

  const body =
    await request(
      "/transactionstatus",
      {
        transaction_id:
          normalizedTransactionId ||
          undefined,

        external_reference:
          normalizedExternalReference ||
          undefined,
      }
    );

  return {
    success:
      body?.status === true,

    message:
      body?.message ||
      "Transaction status retrieved successfully.",

    data:
      body?.data ??
      null,

    raw:
      body,
  };
}

/**
 * =========================================================
 * TRANSACTION HISTORY
 * =========================================================
 */

export async function getCableHistory({
  page = 1,
  perPage = 50,
  search,
  status = "all",
  dateRange,
  sortBy,
  order,
} = {}) {
  const normalizedPage =
    Math.max(
      1,
      Number(page) || 1
    );

  const normalizedPerPage =
    Math.min(
      50,
      Math.max(
        1,
        Number(perPage) || 50
      )
    );

  const body =
    await request(
      "/transactionhistory",
      {
        page:
          normalizedPage,

        per_page:
          normalizedPerPage,

        search,

        status,

        service_type:
          "tv",

        date_range:
          dateRange,

        sort_by:
          sortBy,

        order,
      }
    );

  return {
    success:
      body?.status === true,

    message:
      body?.message ||
      "Cable transaction history retrieved successfully.",

    data:
      body?.data ??
      [],

    pagination:
      body?.pagination ??
      body?.meta ??
      null,

    raw:
      body,
  };
}

/**
 * =========================================================
 * STATISTICS
 * =========================================================
 */

export async function getCableStatistics() {
  const history =
    await getCableHistory({
      page: 1,
      perPage: 50,
      status: "all",
    });

  const rows =
    Array.isArray(
      history?.data
    )
      ? history.data
      : [];

  const totals = {
    total: rows.length,
    successful: 0,
    failed: 0,
    pending: 0,
    amount: 0,
  };

  for (
    const row of rows
  ) {
    const status =
      String(
        row?.status ??
          row?.transaction_status ??
          row?.state ??
          ""
      ).toLowerCase();

    if (
      status === "success" ||
      status === "successful" ||
      status === "completed"
    ) {
      totals.successful +=
        1;
    } else if (
      status === "failed" ||
      status === "failure"
    ) {
      totals.failed +=
        1;
    } else if (
      status === "pending" ||
      status === "processing"
    ) {
      totals.pending +=
        1;
    }

    const amount =
      toNumber(
        row?.amount ??
          row?.transaction_amount ??
          row?.price
      );

    if (
      amount !== null
    ) {
      totals.amount +=
        amount;
    }
  }

  return {
    success: true,

    message:
      "Cable statistics retrieved successfully.",

    provider:
      PROVIDER_NAME,

    data:
      totals,

    raw:
      history?.raw ??
      null,
  };
}

/**
 * =========================================================
 * NORMALIZERS EXPORTED FOR SERVICE/UI
 * =========================================================
 */

export function normalizeCableProviderForApp(
  provider
) {
  return normalizeProvider(
    provider
  );
}

export function normalizeCablePlanForApp(
  plan,
  serviceId = null
) {
  return normalizePlan(
    plan,
    serviceId
  );
}

/**
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

export function getConfigurationStatus() {
  return {
    provider:
      PROVIDER_NAME.toUpperCase(),

    apiUrl:
      API_URL,

    tokenConfigured:
      Boolean(API_TOKEN),

    timeoutMs:
      TIMEOUT_MS,

    endpoints: {
      services:
        "/fetchallservices",

      verify:
        "/verifycabletv",

      purchase:
        "/buycabletv",

      transactionStatus:
        "/transactionstatus",

      transactionHistory:
        "/transactionhistory",
    },

    purchaseEndpointDocumented:
      true,
  };
}

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getCableProviders,
  verifyCableSmartcard,
  getAllCablePlans,
  getCablePlansByProvider,
  purchaseCable,
  getCableTransactionStatus,
  getCableHistory,
  getCableStatistics,
  normalizeCableProviderForApp,
  normalizeCablePlanForApp,
  getConfigurationStatus,
};