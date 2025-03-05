# 🛠 购物车 API 单元测试（`cart.test.js`）

## **📌 为什么要做 `cart.test.js`？**

在学习 Udemy 课程时，我发现课程作者在后端购物车 API 代码中存在一些问题，例如：

- **错误的 `find()` 查询**，导致购物车数据不匹配。

  - `const products = await Product.find({ _id: { $in: req.user.cartItems } });`
  - ```javascript
    const cartItems = products.map((product) => {
      const item = req.user.cartItems.find(
        (cartItem) => cartItem.id === product.id
      );
      return { ...product.toJSON(), quantity: item.quantity };
    });
    ```

- **O(n²) 查询性能问题**，影响大数据量处理。
- **`getCartProducts` 逻辑错误**，导致 `quantity` 可能错误。

为了 **修正这些问题**，我修改了 `getCartProducts` 逻辑，但 **没有前端界面** 进行测试，所以我编写了 `cart.test.js` 进行 API 测试，以确保：

1. **身份验证正确**（无 token、无效 token、过期 token 都能正确处理）。
2. **购物车数据正确返回**（空购物车时返回 `[]`，有商品时返回正确数据）。
3. **Jest + Supertest 自动化测试**，未来修改代码时不会破坏功能。

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

### 运行结果

```bash
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        2.542 s
```

## **📌 结论**

✅ 这次测试确保了 `getCartProducts` API **逻辑正确** ，并修复了 Udemy 课程的错误。

✅ 通过 `Jest + Supertest`，可以 **自动化验证 API 是否正确** 。

✅ **未来任何代码改动，都可以用 `npm test` 确保不会破坏购物车功能！** 🚀
