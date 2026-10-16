
/**
 * =========================================================
 * eVAULT EXPRESS APPLICATION
 * =========================================================
 */

import express from "express";

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

  import educationRoutes from "./modules/education/education.routes.js";

// =========================================================
// ADMIN
// =========================================================

import adminRoutes
  from "./modules/admin/admin.routes.js";

  import cableRoutes from "./modules/cable/cable.routes.js";


const app =
  express();


// =========================================================
// GLOBAL MIDDLEWARE
// =========================================================
//
// We preserve the original raw request body because
// payment-provider webhook signature verification may
// require the exact body sent by the provider.
//
// IMPORTANT:
// This is kept at the top so req.rawBody is available
// to routes that require it.
// =========================================================

app.use(
  express.json({
    verify: (
      req,
      res,
      buffer
    ) => {

      req.rawBody =
        Buffer.from(buffer);

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
//
// Admin authentication is completely separate from
// customer authentication.
//
// POST /api/v1/admin/auth/login
// GET  /api/v1/admin/auth/me
//
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
//
// General identity routes:
//
// /api/v1/identity/kyc
// /api/v1/identity/me
// /api/v1/identity/status
//
// NIN and IPE routes are also mounted inside
// identity.routes.js.
//
// =========================================================

app.use(
  "/api/v1/identity",
  identityRoutes
);


// =========================================================
// BVN
// =========================================================
//
// BVN has its own router.
//
// IMPORTANT:
// This mount was missing previously.
//
// The BVN router contains:
//
// GET  /service
// POST /
// GET  /history
// GET  /:id/download
// GET  /:id
//
// Therefore the final endpoints are:
//
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
// IMPORTANT:
// Keep this route before the 404 handler.
//
// The raw body has already been captured by the
// express.json verify function above.
//
// =========================================================

app.use(
  "/api/v1/webhooks",
  instantIPEWebhookRoutes
);


app.use(
  "/api/v1/cable",
  cableRoutes
);

app.use(
  "/api/v1/education",
  educationRoutes
);

// =========================================================
// HEALTH CHECK
// =========================================================

app.get(
  "/",
  (
    req,
    res
  ) => {

    res.json({

      status:
        "success",

      message:
        "Evault Corporate Backend is running",

    });

  }
);


// =========================================================
// 404 HANDLER
// =========================================================
//
// This MUST remain at the very end of the route stack.
// =========================================================

app.use(
  (
    req,
    res
  ) => {

    res.status(
      404
    ).json({

      success:
        false,

      message:
        "Route not found",

    });

  }
);


// =========================================================
// EXPORT
// =========================================================

export default app;
