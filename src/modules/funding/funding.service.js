 // src/modules/funding/funding.service.js

import db from "../../config/database.js";

import {
  createReservedAccount,
} from "./monnify.account.service.js";

import {
  verifyTransaction,
} from "./monnify.transaction.service.js";

import {
  saveReservedAccount,
  findReservedAccountByUser,
  findReservedAccountByNumber,
} from "./monnify.repository.js";

import {
  findWalletByUserId,
  findWalletForUpdate,
  creditWallet,
} from "../wallet/wallet.repository.js";

import {
  recordFunding,
} from "../transactions/transaction.service.js";

import {
  notifyWalletFunding,
} from "../notification/notification.service.js";


/**
 * =========================================================
 * CREATE USER RESERVED ACCOUNT
 * =========================================================
 */
export async function createUserReservedAccount(user) {

  if (!user?.id) {
    throw new Error(
      "Authenticated user is required"
    );
  }

  /**
   * -------------------------------------------------------
   * CHECK IF USER ALREADY HAS A RESERVED ACCOUNT
   * -------------------------------------------------------
   */

  const existing =
    await findReservedAccountByUser(
      user.id
    );

  if (existing) {
    return existing;
  }


  /**
   * -------------------------------------------------------
   * FIND USER WALLET
   * -------------------------------------------------------
   */

  const wallet =
    await findWalletByUserId(
      user.id
    );

  if (!wallet) {
    throw new Error(
      "Wallet not found. Create the wallet before creating a dedicated account."
    );
  }


  /**
   * -------------------------------------------------------
   * CREATE MONNIFY RESERVED ACCOUNT
   * -------------------------------------------------------
   */

  const account =
    await createReservedAccount(
      user
    );

  if (!account) {
    throw new Error(
      "Monnify did not return a reserved account"
    );
  }


  /**
   * -------------------------------------------------------
   * EXTRACT ACCOUNT
   * -------------------------------------------------------
   */

  const accounts =
    account.accounts || [];

  const firstAccount =
    accounts[0];

  if (!firstAccount?.accountNumber) {
    throw new Error(
      "Monnify reserved account number was not returned"
    );
  }


  /**
   * -------------------------------------------------------
   * SAVE RESERVED ACCOUNT
   * -------------------------------------------------------
   */

  return await saveReservedAccount({

    userId:
      user.id,

    walletId:
      wallet.id,

    accountNumber:
      firstAccount.accountNumber,

    accountName:
      firstAccount.accountName ||
      account.accountName ||
      user.full_name,

    bankName:
      firstAccount.bankName ||
      firstAccount.bankCode ||
      "Monnify",

    accountReference:
      account.accountReference ||
      `EVAULT-${user.id}`,

    reservationReference:
      account.reservationReference ||
      account.contractCode ||
      null,

  });
}


/**
 * =========================================================
 * GET USER RESERVED ACCOUNT
 * =========================================================
 */
export async function getUserReservedAccount(
  userId
) {

  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  return await findReservedAccountByUser(
    userId
  );
}


/**
 * =========================================================
 * PROCESS MONNIFY FUNDING
 * =========================================================
 *
 * Flow:
 *
 * Monnify webhook
 *      ↓
 * Extract transaction reference
 *      ↓
 * Extract destination account
 *      ↓
 * Find Evault reserved account
 *      ↓
 * Verify transaction with Monnify
 *      ↓
 * Confirm PAID
 *      ↓
 * Start DB transaction
 *      ↓
 * Check duplicate transaction
 *      ↓
 * Lock wallet
 *      ↓
 * Read available balance
 *      ↓
 * Credit wallet
 *      ↓
 * Record transaction
 *      ↓
 * Commit
 *      ↓
 * Notification
 *
 * IMPORTANT:
 *
 * Wallet columns are:
 *
 * available_balance
 * ledger_balance
 *
 * NOT:
 *
 * balance
 */
