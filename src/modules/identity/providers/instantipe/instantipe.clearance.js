// src/modules/identity/providers/instantipe/instantipe.clearance.js

import instantIPE from "./instantipe.client.js";

/**
 * Evault customer price.
 */
export const IPE_CLEARANCE_PRICE = Number(
  process.env.EVAULT_IPE_CLEARANCE_PRICE || 550
);

/**
 * =========================================================
 * TRACKING ID VALIDATION
 * =========================================================
 */
function normalizeTrackingId(trackingId) {
  const value = String(trackingId || "")
    .trim();

  if (!value) {
    throw new Error(
      "Tracking ID is required."
    );
  }

  return value;
}

/**
 * =========================================================
 * CREATE IPE CLEARANCE
 * =========================================================
 */
export async function createIPEClearance({
  trackingId,
  oldTrackingId = null,
  nin = null,
  fullName = null,
  phoneNumber = null,
  note = null,
  idempotencyKey,
}) {
  const cleanTrackingId =
    normalizeTrackingId(trackingId);

  const response =
    await instantIPE.submitIPEClearance({
      trackingId: cleanTrackingId,
      oldTrackingId,
      nin,
      fullName,
      phoneNumber,
      note,
      idempotencyKey,
    });

  return {
    provider: "INSTANTIPE",
    service: "IPE_CLEARANCE",

    // Evault customer charge
    evaultPrice: IPE_CLEARANCE_PRICE,

    data: response,
  };
}

/**
 * =========================================================
 * CHECK IPE STATUS
 * =========================================================
 */
export async function getIPEClearanceStatus(
  reference
) {
  if (!reference) {
    throw new Error(
      "InstantIPE IPE reference is required."
    );
  }

  return instantIPE.getIPEClearance(
    reference
  );
}

export default {
  createIPEClearance,
  getIPEClearanceStatus,
  IPE_CLEARANCE_PRICE,
};