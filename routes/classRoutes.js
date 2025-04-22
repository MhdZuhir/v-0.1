// routes/classRoutes.js
const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');

// Browse classes page route
router.get('/browse', classController.browseClassesPage);

// Class page route - shows individuals of a class
router.get('/', classController.getClassPage);

// Individual detail page route
router.get('/individual', classController.getIndividualPage);

module.exports = router;