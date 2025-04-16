// routes/index.js
const express = require('express');
const router = express.Router();
const labelMiddleware = require('../middlewares/labelMiddleware');

// Import route modules
const ontologyRoutes = require('./ontologyRoutes');
const resourceRoutes = require('./resourceRoutes');
const categoryRoutes = require('./categoryRoutes');
const queryRoutes = require('./queryRoutes');
const searchRoutes = require('./searchRoutes');
const graphdbRoutes = require('./graphdbRoutes');
const notorRoutes = require('./notorRoutes');
// We'll comment out the product routes until they're fully implemented
// const productRoutes = require('./productRoutes'); 

// Import controllers
const ontologyController = require('../controllers/ontologyController');
// const productController = require('../controllers/productController');

// Apply label middleware to all routes
router.use(labelMiddleware);

// Simplified home page - just show ontologies for now
router.get('/', ontologyController.getOntologyListPage);

// Mount routes
router.use('/ontology', ontologyRoutes);
router.use('/resource', resourceRoutes);
router.use('/category', categoryRoutes);
router.use('/query', queryRoutes);
router.use('/search', searchRoutes);
router.use('/graphdb', graphdbRoutes);
router.use('/notor', notorRoutes);
// router.use('/products', productRoutes); // We'll uncomment this later

module.exports = router;