// routes/graphdbRoutes.js
const express = require('express');
const router = express.Router();
const graphdbController = require('../controllers/graphdbController');

// GraphDB diagnostic route
router.get('/', graphdbController.getDiagnosticPage);

module.exports = router;