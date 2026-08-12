import prisma from "../lib/prisma.js";
import createPlatformAuditLog from "../services/platformAuditService.js";

/* ---------- Tenant-facing (read-only) ---------- */

// GET /api/catalog — everything active, for the future onboarding wizard
// and for the tenant's own billing/renewal screens.
export const getCatalog = async (req, res) => {
  try {
    const [bundles, packages, billingCycles] = await Promise.all([
      prisma.bundle.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.package.findMany({
        where: { isActive: true },
        include: { bundles: { include: { bundle: true } } },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.billingCycle.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    ]);

    const shapedPackages = packages.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      price: p.price,
      maxStores: p.maxStores,
      maxUsers: p.maxUsers,
      includedBundles: p.bundles.map((pb) => pb.bundle),
    }));

    res.json({ bundles, packages: shapedPackages, billingCycles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch catalog" });
  }
};

// GET /api/my-entitlements — this company's current package + extra bundles.
// Foundation for Mini-Phase 2's enforcement, useful for the billing page too.
export const getMyEntitlements = async (req, res) => {
  try {
    const { companyId } = req.context;

    const [subscription, companyBundles] = await Promise.all([
      prisma.subscription.findUnique({
        where: { companyId },
        include: { package: { include: { bundles: { include: { bundle: true } } } } },
      }),
      prisma.companyBundle.findMany({ where: { companyId }, include: { bundle: true } }),
    ]);

    const packageBundleKeys = subscription?.package?.bundles.flatMap((pb) => pb.bundle.featureKeys) || [];
    const extraBundleKeys = companyBundles.flatMap((cb) => cb.bundle.featureKeys);

    const BASELINE_FEATURES = [
  "dashboard", "pos", "products", "inventory", "sales", "customers",
  "billing", "support",
];

res.json({
  package: subscription?.package || null,
  maxStores: subscription?.package?.maxStores ?? 1,
  maxUsers: subscription?.package?.maxUsers ?? 3,
  extraBundles: companyBundles.map((cb) => cb.bundle),
  featureKeys: [...new Set([...BASELINE_FEATURES, ...packageBundleKeys, ...extraBundleKeys])],
});
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch entitlements" });
  }
};

/* ---------- Platform-facing (full CRUD) ---------- */

export const getAllBundles = async (req, res) => {
  try {
    const bundles = await prisma.bundle.findMany({ orderBy: { sortOrder: "asc" } });
    res.json(bundles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch bundles" });
  }
};

export const createBundle = async (req, res) => {
  try {
    const { code, name, description, featureKeys, price, sortOrder } = req.body;

    if (!code || !name || !Array.isArray(featureKeys) || price == null) {
      return res.status(400).json({ message: "code, name, featureKeys, and price are required" });
    }

    const bundle = await prisma.bundle.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        featureKeys,
        price: Number(price),
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      },
    });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "BUNDLE_CREATED",
      entityType: "bundle",
      entityId: bundle.id,
      metadata: { code: bundle.code, price: bundle.price },
    });

    res.status(201).json(bundle);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "A bundle with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create bundle" });
  }
};

export const updateBundle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, featureKeys, price, sortOrder } = req.body;

    const bundle = await prisma.bundle.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(featureKeys !== undefined && { featureKeys }),
        ...(price !== undefined && { price: Number(price) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "BUNDLE_UPDATED",
      entityType: "bundle",
      entityId: bundle.id,
      metadata: { code: bundle.code },
    });

    res.json(bundle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update bundle" });
  }
};

export const setBundleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const bundle = await prisma.bundle.update({ where: { id }, data: { isActive: Boolean(isActive) } });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: bundle.isActive ? "BUNDLE_REACTIVATED" : "BUNDLE_RETIRED",
      entityType: "bundle",
      entityId: bundle.id,
      metadata: { code: bundle.code },
    });

    res.json(bundle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update bundle status" });
  }
};

export const getAllPackages = async (req, res) => {
  try {
    const packages = await prisma.package.findMany({
      include: { bundles: { include: { bundle: true } } },
      orderBy: { sortOrder: "asc" },
    });
    res.json(packages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch packages" });
  }
};

export const createPackage = async (req, res) => {
  try {
    const { code, name, description, price, maxStores, maxUsers, bundleIds, sortOrder } = req.body;

    if (!code || !name || price == null) {
      return res.status(400).json({ message: "code, name, and price are required" });
    }

    const pkg = await prisma.package.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        price: Number(price),
        maxStores: maxStores ? Number(maxStores) : 1,
        maxUsers: maxUsers ? Number(maxUsers) : 3,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
        bundles: {
          create: (bundleIds || []).map((bundleId) => ({ bundleId })),
        },
      },
      include: { bundles: { include: { bundle: true } } },
    });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "PACKAGE_CREATED",
      entityType: "package",
      entityId: pkg.id,
      metadata: { code: pkg.code, price: pkg.price },
    });

    res.status(201).json(pkg);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "A package with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create package" });
  }
};

export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, maxStores, maxUsers, sortOrder, bundleIds } = req.body;

    if (bundleIds !== undefined) {
      await prisma.packageBundle.deleteMany({ where: { packageId: id } });
      if (bundleIds.length > 0) {
        await prisma.packageBundle.createMany({
          data: bundleIds.map((bundleId) => ({ packageId: id, bundleId })),
        });
      }
    }

    const pkg = await prisma.package.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(maxStores !== undefined && { maxStores: Number(maxStores) }),
        ...(maxUsers !== undefined && { maxUsers: Number(maxUsers) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
      include: { bundles: { include: { bundle: true } } },
    });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: "PACKAGE_UPDATED",
      entityType: "package",
      entityId: pkg.id,
      metadata: { code: pkg.code },
    });

    res.json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update package" });
  }
};

export const setPackageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const pkg = await prisma.package.update({ where: { id }, data: { isActive: Boolean(isActive) } });

    await createPlatformAuditLog({
      platformAdminId: req.platformAdmin.id,
      action: pkg.isActive ? "PACKAGE_REACTIVATED" : "PACKAGE_RETIRED",
      entityType: "package",
      entityId: pkg.id,
      metadata: { code: pkg.code },
    });

    res.json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update package status" });
  }
};

export const getAllBillingCycles = async (req, res) => {
  try {
    const cycles = await prisma.billingCycle.findMany({ orderBy: { sortOrder: "asc" } });
    res.json(cycles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch billing cycles" });
  }
};

export const createBillingCycle = async (req, res) => {
  try {
    const { code, name, payMonths, bonusMonths, sortOrder } = req.body;

    if (!code || !name || !payMonths) {
      return res.status(400).json({ message: "code, name, and payMonths are required" });
    }

    const cycle = await prisma.billingCycle.create({
      data: {
        code: code.toUpperCase(),
        name,
        payMonths: Number(payMonths),
        bonusMonths: bonusMonths ? Number(bonusMonths) : 0,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      },
    });

    res.status(201).json(cycle);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "A billing cycle with that code already exists" });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create billing cycle" });
  }
};

export const updateBillingCycle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, payMonths, bonusMonths, sortOrder } = req.body;

    const cycle = await prisma.billingCycle.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(payMonths !== undefined && { payMonths: Number(payMonths) }),
        ...(bonusMonths !== undefined && { bonusMonths: Number(bonusMonths) }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });

    res.json(cycle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update billing cycle" });
  }
};

export const setBillingCycleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const cycle = await prisma.billingCycle.update({ where: { id }, data: { isActive: Boolean(isActive) } });
    res.json(cycle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update billing cycle status" });
  }
};