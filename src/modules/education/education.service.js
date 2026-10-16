/**
 * =========================================================
 * eVAULT EDUCATION / EXAMINATION RESULT PIN SERVICE
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
  verifyTransactionPin,
} from "../profile/profile.service.js";

import {
  createNotification,
} from "../notification/notification.repository.js";

import {
  getEducationServices,
  getEducationPrice,
  purchaseEducationPins,
  extractEducationPins,
  extractEducationReference,
  extractEducationAmount,
} from "./providers/vtugate/vtugate.education.client.js";


const PROVIDER =
  "VTUGATE";

const PAYMENT =
  "PAYMENT";

const REFUND =
  "REFUND";

const PENDING =
  "PENDING";

const PROCESSING =
  "PROCESSING";

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
  const random =
    Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase();

  return (
    `EDUPIN-${Date.now()}-${random}`
  );
}


/**
 * =========================================================
 * NORMALIZATION
 * =========================================================
 */

function normalizeServiceId(
  value
) {
  const number =
    Number(value);

  return Number.isInteger(
    number
  ) &&
    number > 0
    ? number
    : null;
}


function normalizeQuantity(
  value
) {
  const number =
    Number(value);

  return Number.isInteger(
    number
  ) &&
    number > 0
    ? number
    : null;
}


/**
 * =========================================================
 * SERVICE LIST
 * =========================================================
 */

export async function getEducationServiceList() {
  return getEducationServices();
}


/**
 * =========================================================
 * PRICE
 * =========================================================
 */

export async function getEducationServicePrice({
  serviceId,
  quantity = 1,
}) {
  return getEducationPrice({
    serviceId,
    quantity,
  });
}


/**
 * =========================================================
 * NOTIFICATION
 * =========================================================
 */

async function safeNotification(
  payload
) {
  try {
    await createNotification(
      payload
    );
  } catch (error) {
    console.error(
      "EDUCATION NOTIFICATION ERROR:",
      error
    );
  }
}


/**
 * =========================================================
 * REFUND
 * =========================================================
 */

