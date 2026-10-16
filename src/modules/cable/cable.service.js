/**
 * =========================================================
 * eVAULT CABLE TV SERVICE
 * =========================================================
 *
 * VTUGATE-backed Cable TV flow:
 *
 * PROVIDER READS
 * - providers come from VTUGATE services
 * - plans come from Verify Cable TV response
 *
 * PURCHASE
 * 1. validate request
 * 2. verify transaction PIN
 * 3. lock wallet
 * 4. debit wallet
 * 5. create PAYMENT transaction PENDING
 * 6. commit
 * 7. call VTUGATE buycabletv
 * 8. success -> PAYMENT SUCCESS
 * 9. failure -> PAYMENT FAILED + wallet REFUND
 *
 * IMPORTANT:
 * - Never call VTUGATE while PostgreSQL wallet transaction is open.
 * - Refund only the amount actually deducted from the eVault wallet.
 * - VTUGATE provider credentials remain server-side.
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
} from "../transactions/transaction.repository.js";

import {
  verifyTransactionPin,
} from "../profile/profile.service.js";

import {
  getCableProviders,
  getAllCablePlans,
  getCablePlansByProvider,
  verifyCableSmartcard,
  purchaseCable as purchaseCableProvider,
  getCableTransactionStatus,
  getCableHistory,
  getCableStatistics,
} from "./providers/networkdatasub/networkdatasub.cable.client.js";

const PAYMENT =
  "PAYMENT";

const REFUND =
  "REFUND";

const PENDING =
  "PENDING";

const SUCCESS =
  "SUCCESS";

const FAILED =
  "FAILED";

/**
 * =========================================================
 * REFERENCE
 * =========================================================
 */

function createReference() {
  return `CAB-${Date.now()}-${crypto
    .randomUUID()
    .replace(/-/g, "")
    .slice(0, 20)
    .toUpperCase()}`;
}

/**
 * =========================================================
 * BASIC HELPERS
 * =========================================================
 */

