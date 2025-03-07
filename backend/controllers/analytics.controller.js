import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import User from "../models/user.model.js";

// https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/

/**
 * Returns an object containing the total number of users, products, total sales and total revenue.
 * All these values are aggregated from the respective models.
 *
 * @returns {Promise<{ users: number, products: number, totalSales: number, totalRevenue: number }>}
 *
 * @example
 * const analyticsData = await getAnalyticsData();
 * console.log(analyticsData);
 * // {
 * // 	users: 123,
 * // 	products: 456,
 * // 	totalSales: 789,
 * // 	totalRevenue: 101112.13
 * // }
 */
export const getAnalyticsData = async () => {
  const [users, products, salesData] = await Promise.all([
    User.countDocuments(),
    Product.countDocuments(),
    fetchSalesData(),
  ]);
  const { totalSales, totalRevenue } = salesData[0] || {
    totalSales: 0,
    totalRevenue: 0,
  };

  return {
    users,
    products,
    totalSales,
    totalRevenue,
  };
};

/**
 * Returns an array of objects, each containing daily sales and revenue data between the given dates.
 * The response will contain an entry for each date in the given range, even if there were no sales
 * on that date. The sales and revenue properties will be set to 0 for those days.
 * The response will be sorted by date.
 *
 * @param {Date} startDate - The start of the date range.
 * @param {Date} endDate - The end of the date range.
 *
 * @returns {Promise<[{ date: string, sales: number, revenue: number }]>}
 *
 * @throws Error
 *
 * @example
 * const startDate = new Date('2024-08-18');
 * const endDate = new Date('2024-08-25');
 * const dailySalesData = await getDailySalesData(startDate, endDate);
 * console.log(dailySalesData);
 * // [
 * // 	{
 * // 		date: '2024-08-18',
 * // 		sales: 12,
 * // 		revenue: 1450.75
 * // 	},
 * // 	{
 * // 		date: '2024-08-19',
 * // 		sales: 0,
 * // 		revenue: 0
 * // 	},
 * // 	...
 * // ]
 */
export const getDailySalesData = async (startDate, endDate) => {
  try {
    const dailySalesData = await fetchDailySales(startDate, endDate);
    const dateArray = getDatesInRange(startDate, endDate);
    return fillMissingSalesRecords(dateArray, dailySalesData);
  } catch (error) {
    throw error;
  }
};

const fetchSalesData = () =>
  Order.aggregate([
    {
      $group: {
        _id: null, // returns a single document that aggregates values across all of the input documents
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);

// example of dailySalesData
// [
// 	{
// 		_id: "2024-08-18",
// 		sales: 12,
// 		revenue: 1450.75
// 	},
// ]
const fetchDailySales = (start, end) =>
  Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        sales: { $sum: 1 },
        revenue: { $sum: "$totalAmount" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

// Helper function to generate an array of dates between two dates.
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // startDate for example: 2025-03-05T02:00:39.423+00:00
    dates.push(currentDate.toISOString().split("T")[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
}

/**
 * Populate date range with default values (zero sales and revenue) for missing dates.
 * @param {Array<{ _id: string, sales: number, revenue: number }>} data
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {DailySalesData[]}
 */
const fillMissingSalesRecords = (dateArray, salesData) => {
  // Build a lookup table keyed by the date string (the _id from your aggregation).
  const salesLookup = salesData.reduce((acc, record) => {
    acc[record._id] = record;
    return acc;
  }, {});

  // Now simply reference the lookup object for each date in O(1) time.
  return dateArray.map((date) => ({
    date,
    sales: salesLookup[date]?.sales || 0,
    revenue: salesLookup[date]?.revenue || 0,
  }));
};
