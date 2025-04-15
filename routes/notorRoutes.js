// routes/notorRoutes.js
const express = require('express');
const router = express.Router();
const notorController = require('../controllers/notorController');

// Notor65 data route
router.get('/', notorController.getNotorPage);

module.exports = router;