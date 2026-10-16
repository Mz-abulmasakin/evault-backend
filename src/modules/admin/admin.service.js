import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import env from "../../config/env.js";

import {
  findAdminByIdentifier,
  findAdminById,
  updateAdminLastLogin,
} from "./admin.repository.js";

import {
  ADMIN_STATUS,
} from "./admin.constants.js";

/**
 * =========================================================
 * GET ADMIN JWT SECRET
 * =========================================================
 *
 * Admin authentication uses a separate secret from normal
 * customer authentication.
 *
 * =========================================================
 */

function getAdminJwtSecret() {
  const secret =
    process.env.ADMIN_JWT_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_JWT_SECRET is not configured."
    );
  }

  return secret;
}

/**
 * =========================================================
 * REMOVE SENSITIVE ADMIN FIELDS
 * =========================================================
 */

function sanitizeAdmin(admin) {
  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    fullName:
      admin.full_name ??
      admin.fullName ??
      "",
    role: admin.role,
    status: admin.status,
    lastLoginAt:
      admin.last_login_at ??
      admin.lastLoginAt ??
      null,
    createdAt:
      admin.created_at ??
      admin.createdAt ??
      null,
    updatedAt:
      admin.updated_at ??
      admin.updatedAt ??
      null,
  };
}

/**
 * =========================================================
 * LOGIN ADMIN
 * =========================================================
 */

export async function loginAdmin({
  identifier,
  password,
}) {
  if (!identifier?.trim()) {
    throw new Error(
      "Username or email is required."
    );
  }

  if (!password) {
    throw new Error(
      "Password is required."
    );
  }

  const cleanIdentifier =
    identifier.trim();

  const admin =
    await findAdminByIdentifier(
      cleanIdentifier
    );

  if (!admin) {
    throw new Error(
      "Invalid admin credentials."
    );
  }

  /**
   * -------------------------------------------------------
   * STATUS CHECK
   * -------------------------------------------------------
   */

  if (
    admin.status !==
    ADMIN_STATUS.ACTIVE
  ) {
    throw new Error(
      "This admin account is not active."
    );
  }

  /**
   * -------------------------------------------------------
   * PASSWORD CHECK
   * -------------------------------------------------------
   */

  const passwordMatches =
    await bcrypt.compare(
      password,
      admin.password_hash
    );

  if (!passwordMatches) {
    throw new Error(
      "Invalid admin credentials."
    );
  }

  /**
   * -------------------------------------------------------
   * UPDATE LAST LOGIN
   * -------------------------------------------------------
   */

  const updatedAdmin =
    await updateAdminLastLogin(
      admin.id
    );

  /**
   * -------------------------------------------------------
   * CREATE ADMIN JWT
   * -------------------------------------------------------
   */

  const token =
    jwt.sign(
      {
        adminId: admin.id,
        username: admin.username,
        role: admin.role,
        type: "ADMIN",
      },
      getAdminJwtSecret(),
      {
        expiresIn:
          process.env.ADMIN_JWT_EXPIRES_IN ||
          "8h",
      }
    );

  return {
    token,
    admin:
      sanitizeAdmin(
        updatedAdmin || admin
      ),
  };
}

/**
 * =========================================================
 * GET CURRENT ADMIN
 * =========================================================
 */

export async function getCurrentAdmin(
  adminId
) {
  if (!adminId) {
    throw new Error(
      "Admin ID is required."
    );
  }

  const admin =
    await findAdminById(
      adminId
    );

  if (!admin) {
    throw new Error(
      "Admin account not found."
    );
  }

  if (
    admin.status !==
    ADMIN_STATUS.ACTIVE
  ) {
    throw new Error(
      "Admin account is not active."
    );
  }

  return sanitizeAdmin(admin);
}