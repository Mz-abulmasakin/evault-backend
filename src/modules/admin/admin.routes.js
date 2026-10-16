 import express from "express";

import {
  login,
  me,
} from "./admin.controller.js";

import {
  getDashboard,
} from "./admin.dashboard.controller.js";

import {
  adminMiddleware,
} from "../../middleware/admin.middleware.js";

const router = express.Router();

/**
 * =========================================================
 * ADMIN AUTHENTICATION
 * =========================================================
 */

/**
 * POST /api/v1/admin/auth/login
 */
router.post(
  "/auth/login",
  login
);

/**
 * GET /api/v1/admin/auth/me
 */
router.get(
  "/auth/me",
  adminMiddleware,
  me
);

/**
 * =========================================================
 * ADMIN DASHBOARD
 * =========================================================
 */

/**
 * GET /api/v1/admin/dashboard
 */
router.get(
  "/dashboard",
  adminMiddleware,
  getDashboard
);

export default router;