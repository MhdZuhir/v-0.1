// utils/authUtils.js

/**
 * Common function to get authentication headers for GraphDB
 */
function getAuthHeaders() {
  const { graphdbConfig } = require('../config/db');
  const authHeader = 'Basic ' + Buffer.from(`${graphdbConfig.auth.username}:${graphdbConfig.auth.password}`).toString('base64');
  
  return {
    'Accept': 'application/sparql-results+json',
    'Authorization': authHeader
  };
}

module.exports = {
  getAuthHeaders
};