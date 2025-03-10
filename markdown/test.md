## analytics controller backup

```js
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
  const totalUsers = await User.countDocuments();
  const totalProducts = await Product.countDocuments();

  //  The _id expression specifies the group key.
  // If you specify an _id value of null, or any other constant value,
  // the $group stage returns a single document that aggregates values across all of the input documents
  const salesData = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: "$totalAmount" },
      },
    },
  ]);

  const { totalSales, totalRevenue } = salesData[0] || {
    totalSales: 0,
    totalRevenue: 0,
  };

  return {
    users: totalUsers,
    products: totalProducts,
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
    const dailySalesData = await Order.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
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

    // example of dailySalesData
    // [
    // 	{
    // 		_id: "2024-08-18",
    // 		sales: 12,
    // 		revenue: 1450.75
    // 	},
    // ]

    const dateArray = getDatesInRange(startDate, endDate);
    // console.log(dateArray) // ['2024-08-18', '2024-08-19', ... ]

    return dateArray.map((date) => {
      const foundData = dailySalesData.find((item) => item._id === date);

      return {
        date,
        sales: foundData?.sales || 0,
        revenue: foundData?.revenue || 0,
      };
    });
  } catch (error) {
    throw error;
  }
};

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
```
