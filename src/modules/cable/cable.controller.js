/**
 * =========================================================
 * eVAULT CABLE TV CONTROLLER
 * =========================================================
 */

import {
  getProviders,
  getPlans,
  getPlansByProvider,
  verifySmartcard,
  purchaseCable as purchaseCableService,
  getCableTransactionStatusService,
  getHistory,
  getStatistics,
} from "./cable.service.js";

/**
 * =========================================================
 * GET AUTHENTICATED USER ID
 * =========================================================
 */

function getUserId(req) {
  return (
    req?.user?.id ??
    req?.user?.userId ??
    req?.auth?.userId ??
    req?.auth?.id ??
    null
  );
}

/**
 * =========================================================
 * ERROR RESPONSE
 * =========================================================
 */

function sendError(
  res,
  error,
  fallbackMessage
) {
  console.error(
    "CABLE CONTROLLER ERROR:",
    error
  );

  const status =
    Number.isInteger(
      error?.status
    ) &&
    error.status >= 400 &&
    error.status < 600
      ? error.status
      : 500;

  return res
    .status(status)
    .json({
      success: false,

      message:
        error?.message ||
        fallbackMessage,

      error:
        error?.code ||
        null,
    });
}

/**
 * =========================================================
 * GET /cable/service
 * =========================================================
 */

export async function getCableServiceController(
  req,
  res
) {
  return res
    .status(200)
    .json({
      success: true,

      data: {
        provider:
          "vtugate",

        available:
          true,

        currency:
          "NGN",

        supports: [
          "providers",
          "smartcard verification",
          "plans from verification",
          "purchase",
          "history",
        ],
      },
    });
}

/**
 * =========================================================
 * GET /cable/providers
 * =========================================================
 */

export async function getCableProvidersController(
  req,
  res
) {
  try {
    const result =
      await getProviders();

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Cable providers retrieved successfully.",

        data:
          result?.data ??
          [],
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve cable providers."
    );
  }
}

/**
 * =========================================================
 * GET /cable/plans
 * =========================================================
 *
 * VTUGATE returns authoritative cable plans
 * from /verifycabletv.
 *
 * This route remains for frontend compatibility.
 * =========================================================
 */

export async function getCablePlansController(
  req,
  res
) {
  try {
    const result =
      await getPlans();

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Cable plans retrieved successfully.",

        data:
          result?.data ??
          [],
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve cable plans."
    );
  }
}

/**
 * =========================================================
 * GET /cable/plans/:providerId
 * =========================================================
 */

export async function getCablePlansByProviderController(
  req,
  res
) {
  try {
    const providerId =
      req?.params?.providerId ??
      req?.params?.serviceId;

    const result =
      await getPlansByProvider(
        providerId
      );

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Cable plans retrieved successfully.",

        data:
          result?.data ??
          [],
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve cable plans."
    );
  }
}

/**
 * =========================================================
 * POST /cable/verify
 * =========================================================
 */

export async function verifyCableSmartcardController(
  req,
  res
) {
  try {
    const body =
      req?.body || {};

    const result =
      await verifySmartcard({
        providerId:
          body?.providerId ??
          body?.provider_id,

        serviceId:
          body?.serviceId ??
          body?.service_id,

        phone:
          body?.phone,

        smartCardNumber:
          body?.smartCardNumber ??
          body?.smartcardNumber ??
          body?.smartcard_number,
      });

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Verification was successful",

        data: {
          ...(result?.data ?? {}),

          cable_plans:
            result?.plans ??
            result?.data
              ?.cable_plans ??
            [],
        },

        provider:
          "vtugate",
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to verify cable smartcard."
    );
  }
}

/**
 * =========================================================
 * POST /cable/purchase
 * =========================================================
 */

export async function purchaseCableController(
  req,
  res
) {
  try {
    const body =
      req?.body || {};

    const userId =
      getUserId(req);

    const result =
      await purchaseCableService({
        userId,

        transactionPin:
          body?.transactionPin ??
          body?.transaction_pin,

        serviceId:
          body?.serviceId ??
          body?.service_id ??
          body?.providerId ??
          body?.provider_id,

        phone:
          body?.phone,

        smartCardNumber:
          body?.smartCardNumber ??
          body?.smartcardNumber ??
          body?.smartcard_number,

        amount:
          body?.amount,

        planCode:
          body?.planCode ??
          body?.plan_code,

        planName:
          body?.planName ??
          body?.plan_name,
      });

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Cable TV purchase successful.",

        data:
          result,
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Cable TV purchase failed."
    );
  }
}

/**
 * =========================================================
 * POST /cable/status
 * =========================================================
 */

export async function getCableTransactionStatusController(
  req,
  res
) {
  try {
    const body =
      req?.body || {};

    const result =
      await getCableTransactionStatusService({
        transactionId:
          body?.transactionId ??
          body?.transaction_id,

        externalReference:
          body?.externalReference ??
          body?.external_reference,

        reference:
          body?.reference,
      });

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Transaction status retrieved successfully.",

        data:
          result?.data ??
          null,
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve Cable TV transaction status."
    );
  }
}

/**
 * =========================================================
 * GET /cable/history
 * =========================================================
 */

export async function getCableHistoryController(
  req,
  res
) {
  try {
    const result =
      await getHistory({
        page:
          req?.query?.page,

        perPage:
          req?.query?.per_page ??
          req?.query?.perPage,

        search:
          req?.query?.search,

        status:
          req?.query?.status ||
          "all",

        dateRange:
          req?.query?.date_range ??
          req?.query?.dateRange,

        sortBy:
          req?.query?.sort_by ??
          req?.query?.sortBy,

        order:
          req?.query?.order,
      });

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Cable history retrieved successfully.",

        data:
          result?.data ??
          [],

        pagination:
          result?.pagination ??
          null,
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve Cable TV history."
    );
  }
}

/**
 * =========================================================
 * GET /cable/stats
 * =========================================================
 */

export async function getCableStatisticsController(
  req,
  res
) {
  try {
    const result =
      await getStatistics();

    return res
      .status(200)
      .json({
        success: true,

        message:
          result?.message ||
          "Cable statistics retrieved successfully.",

        data:
          result?.data ??
          {},
      });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to retrieve Cable TV statistics."
    );
  }
}

/**
 * =========================================================
 * COMPATIBILITY ALIASES
 * =========================================================
 *
 * These names allow older route imports to continue working.
 * =========================================================
 */

export const getCableProviders =
  getCableProvidersController;

export const getCablePlans =
  getCablePlansController;

export const getCablePlansByProvider =
  getCablePlansByProviderController;

export const verifyCableSmartcard =
  verifyCableSmartcardController;

export const purchaseCable =
  purchaseCableController;

export const getCableTransactionStatus =
  getCableTransactionStatusController;

export const getCableHistory =
  getCableHistoryController;

export const getCableStatistics =
  getCableStatisticsController;

/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

export default {
  getCableServiceController,

  getCableProvidersController,

  getCablePlansController,

  getCablePlansByProviderController,

  verifyCableSmartcardController,

  purchaseCableController,

  getCableTransactionStatusController,

  getCableHistoryController,

  getCableStatisticsController,
};