// routes/index.js
const express = require('express');
const router = express.Router();
const labelMiddleware = require('../middlewares/labelMiddleware');

// Import route modules
const homeRoutes = require('./homeRoutes');
const resourceRoutes = require('./resourceRoutes');
const categoryRoutes = require('./categoryRoutes');
const queryRoutes = require('./queryRoutes');
const searchRoutes = require('./searchRoutes');
const graphdbRoutes = require('./graphdbRoutes');
const notorRoutes = require('./notorRoutes');

// Apply label middleware to all routes
router.use(labelMiddleware);

// Mount routes
router.use('/', homeRoutes);
router.use('/resource', resourceRoutes);
router.use('/category', categoryRoutes);
router.use('/query', queryRoutes);
router.use('/search', searchRoutes);
router.use('/graphdb', graphdbRoutes);
router.use('/notor', notorRoutes);

module.exports = router;