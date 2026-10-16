// src/modules/profile/profile.repository.js

import db from "../../config/database.js";

// =========================================================
// FIND USER SECURITY INFORMATION
// =========================================================

export async function findUserById(userId) {
  const result = await db.query(
    `
    SELECT
      id,
      password_hash,
      transaction_pin_hash
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

// =========================================================
// CREATE PIN ONLY IF ONE DOES NOT ALREADY EXIST
// =========================================================

export async function createTransactionPinIfAbsent(
  userId,
  pinHash
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      transaction_pin_hash = $1,
      pin_created_at = COALESCE(
        pin_created_at,
        CURRENT_TIMESTAMP
      ),
      pin_updated_at = CURRENT_TIMESTAMP
    WHERE
      id = $2
      AND transaction_pin_hash IS NULL
    RETURNING
      id,
      pin_created_at,
      pin_updated_at
    `,
    [pinHash, userId]
  );

  return result.rows[0] || null;
}

// =========================================================
// CHANGE PIN ONLY IF THE CURRENT HASH HAS NOT CHANGED
// =========================================================

export async function updateTransactionPinIfHashMatches(
  userId,
  currentPinHash,
  newPinHash
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      transaction_pin_hash = $1,
      pin_created_at = COALESCE(
        pin_created_at,
        CURRENT_TIMESTAMP
      ),
      pin_updated_at = CURRENT_TIMESTAMP
    WHERE
      id = $2
      AND transaction_pin_hash = $3
    RETURNING
      id,
      pin_created_at,
      pin_updated_at
    `,
    [
      newPinHash,
      userId,
      currentPinHash,
    ]
  );

  return result.rows[0] || null;
}

// =========================================================
// EXISTING GENERAL SAVE FUNCTION
//
// Retained for compatibility with any existing callers.
// Creation and PIN changes should use the safer functions above.
// =========================================================

export async function saveTransactionPin(
  userId,
  pinHash
) {
  const result = await db.query(
    `
    UPDATE users
    SET
      transaction_pin_hash = $1,
      pin_created_at = COALESCE(
        pin_created_at,
        CURRENT_TIMESTAMP
      ),
      pin_updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING
      id,
      pin_created_at,
      pin_updated_at
    `,
    [pinHash, userId]
  );

  return result.rows[0] || null;
}

// =========================================================
// GET TRANSACTION PIN HASH
// =========================================================

export async function getTransactionPinHash(userId) {
  const result = await db.query(
    `
    SELECT
      id,
      transaction_pin_hash
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

// =========================================================
// GET PIN STATUS WITHOUT RETURNING THE HASH
// =========================================================

export async function getTransactionPinStatus(userId) {
  const result = await db.query(
    `
    SELECT
      id,
      (transaction_pin_hash IS NOT NULL)
        AS has_transaction_pin
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0] || null;
}