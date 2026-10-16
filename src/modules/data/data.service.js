
/**
 * =========================================================
 * eVAULT DATA SERVICE
 * =========================================================
 *
 * Provider:
 *   NetworkDataSub
 *
 * Customer pricing:
 *   NetworkDataSub provider price + 2%
 *
 * IMPORTANT:
 * - NetworkDataSub token stays on backend.
 * - Frontend price is never trusted.
 * - Provider plan is fetched again before debit.
 * - Wallet is debited using eVault customer price.
 * - Failed provider purchases are refunded.
 *
 * IMPORTANT PIN FIX:
 * verifyTransactionPin() in the existing profile service
 * expects positional arguments:
 *
 *   verifyTransactionPin(userId, transactionPin)
 *
 * NOT:
 *
 *   verifyTransactionPin({ userId, transactionPin })
 * =========================================================
 */

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
  createNotification,
} from "../notification/notification.repository.js";

import {
  verifyTransactionPin,
} from "../profile/profile.service.js";

import {
  getNetworkDataSubPlans,
  purchaseNetworkDataSubData,
} from "./providers/networkdatasub.data.service.js";


/**
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const PROVIDER =
  "NETWORKDATASUB";

const TRANSACTION_PAYMENT =
  "PAYMENT";

const TRANSACTION_REFUND =
  "REFUND";

const STATUS_PENDING =
  "PENDING";

const STATUS_SUCCESS =
  "SUCCESS";

const STATUS_FAILED =
  "FAILED";

const MARKUP_PERCENT =
  Number(
    process.env.EVAULT_DATA_MARKUP_PERCENT || 2
  );


/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

function toNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function roundMoney(value) {
  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) * 100
    ) / 100
  );
}


function normalizePhoneNumber(
  value
) {
  const phone =
    String(value || "")
      .replace(/\D/g, "")
      .trim();

  if (!phone) {
    return "";
  }

  if (
    phone.startsWith("234") &&
    phone.length === 13
  ) {
    return `0${phone.slice(3)}`;
  }

  if (
    phone.length === 10 &&
    phone.startsWith("8")
  ) {
    return `0${phone}`;
  }

  return phone;
}


function normalizeNetwork(
  value
) {
  if (
    value &&
    typeof value === "object"
  ) {
    return normalizeNetwork(
      value.name ??
        value.network ??
        value.network_name ??
        value.networkName ??
        value.code ??
        value.slug ??
        value.label ??
        ""
    );
  }

  const network =
    String(value || "")
      .trim()
      .toUpperCase();

  if (!network) {
    return null;
  }

  if (
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
 * UUID VALIDATION
 * =========================================================
 */

function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}


/**
 * =========================================================
 * PLAN ID
 * =========================================================
 */

function getProviderPlanId(
  plan
) {
  const candidates = [
    plan?.provider_plan_id,
    plan?.plan_id,
    plan?.api_plan_id,
    plan?.data_plan_id,
    plan?.providerPlanId,
    plan?.dataPlanId,
    plan?.planId,
    plan?.id,
  ];

  for (
    const candidate of candidates
  ) {
    const value =
      toNumber(
        candidate
      );

    if (
      value !== null &&
      value > 0
    ) {
      return value;
    }
  }

  return null;
}


/**
 * =========================================================
 * PROVIDER PRICE
 * =========================================================
 */

function getProviderPrice(
  plan
) {
  if (
    !plan ||
    typeof plan !== "object"
  ) {
    return null;
  }

  const candidates = [
    plan.provider_price,
    plan.providerPrice,
    plan.api_price,
    plan.apiPrice,
    plan.cost,
    plan.price,
    plan.amount,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate &&
      typeof candidate === "object"
    ) {
      const nested =
        getProviderPrice(
          candidate
        );

      if (
        nested !== null
      ) {
        return nested;
      }

      continue;
    }

    const number =
      toNumber(
        candidate
      );

    if (
      number !== null &&
      number >= 0
    ) {
      return number;
    }
  }

  return null;
}


/**
 * =========================================================
 * PLAN NETWORK
 * =========================================================
 */

function getPlanNetwork(
  plan
) {
  return normalizeNetwork(
    plan?.network ??
      plan?.network_name ??
      plan?.networkName ??
      plan?.operator ??
      ""
  );
}


/**
 * =========================================================
 * PLAN NAME
 * =========================================================
 */

