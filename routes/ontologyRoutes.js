// routes/ontologyRoutes.js
const express = require('express');
const router = express.Router();
const ontologyController = require('../controllers/ontologyController');

// Ontology detail route
router.get('/detail', ontologyController.getOntologyDetailPage);

module.exports = router;