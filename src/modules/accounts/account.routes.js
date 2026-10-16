// src/modules/accounts/account.routes.js

import express from "express";
import { getAccount } from "./account.controller.js";
import { authMiddleware } from "../../middleware/auth.middleware.js";

const router = express.Router();

/**
 * GET /api/v1/accounts/me
 * Returns the authenticated user's account information.
 */
router.get("/me", authMiddleware, getAccount);

export default router;