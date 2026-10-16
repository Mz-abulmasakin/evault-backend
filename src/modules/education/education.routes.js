/**
 * =========================================================
 * eVAULT EDUCATION ROUTES
 * =========================================================
 */

import express from "express";

import {authMiddleware} from "../../middleware/auth.middleware.js";

import {
  getEducationServicesController,
  getEducationPriceController,
  purchaseEducationController,
} from "./education.controller.js";


const router =
  express.Router();


/**
 * All Education routes require
 * authentication.
 */

router.use(
  authMiddleware
);


/**
 * Education services
 */

router.get(
  "/services",
  getEducationServicesController
);


/**
 * Education price
 *
 * Body:
 * {
 *   "serviceId": 1,
 *   "quantity": 1
 * }
 */

router.post(
  "/price",
  getEducationPriceController
);


/**
 * Education PIN purchase
 *
 * Body:
 * {
 *   "serviceId": 1,
 *   "quantity": 1,
 *   "transactionPin": "2012"
 * }
 */

router.post(
  "/purchase",
  purchaseEducationController
);


export default router;