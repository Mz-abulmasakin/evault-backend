import {
  loginAdmin,
  getCurrentAdmin,
} from "./admin.service.js";

/**
 * =========================================================
 * ADMIN LOGIN
 * =========================================================
 *
 * POST /api/v1/admin/auth/login
 *
 * =========================================================
 */

export async function login(
  req,
  res,
  next
) {
  try {
    const {
      identifier,
      password,
    } = req.body;

    const result =
      await loginAdmin({
        identifier,
        password,
      });

    return res.status(200).json({
      success: true,
      message:
        "Admin login successful.",
      data: result,
    });
  } catch (error) {
    console.error(
      "Admin Login Error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        error.message ||
        "Invalid admin credentials.",
    });
  }
}

/**
 * =========================================================
 * CURRENT ADMIN
 * =========================================================
 *
 * GET /api/v1/admin/auth/me
 *
 * =========================================================
 */

export async function me(
  req,
  res,
  next
) {
  try {
    const admin =
      await getCurrentAdmin(
        req.admin.adminId
      );

    return res.status(200).json({
      success: true,
      message:
        "Admin profile retrieved successfully.",
      data: {
        admin,
      },
    });
  } catch (error) {
    next(error);
  }
}