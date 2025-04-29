// config/handlebars.js - Updated with partials support
const { engine } = require('express-handlebars');
const path = require('path');

/**
 * Configure Handlebars view engine
 * @param {Express} app - Express application instance
 */
exports.setup = (app) => {
  // Create handlebars instance with custom helpers
  const hbs = engine({
    helpers: {
      eq: (a, b) => a === b,
      encodeURIComponent: (str) => encodeURIComponent(str),
      lookup: (obj, field) => obj[field],
      getDisplayValue: (cell, showLabels, labelMap) => {
        if (cell && cell.type === 'uri' && showLabels && labelMap && labelMap[cell.value]) {
          return labelMap[cell.value];
        }
        return cell ? cell.value : '';
      },
      getValueType: (cell) => cell ? cell.type : '',
      getIconClass: (label) => {
        label = (label || '').toLowerCase();
        if (label.includes('person') || label.includes('människa')) return 'icon-person';
        if (label.includes('place') || label.includes('plats')) return 'icon-place';
        if (label.includes('event') || label.includes('händelse')) return 'icon-event';
        if (label.includes('organization') || label.includes('organisation')) return 'icon-organization';
        if (label.includes('concept') || label.includes('begrepp')) return 'icon-concept';
        return 'icon-default';
      },
      truncate: (text, length) => {
        if (!text) return '';
        return text.length <= length ? text : text.substring(0, length) + '...';
      },
      // Helper for concatenating strings
      concat: function() {
        let result = '';
        for (let i = 0; i < arguments.length; i++) {
          if (typeof arguments[i] === 'string' || typeof arguments[i] === 'number') {
            result += arguments[i];
          }
        }
        // Remove the last argument which is the Handlebars options object
        return result;
      }
    },
    // Add layout selection function
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, '../views/layouts'),
    // Add partials support
    partialsDir: path.join(__dirname, '../views/partials')
  });
  
  // Set up the Handlebars engine
  app.engine('handlebars', hbs);
  
  // Set up middleware to select layout based on query param
  app.use((req, res, next) => {
    // Check if embedded mode is requested
    if (req.query.embedded === 'true') {
      res.locals.layout = 'embedded';
    }
    next();
  });
  
  app.set('view engine', 'handlebars');
  app.set('views', path.join(__dirname, '../views'));
};