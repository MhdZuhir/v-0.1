// routes/resourceRoutes.js
const express = require('express');
const router = express.Router();
const resourceController = require('../controllers/resourceController');

// Resource detail route
router.get('/', resourceController.getResourcePage);

module.exports = router;