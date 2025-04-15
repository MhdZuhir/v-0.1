// routes/queryRoutes.js
const express = require('express');
const router = express.Router();
const queryController = require('../controllers/queryController');

// Query page routes
router.get('/', queryController.getQueryPage);
router.post('/', queryController.executeQuery);

module.exports = router;