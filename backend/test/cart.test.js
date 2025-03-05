import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import jwt from "jsonwebtoken";
import app from "../server.js";
import User from "../models/user.model.js";
import Product from "../models/product.model.js";
import { redis } from "../lib/redis.js"; // 确保在测试完成后关闭 Redis

let mongoServer;
let testUser;
let testProduct;
let accessToken;

beforeAll(async () => {
  jest.setTimeout(20000); // 增加超时时间
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // 创建测试商品
  testProduct = await Product.create({
    name: "Test Product",
    description: "A test product",
    price: 100,
    image: "test.jpg",
    category: "Electronics",
  });

  // 创建测试用户
  testUser = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "hashedpassword",
    cartItems: [{ product: testProduct._id, quantity: 2 }],
    role: "customer",
  });

  // 生成 JWT 令牌
  accessToken = jwt.sign(
    { userId: testUser._id },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: "1h",
    }
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
  await redis.quit(); // 关闭 Redis 连接
});

describe("GET /api/cart", () => {
  it("should return 401 if no access token is provided", async () => {
    const res = await request(app).get("/api/cart");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty(
      "message",
      "Unauthorized - No access token provided"
    );
  });

  it("should return 401 if an invalid access token is provided", async () => {
    const fakeToken = jwt.sign({ userId: "fakeUserId" }, "wrong_secret", {
      expiresIn: "1h",
    });

    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", `accessToken=${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty(
      "message",
      "Unauthorized - Invalid access token"
    );
  });

  it("should return an empty cart if the user has no items", async () => {
    const emptyUser = await User.create({
      name: "Empty Cart User",
      email: "empty@example.com",
      password: "hashedpassword",
      cartItems: [],
    });

    const emptyToken = jwt.sign(
      { userId: emptyUser._id },
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: "1h",
      }
    );

    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", `accessToken=${emptyToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("should return correct cart products with quantities", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Cookie", `accessToken=${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty("name", "Test Product");
    expect(res.body[0]).toHaveProperty("quantity", 2);
  });
});
