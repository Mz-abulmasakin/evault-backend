
// src/modules/identity/identity.controller.js

import {
  saveIdentity,
  getProfileIdentity,
  hasIdentity,
} from "./identity.service.js";

/**
 * =========================================================
 * MASK IDENTITY NUMBER
 * =========================================================
 *
 * Example:
 *
 * 12345678901
 *      ↓
 * ********901
 *
 * Never expose complete BVN/NIN to the frontend.
 */
function maskIdentityNumber(value) {
  if (!value) {
    return null;
  }

  const stringValue =
    value.toString();

  if (stringValue.length <= 3) {
    return "*".repeat(
      stringValue.length
    );
  }

  return (
    "*".repeat(
      stringValue.length - 3
    ) +
    stringValue.slice(-3)
  );
}

/**
 * =========================================================
 * SAVE MY IDENTITY
 * =========================================================
 *
 * POST /api/v1/identity/kyc
 *
 * Body:
 *
 * {
 *   "bvn": "12345678901",
 *   "nin": "12345678901"
 * }
 *
 * BVN, NIN, or both may be supplied.
 */
export async function saveMyIdentity(
  req,
  res
) {
  try {
    const userId =
      req.user.id;

    const {
      bvn,
      nin,
    } = req.body;

    const identity =
      await saveIdentity(
        userId,
        {
          bvn,
          nin,
        }
      );

    return res.status(201).json({
      success: true,

      message:
        "Identity information saved successfully",

      data: {
        id:
          identity.id,

        bvn:
          maskIdentityNumber(
            identity.bvn
          ),

        nin:
          maskIdentityNumber(
            identity.nin
          ),

        status:
          identity.status,

        bvnVerified:
          identity.bvn_verified,

        ninVerified:
          identity.nin_verified,
      },
    });

  } catch (error) {
    console.error(
      "Save Identity Error:",
      error
    );

    return res.status(400).json({
      success: false,

      message:
        error.message ||
        "Unable to save identity information",
    });
  }
}

/**
 * =========================================================
 * SAVE IDENTITY CONTROLLER
 * =========================================================
 *
 * Backward-compatible alias.
 *
 * Existing routes may already use:
 *
 * saveIdentityController
 */
export async function saveIdentityController(
  req,
  res
) {
  return await saveMyIdentity(
    req,
    res
  );
}

/**
 * =========================================================
 * GET MY IDENTITY
 * =========================================================
 *
 * GET /api/v1/identity/me
 *
 * Returns masked BVN/NIN.
 */
export async function getMyIdentity(
  req,
  res
) {
  try {
    const identity =
      await getProfileIdentity(
        req.user.id
      );

    /**
     * User does not have an identity
     * record yet.
     */
    if (!identity) {
      return res.status(200).json({
        success: true,

        data: null,
      });
    }

    return res.status(200).json({
      success: true,

      data: {
        id:
          identity.id,

        bvn:
          maskIdentityNumber(
            identity.bvn
          ),

        nin:
          maskIdentityNumber(
            identity.nin
          ),

        status:
          identity.status,

        bvnVerified:
          identity.bvn_verified,

        ninVerified:
          identity.nin_verified,

        createdAt:
          identity.created_at,

        updatedAt:
          identity.updated_at,
      },
    });

  } catch (error) {
    console.error(
      "Get Identity Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to retrieve identity information",
    });
  }
}

/**
 * =========================================================
 * GET MY IDENTITY CONTROLLER
 * =========================================================
 *
 * Backward-compatible alias.
 */
export async function getMyIdentityController(
  req,
  res
) {
  return await getMyIdentity(
    req,
    res
  );
}

/**
 * =========================================================
 * GET IDENTITY STATUS
 * =========================================================
 *
 * GET /api/v1/identity/status
 *
 * Returns whether the user has submitted
 * BVN/NIN information.
 */
export async function getIdentityStatusController(
  req,
  res
) {
  try {
    const exists =
      await hasIdentity(
        req.user.id
      );

    return res.status(200).json({
      success: true,

      data: {
        hasIdentity:
          exists,
      },
    });

  } catch (error) {
    console.error(
      "Get Identity Status Error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Unable to retrieve identity status",
    });
  }
}

/**
 * =========================================================
 * GET IDENTITY STATUS
 * =========================================================
 *
 * Backward-compatible alias.
 */
export async function getIdentityStatus(
  req,
  res
) {
  return await getIdentityStatusController(
    req,
    res
  );
}

