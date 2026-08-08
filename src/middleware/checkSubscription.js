import { getSubscriptionStatus } from "../services/subscriptionService.js";

// Paths a company must still be able to reach even with a lapsed
// subscription — checking status and paying for renewal, mainly.
const ALLOWLIST_PREFIXES = ["/api/subscription", "/api/auth",  "/api/plans"];

export default async function checkSubscription(req, res, next) {
  if (ALLOWLIST_PREFIXES.some((p) => req.originalUrl.startsWith(p))) {
    return next();
  }

  // Platform admins aren't scoped to a paying company in the first place.
  if (req.user?.isPlatformAdmin) {
    return next();
  }

  try {
    const { active, reason } = await getSubscriptionStatus(req.context.companyId);

    if (!active) {
      return res.status(402).json({
        message:
          reason === "EXPIRED"
            ? "Your subscription has expired. Please renew to continue."
            : "No active subscription for this company.",
        reason,
      });
    }

    next();
  } catch (err) {
    console.error("Subscription check error:", err);
    // Fail closed — if we can't verify status, don't silently let it through.
    res.status(500).json({ message: "Could not verify subscription status" });
  }
}