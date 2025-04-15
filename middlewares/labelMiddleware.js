// middlewares/labelMiddleware.js

/**
 * Middleware to parse label-showing preferences
 */
const labelMiddleware = (req, res, next) => {
    // Set label display preference
    req.showLabels = req.query.showLabels !== 'false';
    
    // Add labelPref to locals for use in all views
    res.locals.showLabels = req.showLabels;
    
    // Add the opposite state for toggling in templates
    res.locals.showLabelsToggleState = req.showLabels ? 'false' : 'true';
    
    next();
  };
  
  module.exports = labelMiddleware;