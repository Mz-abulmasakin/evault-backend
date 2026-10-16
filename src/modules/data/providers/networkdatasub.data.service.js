
/**
 * =========================================================
 * NETWORKDATASUB DATA API CLIENT
 * =========================================================
 *
 * Server-side only.
 *
 * Official API base:
 *   https://networkdatasub.com/api
 *
 * Authentication:
 *   Authorization: Token YOUR_API_TOKEN
 *
 * IMPORTANT:
 * - NetworkDataSub token NEVER goes to Expo.
 * - This file handles provider communication only.
 * - eVault's 2% markup is handled in data.service.js.
 * =========================================================
 */

const RAW_API_URL =
  process.env.NETWORKDATASUB_API_URL ||
  "https://networkdatasub.com/api";

/**
 * Normalize the configured URL.
 *
 * This also protects against an old .env value such as:
 *
 *   https://www.networkdatasub.com/api
 *
 * by converting it to the official host.
 */
const API_URL =
  RAW_API_URL
    .replace(
      "https://www.networkdatasub.com",
      "https://networkdatasub.com"
    )
    .replace(
      "http://www.networkdatasub.com",
      "https://networkdatasub.com"
    )
    .replace(
      "http://networkdatasub.com",
      "https://networkdatasub.com"
    );

const API_TOKEN =
  process.env.NETWORKDATASUB_API_TOKEN;

const TIMEOUT_MS =
  Number(
    process.env.NETWORKDATASUB_TIMEOUT_MS ||
      30000
  );

const MAX_RETRIES = 3;


/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}


function toNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


/**
 * =========================================================
 * NORMALIZE NETWORK
 * =========================================================
 */

function normalizeNetwork(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  /**
   * NetworkDataSub can return a network object.
   *
   * Example:
   *
   * {
   *   id: 1,
   *   name: "MTN",
   *   code: "mtn"
   * }
   */
  if (
    isObject(value)
  ) {
    const candidates = [
      value.name,
      value.network,
      value.network_name,
      value.networkName,
      value.code,
      value.slug,
      value.label,
      value.title,
      value.operator,
    ];

    for (
      const candidate of candidates
    ) {
      const normalized =
        normalizeNetwork(
          candidate
        );

      if (
        normalized
      ) {
        return normalized;
      }
    }

    return null;
  }

  const network =
    String(value)
      .trim()
      .toUpperCase();

  if (!network) {
    return null;
  }

  if (
    network === "9 MOBILE" ||
    network === "9 MOBILE NG" ||
    network === "9MOBILE NG" ||
    network === "ETISALAT" ||
    network.includes("9MOBILE") ||
    network.includes("9 MOBILE")
  ) {
    return "9MOBILE";
  }

  if (
    network.includes("AIRTEL")
  ) {
    return "AIRTEL";
  }

  if (
    network.includes("GLO")
  ) {
    return "GLO";
  }

  if (
    network.includes("MTN")
  ) {
    return "MTN";
  }

  return network;
}


/**
 * =========================================================
 * NETWORK FROM OBJECT KEY
 * =========================================================
 */

function networkFromKey(key) {
  const normalized =
    normalizeNetwork(
      key
    );

  if (
    normalized === "MTN" ||
    normalized === "AIRTEL" ||
    normalized === "GLO" ||
    normalized === "9MOBILE"
  ) {
    return normalized;
  }

  return null;
}


/**
 * =========================================================
 * EXTRACT PRICE
 * =========================================================
 *
 * Your actual response contains:
 *
 *   price: [Object]
 *
 * We therefore inspect nested price structures.
 * =========================================================
 */

