// src/modules/identity/providers/instantipe/instantipe.validation.js

import instantIPE from "./instantipe.client.js";

export const NIN_VALIDATION_PRICE = Number(
  process.env.EVAULT_NIN_VALIDATION_PRICE || 1200
);

/**
 * Validate NIN format.
 */
function validateNin(nin) {
  const value = String(nin || "")
    .replace(/\s/g, "")
    .trim();

  if (!/^\d{11}$/.test(value)) {
    throw new Error("NIN must contain exactly 11 digits.");
  }

  return value;
}

/**
 * NIN Validation
 *
 * validationType:
 * demographic
 * biometric
 * full
 *
 * slipType:
 * basic
 * regular
 * standard
 * premium
 */
export async function validateNin({
  nin,
  validationType = "full",
  slipType = "standard",
  fullName = null,
  phoneNumber = null,
  idempotencyKey,
}) {
  const cleanNin = validateNin(nin);

  const body = {
    nin: cleanNin,
    validation_type: validationType,
    slip_type: slipType,
  };

  if (fullName) {
    body.full_name = fullName;
  }

  if (phoneNumber) {
    body.phone_number = phoneNumber;
  }

  const response = await instantIPE.post(
    "/validation",
    body,
    {
      "Idempotency-Key":
        idempotencyKey ||
        `EVAULT-VALIDATION-${Date.now()}`,
    }
  );

  return {
    provider: "INSTANTIPE",
    service: "NIN_VALIDATION",
    evaultPrice: NIN_VALIDATION_PRICE,
    data: response,
  };
}

export default {
  validateNin,
  NIN_VALIDATION_PRICE,
};