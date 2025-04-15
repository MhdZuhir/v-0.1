// controllers/searchController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');

/**
 * Handle search request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.search = async (req, res) => {
  const searchTerm = req.query.q;
  
  if (!searchTerm) {
    return res.render('search', {
      title: 'Sök i databasen',
      results: [],
      searchTerm: ''
      // Note: showLabels and showLabelsToggleState are already in res.locals
    });
  }
  
  try {
    const resources = await graphdbService.searchResources(searchTerm);
    
    let labelMap = {};
    if (req.showLabels && resources.length > 0) {
      labelMap = await labelService.fetchLabelsForUris(resources);
    }
    
    res.render('search', {
      title: 'Sökresultat',
      results: resources.map(resource => ({
        uri: resource,
        label: req.showLabels && labelMap[resource] ? labelMap[resource] : resource
      })),
      searchTerm
      // Note: showLabels and showLabelsToggleState are already in res.locals
    });
  } catch (err) {
    console.error('Search error:', err);
    res.render('search', {
      title: 'Sökfel',
      error: `Ett fel uppstod vid sökning: ${err.message}`,
      searchTerm
      // Note: showLabels and showLabelsToggleState are already in res.locals
    });
  }
};