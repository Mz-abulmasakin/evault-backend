
// scripts/seed-data-plans.js

import "dotenv/config";
import db from "../src/config/database.js";

/**
 * =========================================================
 * EVAULT DATA PLAN SEED
 * =========================================================
 *
 * Provider:
 * ALRAHUZ
 *
 * IMPORTANT:
 * - This seed DOES NOT delete existing plans.
 * - Existing plans remain untouched unless they have the
 *   same provider_plan_id.
 * - Existing Alrahuz plans are updated.
 * - New Alrahuz plans are inserted.
 *
 * PRICING:
 * - The prices inside ALRAHUZ_PLANS are the original
 *   Alrahuz provider prices.
 * - Evault automatically adds 1.5% profit margin.
 * - The final amount stored in data_plans.amount is the
 *   Evault customer selling price.
 *
 * Example:
 * Provider price = ₦100
 * Evault 1.5% profit = ₦1.50
 * Customer price = ₦101.50
 *
 * Alrahuz Network IDs:
 *
 * 1 = MTN
 * 2 = GLO
 * 3 = 9MOBILE
 * 4 = AIRTEL
 * 5 = SMILE
 *
 * Table:
 * data_plans
 *
 * =========================================================
 */

const PROVIDER = "ALRAHUZ";

/**
 * =========================================================
 * EVAULT PROFIT MARGIN
 * =========================================================
 *
 * 1.5% profit margin is added to every provider price.
 *
 * The original Alrahuz price remains in the seed catalog
 * and is also saved inside metadata as providerPrice.
 *
 * =========================================================
 */

const PROFIT_MARGIN = 0.015;

/**
 * =========================================================
 * CALCULATE EVAULT SELLING PRICE
 * =========================================================
 *
 * Example:
 *
 * ₦100  → ₦101.50
 * ₦200  → ₦203.00
 * ₦425  → ₦431.38
 *
 * =========================================================
 */

function calculateSellingPrice(providerPrice) {
  return Number(
    (Number(providerPrice) * (1 + PROFIT_MARGIN)).toFixed(2)
  );
}

/**
 * =========================================================
 * NETWORK MAP
 * =========================================================
 */

const NETWORKS = {
  1: "MTN",
  2: "GLO",
  3: "9MOBILE",
  4: "AIRTEL",
  5: "SMILE",
};

/**
 * =========================================================
 * ALRAHUZ DATA PLANS
 * =========================================================
 *
 * IMPORTANT:
 *
 * The amount below is the ORIGINAL ALRAHUZ PROVIDER PRICE.
 *
 * DO NOT manually add the 1.5% here.
 *
 * The seed automatically calculates:
 *
 *     provider price × 1.015
 *
 * and stores that amount as the Evault selling price.
 *
 * Format:
 *
 * [
 *   providerPlanId,
 *   network,
 *   planType,
 *   providerAmount,
 *   dataSize,
 *   validity
 * ]
 *
 * =========================================================
 */

