
import axios from "axios";
import "dotenv/config";

/**
 * =========================================================
 * ALRAHUZ CONFIGURATION
 * =========================================================
 */

const ALRAHUZ_BASE_URL =
  process.env.ALRAHUZ_BASE_URL ||
  "https://api.alrahuzdata.com";

const ALRAHUZ_API_KEY =
  process.env.ALRAHUZDATA_API_KEY;

/**
 * =========================================================
 * AXIOS CLIENT
 * =========================================================
 */

const alrahuzClient = axios.create({
  baseURL: ALRAHUZ_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * =========================================================
 * PROVIDER ERROR HELPER
 * =========================================================
 *
 * We preserve provider status/code information so the
 * DATA SERVICE can determine whether the problem is:
 *
 * - Provider unavailable
 * - Plan unavailable
 * - Network/timeout problem
 * - Other provider failure
 *
 * The raw provider error is NEVER sent directly to the
 * customer by this service.
 */

function buildProviderError(error, operation) {
  const providerData =
    error?.response?.data;

  const status =
    error?.response?.status;

  const providerMessage =
    providerData?.message ||
    providerData?.error ||
    providerData?.detail ||
    providerData?.description ||
    error?.message ||
    "";

  const providerError = new Error(
    providerMessage ||
      `Alrahuz ${operation} failed`
  );

  // Preserve useful information for the
  // calling service.
  providerError.code =
    error?.code || null;

  providerError.status =
    status || null;

  providerError.providerStatus =
    status || null;

  providerError.providerData =
    providerData || null;

  providerError.isAxiosError =
    Boolean(error?.isAxiosError);

  providerError.operation =
    operation;

  return providerError;
}

/**
 * =========================================================
 * GET DATA PRICE LIST
 * =========================================================
 *
 * Returns the current data plans available from Alrahuz.
 */

export async function getDataPlans() {
  try {
    if (!ALRAHUZ_API_KEY) {
      throw new Error(
        "ALRAHUZ_API_KEY is not configured"
      );
    }

    const response =
      await alrahuzClient.get(
        "/api/data/",
        {
          headers: {
            Authorization:
              `Bearer ${ALRAHUZ_API_KEY}`,
          },
        }
      );

    return response.data;
  } catch (error) {
    console.error(
      "Alrahuz data price-list error:",
      {
        status:
          error?.response?.status,
        code:
          error?.code,
        data:
          error?.response?.data,
        message:
          error?.message,
      }
    );

    throw buildProviderError(
      error,
      "data price-list"
    );
  }
}

/**
 * =========================================================
 * PURCHASE DATA
 * =========================================================
 *
 * dataId       = Alrahuz plan/data ID
 * mobileNumber = recipient phone number
 * network      = network provider
 *
 * IMPORTANT:
 * This function DOES NOT debit or refund the wallet.
 *
 * Wallet debit/refund belongs to:
 *
 * src/modules/data/data.service.js
 *
 * This service only communicates with Alrahuz.
 */

export async function purchaseData({
  dataId,
  mobileNumber,
  network,
}) {
  try {
    if (!ALRAHUZ_API_KEY) {
      throw new Error(
        "ALRAHUZ_API_KEY is not configured"
      );
    }

    if (
      dataId === undefined ||
      dataId === null ||
      dataId === ""
    ) {
      throw new Error(
        "Alrahuz data plan ID is required"
      );
    }

    if (!mobileNumber) {
      throw new Error(
        "Mobile number is required"
      );
    }

    if (!network) {
      throw new Error(
        "Network is required"
      );
    }

    const response =
      await alrahuzClient.post(
        "/api/data/",
        {
          data_id: dataId,
          mobile_number: mobileNumber,
          network: String(network)
            .trim()
            .toUpperCase(),
        },
        {
          headers: {
            Authorization:
              `Bearer ${ALRAHUZ_API_KEY}`,
          },
        }
      );

    return response.data;
  } catch (error) {
    console.error(
      "Alrahuz data purchase error:",
      {
        status:
          error?.response?.status,
        code:
          error?.code,
        data:
          error?.response?.data,
        message:
          error?.message,
      }
    );

    throw buildProviderError(
      error,
      "data purchase"
    );
  }
}
 
