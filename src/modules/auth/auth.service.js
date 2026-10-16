import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import env from "../../config/env.js";

import {
  createUser,
  findUserByIdentifier,
  findUserByUsername,
  findUserByEmail,
  findUserByPhoneNumber,
} from "./auth.repository.js";

import {
  createUserWallet,
} from "../wallet/wallet.service.js";


/**
 * ==========================================
 * REGISTER USER
 * ==========================================
 */
export const registerUser = async (userData) => {
  const {
    username,
    fullName,
    email,
    phoneNumber,
    password,
  } = userData;


  /**
   * ------------------------------------------
   * BASIC VALIDATION
   * ------------------------------------------
   */
  if (
    !username?.trim() ||
    !fullName?.trim() ||
    !email?.trim() ||
    !phoneNumber?.trim() ||
    !password
  ) {
    throw new Error(
      "All registration fields are required."
    );
  }


  /**
   * ------------------------------------------
   * CLEAN INPUT
   * ------------------------------------------
   */
  const cleanUsername =
    username.trim().toLowerCase();

  const cleanFullName =
    fullName.trim();

  const cleanEmail =
    email.trim().toLowerCase();

  const cleanPhoneNumber =
    phoneNumber.trim();


  /**
   * ------------------------------------------
   * USERNAME DUPLICATE CHECK
   * ------------------------------------------
   */
  const existingUsername =
    await findUserByUsername(
      cleanUsername
    );

  if (existingUsername) {
    throw new Error(
      "Username already exists. Please choose another username."
    );
  }


  /**
   * ------------------------------------------
   * EMAIL DUPLICATE CHECK
   * ------------------------------------------
   */
  const existingEmail =
    await findUserByEmail(
      cleanEmail
    );

  if (existingEmail) {
    throw new Error(
      "Email address is already registered."
    );
  }


  /**
   * ------------------------------------------
   * PHONE DUPLICATE CHECK
   * ------------------------------------------
   */
  const existingPhone =
    await findUserByPhoneNumber(
      cleanPhoneNumber
    );

  if (existingPhone) {
    throw new Error(
      "Phone number is already registered."
    );
  }


  /**
   * ------------------------------------------
   * PASSWORD HASH
   * ------------------------------------------
   */
  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );


  /**
   * ------------------------------------------
   * CREATE USER
   * ------------------------------------------
   */
  let user;

  try {

    user = await createUser({
      username: cleanUsername,
      fullName: cleanFullName,
      email: cleanEmail,
      phoneNumber: cleanPhoneNumber,
      passwordHash,
    });

  } catch (error) {

    /**
     * PostgreSQL unique constraint protection.
     *
     * This protects against a race condition where
     * another registration creates the same username,
     * email or phone between our checks and INSERT.
     */
    if (
      error.code === "23505"
    ) {

      if (
        error.constraint ===
        "users_username_key"
      ) {
        throw new Error(
          "Username already exists. Please choose another username."
        );
      }

      if (
        error.constraint ===
        "users_email_key"
      ) {
        throw new Error(
          "Email address is already registered."
        );
      }

      if (
        error.constraint ===
        "users_phone_number_key"
      ) {
        throw new Error(
          "Phone number is already registered."
        );
      }

      throw new Error(
        "An account with these details already exists."
      );
    }

    throw error;
  }


  /**
   * ------------------------------------------
   * AUTOMATICALLY CREATE WALLET
   * ------------------------------------------
   */
  try {

    await createUserWallet(
      user.id
    );

  } catch (error) {

    console.error(
      "Wallet Creation During Registration Error:",
      error.message
    );

    /**
     * Important:
     *
     * The user has already been created.
     * We don't hide the wallet creation problem.
     */
    throw new Error(
      "Account created, but wallet creation failed. Please contact support."
    );
  }


  /**
   * ------------------------------------------
   * NEVER RETURN PASSWORD HASH
   * ------------------------------------------
   */
  return {
    id: user.id,

    username: user.username,

    fullName: user.full_name,

    email: user.email,

    phoneNumber: user.phone_number,

    status: user.status,

    createdAt: user.created_at,
  };
};


/**
 * ==========================================
 * LOGIN USER
 * ==========================================
 */
export const loginUser = async ({
  identifier,
  password,
}) => {

  /**
   * ------------------------------------------
   * VALIDATION
   * ------------------------------------------
   */
  if (
    !identifier?.trim() ||
    !password
  ) {
    throw new Error(
      "Email/phone number and password are required."
    );
  }


  const cleanIdentifier =
    identifier.trim();


  /**
   * ------------------------------------------
   * FIND USER
   * ------------------------------------------
   */
  const user =
    await findUserByIdentifier(
      cleanIdentifier
    );


  if (!user) {
    throw new Error(
      "Invalid email/phone number or password."
    );
  }


  /**
   * ------------------------------------------
   * COMPARE PASSWORD
   * ------------------------------------------
   */
  const passwordMatch =
    await bcrypt.compare(
      password,
      user.password_hash
    );


  if (!passwordMatch) {
    throw new Error(
      "Invalid email/phone number or password."
    );
  }


  /**
   * ------------------------------------------
   * GENERATE JWT
   * ------------------------------------------
   */
  const token =
    jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      env.jwt.secret,
      {
        expiresIn:
          env.jwt.expiresIn,
      }
    );


  /**
   * ------------------------------------------
   * RETURN SAFE USER DATA
   * ------------------------------------------
   */
  return {
    token,

    user: {
      id: user.id,

      username:
        user.username,

      fullName:
        user.full_name,

      email:
        user.email,

      phoneNumber:
        user.phone_number,

      status:
        user.status,
    },
  };
};