const ALRAHUZ_PLANS = [
  // =======================================================
  // 9MOBILE
  // =======================================================

  [182, "9MOBILE", "GIFTING", 425, "500 MB", "30 days"],
  [183, "9MOBILE", "GIFTING", 850, "1.5 GB", "30 days"],
  [184, "9MOBILE", "GIFTING", 1020, "2 GB", "30 days"],
  [185, "9MOBILE", "GIFTING", 1275, "3 GB", "30 days"],
  [186, "9MOBILE", "GIFTING", 1700, "4.5 GB", "30 days"],
  [187, "9MOBILE", "GIFTING", 3400, "11 GB", "30 days"],
  [188, "9MOBILE", "GIFTING", 4200, "15 GB", "30 days"],
  [189, "9MOBILE", "GIFTING", 8500, "40 GB", "30 days"],

  [248, "9MOBILE", "SME", 220, "1 GB", "1 month"],
  [249, "9MOBILE", "SME", 330, "1.5 GB", "1 month"],
  [250, "9MOBILE", "SME", 720, "2 GB", "1 month"],
  [251, "9MOBILE", "SME", 660, "3 GB", "1 month"],
  [252, "9MOBILE", "SME", 880, "4 GB", "1 month"],
  [253, "9MOBILE", "SME", 1100, "5 GB", "1 month"],

  [262, "9MOBILE", "GIFTING", 12750, "75 GB", "1 month"],

  [269, "9MOBILE", "GIFTING", 46, "25 MB", "1 day"],
  [270, "9MOBILE", "GIFTING", 175, "650 MB", "1 day"],
  [272, "9MOBILE", "GIFTING", 425, "2000 MB", "3 days"],
  [273, "9MOBILE", "GIFTING", 1275, "7 GB", "7 days"],

  [292, "9MOBILE", "SME", 2200, "10 GB", "30 days"],

  [296, "9MOBILE", "CORPORATE GIFTING", 480, "1 GB", "30 days"],
  [297, "9MOBILE", "CORPORATE GIFTING", 960, "2 GB", "30 days"],
  [298, "9MOBILE", "CORPORATE GIFTING", 720, "1.5 GB", "30 days"],
  [299, "9MOBILE", "CORPORATE GIFTING", 1440, "3 GB", "30 days"],
  [300, "9MOBILE", "CORPORATE GIFTING", 2400, "5 GB", "30 days"],
  [301, "9MOBILE", "CORPORATE GIFTING", 4800, "10 GB", "30 days"],
  [302, "9MOBILE", "CORPORATE GIFTING", 240, "500 MB", "30 days"],
  [303, "9MOBILE", "CORPORATE GIFTING", 1920, "4 GB", "30 days"],
  [304, "9MOBILE", "SME", 980, "4.5 GB", "30 days"],
  [305, "9MOBILE", "CORPORATE GIFTING", 25, "25 MB", "30 days"],

  // =======================================================
  // AIRTEL
  // =======================================================

  [427, "AIRTEL", "GIFTING", 3200, "10 GB", "30 days"],
  [428, "AIRTEL", "SME", 3200, "10 GB", "30 days"],

  [436, "AIRTEL", "GIFTING", 55, "150 MB", "1 day"],
  [437, "AIRTEL", "SME", 55, "150 MB", "1 day"],

  [483, "AIRTEL", "GIFTING", 294, "1 GB", "3 days"],
  [484, "AIRTEL", "SME", 294, "1 GB", "3 days"],

  [485, "AIRTEL", "GIFTING", 4980, "13 GB", "30 days"],
  [486, "AIRTEL", "SME", 4980, "13 GB", "30 days"],

  [487, "AIRTEL", "GIFTING", 9950, "35 GB", "30 days"],
  [488, "AIRTEL", "SME", 9950, "35 GB", "30 days"],

  [489, "AIRTEL", "GIFTING", 14900, "60 GB", "30 days"],
  [490, "AIRTEL", "SME", 14900, "60 GB", "30 days"],

  [515, "AIRTEL", "CORPORATE GIFTING", 490, "500 MB", "7 days"],
  [516, "AIRTEL", "CORPORATE GIFTING", 784, "1 GB", "7 days"],
  [517, "AIRTEL", "CORPORATE GIFTING", 1470, "2 GB", "30 days"],
  [518, "AIRTEL", "CORPORATE GIFTING", 1960, "3 GB", "30 days"],
  [519, "AIRTEL", "CORPORATE GIFTING", 2450, "4 GB", "30 days"],
  [520, "AIRTEL", "CORPORATE GIFTING", 2950, "8 GB", "30 days"],
  [521, "AIRTEL", "CORPORATE GIFTING", 3910, "10 GB", "30 days"],
  [522, "AIRTEL", "CORPORATE GIFTING", 4900, "13 GB", "30 days"],
  [523, "AIRTEL", "CORPORATE GIFTING", 5880, "18 GB", "30 days"],
  [524, "AIRTEL", "CORPORATE GIFTING", 7840, "25 GB", "30 days"],
  [525, "AIRTEL", "CORPORATE GIFTING", 78, "75 MB", "1 day"],
  [526, "AIRTEL", "CORPORATE GIFTING", 100, "100 MB", "1 day"],
  [527, "AIRTEL", "CORPORATE GIFTING", 200, "200 MB", "2 days"],
  [528, "AIRTEL", "CORPORATE GIFTING", 298, "300 MB", "2 days"],
  [529, "AIRTEL", "CORPORATE GIFTING", 9800, "35 GB", "30 days"],
  [530, "AIRTEL", "CORPORATE GIFTING", 14700, "60 GB", "30 days"],
  [535, "AIRTEL", "CORPORATE GIFTING", 19600, "100 GB", "30 days"],

  [552, "AIRTEL", "GIFTING", 735, "3 GB", "1 day"],
  [553, "AIRTEL", "SME", 735, "3 GB", "2 days"],

  [556, "AIRTEL", "GIFTING", 55, "150 MB", "1 day"],
  [557, "AIRTEL", "SME", 55, "150 MB", "1 day"],

  [558, "AIRTEL", "GIFTING", 210, "600 MB", "2 days"],
  [559, "AIRTEL", "SME", 210, "600 MB", "2 days"],

  [560, "AIRTEL", "GIFTING", 110, "300 MB", "2 days"],
  [561, "AIRTEL", "SME", 110, "300 MB", "2 days"],

  [592, "AIRTEL", "GIFTING", 410, "1.5 GB", "1 day"],
  [593, "AIRTEL", "SME", 410, "1.5 GB", "1 day"],

  [594, "AIRTEL", "GIFTING", 1470, "4 GB", "7 days"],
  [595, "AIRTEL", "SME", 1470, "4 GB", "7 days"],

  [596, "AIRTEL", "GIFTING", 570, "2 GB", "2 days"],
  [597, "AIRTEL", "SME", 570, "2 GB", "2 days"],

  [602, "AIRTEL", "GIFTING", 1960, "8 GB", "30 days"],
  [603, "AIRTEL", "SME", 1960, "8 GB", "30 days"],

  [672, "AIRTEL", "GIFTING", 250, "1.2 GB", "7 days"],
  [673, "AIRTEL", "SME", 250, "1.2 GB", "7 days"],

  [674, "AIRTEL", "GIFTING", 350, "2 GB", "7 days"],
  [675, "AIRTEL", "SME", 350, "2 GB", "7 days"],

  [676, "AIRTEL", "GIFTING", 600, "3.2 GB", "30 days"],
  [677, "AIRTEL", "SME", 600, "3.2 GB", "30 days"],

  [678, "AIRTEL", "GIFTING", 600, "3.2 GB", "7 days"],
  [679, "AIRTEL", "SME", 600, "3.2 GB", "7 days"],

  [680, "AIRTEL", "GIFTING", 1200, "6.5 GB", "14 days"],
  [681, "AIRTEL", "SME", 1200, "6.5 GB", "14 days"],

  [682, "AIRTEL", "GIFTING", 4000, "20 GB", "30 days"],
  [683, "AIRTEL", "SME", 4000, "20 GB", "30 days"],

  // =======================================================
  // GLO
  // =======================================================

  [285, "GLO", "CORPORATE GIFTING", 400, "1 GB", "30 days"],
  [286, "GLO", "CORPORATE GIFTING", 800, "2 GB", "30 days"],
  [287, "GLO", "CORPORATE GIFTING", 1200, "3 GB", "30 days"],
  [288, "GLO", "CORPORATE GIFTING", 2000, "5 GB", "30 days"],
  [289, "GLO", "CORPORATE GIFTING", 4000, "10 GB", "30 days"],
  [290, "GLO", "CORPORATE GIFTING", 200, "500 MB", "30 days"],
  [291, "GLO", "CORPORATE GIFTING", 80, "200 MB", "30 days"],

  [351, "GLO", "GIFTING", 295, "1.5 GB", "1 day"],
  [352, "GLO", "GIFTING", 485, "2.5 GB", "2 days"],
  [354, "GLO", "GIFTING", 1950, "10 GB", "7 days"],

  [369, "GLO", "SME", 295, "1.5 GB", "1 day"],
  [370, "GLO", "SME", 485, "2.5 GB", "2 days"],
  [371, "GLO", "SME", 1950, "10 GB", "7 days"],

  [546, "GLO", "GIFTING", 1000, "3.5 GB", "7 days"],
  [547, "GLO", "SME", 1000, "3.5 GB", "7 days"],

  [548, "GLO", "GIFTING", 2000, "8.5 GB", "7 days"],
  [549, "GLO", "SME", 2000, "8.5 GB", "7 days"],

  [550, "GLO", "GIFTING", 4850, "20.5 GB", "7 days"],
  [551, "GLO", "SME", 4850, "20.5 GB", "7 days"],

  [563, "GLO", "CORPORATE GIFTING", 355, "1 GB", "7 days"],
  [564, "GLO", "CORPORATE GIFTING", 340, "1 GB", "3 days"],

  [620, "GLO", "CORPORATE GIFTING", 1065, "3 GB", "7 days"],
  [621, "GLO", "CORPORATE GIFTING", 1020, "3 GB", "3 days"],

  [625, "GLO", "CORPORATE GIFTING", 1700, "5 GB", "3 days"],
  [626, "GLO", "CORPORATE GIFTING", 1775, "5 GB", "7 days"],

  [692, "GLO", "GIFTING", 1450, "6 GB", "7 days"],
  [693, "GLO", "SME", 1450, "6 GB", "7 days"],

  [694, "GLO", "GIFTING", 3395, "12 GB", "30 days"],
  [695, "GLO", "SME", 3395, "12 GB", "30 days"],

  [696, "GLO", "GIFTING", 1550, "7.5 GB", "30 days"],
  [697, "GLO", "SME", 1550, "7.5 GB", "30 days"],

  // =======================================================
  // MTN
  // =======================================================

  [7, "MTN", "SME", 780, "1 GB", "7 days"],
  [8, "MTN", "SME", 1450, "2 GB", "30 days"],
  [44, "MTN", "SME", 2450, "3.5 GB", "30 days"],
  [219, "MTN", "SME", 485, "500 MB", "7 days"],

  [308, "MTN", "SME2", 3450, "7 GB", "1 month"],
  [310, "MTN", "SME2", 2450, "3.5 GB", "1 month"],
  [314, "MTN", "SME2", 1450, "2 GB", "1 month"],
  [315, "MTN", "SME2", 4400, "10 GB", "1 month"],
  [319, "MTN", "SME2", 780, "1 GB", "Weekly"],

  [330, "MTN", "DATA SHARE", 1600, "5 GB", "30 days"],
  [343, "MTN", "DATA COUPONS", 970, "3.2 GB", "2 days"],

  [378, "MTN", "GIFTING", 970, "3.2 GB", "2 days"],
  [379, "MTN", "GIFTING", 3450, "11 GB", "7 days"],

  [403, "MTN", "GIFTING", 485, "1 GB", "1 day"],
  [404, "MTN", "GIFTING", 2450, "6 GB", "7 days"],
  [405, "MTN", "GIFTING", 17500, "75 GB", "30 days"],
  [406, "MTN", "GIFTING", 49500, "200 GB", "60 days"],

  [407, "MTN", "DATA COUPONS", 4450, "10 GB", "30 days"],
  [408, "MTN", "GIFTING", 80, "75 MB", "1 day"],
  [409, "MTN", "GIFTING", 750, "2.5 GB", "1 day"],
  [410, "MTN", "GIFTING", 750, "2 GB", "2 days"],
  [412, "MTN", "GIFTING", 590, "1.5 GB", "2 days"],

  [413, "MTN", "GIFTING", 5000, "11 GB", "30 days"],
  [414, "MTN", "GIFTING", 6480, "16.5 GB", "30 days"],

  [416, "MTN", "DATA COUPONS", 7300, "20 GB", "30 days"],
  [417, "MTN", "GIFTING", 8950, "25 GB", "30 days"],
  [419, "MTN", "GIFTING", 2910, "4.2 GB", "30 days"],
  [420, "MTN", "GIFTING", 4450, "10 GB", "30 days"],

  [429, "MTN", "DATA COUPONS", 485, "1 GB", "1 day"],
  [430, "MTN", "DATA COUPONS", 590, "1.5 GB", "2 days"],
  [431, "MTN", "DATA COUPONS", 750, "2 GB", "2 days"],
  [432, "MTN", "DATA COUPONS", 900, "2.5 GB", "2 days"],
  [433, "MTN", "DATA COUPONS", 750, "2.5 GB", "1 day"],
  [434, "MTN", "DATA COUPONS", 2450, "6 GB", "7 days"],

  [438, "MTN", "DATA COUPONS", 2950, "4.2 GB", "30 days"],
  [440, "MTN", "DATA COUPONS", 3450, "11 GB", "7 days"],

  [441, "MTN", "GIFTING", 785, "1 GB", "7 days"],
  [442, "MTN", "DATA COUPONS", 785, "1 GB", "7 days"],

  [443, "MTN", "GIFTING", 96, "110 MB", "1 day"],
  [444, "MTN", "DATA COUPONS", 96, "110 MB", "1 day"],

  [445, "MTN", "GIFTING", 195, "230 MB", "1 day"],
  [446, "MTN", "DATA COUPONS", 195, "230 MB", "1 day"],

  [451, "MTN", "GIFTING", 1450, "2 GB", "30 days"],
  [452, "MTN", "DATA COUPONS", 1450, "2 GB", "30 days"],

  [453, "MTN", "GIFTING", 2450, "3.5 GB", "30 days"],
  [454, "MTN", "DATA COUPONS", 2450, "3.5 GB", "30 days"],

  [455, "MTN", "DATA COUPONS", 6480, "16.5 GB", "30 days"],
  [456, "MTN", "GIFTING", 3450, "7 GB", "30 days"],
  [457, "MTN", "DATA COUPONS", 3450, "7 GB", "30 days"],

  [458, "MTN", "GIFTING", 7300, "20 GB", "30 days"],
  [459, "MTN", "DATA COUPONS", 8950, "25 GB", "30 days"],

  [462, "MTN", "DATA COUPONS", 80, "75 MB", "1 day"],

  [463, "MTN", "SME2", 5350, "12.5 GB", "1 month"],
  [464, "MTN", "SME2", 6300, "16.5 GB", "1 month"],
  [465, "MTN", "SME2", 1480, "3.5 GB", "Weekly"],
  [466, "MTN", "SME2", 2910, "4.2 GB", "1 month"],

  [467, "MTN", "SME", 965, "1.5 GB", "7 days"],

  [473, "MTN", "SME2", 10800, "36 GB", "30 days"],
  [474, "MTN", "SME2", 15500, "65 GB", "30 days"],
  [475, "MTN", "SME2", 17450, "75 GB", "30 days"],
  [476, "MTN", "SME2", 35880, "165 GB", "30 days"],

  [479, "MTN", "CORPORATE GIFTING", 800, "2 GB", "21-30 days"],
  [480, "MTN", "CORPORATE GIFTING", 1100, "3 GB", "21-30 days"],

  [481, "MTN", "SME2", 800, "2 GB", "14-21 days"],
  [482, "MTN", "SME2", 1100, "3 GB", "21-30 days"],

  [497, "MTN", "CORPORATE GIFTING", 310, "500 MB", "7 days"],
  [498, "MTN", "CORPORATE GIFTING", 500, "1 GB", "21-30 days"],

  [500, "MTN", "SME", 270, "500 MB", "7 days"],
  [501, "MTN", "SME", 500, "1 GB", "21-30 days"],

  [502, "MTN", "CORPORATE GIFTING", 1600, "5 GB", "21-30 days"],
  [503, "MTN", "SME2", 1600, "5 GB", "21-30 days"],

  [504, "MTN", "SME2", 53500, "250 GB", "30 days"],
  [505, "MTN", "DATA COUPONS", 53500, "250 GB", "30 days"],

  [506, "MTN", "SME2", 24500, "90 GB", "60 days"],
  [507, "MTN", "DATA COUPONS", 24500, "90 GB", "60 days"],

  [509, "MTN", "SME2", 740, "2.5 GB", "1 day"],
  [510, "MTN", "GIFTING", 740, "2.5 GB", "1 day"],
  [511, "MTN", "DATA COUPONS", 740, "2.5 GB", "1 day"],

  [512, "MTN", "SME2", 4900, "20 GB", "7 days"],
  [513, "MTN", "GIFTING", 4900, "20 GB", "7 days"],
  [514, "MTN", "DATA COUPONS", 4900, "20 GB", "7 days"],

  [538, "MTN", "SME", 1600, "5 GB", "21-30 days"],

  [562, "MTN", "SME2", 500, "1 GB", "21-30 days"],

  [566, "MTN", "DATA SHARE", 300, "500 MB", "7 days"],
  [567, "MTN", "DATA SHARE", 500, "1 GB", "21-30 days"],
  [568, "MTN", "DATA SHARE", 800, "2 GB", "21-30 days"],
  [569, "MTN", "DATA SHARE", 1100, "3 GB", "21-30 days"],

  [570, "MTN", "GIFTING", 1600, "5 GB", "21-30 days"],
  [571, "MTN", "GIFTING", 1100, "3 GB", "21-30 days"],

  [572, "MTN", "SME", 1100, "3 GB", "21-30 days"],
  [573, "MTN", "SME", 800, "2 GB", "21-30 days"],

  [574, "MTN", "DATA COUPONS", 500, "1 GB", "21-30 days"],
  [575, "MTN", "GIFTING", 500, "1 GB", "21-30 days"],

  [576, "MTN", "SME2", 123000, "800 GB", "365 days"],
  [577, "MTN", "GIFTING", 123000, "800 GB", "365 days"],
  [578, "MTN", "DATA COUPONS", 123000, "800 GB", "365 days"],

  [579, "MTN", "DATA COUPONS", 1600, "5 GB", "21-30 days"],
  [580, "MTN", "GIFTING", 800, "2 GB", "21-30 days"],
  [581, "MTN", "DATA COUPONS", 800, "2 GB", "14-21 days"],
  [582, "MTN", "DATA COUPONS", 1100, "3 GB", "21-30 days"],

  [583, "MTN", "SME", 395, "1 GB", "7 days"],
  [584, "MTN", "CORPORATE GIFTING", 420, "1 GB", "7 days"],
  [585, "MTN", "DATA SHARE", 395, "1 GB", "7 days"],
  [586, "MTN", "GIFTING", 395, "1 GB", "7 days"],
  [587, "MTN", "SME2", 395, "1 GB", "7 days"],
  [588, "MTN", "DATA COUPONS", 395, "1 GB", "7 days"],

  [589, "MTN", "GIFTING", 270, "500 MB", "7 days"],
  [590, "MTN", "SME2", 270, "500 MB", "7 days"],
  [591, "MTN", "DATA COUPONS", 270, "500 MB", "7 days"],

  [606, "MTN", "GIFTING", 291, "1 GB", "3 days"],
  [607, "MTN", "SME2", 291, "1 GB", "3 days"],

  [608, "MTN", "GIFTING", 390, "2 GB", "7 days"],
  [609, "MTN", "SME2", 390, "2 GB", "7 days"],

  [610, "MTN", "GIFTING", 120, "200 MB", "1 day"],
  [611, "MTN", "SME2", 120, "200 MB", "1 day"],

  [616, "MTN", "SME2", 215, "1 GB", "1 day"],

  [622, "MTN", "GIFTING", 441, "750 MB", "3 days"],
  [623, "MTN", "SME2", 441, "750 MB", "3 days"],
  [624, "MTN", "DATA COUPONS", 441, "750 MB", "3 days"],

  [627, "MTN", "GIFTING", 970, "3.5 GB", "1 day"],
  [628, "MTN", "DATA COUPONS", 970, "3.5 GB", "1 day"],
  [629, "MTN", "SME2", 970, "3.5 GB", "1 day"],

  [630, "MTN", "GIFTING", 1164, "4 GB", "2 days"],
  [631, "MTN", "SME2", 1164, "4 GB", "2 days"],
  [632, "MTN", "DATA COUPONS", 1164, "4 GB", "2 days"],

  [633, "MTN", "GIFTING", 1480, "5.5 GB", "2 days"],

  [638, "MTN", "GIFTING", 220, "1 GB", "1 day"],
  [639, "MTN", "DATA COUPONS", 230, "1 GB", "1 day"],

  [640, "MTN", "GIFTING", 9950, "34 GB", "30 days"],
  [641, "MTN", "SME2", 9950, "34 GB", "30 days"],
  [642, "MTN", "DATA COUPONS", 9950, "34 GB", "30 days"],

  [652, "MTN", "SME", 3000, "10 GB", "21-30 days"],
  [653, "MTN", "CORPORATE GIFTING", 3000, "10 GB", "21-30 days"],
  [654, "MTN", "GIFTING", 3000, "10 GB", "21-30 days"],
  [655, "MTN", "DATA SHARE", 3000, "10 GB", "21-30 days"],
  [656, "MTN", "DATA COUPONS", 3000, "10 GB", "21-30 days"],
  [657, "MTN", "SME2", 3000, "10 GB", "21-30 days"],

  [658, "MTN", "SME", 4500, "15 GB", "21-30 days"],
  [659, "MTN", "CORPORATE GIFTING", 4500, "15 GB", "21-30 days"],

  [660, "MTN", "GIFTING", 430, "2 GB", "1 day"],
  [661, "MTN", "SME2", 430, "2 GB", "1 day"],

  [662, "MTN", "SME", 6000, "20 GB", "21-30 days"],

  [663, "MTN", "DATA COUPONS", 430, "2 GB", "1 day"],

  [664, "MTN", "GIFTING", 645, "3 GB", "1 day"],
  [665, "MTN", "SME2", 645, "3 GB", "1 day"],
  [666, "MTN", "DATA COUPONS", 645, "3 GB", "1 day"],

  [667, "MTN", "SME", 1400, "5 GB", "14 days"],

  [668, "MTN", "GIFTING", 250, "1 GB", "30 days"],
  [669, "MTN", "SME2", 250, "1 GB", "30 days"],
  [670, "MTN", "DATA COUPONS", 250, "1 GB", "30 days"],

  // =======================================================
  // ADDITIONAL PLANS FROM THE EXTENDED ALRAHUZ CATALOG
  // =======================================================

  [684, "MTN", "GIFTING", 600, "2.5 GB", "1 day"],
  [685, "MTN", "SME2", 600, "2.5 GB", "1 day"],
  [686, "MTN", "DATA COUPONS", 600, "2.5 GB", "1 day"],

  [687, "MTN", "GIFTING", 150, "500 MB", "1 day"],
  [688, "MTN", "SME2", 150, "500 MB", "1 day"],
  [689, "MTN", "DATA COUPONS", 150, "500 MB", "1 day"],

  [690, "MTN", "GIFTING", 240, "1 GB", "1 day"],
  [691, "MTN", "SME2", 240, "1 GB", "1 day"],
];

