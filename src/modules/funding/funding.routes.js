 // src/modules/funding/funding.routes.js

import express from "express";


import {
  createReservedAccountController,
  getReservedAccountController,
  monnifyWebhook,
} from "./funding.controller.js";


import {
  authMiddleware,
} from "../../middleware/auth.middleware.js";


const router =
  express.Router();


// =========================================================
// CREATE DEDICATED FUNDING ACCOUNT
// =========================================================
//
// POST
// /api/v1/funding/reserved-account
//
// Requires JWT.
// =========================================================

router.post(
  "/reserved-account",
  authMiddleware,
  createReservedAccountController
);


// =========================================================
// GET DEDICATED FUNDING ACCOUNT
// =========================================================
//
// GET
// /api/v1/funding/reserved-account
//
// Requires JWT.
// =========================================================

router.get(
  "/reserved-account",
  authMiddleware,
  getReservedAccountController
);


// =========================================================
// MONNIFY WEBHOOK
// =========================================================
//
// POST
// /api/v1/funding/webhook/monnify
//
// IMPORTANT:
//
// DO NOT add authMiddleware here.
//
// Monnify does not send the Evault JWT.
//
// Security is handled through the Monnify webhook
// signature.
// =========================================================

router.post(
  "/webhook/monnify",
  monnifyWebhook
);


export default router;