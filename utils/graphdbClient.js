// utils/graphdbClient.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');

/**
 * GraphDB client utility for executing SPARQL queries
 */
const graphdbClient = {
  /**
   * Execute a SPARQL query with proper parameter encoding
   * @param {string} query - SPARQL query to execute
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Response data from GraphDB
   */
  executeQuery: async function(query, options = {}) {
    try {
      const logQuery = options.logQuery !== false;
      if (logQuery) {
        console.log(`Executing query: ${query.substring(0, 300)}${query.length > 300 ? '...' : ''}`);
      }
      
      // Use URLSearchParams for proper parameter encoding
      const params = new URLSearchParams();
      params.append('query', query);
      
      const response = await axios.get(
        `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, 
        {
          headers: { 'Accept': 'application/sparql-results+json' },
          params
        }
      );
      
      // Check for basic response structure
      if (!response.data) {
        throw new Error('Empty response from GraphDB');
      }
      
      if (!response.data.results) {
        console.error('Unexpected response structure:', JSON.stringify(response.data).substring(0, 500));
        throw new Error('Invalid response format from GraphDB');
      }
      
      // Ensure bindings is always an array
      if (!Array.isArray(response.data.results.bindings)) {
        console.warn('GraphDB response missing bindings array, creating empty array');
        response.data.results.bindings = [];
      }
      
      return response.data;
    } catch (error) {
      console.error('GraphDB query error:', error.message);
      
      if (error.response) {
        // The request was made and the server responded with a non-2xx status
        console.error('GraphDB error response:', error.response.status);
        if (error.response.data) {
          console.error('Error details:', typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 500) 
            : JSON.stringify(error.response.data).substring(0, 500));
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received from GraphDB');
      }
      
      throw error;
    }
  },
  
  /**
   * Get a download URL for an ontology in a specific format
   * @param {string} uri - Ontology URI
   * @param {string} format - Download format MIME type (e.g., 'application/rdf+xml')
   * @returns {string} - Download URL
   */
  getDownloadUrl: function(uri, format) {
    // Create URLSearchParams for proper encoding
    const params = new URLSearchParams();
    params.append('infer', 'false');
    params.append('context', `<${uri}>`);
    params.append('format', format);
    params.append('filename', 'ontology');
    
    // GraphDB export URL with Content-Disposition header parameter
    return `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}/statements?${params.toString()}`;
  }
};

module.exports = graphdbClient;