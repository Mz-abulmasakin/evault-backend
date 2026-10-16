 // src/modules/airtime/airtime.controller.js

import {
  findAirtimePlans,
  findAirtimePlan,
} from "./airtime.repository.js";

import {
  purchaseAirtime,
} from "./airtime.service.js";


/**
 * =========================================================
 * GET AIRTIME PLANS
 * =========================================================
 */

export async function getAirtimePlans(
  req,
  res
) {

  try {

    const networkId =
      req.query.networkId
        ? Number(req.query.networkId)
        : null;


    if (
      networkId !== null &&
      (
        !Number.isInteger(
          networkId
        ) ||
        networkId <= 0
      )
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid networkId",

      });

    }


    const plans =
      await findAirtimePlans(
        networkId
      );


    return res.status(200).json({

      success: true,

      data:
        plans,

    });


  } catch (error) {

    console.error(
      "Get airtime plans error:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch airtime plans",

    });

  }

}


/**
 * =========================================================
 * PURCHASE AIRTIME
 * =========================================================
 */

export async function purchaseAirtimeController(
  req,
  res
) {

  try {

    const userId =
      req.user.id;


    const {
      network,
      phoneNumber,
      amount,
      pin,
    } = req.body;


    /**
     * -------------------------------------------------------
     * VALIDATE REQUEST
     * -------------------------------------------------------
     */

    if (!network) {

      return res.status(400).json({

        success: false,

        message:
          "Network is required.",

      });

    }


    if (!phoneNumber) {

      return res.status(400).json({

        success: false,

        message:
          "Phone number is required.",

      });

    }


    if (
      amount ===
      undefined ||
      amount ===
      null ||
      amount === ""
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Amount is required.",

      });

    }


    if (!pin) {

      return res.status(400).json({

        success: false,

        message:
          "Transaction PIN is required.",

      });

    }


    /**
     * -------------------------------------------------------
     * PURCHASE
     * -------------------------------------------------------
     */

    const result =
      await purchaseAirtime({

        userId,

        network,

        phoneNumber,

        amount,

        pin,

      });


    /**
     * -------------------------------------------------------
     * PROVIDER FAILURE + REFUND
     * -------------------------------------------------------
     */

    if (
      result.success === false
    ) {

      return res.status(200).json(
        result
      );

    }


    /**
     * -------------------------------------------------------
     * SUCCESS
     * -------------------------------------------------------
     */

    return res.status(200).json({

      success: true,

      message:
        "Airtime purchase successful.",

      data:
        result,

    });


  } catch (error) {

    console.error(
      "Purchase airtime error:",
      error
    );


    return res.status(
      error.statusCode ||
      400
    ).json({

      success: false,

      message:
        error.message ||
        "Airtime purchase failed.",

    });

  }

}