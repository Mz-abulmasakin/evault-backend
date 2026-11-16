
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
  manualFundUser,
  manualDeductUser,
} from "./admin.manual-funding.controller.js";

import {
  adminMiddleware,
  requireAdminRoles,
} from "../../middleware/admin.middleware.js";

import {
  uploadAdminServiceDocuments,
} from "../../middleware/document-upload.middleware.js";

import {
  listServiceRequests,
  getServiceRequestDetails,
  processServiceRequest,
  uploadServiceDocuments,
} from "../services/services.admin.controller.js";

const router = express.Router();

// =========================================================
// ADMIN AUTHENTICATION
// =========================================================

router.post("/auth/login", login);

router.use(adminMiddleware);

router.get("/auth/me", me);

// =========================================================
// DASHBOARD
// =========================================================

router.get("/dashboard", getDashboard);

// =========================================================
// USER MANAGEMENT
// =========================================================

router.get(
  "/users",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS",
    "FINANCE",
    "SUPPORT"
  ),
  listUsers
);

router.get(
  "/users/:id",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS",
    "FINANCE",
    "SUPPORT"
  ),
  getUserDetails
);

router.patch(
  "/users/:id",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "SUPPORT"
  ),
  updateUser
);

// =========================================================
// MANUAL WALLET FUNDING
// =========================================================

router.post(
  "/users/:id/manual-funding",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "FINANCE"
  ),
  manualFundUser
);

// =========================================================
// MANUAL WALLET DEDUCTION
// =========================================================

router.post(
  "/users/:id/manual-deduction",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "FINANCE"
  ),
  manualDeductUser
);

// =========================================================
// SERVICE REQUEST MANAGEMENT
// =========================================================

router.get(
  "/services/requests",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS",
    "SUPPORT"
  ),
  listServiceRequests
);

router.get(
  "/services/requests/:identifier",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS",
    "SUPPORT"
  ),
  getServiceRequestDetails
);

router.patch(
  "/services/requests/:identifier/status",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS"
  ),
  processServiceRequest
);

// Upload completed service documents and complete the request.
router.post(
  "/services/requests/:identifier/documents",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "OPERATIONS"
  ),
  uploadAdminServiceDocuments,
  uploadServiceDocuments
);

// =========================================================
// TRANSACTION MANAGEMENT
// =========================================================

router.get(
  "/transactions",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "FINANCE",
    "SUPPORT"
  ),
  listTransactions
);

router.get(
  "/transactions/:identifier",
  requireAdminRoles(
    "SUPER_ADMIN",
    "ADMIN",
    "FINANCE",
    "SUPPORT"
  ),
  getTransactionDetails
);

export default router;
