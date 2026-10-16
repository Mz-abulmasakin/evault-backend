// src/modules/wallet/wallet.repository.js

import db from "../../config/database.js";

/**
 * =========================================================
 * WALLET REPOSITORY
 * =========================================================
 *
 * Database access layer for wallets.
 *
 * IMPORTANT:
 * All functions are exported as NAMED EXPORTS because
 * wallet.service.js imports them using:
 *
 * import {
 *   createWallet,
 *   ...
 * } from "./wallet.repository.js";
 *
 * =========================================================
 */

/**
 * =========================================================
 * CREATE WALLET
 * =========================================================
 */
export async function createWallet(
  data,
  client = db
) {
  const {
    userId,
    walletNumber,
    availableBalance = 0,
    ledgerBalance = 0,
    currency = "NGN",
    status = "ACTIVE",
  } = data;

  const result = await client.query(
    `
    INSERT INTO wallets
    (
      user_id,
      wallet_number,
      available_balance,
      ledger_balance,
      currency,
      status
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6
    )
    RETURNING *
    `,
    [
      userId,
      walletNumber,
      availableBalance,
      ledgerBalance,
      currency,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * =========================================================
 * FIND WALLET BY USER ID
 * =========================================================
 */
export async function findWalletByUserId(
  userId
) {
  const result = await db.query(
    `
    SELECT *
    FROM wallets
    WHERE user_id = $1
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND WALLET BY WALLET NUMBER
 * =========================================================
 */
export async function findWalletByWalletNumber(
  walletNumber
) {
  const result = await db.query(
    `
    SELECT *
    FROM wallets
    WHERE wallet_number = $1
    LIMIT 1
    `,
    [walletNumber]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND WALLET FOR UPDATE
 * =========================================================
 *
 * Used when a transaction needs to safely lock a wallet
 * row before changing its balance.
 *
 * IMPORTANT:
 * This function expects wallet ID.
 * =========================================================
 */
export async function findWalletForUpdate(
  walletId,
  client = db
) {
  const result = await client.query(
    `
    SELECT *
    FROM wallets
    WHERE id = $1
    FOR UPDATE
    `,
    [walletId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND WALLET FOR UPDATE BY USER ID
 * =========================================================
 *
 * Useful for services where we only have userId.
 * =========================================================
 */
export async function findWalletForUpdateByUserId(
  userId,
  client = db
) {
  const result = await client.query(
    `
    SELECT *
    FROM wallets
    WHERE user_id = $1
    FOR UPDATE
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE WALLET BALANCE
 * =========================================================
 */
export async function updateWalletBalance(
  walletId,
  newBalance,
  client = db
) {
  const result = await client.query(
    `
    UPDATE wallets
    SET
      available_balance = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      walletId,
      newBalance,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * CREDIT WALLET
 * =========================================================
 */
export async function creditWallet(
  walletId,
  amount,
  client = db
) {
  const result = await client.query(
    `
    UPDATE wallets
    SET
      available_balance =
        available_balance + $2,
      ledger_balance =
        ledger_balance + $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      walletId,
      amount,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * DEBIT WALLET
 * =========================================================
 */
export async function debitWallet(
  walletId,
  amount,
  client = db
) {
  const result = await client.query(
    `
    UPDATE wallets
    SET
      available_balance =
        available_balance - $2,
      ledger_balance =
        ledger_balance - $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE
      id = $1
      AND available_balance >= $2
    RETURNING *
    `,
    [
      walletId,
      amount,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * GET LATEST WALLET NUMBER
 * =========================================================
 */
export async function getLatestWalletNumber() {
  const result = await db.query(
    `
    SELECT wallet_number
    FROM wallets
    ORDER BY created_at DESC
    LIMIT 1
    `
  );

  return result.rows[0]?.wallet_number || null;
}

/**
 * =========================================================
 * UPDATE WALLET STATUS
 * =========================================================
 */
export async function updateWalletStatus(
  walletId,
  status,
  client = db
) {
  const result = await client.query(
    `
    UPDATE wallets
    SET
      status = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      walletId,
      status,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 *
 * Named exports above are the important part.
 * This default export is included for compatibility with
 * any existing code that may import the repository object.
 * =========================================================
 */
export default {
  createWallet,
  findWalletByUserId,
  findWalletByWalletNumber,
  findWalletForUpdate,
  findWalletForUpdateByUserId,
  updateWalletBalance,
  creditWallet,
  debitWallet,
  getLatestWalletNumber,
  updateWalletStatus,
};