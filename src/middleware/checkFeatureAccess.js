import prisma from "../lib/prisma.js";

// Always available, never gated behind a bundle — a company must always be
// able to sell, view its own dashboard, and reach billing/support, or it
// could get locked out of the very things that would let it fix that.
const BASELINE_FEATURES = [
  "dashboard",
  "pos",
  "products",
  "inventory",
  "sales",
  "customers",
  "billing",
  "support",
];

const checkFeatureAccess = (featureKey) => async (req, res, next) => {
  if (BASELINE_FEATURES.includes(featureKey)) {
    return next();
  }

  try {
    const { companyId } = req.context;

    const subscription = await prisma.subscription.findUnique({
      where: { companyId },
      include: { package: { include: { bundles: { include: { bundle: true } } } } },
    });

    const companyBundles = await prisma.companyBundle.findMany({
      where: { companyId },
      include: { bundle: true },
    });

    const packageKeys = subscription?.package?.bundles.flatMap((pb) => pb.bundle.featureKeys) || [];
    const extraKeys = companyBundles.flatMap((cb) => cb.bundle.featureKeys);

    const allKeys = new Set([...packageKeys, ...extraKeys]);

    if (!allKeys.has(featureKey)) {
      return res.status(402).json({
        message: `"${featureKey}" isn't included in your current plan. Contact Nova support to add it.`,
        reason: "FEATURE_NOT_INCLUDED",
        featureKey,
      });
    }

    next();
  } catch (err) {
    console.error("Feature access check error:", err);
    res.status(500).json({ message: "Failed to verify feature access" });
  }
};

export default checkFeatureAccess;
