import prisma from "../lib/prisma.js";

import { dashboardAnalytics } from "./analytics/dashboardAnalytics.js";

import { salesAnalytics } from "./analytics/salesAnalytics.js";

import { inventoryAnalytics } from "./analytics/inventoryAnalytics.js";

import { branchAnalytics } from "./analytics/branchAnalytics.js";

import { financeAnalytics } from "./analytics/financeAnalytics.js";

import { generateLowStockNotifications } from "../modules/notifications/notification.generator.js";

// =======================================
// RESOLVE STORE CONTEXT
// =======================================

const resolveAnalyticsStore = (req) => {
  const requestedStore = req.query.storeId;

  // Owners can view all branches
  // or select a branch

  if (req.user.role === "OWNER") {
    return requestedStore || "ALL";
  }

  // Managers/cashiers use active selected branch

  return req.user.activeStoreId || req.user.storeId;
};

// =======================================
// DASHBOARD ANALYTICS
// =======================================

export const getDashboardAnalytics = async (req, res) => {
  try {
    const companyId = req.user.companyId;

    const storeId = resolveAnalyticsStore(req);

    try {
      await generateLowStockNotifications(companyId);
    } catch (notificationError) {
      console.error("Notification generation failed:", notificationError);
    }

    const analytics = await dashboardAnalytics(companyId, storeId);

    res.json(analytics);
  } catch (error) {
    console.error("Dashboard error:", error);

    res.status(500).json({
      message: "Failed to load analytics",

      error: error.message,
    });
  }
};

// =======================================
// ADVANCED ANALYTICS
// =======================================

export const getAdvancedAnalytics = async (req, res) => {
  try {
    const { period = "30" } = req.query;

    const storeId = resolveAnalyticsStore(req);

    const companyId = req.user.companyId;

    const sales = await salesAnalytics(companyId, storeId, period);

    const inventory = await inventoryAnalytics(companyId, storeId, period);

    const branches = await branchAnalytics(companyId, storeId, period);

    const finance = await financeAnalytics(companyId, storeId, period);

    res.json({
      ...sales,

      inventoryAnalytics: inventory,

      ...branches,

      finance,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load advanced analytics",
    });
  }
};

// =======================================
// TAX REPORT
// =======================================

export const getTaxReport = async (req, res) => {
  try {
    const {
      from,

      to,

      storeId = "ALL",
    } = req.query;

    const report = await financeAnalytics(
      req.user.companyId,

      storeId,

      0,

      from,

      to
    );

    res.json(report);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to generate tax report",
    });
  }
};
