
import {
  getDashboardData,
} from "./admin.dashboard.service.js";

/**
 * =========================================================
 * GET ADMIN DASHBOARD
 * =========================================================
 */

export async function getDashboard(req, res) {
  try {
    const dashboard = await getDashboardData();

    return res.status(200).json({
      success: true,
      message: "Admin dashboard loaded successfully",
      data: dashboard,
    });

  } catch (error) {
    console.error("====================================");
    console.error("EVAULT ADMIN DASHBOARD FAILURE");
    console.error("====================================");

    console.error("Message:", error.message);
    console.error("Cause:", error.cause?.message);
    console.error("PostgreSQL Code:", error.cause?.code);
    console.error("Detail:", error.cause?.detail);
    console.error("Hint:", error.cause?.hint);
    console.error("Stack:", error.cause?.stack || error.stack);

    console.error("====================================");

    return res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard",
    });
  }
}