function extractPrice(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  /**
   * Direct number/string-number.
   */
  const direct =
    toNumber(value);

  if (
    direct !== null
  ) {
    return direct;
  }

  /**
   * Nested object.
   */
  if (
    isObject(value)
  ) {
    const preferredKeys = [
      "api_price",
      "apiPrice",

      "provider_price",
      "providerPrice",

      "cost",

      "amount",

      "value",

      "price",

      "selling_price",
      "sellingPrice",

      "customer_price",
      "customerPrice",
    ];

    for (
      const key of preferredKeys
    ) {
      if (
        value[key] !==
        undefined
      ) {
        const result =
          extractPrice(
            value[key]
          );

        if (
          result !== null
        ) {
          return result;
        }
      }
    }

    /**
     * Generic nested scan.
     */
    for (
      const [
        key,
        child,
      ] of Object.entries(
        value
      )
    ) {
      const lowerKey =
        String(key)
          .toLowerCase();

      const looksLikePriceField =
        lowerKey.includes(
          "price"
        ) ||
        lowerKey.includes(
          "amount"
        ) ||
        lowerKey.includes(
          "cost"
        ) ||
        lowerKey ===
          "value";

      if (
        looksLikePriceField
      ) {
        const result =
          extractPrice(
            child
          );

        if (
          result !== null
        ) {
          return result;
        }
      }
    }
  }

  return null;
}


/**
 * =========================================================
 * EXTRACT VALIDITY
 * =========================================================
 */

function extractValidity(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    return String(
      value
    ).trim();
  }

  if (
    isObject(value)
  ) {
    const candidates = [
      value.name,
      value.label,
      value.description,
      value.duration,
      value.validity,
      value.value,
      value.days,
    ];

    for (
      const candidate of candidates
    ) {
      if (
        candidate !==
          undefined &&
        candidate !==
          null &&
        String(candidate).trim()
      ) {
        return String(
          candidate
        ).trim();
      }
    }
  }

  return "";
}


/**
 * =========================================================
 * EXTRACT PLAN TYPE
 * =========================================================
 */

function extractPlanType(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number"
  ) {
    return String(
      value
    ).trim();
  }

  if (
    isObject(value)
  ) {
    const candidates = [
      value.name,
      value.type,
      value.code,
      value.slug,
      value.label,
      value.title,
    ];

    for (
      const candidate of candidates
    ) {
      if (
        candidate !==
          undefined &&
        candidate !==
          null &&
        String(candidate).trim()
      ) {
        return String(
          candidate
        ).trim();
      }
    }
  }

  return "";
}


/**
 * =========================================================
 * EXTRACT PLAN NAME
 * ========================================================= */

function extractPlanName(
  plan
) {
  const candidates = [
    plan?.plan_name,
    plan?.name,
    plan?.planName,
    plan?.title,
    plan?.description,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate !==
        undefined &&
      candidate !==
        null &&
      String(candidate).trim()
    ) {
      return String(
        candidate
      ).trim();
    }
  }

  return "Data Plan";
}


/**
 * =========================================================
 * EXTRACT PLAN SIZE
 * ========================================================= */

function extractPlanSize(
  plan
) {
  const candidates = [
    plan?.data_size,
    plan?.dataSize,
    plan?.size,
    plan?.volume,
    plan?.data,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate !==
        undefined &&
      candidate !==
        null &&
      String(candidate).trim()
    ) {
      return String(
        candidate
      ).trim();
    }
  }

  return "";
}


/**
 * =========================================================
 * NORMALIZE RAW PLAN
 * ========================================================= */

