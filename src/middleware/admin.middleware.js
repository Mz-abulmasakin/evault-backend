// src/middleware/admin.middleware.js

import jwt from "jsonwebtoken";

/**
 * =========================================================
 * ADMIN AUTHENTICATION MIDDLEWARE
 * =========================================================
 *
 * Expected:
 *
 * Authorization: Bearer <ADMIN_JWT>
 *
 * This middleware intentionally uses ADMIN_JWT_SECRET
 * instead of the normal customer JWT_SECRET.
 *
 * =========================================================
 */

export function adminMiddleware(
  req,
  res,
  next
) {
  try {
    const authHeader =
      req.headers.authorization;

    /**
     * -------------------------------------------------------
     * CHECK AUTHORIZATION HEADER
     * -------------------------------------------------------
     */

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message:
          "Admin authorization header is missing.",
      });
    }

    /**
     * -------------------------------------------------------
     * CHECK BEARER FORMAT
     * -------------------------------------------------------
     */

    if (
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid admin authorization format.",
      });
    }

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Admin token is missing.",
      });
    }

    /**
     * -------------------------------------------------------
     * ADMIN JWT SECRET
     * -------------------------------------------------------
     */

    const secret =
      process.env.ADMIN_JWT_SECRET;

    if (!secret) {
      console.error(
        "ADMIN_JWT_SECRET is not configured."
      );

      return res.status(500).json({
        success: false,
        message:
          "Admin authentication is not configured.",
      });
    }

    /**
     * -------------------------------------------------------
     * VERIFY TOKEN
     * -------------------------------------------------------
     */

    const decoded =
      jwt.verify(
        token,
        secret
      );

    /**
     * -------------------------------------------------------
     * VERIFY ADMIN TOKEN TYPE
     * -------------------------------------------------------
     */

    if (
      decoded?.type !==
      "ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Admin access token required.",
      });
    }

    /**
     * -------------------------------------------------------
     * VERIFY ADMIN ID
     * -------------------------------------------------------
     */

    if (!decoded?.adminId) {
      return res.status(403).json({
        success: false,
        message:
          "Invalid admin token.",
      });
    }

    /**
     * -------------------------------------------------------
     * ATTACH ADMIN TO REQUEST
     * -------------------------------------------------------
     */

    req.admin = decoded;

    next();
  } catch (error) {
    console.error(
      "Admin authentication error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        "Invalid or expired admin token.",
    });
  }
}

/**
 * =========================================================
 * ROLE MIDDLEWARE
 * =========================================================
 *
 * Usage:
 *
 * router.get(
 *   "/something",
 *   adminMiddleware,
 *   requireAdminRoles("SUPER_ADMIN", "ADMIN"),
 *   controller
 * );
 *
 * =========================================================
 */

export function requireAdminRoles(
  ...allowedRoles
) {
  return (
    req,
    res,
    next
  ) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message:
          "Admin authentication required.",
      });
    }

    if (
      allowedRoles.length === 0
    ) {
      return next();
    }

    const hasPermission =
      allowedRoles.includes(
        req.admin.role
      );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action.",
      });
    }

    next();
  };
}