
import {
  manualFundCustomer,
  manualDeductCustomer,
} from "./admin.manual-funding.service.js";

// =========================================================
// MANUAL FUNDING CONTROLLER
// =========================================================

export async function manualFundUser(req, res) {
  try {
    const result = await manualFundCustomer(
      req.params.id,
      req.body,
      {
        id: req.admin?.id,
        email: req.admin?.email,
        role: req.admin?.role,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Customer wallet funded successfully.",
      data: {
        wallet: {
          id: result.wallet.id,
          user_id: result.wallet.user_id,
          wallet_number: result.wallet.wallet_number,
          available_balance: result.wallet.available_balance,
          ledger_balance: result.wallet.ledger_balance,
          currency: result.wallet.currency,
          status: result.wallet.status,
        },
        transaction: result.transaction,
      },
    });
  } catch (error) {
    console.error("[ADMIN MANUAL FUNDING]", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to manually fund customer wallet.",
    });
  }
}

// =========================================================
// MANUAL DEDUCTION CONTROLLER
// =========================================================

export async function manualDeductUser(req, res) {
  try {
    const result = await manualDeductCustomer(
      req.params.id,
      req.body,
      {
        id: req.admin?.id,
        email: req.admin?.email,
        role: req.admin?.role,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Customer wallet deducted successfully.",
      data: {
        wallet: {
          id: result.wallet.id,
          user_id: result.wallet.user_id,
          wallet_number: result.wallet.wallet_number,
          available_balance: result.wallet.available_balance,
          ledger_balance: result.wallet.ledger_balance,
          currency: result.wallet.currency,
          status: result.wallet.status,
        },
        transaction: result.transaction,
      },
    });
  } catch (error) {
    console.error("[ADMIN MANUAL DEDUCTION]", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to deduct from customer wallet.",
    });
  }
}
