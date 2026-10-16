 // src/modules/funding/monnify.transaction.service.js

import axios from "axios";

import env from "../../config/env.js";

import {
  getAccessToken,
} from "./monnify.auth.service.js";


/**
 * =========================================================
 * VERIFY MONNIFY TRANSACTION
 * =========================================================
 *
 * This function independently verifies a Monnify transaction
 * before Evault credits the user's wallet.
 *
 * Flow:
 *
 * Monnify Webhook
 *       ↓
 * Extract transaction reference
 *       ↓
 * Get Monnify access token
 *       ↓
 * Query Monnify transaction
 *       ↓
 * Confirm PAID
 *       ↓
 * Return normalized transaction
 *
 * IMPORTANT:
 *
 * We do NOT trust the webhook amount alone.
 */
export async function verifyTransaction(
  transactionReference
) {

  /**
   * =======================================================
   * VALIDATE TRANSACTION REFERENCE
   * =======================================================
   */

  if (!transactionReference) {

    throw new Error(
      "Transaction reference is required"
    );

  }


  console.log(
    "VERIFY MONNIFY TRANSACTION:",
    transactionReference
  );


  /**
   * =======================================================
   * LOCAL TEST MODE
   * =======================================================
   *
   * This is only for our manual development test:
   *
   * MNFY_TEST_001
   *
   * IMPORTANT:
   *
   * Real Monnify references such as:
   *
   * MNFY|93|20260818152918|016707
   *
   * will NOT use this block.
   */

  if (
    transactionReference.startsWith(
      "MNFY_TEST"
    )
  ) {

    console.warn(
      "Using local Monnify test transaction mode"
    );


    return {

      paymentStatus:
        "PAID",

      amountPaid:
        5000,

      transactionReference,

      paymentMethod:
        "TEST",

      currency:
        "NGN",

      currencyCode:
        "NGN",

      raw: {

        test:
          true,

      },

    };

  }


  /**
   * =======================================================
   * GET MONNIFY ACCESS TOKEN
   * =======================================================
   */

  let token;

  try {

    token =
      await getAccessToken();

  } catch (error) {

    console.error(
      "MONNIFY ACCESS TOKEN ERROR:",
      error.response?.data ||
      error.message
    );

    throw new Error(
      "Unable to authenticate with Monnify"
    );

  }


  if (!token) {

    throw new Error(
      "Monnify access token was not returned"
    );

  }


  /**
   * =======================================================
   * GET MONNIFY BASE URL
   * =======================================================
   */

  const baseUrl =
    env.integrations
      ?.monnify
      ?.baseUrl;


  if (!baseUrl) {

    throw new Error(
      "MONNIFY_BASE_URL is not configured"
    );

  }


  /**
   * Remove trailing slash.
   *
   * Example:
   *
   * https://sandbox.monnify.com/
   *
   * becomes:
   *
   * https://sandbox.monnify.com
   */

  const normalizedBaseUrl =
    baseUrl.replace(
      /\/+$/,
      ""
    );


  /**
   * =======================================================
   * MONNIFY TRANSACTION QUERY URL
   * =======================================================
   */

  const url =
    `${normalizedBaseUrl}/api/v2/merchant/transactions/query`;


  console.log(
    "MONNIFY TRANSACTION QUERY:",
    url
  );


  /**
   * =======================================================
   * QUERY MONNIFY
   * =======================================================
   */

  try {

    const response =
      await axios.get(
        url,
        {

          params: {

            transactionReference,

          },

          headers: {

            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

          },

          timeout:
            30000,

        }
      );


    /**
     * =====================================================
     * LOG MONNIFY RESPONSE
     * =====================================================
     */

    console.log(
      "MONNIFY TRANSACTION RESPONSE:",
      JSON.stringify(
        response.data,
        null,
        2
      )
    );


    /**
     * =====================================================
     * CHECK REQUEST SUCCESS
     * =====================================================
     */

    if (
      !response.data
        ?.requestSuccessful
    ) {

      throw new Error(
        response.data
          ?.responseMessage ||
        "Monnify transaction verification failed"
      );

    }


    /**
     * =====================================================
     * EXTRACT TRANSACTION
     * =====================================================
     */

    const transaction =
      response.data
        ?.responseBody;


    if (!transaction) {

      throw new Error(
        "Monnify returned an empty transaction response"
      );

    }


    /**
     * =====================================================
     * NORMALIZE PAYMENT STATUS
     * =====================================================
     */

    const paymentStatus =
      String(
        transaction.paymentStatus ||
        ""
      ).toUpperCase();


    /**
     * =====================================================
     * NORMALIZE AMOUNT
     * =====================================================
     */

    const amountPaid =
      Number(
        transaction.amountPaid
      );


    if (
      !Number.isFinite(
        amountPaid
      )
    ) {

      throw new Error(
        "Monnify returned an invalid transaction amount"
      );

    }


    /**
     * =====================================================
     * NORMALIZE CURRENCY
     * =====================================================
     */

    const currencyCode =
      transaction.currencyCode ||
      transaction.currency ||
      "NGN";


    /**
     * =====================================================
     * NORMALIZED RESULT
     * =====================================================
     */

    const result = {

      paymentStatus,

      amountPaid,

      transactionReference:
        transaction.transactionReference ||
        transactionReference,

      paymentReference:
        transaction.paymentReference ||
        transactionReference,

      paymentMethod:
        transaction.paymentMethod ||
        null,

      currency:
        currencyCode,

      currencyCode,

      paymentDescription:
        transaction.paymentDescription ||
        null,

      paidOn:
        transaction.paidOn ||
        null,

      settlementAmount:
        transaction.settlementAmount ||
        null,

      destinationAccountInformation:
        transaction.destinationAccountInformation ||
        null,

      paymentSourceInformation:
        transaction.paymentSourceInformation ||
        [],

      raw:
        transaction,

    };


    /**
     * =====================================================
     * LOG NORMALIZED RESULT
     * =====================================================
     */

    console.log(
      "NORMALIZED MONNIFY TRANSACTION:",
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;


  } catch (error) {

    /**
     * =====================================================
     * MONNIFY API ERROR
     * =====================================================
     */

    console.error(
      "Monnify Verify Transaction Error:",
      error.response?.data ||
      error.message
    );


    /**
     * -----------------------------------------------------
     * HTTP ERROR
     * -----------------------------------------------------
     */

    if (
      error.response
    ) {

      const responseData =
        error.response.data;


      throw new Error(
        responseData
          ?.responseMessage ||
        `Monnify transaction verification failed with status ${error.response.status}`
      );

    }


    /**
     * -----------------------------------------------------
     * NETWORK / TIMEOUT ERROR
     * -----------------------------------------------------
     */

    if (
      error.code ===
      "ECONNABORTED"
    ) {

      throw new Error(
        "Monnify transaction verification timed out"
      );

    }


    /**
     * -----------------------------------------------------
     * NORMAL ERROR
     * -----------------------------------------------------
     */

    throw error;

  }

}