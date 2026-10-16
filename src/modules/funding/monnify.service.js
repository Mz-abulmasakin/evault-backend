// src/modules/funding/monnify.service.js

import axios from "axios";

import env from "../../config/env.js";

import {
  getAccessToken,
} from "./monnify.auth.service.js";


/**
 * =========================================================
 * CREATE MONNIFY RESERVED / DEDICATED ACCOUNT
 * =========================================================
 *
 * Creates a dedicated funding account for an Evault user.
 *
 * Flow:
 *
 * User
 *   ↓
 * Identity Module
 *   ↓
 * BVN / NIN
 *   ↓
 * Funding Service
 *   ↓
 * Monnify Service
 *   ↓
 * Monnify
 *
 * IMPORTANT:
 * Identity information is passed into this service by
 * funding.service.js.
 *
 * This service does NOT save BVN/NIN.
 *
 * BVN/NIN should already exist in:
 *
 * identity_verifications
 *
 * =========================================================
 */

export async function createReservedAccount(
  user,
  identity
) {

  /**
   * -------------------------------------------------------
   * 1. Validate user
   * -------------------------------------------------------
   */

  if (!user) {

    throw new Error(
      "User is required"
    );

  }


  /**
   * -------------------------------------------------------
   * 2. Validate identity
   * -------------------------------------------------------
   *
   * Monnify production reserved accounts require
   * customer identity information.
   *
   */

  if (!identity) {

    throw new Error(
      "Identity information is required before creating a dedicated account"
    );

  }


  /**
   * -------------------------------------------------------
   * 3. Get customer name
   * -------------------------------------------------------
   */

  const fullName =
    user.full_name ||
    user.fullName;


  if (!fullName) {

    throw new Error(
      "User full name is missing"
    );

  }


  /**
   * -------------------------------------------------------
   * 4. Get customer email
   * -------------------------------------------------------
   */

  if (!user.email) {

    throw new Error(
      "User email is missing"
    );

  }


  /**
   * -------------------------------------------------------
   * 5. Get BVN / NIN
   * -------------------------------------------------------
   */

  const bvn =
    identity.bvn
      ?.toString()
      .trim() || null;


  const nin =
    identity.nin
      ?.toString()
      .trim() || null;


  /**
   * At least one identity number must exist.
   */

  if (!bvn && !nin) {

    throw new Error(
      "BVN or NIN is required before creating a dedicated account"
    );

  }


  /**
   * -------------------------------------------------------
   * 6. Validate BVN
   * -------------------------------------------------------
   */

  if (
    bvn &&
    !/^\d{11}$/.test(bvn)
  ) {

    throw new Error(
      "BVN must contain exactly 11 digits"
    );

  }


  /**
   * -------------------------------------------------------
   * 7. Validate NIN
   * -------------------------------------------------------
   */

  if (
    nin &&
    !/^\d{11}$/.test(nin)
  ) {

    throw new Error(
      "NIN must contain exactly 11 digits"
    );

  }


  /**
   * -------------------------------------------------------
   * 8. Generate Evault account reference
   * -------------------------------------------------------
   *
   * This reference uniquely identifies the customer
   * inside Evault.
   *
   */

  const accountReference =
    `EVAULT-${user.id}`;


  console.log(
    "Creating Monnify Reserved Account..."
  );


  console.log(
    "Account Reference:",
    accountReference
  );


  console.log(
    "Customer:",
    fullName
  );


  console.log(
    "Identity:",
    bvn
      ? "BVN provided"
      : "NIN provided"
  );


  /**
   * -------------------------------------------------------
   * 9. Get Monnify access token
   * -------------------------------------------------------
   */

  const token =
    await getAccessToken();


  /**
   * -------------------------------------------------------
   * 10. Read Monnify configuration
   * -------------------------------------------------------
   */

  const baseUrl =
    env.integrations
      ?.monnify
      ?.baseUrl;


  const contractCode =
    env.integrations
      ?.monnify
      ?.contractCode;


  if (!baseUrl) {

    throw new Error(
      "MONNIFY_BASE_URL is not configured"
    );

  }


  if (!contractCode) {

    throw new Error(
      "MONNIFY_CONTRACT_CODE is not configured"
    );

  }


  /**
   * -------------------------------------------------------
   * 11. Normalize Monnify base URL
   * -------------------------------------------------------
   */

  const normalizedBaseUrl =
    baseUrl.replace(
      /\/+$/,
      ""
    );


  /**
   * -------------------------------------------------------
   * 12. Monnify endpoint
   * -------------------------------------------------------
   */

  const endpoint =
    `${normalizedBaseUrl}/api/v2/bank-transfer/reserved-accounts`;


  console.log(
    "Monnify Reserved Account URL:",
    endpoint
  );


  /**
   * -------------------------------------------------------
   * 13. Build request payload
   * -------------------------------------------------------
   *
   * IMPORTANT:
   *
   * Do not send undefined properties to Monnify.
   *
   * If BVN exists, send BVN.
   *
   * If NIN exists, send NIN.
   *
   */

  const payload = {

    accountReference,

    accountName:
      fullName,

    currencyCode:
      "NGN",

    contractCode,

    customerEmail:
      user.email,

    customerName:
      fullName,

    getAllAvailableBanks:
      false,

    preferredBanks: [
      "035",
    ],

  };


  /**
   * -------------------------------------------------------
   * 14. Add identity information
   * -------------------------------------------------------
   */

  if (bvn) {

    payload.bvn =
      bvn;

  }


  if (nin) {

    payload.nin =
      nin;

  }


  /**
   * -------------------------------------------------------
   * 15. Log safe request information
   * -------------------------------------------------------
   *
   * NEVER log the actual BVN/NIN.
   *
   */

  console.log(
    "Monnify Reserved Account Request:",
    {
      accountReference,
      customerName: fullName,
      customerEmail: user.email,
      hasBvn: Boolean(bvn),
      hasNin: Boolean(nin),
      contractCode,
    }
  );


  /**
   * -------------------------------------------------------
   * 16. Send request to Monnify
   * -------------------------------------------------------
   */

  try {

    const response =
      await axios.post(

        endpoint,

        payload,

        {

          headers: {

            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",

          },

          timeout:
            30000,

        }

      );


    /**
     * -----------------------------------------------------
     * 17. Validate Monnify response
     * -----------------------------------------------------
     */

    if (
      !response.data
        ?.requestSuccessful
    ) {

      throw new Error(

        response.data
          ?.responseMessage ||

        "Monnify reserved account creation failed"

      );

    }


    /**
     * -----------------------------------------------------
     * 18. Extract response body
     * -----------------------------------------------------
     */

    const account =
      response.data
        ?.responseBody;


    if (!account) {

      throw new Error(
        "Monnify returned an empty reserved account response"
      );

    }


    /**
     * -----------------------------------------------------
     * 19. Validate account number
     * -----------------------------------------------------
     */

    const firstAccount =
      account.accounts?.[0];


    const accountNumber =
      account.accountNumber ||
      firstAccount?.accountNumber;


    if (!accountNumber) {

      throw new Error(
        "Monnify did not return a dedicated account number"
      );

    }


    /**
     * -----------------------------------------------------
     * 20. Validate reservation reference
     * -----------------------------------------------------
     */

    if (
      !account.reservationReference
    ) {

      throw new Error(
        "Monnify did not return a reservation reference"
      );

    }


    /**
     * -----------------------------------------------------
     * 21. Log successful response
     * -----------------------------------------------------
     */

    console.log(
      "Monnify Reserved Account Created:",
      {

        accountReference:
          account.accountReference,

        accountNumber,

        bankName:
          firstAccount?.bankName,

        reservationReference:
          account.reservationReference,

        status:
          account.status,

      }
    );


    /**
     * -----------------------------------------------------
     * 22. Return Monnify response
     * -----------------------------------------------------
     */

    return account;

  }

  catch (error) {

    /**
     * -----------------------------------------------------
     * 23. Handle Monnify error
     * -----------------------------------------------------
     */

    console.error(
      "Monnify Create Reserved Account Error:",
      error.response
        ?.data ||
      error.message
    );


    /**
     * -----------------------------------------------------
     * 24. Convert common Monnify errors into useful
     *     application errors
     * -----------------------------------------------------
     */

    if (
      error.response
        ?.data
        ?.responseMessage
    ) {

      throw new Error(

        error.response
          .data
          .responseMessage

      );

    }


    if (
      error.response
        ?.status === 401
    ) {

      throw new Error(
        "Monnify authentication failed. Check your API credentials."
      );

    }


    if (
      error.response
        ?.status === 422
    ) {

      throw new Error(
        "Monnify rejected the reserved account request. Check the customer identity information and account configuration."
      );

    }


    if (
      error.code ===
      "ECONNABORTED"
    ) {

      throw new Error(
        "Monnify request timed out"
      );

    }


    if (
      error.code ===
      "ERR_BAD_REQUEST"
    ) {

      throw new Error(
        "Monnify rejected the reserved account request"
      );

    }


    throw error;

  }

}