
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

async function runDashboardQuery(name, operation) {
  try {
    return await operation();
  } catch (error) {
    console.error("--------------------------------------");
    console.error(`[ADMIN DASHBOARD] Failed: ${name}`);
    console.error("Message:", error.message);
    console.error("PostgreSQL code:", error.code);
    console.error("Detail:", error.detail);
    console.error("Hint:", error.hint);
    console.error("Position:", error.position);
    console.error("--------------------------------------");

    throw new Error(
      `Dashboard operation failed: ${name}`,
      { cause: error }
    );
  }
}

export async function getDashboardData() {
  const [
    users,
    wallets,
    transactions,
    transactionTypes,
    recentTransactions,
    recentUsers,
  ] = await Promise.all([
    runDashboardQuery(
      "User statistics",
      getUserStatistics
    ),

    runDashboardQuery(
      "Wallet statistics",
      getWalletStatistics
    ),

    runDashboardQuery(
      "Transaction statistics",
      getTransactionStatistics
    ),

    runDashboardQuery(
      "Transaction type statistics",
      getTransactionTypeStatistics
    ),

    runDashboardQuery(
      "Recent transactions",
      () => getRecentTransactions(10)
    ),

    runDashboardQuery(
      "Recent users",
      () => getRecentUsers(10)
    ),
  ]);

  return {
    users: {
      total: Number(users.total_users || 0),
      active: Number(users.active_users || 0),
      suspended: Number(users.suspended_users || 0),
      disabled: Number(users.disabled_users || 0),
    },

    wallets: {
      totalAvailableBalance: Number(
        wallets.total_available_balance || 0
      ),

      totalLedgerBalance: Number(
        wallets.total_ledger_balance || 0
      ),
    },

    transactions: {
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
    },

    transactionTypes: transactionTypes.map((item) => ({
      type: item.type,
      count: Number(item.count || 0),
      volume: Number(item.volume || 0),
    })),

    recentTransactions,
    recentUsers,
  };
}
