import express from "express";

import {authMiddleware} from "../../middleware/auth.middleware.js";

import {
  getCableServiceController,
  getCableProvidersController,
  getCablePlansController,
  getCablePlansByProviderController,
  verifyCableSmartcardController,
  purchaseCableController,
  getCableTransactionStatusController,
  getCableHistoryController,
  getCableStatisticsController,
} from "./cable.controller.js";

const router = express.Router();

/**
 * =========================================================
 * ALL CABLE ROUTES REQUIRE CUSTOMER AUTHENTICATION
 * =========================================================
 */

router.use(
  authMiddleware
);

/**
 * =========================================================
 * SERVICE
 * =========================================================
 *
 * GET /api/v1/cable/service
 */

router.get(
  "/service",
  getCableServiceController
);

/**
 * =========================================================
 * PROVIDERS
 * =========================================================
 *
 * GET /api/v1/cable/providers
 */

router.get(
  "/providers",
  getCableProvidersController
);

/**
 * =========================================================
 * COMPATIBILITY PLANS
 * =========================================================
 *
 * GET /api/v1/cable/plans
 *
 * VTUGATE does not expose a standalone cable-plan
 * endpoint. Actual plans come from /verify.
 */

router.get(
  "/plans",
  getCablePlansController
);

/**
 * =========================================================
 * COMPATIBILITY PLANS BY PROVIDER
 * =========================================================
 *
 * GET /api/v1/cable/plans/:providerId
 */

router.get(
  "/plans/:providerId",
  getCablePlansByProviderController
);

/**
 * =========================================================
 * VERIFY SMARTCARD
 * =========================================================
 *
 * POST /api/v1/cable/verify
 *
 * Body:
 *
 * {
 *   "serviceId": 1,
 *   "phone": "08012345678",
 *   "smartCardNumber": "1234567890"
 * }
 */

router.post(
  "/verify",
  verifyCableSmartcardController
);

/**
 * =========================================================
 * PURCHASE
 * =========================================================
 *
 * POST /api/v1/cable/purchase
 *
 * Body:
 *
 * {
 *   "transactionPin": "2012",
 *   "serviceId": 1,
 *   "phone": "08012345678",
 *   "smartCardNumber": "1234567890",
 *   "amount": 2950,
 *   "planCode": "yanga",
 *   "planName": "Yanga"
 * }
 */

router.post(
  "/purchase",
  purchaseCableController
);

/**
 * =========================================================
 * TRANSACTION STATUS
 * =========================================================
 *
 * POST /api/v1/cable/status
 */

router.post(
  "/status",
  getCableTransactionStatusController
);

/**
 * =========================================================
 * HISTORY
 * =========================================================
 *
 * GET /api/v1/cable/history
 */

router.get(
  "/history",
  getCableHistoryController
);

/**
 * =========================================================
 * STATISTICS
 * =========================================================
 *
 * GET /api/v1/cable/stats
 */

router.get(
  "/stats",
  getCableStatisticsController
);

export default router;