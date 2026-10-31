// src/middleware/admin.middleware.js

import jwt from "jsonwebtoken";
import { findAdminById } from "../modules/admin/admin.repository.js";

/**
 * Authenticate administrator requests with the dedicated admin JWT secret.
 * The database is checked on every protected request so suspended/disabled
 * administrators and revoked roles take effect without waiting for a token
 * to expire.
 */
export async function adminMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Admin authorization header is missing.",
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin authorization format.",
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Admin token is missing.",
    });
  }

  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    console.error("ADMIN_JWT_SECRET is not configured.");
    return res.status(500).json({
      success: false,
      message: "Admin authentication is not configured.",
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired admin token.",
    });
  }

  if (decoded?.type !== "ADMIN" || !decoded?.adminId) {
    return res.status(403).json({
      success: false,
      message: "A valid admin access token is required.",
    });
  }

  try {
    const admin = await findAdminById(decoded.adminId);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Admin account no longer exists.",
      });
    }

    if (admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This admin account is not active.",
      });
    }

    // Always use the current role from PostgreSQL, not a possibly stale JWT claim.
    req.admin = {
      ...decoded,
      adminId: admin.id,
      username: admin.username,
      role: admin.role,
      email: admin.email,
      fullName: admin.full_name,
    };

    return next();
  } catch (error) {
    console.error("Admin database authentication error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to verify administrator account.",
    });
  }
}

/** Restrict a route to one or more current administrator roles. */
export function requireAdminRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.admin?.adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required.",
      });
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(req.admin.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You do not have permission to perform this action.",
    });
  };
}
