// controllers/queryController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');
const { filterSystemResources, extractUrisFromResults } = require('../utils/uriUtils');

/**
 * Handle query page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getQueryPage = (req, res) => {
  res.render('query', { title: 'SPARQL Query' });
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
  
  if (!query) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen fråga angiven'
    });
  }

  try {
    const response = await graphdbService.executeQuery(query);
    let data = response.results.bindings || [];
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    
    if (hideSystemResources) {
      data = filterSystemResources(data);
    }
    
    let labelMap = {};
    if (req.showLabels) {
      const uris = extractUrisFromResults(data);
      labelMap = await labelService.fetchLabelsForUris(uris);
    }

    res.render('query-results', {
      title: 'Query Results',
      headers,
      rows: data,
      labelMap,
      hideSystemResources,
      query
    });
  } catch (err) {
    next(err);
  }
};