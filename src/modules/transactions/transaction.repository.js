
// src/modules/transactions/transaction.repository.js

import db from "../../config/database.js";

/**
 * =========================================================
 * CREATE TRANSACTION
 * =========================================================
 */
export async function createTransaction(
  data,
  client = db
) {
  const {
    walletId,
    reference,
    type,
    amount,
    balanceBefore,
    balanceAfter,
    status = "SUCCESS",
    description,
    metadata = {},
  } = data;

  const result = await client.query(
    `
    INSERT INTO transactions
    (
      wallet_id,
      reference,
      type,
      amount,
      balance_before,
      balance_after,
      status,
      description,
      metadata
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9
    )
    RETURNING *
    `,
    [
      walletId,
      reference,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      status,
      description,
      metadata,
    ]
  );

  return result.rows[0];
}


/**
 * =========================================================
 * FIND TRANSACTION BY ID
 * =========================================================
 */
export async function findTransactionById(
  id
) {
  const result = await db.query(
    `
    SELECT *
    FROM transactions
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}


/**
 * =========================================================
 * FIND TRANSACTION BY REFERENCE
 * =========================================================
 */
export async function findTransactionByReference(
  reference
) {
  const result = await db.query(
    `
    SELECT *
    FROM transactions
    WHERE reference = $1
    LIMIT 1
    `,
    [reference]
  );

  return result.rows[0] || null;
}


/**
 * =========================================================
 * FIND TRANSACTIONS BY WALLET
 * =========================================================
 */
export async function findTransactionsByWallet(
  walletId
) {
  const result = await db.query(
    `
    SELECT *
    FROM transactions
    WHERE wallet_id = $1
    ORDER BY created_at DESC
    `,
    [walletId]
  );

  return result.rows;
}


/**
 * =========================================================
 * FIND TRANSACTIONS BY WALLET — PAGINATED
 * =========================================================
 */
export async function findTransactionsByWalletPaginated(
  walletId,
  limit = 50,
  offset = 0
) {
  const result = await db.query(
    `
    SELECT *
    FROM transactions
    WHERE wallet_id = $1
    ORDER BY created_at DESC
    LIMIT $2
    OFFSET $3
    `,
    [
      walletId,
      limit,
      offset,
    ]
  );

  return result.rows;
}


/**
 * =========================================================
 * UPDATE TRANSACTION STATUS
 * =========================================================
 *
 * Supported calls:
 *
 * ---------------------------------------------------------
 * 1.
 *
 * updateTransactionStatus(
 *   transactionId,
 *   status
 * )
 *
 * ---------------------------------------------------------
 * 2.
 *
 * updateTransactionStatus(
 *   transactionId,
 *   status,
 *   client
 * )
 *
 * ---------------------------------------------------------
 * 3.
 *
 * updateTransactionStatus(
 *   reference,
 *   status,
 *   metadata,
 *   client
 * )
 *
 * ---------------------------------------------------------
 *
 * The identifier can be either:
 *
 * - transaction UUID
 * - transaction reference
 *
 * Existing metadata is preserved and merged with
 * the new metadata.
 *
 * =========================================================
 */
export async function updateTransactionStatus(
  identifier,
  status,
  metadataOrClient = {},
  possibleClient = db
) {
  let metadata = {};
  let client = possibleClient;


  /**
   * -------------------------------------------------------
   * BACKWARD COMPATIBILITY
   * -------------------------------------------------------
   *
   * If the third argument has a query() function,
   * it is a PostgreSQL client rather than metadata.
   */
  if (
    metadataOrClient &&
    typeof metadataOrClient.query === "function"
  ) {
    client = metadataOrClient;
    metadata = {};
  } else {
    metadata =
      metadataOrClient &&
      typeof metadataOrClient === "object"
        ? metadataOrClient
        : {};

    client = possibleClient || db;
  }


  /**
   * -------------------------------------------------------
   * UPDATE TRANSACTION
   * -------------------------------------------------------
   *
   * We support both transaction UUID and reference.
   *
   * Existing JSONB metadata is merged with the new
   * metadata supplied by the caller.
   */
  const result = await client.query(
    `
    UPDATE transactions
    SET
      status = $2,

      metadata =
        COALESCE(metadata, '{}'::jsonb)
        ||
        $3::jsonb,

      updated_at = CURRENT_TIMESTAMP

    WHERE
      id::text = $1
      OR reference = $1

    RETURNING *
    `,
    [
      String(identifier),
      status,
      JSON.stringify(metadata),
    ]
  );


  /**
   * -------------------------------------------------------
   * RETURN UPDATED TRANSACTION
   * -------------------------------------------------------
   */
  return result.rows[0] || null;
}