async function refundEducationPurchase({
  userId,
  walletId,
  originalReference,
  amount,
  serviceId,
  quantity,
  providerResponse,
  reason,
}) {
  const client =
    await db.connect();

  try {
    await client.query(
      "BEGIN"
    );


    /**
     * -----------------------------------------------------
     * DUPLICATE REFUND CHECK
     * -----------------------------------------------------
     */

    const duplicate =
      await client.query(
        `
        SELECT id
        FROM transactions
        WHERE wallet_id = $1
          AND type = $2
          AND metadata->>'originalReference' = $3
        LIMIT 1
        `,
        [
          walletId,
          REFUND,
          originalReference,
        ]
      );


    if (
      duplicate.rows.length >
      0
    ) {
      await client.query(
        "COMMIT"
      );

      return {
        alreadyRefunded:
          true,

        refundTransaction:
          duplicate.rows[0],
      };
    }


    /**
     * -----------------------------------------------------
     * LOCK WALLET
     * -----------------------------------------------------
     */

    const wallet =
      await findWalletForUpdate(
        walletId,
        client
      );


    if (!wallet) {
      throw new Error(
        "Wallet not found during Education refund."
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
        "Invalid Education refund amount."
      );
    }


    const balanceBefore =
      Number(
        wallet.available_balance
      );


    /**
     * -----------------------------------------------------
     * MARK ORIGINAL PAYMENT FAILED
     * -----------------------------------------------------
     */

    await updateTransactionStatus(
      originalReference,
      FAILED,
      client
    );


    /**
     * -----------------------------------------------------
     * CREDIT WALLET
     * -----------------------------------------------------
     */

    const refundedWallet =
      await creditWallet(
        walletId,
        refundAmount,
        client
      );


    if (!refundedWallet) {
      throw new Error(
        "Unable to credit Education refund."
      );
    }


    const balanceAfter =
      Number(
        refundedWallet
          .available_balance
      );


    /**
     * -----------------------------------------------------
     * CREATE REFUND TRANSACTION
     * -----------------------------------------------------
     */

    const refundReference =
      `EDUREF-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;


    const refundTransaction =
      await createTransaction(
        {
          userId,

          walletId,

          reference:
            refundReference,

          type:
            REFUND,

          amount:
            refundAmount,

          balanceBefore,

          balanceAfter,

          status:
            SUCCESS,

          description:
            "Examination Result PIN purchase refund",

          metadata: {
            service:
              "EDUCATION",

            provider:
              PROVIDER,

            serviceId,

            quantity,

            originalReference,

            reason:
              reason ||
              "VTUGATE Education purchase failed.",

            providerResponse:
              providerResponse ||
              null,
          },
        },
        client
      );


    await client.query(
      "COMMIT"
    );


    return {
      alreadyRefunded:
        false,

      refundAmount,

      refundReference,

      refundTransaction,

      balanceBefore,

      balanceAfter,
    };

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {}

    console.error(
      "EDUCATION REFUND ERROR:",
      error
    );

    throw error;

  } finally {
    client.release();
  }
}


/**
 * =========================================================
 * PURCHASE EDUCATION PIN
 * =========================================================
 */

export async function purchaseEducationPin({
  userId,
  transactionPin,
  serviceId,
  quantity = 1,
}) {
  if (!userId) {
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


  if (!transactionPin) {
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


  const normalizedServiceId =
    normalizeServiceId(
      serviceId
    );


  if (!normalizedServiceId) {
    const error =
      new Error(
        "A valid Education service is required."
      );

    error.code =
      "INVALID_EDUCATION_SERVICE_ID";

    error.status =
      400;

    throw error;
  }


  const normalizedQuantity =
    normalizeQuantity(
      quantity
    );


  if (!normalizedQuantity) {
    const error =
      new Error(
        "Education PIN quantity must be at least 1."
      );

    error.code =
      "INVALID_EDUCATION_QUANTITY";

    error.status =
      400;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * VERIFY TRANSACTION PIN
   * -------------------------------------------------------
   */

  const pinResult =
    await verifyTransactionPin(
      userId,
      transactionPin
    );


  if (
    pinResult === false
  ) {
    const error =
      new Error(
        "Invalid transaction PIN."
      );

    error.code =
      "INVALID_TRANSACTION_PIN";

    error.status =
      400;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * GET PROVIDER PRICE
   * -------------------------------------------------------
   *
   * This is done BEFORE wallet debit.
   */

  const pricing =
    await getEducationPrice(
      {
        serviceId:
          normalizedServiceId,

        quantity:
          normalizedQuantity,
      }
    );


  const amount =
    Number(
      pricing?.totalPrice
    );


  if (
    !Number.isFinite(
      amount
    ) ||
    amount <= 0
  ) {
    const error =
      new Error(
        "Unable to determine the Education PIN price."
      );

    error.code =
      "EDUCATION_PRICE_UNAVAILABLE";

    error.status =
      502;

    throw error;
  }


  const reference =
    createReference();


  let wallet;

  let paymentTransaction;

  let balanceBefore;

  let balanceAfter;


  /**
   * -------------------------------------------------------
   * DEBIT WALLET
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
        userId,
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
      amount
    ) {
      const error =
        new Error(
          "Insufficient wallet balance."
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
        amount,
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
     * -------------------------------------------------------
     * CREATE PAYMENT TRANSACTION
     * -------------------------------------------------------
     */

    paymentTransaction =
      await createTransaction(
        {
          userId,

          walletId:
            wallet.id,

          reference,

          type:
            PAYMENT,

          amount,

          balanceBefore,

          balanceAfter,

          status:
            PENDING,

          description:
            "Examination Result PIN purchase",

          metadata: {
            service:
              "EDUCATION",

            provider:
              PROVIDER,

            serviceId:
              normalizedServiceId,

            quantity:
              normalizedQuantity,

            unitPrice:
              Number(
                pricing.unitPrice
              ),

            requestedAmount:
              amount,
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
   * -------------------------------------------------------
   * PROVIDER PURCHASE
   * -------------------------------------------------------
   */

  let providerResult;


  try {
    providerResult =
      await purchaseEducationPins(
        {
          serviceId:
            normalizedServiceId,

          quantity:
            normalizedQuantity,
        }
      );

  } catch (providerError) {

    const providerResponse =
      providerError?.providerResponse ||
      null;


    await refundEducationPurchase(
      {
        userId,

        walletId:
          wallet.id,

        originalReference:
          reference,

        amount,

        serviceId:
          normalizedServiceId,

        quantity:
          normalizedQuantity,

        providerResponse,

        reason:
          providerError?.message ||
          "VTUGATE Education provider request failed.",
      }
    );


    await safeNotification(
      {
        userId,

        title:
          "Examination Result PIN Failed",

        message:
          `Your Examination Result PIN purchase failed. ₦${amount.toFixed(
            2
          )} has been refunded to your wallet.`,

        type:
          "TRANSACTION_REFUND",

        metadata: {
          service:
            "EDUCATION",

          reference,

          amount,

          quantity:
            normalizedQuantity,

          provider:
            PROVIDER,
        },
      }
    );


    const error =
      new Error(
        "Examination Result PIN purchase failed. Your wallet has been refunded."
      );

    error.code =
      "EDUCATION_PURCHASE_FAILED";

    error.status =
      502;

    error.providerResponse =
      providerResponse;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * PROVIDER FAILED
   * -------------------------------------------------------
   */

  if (
    providerResult?.success !==
    true
  ) {
    const providerMessage =
      providerResult?.message ||
      "VTUGATE Education purchase failed.";


    await refundEducationPurchase(
      {
        userId,

        walletId:
          wallet.id,

        originalReference:
          reference,

        amount,

        serviceId:
          normalizedServiceId,

        quantity:
          normalizedQuantity,

        providerResponse:
          providerResult?.raw ||
          providerResult,

        reason:
          providerMessage,
      }
    );


    await safeNotification(
      {
        userId,

        title:
          "Examination Result PIN Failed",

        message:
          `Your Examination Result PIN purchase failed. ₦${amount.toFixed(
            2
          )} has been refunded to your wallet.`,

        type:
          "TRANSACTION_REFUND",

        metadata: {
          service:
            "EDUCATION",

          reference,

          amount,

          provider:
            PROVIDER,
        },
      }
    );


    const error =
      new Error(
        providerMessage
      );

    error.code =
      "EDUCATION_PROVIDER_FAILED";

    error.status =
      502;

    throw error;
  }


  /**
   * -------------------------------------------------------
   * EXTRACT PINS
   * -------------------------------------------------------
   */

  const pins =
    extractEducationPins(
      providerResult
    );


  const providerReference =
    extractEducationReference(
      providerResult
    );


  const providerAmount =
    extractEducationAmount(
      providerResult
    );


  /**
   * -------------------------------------------------------
   * MARK PAYMENT SUCCESS
   * -------------------------------------------------------
   */

  let completedTransaction;


  try {
    completedTransaction =
      await updateTransactionStatus(
        reference,
        SUCCESS
      );
  } catch (error) {

    console.error(
      "EDUCATION TRANSACTION UPDATE ERROR:",
      error
    );


    /**
     * DO NOT REFUND HERE.
     *
     * Provider already delivered the
     * Education PIN.
     */

    completedTransaction =
      paymentTransaction;
  }


  /**
   * -------------------------------------------------------
   * NOTIFICATION
   * -------------------------------------------------------
   */

  await safeNotification(
    {
      userId,

      title:
        "Examination Result PIN Successful",

      message:
        `${normalizedQuantity} examination result PIN${
          normalizedQuantity === 1
            ? ""
            : "s"
        } purchased successfully.`,

      type:
        "TRANSACTION",

      metadata: {
        service:
          "EDUCATION",

        reference,

        transactionReference:
          reference,

        providerReference,

        serviceId:
          normalizedServiceId,

        quantity:
          normalizedQuantity,

        amount,

        deductedAmount:
          amount,

        providerAmount,

        pinsAvailable:
          pins.length > 0,

        pinCount:
          pins.length,
      },
    }
  );


  /**
   * -------------------------------------------------------
   * RETURN
   * -------------------------------------------------------
   */

  return {
    success:
      true,

    message:
      "Examination Result PIN purchase successful.",

    reference,

    transactionReference:
      reference,

    amount,

    deductedAmount:
      amount,

    providerAmount,

    quantity:
      normalizedQuantity,

    serviceId:
      normalizedServiceId,

    provider:
      PROVIDER,

    providerReference,

    pins,

    transaction:
      completedTransaction,

    providerResponse:
      providerResult?.data ||
      null,
  };
}


export default {
  getEducationServiceList,
  getEducationServicePrice,
  purchaseEducationPin,
};