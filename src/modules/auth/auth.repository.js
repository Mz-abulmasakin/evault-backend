import pool from "../../config/database.js";

/**
 * ==========================================
 * CREATE USER
 * ==========================================
 */
export const createUser = async (userData) => {
  const {
    username,
    fullName,
    email,
    phoneNumber,
    passwordHash,
  } = userData;

  const query = `
    INSERT INTO users
    (
      username,
      full_name,
      email,
      phone_number,
      password_hash
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      $5
    )
    RETURNING *;
  `;

  const values = [
    username,
    fullName,
    email,
    phoneNumber,
    passwordHash,
  ];

  const result = await pool.query(query, values);

  return result.rows[0];
};


/**
 * ==========================================
 * FIND USER BY IDENTIFIER
 * ==========================================
 *
 * Supports:
 * - username
 * - email
 * - phone number
 */
export const findUserByIdentifier = async (identifier) => {
  const query = `
    SELECT *
    FROM users
    WHERE
      username = $1
      OR email = $1
      OR phone_number = $1
    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [identifier]
  );

  return result.rows[0] || null;
};


/**
 * ==========================================
 * FIND USER BY USERNAME
 * ==========================================
 */
export const findUserByUsername = async (username) => {
  const query = `
    SELECT *
    FROM users
    WHERE username = $1
    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [username]
  );

  return result.rows[0] || null;
};


/**
 * ==========================================
 * FIND USER BY EMAIL
 * ==========================================
 */
export const findUserByEmail = async (email) => {
  const query = `
    SELECT *
    FROM users
    WHERE email = $1
    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [email]
  );

  return result.rows[0] || null;
};


/**
 * ==========================================
 * FIND USER BY PHONE NUMBER
 * ==========================================
 */
export const findUserByPhoneNumber = async (
  phoneNumber
) => {
  const query = `
    SELECT *
    FROM users
    WHERE phone_number = $1
    LIMIT 1;
  `;

  const result = await pool.query(
    query,
    [phoneNumber]
  );

  return result.rows[0] || null;
};