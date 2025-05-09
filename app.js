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

// Validate GraphDB configuration
const validateGraphDBConfig = async () => {
  const graphdbConfig = {
    endpoint: process.env.GRAPHDB_ENDPOINT,
    repository: process.env.GRAPHDB_REPOSITORY,
    username: process.env.GRAPHDB_USERNAME,
    password: process.env.GRAPHDB_PASSWORD
  };

  console.log('GraphDB Configuration:');
  console.log(`- Endpoint: ${graphdbConfig.endpoint}`);
  console.log(`- Repository: ${graphdbConfig.repository}`);
  console.log(`- Username: ${graphdbConfig.username ? '✓ Set' : '✗ Not set'}`);
  console.log(`- Password: ${graphdbConfig.password ? '✓ Set' : '✗ Not set'}`);

  // Check for common configuration issues
  if (!graphdbConfig.endpoint) {
    console.error('WARNING: GRAPHDB_ENDPOINT is not set in your .env file');
  }
  
  if (graphdbConfig.endpoint && graphdbConfig.endpoint.trim() !== graphdbConfig.endpoint) {
    console.error('WARNING: GRAPHDB_ENDPOINT has leading or trailing whitespace');
  }

  if (!graphdbConfig.repository) {
    console.error('WARNING: GRAPHDB_REPOSITORY is not set in your .env file');
  }
  
  if (graphdbConfig.repository && graphdbConfig.repository.trim() !== graphdbConfig.repository) {
    console.error('WARNING: GRAPHDB_REPOSITORY has leading or trailing whitespace');
  }

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
      
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        
        if (error.response.status === 401) {
          console.error('Authentication failed. Please check your username and password.');
          console.error('Try updating your .env file with the correct credentials.');
        } else if (error.response.status === 404) {
          console.error('Repository not found. Please check if the repository name is correct.');
        }
      } else if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused. The GraphDB server might be down or not accessible.');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('Connection timed out. The server might be unreachable.');
      } else {
        console.error(`Error: ${error.message}`);
      }
      
      console.error('\nThe application will start, but GraphDB functionality may not work.');
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