// controllers/categoryController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');
const { isSystemResource } = require('../utils/uriUtils');

/**
 * Handle category page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getCategoryPage = async (req, res, next) => {
  try {
    const categoryUri = req.query.uri;
    
    if (!categoryUri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Ingen kategori angiven'
      });
    }
    
    if (isSystemResource(categoryUri)) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Systemkategorier kan inte visas'
      });
    }
    
    const resources = await graphdbService.fetchResourcesByCategory(categoryUri);
    let labelMap = {};
    
    if (req.showLabels) {
      const uris = [...resources, categoryUri];
      labelMap = await labelService.fetchLabelsForUris(uris);
    }
    
    res.render('category', {
      title: 'Kategori',
      categoryUri,
      categoryLabel: req.showLabels && labelMap[categoryUri] ? labelMap[categoryUri] : categoryUri,
      resources: resources.map(resource => ({
        uri: resource,
        label: req.showLabels && labelMap[resource] ? labelMap[resource] : resource
      }))
    });
  } catch (err) {
    next(err);
  }
};