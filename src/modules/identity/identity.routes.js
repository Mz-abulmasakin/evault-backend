// src/modules/identity/identity.routes.js

import express from "express";

import { authMiddleware } from "../../middleware/auth.middleware.js";

import {
  saveIdentityController,
  getMyIdentityController,
  getIdentityStatusController,
} from "./identity.controller.js";

import {
  getNinServiceController,
  submitNinController,
  getNinStatusController,
  getNinHistoryController,
  recoverNinByPhoneController,
  recoverNinByDemographicsController,
  downloadNinController,
} from "./nin.controller.js";

import {
  getIpeServiceController,
  submitIpeController,
  getIpeStatusController,
  getIpeHistoryController,
  getIpeRequestController,
  downloadIpeController,
} from "./ipe.controller.js";

const router = express.Router();

/**
 * =========================================================
 * GENERAL IDENTITY
 * =========================================================
 */

router.post(
  "/kyc",
  authMiddleware,
  saveIdentityController
);

router.get(
  "/me",
  authMiddleware,
  getMyIdentityController
);

router.get(
  "/status",
  authMiddleware,
  getIdentityStatusController
);

/**
 * =========================================================
 * NIN
 * =========================================================
 */

/**
 * NIN service / pricing
 */
router.get(
  "/nin/service",
  authMiddleware,
  getNinServiceController
);

/**
 * Submit NIN verification
 */
router.post(
  "/nin",
  authMiddleware,
  submitNinController
);

/**
 * Recover NIN by phone
 */
router.post(
  "/nin/phone-search",
  authMiddleware,
  recoverNinByPhoneController
);

/**
 * Recover NIN by demographics
 *
 * Currently returns NOT SUPPORTED because
 * NetworkDataSub phone recovery is the configured
 * recovery method.
 */
router.post(
  "/nin/demographic-search",
  authMiddleware,
  recoverNinByDemographicsController
);

/**
 * NIN history
 */
router.get(
  "/nin/history",
  authMiddleware,
  getNinHistoryController
);

/**
 * IMPORTANT:
 *
 * This MUST remain before:
 *
 * /nin/:id
 *
 * Otherwise "download" can be interpreted
 * as the request ID.
 */
router.get(
  "/nin/:id/download",
  authMiddleware,
  downloadNinController
);

/**
 * Get NIN request/status
 */
router.get(
  "/nin/:id",
  authMiddleware,
  getNinStatusController
);

/**
 * =========================================================
 * INSTANTIPE / IPE
 *
 * Existing configuration preserved.
 * =========================================================
 */

/**
 * IPE service
 */
router.get(
  "/ipe/service",
  authMiddleware,
  getIpeServiceController
);

/**
 * Submit IPE request
 */
router.post(
  "/ipe",
  authMiddleware,
  submitIpeController
);

/**
 * IPE history
 */
router.get(
  "/ipe/history",
  authMiddleware,
  getIpeHistoryController
);

/**
 * Get specific IPE request
 */
router.get(
  "/ipe/request/:id",
  authMiddleware,
  getIpeRequestController
);

/**
 * Download IPE document
 */
router.get(
  "/ipe/:id/download",
  authMiddleware,
  downloadIpeController
);

/**
 * Get IPE status
 */
router.get(
  "/ipe/:id",
  authMiddleware,
  getIpeStatusController
);

export default router;