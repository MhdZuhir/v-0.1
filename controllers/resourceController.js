// controllers/resourceController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');
const { isSystemResource } = require('../utils/uriUtils');

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
  
  if (isSystemResource(uri)) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Systemresurser kan inte visas'
    });
  }

  try {
    // Fetch all data about the resource
    const properties = await graphdbService.fetchResourceProperties(uri);
    const description = await graphdbService.fetchResourceDescription(uri);
    const relatedUris = await graphdbService.fetchRelatedResources(uri);
    const types = await graphdbService.fetchResourceTypes(uri);
    
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

    // Group properties by type
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
    
    properties.forEach(row => {
      const predicateValue = row.predicate.value;
      
      if (basicPredicates.includes(predicateValue)) {
        propertyGroups.basic.push(row);
      } else if (relationshipKeywords.some(keyword => predicateValue.toLowerCase().includes(keyword))) {
        propertyGroups.relationships.push(row);
      } else {
        propertyGroups.other.push(row);
      }
    });

    // Remove empty groups
    if (propertyGroups.basic.length === 0) delete propertyGroups.basic;
    if (propertyGroups.relationships.length === 0) delete propertyGroups.relationships;
    if (propertyGroups.other.length === 0) delete propertyGroups.other;

    res.render('resource', {
      title: 'Resursdetaljer',
      uri,
      resourceLabel: req.showLabels && labelMap[uri] ? labelMap[uri] : uri,
      description,
      types: types.map(type => ({
        uri: type,
        label: req.showLabels && labelMap[type] ? labelMap[type] : type
      })),
      propertyGroups,
      related: relatedUris.map(related => ({
        uri: related,
        label: req.showLabels && labelMap[related] ? labelMap[related] : related
      })),
      labelMap
      // Note: showLabels and showLabelsToggleState are already in res.locals
    });
  } catch (err) {
    next(err);
  }
};