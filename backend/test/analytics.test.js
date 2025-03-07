import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import {
  getAnalyticsData,
  getDailySalesData,
} from "../controllers/analytics.controller.js";

describe("Analytics API Tests", () => {
  let mongoServer;
  let testUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany();
    await Product.deleteMany();
    await Order.deleteMany();

    testUser = await User.create({
      name: "Test User",
      email: "test@example.com",
      password: "Test@1234",
    });
  });

  test("should return correct analytics data when users, products, and orders exist", async () => {
    await Product.insertMany([
      {
        name: "Product 1",
        description: "Sample product",
        price: 10,
        image: "https://example.com/product1.jpg",
        category: "Electronics",
      },
      {
        name: "Product 2",
        description: "Another sample product",
        price: 20,
        image: "https://example.com/product2.jpg",
        category: "Clothing",
      },
    ]);

    await Order.insertMany([
      {
        user: testUser._id,
        totalAmount: 100,
        isPaid: true,
        createdAt: new Date("2024-08-18"),
        stripeSessionId: "session_abc123",
      },
      {
        user: testUser._id,
        totalAmount: 200,
        isPaid: true,
        createdAt: new Date("2024-08-19"),
        stripeSessionId: "session_xyz456",
      },
    ]);

    const result = await getAnalyticsData();

    expect(result).toEqual({
      users: 1,
      products: 2,
      totalSales: 2,
      totalRevenue: 300,
    });
  });

  test("should return zeros when database is empty", async () => {
    await User.deleteMany();
    await Product.deleteMany();
    await Order.deleteMany();

    const result = await getAnalyticsData();

    expect(result).toEqual({
      users: 0,
      products: 0,
      totalSales: 0,
      totalRevenue: 0,
    });
  });

  test("should return correct daily sales data with missing dates filled", async () => {
    await Order.insertMany([
      {
        user: testUser._id,
        totalAmount: 100,
        isPaid: true,
        createdAt: new Date("2024-08-18"),
        stripeSessionId: "session_abc123",
      },
      {
        user: testUser._id,
        totalAmount: 200,
        isPaid: true,
        createdAt: new Date("2024-08-20"),
        stripeSessionId: "session_xyz456",
      },
    ]);

    const startDate = new Date("2024-08-18");
    const endDate = new Date("2024-08-22");

    const result = await getDailySalesData(startDate, endDate);

    expect(result).toEqual([
      { date: "2024-08-18", sales: 1, revenue: 100 },
      { date: "2024-08-19", sales: 0, revenue: 0 },
      { date: "2024-08-20", sales: 1, revenue: 200 },
      { date: "2024-08-21", sales: 0, revenue: 0 },
      { date: "2024-08-22", sales: 0, revenue: 0 },
    ]);
  });

  test("should return all zero sales data when no orders exist", async () => {
    await Order.deleteMany();

    const startDate = new Date("2024-08-18");
    const endDate = new Date("2024-08-22");

    const result = await getDailySalesData(startDate, endDate);

    expect(result).toEqual([
      { date: "2024-08-18", sales: 0, revenue: 0 },
      { date: "2024-08-19", sales: 0, revenue: 0 },
      { date: "2024-08-20", sales: 0, revenue: 0 },
      { date: "2024-08-21", sales: 0, revenue: 0 },
      { date: "2024-08-22", sales: 0, revenue: 0 },
    ]);
  });
});