/**
 * =========================================================
 * VALIDATE PLANS
 * =========================================================
 */

function validatePlans() {
  const seen = new Set();

  for (const plan of ALRAHUZ_PLANS) {
    const [
      providerPlanId,
      network,
      planType,
      amount,
      dataSize,
      validity,
    ] = plan;

    /**
     * -----------------------------------------------------
     * PROVIDER PLAN ID
     * -----------------------------------------------------
     */

    if (!providerPlanId) {
      throw new Error(
        `Invalid provider plan ID: ${providerPlanId}`
      );
    }

    /**
     * -----------------------------------------------------
     * NETWORK
     * -----------------------------------------------------
     */

    const validNetwork = Object.values(NETWORKS).includes(
      network
    );

    if (!validNetwork) {
      throw new Error(
        `Invalid network: ${network}`
      );
    }

    /**
     * -----------------------------------------------------
     * PLAN TYPE
     * -----------------------------------------------------
     */

    if (!planType) {
      throw new Error(
        `Missing plan type for plan ${providerPlanId}`
      );
    }

    /**
     * -----------------------------------------------------
     * PROVIDER PRICE
     * -----------------------------------------------------
     */

    if (
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0
    ) {
      throw new Error(
        `Invalid amount for plan ${providerPlanId}: ${amount}`
      );
    }

    /**
     * -----------------------------------------------------
     * DATA SIZE
     * -----------------------------------------------------
     */

    if (!dataSize) {
      throw new Error(
        `Missing data size for plan ${providerPlanId}`
      );
    }

    /**
     * -----------------------------------------------------
     * VALIDITY
     * -----------------------------------------------------
     */

    if (!validity) {
      throw new Error(
        `Missing validity for plan ${providerPlanId}`
      );
    }

    /**
     * -----------------------------------------------------
     * DUPLICATE PROVIDER PLAN ID
     * -----------------------------------------------------
     */

    if (seen.has(providerPlanId)) {
      throw new Error(
        `Duplicate provider plan ID detected: ${providerPlanId}`
      );
    }

    seen.add(providerPlanId);
  }
}

