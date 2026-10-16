import express from "express";

import {
  walletTransactions,
  transactionDetails,
} from "./transaction.controller.js";

import {
  authMiddleware,
} from "../../middleware/auth.middleware.js";


const router = express.Router();


/**
 * =========================================================
 * GET WALLET TRANSACTIONS
 * =========================================================
 */
router.get(
  "/",
  authMiddleware,
  walletTransactions
);


/**
 * =========================================================
 * GET SINGLE TRANSACTION
 * =========================================================
 */
router.get(
  "/:reference",
  authMiddleware,
  transactionDetails
);


export default router;