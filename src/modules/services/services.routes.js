
import express from "express";

import { authMiddleware } from "../../middleware/auth.middleware.js";

import {
  uploadCacPersonnelDocuments,
} from "../../middleware/document-upload.middleware.js";

import {
  submitCacRequestController,
  listCustomerServiceRequests,
  getCustomerServiceRequestController,
  getCustomerServiceDocumentController,
} from "./services.controller.js";

const router = express.Router();

// All customer service endpoints require authentication
router.use(authMiddleware);

// =========================================================
// SUBMIT CAC SERVICE REQUEST
// POST /requests/cac
// =========================================================

router.post(
  "/requests/cac",
  uploadCacPersonnelDocuments,
  submitCacRequestController
);

// =========================================================
// LIST CUSTOMER SERVICE REQUESTS
// GET /requests
// =========================================================

router.get(
  "/requests",
  listCustomerServiceRequests
);

// =========================================================
// GET ONE CUSTOMER SERVICE REQUEST
// GET /requests/:requestId
// =========================================================

router.get(
  "/requests/:requestId",
  getCustomerServiceRequestController
);

// =========================================================
// DOWNLOAD CUSTOMER-VISIBLE DOCUMENT
// GET /requests/:requestId/documents/:documentId/download
// =========================================================

router.get(
  "/requests/:requestId/documents/:documentId/download",
  getCustomerServiceDocumentController
);

export default router;
