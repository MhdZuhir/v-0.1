// app.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

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

// Make sure necessary directories exist
const ensureDirectoriesExist = () => {
  const dirs = [
    './utils',
    './services',
    './views',
    './views/layouts',
    './public',
    './public/css',
    './public/js'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Call function to create directories
ensureDirectoriesExist();

// Configure view engine
handlebarsConfig.setup(app);

// Configure Express
expressConfig.setup(app);

// Setup routes
app.use('/', routes);

// Error handler
app.use(errorHandler);

module.exports = app;