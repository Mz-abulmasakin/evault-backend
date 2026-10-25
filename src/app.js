
/**
 * =========================================================
 * eVAULT EXPRESS APPLICATION
 * =========================================================
 */

import express from "express";

import {
  securityMiddleware,
} from "./middleware/security.middleware.js";

// =========================================================
// EXISTING ROUTES
// =========================================================

import authRoutes
  from "./modules/auth/auth.routes.js";

import accountRoutes
  from "./modules/accounts/account.routes.js";

import profileRoutes
  from "./modules/profile/profile.routes.js";

import walletRoutes
  from "./modules/wallet/wallet.routes.js";

import transactionRoutes
  from "./modules/transactions/transaction.routes.js";

import fundingRoutes
  from "./modules/funding/funding.routes.js";

import notificationRoutes
  from "./modules/notification/notification.routes.js";

import identityRoutes
  from "./modules/identity/identity.routes.js";

import airtimeRoutes
  from "./modules/airtime/airtime.routes.js";

import dataRoutes
  from "./modules/data/data.routes.js";

import instantIPEWebhookRoutes
  from "./modules/identity/providers/instantipe/instantipe.webhook.routes.js";

import bvnRoutes
  from "./modules/identity/bvn.routes.js";

import educationRoutes
  from "./modules/education/education.routes.js";

import adminRoutes
  from "./modules/admin/admin.routes.js";

import cableRoutes
  from "./modules/cable/cable.routes.js";


// =========================================================
// CREATE EXPRESS APPLICATION
// =========================================================

const app = express();


// =========================================================
// SECURITY, CORS AND HTTP REQUEST LOGGING
// =========================================================
//
// IMPORTANT:
// Activate the security middleware before the routes.
//
// This enables CORS for browser-based clients such as
// Expo Web running locally and the deployed Vercel site.
//
// It also enables Helmet security headers and Morgan
// HTTP request logging through the existing middleware.
//
// =========================================================

securityMiddleware(app);


// =========================================================
// GLOBAL JSON MIDDLEWARE
// =========================================================
//
// Preserve the original raw request body because
// payment-provider webhook signature verification may
// require the exact request bytes.
//
// Keep this verify callback in place.
// =========================================================

app.use(
  express.json({
    verify: (req, res, buffer) => {
      req.rawBody = Buffer.from(buffer);
    },
  })
);


// =========================================================
// CUSTOMER AUTHENTICATION
// =========================================================

app.use(
  "/api/v1/auth",
  authRoutes
);


// =========================================================
// ADMIN
// =========================================================

app.use(
  "/api/v1/admin",
  adminRoutes
);


// =========================================================
// ACCOUNT
// =========================================================

app.use(
  "/api/v1/accounts",
  accountRoutes
);


// =========================================================
// PROFILE
// =========================================================

app.use(
  "/api/v1/profile",
  profileRoutes
);


// =========================================================
// WALLET
// =========================================================

app.use(
  "/api/v1/wallet",
  walletRoutes
);


// =========================================================
// TRANSACTIONS
// =========================================================

app.use(
  "/api/v1/transactions",
  transactionRoutes
);


// =========================================================
// FUNDING
// =========================================================

app.use(
  "/api/v1/funding",
  fundingRoutes
);


// =========================================================
// NOTIFICATIONS
// =========================================================

app.use(
  "/api/v1/notifications",
  notificationRoutes
);


// =========================================================
// IDENTITY
// =========================================================

app.use(
  "/api/v1/identity",
  identityRoutes
);


// =========================================================
// BVN
// =========================================================
//
// Existing BVN routes:
// GET  /api/v1/identity/bvn/service
// POST /api/v1/identity/bvn
// GET  /api/v1/identity/bvn/history
// GET  /api/v1/identity/bvn/:id/download
// GET  /api/v1/identity/bvn/:id
//
// =========================================================

app.use(
  "/api/v1/identity/bvn",
  bvnRoutes
);


// =========================================================
// AIRTIME
// =========================================================

app.use(
  "/api/v1/airtime",
  airtimeRoutes
);


// =========================================================
// DATA
// =========================================================

app.use(
  "/api/v1/data",
  dataRoutes
);


// =========================================================
// INSTANTIPE WEBHOOK
// =========================================================
//
// Keep the existing webhook route and raw-body capture.
// =========================================================

app.use(
  "/api/v1/webhooks",
  instantIPEWebhookRoutes
);


// =========================================================
// CABLE TV
// =========================================================

app.use(
  "/api/v1/cable",
  cableRoutes
);


// =========================================================
// EDUCATION
// =========================================================

app.use(
  "/api/v1/education",
  educationRoutes
);


// =========================================================
// HEALTH CHECK
// =========================================================

app.get("/", (req, res) => {
  res.json({
    status: "success",
    message: "Evault Corporate Backend is running",
  });
});


// =========================================================
// 404 HANDLER
// =========================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});


// =========================================================
// EXPORT
// =========================================================

export default app;
