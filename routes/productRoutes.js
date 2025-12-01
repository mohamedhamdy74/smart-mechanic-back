const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const { authenticate, authorize } = require("../middlewares/auth");
const { body } = require("express-validator");
const upload = require("../middlewares/upload");

router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.post(
  "/",
  authenticate,
  authorize("workshop"),
  upload.array('images', 10),
  [
    body("name").notEmpty().withMessage("اسم المنتج مطلوب"),
    body("price").isNumeric().withMessage("السعر يجب أن يكون رقماً"),
    body("stock").isInt({ min: 0 }).withMessage("الكمية يجب أن تكون رقماً صحيحاً"),
    body("description").optional().isLength({ max: 1000 }).withMessage("الوصف طويل جداً"),
    body("brand").optional().isLength({ max: 100 }).withMessage("اسم الماركة طويل جداً")
  ],
  productController.createProduct
);
router.put(
  "/:id",
  authenticate,
  authorize("workshop"),
  upload.array('images', 10),
  productController.updateProduct
);
router.delete(
  "/:id",
  authenticate,
  authorize("workshop"),
  productController.deleteProduct
);

module.exports = router;
