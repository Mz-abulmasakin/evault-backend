import {
  getWalletTransactions,
  getTransaction,
} from "./transaction.service.js";

import {
  findWalletByUserId,
} from "../wallet/wallet.repository.js";


/**
 * =========================================================
 * GET LOGGED-IN USER WALLET TRANSACTIONS
 * =========================================================
 */
export async function walletTransactions(
  req,
  res
) {
  try {
    const userId = req.user.id;

    const wallet =
      await findWalletByUserId(userId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    const transactions =
      await getWalletTransactions(
        wallet.id
      );

    return res.status(200).json({
      success: true,
      data: transactions,
    });

  } catch (error) {
    console.error(
      "Wallet Transactions Error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch transactions",
    });
  }
}


/**
 * =========================================================
 * GET SINGLE TRANSACTION
 * =========================================================
 */
export async function transactionDetails(
  req,
  res
) {
  try {
    const userId = req.user.id;

    const { reference } =
      req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message:
          "Transaction reference is required",
      });
    }

    /**
     * Find user's wallet first.
     */
    const wallet =
      await findWalletByUserId(userId);

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    /**
     * Find transaction.
     */
    const transaction =
      await getTransaction(
        reference
      );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message:
          "Transaction not found",
      });
    }

    /**
     * Security:
     * Make sure this transaction belongs
     * to the logged-in user's wallet.
     */
    if (
      transaction.wallet_id !==
      wallet.id
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to view this transaction",
      });
    }

    return res.status(200).json({
      success: true,
      data: transaction,
    });

  } catch (error) {
    console.error(
      "Transaction Details Error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to fetch transaction",
    });
  }
}