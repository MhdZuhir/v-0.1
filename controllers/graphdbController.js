// controllers/graphdbController.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');

/**
 * Diagnostic endpoint for GraphDB connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDiagnosticPage = async (req, res) => {
  try {
    let bindings = [];
    let errorMessage = '';
    let debugInfo = {
      endpoint: graphdbConfig.endpoint,
      repository: graphdbConfig.repository,
      queryExecuted: false,
      resultCount: 0,
      filteredCount: 0,
      timestamp: new Date().toISOString()
    };

    try {
      const query = `SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10`;
      debugInfo.query = query;
      
      const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
        headers: { 'Accept': 'application/sparql-results+json' },
        params: { query }
      });
      
      debugInfo.queryExecuted = true;
      debugInfo.responseStatus = response.status;
      
      if (response.data && response.data.results && Array.isArray(response.data.results.bindings)) {
        bindings = response.data.results.bindings || [];
        debugInfo.resultCount = bindings.length;
        
        if (bindings.length > 0) {
          const firstRow = bindings[0];
          debugInfo.firstRowKeys = Object.keys(firstRow);
        }
      } else {
        debugInfo.unexpectedResponseStructure = true;
        errorMessage = "GraphDB response doesn't have the expected structure";
      }
    } catch (dbErr) {
      console.error('Error querying GraphDB:', dbErr);
      errorMessage = "Could not retrieve data from GraphDB. " + dbErr.message;
      debugInfo.error = dbErr.message;
    }
    
    debugInfo.originalCount = bindings.length;
    
    res.render('graphdb', {
      title: 'GraphDB Diagnostic Data',
      message: errorMessage || 'Raw Data from GraphDB:',
      rows: bindings,
      labelMap: {},
      debug: debugInfo,
      diagnosticMode: true
    });
  } catch (err) {
    console.error('Unexpected error in /graphdb route:', err);
    res.status(500).send(`
      <h1>Server Error</h1>
      <p>There was an error processing your request:</p>
      <pre>${err.stack}</pre>
    `);
  }
};