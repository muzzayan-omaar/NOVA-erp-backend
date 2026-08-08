import prisma from "../lib/prisma.js";

// GET /api/plans — tenant-facing, active plans only (used by the renewal screens)
export const getActivePlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
};

// GET /api/platform/plans — platform-facing, everything including inactive
export const getAllPlans = async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({ orderBy: { sortOrder: "asc" } });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
};

// POST /api/platform/plans
export const createPlan = async (req, res) => {
  try {
    const { code, name, price, durationDays, sortOrder } = req.body;

    if (!code || !name || price == null) {
      return res.status(400).json({ message: "code, name, and price are required" });
    }

    const plan = await prisma.plan.create({
      data: {
        code: code.toUpperCase(),
        name,
        price: Number(price),
        durationDays: durationDays ? Number(durationDays) : 30,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      },
    });

    res.status(201).json(plan);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "A plan with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create plan" });
  }
};

// PATCH /api/platform/plans/:id — code is deliberately NOT editable here,
// since existing subscriptions reference it by value; renaming it would
// orphan them. Retire a plan instead of renaming its code.
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, durationDays, sortOrder } = req.body;

    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(price !== undefined && { price: Number(price) }),
        ...(durationDays !== undefined && { durationDays: Number(durationDays) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });

    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update plan" });
  }
};

// PATCH /api/platform/plans/:id/status
export const setPlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const plan = await prisma.plan.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
    });

    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update plan status" });
  }
};