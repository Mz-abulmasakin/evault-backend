// src/modules/funding/monnify.repository.js

import db from "../../config/database.js";


/**
 * =========================================================
 * SAVE MONNIFY DEDICATED ACCOUNT
 * =========================================================
 */
export async function saveReservedAccount(
  data,
  client = db
) {

  const result =
    await client.query(
      `
      INSERT INTO monnify_accounts
      (
        user_id,
        wallet_id,
        account_number,
        account_name,
        bank_name,
        account_reference,
        reservation_reference,
        status
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
        'ACTIVE'
      )
      RETURNING *
      `,
      [
        data.userId,
        data.walletId,
        data.accountNumber,
        data.accountName,
        data.bankName,
        data.accountReference,
        data.reservationReference,
      ]
    );

  return result.rows[0];
}


/**
 * =========================================================
 * FIND BY USER
 * =========================================================
 */
export async function findReservedAccountByUser(
  userId
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM monnify_accounts
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId]
    );

  return result.rows[0] || null;
}


/**
 * =========================================================
 * FIND BY ACCOUNT NUMBER
 * =========================================================
 */
export async function findReservedAccountByNumber(
  accountNumber
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM monnify_accounts
      WHERE account_number = $1
      LIMIT 1
      `,
      [accountNumber]
    );

  return result.rows[0] || null;
}


/**
 * =========================================================
 * FIND BY ACCOUNT REFERENCE
 * =========================================================
 */
export async function findReservedAccountByReference(
  accountReference
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM monnify_accounts
      WHERE account_reference = $1
      LIMIT 1
      `,
      [accountReference]
    );

  return result.rows[0] || null;
}


/**
 * =========================================================
 * FIND BY RESERVATION REFERENCE
 * =========================================================
 */
export async function findReservedAccountByReservationReference(
  reservationReference
) {

  const result =
    await db.query(
      `
      SELECT *
      FROM monnify_accounts
      WHERE reservation_reference = $1
      LIMIT 1
      `,
      [reservationReference]
    );

  return result.rows[0] || null;
}


/**
 * =========================================================
 * UPDATE ACCOUNT STATUS
 * =========================================================
 */
export async function updateReservedAccountStatus(
  accountNumber,
  status
) {

  const result =
    await db.query(
      `
      UPDATE monnify_accounts
      SET
        status = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE account_number = $1
      RETURNING *
      `,
      [
        accountNumber,
        status,
      ]
    );

  return result.rows[0] || null;
}