function normalizeString(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizePhone(
  value
) {
  return normalizeString(
    value
  ).replace(
    /\s+/g,
    ""
  );
}

function normalizeSmartcard(
  value
) {
  return normalizeString(
    value
  ).replace(
    /\D/g,
    ""
  );
}

function toNumber(
  value
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

/**
 * =========================================================
 * PURCHASE INPUT HELPERS
 * =========================================================
 */

function pickServiceId(
  input
) {
  return toNumber(
    input?.serviceId ??
      input?.service_id ??
      input?.providerId ??
      input?.provider_id
  );
}

function pickPlanCode(
  input
) {
  return normalizeString(
    input?.planCode ??
      input?.plan_code ??
      input?.plan?.code ??
      input?.plan?.plan_code ??
      input?.plan?.planCode
  );
}

function pickPlanName(
  input
) {
  return normalizeString(
    input?.planName ??
      input?.plan_name ??
      input?.plan?.name ??
      input?.plan?.plan_name ??
      input?.plan?.planName
  );
}

function pickAmount(
  input
) {
  return toNumber(
    input?.amount ??
      input?.plan?.amount ??
      input?.plan?.price
  );
}

/**
 * =========================================================
 * VALIDATE PURCHASE INPUT
 * =========================================================
 */

function validatePurchaseInput(
  input
) {
  const serviceId =
    pickServiceId(input);

  const phone =
    normalizePhone(
      input?.phone
    );

  const smartcardNumber =
    normalizeSmartcard(
      input?.smartCardNumber ??
        input?.smartcardNumber ??
        input?.smartcard_number
    );

  const amount =
    pickAmount(input);

  const planCode =
    pickPlanCode(input);

  const planName =
    pickPlanName(input);

  if (
    !Number.isInteger(
      serviceId
    ) ||
    serviceId <= 0
  ) {
    const error =
      new Error(
        "A valid cable service ID is required."
      );

    error.code =
      "INVALID_CABLE_SERVICE_ID";

    error.status =
      400;

    throw error;
  }

  if (
    !/^0\d{10}$/.test(
      phone
    )
  ) {
    const error =
      new Error(
        "A valid Nigerian phone number is required."
      );

    error.code =
      "INVALID_CABLE_PHONE";

    error.status =
      400;

    throw error;
  }

  if (
    !smartcardNumber
  ) {
    const error =
      new Error(
        "Smartcard number is required."
      );

    error.code =
      "SMARTCARD_NUMBER_REQUIRED";

    error.status =
      400;

    throw error;
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    const error =
      new Error(
        "A valid cable plan amount is required."
      );

    error.code =
      "INVALID_CABLE_AMOUNT";

    error.status =
      400;

    throw error;
  }

  if (
    !planCode ||
    !planName
  ) {
    const error =
      new Error(
        "Cable plan code and plan name are required."
      );

    error.code =
      "CABLE_PLAN_REQUIRED";

    error.status =
      400;

    throw error;
  }

  return {
    serviceId,
    phone,
    smartcardNumber,
    amount,
    planCode,
    planName,
  };
}

/**
 * =========================================================
 * REFUND CABLE PURCHASE
 * =========================================================
 */

async function refundCablePurchase({
  userId,
  walletId,
  reference,
  amount,
  providerResponse,
  reason,
}) {
  const refundClient =
    await db.connect();

  try {
    await refundClient.query(
      "BEGIN"
    );

    const wallet =
      await findWalletForUpdate(
        walletId,
        refundClient
      );

    if (!wallet) {
      throw new Error(
        "Wallet not found while refunding Cable TV purchase."
      );
    }

    const existingRefund =
      await refundClient.query(
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
          REFUND,
          reference,
        ]
      );

    if (
      existingRefund.rows.length >
      0
    ) {
      await refundClient.query(
        "COMMIT"
      );

      return {
        alreadyRefunded:
          true,

        refundTransaction:
          existingRefund.rows[0],
      };
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
      throw new Error(
        "Invalid wallet balance during Cable TV refund."
      );
    }

    const refundAmount =
      Number(amount);

    if (
      !Number.isFinite(
        refundAmount
      ) ||
      refundAmount <= 0
    ) {
      throw new Error(
        "Invalid Cable TV refund amount."
      );
    }

    const refundedWallet =
      await creditWallet(
        wallet.id,
        refundAmount,
        refundClient
      );

    if (!refundedWallet) {
      throw new Error(
        "Cable TV failed and wallet refund could not be completed."
      );
    }

    const balanceAfter =
      Number(
        refundedWallet
          .available_balance
      );

    await updateTransactionStatus(
      reference,
      FAILED,
      refundClient
    );

    const refundTransaction =
      await createTransaction(
        {
          userId,

          walletId:
            wallet.id,

          reference:
            `${reference}-REFUND`,

          type:
            REFUND,

          amount:
            refundAmount,

          balanceBefore,

          balanceAfter,

          status:
            SUCCESS,

          description:
            "Cable TV purchase refund",

          metadata: {
            service:
              "CABLE_TV",

            provider:
              "VTUGATE",

            originalReference:
              reference,

            reason:
              reason ||
              "VTUGATE Cable TV purchase failed",

            providerResponse:
              providerResponse ??
              null,
          },
        },
        refundClient
      );

    await refundClient.query(
      "COMMIT"
    );

    return {
      alreadyRefunded:
        false,

      refundTransaction,

      refundAmount,

      balanceBefore,

      balanceAfter,
    };
  } catch (error) {
    try {
      await refundClient.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "CABLE REFUND ERROR:",
      error
    );

    throw new Error(
      "Cable TV purchase failed and the automatic refund could not be completed. Manual reconciliation is required."
    );
  } finally {
    refundClient.release();
  }
}

/**
 * =========================================================
 * PROVIDERS
 * =========================================================
 */

export async function getProviders() {
  return getCableProviders();
}

export async function getCableProvidersService() {
  return getCableProviders();
}

/**
 * =========================================================
 * PLANS
 * =========================================================
 */

export async function getPlans() {
  return getAllCablePlans();
}

export async function getPlansByProvider(
  providerId
) {
  return getCablePlansByProvider(
    providerId
  );
}

/**
 * =========================================================
 * VERIFY SMARTCARD
 * =========================================================
 */

export async function verifySmartcard({
  providerId,
  serviceId,
  phone,
  smartCardNumber,
  smartcardNumber,
}) {
  return verifyCableSmartcard({
    providerId,

    serviceId,

    phone,

    smartCardNumber,

    smartcardNumber,
  });
}

/**
 * =========================================================
 * PURCHASE CABLE
 * =========================================================
 */

export async function purchaseCable({
  userId,

  transactionPin,

  serviceId,

  service_id,

  providerId,

  provider_id,

  phone,

  smartCardNumber,

  smartcardNumber,

  smartcard_number,

  amount,

  planCode,

  plan_code,

  planName,

  plan_name,
}) {
  const effectiveUserId =
    userId;

  if (
    !effectiveUserId
  ) {
    const error =
      new Error(
        "Authenticated user ID is required."
      );

    error.code =
      "USER_ID_REQUIRED";

    error.status =
      401;

    throw error;
  }

  if (
    !transactionPin
  ) {
    const error =
      new Error(
        "Transaction PIN is required."
      );

    error.code =
      "TRANSACTION_PIN_REQUIRED";

    error.status =
      400;

    throw error;
  }

  /**
   * -------------------------------------------------------
   * VERIFY PIN
   * -------------------------------------------------------
   */

  await verifyTransactionPin(
    effectiveUserId,
    transactionPin
  );

  /**
   * -------------------------------------------------------
   * VALIDATE INPUT
   * -------------------------------------------------------
   */

  const validated =
    validatePurchaseInput({
      serviceId:
        serviceId ??
        service_id ??
        providerId ??
        provider_id,

      phone,

      smartCardNumber:
        smartCardNumber ??
        smartcardNumber ??
        smartcard_number,

      amount,

      planCode:
        planCode ??
        plan_code,

      planName:
        planName ??
        plan_name,
    });

  const reference =
    createReference();

  let wallet;
  let paymentTransaction;
  let balanceBefore;
  let balanceAfter;

  /**
   * -------------------------------------------------------
   * WALLET DEBIT TRANSACTION
   * -------------------------------------------------------
   */

  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN"
    );

    wallet =
      await findWalletForUpdateByUserId(
        effectiveUserId,
        client
      );

    if (!wallet) {
      throw new Error(
        "Wallet not found."
      );
    }

    if (
      wallet.status !==
      "ACTIVE"
    ) {
      throw new Error(
        "Wallet is not active."
      );
    }

    balanceBefore =
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

    if (
      balanceBefore <
      validated.amount
    ) {
      const error =
        new Error(
          `Insufficient wallet balance. Required ₦${validated.amount.toFixed(
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

    const debitedWallet =
      await debitWallet(
        wallet.id,
        validated.amount,
        client
      );

    if (!debitedWallet) {
      throw new Error(
        "Unable to debit wallet."
      );
    }

    balanceAfter =
      Number(
        debitedWallet
          .available_balance
      );

    /**
     * -----------------------------------------------------
     * PAYMENT TRANSACTION
     * -----------------------------------------------------
     */

    paymentTransaction =
      await createTransaction(
        {
          userId:
            effectiveUserId,

          walletId:
            wallet.id,

          reference,

          type:
            PAYMENT,

          amount:
            validated.amount,

          balanceBefore,

          balanceAfter,

          status:
            PENDING,

          description:
            `Cable TV purchase - ${validated.planName}`,

          metadata: {
            service:
              "CABLE_TV",

            provider:
              "VTUGATE",

            serviceId:
              validated.serviceId,

            phone:
              validated.phone,

            smartcardNumber:
              validated.smartcardNumber,

            planCode:
              validated.planCode,

            planName:
              validated.planName,

            requestedAmount:
              validated.amount,
          },
        },
        client
      );

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
   * =======================================================
   * VTUGATE PURCHASE
   * =======================================================
   */

  let providerResult;

  try {
    providerResult =
      await purchaseCableProvider(
        {
          serviceId:
            validated.serviceId,

          phone:
            validated.phone,

          smartCardNumber:
            validated.smartcardNumber,

          amount:
            validated.amount,

          planCode:
            validated.planCode,

          planName:
            validated.planName,
        }
      );
  } catch (providerError) {
    const providerResponse =
      providerError?.providerResponse ??
      providerError?.response?.data ??
      {
        message:
          providerError?.message ??
          "VTUGATE Cable TV purchase failed.",
      };

    const refund =
      await refundCablePurchase(
        {
          userId:
            effectiveUserId,

          walletId:
            wallet.id,

          reference,

          amount:
            validated.amount,

          providerResponse,

          reason:
            providerError?.message ??
            "VTUGATE Cable TV purchase failed",
        }
      );

    throw Object.assign(
      new Error(
        "Cable TV purchase failed. Your wallet has been refunded."
      ),
      {
        code:
          "CABLE_PURCHASE_REFUNDED",

        status:
          400,

        providerResponse,

        refund,

        reference,
      }
    );
  }

  /**
   * =======================================================
   * SUCCESS
   * =======================================================
   */

  const providerData =
    providerResult?.data ??
    {};

  const providerAmount =
    Number(
      providerResult?.amount ??
        providerData?.amount ??
        validated.amount
    );

  let completedTransaction;

  try {
    completedTransaction =
      await updateTransactionStatus(
        reference,
        SUCCESS
      );
  } catch (error) {
    console.error(
      "CABLE SUCCESS TRANSACTION UPDATE WARNING:",
      error
    );

    /**
     * IMPORTANT:
     *
     * VTUGATE already confirmed
     * the external purchase.
     *
     * Do NOT automatically
     * refund here.
     */
    completedTransaction =
      null;
  }

  return {
    success:
      true,

    message:
      "Cable TV purchase successful.",

    reference,

    amount:
      validated.amount,

    deductedAmount:
      validated.amount,

    providerAmount,

    phone:
      validated.phone,

    smartcardNumber:
      validated.smartcardNumber,

    serviceId:
      validated.serviceId,

    planCode:
      validated.planCode,

    planName:
      providerResult?.planName ||
      validated.planName,

    provider:
      providerData,

    transaction:
      completedTransaction,
  };
}

/**
 * =========================================================
 * TRANSACTION STATUS
 * =========================================================
 */

export async function getCableTransactionStatusService(
  input
) {
  return getCableTransactionStatus(
    input
  );
}

/**
 * =========================================================
 * HISTORY
 * =========================================================
 */

export async function getHistory(
  params = {}
) {
  return getCableHistory(
    params
  );
}

/**
 * =========================================================
 * STATISTICS
 * =========================================================
 */

export async function getStatistics() {
  return getCableStatistics();
}

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getProviders,

  getCableProvidersService,

  getPlans,

  getPlansByProvider,

  verifySmartcard,

  purchaseCable,

  getCableTransactionStatusService,

  getHistory,

  getStatistics,
};