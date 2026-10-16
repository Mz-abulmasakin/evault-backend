/**
 * =========================================================
 * eVAULT DATA ROUTES
 * =========================================================
 *
 * Mounted at:
 * /api/v1/data
 * =========================================================
 */

import express from "express";

import {authMiddleware} from "../../middleware/auth.middleware.js";

import {
  getDataPlansController,
  purchaseDataController,
} from "./data.controller.js";

const router =
  express.Router();

router.use(
  authMiddleware
);

/**
 * Load all data plans or filter:
 *
 * GET /data/plans
 * GET /data/plans?network=MTN
 */
router.get(
  "/plans",
  getDataPlansController
);

/**
 * Purchase data.
 */
router.post(
  "/purchase",
  purchaseDataController
);

export default router;