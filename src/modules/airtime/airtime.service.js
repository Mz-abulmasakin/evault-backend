 // src/modules/airtime/airtime.service.js

import crypto from "crypto";
import db from "../../config/database.js";

import {
  findWalletByUserId,
  findWalletForUpdate,
  debitWallet,
  creditWallet,
} from "../wallet/wallet.repository.js";

import {
  createTransaction,
  updateTransactionStatus,
} from "../transactions/transaction.repository.js";

import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
} from "../transactions/transaction.constants.js";

import {
  verifyTransactionPin,
} from "../profile/profile.service.js";

import {
  notifyAirtimePurchase,
} from "../notification/notification.service.js";

import {
  buyAirtime,
} from "./alrahuz.airtime.service.js";


/**
 * =========================================================
 * GENERATE AIRTIME REFERENCE
 * =========================================================
 */
function generateAirtimeReference() {
  return `AIR-${Date.now()}-${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
}


/**
 * =========================================================
 * PURCHASE AIRTIME
 * =========================================================
 */
 
export async function purchaseAirtime({
  userId,
  network,
  amount,
  phoneNumber,
  pin,
}) {

  /**
   * -------------------------------------------------------
   * VALIDATION
   * -------------------------------------------------------
   */

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!network) {
    throw new Error("Network is required");
  }

  const airtimeAmount = Number(amount);

  if (
    !Number.isFinite(airtimeAmount) ||
    airtimeAmount <= 0
  ) {
    throw new Error(
      "A valid airtime amount is required"
    );
  }

  if (!phoneNumber) {
    throw new Error(
      "Phone number is required"
    );
  }

  if (!pin) {
    throw new Error(
      "Transaction PIN is required"
    );
  }


  /**
   * -------------------------------------------------------
   * VERIFY TRANSACTION PIN
   * -------------------------------------------------------
   *
   * The PIN is NEVER stored or compared directly here.
   *
   * profile.service.js uses bcrypt against the
   * transaction_pin_hash stored in users.
   */
  await verifyTransactionPin(
    userId,
    String(pin)
  );


  /**
   * -------------------------------------------------------
   * NORMALIZE PHONE
   * -------------------------------------------------------
   */

  const normalizedPhone =
    String(phoneNumber).trim();

  if (!/^0\d{10}$/.test(normalizedPhone)) {
    throw new Error(
      "A valid Nigerian phone number is required"
    );
  }


  /**
   * -------------------------------------------------------
   * FIND WALLET
   * -------------------------------------------------------
   */

  const wallet =
    await findWalletByUserId(userId);

  if (!wallet) {
    throw new Error(
      "Wallet not found"
    );
  }

  if (wallet.status !== "ACTIVE") {
    throw new Error(
      "Wallet is not active"
    );
  }


  /**
   * -------------------------------------------------------
   * GENERATE REFERENCE
   * -------------------------------------------------------
   */

  const reference =
    generateAirtimeReference();


  /**
   * -------------------------------------------------------
   * SHORT DATABASE TRANSACTION
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * We DO NOT call Alrahuz while the wallet is locked.
   */
  const client =
    await db.connect();

  let paymentTransaction;

  try {

    await client.query("BEGIN");


    /**
     * Lock wallet
     */
    const lockedWallet =
      await findWalletForUpdate(
        wallet.id,
        client
      );

    if (!lockedWallet) {
      throw new Error(
        "Wallet not found"
      );
    }

    if (
      lockedWallet.status !== "ACTIVE"
    ) {
      throw new Error(
        "Wallet is not active"
      );
    }


    /**
     * -----------------------------------------------------
     * CHECK BALANCE
     * -----------------------------------------------------
     */

    const balanceBefore =
      Number(
        lockedWallet.available_balance
      );

    if (
      !Number.isFinite(balanceBefore)
    ) {
      throw new Error(
        "Invalid wallet balance"
      );
    }

    if (
      balanceBefore < airtimeAmount
    ) {
      throw new Error(
        "Insufficient wallet balance"
      );
    }


    /**
     * -----------------------------------------------------
     * DEBIT WALLET
     * -----------------------------------------------------
     */

    const updatedWallet =
      await debitWallet(
        lockedWallet.id,
        airtimeAmount,
        client
      );

    if (!updatedWallet) {
      throw new Error(
        "Unable to debit wallet. Insufficient balance."
      );
    }


    const balanceAfter =
      Number(
        updatedWallet.available_balance
      );


    /**
     * -----------------------------------------------------
     * CREATE PAYMENT TRANSACTION
     * -----------------------------------------------------
     */

    paymentTransaction =
      await createTransaction(
        {
          walletId:
            lockedWallet.id,

          reference,

          type:
            TRANSACTION_TYPES.PAYMENT,

          amount:
            airtimeAmount,

          balanceBefore,

          balanceAfter,

          status:
            TRANSACTION_STATUS.PENDING,

          description:
            `Airtime purchase - ${normalizedPhone}`,

          metadata: {
            service:
              "AIRTIME",

            network,

            phoneNumber:
              normalizedPhone,

            provider:
              "ALRAHUZ",
          },
        },
        client
      );


    /**
     * -----------------------------------------------------
     * COMMIT
     * -----------------------------------------------------
     */

    await client.query("COMMIT");

  } catch (error) {

    try {
      await client.query(
        "ROLLBACK"
      );
    } catch (rollbackError) {

      console.error(
        "Airtime wallet rollback error:",
        rollbackError
      );
    }

    throw error;

  } finally {

    client.release();

  }


  /**
   * =======================================================
   * CALL ALRAHUZ
   * =======================================================
   */

  let providerResult;

  try {

    providerResult =
      await buyAirtime({
        network,
        amount:
          airtimeAmount,
        phoneNumber:
          normalizedPhone,
        reference,
      });

  } catch (providerError) {

    console.error(
      "Alrahuz Airtime Error:",
      providerError
    );

    providerResult = {
      success: false,
      data: {
        error:
          providerError.message,
      },
    };

  }


  /**
   * =======================================================
   * PROVIDER SUCCESS
   * =======================================================
   */

  if (providerResult.success) {

    const completedTransaction =
      await updateTransactionStatus(
        paymentTransaction.id,
        TRANSACTION_STATUS.SUCCESS
      );


    /**
     * -----------------------------------------------------
     * CREATE SUCCESS NOTIFICATION
     * -----------------------------------------------------
     */
    try {

      await notifyAirtimePurchase({
        userId,
        amount:
          airtimeAmount,
        network,
        phoneNumber:
          normalizedPhone,
        reference,
        status:
          "SUCCESS",
      });

    } catch (notificationError) {

      /**
       * Notification failure must NOT
       * make a successful airtime purchase fail.
       */
      console.error(
        "Airtime success notification error:",
        notificationError
      );

    }


    return {

      success: true,

      message:
        "Airtime purchase successful",

      reference,

      amount:
        airtimeAmount,

      phoneNumber:
        normalizedPhone,

      network,

      transaction:
        completedTransaction,

      provider:
        providerResult.data,

    };

  }


  /**
   * =======================================================
   * PROVIDER FAILURE
   * =======================================================
   *
   * Wallet has already been debited.
   *
   * We must:
   *
   * 1. Mark PAYMENT failed
   * 2. Refund wallet
   * 3. Create REFUND transaction
   * 4. Create notification
   */

  const refundClient =
    await db.connect();

  try {

    await refundClient.query(
      "BEGIN"
    );


    /**
     * -----------------------------------------------------
     * LOCK WALLET
     * -----------------------------------------------------
     */

    const walletForRefund =
      await findWalletForUpdate(
        wallet.id,
        refundClient
      );

    if (!walletForRefund) {
      throw new Error(
        "Wallet not found while processing refund"
      );
    }


    /**
     * -----------------------------------------------------
     * MARK PAYMENT FAILED
     * -----------------------------------------------------
     */

    await updateTransactionStatus(
      paymentTransaction.id,
      TRANSACTION_STATUS.FAILED,
      refundClient
    );


    /**
     * -----------------------------------------------------
     * CREDIT WALLET
     * -----------------------------------------------------
     */

    const refundBalanceBefore =
      Number(
        walletForRefund.available_balance
      );

    const refundedWallet =
      await creditWallet(
        wallet.id,
        airtimeAmount,
        refundClient
      );

    if (!refundedWallet) {
      throw new Error(
        "Unable to refund airtime purchase"
      );
    }


    const refundBalanceAfter =
      Number(
        refundedWallet.available_balance
      );


    /**
     * -----------------------------------------------------
     * CREATE REFUND TRANSACTION
     * -----------------------------------------------------
     */

    const refundReference =
      `REF-${reference}`;

    const refundTransaction =
      await createTransaction(
        {
          walletId:
            wallet.id,

          reference:
            refundReference,

          type:
            TRANSACTION_TYPES.REFUND,

          amount:
            airtimeAmount,

          balanceBefore:
            refundBalanceBefore,

          balanceAfter:
            refundBalanceAfter,

          status:
            TRANSACTION_STATUS.SUCCESS,

          description:
            `Airtime purchase refund - ${normalizedPhone}`,

          metadata: {
            service:
              "AIRTIME",

            originalReference:
              reference,

            network,

            phoneNumber:
              normalizedPhone,

            provider:
              "ALRAHUZ",

            providerResponse:
              providerResult.data,
          },
        },
        refundClient
      );


    /**
     * -----------------------------------------------------
     * COMMIT REFUND
     * -----------------------------------------------------
     */

    await refundClient.query(
      "COMMIT"
    );


    /**
     * -----------------------------------------------------
     * CREATE FAILURE NOTIFICATION
     * -----------------------------------------------------
     */

    try {

      await notifyAirtimePurchase({
        userId,
        amount:
          airtimeAmount,
        network,
        phoneNumber:
          normalizedPhone,
        reference,
        status:
          "FAILED",
      });

    } catch (notificationError) {

      console.error(
        "Airtime failure notification error:",
        notificationError
      );

    }


    return {

      success: false,

      refunded: true,

      message:
        "Airtime purchase failed. Your wallet has been refunded.",

      reference,

      refundReference,

      amount:
        airtimeAmount,

      phoneNumber:
        normalizedPhone,

      network,

      transaction:
        paymentTransaction,

      refundTransaction,

      provider:
        providerResult.data,

    };

  } catch (error) {

    try {

      await refundClient.query(
        "ROLLBACK"
      );

    } catch (rollbackError) {

      console.error(
        "Airtime refund rollback error:",
        rollbackError
      );

    }


    console.error(
      "CRITICAL: Airtime refund failed",
      {
        reference,
        amount:
          airtimeAmount,
        userId,
        error:
          error.message,
      }
    );


    throw new Error(
      "Airtime purchase failed and automatic refund could not be completed. Please contact support."
    );

  } finally {

    refundClient.release();

  }
}