export async function processFunding(
  webhookData
) {

  /**
   * =======================================================
   * EXTRACT WEBHOOK DATA
   * =======================================================
   */

  const eventData =
    webhookData?.eventData || {};


  /**
   * -------------------------------------------------------
   * TRANSACTION REFERENCE
   * -------------------------------------------------------
   */

  const transactionReference =
    eventData.transactionReference ||
    eventData.paymentReference ||
    webhookData?.transactionReference ||
    webhookData?.paymentReference;


  /**
   * -------------------------------------------------------
   * DESTINATION ACCOUNT NUMBER
   * -------------------------------------------------------
   */

  const accountNumber =
    eventData
      ?.destinationAccountInformation
      ?.accountNumber ||

    eventData
      ?.destinationAccountNumber ||

    webhookData
      ?.destinationAccountNumber ||

    webhookData
      ?.accountNumber;


  console.log(
    "MONNIFY FUNDING DETAILS:",
    {
      transactionReference,
      accountNumber,
    }
  );


  /**
   * =======================================================
   * VALIDATE REQUIRED DATA
   * =======================================================
   */

  if (!transactionReference) {

    throw new Error(
      "Funding transaction reference is missing"
    );

  }


  if (!accountNumber) {

    throw new Error(
      "Destination account number is missing"
    );

  }


  /**
   * =======================================================
   * FIND RESERVED ACCOUNT
   * =======================================================
   */

  console.log(
    "LOOKING FOR RESERVED ACCOUNT:",
    accountNumber
  );


  const reservedAccount =
    await findReservedAccountByNumber(
      accountNumber
    );


  if (!reservedAccount) {

    throw new Error(
      `Reserved account not found for account number ${accountNumber}`
    );

  }


  console.log(
    "RESERVED ACCOUNT FOUND:",
    {
      id:
        reservedAccount.id,

      userId:
        reservedAccount.user_id,

      walletId:
        reservedAccount.wallet_id,

      accountNumber:
        reservedAccount.account_number,
    }
  );


  /**
   * =======================================================
   * VERIFY TRANSACTION WITH MONNIFY
   * =======================================================
   *
   * This is important.
   *
   * We don't trust amount/payment status supplied only
   * by the webhook.
   *
   * We ask Monnify for the actual transaction.
   */

  console.log(
    "VERIFYING MONNIFY TRANSACTION:",
    transactionReference
  );


  let verified;

  try {

    verified =
      await verifyTransaction(
        transactionReference
      );

  } catch (error) {

    console.error(
      "MONNIFY TRANSACTION VERIFICATION FAILED:",
      error.response?.data ||
      error.message
    );

    throw new Error(
      "Unable to verify Monnify transaction"
    );

  }


  console.log(
    "MONNIFY VERIFICATION RESULT:",
    JSON.stringify(
      verified,
      null,
      2
    )
  );


  /**
   * =======================================================
   * VERIFY PAYMENT STATUS
   * =======================================================
   */

  if (
    verified?.paymentStatus !==
    "PAID"
  ) {

    throw new Error(
      `Payment is not completed. Status: ${verified?.paymentStatus || "UNKNOWN"}`
    );

  }


  /**
   * =======================================================
   * GET PAYMENT AMOUNT
   * =======================================================
   *
   * Prefer Monnify's verified amount.
   */

  const amount =
    Number(
      verified?.amountPaid
    );


  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {

    throw new Error(
      "Invalid funding amount"
    );

  }


  console.log(
    "VERIFIED FUNDING AMOUNT:",
    amount
  );


  /**
   * =======================================================
   * START DATABASE TRANSACTION
   * =======================================================
   */

  const client =
    await db.connect();


  try {

    await client.query(
      "BEGIN"
    );


    /**
     * =====================================================
     * IDEMPOTENCY CHECK
     * =====================================================
     *
     * Monnify can retry a webhook.
     *
     * We MUST NOT credit the wallet twice.
     */

    const existing =
      await client.query(
        `
        SELECT *
        FROM transactions
        WHERE reference = $1
        LIMIT 1
        `,
        [
          transactionReference,
        ]
      );


    if (
      existing.rows.length > 0
    ) {

      console.log(
        "DUPLICATE MONNIFY TRANSACTION:",
        transactionReference
      );


      await client.query(
        "ROLLBACK"
      );


      return {

        success:
          true,

        duplicate:
          true,

        transaction:
          existing.rows[0],

      };

    }


    /**
     * =====================================================
     * LOCK WALLET
     * =====================================================
     *
     * FOR UPDATE prevents simultaneous funding/debit
     * operations from corrupting the balance.
     */

    console.log(
      "LOCKING WALLET:",
      reservedAccount.wallet_id
    );


    const wallet =
      await findWalletForUpdate(
        reservedAccount.wallet_id,
        client
      );


    if (!wallet) {

      throw new Error(
        "Wallet not found"
      );

    }


    /**
     * =====================================================
     * READ BALANCE BEFORE
     * =====================================================
     */

    const balanceBefore =
      Number(
        wallet.available_balance || 0
      );


    const ledgerBalanceBefore =
      Number(
        wallet.ledger_balance || 0
      );


    console.log(
      "WALLET BEFORE FUNDING:",
      {
        walletId:
          wallet.id,

        availableBalance:
          balanceBefore,

        ledgerBalance:
          ledgerBalanceBefore,

        fundingAmount:
          amount,
      }
    );


    /**
     * =====================================================
     * CREDIT WALLET
     * =====================================================
     *
     * creditWallet() updates:
     *
     * available_balance
     *
     * and
     *
     * ledger_balance
     */

    console.log(
      "CREDITING WALLET:",
      {
        walletId:
          wallet.id,

        amount,
      }
    );


    const updatedWallet =
      await creditWallet(
        wallet.id,
        amount,
        client
      );


    if (!updatedWallet) {

      throw new Error(
        "Failed to credit wallet"
      );

    }


    /**
     * =====================================================
     * BALANCE AFTER
     * =====================================================
     */

    const balanceAfter =
      Number(
        updatedWallet.available_balance || 0
      );


    const ledgerBalanceAfter =
      Number(
        updatedWallet.ledger_balance || 0
      );


    console.log(
      "WALLET AFTER FUNDING:",
      {
        walletId:
          updatedWallet.id,

        availableBalance:
          balanceAfter,

        ledgerBalance:
          ledgerBalanceAfter,
      }
    );


    /**
     * =====================================================
     * RECORD TRANSACTION
     * =====================================================
     */

    console.log(
      "RECORDING FUNDING TRANSACTION:",
      transactionReference
    );


    const transaction =
      await recordFunding(
        {

          walletId:
            wallet.id,

          reference:
            transactionReference,

          amount,

          balanceBefore,

          balanceAfter,

          description:
            "Wallet funding via Monnify",

          metadata: {

            source:
              "MONNIFY",

            transactionReference,

            paymentReference:
              eventData.paymentReference ||
              null,

            accountNumber,

            amountPaid:
              amount,

            paymentStatus:
              verified.paymentStatus,

            paymentMethod:
              verified.paymentMethod ||
              eventData.paymentMethod ||
              null,

            currency:
              verified.currency ||
              eventData.currency ||
              "NGN",

            webhook:
              webhookData,

          },

        },
        client
      );


    /**
     * =====================================================
     * COMMIT DATABASE TRANSACTION
     * =====================================================
     */

    await client.query(
      "COMMIT"
    );


    console.log(
      "FUNDING COMMITTED SUCCESSFULLY:",
      {
        transactionReference,

        walletId:
          wallet.id,

        amount,

        balanceAfter,
      }
    );


    /**
     * =====================================================
     * SEND NOTIFICATION
     * =====================================================
     *
     * Notification failure must NOT undo a successful
     * wallet credit.
     */

    try {

      await notifyWalletFunding({

        userId:
          reservedAccount.user_id,

        amount,

        balance:
          balanceAfter,

        reference:
          transactionReference,

      });


      console.log(
        "FUNDING NOTIFICATION SENT:",
        transactionReference
      );


    } catch (
      notificationError
    ) {

      console.error(
        "Funding notification failed:",
        notificationError.message
      );

    }


    /**
     * =====================================================
     * RETURN RESULT
     * =====================================================
     */

    return {

      success:
        true,

      transaction,

      wallet: {

        id:
          updatedWallet.id,

        availableBalance:
          balanceAfter,

        ledgerBalance:
          ledgerBalanceAfter,

      },

    };


  } catch (error) {

    /**
     * =====================================================
     * ROLLBACK
     * =====================================================
     */

    try {

      await client.query(
        "ROLLBACK"
      );

    } catch (
      rollbackError
    ) {

      console.error(
        "Funding rollback error:",
        rollbackError.message
      );

    }


    console.error(
      "PROCESS FUNDING ERROR:",
      error.message
    );


    throw error;


  } finally {

    /**
     * =====================================================
     * RELEASE DATABASE CONNECTION
     * =====================================================
     */

    client.release();

  }

}