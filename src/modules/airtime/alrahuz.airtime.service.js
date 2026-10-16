 // src/modules/airtime/alrahuz.airtime.service.js

import axios from "axios";
import env from "../../config/env.js";

/**
 * =========================================================
 * ALRAHUZ AIRTIME SERVICE
 * =========================================================
 *
 * Provider:
 * AlrahuzData
 *
 * Endpoint:
 * POST /api/topup/
 *
 * Request format:
 *
 * {
 *   network: 1,
 *   amount: 200,
 *   mobile_number: "08012345678",
 *   Ported_number: true,
 *   airtime_type: "VTU"
 * }
 *
 * Network IDs:
 *
 * MTN     = 1
 * GLO     = 2
 * 9MOBILE = 3
 * AIRTEL  = 4
 *
 */


/**
 * =========================================================
 * GET ALRAHUZ BASE URL
 * =========================================================
 */
function getBaseUrl() {

  const baseUrl =
    env.integrations
      ?.alrahuzdata
      ?.baseUrl;

  if (!baseUrl) {

    throw new Error(
      "ALRAHUZDATA_BASE_URL is not configured"
    );

  }

  return baseUrl.replace(
    /\/+$/,
    ""
  );
}


/**
 * =========================================================
 * GET ALRAHUZ API KEY
 * =========================================================
 */
function getApiKey() {

  const apiKey =
    env.integrations
      ?.alrahuzdata
      ?.apiKey;

  if (!apiKey) {

    throw new Error(
      "ALRAHUZDATA_API_KEY is not configured"
    );

  }

  return apiKey;
}


/**
 * =========================================================
 * GET NETWORK ID
 * =========================================================
 *
 * Converts the frontend network name into the
 * Alrahuz network ID.
 *
 * Frontend:
 *
 * MTN
 * GLO
 * 9mobile
 * Airtel
 *
 * Alrahuz:
 *
 * MTN     = 1
 * GLO     = 2
 * 9MOBILE = 3
 * AIRTEL  = 4
 *
 */
function getNetworkId(network) {

  if (!network) {

    throw new Error(
      "Network is required"
    );

  }


  const normalizedNetwork =
    String(network)
      .trim()
      .toLowerCase();


  switch (normalizedNetwork) {

    case "mtn":
      return Number(
        process.env.ALRAHUZ_MTN_NETWORK_ID || 1
      );


    case "glo":
      return Number(
        process.env.ALRAHUZ_GLO_NETWORK_ID || 2
      );


    case "9mobile":
    case "9 mobile":
    case "9MOBILE".toLowerCase():

      return Number(
        process.env.ALRAHUZ_9MOBILE_NETWORK_ID || 3
      );


    case "airtel":

      return Number(
        process.env.ALRAHUZ_AIRTEL_NETWORK_ID || 4
      );


    default:

      throw new Error(
        `Unsupported Alrahuz network: ${network}`
      );

  }

}


/**
 * =========================================================
 * VALIDATE AIRTIME REQUEST
 * =========================================================
 */
function validateAirtimeRequest({
  network,
  amount,
  phoneNumber,
}) {

  if (!network) {

    throw new Error(
      "Network is required"
    );

  }


  if (!phoneNumber) {

    throw new Error(
      "Phone number is required"
    );

  }


  if (!amount) {

    throw new Error(
      "Airtime amount is required"
    );

  }


  const numericAmount =
    Number(amount);


  if (
    !Number.isFinite(
      numericAmount
    ) ||
    numericAmount <= 0
  ) {

    throw new Error(
      "Invalid airtime amount"
    );

  }


  const cleanPhone =
    String(phoneNumber)
      .replace(/\s+/g, "")
      .replace(/^\+234/, "0");


  if (
    !/^0\d{10}$/.test(
      cleanPhone
    )
  ) {

    throw new Error(
      "Invalid Nigerian phone number"
    );

  }


  return {
    network,
    amount: numericAmount,
    phoneNumber: cleanPhone,
  };

}


/**
 * =========================================================
 * BUY AIRTIME
 * =========================================================
 */
export async function buyAirtime({

  network,

  amount,

  phoneNumber,

  reference,

}) {

  /**
   * -------------------------------------------------------
   * VALIDATE
   * -------------------------------------------------------
   */

  const validated =
    validateAirtimeRequest({

      network,

      amount,

      phoneNumber,

    });


  /**
   * -------------------------------------------------------
   * GET CONFIGURATION
   * -------------------------------------------------------
   */

  const baseUrl =
    getBaseUrl();


  const apiKey =
    getApiKey();


  /**
   * -------------------------------------------------------
   * CONVERT NETWORK
   * -------------------------------------------------------
   */

  const networkId =
    getNetworkId(
      validated.network
    );


  /**
   * -------------------------------------------------------
   * BUILD PAYLOAD
   * -------------------------------------------------------
   */

  const payload = {

    network:
      networkId,

    amount:
      validated.amount,

    mobile_number:
      validated.phoneNumber,

    Ported_number:
      true,

    airtime_type:
      "VTU",

  };


  /**
   * -------------------------------------------------------
   * PROVIDER URL
   * -------------------------------------------------------
   *
   * baseUrl:
   *
   * https://alrahuzdata.com.ng
   *
   * becomes:
   *
   * https://alrahuzdata.com.ng/api/topup/
   *
   */

  const endpoint =
    `${baseUrl}/api/topup/`;


  /**
   * -------------------------------------------------------
   * LOG REQUEST
   * -------------------------------------------------------
   *
   * DO NOT log the API key.
   *
   */

  console.log(
    "=========================================="
  );

  console.log(
    "Alrahuz Airtime Request"
  );

  console.log({
    endpoint,

    network:
      networkId,

    amount:
      validated.amount,

    mobile_number:
      validated.phoneNumber,

    Ported_number:
      true,

    airtime_type:
      "VTU",

    reference,

  });

  console.log(
    "=========================================="
  );


  /**
   * -------------------------------------------------------
   * SEND REQUEST
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
              `Token ${apiKey}`,

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
     * -----------------------------------------------------
     * PROVIDER RESPONSE
     * -----------------------------------------------------
     */

    console.log(
      "Alrahuz Airtime Response:",
      response.data
    );


    /**
     * -----------------------------------------------------
     * SUCCESS
     * -----------------------------------------------------
     */

    return {

      success:
        true,

      data:
        response.data,

      httpStatus:
        response.status,

      reference,

      network:
        networkId,

      amount:
        validated.amount,

      phoneNumber:
        validated.phoneNumber,

    };


  } catch (error) {

    /**
     * -----------------------------------------------------
     * PROVIDER ERROR
     * -----------------------------------------------------
     */

    console.error(
      "=========================================="
    );

    console.error(
      "Alrahuz Airtime Error"
    );

    console.error(
      "Status:",
      error.response?.status
    );

    console.error(
      "Response:",
      error.response?.data
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "=========================================="
    );


    /**
     * -----------------------------------------------------
     * RETURN FAILURE
     * -----------------------------------------------------
     */

    return {

      success:
        false,

      data:
        error.response?.data || null,

      httpStatus:
        error.response?.status || 500,

      reference,

      network:
        networkId,

      amount:
        validated.amount,

      phoneNumber:
        validated.phoneNumber,

      error:
        error.message,

    };

  }

}