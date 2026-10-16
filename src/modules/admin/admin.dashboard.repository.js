import db from "../../config/database.js";

/**
 * =========================================================
 * ADMIN DASHBOARD REPOSITORY
 * =========================================================
 *
 * Read-only queries used by the admin dashboard.
 *
 * IMPORTANT:
 * This repository does not modify customer data.
 * =========================================================
 */

/**
 * =========================================================
 * USER STATISTICS
 * =========================================================
 */
export async function getUserStatistics() {
  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total_users,

      COUNT(*) FILTER (
        WHERE status = 'ACTIVE'
      )::int AS active_users,

      COUNT(*) FILTER (
        WHERE status = 'SUSPENDED'
      )::int AS suspended_users,

      COUNT(*) FILTER (
        WHERE status = 'DISABLED'
      )::int AS disabled_users

    FROM users
    WHERE deleted_at IS NULL
  `);

  return result.rows[0];
}

/**
 * =========================================================
 * WALLET STATISTICS
 * =========================================================
 */
export async function getWalletStatistics() {
  const result = await db.query(`
    SELECT
      COALESCE(
        SUM(available_balance),
        0
      )::numeric(18,2) AS total_available_balance,

      COALESCE(
        SUM(ledger_balance),
        0
      )::numeric(18,2) AS total_ledger_balance

    FROM wallets
  `);

  return result.rows[0];
}

/**
 * =========================================================
 * TRANSACTION STATISTICS
 * =========================================================
 */
export async function getTransactionStatistics() {
  const result = await db.query(`
    SELECT
      COUNT(*)::int AS total_transactions,

      COUNT(*) FILTER (
        WHERE status = 'SUCCESS'
      )::int AS successful_transactions,

      COUNT(*) FILTER (
        WHERE status = 'PENDING'
      )::int AS pending_transactions,

      COUNT(*) FILTER (
        WHERE status = 'FAILED'
      )::int AS failed_transactions,

      COUNT(*) FILTER (
        WHERE status = 'REVERSED'
      )::int AS reversed_transactions,

      COALESCE(
        SUM(amount) FILTER (
          WHERE status = 'SUCCESS'
        ),
        0
      )::numeric(18,2) AS successful_transaction_volume

    FROM transactions
  `);

  return result.rows[0];
}

/**
 * =========================================================
 * TRANSACTION TYPE STATISTICS
 * =========================================================
 */
export async function getTransactionTypeStatistics() {
  const result = await db.query(`
    SELECT
      type,

      COUNT(*)::int AS count,

      COALESCE(
        SUM(amount),
        0
      )::numeric(18,2) AS volume

    FROM transactions

    WHERE status = 'SUCCESS'

    GROUP BY type

    ORDER BY type
  `);

  return result.rows;
}

/**
 * =========================================================
 * RECENT TRANSACTIONS
 * =========================================================
 */
export async function getRecentTransactions(limit = 10) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    50
  );

  const result = await db.query(
    `
    SELECT
      t.id,
      t.reference,
      t.type,
      t.amount,
      t.balance_before,
      t.balance_after,
      t.status,
      t.description,
      t.metadata,
      t.created_at,

      u.id AS user_id,
      u.username,
      u.full_name,
      u.email,
      u.phone_number

    FROM transactions t

    LEFT JOIN wallets w
      ON w.id = t.wallet_id

    LEFT JOIN users u
      ON u.id = w.user_id

    ORDER BY t.created_at DESC

    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

/**
 * =========================================================
 * RECENT USERS
 * =========================================================
 */
export async function getRecentUsers(limit = 10) {
  const safeLimit = Math.min(
    Math.max(Number(limit) || 10, 1),
    50
  );

  const result = await db.query(
    `
    SELECT
      id,
      username,
      full_name,
      email,
      phone_number,
      status,
      email_verified,
      phone_verified,
      created_at

    FROM users

    WHERE deleted_at IS NULL

    ORDER BY created_at DESC

    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}