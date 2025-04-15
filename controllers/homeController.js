// controllers/homeController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');

/**
 * Handle home page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getHomePage = async (req, res, next) => {
  try {
    const categories = await graphdbService.fetchCategories();
    let labelMap = req.showLabels ? await labelService.fetchLabelsForUris(categories) : {};
    
    res.render('home', {
      title: 'Välkommen till WikiGraph',
      categories: categories.map(category => ({
        uri: category,
        label: req.showLabels && labelMap[category] ? labelMap[category] : category
      })),
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};