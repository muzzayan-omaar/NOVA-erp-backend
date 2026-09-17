import prisma from "../lib/prisma.js";

// Every number here comes from real PurchaseOrder history. Nothing is
// estimated — a metric that has no real data behind it returns null and
// is labeled as such on the frontend, rather than being guessed.
export const calculateSupplierReliability = async (companyId, supplierId) => {
  const orders = await prisma.purchaseOrder.findMany({
    where: { companyId, supplierId, status: "RECEIVED" },
    include: { items: true },
    orderBy: { receivedAt: "desc" },
  });

  if (orders.length === 0) {
    return {
      orderCount: 0,
      fulfillmentRate: null,
      avgLeadTimeDays: null,
      onTimeRate: null,
      onTimeSampleSize: 0,
      reliabilityScore: null,
      scoreBasis: "No received orders yet",
      recentOrders: [],
    };
  }

  let totalOrdered = 0;
  let totalReceived = 0;
  let leadTimeSum = 0;
  let leadTimeCount = 0;
  let onTimeCount = 0;
  let onTimeSampleSize = 0;

  const recentOrders = [];

  orders.forEach((o) => {
    let orderedQty = 0;
    let receivedQty = 0;
    o.items.forEach((item) => {
      orderedQty += item.quantityOrdered;
      receivedQty += item.quantityReceived || 0;
    });
    totalOrdered += orderedQty;
    totalReceived += receivedQty;

    let leadDays = null;
    if (o.sentAt && o.receivedAt) {
      leadDays = (new Date(o.receivedAt) - new Date(o.sentAt)) / (1000 * 60 * 60 * 24);
      leadTimeSum += leadDays;
      leadTimeCount++;
    }

    let onTime = null;
    if (o.expectedDeliveryDate && o.receivedAt) {
      onTime = new Date(o.receivedAt) <= new Date(o.expectedDeliveryDate);
      onTimeSampleSize++;
      if (onTime) onTimeCount++;
    }

    recentOrders.push({
      id: o.id,
      receivedAt: o.receivedAt,
      expectedDeliveryDate: o.expectedDeliveryDate,
      orderedQty,
      receivedQty,
      fulfilled: orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : null,
      leadDays: leadDays !== null ? Math.round(leadDays * 10) / 10 : null,
      onTime,
    });
  });

  const fulfillmentRate = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : null;
  const avgLeadTimeDays = leadTimeCount > 0 ? leadTimeSum / leadTimeCount : null;
  const onTimeRate = onTimeSampleSize > 0 ? (onTimeCount / onTimeSampleSize) * 100 : null;

  let reliabilityScore = null;
  let scoreBasis = null;
  if (fulfillmentRate !== null && onTimeRate !== null) {
    reliabilityScore = Math.round(fulfillmentRate * 0.6 + onTimeRate * 0.4);
    scoreBasis = "60% fulfillment rate + 40% on-time rate";
  } else if (fulfillmentRate !== null) {
    reliabilityScore = Math.round(fulfillmentRate);
    scoreBasis = "Fulfillment rate only — no on-time data yet for this supplier";
  }

  return {
    orderCount: orders.length,
    fulfillmentRate: fulfillmentRate !== null ? Math.round(fulfillmentRate * 10) / 10 : null,
    avgLeadTimeDays: avgLeadTimeDays !== null ? Math.round(avgLeadTimeDays * 10) / 10 : null,
    onTimeRate: onTimeRate !== null ? Math.round(onTimeRate * 10) / 10 : null,
    onTimeSampleSize,
    reliabilityScore,
    scoreBasis,
    recentOrders: recentOrders.slice(0, 10),
  };
};