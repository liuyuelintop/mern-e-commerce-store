import Product from "../models/product.model.js";

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

export const removeAllFromCart = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = req.user;

    if (!productId) {
      // 1️⃣ 清空购物车
      user.cartItems = [];
    } else {
      // 2️⃣ 过滤时正确匹配 `product._id`
      user.cartItems = user.cartItems.filter(
        (item) => item.product.toString() !== productId
      );
    }

    await user.save();
    res.json(user.cartItems);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateQuantity = async (req, res) => {
  try {
    const { id: productId } = req.params;
    const { quantity } = req.body;
    const user = req.user;

    // 1️⃣ 查找是否存在该商品
    const existingItem = user.cartItems.find(
      (item) => item.product.toString() === productId
    );

    if (existingItem) {
      if (quantity === 0) {
        // 2️⃣ 如果数量为 0，移除商品
        user.cartItems = user.cartItems.filter(
          (item) => item.product.toString() !== productId
        );
        await user.save();
        return res.json(user.cartItems);
      }

      // 3️⃣ 更新数量
      existingItem.quantity = quantity;
      await user.save();
      return res.json(user.cartItems);
    } else {
      return res.status(404).json({ message: "Product not found in cart" });
    }
  } catch (error) {
    console.error("Error in updateQuantity controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
