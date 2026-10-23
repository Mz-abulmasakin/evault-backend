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


// =========================================================
// CREATE USER RESERVED / DEDICATED ACCOUNT
// =========================================================

export async function createUserReservedAccount(user) {
  // The authenticated user ID must come from the verified JWT.
  if (!user?.id) {
    throw new Error(
      "Authenticated user is required"
    );
  }

  // -------------------------------------------------------
  // 1. Return an existing reserved account if one exists
  // -------------------------------------------------------

  const existing =
    await findReservedAccountByUser(user.id);

  if (existing) {
    return existing;
  }

  // -------------------------------------------------------
  // 2. Find the user's existing eVault wallet
  // -------------------------------------------------------

  const wallet =
    await findWalletByUserId(user.id);

  if (!wallet) {
    throw new Error(
      "Wallet not found. Create the wallet before creating a dedicated account."
    );
  }

  // -------------------------------------------------------
  // 3. Retrieve the user's registered details from the DB
  //
  // req.user comes from JWT claims and may not contain
  // full_name or email. Retrieve them using the verified
  // authenticated user's ID.
  // -------------------------------------------------------

  const userResult = await db.query(
    `
      SELECT
        id,
        full_name,
        email
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [user.id]
  );

  const registeredUser =
    userResult.rows[0];

  if (!registeredUser) {
    throw new Error(
      "Registered user record not found."
    );
  }

  const fullName =
    String(registeredUser.full_name || "").trim();

  const email =
    String(registeredUser.email || "").trim();

  if (!fullName) {
    throw new Error(
      "Your registered full name is missing. Please contact support."
    );
  }

  if (!email) {
    throw new Error(
      "Your registered email is missing. Please contact support."
    );
  }

  // Use registered details for Monnify.
  // Do not accept the customer's name from an arbitrary
  // frontend request body.
  const accountUser = {
    ...user,
    ...registeredUser,
    full_name: fullName,
    fullName,
    email,
  };

  // -------------------------------------------------------
  // 4. Create the Monnify reserved account
  // -------------------------------------------------------

  const account =
    await createReservedAccount(accountUser);

  if (!account) {
    throw new Error(
      "Monnify did not return a reserved account"
    );
  }

  // -------------------------------------------------------
  // 5. Extract and validate the account details
  // -------------------------------------------------------

  const accounts =
    account.accounts || [];

  const firstAccount =
    accounts[0];

  if (!firstAccount?.accountNumber) {
    throw new Error(
      "Monnify reserved account number was not returned"
    );
  }

  // -------------------------------------------------------
  // 6. Save the reserved account
  // -------------------------------------------------------

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
      accountUser.full_name,

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


// =========================================================
// GET USER RESERVED ACCOUNT
// =========================================================

export async function getUserReservedAccount(userId) {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  return await findReservedAccountByUser(userId);
}


// =========================================================
// PROCESS MONNIFY FUNDING WEBHOOK
// =========================================================

export async function processFunding(webhookData) {
  // -------------------------------------------------------
  // 1. Extract webhook data
  // -------------------------------------------------------

  const eventData =
    webhookData?.eventData || {};

  const transactionReference =
    eventData.transactionReference ||
    eventData.paymentReference ||
    webhookData?.transactionReference ||
    webhookData?.paymentReference;

  const accountNumber =
    eventData?.destinationAccountInformation?.accountNumber ||
    eventData?.destinationAccountNumber ||
    webhookData?.destinationAccountNumber ||
    webhookData?.accountNumber;

  console.log(
    "MONNIFY FUNDING DETAILS:",
    {
      transactionReference,
      accountNumber,
    }
  );

  // -------------------------------------------------------
  // 2. Validate required data
  // -------------------------------------------------------

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

  // -------------------------------------------------------
  // 3. Find the eVault reserved account
  // -------------------------------------------------------

  console.log(
    "LOOKING FOR RESERVED ACCOUNT:",
    accountNumber
  );

  const reservedAccount =
    await findReservedAccountByNumber(accountNumber);

  if (!reservedAccount) {
    throw new Error(
      `Reserved account not found for account number ${accountNumber}`
    );
  }

  console.log(
    "RESERVED ACCOUNT FOUND:",
    {
      id: reservedAccount.id,
      userId: reservedAccount.user_id,
      walletId: reservedAccount.wallet_id,
      accountNumber: reservedAccount.account_number,
    }
  );

  // -------------------------------------------------------
  // 4. Verify the transaction directly with Monnify
  // -------------------------------------------------------

  console.log(
    "VERIFYING MONNIFY TRANSACTION:",
    transactionReference
  );

  let verified;

  try {
    verified =
      await verifyTransaction(transactionReference);
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
    JSON.stringify(verified, null, 2)
  );

  // -------------------------------------------------------
  // 5. Verify payment status
  // -------------------------------------------------------

  if (verified?.paymentStatus !== "PAID") {
    throw new Error(
      `Payment is not completed. Status: ${
        verified?.paymentStatus || "UNKNOWN"
      }`
    );
  }

  // -------------------------------------------------------
  // 6. Validate the verified amount
  // -------------------------------------------------------

  const amount =
    Number(verified?.amountPaid);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(
      "Invalid funding amount"
    );
  }

  console.log(
    "VERIFIED FUNDING AMOUNT:",
    amount
  );

  // -------------------------------------------------------
  // 7. Start the database transaction
  // -------------------------------------------------------

  const client =
    await db.connect();

  try {
    await client.query("BEGIN");

    // -----------------------------------------------------
    // 8. Prevent duplicate funding
    // -----------------------------------------------------

    const existing =
      await client.query(
        `
          SELECT *
          FROM transactions
          WHERE reference = $1
          LIMIT 1
        `,
        [transactionReference]
      );

    if (existing.rows.length > 0) {
      console.log(
        "DUPLICATE MONNIFY TRANSACTION:",
        transactionReference
      );

      await client.query("ROLLBACK");

      return {
        success: true,
        duplicate: true,
        transaction: existing.rows[0],
      };
    }

    // -----------------------------------------------------
    // 9. Lock the wallet before updating its balance
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // 10. Record balances before funding
    // -----------------------------------------------------

    const balanceBefore =
      Number(wallet.available_balance || 0);

    const ledgerBalanceBefore =
      Number(wallet.ledger_balance || 0);

    console.log(
      "WALLET BEFORE FUNDING:",
      {
        walletId: wallet.id,
        availableBalance: balanceBefore,
        ledgerBalance: ledgerBalanceBefore,
        fundingAmount: amount,
      }
    );

    // -----------------------------------------------------
    // 11. Credit the wallet
    // -----------------------------------------------------

    console.log(
      "CREDITING WALLET:",
      {
        walletId: wallet.id,
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

    // -----------------------------------------------------
    // 12. Record balances after funding
    // -----------------------------------------------------

    const balanceAfter =
      Number(updatedWallet.available_balance || 0);

    const ledgerBalanceAfter =
      Number(updatedWallet.ledger_balance || 0);

    console.log(
      "WALLET AFTER FUNDING:",
      {
        walletId: updatedWallet.id,
        availableBalance: balanceAfter,
        ledgerBalance: ledgerBalanceAfter,
      }
    );

    // -----------------------------------------------------
    // 13. Record the transaction
    // -----------------------------------------------------

    console.log(
      "RECORDING FUNDING TRANSACTION:",
      transactionReference
    );

    const transaction =
      await recordFunding(
        {
          walletId: wallet.id,

          reference:
            transactionReference,

          amount,

          balanceBefore,

          balanceAfter,

          description:
            "Wallet funding via Monnify",

          metadata: {
            source: "MONNIFY",

            transactionReference,

            paymentReference:
              eventData.paymentReference ||
              null,

            accountNumber,

            amountPaid: amount,

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

            webhook: webhookData,
          },
        },
        client
      );

    // -----------------------------------------------------
    // 14. Commit the wallet credit and transaction
    // -----------------------------------------------------

    await client.query("COMMIT");

    console.log(
      "FUNDING COMMITTED SUCCESSFULLY:",
      {
        transactionReference,
        walletId: wallet.id,
        amount,
        balanceAfter,
      }
    );

    // -----------------------------------------------------
    // 15. Send notification
    //
    // Notification failure must not undo a committed
    // wallet credit.
    // -----------------------------------------------------

    try {
      await notifyWalletFunding({
        userId: reservedAccount.user_id,
        amount,
        balance: balanceAfter,
        reference: transactionReference,
      });

      console.log(
        "FUNDING NOTIFICATION SENT:",
        transactionReference
      );
    } catch (notificationError) {
      console.error(
        "Funding notification failed:",
        notificationError.message
      );
    }

    // -----------------------------------------------------
    // 16. Return the result
    // -----------------------------------------------------

    return {
      success: true,

      transaction,

      wallet: {
        id: updatedWallet.id,
        availableBalance: balanceAfter,
        ledgerBalance: ledgerBalanceAfter,
      },
    };
  } catch (error) {
    // -----------------------------------------------------
    // Roll back unsuccessful database transactions
    // -----------------------------------------------------

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
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
    // Always release the pooled connection.
    client.release();
  }
}