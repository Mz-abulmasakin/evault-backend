 // src/modules/airtime/airtime.routes.js

import express from "express";

import {
  purchaseAirtimeController,
  getAirtimePlans,
} from "./airtime.controller.js";

import {
  authMiddleware,
} from "../../middleware/auth.middleware.js";


const router =
  express.Router();


/**
 * =========================================================
 * GET AIRTIME PLANS
 * =========================================================
 *
 * GET
 * /api/v1/airtime/plans
 *
 * Authentication is NOT required.
 */
router.get(
  "/plans",
  getAirtimePlans
);


/**
 * =========================================================
 * PURCHASE AIRTIME
 * =========================================================
 *
 * POST
 * /api/v1/airtime/purchase
 *
 * Requires JWT.
 */
router.post(
  "/purchase",
  authMiddleware,
  purchaseAirtimeController
);


export default router;