function normalizeRawPlan(
  plan,
  inheritedNetwork = null
) {
  if (
    !isObject(plan)
  ) {
    return null;
  }

  /**
   * -------------------------------------------------------
   * NETWORK
   * -------------------------------------------------------
   */

  const network =
    normalizeNetwork(
      plan.network
    ) ||
    inheritedNetwork ||
    null;


  /**
   * -------------------------------------------------------
   * PROVIDER PLAN ID
   * -------------------------------------------------------
   *
   * NetworkDataSub response currently shows:
   *
   *   plan_id: '240'
   *
   * That is the ID used for purchase.
   * -------------------------------------------------------
   */

  const providerPlanId =
    plan.plan_id ??
    plan.api_plan_id ??
    plan.apiPlanId ??
    plan.data_plan_id ??
    plan.dataPlanId ??
    plan.id ??
    null;

  if (
    providerPlanId ===
      null ||
    providerPlanId ===
      undefined
  ) {
    return null;
  }


  /**
   * -------------------------------------------------------
   * PROVIDER PRICE
   * -------------------------------------------------------
   */

  const providerPrice =
    extractPrice(
      plan.price ??
        plan.amount ??
        plan.api_price ??
        plan.provider_price
    );

  if (
    providerPrice === null
  ) {
    return null;
  }


  /**
   * -------------------------------------------------------
   * NORMALIZED PLAN
   * -------------------------------------------------------
   */

  return {
    /**
     * Preserve original provider data.
     */
    ...plan,

    /**
     * Canonical provider plan ID.
     */
    plan_id:
      providerPlanId,

    provider_plan_id:
      providerPlanId,

    data_plan_id:
      providerPlanId,

    api_plan_id:
      providerPlanId,

    /**
     * Canonical network.
     */
    network,

    /**
     * Canonical name.
     */
    plan_name:
      extractPlanName(
        plan
      ),

    /**
     * Canonical size.
     */
    data_size:
      extractPlanSize(
        plan
      ),

    /**
     * Canonical provider price.
     */
    price:
      providerPrice,

    provider_price:
      providerPrice,

    api_price:
      providerPrice,

    /**
     * Canonical validity/type.
     */
    validity:
      extractValidity(
        plan.validity
      ),

    plan_type:
      extractPlanType(
        plan.type
      ),
  };
}


/**
 * =========================================================
 * PLAN DETECTOR
 * ========================================================= */

function looksLikePlan(
  value
) {
  if (
    !isObject(value)
  ) {
    return false;
  }

  const hasPlanId =
    value.id !==
      undefined ||
    value.plan_id !==
      undefined ||
    value.api_plan_id !==
      undefined ||
    value.data_plan_id !==
      undefined ||
    value.planId !==
      undefined;

  const hasPrice =
    value.price !==
      undefined ||
    value.amount !==
      undefined ||
    value.api_price !==
      undefined ||
    value.provider_price !==
      undefined;

  return (
    hasPlanId &&
    hasPrice
  );
}


/**
 * =========================================================
 * COLLECT RAW PLANS
 * ========================================================= */

function collectPlans(
  value,
  inheritedNetwork = null,
  output = []
) {
  if (
    value === null ||
    value === undefined
  ) {
    return output;
  }

  /**
   * -------------------------------------------------------
   * ARRAY
   * -------------------------------------------------------
   */

  if (
    Array.isArray(value)
  ) {
    for (
      const item of value
    ) {
      collectPlans(
        item,
        inheritedNetwork,
        output
      );
    }

    return output;
  }


  /**
   * -------------------------------------------------------
   * NON OBJECT
   * -------------------------------------------------------
   */

  if (
    !isObject(value)
  ) {
    return output;
  }


  /**
   * -------------------------------------------------------
   * PLAN
   * -------------------------------------------------------
   */

  if (
    looksLikePlan(
      value
    )
  ) {
    const normalized =
      normalizeRawPlan(
        value,
        inheritedNetwork
      );

    if (
      normalized
    ) {
      output.push(
        normalized
      );
    }

    return output;
  }


  /**
   * -------------------------------------------------------
   * NESTED OBJECT
   * -------------------------------------------------------
   */

  for (
    const [
      key,
      child,
    ] of Object.entries(
      value
    )
  ) {
    const childNetwork =
      networkFromKey(
        key
      ) ||
      inheritedNetwork;

    collectPlans(
      child,
      childNetwork,
      output
    );
  }

  return output;
}


/**
 * =========================================================
 * EXTRACT PLANS
 * ========================================================= */

