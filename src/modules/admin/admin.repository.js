import db from "../../config/database.js";

/**
 * =========================================================
 * FIND ADMIN BY IDENTIFIER
 * =========================================================
 *
 * Supports:
 * - username
 * - email
 *
 * =========================================================
 */

export async function findAdminByIdentifier(
  identifier
) {
  const result = await db.query(
    `
    SELECT *
    FROM admin_users
    WHERE
      LOWER(username) = LOWER($1)
      OR LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [identifier]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND ADMIN BY ID
 * =========================================================
 */

export async function findAdminById(
  adminId
) {
  const result = await db.query(
    `
    SELECT
      id,
      username,
      email,
      full_name,
      role,
      status,
      last_login_at,
      created_at,
      updated_at
    FROM admin_users
    WHERE id = $1
    LIMIT 1
    `,
    [adminId]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND ADMIN BY USERNAME
 * =========================================================
 */

export async function findAdminByUsername(
  username
) {
  const result = await db.query(
    `
    SELECT *
    FROM admin_users
    WHERE LOWER(username) = LOWER($1)
    LIMIT 1
    `,
    [username]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * FIND ADMIN BY EMAIL
 * =========================================================
 */

export async function findAdminByEmail(
  email
) {
  const result = await db.query(
    `
    SELECT *
    FROM admin_users
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

/**
 * =========================================================
 * CREATE ADMIN
 * =========================================================
 *
 * This is intentionally not exposed through a public route.
 * Initial/admin creation will be handled separately.
 *
 * =========================================================
 */

export async function createAdmin(
  {
    username,
    email,
    fullName,
    passwordHash,
    role = "ADMIN",
    status = "ACTIVE",
  }
) {
  const result = await db.query(
    `
    INSERT INTO admin_users
    (
      username,
      email,
      full_name,
      password_hash,
      role,
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
    RETURNING
      id,
      username,
      email,
      full_name,
      role,
      status,
      last_login_at,
      created_at,
      updated_at
    `,
    [
      username,
      email,
      fullName,
      passwordHash,
      role,
      status,
    ]
  );

  return result.rows[0];
}

/**
 * =========================================================
 * UPDATE LAST LOGIN
 * =========================================================
 */

export async function updateAdminLastLogin(
  adminId
) {
  const result = await db.query(
    `
    UPDATE admin_users
    SET
      last_login_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING
      id,
      username,
      email,
      full_name,
      role,
      status,
      last_login_at,
      created_at,
      updated_at
    `,
    [adminId]
  );

  return result.rows[0] || null;
}