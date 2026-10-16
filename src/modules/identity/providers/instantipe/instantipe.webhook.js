import crypto from "crypto";

/**
 * =========================================================
 * VERIFY INSTANTIPE WEBHOOK
 * =========================================================
 */
export function verifyInstantIPEWebhook(
  rawBody,
  signatureHeader
) {
  const secret =
    process.env.INSTANTIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error(
      "INSTANTIPE_WEBHOOK_SECRET is not configured."
    );
  }

  if (!signatureHeader) {
    return false;
  }

  const parts =
    String(signatureHeader)
      .split(",");

  let timestamp = null;
  let signature = null;

  for (const part of parts) {
    const [key, value] =
      part.split("=");

    if (key === "t") {
      timestamp =
        Number(value);
    }

    if (key === "v1") {
      signature =
        value;
    }
  }

  if (
    !timestamp ||
    !signature
  ) {
    return false;
  }

  /**
   * Prevent replay attacks.
   */
  const now =
    Math.floor(
      Date.now() / 1000
    );

  const tolerance =
    300;

  if (
    Math.abs(
      now - timestamp
    ) > tolerance
  ) {
    return false;
  }

  const payload =
    `${timestamp}.${rawBody}`;

  const expected =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(payload)
      .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(
        expected,
        "utf8"
      ),
      Buffer.from(
        signature,
        "utf8"
      )
    );
  } catch {
    return false;
  }
}