function extractPlans(
  payload
) {
  const source =
    payload &&
    typeof payload ===
      "object" &&
    payload.data !==
      undefined
      ? payload.data
      : payload;

  const plans =
    collectPlans(
      source
    );


  /**
   * -------------------------------------------------------
   * REMOVE DUPLICATES
   * -------------------------------------------------------
   */

  const unique =
    new Map();

  for (
    const plan of plans
  ) {
    const providerId =
      plan?.provider_plan_id ??
      plan?.plan_id ??
      plan?.api_plan_id ??
      plan?.data_plan_id;

    if (
      providerId ===
        undefined ||
      providerId ===
        null
    ) {
      continue;
    }

    const key =
      String(
        providerId
      );

    if (
      !unique.has(key)
    ) {
      unique.set(
        key,
        plan
      );
    }
  }

  return Array.from(
    unique.values()
  );
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
    query = null,
    body = null,
  } = {}
) {
  if (!API_TOKEN) {
    throw new Error(
      "NETWORKDATASUB_API_TOKEN is not configured."
    );
  }

  let url =
    `${API_URL}${path}`;


  /**
   * -------------------------------------------------------
   * QUERY PARAMETERS
   * -------------------------------------------------------
   */

  if (
    query &&
    typeof query ===
      "object"
  ) {
    const params =
      new URLSearchParams();

    for (
      const [
        key,
        value,
      ] of Object.entries(
        query
      )
    ) {
      if (
        value !==
          undefined &&
        value !==
          null &&
        value !==
          ""
      ) {
        params.append(
          key,
          String(value)
        );
      }
    }

    const queryString =
      params.toString();

    if (
      queryString
    ) {
      url +=
        `?${queryString}`;
    }
  }


  console.log(
    "NETWORKDATASUB DATA REQUEST:",
    {
      method,
      path,
      url,
    }
  );


  /**
   * -------------------------------------------------------
   * RETRY LOOP
   * -------------------------------------------------------
   *
   * Handles transient:
   *
   * - ECONNRESET
   * - ETIMEDOUT
   * - connection timeout
   * - AbortError
   * -------------------------------------------------------
   */

  let lastError = null;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () => {
          controller.abort();
        },
        TIMEOUT_MS
      );

    try {
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

              "User-Agent":
                "eVault/1.0",
            },

            ...(body !== null
              ? {
                  body:
                    JSON.stringify(
                      body
                    ),
                }
              : {}),

            signal:
              controller.signal,
          }
        );


      const text =
        await response.text();

      let payload;

      try {
        payload =
          text
            ? JSON.parse(
                text
              )
            : null;
      } catch {
        payload =
          text;
      }


      console.log(
        "NETWORKDATASUB DATA RESPONSE:",
        {
          method,
          path,

          attempt,

          status:
            response.status,

          ok:
            response.ok,

          success:
            payload?.success,

          message:
            payload?.message,

          dataType:
            Array.isArray(
              payload?.data
            )
              ? "array"
              : typeof payload?.data,

          dataKeys:
            payload?.data &&
            typeof payload.data ===
              "object" &&
            !Array.isArray(
              payload.data
            )
              ? Object.keys(
                  payload.data
                )
              : [],

          rootKeys:
            payload &&
            typeof payload ===
              "object"
              ? Object.keys(
                  payload
                )
              : [],
        }
      );


      /**
       * -----------------------------------------------------
       * HTTP ERROR
       * -----------------------------------------------------
       */

      if (
        !response.ok
      ) {
        const error =
          new Error(
            payload?.message ||
              `NetworkDataSub request failed with status ${response.status}.`
          );

        error.status =
          response.status;

        error.providerResponse =
          payload;

        throw error;
      }


      /**
       * -----------------------------------------------------
       * API BUSINESS ERROR
       * -----------------------------------------------------
       */

      if (
        payload?.success ===
        false
      ) {
        const error =
          new Error(
            payload?.message ||
              "NetworkDataSub returned an unsuccessful response."
          );

        error.providerResponse =
          payload;

        throw error;
      }


      /**
       * SUCCESS
       */
      return payload;

    } catch (
      error
    ) {
      lastError =
        error;


      const retryable =
        error?.code ===
          "ECONNRESET" ||

        error?.cause?.code ===
          "ECONNRESET" ||

        error?.code ===
          "ETIMEDOUT" ||

        error?.cause?.code ===
          "ETIMEDOUT" ||

        error?.cause?.code ===
          "UND_ERR_CONNECT_TIMEOUT" ||

        error?.name ===
          "AbortError";


      console.error(
        "NETWORKDATASUB REQUEST ERROR:",
        {
          method,
          path,

          attempt,

          code:
            error?.code,

          causeCode:
            error?.cause?.code,

          message:
            error?.message,

          retryable,
        }
      );


      /**
       * Don't retry normal API/application errors.
       */
      if (
        !retryable ||
        attempt >=
          MAX_RETRIES
      ) {
        throw error;
      }


      /**
       * Wait:
       *
       * 1 sec
       * 2 sec
       *
       * before next attempts.
       */
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            attempt *
              1000
          )
      );

    } finally {
      clearTimeout(
        timeout
      );
    }
  }


  throw (
    lastError ||
    new Error(
      "NetworkDataSub request failed."
    )
  );
}


