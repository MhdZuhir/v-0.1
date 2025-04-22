// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Product list route
router.get('/', productController.getProductListPage);

// Product detail route
router.get('/detail', productController.getProductDetailPage);

// Notor products specific route
router.get('/notor', productController.getNotorProductsPage);

module.exports = router;