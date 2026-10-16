
// src/modules/identity/identity.service.js

import {
  createIdentityVerification,
  findIdentityByUserId,
  findIdentityById,
  findIdentityByBvn,
  findIdentityByNin,
  updateIdentityVerification,
  upsertIdentityVerification,
  updateBvn,
  updateNin,
  markBvnAsVerified,
  markNinAsVerified,
  updateIdentityStatus,
  deleteIdentityVerification,
} from "./identity.repository.js";

/**
 * =========================================================
 * INTERNAL HELPERS
 * =========================================================
 */

function cleanValue(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return value.toString().trim();
}

function validateBvn(bvn) {
  if (!bvn) return;

  if (!/^\d{11}$/.test(bvn)) {
    throw new Error(
      "BVN must contain exactly 11 digits"
    );
  }
}

function validateNin(nin) {
  if (!nin) return;

  if (!/^\d{11}$/.test(nin)) {
    throw new Error(
      "NIN must contain exactly 11 digits"
    );
  }
}

/**
 * =========================================================
 * GET USER IDENTITY
 * =========================================================
 */

export async function getUserIdentity(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return await findIdentityByUserId(userId);
}

/**
 * =========================================================
 * GET PROFILE IDENTITY
 * =========================================================
 */

export async function getProfileIdentity(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return await findIdentityByUserId(userId);
}

/**
 * =========================================================
 * CHECK WHETHER USER HAS IDENTITY
 * =========================================================
 */

export async function hasIdentity(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const identity =
    await findIdentityByUserId(userId);

  if (!identity) {
    return false;
  }

  return Boolean(
    identity.bvn ||
    identity.nin
  );
}

/**
 * =========================================================
 * CHECK WHETHER USER HAS VERIFIED IDENTITY
 * =========================================================
 */

export async function hasVerifiedIdentity(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const identity =
    await findIdentityByUserId(userId);

  if (!identity) {
    return false;
  }

  return Boolean(
    identity.bvn_verified ||
    identity.nin_verified
  );
}

/**
 * =========================================================
 * SAVE IDENTITY
 * =========================================================
 *
 * Important:
 *
 * - Existing BVN remains verified when the SAME BVN is supplied.
 * - Existing NIN remains verified when the SAME NIN is supplied.
 * - Verification is reset ONLY when the actual identity number
 *   changes.
 * - Supplying only BVN does not destroy an existing NIN.
 * - Supplying only NIN does not destroy an existing BVN.
 */

export async function saveIdentity(
  userId,
  data = {}
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const bvn =
    cleanValue(data.bvn);

  const nin =
    cleanValue(data.nin);

  if (!bvn && !nin) {
    throw new Error(
      "BVN or NIN is required"
    );
  }

  validateBvn(bvn);
  validateNin(nin);

  /**
   * -------------------------------------------------------
   * PREVENT DUPLICATE BVN
   * -------------------------------------------------------
   */

  if (bvn) {
    const existingBvn =
      await findIdentityByBvn(bvn);

    if (
      existingBvn &&
      existingBvn.user_id !== userId
    ) {
      throw new Error(
        "This BVN is already associated with another account"
      );
    }
  }

  /**
   * -------------------------------------------------------
   * PREVENT DUPLICATE NIN
   * -------------------------------------------------------
   */

  if (nin) {
    const existingNin =
      await findIdentityByNin(nin);

    if (
      existingNin &&
      existingNin.user_id !== userId
    ) {
      throw new Error(
        "This NIN is already associated with another account"
      );
    }
  }

  /**
   * -------------------------------------------------------
   * FIND EXISTING IDENTITY
   * -------------------------------------------------------
   */

  const existing =
    await findIdentityByUserId(userId);

  /**
   * -------------------------------------------------------
   * UPDATE EXISTING RECORD
   * -------------------------------------------------------
   */

  if (existing) {
    const finalBvn =
      bvn || existing.bvn || null;

    const finalNin =
      nin || existing.nin || null;

    /**
     * If the user did not supply a BVN,
     * preserve the existing BVN verification.
     *
     * If the user supplied the SAME BVN,
     * preserve the existing verification.
     *
     * If the user supplied a DIFFERENT BVN,
     * reset verification.
     */
    let bvnVerified =
      existing.bvn_verified;

    if (bvn) {
      const sameBvn =
        existing.bvn === bvn;

      bvnVerified =
        sameBvn
          ? Boolean(existing.bvn_verified)
          : false;
    }

    /**
     * Same logic for NIN.
     */
    let ninVerified =
      existing.nin_verified;

    if (nin) {
      const sameNin =
        existing.nin === nin;

      ninVerified =
        sameNin
          ? Boolean(existing.nin_verified)
          : false;
    }

    /**
     * Do not unnecessarily reset a VERIFIED
     * identity record back to PENDING.
     *
     * If either existing identity is verified,
     * keep the overall status unless the actual
     * identity number was changed.
     */
    const identityChanged =
      (bvn &&
        existing.bvn &&
        bvn !== existing.bvn) ||
      (nin &&
        existing.nin &&
        nin !== existing.nin);

    let status =
      existing.status || "PENDING";

    if (identityChanged) {
      status = "PENDING";
    }

    return await updateIdentityVerification(
      userId,
      {
        bvn: finalBvn,
        nin: finalNin,

        bvnVerified,
        ninVerified,

        status,
      }
    );
  }

  /**
   * -------------------------------------------------------
   * CREATE NEW RECORD
   * -------------------------------------------------------
   */

  return await createIdentityVerification({
    userId,

    bvn,
    nin,

    bvnVerified: false,
    ninVerified: false,

    status: "PENDING",
  });
}

