# **🛠 购物车 API 单元测试 (`cart.test.js`)**

## **📌 为什么要做 `cart.test.js`？**

在学习 Udemy 课程时，我发现课程作者在后端购物车 API 代码中存在 **数据存储格式不一致的问题**，但由于 MongoDB 和前端 `useCartStore` 代码的兼容性，这个错误 **没有导致 API 崩溃**。具体问题如下：

### **⚠️ 原因分析**

1. **错误的数据存储格式**

   - `cartItems` **应存储** `{ product: ObjectId, quantity: number }`。
   - 但原代码错误地存储了 `{ _id: ObjectId, quantity: number }`。
   - MongoDB **仍然允许 `find({ _id: { $in: req.user.cartItems } })` 查询成功**，导致 API 看起来是正确的。

2. **错误的 `find()` 查询**

   ```js
   const products = await Product.find({ _id: { $in: req.user.cartItems } });
   ```

   - `req.user.cartItems` 不是 `_id` 数组，而是 **包含 `product` 字段的对象数组**。

3. **错误的 `cartItem` 匹配**

   ```js
   const cartItems = products.map((product) => {
     const item = req.user.cartItems.find(
       (cartItem) => cartItem.id === product.id
     );
     return { ...product.toJSON(), quantity: item.quantity };
   });
   ```

   - `cartItem.id` **不存在**，应改为 `cartItem.product.toString()`。
   - `product.id` **不存在**，应改为 `product._id.toString()`。

### **🛠 解决方案**

- **后端修正** `addToCart` 和 `getCartProducts `，**确保正确添加 `CartItem` 和正确提取 `product._id`**。

```javascript
export const getCartProducts = async (req, res) => {
  try {
    // 1️⃣ 提取购物车中的 product ID 数组
    const productIds = req.user.cartItems.map((item) => item.product);

    // 2️⃣ 查询所有匹配的产品
    const products = await Product.find({ _id: { $in: productIds } }).lean();

    // 3️⃣ 构建返回的购物车数据，匹配商品和数量
    const cartItems = products.map((product) => {
      const item = req.user.cartItems.find(
        (cartItem) => cartItem.product.toString() === product._id.toString()
      );

      return { ...product, quantity: item.quantity };
    });

    res.json(cartItems);
  } catch (error) {
    console.error("Error in getCartProducts controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const addToCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    // 1️⃣ 查找购物车中是否已存在该商品
    const existingItem = user.cartItems.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      // 2️⃣ 正确存入 `{ product: ObjectId, quantity: number }`
      user.cartItems.push({ product: productId, quantity: 1 });
    }

    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    console.error("Error in addToCart controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
```

- **前端修正** `useCartStore`，**确保 `cart.find(item => item.product._id === product._id)`**。

---

## **📌 如何运行测试？**

确保你已经安装 Jest 相关依赖：

```sh
npm install --save-dev jest supertest mongodb-memory-server
```

然后运行：

```sh
npm test
```

如果 Jest 缓存有问题，先清理再测试：

```sh
jest --clearCache && npm test
```

---

## **📌 `cart.test.js` 主要测试内容**

### **1️⃣ 无 token 时，返回 `401 Unauthorized`**

```js
it("should return 401 if no access token is provided", async () => {
  const res = await request(app).get("/api/cart");
  expect(res.status).toBe(401);
  expect(res.body).toHaveProperty(
    "message",
    "Unauthorized - No access token provided"
  );
});
```

### **2️⃣ 提供无效 token 时，返回 `401 Unauthorized`**

```js
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
```

### **3️⃣ 购物车为空时，返回 `[]`**

```js
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
```

### **4️⃣ 购物车有商品时，返回正确的商品**

```js
it("should return correct cart products with quantities", async () => {
  const testUser = await User.create({
    name: "Test User",
    email: "test@example.com",
    password: "hashedpassword",
    cartItems: [
      { product: testProduct._id, quantity: 2 }, // ✅ 正确存储 `{ product: ObjectId, quantity }`
    ],
  });

  const accessToken = jwt.sign(
    { userId: testUser._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "1h" }
  );

  const res = await request(app)
    .get("/api/cart")
    .set("Cookie", `accessToken=${accessToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
  expect(res.body[0]).toHaveProperty("name", "Test Product");
  expect(res.body[0]).toHaveProperty("quantity", 2);
});
```

---

## **📌 运行结果**

```bash
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        2.542 s
```

---

## **📌 结论**

✅ 这次测试确保了 `getCartProducts` API **逻辑正确** ，并修复了 Udemy 课程的错误。
✅ 通过 `Jest + Supertest`，可以 **自动化验证 API 是否正确**。
✅ **未来任何代码改动，都可以用 `npm test` 确保不会破坏购物车功能！** 🚀
