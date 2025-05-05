// controllers/queryController.js - Fixed version

/**
 * Controller for handling SPARQL query execution and display
 */

const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');
const { filterSystemResources, extractUrisFromResults } = require('../utils/uriUtils');

/**
 * Handle query page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getQueryPage = (req, res) => {
  // Check if a query was passed in the URL
  const query = req.query.query;
  const embedded = req.query.embedded === 'true';
  
  if (query) {
    // If a query was provided, execute it directly
    return this.executeQuery({
      body: { 
        query,
        hideSystemResources: req.query.hideSystemResources || 'true'
      },
      showLabels: req.showLabels,
      embedded: embedded
    }, res);
  }
  
  // Otherwise show the query form
  res.render('query', { 
    title: 'SPARQL Query',
    showLabels: req.showLabels,
    showLabelsToggleState: req.showLabels ? 'false' : 'true'
  });
};

/**
 * Execute SPARQL query
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.executeQuery = async (req, res, next) => {
  const query = req.body.query;
  const hideSystemResources = req.body.hideSystemResources !== 'false';
  const embedded = req.embedded === true;
  
  if (!query) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen fråga angiven',
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  }

  try {
    console.log(`Executing SPARQL query: ${query}`);
    const response = await graphdbService.executeQuery(query);
    
    // Check the response structure
    console.log('GraphDB response structure:', JSON.stringify(response).substring(0, 500) + '...');
    
    if (!response || !response.results) {
      console.error('Invalid response structure:', response);
      throw new Error('Unexpected response format from GraphDB');
    }
    
    // Ensure bindings is always an array
    let data = Array.isArray(response.results.bindings) ? response.results.bindings : [];
    console.log(`Raw result count: ${data.length}`);
    
    // Extract headers from all results
    let headers = [];
    if (data.length > 0) {
      // Get all unique headers from all results
      const headerSet = new Set();
      data.forEach(row => {
        Object.keys(row).forEach(key => headerSet.add(key));
      });
      headers = Array.from(headerSet);
      console.log('Headers from results:', headers);
    }
    
    // Apply system resource filtering if requested
    if (hideSystemResources) {
      const originalCount = data.length;
      data = filterSystemResources(data);
      console.log(`Filtered ${originalCount - data.length} system resources, ${data.length} results remaining`);
    }
    
    // Get labels for URIs if needed
    let labelMap = {};
    if (req.showLabels && data.length > 0) {
      const uris = extractUrisFromResults(data);
      console.log(`Fetching labels for ${uris.length} URIs`);
      labelMap = await labelService.fetchLabelsForUris(uris);
    }
    
    // Final debugging
    console.log(`Rendering template with ${data.length} results and ${headers.length} columns`);
    
    // Choose template based on embedded mode
    const template = embedded ? 'embedded-query-results' : 'query-results';
    
    res.render(template, {
      title: 'Query Results',
      headers,
      rows: data,
      labelMap,
      hideSystemResources,
      query,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true',
      embedded: embedded,
      debug: {
        resultCount: data.length,
        headerCount: headers.length,
        hasLabels: Object.keys(labelMap).length > 0
      }
    });
  } catch (err) {
    console.error('Query execution error:', err);
    
    // Handle errors - check if next is available (middleware chain)
    if (next) {
      return next(err);
    }
    
    // If next is not available, render the error page directly
    res.status(500).render('error', {
      title: 'Error',
      message: `Ett fel uppstod vid körning av frågan: ${err.message}`,
      error: err,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  }
};