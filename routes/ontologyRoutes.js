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

module.exports = router;