import {
  createTransaction,
  findTransactionByReference,
  findTransactionById,
  findTransactionsByWallet,
  updateTransactionStatus,
} from "./transaction.repository.js";

import {
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
} from "./transaction.constants.js";


/**
 * =========================================================
 * RECORD TRANSACTION
 * =========================================================
 */
export async function recordTransaction(
  data,
  client
) {
  if (!data?.walletId) {
    throw new Error(
      "Wallet ID is required to record transaction"
    );
  }

  if (!data?.reference) {
    throw new Error(
      "Transaction reference is required"
    );
  }

  if (!data?.amount) {
    throw new Error(
      "Transaction amount is required"
    );
  }

  if (!data?.type) {
    throw new Error(
      "Transaction type is required"
    );
  }

  return await createTransaction(
    {
      ...data,

      status:
        data.status ||
        TRANSACTION_STATUS.SUCCESS,

      metadata:
        data.metadata ||
        {},
    },
    client
  );
}


/**
 * =========================================================
 * RECORD WALLET FUNDING
 * =========================================================
 */
export async function recordFunding(
  data,
  client
) {
  return await recordTransaction(
    {
      ...data,

      type:
        TRANSACTION_TYPES.FUNDING,

      description:
        data.description ||
        "Wallet funded",
    },
    client
  );
}


/**
 * =========================================================
 * RECORD WALLET PAYMENT
 * =========================================================
 */
export async function recordPayment(
  data,
  client
) {
  return await recordTransaction(
    {
      ...data,

      type:
        TRANSACTION_TYPES.PAYMENT,

      description:
        data.description ||
        "Wallet payment",
    },
    client
  );
}


/**
 * =========================================================
 * GET TRANSACTION BY REFERENCE
 * =========================================================
 */
export async function getTransaction(
  reference
) {
  if (!reference) {
    throw new Error(
      "Transaction reference is required"
    );
  }

  return await findTransactionByReference(
    reference
  );
}


/**
 * =========================================================
 * GET TRANSACTION BY ID
 * =========================================================
 */
export async function getTransactionById(
  id
) {
  if (!id) {
    throw new Error(
      "Transaction ID is required"
    );
  }

  return await findTransactionById(id);
}


/**
 * =========================================================
 * GET WALLET TRANSACTIONS
 * =========================================================
 */
export async function getWalletTransactions(
  walletId
) {
  if (!walletId) {
    throw new Error(
      "Wallet ID is required"
    );
  }

  return await findTransactionsByWallet(
    walletId
  );
}


/**
 * =========================================================
 * UPDATE TRANSACTION STATUS
 * =========================================================
 */
export async function changeTransactionStatus(
  id,
  status
) {
  if (!id) {
    throw new Error(
      "Transaction ID is required"
    );
  }

  if (!status) {
    throw new Error(
      "Transaction status is required"
    );
  }

  return await updateTransactionStatus(
    id,
    status
  );
}