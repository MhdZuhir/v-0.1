// middlewares/labelMiddleware.js

/**
 * Middleware to parse label-showing preferences
 * This version is more explicit about the values it accepts
 * and how it converts them to boolean.
 */
const labelMiddleware = (req, res, next) => {
  // Get value from query parameter, form input, or default to true
  let showLabels;
  
  // Check if it's in the query parameters (GET requests)
  if (req.query.showLabels !== undefined) {
      // Convert to boolean - only 'false' (string) is considered false
      showLabels = req.query.showLabels !== 'false';
  } 
  // Check if it's in the form body (POST requests)
  else if (req.body && req.body.showLabels !== undefined) {
      // Convert to boolean - only 'false' (string) is considered false
      showLabels = req.body.showLabels !== 'false';
  } 
  // Default to true if not specified
  else {
      showLabels = true;
  }
  
  // Add to request object for controllers to use
  req.showLabels = showLabels;
  
  // Add to response locals for views to use
  res.locals.showLabels = showLabels;
  
  // Add the opposite state for toggling in templates
  res.locals.showLabelsToggleState = showLabels ? 'false' : 'true';
  
  next();
};

module.exports = labelMiddleware;