/**
 * =========================================================
 * SEED DATA PLANS
 * =========================================================
 */

async function seedDataPlans() {
  console.log("");
  console.log(
    "========================================================="
  );
  console.log("EVAULT DATA PLAN SEED");
  console.log(
    "========================================================="
  );
  console.log(`Provider: ${PROVIDER}`);
  console.log(`Plans: ${ALRAHUZ_PLANS.length}`);
  console.log("Mode: ADD / UPDATE ONLY");
  console.log("Existing plans will NOT be deleted.");
  console.log("Profit Margin: 1.5%");
  console.log(
    "========================================================="
  );
  console.log("");

  /**
   * -------------------------------------------------------
   * VALIDATE BEFORE CONNECTING TO DATABASE
   * -------------------------------------------------------
   */

  validatePlans();

  const client = await db.connect();

  let inserted = 0;
  let updated = 0;

  try {
    /**
     * -----------------------------------------------------
     * BEGIN TRANSACTION
     * -----------------------------------------------------
     */

    await client.query("BEGIN");

    /**
     * -----------------------------------------------------
     * PROCESS EVERY PLAN
     * -----------------------------------------------------
     */

    for (const [
      providerPlanId,
      network,
      planType,
      providerPrice,
      dataSize,
      validity,
    ] of ALRAHUZ_PLANS) {
      /**
       * ---------------------------------------------------
       * CALCULATE CUSTOMER SELLING PRICE
       * ---------------------------------------------------
       *
       * Provider price:
       *
       *     ₦100
       *
       * 1.5% profit:
       *
       *     ₦1.50
       *
       * Customer price:
       *
       *     ₦101.50
       *
       * ---------------------------------------------------
       */

      const sellingPrice =
        calculateSellingPrice(providerPrice);

      /**
       * ---------------------------------------------------
       * CHECK WHETHER PLAN ALREADY EXISTS
       * ---------------------------------------------------
       */

      const existingResult = await client.query(
        `
        SELECT id
        FROM data_plans
        WHERE provider_plan_id = $1
          AND provider = $2
        LIMIT 1
        `,
        [
          providerPlanId,
          PROVIDER,
        ]
      );

      /**
       * ---------------------------------------------------
       * UPSERT
       * ---------------------------------------------------
       */

      await client.query(
        `
        INSERT INTO data_plans (
          provider_plan_id,
          network,
          plan_type,
          amount,
          data_size,
          validity,
          provider,
          is_active,
          metadata,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          TRUE,
          $8,
          NOW()
        )

        ON CONFLICT (provider_plan_id)
        DO UPDATE SET
          network = EXCLUDED.network,
          plan_type = EXCLUDED.plan_type,
          amount = EXCLUDED.amount,
          data_size = EXCLUDED.data_size,
          validity = EXCLUDED.validity,
          provider = EXCLUDED.provider,
          is_active = TRUE,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        `,
        [
          providerPlanId,
          network,
          planType,

          /**
           * IMPORTANT:
           *
           * Store the Evault selling price, not the
           * original Alrahuz provider price.
           */
          sellingPrice,

          dataSize,
          validity,
          PROVIDER,

          /**
           * -------------------------------------------------
           * METADATA
           * -------------------------------------------------
           *
           * Retain the original provider price and the
           * calculated Evault selling price.
           *
           * -------------------------------------------------
           */

          JSON.stringify({
            source: "ALRAHUZ",

            providerPlanId,

            network,

            planType,

            catalog: "ALRAHUZ_DATA_CATALOG",

            providerPrice: Number(providerPrice),

            sellingPrice,

            profitMargin: PROFIT_MARGIN,

            profitMarginPercent: 1.5,
          }),
        ]
      );

      /**
       * ---------------------------------------------------
       * LOG RESULT
       * ---------------------------------------------------
       */

      if (existingResult.rows.length > 0) {
        updated++;

        console.log(
          `↻ UPDATED | ${providerPlanId} | ${network} | ${planType} | ${dataSize} | Provider: ₦${Number(
            providerPrice
          ).toFixed(2)} | Selling: ₦${sellingPrice.toFixed(2)}`
        );
      } else {
        inserted++;

        console.log(
          `✓ INSERTED | ${providerPlanId} | ${network} | ${planType} | ${dataSize} | Provider: ₦${Number(
            providerPrice
          ).toFixed(2)} | Selling: ₦${sellingPrice.toFixed(2)}`
        );
      }
    }

    /**
     * -----------------------------------------------------
     * COMMIT
     * -----------------------------------------------------
     */

    await client.query("COMMIT");

    /**
     * -----------------------------------------------------
     * SUCCESS SUMMARY
     * -----------------------------------------------------
     */

    console.log("");
    console.log(
      "========================================================="
    );
    console.log("DATA PLAN SEED COMPLETED");
    console.log(
      "========================================================="
    );
    console.log(`Profit Margin: 1.5%`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated:  ${updated}`);
    console.log(`Total:    ${inserted + updated}`);
    console.log(
      "========================================================="
    );
    console.log("");
  } catch (error) {
    /**
     * -----------------------------------------------------
     * ROLLBACK
     * -----------------------------------------------------
     */

    await client.query("ROLLBACK");

    console.error("");
    console.error(
      "========================================================="
    );
    console.error("DATA PLAN SEED FAILED");
    console.error(
      "========================================================="
    );
    console.error(error);
    console.error(
      "========================================================="
    );
    console.error("");

    process.exitCode = 1;
  } finally {
    /**
     * -----------------------------------------------------
     * RELEASE DATABASE CONNECTION
     * -----------------------------------------------------
     */

    client.release();
  }
}

/**
 * =========================================================
 * RUN SEED
 * =========================================================
 */

seedDataPlans();
 
