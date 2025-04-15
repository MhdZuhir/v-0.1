// routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Category page route
router.get('/', categoryController.getCategoryPage);

module.exports = router;