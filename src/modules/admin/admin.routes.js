// src/modules/admin/admin.routes.js

import express from "express";

import { login, me } from "./admin.controller.js";
import { getDashboard } from "./admin.dashboard.controller.js";
import {
  listUsers,
  getUserDetails,
  updateUser,
  listTransactions,
  getTransactionDetails,
} from "./admin.management.controller.js";
import {
  adminMiddleware,
  requireAdminRoles,
} from "../../middleware/admin.middleware.js";
import { manualFundUser } from "./admin.manual-funding.controller.js";

const router = express.Router();

// Public admin sign-in.
router.post("/auth/login", login);

// All routes below require a currently active administrator.
router.use(adminMiddleware);

router.get("/auth/me", me);
router.get("/dashboard", getDashboard);

// Customer management.
router.get(
  "/users",
  requireAdminRoles("SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"),
  listUsers
);
router.get(
  "/users/:id",
  requireAdminRoles("SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"),
  getUserDetails
);
router.patch(
  "/users/:id",
  requireAdminRoles("SUPER_ADMIN", "ADMIN", "SUPPORT"),
  updateUser
);

// Global transaction management.
router.get(
  "/transactions",
  requireAdminRoles("SUPER_ADMIN", "ADMIN", "FINANCE", "SUPPORT"),
  listTransactions
);
router.get(
  "/transactions/:identifier",
  requireAdminRoles("SUPER_ADMIN", "ADMIN", "FINANCE", "SUPPORT"),
  getTransactionDetails
);

router.post(
  "/users/:id/manual-funding",
  requireAdminRoles("SUPER_ADMIN", "ADMIN", "FINANCE"),
  manualFundUser
);
export default router;
