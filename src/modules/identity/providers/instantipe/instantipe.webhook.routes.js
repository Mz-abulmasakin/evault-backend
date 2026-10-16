import express from "express";

import {
  instantIPEWebhookController,
} from "./instantipe.webhook.controller.js";

const router =
  express.Router();

/**
 * IMPORTANT:
 *
 * This route MUST receive the raw request body.
 *
 * Do NOT put express.json() before this route.
 */
router.post(
  "/instantipe",
  express.raw({
    type: "application/json",
  }),
  instantIPEWebhookController
);

export default router;