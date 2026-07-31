// =========================================
// ANALYTICS HELPER FUNCTIONS
// =========================================

/**
 * Returns today's date starting at 00:00:00
 */
export const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Returns date X days ago
 */
export const getDaysAgo = (days) => {
  return new Date(
    Date.now() - Number(days) * 24 * 60 * 60 * 1000
  );
};

/**
 * Safely converts any value to a number
 */
export const toNumber = (value) => {
  return Number(value || 0);
};

/**
 * Formats ISO date as YYYY-MM-DD
 */
export const formatDate = (date) => {
  return new Date(date).toISOString().split("T")[0];
};

/**
 * Sum helper
 */
export const sumBy = (array, callback) => {
  return array.reduce((sum, item) => {
    return sum + callback(item);
  }, 0);
};

/**
 * Groups array items by key
 */
export const groupBy = (array, callback) => {
  return array.reduce((groups, item) => {
    const key = callback(item);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(item);

    return groups;
  }, {});
};

/**
 * Sort descending
 */
export const sortDesc = (array, field) => {
  return [...array].sort(
    (a, b) => b[field] - a[field]
  );
};

/**
 * Calculate gross profit
 */
export const calculateProfit = (saleItems) => {
  let profit = 0;

  saleItems.forEach((item) => {
    profit +=
      (toNumber(item.unitPrice) -
        toNumber(item.product.buyingPrice)) *
      toNumber(item.quantity);
  });

  return profit;
};

/**
 * Percentage growth
 */
export const calculateGrowth = (
  current,
  previous
) => {
  current = toNumber(current);
  previous = toNumber(previous);

  if (previous === 0) return 100;

  return ((current - previous) / previous) * 100;
};

/**
 * Average helper
 */
export const average = (numbers = []) => {
  if (numbers.length === 0) return 0;

  return (
    numbers.reduce((a, b) => a + b, 0) /
    numbers.length
  );
};