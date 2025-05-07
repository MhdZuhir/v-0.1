// routes/ontologyRoutes.js
const express = require('express');
const router = express.Router();
const ontologyController = require('../controllers/ontologyController');

// Ontology detail route
router.get('/detail', ontologyController.getOntologyDetailPage);

// Ontology download route
router.get('/download', ontologyController.downloadOntology);

// Test download route for debugging
router.get('/test-download', ontologyController.testDownload);

// Route to check supported formats
router.get('/formats', ontologyController.getSupportedFormats);

// Get ontology triples route
router.get('/triples', ontologyController.getOntologyTriples);

// Ontology products route
router.get('/products', ontologyController.getOntologyProducts);

// Debug products route - commenting out if not defined
// router.get('/debug-products', ontologyController.debugProducts);

// Rebuild product index route - commenting out if not defined
// router.get('/rebuild-products', ontologyController.rebuildProductIndex);

module.exports = router;