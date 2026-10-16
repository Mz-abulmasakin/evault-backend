/**
 * =========================================================
 * IDENTITY REQUEST REPOSITORY
 * =========================================================
 *
 * Handles the identity_requests ledger.
 *
 * IMPORTANT:
 *
 * identity_requests
 * -----------------
 * Stores:
 *
 * - provider information
 * - provider reference
 * - payment/transaction reference
 * - amount
 * - slip type
 * - validation type
 * - idempotency key
 * - request status
 * - provider result
 * - document information
 * - failure information
 *
 * The user's persistent identity state belongs to:
 *
 *     identity_verifications
 *
 * Do NOT mix the two tables.
 *
 * =========================================================
 */

import db from "../../config/database.js";

/**
 * =========================================================
 * CREATE IDENTITY REQUEST
 * =========================================================
 */
export async function createIdentityRequest(
  data,
  client = db
) {
  const {
    userId,
    identityType,
    provider = "INSTANTIPE",
    identifierHash,
    validationType = null,
    slipType = null,
    amount = 0,
    currency = "NGN",
    status = "PENDING",
    transactionReference = null,
    idempotencyKey = null,
    ownershipConfirmed = false,
  } = data;

  const result = await client.query(
    `
      INSERT INTO identity_requests
      (
        user_id,
        identity_type,
        provider,
        identifier_hash,
        validation_type,
        slip_type,
        amount,
        currency,
        status,
        transaction_reference,
        idempotency_key,
        ownership_confirmed
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
        $9,
        $10,
        $11,
        $12
      )
      RETURNING *
    `,
    [
      userId,
      identityType,
      provider,
      identifierHash,
      validationType,
      slipType,
      amount,
      currency,
      status,
      transactionReference,
      idempotencyKey,
      ownershipConfirmed,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND IDENTITY REQUEST BY ID
 * =========================================================
 *
 * IMPORTANT:
 *
 * This function expects ONLY the request ID:
 *
 *     findIdentityRequestById(49)
 *
 * NOT:
 *
 *     findIdentityRequestById({
 *       userId,
 *       requestId
 *     })
 *
 * Ownership-aware lookups must use:
 *
 *     findUserIdentityRequestById(id, userId)
 *
 * =========================================================
 */
export async function findIdentityRequestById(
  id,
  client = db
) {
  if (
    id === null ||
    id === undefined ||
    id === ""
  ) {
    return null;
  }

  const result = await client.query(
    `
      SELECT *
      FROM identity_requests
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND IDENTITY REQUEST BY IDEMPOTENCY KEY
 * =========================================================
 */
export async function findIdentityRequestByIdempotencyKey(
  idempotencyKey,
  client = db
) {
  if (!idempotencyKey) {
    return null;
  }

  const result = await client.query(
    `
      SELECT *
      FROM identity_requests
      WHERE idempotency_key = $1
      LIMIT 1
    `,
    [idempotencyKey]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND IDENTITY REQUEST BY PROVIDER REFERENCE
 * =========================================================
 */
export async function findIdentityRequestByProviderReference(
  providerReference,
  client = db
) {
  if (!providerReference) {
    return null;
  }

  const result = await client.query(
    `
      SELECT *
      FROM identity_requests
      WHERE provider_reference = $1
      LIMIT 1
    `,
    [providerReference]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE PROVIDER REFERENCE
 * =========================================================
 */
export async function updateProviderReference(
  id,
  providerReference,
  client = db
) {
  const result = await client.query(
    `
      UPDATE identity_requests
      SET
        provider_reference = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      providerReference,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE IDENTITY REQUEST STATUS
 * =========================================================
 */
export async function updateIdentityRequestStatus(
  id,
  status,
  client = db
) {
  const result = await client.query(
    `
      UPDATE identity_requests
      SET
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      status,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE IDENTITY REQUEST RESULT
 * =========================================================
 *
 * IMPORTANT:
 *
 * The actual PostgreSQL column is:
 *
 *     document_expires_at
 *
 * NOT:
 *
 *     document_expires
 *
 * =========================================================
 */
export async function updateIdentityRequestResult(
  id,
  resultData,
  documentUrl = null,
  documentExpiresAt = null,
  client = db
) {
  const result = await client.query(
    `
      UPDATE identity_requests
      SET
        result = $2,
        document_url =
          COALESCE(
            $3,
            document_url
          ),
        document_expires_at =
          COALESCE(
            $4,
            document_expires_at
          ),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      resultData,
      documentUrl,
      documentExpiresAt,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * NORMALIZE FAILURE VALUE
 * =========================================================
 */
function normalizeFailureText(
  value,
  fallback = null
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  let text;

  if (typeof value === "string") {
    text = value;
  } else if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    text = String(value);
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }

  return text.slice(0, 100);
}

/**
 * =========================================================
 * MARK IDENTITY REQUEST FAILED
 * =========================================================
 *
 * Supports BOTH signatures.
 *
 * OLD / INSTANTIPE:
 *
 * markIdentityRequestFailed(
 *   id,
 *   errorCode,
 *   errorMessage,
 *   client
 * )
 *
 * NEW / NETWORKDATASUB:
 *
 * markIdentityRequestFailed(
 *   id,
 *   {
 *     errorCode,
 *     errorMessage,
 *     result
 *   },
 *   client
 * )
 *
 * =========================================================
 */
export async function markIdentityRequestFailed(
  id,
  errorCodeOrData = null,
  errorMessageOrClient = null,
  possibleClient = db
) {
  let errorCode = null;
  let errorMessage = null;
  let failureResult = null;
  let client = db;

  /**
   * -------------------------------------------------------
   * NEW OBJECT STYLE
   * -------------------------------------------------------
   */
  if (
    errorCodeOrData &&
    typeof errorCodeOrData === "object" &&
    !Array.isArray(errorCodeOrData)
  ) {
    errorCode =
      errorCodeOrData.errorCode ?? null;

    errorMessage =
      errorCodeOrData.errorMessage ?? null;

    failureResult =
      errorCodeOrData.result ?? null;

    client =
      errorMessageOrClient &&
      typeof errorMessageOrClient.query === "function"
        ? errorMessageOrClient
        : db;
  } else {
    /**
     * -----------------------------------------------------
     * OLD POSITIONAL STYLE
     * -----------------------------------------------------
     */
    errorCode = errorCodeOrData;
    errorMessage = errorMessageOrClient;

    client =
      possibleClient &&
      typeof possibleClient.query === "function"
        ? possibleClient
        : db;
  }

  const normalizedErrorCode =
    normalizeFailureText(
      errorCode,
      "IDENTITY_REQUEST_FAILED"
    );

  const normalizedErrorMessage =
    normalizeFailureText(
      errorMessage,
      "Identity verification request failed."
    );

  let query;
  let values;

  /**
   * -------------------------------------------------------
   * FAILURE WITH PROVIDER RESULT
   * -------------------------------------------------------
   */
  if (failureResult !== null) {
    query = `
      UPDATE identity_requests
      SET
        status = 'FAILED',
        error_code = $2,
        error_message = $3,
        result = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    values = [
      id,
      normalizedErrorCode,
      normalizedErrorMessage,
      failureResult,
    ];
  } else {
    /**
     * -----------------------------------------------------
     * FAILURE WITHOUT PROVIDER RESULT
     * -----------------------------------------------------
     */
    query = `
      UPDATE identity_requests
      SET
        status = 'FAILED',
        error_code = $2,
        error_message = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    values = [
      id,
      normalizedErrorCode,
      normalizedErrorMessage,
    ];
  }

  const result = await client.query(
    query,
    values
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND ALL IDENTITY REQUESTS FOR USER
 * =========================================================
 */
export async function findIdentityRequestsByUserId(
  userId,
  limit = 20,
  offset = 0,
  client = db
) {
  const result = await client.query(
    `
      SELECT *
      FROM identity_requests
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      OFFSET $3
    `,
    [
      userId,
      limit,
      offset,
    ]
  );

  return result.rows;
}

/**
 * =========================================================
 * FIND ONE USER IDENTITY REQUEST
 * =========================================================
 *
 * This is the ownership-protected lookup.
 *
 * Example:
 *
 * findUserIdentityRequestById(
 *   49,
 *   "2b0c463d-24ea-48ce-8347-7fdb39f2079e"
 * )
 *
 * =========================================================
 */
export async function findUserIdentityRequestById(
  id,
  userId,
  client = db
) {
  if (
    id === null ||
    id === undefined ||
    id === ""
  ) {
    return null;
  }

  if (!userId) {
    return null;
  }

  const result = await client.query(
    `
      SELECT *
      FROM identity_requests
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [
      id,
      userId,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */
export default {
  createIdentityRequest,
  findIdentityRequestById,
  findIdentityRequestByIdempotencyKey,
  findIdentityRequestByProviderReference,
  updateProviderReference,
  updateIdentityRequestStatus,
  updateIdentityRequestResult,
  markIdentityRequestFailed,
  findIdentityRequestsByUserId,
  findUserIdentityRequestById,
};