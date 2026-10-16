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
    console.error(
      "Admin Dashboard Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load admin dashboard",
    });
  }
}