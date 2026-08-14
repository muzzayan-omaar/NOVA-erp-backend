import prisma from "../lib/prisma.js";

export const assertStoreCapacity = async (companyId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: { package: true },
  });

  const maxStores = subscription?.package?.maxStores ?? 1;
  const currentCount = await prisma.store.count({ where: { companyId } });

  if (currentCount >= maxStores) {
    return {
      ok: false,
      message: `Your plan allows up to ${maxStores} store(s). Contact Nova support to upgrade.`,
    };
  }

  return { ok: true };
};

export const assertUserCapacity = async (companyId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { companyId },
    include: { package: true },
  });

  const maxUsers = subscription?.package?.maxUsers ?? 3;
  const currentCount = await prisma.user.count({ where: { companyId } });

  if (currentCount >= maxUsers) {
    return {
      ok: false,
      message: `Your plan allows up to ${maxUsers} user(s). Contact Nova support to upgrade.`,
    };
  }

  return { ok: true };
};
