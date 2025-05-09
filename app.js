// app.js - Updated with configuration validation
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');
const axios = require('axios');

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

// Extract from app.js - This works and succeeds!
const validateGraphDBConfig = async () => {
  const graphdbConfig = {
    endpoint: process.env.GRAPHDB_ENDPOINT,
    repository: process.env.GRAPHDB_REPOSITORY,
    username: process.env.GRAPHDB_USERNAME,
    password: process.env.GRAPHDB_PASSWORD
  };

  // ...logging code...

  // Test connection if all configuration is present
  if (graphdbConfig.endpoint && graphdbConfig.repository) {
    try {
      console.log('Testing GraphDB connection...');
      
      const baseUrl = graphdbConfig.endpoint.endsWith('/') 
        ? graphdbConfig.endpoint.slice(0, -1) 
        : graphdbConfig.endpoint;
      
      const endpoint = `${baseUrl}/repositories/${graphdbConfig.repository}`;
      const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
      
      const config = {
        headers: { 'Accept': 'application/sparql-results+json' },
        params: { query },
        timeout: 5000 // 5 second timeout
      };
      
      // Add authentication if credentials are provided
      if (graphdbConfig.username && graphdbConfig.password) {
        // Method 1: Basic Auth via Axios auth option
        config.auth = {
          username: graphdbConfig.username,
          password: graphdbConfig.password
        };
        
        // Method 2: Authorization header 
        const authString = Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64');
        config.headers['Authorization'] = `Basic ${authString}`;
      }
      
      const response = await axios.get(endpoint, config);
      
      console.log(`GraphDB connection successful! Status: ${response.status}`);
      if (response.data && response.data.results && response.data.results.bindings) {
        console.log(`Retrieved ${response.data.results.bindings.length} results from the test query.`);
      }
    } catch (error) {
      console.error('GraphDB connection failed:');
      // ... error handling ...
    }
  } else {
    console.error('GraphDB configuration incomplete. Check your .env file.');
  }
};
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

// Setup application
const setupApp = async () => {
  // Validate GraphDB configuration
  await validateGraphDBConfig();
  
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
  
  console.log('Application setup complete');
};

// Run setup
setupApp().catch(err => {
  console.error('Error during application setup:', err);
});

module.exports = app;