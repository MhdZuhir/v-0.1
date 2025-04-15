// app.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import configurations
const expressConfig = require('./config/express');
const handlebarsConfig = require('./config/handlebars');

// Import route definitions
const routes = require('./routes');

// Import middlewares
const errorHandler = require('./middlewares/errorHandler');

// Initialize Express app
const app = express();

// Configure view engine
handlebarsConfig.setup(app);

// Configure Express
expressConfig.setup(app);

// Setup routes
app.use('/', routes);

// Error handler
app.use(errorHandler);

module.exports = app;