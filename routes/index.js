// routes/index.js
const express = require('express');
const router = express.Router();
const labelMiddleware = require('../middlewares/labelMiddleware');

// Import route modules
const ontologyRoutes = require('./ontologyRoutes');
const resourceRoutes = require('./resourceRoutes');
const queryRoutes = require('./queryRoutes');
const searchRoutes = require('./searchRoutes');
const graphdbRoutes = require('./graphdbRoutes');
const productRoutes = require('./productRoutes');
const classRoutes = require('./classRoutes');  // Add the new class routes

// Import controllers
const ontologyController = require('../controllers/ontologyController');

// Apply label middleware to all routes
router.use(labelMiddleware);

// Simplified home page - just show ontologies for now
router.get('/', ontologyController.getOntologyListPage);

// Mount routes
router.use('/ontology', ontologyRoutes);
router.use('/resource', resourceRoutes);
router.use('/query', queryRoutes);
router.use('/search', searchRoutes);
router.use('/graphdb', graphdbRoutes);
router.use('/product', productRoutes);  // Make sure product routes are mounted
router.use('/class', classRoutes);  // Mount the class routes

module.exports = router;