import prisma from "../lib/prisma.js";

const TRIAL_DAYS = 14;

export const createTrialSubscription = async (companyId) => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + TRIAL_DAYS);

  return await prisma.subscription.create({
    data: {
      companyId,
      plan: "TRIAL",
      status: "TRIALING",
      endDate,
    },
  });
};

export const getSubscriptionStatus = async (companyId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: { package: true },
  });

  if (!subscription) {
    return { active: false, subscription: null, reason: "NO_SUBSCRIPTION" };
  }

  const now = new Date();

  if (subscription.status === "CANCELLED") {
    return { active: false, subscription, reason: "CANCELLED" };
  }

  if (subscription.endDate < now) {
    if (subscription.status !== "EXPIRED") {
      await prisma.subscription.update({
        where: { companyId },
        data: { status: "EXPIRED" },
      });
      subscription.status = "EXPIRED";
    }
    return { active: false, subscription, reason: "EXPIRED" };
  }

  return { active: true, subscription, reason: null };
};
