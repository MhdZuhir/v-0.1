// controllers/resourceController.js - Complete Fix
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');

/**
 * Handle resource page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getResourcePage = async (req, res, next) => {
  const uri = req.query.uri;

  if (!uri) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen URI angiven'
    });
  }
  
  // IMPORTANT: Completely remove the system resource check
  // This allows all resources to be displayed

  try {
    // Fetch all data about the resource
    const properties = await graphdbService.fetchResourceProperties(uri);
    const description = await graphdbService.fetchResourceDescription(uri);
    const relatedUris = await graphdbService.fetchRelatedResources(uri);
    const types = await graphdbService.fetchResourceTypes(uri);
    
    console.log(`Resource ${uri}: Found ${properties.length} properties`);
    
    let labelMap = {};
    if (req.showLabels) {
      const uris = [];
      // Extract all URIs from the result set
      properties.forEach(row => {
        if (row.object?.type === 'uri') uris.push(row.object.value);
        if (row.predicate?.type === 'uri') uris.push(row.predicate.value);
      });
      uris.push(uri, ...relatedUris, ...types);
      labelMap = await labelService.fetchLabelsForUris(uris);
    }

    // Group properties by type - These array initializations are important!
    // Make sure they're always arrays even if empty
    const propertyGroups = {
      basic: [],
      relationships: [],
      other: []
    };
    
    const basicPredicates = [
      'http://www.w3.org/2000/01/rdf-schema#label',
      'http://www.w3.org/2000/01/rdf-schema#comment',
      'http://purl.org/dc/terms/title',
      'http://purl.org/dc/elements/1.1/title',
      'http://purl.org/dc/terms/description',
      'http://purl.org/dc/elements/1.1/description'
    ];
    
    const relationshipKeywords = ['has', 'related', 'member', 'part', 'connected', 'linked'];
    
    if (Array.isArray(properties)) {
      properties.forEach(row => {
        if (!row.predicate || !row.predicate.value) {
          console.log("Warning: Found property row without predicate value", row);
          return;
        }
        
        const predicateValue = row.predicate.value;
        
        if (basicPredicates.includes(predicateValue)) {
          propertyGroups.basic.push(row);
        } else if (relationshipKeywords.some(keyword => predicateValue.toLowerCase().includes(keyword))) {
          propertyGroups.relationships.push(row);
        } else {
          propertyGroups.other.push(row);
        }
      });
    } else {
      console.log("Warning: properties is not an array:", properties);
    }
    
    console.log(`Property groups: basic=${propertyGroups.basic.length}, relationships=${propertyGroups.relationships.length}, other=${propertyGroups.other.length}`);

    res.render('resource', {
      title: 'Resursdetaljer',
      uri,
      resourceLabel: req.showLabels && labelMap[uri] ? labelMap[uri] : uri.split(/[/#]/).pop(),
      description,
      types: types.map(type => ({
        uri: type,
        label: req.showLabels && labelMap[type] ? labelMap[type] : type.split(/[/#]/).pop()
      })),
      propertyGroups,
      properties, // The full array of properties for fallback display
      related: relatedUris.map(related => ({
        uri: related,
        label: req.showLabels && labelMap[related] ? labelMap[related] : related.split(/[/#]/).pop()
      })),
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getResourcePage:', err);
    next(err);
  }
};