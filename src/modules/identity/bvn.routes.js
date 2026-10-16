
/**
 * =========================================================
 * eVAULT BVN ROUTES
 * =========================================================
 *
 * Mounted at:
 *
 * /api/v1/identity/bvn
 *
 * Existing BVN validation routes remain intact.
 *
 * New phone recovery routes:
 *
 * GET
 * /phone-recovery/service
 *
 * POST
 * /phone-recovery
 *
 * GET
 * /phone-recovery/:id
 * =========================================================
 */

import express from "express";

import {authMiddleware} from
  "../../middleware/auth.middleware.js";

import {
  getBvnServiceController,

  submitBvnController,

  getBvnStatusController,

  getBvnHistoryController,

  downloadBvnController,

  getBvnPhoneRecoveryServiceController,

  recoverBvnByPhoneController,

  getBvnRecoveryRequestController,
} from "./bvn.controller.js";


const router =
  express.Router();


/**
 * =========================================================
 * AUTH
 * =========================================================
 */

router.use(
  authMiddleware
);


/**
 * =========================================================
 * EXISTING BVN VALIDATION
 * =========================================================
 */

router.get(
  "/service",
  getBvnServiceController
);

router.post(
  "/",
  submitBvnController
);

router.get(
  "/history",
  getBvnHistoryController
);


/**
 * =========================================================
 * BVN PHONE RECOVERY
 * =========================================================
 *
 * IMPORTANT:
 * These routes MUST appear before /:id.
 * =========================================================
 */

router.get(
  "/phone-recovery/service",
  getBvnPhoneRecoveryServiceController
);

router.post(
  "/phone-recovery",
  recoverBvnByPhoneController
);

router.get(
  "/phone-recovery/:id",
  getBvnRecoveryRequestController
);


/**
 * =========================================================
 * EXISTING PDF DOWNLOAD
 * =========================================================
 *
 * Must remain before /:id.
 * =========================================================
 */

router.get(
  "/:id/download",
  downloadBvnController
);


/**
 * =========================================================
 * EXISTING BVN STATUS
 * =========================================================
 */

router.get(
  "/:id",
  getBvnStatusController
);


export default router;
