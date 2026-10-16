
import express from "express";
import rateLimit from "express-rate-limit";

import {
  register,
  login,
} from "./auth.controller.js";

import {
  verifyPasswordResetDetailsController,
  resetPassword,
} from "./password-reset.controller.js";

const router = express.Router();

const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Too many recovery attempts. Please try again later.",
  },
});

const passwordUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message:
      "Too many password-reset attempts. Please try again later.",
  },
});

// Existing endpoints.
router.post("/register", register);
router.post("/login", login);

// Phone + verified NIN/BVN, no OTP or email.
router.post(
  "/forgot-password/verify-details",
  recoveryLimiter,
  verifyPasswordResetDetailsController
);

// Save new password using the one-time reset token.
router.post(
  "/forgot-password/reset",
  passwordUpdateLimiter,
  resetPassword
);

export default router;