/**
 * =========================================================
 * SAVE USER IDENTITY
 * =========================================================
 */

export async function saveUserIdentity(
  userId,
  data = {}
) {
  return await saveIdentity(
    userId,
    data
  );
}

/**
 * =========================================================
 * UPSERT IDENTITY
 * =========================================================
 *
 * Same preservation rules as saveIdentity().
 */

export async function upsertIdentity(
  userId,
  data = {}
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const bvn =
    cleanValue(data.bvn);

  const nin =
    cleanValue(data.nin);

  if (!bvn && !nin) {
    throw new Error(
      "BVN or NIN is required"
    );
  }

  validateBvn(bvn);
  validateNin(nin);

  /**
   * Prevent duplicate BVN.
   */

  if (bvn) {
    const existingBvn =
      await findIdentityByBvn(bvn);

    if (
      existingBvn &&
      existingBvn.user_id !== userId
    ) {
      throw new Error(
        "This BVN is already associated with another account"
      );
    }
  }

  /**
   * Prevent duplicate NIN.
   */

  if (nin) {
    const existingNin =
      await findIdentityByNin(nin);

    if (
      existingNin &&
      existingNin.user_id !== userId
    ) {
      throw new Error(
        "This NIN is already associated with another account"
      );
    }
  }

  /**
   * Use the same safe logic as saveIdentity().
   */
  return await saveIdentity(
    userId,
    {
      bvn,
      nin,
    }
  );
}

/**
 * =========================================================
 * UPSERT USER IDENTITY
 * =========================================================
 */

export async function upsertUserIdentity(
  userId,
  data = {}
) {
  return await upsertIdentity(
    userId,
    data
  );
}

/**
 * =========================================================
 * UPDATE IDENTITY
 * =========================================================
 */

export async function updateIdentity(
  userId,
  data = {}
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const bvn =
    cleanValue(data.bvn);

  const nin =
    cleanValue(data.nin);

  if (bvn) {
    validateBvn(bvn);
  }

  if (nin) {
    validateNin(nin);
  }

  return await updateIdentityVerification(
    userId,
    {
      bvn,
      nin,

      bvnVerified:
        data.bvnVerified,

      ninVerified:
        data.ninVerified,

      status:
        data.status,
    }
  );
}

/**
 * =========================================================
 * GET IDENTITY BY ID
 * =========================================================
 */

export async function getIdentityById(id) {
  if (!id) {
    throw new Error(
      "Identity ID is required"
    );
  }

  return await findIdentityById(id);
}

/**
 * =========================================================
 * GET IDENTITY BY BVN
 * =========================================================
 */

export async function getIdentityByBvn(bvn) {
  const cleanBvn =
    cleanValue(bvn);

  if (!cleanBvn) {
    throw new Error(
      "BVN is required"
    );
  }

  validateBvn(cleanBvn);

  return await findIdentityByBvn(
    cleanBvn
  );
}

/**
 * =========================================================
 * GET IDENTITY BY NIN
 * =========================================================
 */

export async function getIdentityByNin(nin) {
  const cleanNin =
    cleanValue(nin);

  if (!cleanNin) {
    throw new Error(
      "NIN is required"
    );
  }

  validateNin(cleanNin);

  return await findIdentityByNin(
    cleanNin
  );
}

