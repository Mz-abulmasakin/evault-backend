import express from "express";


import {
  getWallet,
  fundWallet,
  spendWallet
} from "./wallet.controller.js";


import {
  authMiddleware
} from "../../middleware/auth.middleware.js";



const router = express.Router();





// Get user's wallet
router.get(
  "/me",
  authMiddleware,
  getWallet
);





// Temporary wallet funding test
router.post(
  "/fund",
  authMiddleware,
  fundWallet
);





// Wallet payment/debit
router.post(
  "/debit",
  authMiddleware,
  spendWallet
);





export default router;