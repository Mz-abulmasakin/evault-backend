 // src/modules/identity/identity.repository.js

import db from "../../config/database.js";

/**
 * =========================================================
 * CREATE IDENTITY VERIFICATION
 * =========================================================
 *
 * identity_verifications contains ONLY the user's persistent
 * identity state:
 *
 * id
 * user_id
 * bvn
 * nin
 * bvn_verified
 * nin_verified
 * status
 * updated_at
 *
 * Provider/request-specific information belongs in
 * identity_requests.
 * =========================================================
 */
export async function createIdentityVerification(data) {
  const {
    userId,
    bvn = null,
    nin = null,
    bvnVerified = false,
    ninVerified = false,
    status = "PENDING",
  } = data;

  const result = await db.query(
    `
      INSERT INTO identity_verifications
      (
        user_id,
        bvn,
        nin,
        bvn_verified,
        nin_verified,
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
      bvn,
      nin,
      bvnVerified,
      ninVerified,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * =========================================================
 * FIND IDENTITY BY USER
 * =========================================================
 */
export async function findIdentityByUserId(userId) {
  const result = await db.query(
    `
      SELECT *
      FROM identity_verifications
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND IDENTITY BY ID
 * =========================================================
 */
export async function findIdentityById(id) {
  const result = await db.query(
    `
      SELECT *
      FROM identity_verifications
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND BY BVN
 * =========================================================
 */
export async function findIdentityByBvn(bvn) {
  const result = await db.query(
    `
      SELECT *
      FROM identity_verifications
      WHERE bvn = $1
      LIMIT 1
    `,
    [bvn]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND BY NIN
 * =========================================================
 */
export async function findIdentityByNin(nin) {
  const result = await db.query(
    `
      SELECT *
      FROM identity_verifications
      WHERE nin = $1
      LIMIT 1
    `,
    [nin]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE IDENTITY
 * =========================================================
 */
export async function updateIdentityVerification(
  userId,
  data
) {
  const {
    bvn,
    nin,
    bvnVerified,
    ninVerified,
    status,
  } = data;

  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        bvn = COALESCE($2, bvn),
        nin = COALESCE($3, nin),
        bvn_verified = COALESCE($4, bvn_verified),
        nin_verified = COALESCE($5, nin_verified),
        status = COALESCE($6, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `,
    [
      userId,
      bvn ?? null,
      nin ?? null,
      bvnVerified ?? null,
      ninVerified ?? null,
      status ?? null,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPSERT IDENTITY
 * =========================================================
 */
export async function upsertIdentityVerification(data) {
  const {
    userId,
    bvn = null,
    nin = null,
    bvnVerified = false,
    ninVerified = false,
    status = "PENDING",
  } = data;

  const result = await db.query(
    `
      INSERT INTO identity_verifications
      (
        user_id,
        bvn,
        nin,
        bvn_verified,
        nin_verified,
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

      ON CONFLICT (user_id)

      DO UPDATE SET

        bvn = COALESCE(
          EXCLUDED.bvn,
          identity_verifications.bvn
        ),

        nin = COALESCE(
          EXCLUDED.nin,
          identity_verifications.nin
        ),

        bvn_verified = CASE
          WHEN EXCLUDED.bvn IS NOT NULL
            THEN EXCLUDED.bvn_verified
          ELSE identity_verifications.bvn_verified
        END,

        nin_verified = CASE
          WHEN EXCLUDED.nin IS NOT NULL
            THEN EXCLUDED.nin_verified
          ELSE identity_verifications.nin_verified
        END,

        status = EXCLUDED.status,

        updated_at = CURRENT_TIMESTAMP

      RETURNING *
    `,
    [
      userId,
      bvn,
      nin,
      bvnVerified,
      ninVerified,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * =========================================================
 * UPDATE BVN
 * =========================================================
 */
export async function updateBvn(
  userId,
  bvn,
  verified = false
) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        bvn = $2,
        bvn_verified = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `,
    [
      userId,
      bvn,
      verified,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE NIN
 * =========================================================
 */
export async function updateNin(
  userId,
  nin,
  verified = false
) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        nin = $2,
        nin_verified = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `,
    [
      userId,
      nin,
      verified,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * MARK BVN VERIFIED
 * =========================================================
 */
export async function markBvnAsVerified(userId) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        bvn_verified = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * MARK NIN VERIFIED
 * =========================================================
 */
export async function markNinAsVerified(userId) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        nin_verified = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * UPDATE STATUS
 * =========================================================
 */
export async function updateIdentityStatus(
  userId,
  status
) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
      RETURNING *
    `,
    [
      userId,
      status,
    ]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * DELETE IDENTITY
 * =========================================================
 */
export async function deleteIdentityVerification(
  userId
) {
  const result = await db.query(
    `
      DELETE FROM identity_verifications
      WHERE user_id = $1
      RETURNING *
    `,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * NIN VERIFICATION UPSERT
 * =========================================================
 *
 * IMPORTANT:
 *
 * Do NOT store provider/request information here.
 *
 * Provider information belongs in identity_requests.
 *
 * This function is intentionally compatible with the current
 * nin.service.js call:
 *
 * upsertNinVerification({
 *   userId,
 *   nin,
 *   ninVerified: false,
 *   status: "PENDING"
 * })
 *
 * It also accepts additional fields without trying to insert
 * them into identity_verifications.
 * =========================================================
 */
export async function upsertNinVerification(
  data,
  client = db
) {
  const {
    userId,
    nin,
    ninVerified = false,
    status = "PENDING",
  } = data;

  const result = await client.query(
    `
      INSERT INTO identity_verifications
      (
        user_id,
        nin,
        nin_verified,
        status,
        updated_at
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT (user_id)

      DO UPDATE SET
        nin = EXCLUDED.nin,
        nin_verified = EXCLUDED.nin_verified,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP

      RETURNING *
    `,
    [
      userId,
      nin,
      ninVerified,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * =========================================================
 * PROVIDER REFERENCE COMPATIBILITY LOOKUP
 * =========================================================
 *
 * Provider references are stored in identity_requests,
 * NOT identity_verifications.
 *
 * This function is retained for compatibility with older
 * code that may import it.
 *
 * The actual provider/request lookup should be performed
 * through identityRequest.repository.js.
 * =========================================================
 */
export async function findIdentityByProviderReference(
  provider,
  providerReference
) {
  return null;
}

/**
 * =========================================================
 * IDEMPOTENCY COMPATIBILITY LOOKUP
 * =========================================================
 *
 * Idempotency keys belong to identity_requests.
 *
 * The actual lookup is handled by:
 *
 * findIdentityRequestByIdempotencyKey()
 *
 * in identityRequest.repository.js.
 * =========================================================
 */
export async function findIdentityByIdempotencyKey(
  idempotencyKey
) {
  return null;
}

/**
 * =========================================================
 * NIN PROVIDER REFERENCE
 * =========================================================
 *
 * These functions are retained so old imports do not crash,
 * but provider-specific state must be stored in
 * identity_requests.
 *
 * identity_verifications has no provider_reference column.
 * =========================================================
 */
export async function updateNinProviderReference(
  identityId,
  providerReference,
  providerStatus = "pending"
) {
  return null;
}

/**
 * =========================================================
 * NIN PROVIDER STATUS
 * =========================================================
 */
export async function updateNinProviderStatus(
  identityId,
  providerStatus
) {
  return null;
}

/**
 * =========================================================
 * COMPLETE NIN VERIFICATION
 * =========================================================
 *
 * Only update fields that actually exist in
 * identity_verifications.
 *
 * Provider result/document information remains in
 * identity_requests.
 * =========================================================
 */
export async function completeNinVerification({
  identityId,
  providerStatus = "done",
  resultData = null,
  documentUrl = null,
  documentExpiresAt = null,
}) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        nin_verified = TRUE,
        status = 'VERIFIED',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [identityId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FAIL NIN VERIFICATION
 * =========================================================
 *
 * Error/provider details belong in identity_requests.
 *
 * Here we only mark the persistent identity state as failed.
 * =========================================================
 */
export async function failNinVerification({
  identityId,
  providerStatus = "failed",
  errorCode = null,
  errorMessage = null,
  resultData = null,
}) {
  const result = await db.query(
    `
      UPDATE identity_verifications
      SET
        nin_verified = FALSE,
        status = 'FAILED',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `,
    [identityId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * GET NIN VERIFICATION FOR USER
 * =========================================================
 */
export async function getNinVerificationForUser(
  identityId,
  userId
) {
  const result = await db.query(
    `
      SELECT *
      FROM identity_verifications
      WHERE id = $1
        AND user_id = $2
      LIMIT 1
    `,
    [
      identityId,
      userId,
    ]
  );

  return result.rows[0] || null;
}