/**
 * =========================================================
 * SAVE BVN
 * =========================================================
 *
 * Same BVN -> preserve verification.
 * Different BVN -> reset verification.
 */

export async function saveBvn(
  userId,
  bvn
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const cleanBvn =
    cleanValue(bvn);

  if (!cleanBvn) {
    throw new Error(
      "BVN is required"
    );
  }

  validateBvn(cleanBvn);

  const existing =
    await findIdentityByUserId(userId);

  const existingBvn =
    await findIdentityByBvn(
      cleanBvn
    );

  if (
    existingBvn &&
    existingBvn.user_id !== userId
  ) {
    throw new Error(
      "This BVN is already associated with another account"
    );
  }

  /**
   * If the user already has this exact BVN,
   * do NOT destroy its verification state.
   */
  if (
    existing &&
    existing.bvn === cleanBvn
  ) {
    return await updateBvn(
      userId,
      cleanBvn,
      Boolean(existing.bvn_verified)
    );
  }

  /**
   * New BVN requires verification.
   */
  return await updateBvn(
    userId,
    cleanBvn,
    false
  );
}

/**
 * =========================================================
 * SAVE NIN
 * =========================================================
 *
 * Same NIN -> preserve verification.
 * Different NIN -> reset verification.
 */

export async function saveNin(
  userId,
  nin
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const cleanNin =
    cleanValue(nin);

  if (!cleanNin) {
    throw new Error(
      "NIN is required"
    );
  }

  validateNin(cleanNin);

  const existing =
    await findIdentityByUserId(userId);

  const existingNin =
    await findIdentityByNin(
      cleanNin
    );

  if (
    existingNin &&
    existingNin.user_id !== userId
  ) {
    throw new Error(
      "This NIN is already associated with another account"
    );
  }

  /**
   * If the user already has this exact NIN,
   * preserve its verification state.
   */
  if (
    existing &&
    existing.nin === cleanNin
  ) {
    return await updateNin(
      userId,
      cleanNin,
      Boolean(existing.nin_verified)
    );
  }

  /**
   * New NIN requires verification.
   */
  return await updateNin(
    userId,
    cleanNin,
    false
  );
}

/**
 * =========================================================
 * VERIFY BVN
 * =========================================================
 */

export async function verifyBvn(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const identity =
    await findIdentityByUserId(
      userId
    );

  if (!identity) {
    throw new Error(
      "Identity record not found"
    );
  }

  if (!identity.bvn) {
    throw new Error(
      "BVN has not been provided"
    );
  }

  return await markBvnAsVerified(
    userId
  );
}

/**
 * =========================================================
 * VERIFY NIN
 * =========================================================
 */

export async function verifyNin(userId) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  const identity =
    await findIdentityByUserId(
      userId
    );

  if (!identity) {
    throw new Error(
      "Identity record not found"
    );
  }

  if (!identity.nin) {
    throw new Error(
      "NIN has not been provided"
    );
  }

  return await markNinAsVerified(
    userId
  );
}

/**
 * =========================================================
 * MARK USER BVN VERIFIED
 * =========================================================
 */

export async function markUserBvnVerified(
  userId
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return await markBvnAsVerified(
    userId
  );
}

/**
 * =========================================================
 * MARK USER NIN VERIFIED
 * =========================================================
 */

export async function markUserNinVerified(
  userId
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return await markNinAsVerified(
    userId
  );
}

/**
 * =========================================================
 * UPDATE IDENTITY STATUS
 * =========================================================
 */

export async function setIdentityStatus(
  userId,
  status
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!status) {
    throw new Error(
      "Identity status is required"
    );
  }

  return await updateIdentityStatus(
    userId,
    status
  );
}

/**
 * =========================================================
 * UPDATE USER IDENTITY STATUS
 * =========================================================
 */

export async function updateUserIdentityStatus(
  userId,
  status
) {
  return await setIdentityStatus(
    userId,
    status
  );
}

/**
 * =========================================================
 * DELETE IDENTITY
 * =========================================================
 */

export async function removeIdentity(
  userId
) {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return await deleteIdentityVerification(
    userId
  );
}

/**
 * =========================================================
 * DELETE USER IDENTITY
 * =========================================================
 */

export async function deleteUserIdentity(
  userId
) {
  return await removeIdentity(
    userId
  );
}