function getPlanName(
  plan
) {
  const candidates = [
    plan?.plan_name,
    plan?.name,
    plan?.planName,
    plan?.title,
    plan?.description,
    plan?.data_size,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      candidate !== undefined &&
      candidate !== null &&
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
 * CUSTOMER PRICE
 * =========================================================
 */

export function calculateCustomerPrice(
  providerPrice
) {
  const price =
    toNumber(
      providerPrice
    );

  if (
    price === null ||
    price < 0
  ) {
    return null;
  }

  return roundMoney(
    price *
      (
        1 +
        MARKUP_PERCENT / 100
      )
  );
}


/**
 * =========================================================
 * NORMALIZE ONE PLAN
 * =========================================================
 */

export function normalizePlan(
  plan
) {
  const providerPlanId =
    getProviderPlanId(
      plan
    );

  const providerPrice =
    getProviderPrice(
      plan
    );

  if (
    providerPlanId === null ||
    providerPrice === null
  ) {
    return null;
  }

  const customerPrice =
    calculateCustomerPrice(
      providerPrice
    );

  if (
    customerPrice === null
  ) {
    return null;
  }

  return {
    id:
      providerPlanId,

    providerPlanId,

    provider_plan_id:
      providerPlanId,

    dataPlanId:
      providerPlanId,

    data_plan_id:
      providerPlanId,

    planId:
      providerPlanId,

    name:
      getPlanName(
        plan
      ),

    network:
      getPlanNetwork(
        plan
      ),

    data_size:
      plan?.data_size ??
      plan?.dataSize ??
      plan?.size ??
      "",

    validity:
      plan?.validity ??
      plan?.duration ??
      "",

    plan_type:
      plan?.plan_type ??
      plan?.planType ??
      "",

    providerPrice:
      roundMoney(
        providerPrice
      ),

    provider_price:
      roundMoney(
        providerPrice
      ),

    customerPrice,

    price:
      customerPrice,

    amount:
      customerPrice,

    markupPercent:
      MARKUP_PERCENT,

    provider:
      PROVIDER,
  };
}


/**
 * =========================================================
 * NORMALIZE PLANS
 * =========================================================
 */

export function normalizePlans(
  response
) {
  const source =
    Array.isArray(
      response
    )
      ? response
      : Array.isArray(
          response?.plans
        )
      ? response.plans
      : [];

  const normalized =
    source
      .map(
        normalizePlan
      )
      .filter(Boolean);

  console.log(
    "EVAULT NORMALIZED DATA PLANS:",
    {
      providerCount:
        source.length,

      normalizedCount:
        normalized.length,

      sample:
        normalized
          .slice(
            0,
            5
          )
          .map(
            plan => ({
              id:
                plan.id,

              providerPrice:
                plan.providerPrice,

              customerPrice:
                plan.customerPrice,

              network:
                plan.network,

              name:
                plan.name,
            })
          ),
    }
  );

  return normalized;
}


/**
 * =========================================================
 * FILTER BY NETWORK
 * =========================================================
 */

export function filterPlansByNetwork(
  plans,
  network
) {
  const target =
    normalizeNetwork(
      network
    );

  if (!target) {
    return plans;
  }

  return plans.filter(
    plan =>
      normalizeNetwork(
        plan.network
      ) === target
  );
}


/**
 * =========================================================
 * GET DATA PLANS
 * =========================================================
 */

export async function getDataPlans({
  network = null,
} = {}) {
  const providerResponse =
    await getNetworkDataSubPlans();

  const plans =
    normalizePlans(
      providerResponse
    );

  const filtered =
    filterPlansByNetwork(
      plans,
      network
    );

  return {
    success:
      true,

    provider:
      PROVIDER,

    markupPercent:
      MARKUP_PERCENT,

    plans:
      filtered,

    count:
      filtered.length,
  };
}


/**
 * =========================================================
 * FIND CURRENT PLAN
 * =========================================================
 *
 * The provider is queried again immediately before
 * charging the customer.
 * =========================================================
 */

async function getCurrentPlan(
  dataPlanId,
  network
) {
  const requestedId =
    toNumber(
      dataPlanId
    );

  if (
    requestedId === null
  ) {
    const error =
      new Error(
        "Invalid data plan ID."
      );

    error.code =
      "INVALID_DATA_PLAN";

    error.status =
      400;

    throw error;
  }

  const providerResponse =
    await getNetworkDataSubPlans();

  const plans =
    normalizePlans(
      providerResponse
    );

  const matching =
    plans.find(
      plan =>
        Number(
          plan.providerPlanId
        ) ===
        Number(
          requestedId
        )
    );

  if (!matching) {
    const error =
      new Error(
        "The selected data plan is no longer available."
      );

    error.code =
      "DATA_PLAN_NOT_FOUND";

    error.status =
      400;

    throw error;
  }

  if (
    network &&
    normalizeNetwork(
      matching.network
    ) !==
      normalizeNetwork(
        network
      )
  ) {
    const error =
      new Error(
        "The selected data plan does not belong to the selected network."
      );

    error.code =
      "DATA_NETWORK_MISMATCH";

    error.status =
      400;

    throw error;
  }

  return matching;
}


/**
 * =========================================================
 * TRANSACTION REFERENCE
 * =========================================================
 */

function createReference(
  prefix
) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 10)
    .toUpperCase()}`;
}


/**
 * =========================================================
 * PROVIDER RESPONSE HELPERS
 * =========================================================
 */

function getProviderData(
  response
) {
  if (
    response?.data &&
    typeof response.data ===
      "object"
  ) {
    return response.data;
  }

  return response ||
    {};
}


function getProviderReference(
  response
) {
  const data =
    getProviderData(
      response
    );

  return (
    response?.reference ??
    response?.providerReference ??
    response?.transactionReference ??
    data?.reference ??
    data?.providerReference ??
    data?.transaction_id ??
    data?.transactionId ??
    null
  );
}


function getProviderStatus(
  response
) {
  const data =
    getProviderData(
      response
    );

  return String(
    response?.status ??
      data?.status ??
      ""
  )
    .trim()
    .toLowerCase();
}


function providerSucceeded(
  response
) {
  const data =
    getProviderData(
      response
    );

  return (
    response?.success ===
      true ||
    data?.success ===
      true ||
    [
      "success",
      "successful",
      "completed",
      "complete",
    ].includes(
      getProviderStatus(
        response
      )
    )
  );
}


function providerPending(
  response
) {
  return [
    "pending",
    "processing",
  ].includes(
    getProviderStatus(
      response
    )
  );
}


/**
 * =========================================================
 * SAFE NOTIFICATION
 * =========================================================
 */

async function safeCreateNotification({
  userId,
  title,
  message,
  type,
  metadata = {},
}) {
  try {
    await createNotification({
      userId,
      title,
      message,
      type,
      metadata,
    });
  } catch (
    error
  ) {
    console.error(
      "DATA NOTIFICATION ERROR:",
      error?.message ||
        error
    );
  }
}


/**
 * =========================================================
 * BUY DATA
 * =========================================================
 */

export async function buyData({
  userId,
  phoneNumber,
  dataPlanId,
  planId,
  network,
  transactionPin,
}) {
  /**
   * -------------------------------------------------------
   * VALIDATE AUTHENTICATED USER ID
   * -------------------------------------------------------
   */

  if (
    !isValidUuid(
      userId
    )
  ) {
    const error =
      new Error(
        "Invalid authenticated user ID."
      );

    error.code =
      "INVALID_USER_ID";

    error.status =
      401;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * PHONE
   * -------------------------------------------------------
   */

  const normalizedPhone =
    normalizePhoneNumber(
      phoneNumber
    );

  if (
    !/^0[789]\d{9}$/.test(
      normalizedPhone
    )
  ) {
    const error =
      new Error(
        "Enter a valid Nigerian phone number."
      );

    error.code =
      "INVALID_PHONE";

    error.status =
      400;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * PLAN ID
   * -------------------------------------------------------
   */

  const selectedPlanId =
    dataPlanId ??
    planId;

  if (
    selectedPlanId ===
      undefined ||
    selectedPlanId ===
      null ||
    String(
      selectedPlanId
    ).trim() === ""
  ) {
    const error =
      new Error(
        "Data plan ID is required."
      );

    error.code =
      "DATA_PLAN_REQUIRED";

    error.status =
      400;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * PIN
   * -------------------------------------------------------
   */

  if (
    !/^\d{4}$/.test(
      String(
        transactionPin ||
          ""
      )
    )
  ) {
    const error =
      new Error(
        "A valid 4-digit transaction PIN is required."
      );

    error.code =
      "INVALID_TRANSACTION_PIN";

    error.status =
      400;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * VERIFY TRANSACTION PIN
   * -------------------------------------------------------
   *
   * VERY IMPORTANT:
   *
   * Existing profile.service.js expects:
   *
   *   verifyTransactionPin(
   *     userId,
   *     transactionPin
   *   )
   *
   * NOT an object.
   *
   * -------------------------------------------------------
   */

  await verifyTransactionPin(
    userId,
    String(
      transactionPin
    )
  );


  /**
   * -------------------------------------------------------
   * GET CURRENT PROVIDER PLAN
   * -------------------------------------------------------
   */

  const currentPlan =
    await getCurrentPlan(
      selectedPlanId,
      network
    );

  const customerAmount =
    roundMoney(
      currentPlan.customerPrice
    );

  if (
    !Number.isFinite(
      customerAmount
    ) ||
    customerAmount <= 0
  ) {
    const error =
      new Error(
        "The selected data plan has an invalid customer price."
      );

    error.code =
      "INVALID_DATA_PRICE";

    error.status =
      400;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * CREATE PAYMENT + DEBIT WALLET
   * -------------------------------------------------------
   */

  const client =
    await db.connect();

  let wallet;
  let transaction;

  const transactionReference =
    createReference(
      "EVAULT-DATA"
    );

  try {
    await client.query(
      "BEGIN"
    );


    /**
     * Lock wallet.
     */
    wallet =
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

      error.status =
        404;

      throw error;
    }


    /**
     * Available balance.
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
      throw new Error(
        "Unable to read wallet balance."
      );
    }


    /**
     * Balance check.
     */
    if (
      balanceBefore <
      customerAmount
    ) {
      const error =
        new Error(
          `Insufficient wallet balance. Required ₦${customerAmount.toFixed(
            2
          )}. Available ₦${balanceBefore.toFixed(
            2
          )}.`
        );

      error.code =
        "INSUFFICIENT_BALANCE";

      error.status =
        400;

      throw error;
    }


    /**
     * Debit customer price.
     */
    const debitedWallet =
      await debitWallet(
        wallet.id,
        customerAmount,
        client
      );

    if (
      !debitedWallet
    ) {
      throw new Error(
        "Unable to debit wallet."
      );
    }


    /**
     * New balance.
     */
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

          amount:
            customerAmount,

          balanceBefore,

          balanceAfter,

          status:
            STATUS_PENDING,

          description:
            `Data purchase - ${currentPlan.name}`,

          metadata: {
            service:
              "DATA_PURCHASE",

            provider:
              PROVIDER,

            network:
              currentPlan.network,

            phoneNumber:
              normalizedPhone,

            providerPlanId:
              currentPlan.providerPlanId,

            providerPrice:
              currentPlan.providerPrice,

            customerPrice:
              currentPlan.customerPrice,

            markupPercent:
              MARKUP_PERCENT,
          },
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


  /**
   * =======================================================
   * NETWORKDATASUB PURCHASE
   * =======================================================
   */

  let providerResponse;

  try {
    providerResponse =
      await purchaseNetworkDataSubData({
        dataPlanId:
          currentPlan.providerPlanId,

        phoneNumber:
          normalizedPhone,
      });

  } catch (
    providerError
  ) {

    /**
     * Provider call failed.
     * Refund the customer.
     */
    await refundFailedDataPurchase({
      userId,

      transaction,

      reason:
        providerError?.message ||
        "NetworkDataSub request failed.",

      providerResponse:
        providerError?.providerResponse ||
        null,
    });

    throw providerError;
  }


  /**
   * =======================================================
   * PROVIDER SUCCESS
   * =======================================================
   */

  if (
    providerSucceeded(
      providerResponse
    )
  ) {
    const providerReference =
      getProviderReference(
        providerResponse
      );


    /**
     * Mark payment successful.
     */
    await updateTransactionStatus(
      transaction.id,
      STATUS_SUCCESS
    );


    /**
     * Notification.
     */
    await safeCreateNotification({
      userId,

      title:
        "Data Purchase Successful",

      message:
        `Your ${currentPlan.name} data purchase to ${normalizedPhone} was successful.`,

      type:
        "DATA",

      metadata: {
        service:
          "DATA_PURCHASE",

        network:
          currentPlan.network,

        phoneNumber:
          normalizedPhone,

        providerPlanId:
          currentPlan.providerPlanId,

        amount:
          customerAmount,

        transactionReference,

        providerReference,
      },
    });


    return {
      success:
        true,

      status:
        STATUS_SUCCESS,

      message:
        providerResponse?.message ||
        getProviderData(
          providerResponse
        )?.message ||
        "Data purchased successfully.",

      transaction: {
        id:
          transaction.id,

        reference:
          transactionReference,

        status:
          STATUS_SUCCESS,

        amount:
          customerAmount,
      },

      data: {
        network:
          currentPlan.network,

        phoneNumber:
          normalizedPhone,

        planId:
          currentPlan.providerPlanId,

        providerPlanId:
          currentPlan.providerPlanId,

        planName:
          currentPlan.name,

        amount:
          customerAmount,

        providerReference,
      },
    };
  }


  /**
   * =======================================================
   * PROVIDER PENDING
   * =======================================================
   */

  if (
    providerPending(
      providerResponse
    )
  ) {
    return {
      success:
        false,

      status:
        STATUS_PENDING,

      message:
        providerResponse?.message ||
        "Data purchase is being processed.",

      transaction: {
        id:
          transaction.id,

        reference:
          transactionReference,

        status:
          STATUS_PENDING,

        amount:
          customerAmount,
      },

      data: {
        network:
          currentPlan.network,

        phoneNumber:
          normalizedPhone,

        planId:
          currentPlan.providerPlanId,

        providerPlanId:
          currentPlan.providerPlanId,

        planName:
          currentPlan.name,

        amount:
          customerAmount,

        providerReference:
          getProviderReference(
            providerResponse
          ),
      },
    };
  }


  /**
   * =======================================================
   * PROVIDER FAILURE
   * =======================================================
   */

  const failureMessage =
    providerResponse?.message ||
    getProviderData(
      providerResponse
    )?.message ||
    "NetworkDataSub rejected the data purchase.";


  await refundFailedDataPurchase({
    userId,

    transaction,

    reason:
      failureMessage,

    providerResponse,
  });


  const error =
    new Error(
      `${failureMessage} Your eVault wallet has been refunded.`
    );

  error.code =
    "DATA_PROVIDER_FAILED";

  error.status =
    502;

  error.providerResponse =
    providerResponse;

  throw error;
}


/**
 * =========================================================
 * REFUND FAILED PURCHASE
 * =========================================================
 */

async function refundFailedDataPurchase({
  userId,
  transaction,
  reason,
  providerResponse,
}) {
  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN"
    );


    /**
     * The transactions table uses wallet_id.
     */
    const walletId =
      transaction?.wallet_id ??
      transaction?.walletId;


    if (!walletId) {
      throw new Error(
        "Unable to determine wallet for data refund."
      );
    }


    /**
     * Lock wallet again.
     */
    const wallet =
      await findWalletForUpdate(
        walletId,
        client
      );

    if (!wallet) {
      throw new Error(
        "Wallet not found during data refund."
      );
    }


    /**
     * Refund original customer amount.
     */
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
        "Invalid refund amount."
      );
    }


    /**
     * Current balance.
     */
    const balanceBefore =
      Number(
        wallet.available_balance
      );


    /**
     * Credit wallet.
     */
    const refundedWallet =
      await creditWallet(
        wallet.id,
        refundAmount,
        client
      );

    if (
      !refundedWallet
    ) {
      throw new Error(
        "Unable to credit wallet for data refund."
      );
    }


    /**
     * New balance.
     */
    const balanceAfter =
      Number(
        refundedWallet.available_balance
      );


    /**
     * Refund reference.
     */
    const refundReference =
      createReference(
        "EVAULT-DATA-REFUND"
      );


    /**
     * REFUND transaction.
     */
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
          "Refund for failed data purchase",

        metadata: {
          service:
            "DATA_PURCHASE",

          provider:
            PROVIDER,

          originalTransactionReference:
            transaction.reference,

          reason:
            String(
              reason ||
                "Data purchase failed."
            ).slice(
              0,
              1000
            ),

          providerResponse:
            providerResponse ||
            null,
        },
      },
      client
    );


    /**
     * Mark original PAYMENT failed.
     */
    await updateTransactionStatus(
      transaction.id,
      STATUS_FAILED
    );


    await client.query(
      "COMMIT"
    );


    /**
     * Refund notification.
     */
    await safeCreateNotification({
      userId,

      title:
        "Data Purchase Refunded",

      message:
        `Your data purchase failed. ₦${refundAmount.toFixed(
          2
        )} has been refunded to your eVault wallet.`,

      type:
        "DATA",

      metadata: {
        service:
          "DATA_PURCHASE",

        transactionReference:
          transaction.reference,

        refundReference,

        refundAmount,

        reason:
          String(
            reason ||
              "Data purchase failed."
          ).slice(
            0,
            1000
          ),
      },
    });


    return {
      refunded:
        true,

      refundReference,

      refundAmount,
    };

  } catch (
    error
  ) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "DATA REFUND ERROR:",
      error
    );

    throw new Error(
      "Data purchase failed and the automatic refund could not be completed."
    );

  } finally {
    client.release();
  }
}


/**
 * =========================================================
 * COMPATIBILITY ALIAS
 * =========================================================
 */

export async function purchaseData(
  params
) {
  return buyData(
    params
  );
}


/**
 * =========================================================
 * EXPORTS
 * =========================================================
 */

export {
  normalizePhoneNumber,
  normalizeNetwork,
};
