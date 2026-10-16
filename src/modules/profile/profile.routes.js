// src/modules/profile/profile.routes.js

import express from "express";

import { authMiddleware } from "../../middleware/auth.middleware.js";

import {
  createPin,
  changePin,
  verifyPin,
  getPinStatus,
} from "./profile.controller.js";

const router = express.Router();

// =========================================================
// GET SAVED TRANSACTION PIN STATUS
// GET /api/v1/profile/pin-status
// =========================================================

router.get(
  "/pin-status",
  authMiddleware,
  getPinStatus
);

// =========================================================
// CREATE TRANSACTION PIN
// POST /api/v1/profile/create-pin
// =========================================================

router.post(
  "/create-pin",
  authMiddleware,
  createPin
);

// =========================================================
// CHANGE TRANSACTION PIN
// POST /api/v1/profile/change-pin
// =========================================================

router.post(
  "/change-pin",
  authMiddleware,
  changePin
);

// =========================================================
// VERIFY TRANSACTION PIN
// POST /api/v1/profile/verify-pin
// Existing endpoint preserved
// =========================================================

router.post(
  "/verify-pin",
  authMiddleware,
  verifyPin
);

export default router;