/**
 * =========================================================
 * GET ALL DATA PLANS
 * =========================================================
 */

export async function getNetworkDataSubPlans() {
  const response =
    await request(
      "GET",
      "/data/all-plans"
    );

  const plans =
    extractPlans(
      response
    );


  console.log(
    "NETWORKDATASUB EXTRACTED DATA PLANS:",
    {
      count:
        plans.length,

      sample:
        plans
          .slice(
            0,
            5
          )
          .map(
            plan => ({
              providerPlanId:
                plan.provider_plan_id,

              network:
                plan.network,

              name:
                plan.plan_name,

              dataSize:
                plan.data_size,

              providerPrice:
                plan.provider_price,

              validity:
                plan.validity,

              planType:
                plan.plan_type,
            })
          ),
    }
  );


  return {
    success:
      response?.success !==
      false,

    message:
      response?.message ||
      "Data plans retrieved successfully.",

    plans,

    raw:
      response,
  };
}


/**
 * =========================================================
 * GET PLANS BY NETWORK ID
 * =========================================================
 */

export async function getNetworkDataSubPlansByNetwork(
  networkId
) {
  const response =
    await request(
      "GET",
      "/data/plans",
      {
        query: {
          network_id:
            networkId,
        },
      }
    );

  const plans =
    extractPlans(
      response
    );

  return {
    success:
      response?.success !==
      false,

    message:
      response?.message ||
      "Data plans retrieved successfully.",

    plans,

    raw:
      response,
  };
}


/**
 * =========================================================
 * PURCHASE DATA
 * =========================================================
 *
 * POST:
 *
 * /api/data/purchase
 *
 * Body:
 *
 * {
 *   data_plan_id: 7,
 *   phone_number: "08012345678"
 * }
 * =========================================================
 */

export async function purchaseNetworkDataSubData({
  dataPlanId,
  phoneNumber,
}) {
  const numericPlanId =
    Number(
      dataPlanId
    );

  const normalizedPhone =
    String(
      phoneNumber || ""
    ).trim();


  if (
    !Number.isInteger(
      numericPlanId
    ) ||
    numericPlanId <= 0
  ) {
    const error =
      new Error(
        "Invalid NetworkDataSub data plan ID."
      );

    error.code =
      "INVALID_PROVIDER_PLAN_ID";

    throw error;
  }


  if (
    !normalizedPhone
  ) {
    const error =
      new Error(
        "Phone number is required for data purchase."
      );

    error.code =
      "INVALID_PHONE";

    throw error;
  }


  return request(
    "POST",
    "/data/purchase",
    {
      body: {
        data_plan_id:
          numericPlanId,

        phone_number:
          normalizedPhone,
      },
    }
  );
}


/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getNetworkDataSubPlans,

  getNetworkDataSubPlansByNetwork,

  purchaseNetworkDataSubData,
};
