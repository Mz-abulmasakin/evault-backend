
import db from "../../config/database.js";

import {
  createWallet,
  findWalletByUserId,
  getLatestWalletNumber,
  findWalletForUpdate,
  updateWalletBalance,
} from "./wallet.repository.js";

import {
  recordFunding,
  recordPayment,
} from "../transactions/transaction.service.js";

/**
 * Generate wallet number.
 *
 * wallet.repository.js returns wallet_number as a string,
 * not as an object.
 */
function generateWalletNumber(lastWallet) {
  if (!lastWallet) {
    return "3010000001";
  }

  const previousWalletNumber =
    typeof lastWallet === "object"
      ? lastWallet.wallet_number
      : lastWallet;

  const previousNumber = Number(
    previousWalletNumber
  );

  if (
    !Number.isSafeInteger(previousNumber) ||
    previousNumber < 3010000001
  ) {
    throw new Error(
      "The latest wallet number is invalid."
    );
  }

  return String(previousNumber + 1);
}

/**
 * Create wallet for user.
 */
export async function createUserWallet(userId) {
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const existingWallet =
    await findWalletByUserId(userId);

  if (existingWallet) {
    throw new Error("Wallet already exists.");
  }

  const latestWallet =
    await getLatestWalletNumber();

  const walletNumber =
    generateWalletNumber(latestWallet);

  // IMPORTANT:
  // createWallet expects one data object.
  return createWallet({
    userId,
    walletNumber,
  });
}

/**
 * Get user wallet.
 */
export async function getMyWallet(userId) {
  const wallet =
    await findWalletByUserId(userId);

  if (!wallet) {
    throw new Error("Wallet not found.");
  }

  return wallet;
}

/**
 * Credit wallet.
 *
 * Used for:
 * - Monnify funding
 * - Flutterwave funding
 * - Bank transfer
 */
export async function creditWallet({
  walletId,
  amount,
  reference,
  description,
  metadata = {},
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const wallet =
      await findWalletForUpdate(
        walletId,
        client
      );

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const balanceBefore =
      Number(wallet.available_balance);

    const balanceAfter = Number(
      (
        balanceBefore +
        Number(amount)
      ).toFixed(2)
    );

    const updatedWallet =
      await updateWalletBalance(
        walletId,
        balanceAfter,
        client
      );

    const transaction =
      await recordFunding(
        {
          walletId,
          reference,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          metadata,
        },
        client
      );

    await client.query("COMMIT");

    return {
      wallet: updatedWallet,
      transaction,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Debit wallet.
 *
 * Used for:
 * - Airtime
 * - Data
 * - CAC
 * - TIN
 * - Bills
 */
export async function debitWallet({
  walletId,
  amount,
  reference,
  description,
  metadata = {},
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const wallet =
      await findWalletForUpdate(
        walletId,
        client
      );

    if (!wallet) {
      throw new Error("Wallet not found.");
    }

    const balanceBefore =
      Number(wallet.available_balance);

    if (balanceBefore < Number(amount)) {
      throw new Error("Insufficient balance.");
    }

    const balanceAfter = Number(
      (
        balanceBefore -
        Number(amount)
      ).toFixed(2)
    );

    const updatedWallet =
      await updateWalletBalance(
        walletId,
        balanceAfter,
        client
      );

    const transaction =
      await recordPayment(
        {
          walletId,
          reference,
          amount,
          balanceBefore,
          balanceAfter,
          description,
          metadata,
        },
        client
      );

    await client.query("COMMIT");

    return {
      wallet: updatedWallet,
      transaction,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
