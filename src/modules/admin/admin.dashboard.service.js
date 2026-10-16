import {
  getUserStatistics,
  getWalletStatistics,
  getTransactionStatistics,
  getTransactionTypeStatistics,
  getRecentTransactions,
  getRecentUsers,
} from "./admin.dashboard.repository.js";

/**
 * =========================================================
 * ADMIN DASHBOARD SERVICE
 * =========================================================
 */

export async function getDashboardData() {
  const [
    users,
    wallets,
    transactions,
    transactionTypes,
    recentTransactions,
    recentUsers,
  ] = await Promise.all([
    getUserStatistics(),
    getWalletStatistics(),
    getTransactionStatistics(),
    getTransactionTypeStatistics(),
    getRecentTransactions(10),
    getRecentUsers(10),
  ]);

  /**
   * -------------------------------------------------------
   * Convert numeric PostgreSQL values
   * -------------------------------------------------------
   */

  const normalizedWallets = {
    totalAvailableBalance: Number(
      wallets.total_available_balance || 0
    ),

    totalLedgerBalance: Number(
      wallets.total_ledger_balance || 0
    ),
  };

  const normalizedTransactions = {
    totalTransactions: Number(
      transactions.total_transactions || 0
    ),

    successfulTransactions: Number(
      transactions.successful_transactions || 0
    ),

    pendingTransactions: Number(
      transactions.pending_transactions || 0
    ),

    failedTransactions: Number(
      transactions.failed_transactions || 0
    ),

    reversedTransactions: Number(
      transactions.reversed_transactions || 0
    ),

    successfulTransactionVolume: Number(
      transactions.successful_transaction_volume || 0
    ),
  };

  const normalizedTransactionTypes =
    transactionTypes.map((item) => ({
      type: item.type,

      count: Number(item.count || 0),

      volume: Number(item.volume || 0),
    }));

  /**
   * -------------------------------------------------------
   * Return dashboard payload
   * -------------------------------------------------------
   */

  return {
    users: {
      total: Number(users.total_users || 0),

      active: Number(users.active_users || 0),

      suspended: Number(
        users.suspended_users || 0
      ),

      disabled: Number(
        users.disabled_users || 0
      ),
    },

    wallets: normalizedWallets,

    transactions: normalizedTransactions,

    transactionTypes: normalizedTransactionTypes,

    recentTransactions,

    recentUsers,
  };
}