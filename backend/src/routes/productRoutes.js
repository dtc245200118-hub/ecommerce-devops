const express = require("express");
const pool = require("../config/database");

const router = express.Router();

const PRODUCT_COLUMNS = `p.id, p.category_id, c.name AS category_name, p.name,
  p.description, p.price, p.stock, p.image_url`;

// GET /api/products - Danh sách sản phẩm đang bán (công khai)
router.get("/", async (req, res, next) => {
  try {
    const [products] = await pool.query(
      `SELECT ${PRODUCT_COLUMNS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.is_active = 1
       ORDER BY p.id DESC`
    );

    res.json({ success: true, total: products.length, data: products });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/categories - Danh mục sản phẩm
router.get("/categories", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM categories ORDER BY id");
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
