// controllers/resourceController.js - Enhanced version with core resource support

const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');

/**
 * Handle resource page request with enhanced relationship display
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

  try {
    console.log(`Fetching enhanced resource page for: ${uri}`);
    
    // Check if this is a core RDF/RDFS/OWL resource - skip for now since we don't have coreResourceService
    const isCoreResource = false; // We'll implement this later
    
    // Fetch all data about the resource
    const properties = await graphdbService.fetchResourceProperties(uri);
    let description = await graphdbService.fetchResourceDescription(uri);
    const relatedUris = await graphdbService.fetchRelatedResources(uri);
    const types = await graphdbService.fetchResourceTypes(uri);
    
    // NEW: Fetch additional relationship data
    const inDomainOf = await fetchPropertiesWithDomain(uri);
    const inRangeOf = await fetchPropertiesWithRange(uri);
    const subClasses = await fetchSubClasses(uri);
    const superClasses = await fetchSuperClasses(uri);
    
    console.log(`Resource ${uri}: Found ${properties.length} properties, ${types.length} types, ${relatedUris.length} related resources`);
    console.log(`Additional relationships: ${inDomainOf.length} in domain of, ${inRangeOf.length} in range of, ${subClasses.length} subclasses, ${superClasses.length} superclasses`);
    
    // Get labels if needed
    let labelMap = {};
    if (req.showLabels) {
      const uris = [];
      // Extract all URIs from the result set
      properties.forEach(row => {
        if (row.object?.type === 'uri') uris.push(row.object.value);
        if (row.predicate?.type === 'uri') uris.push(row.predicate.value);
      });
      
      // Add relationship URIs
      uris.push(uri, ...relatedUris, ...types);
      inDomainOf.forEach(prop => uris.push(prop.uri));
      inRangeOf.forEach(prop => uris.push(prop.uri));
      subClasses.forEach(cls => uris.push(cls.uri));
      superClasses.forEach(cls => uris.push(cls.uri));
      
      console.log(`Fetching labels for ${uris.length} URIs`);
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
    
    const relationshipKeywords = ['has', 'related', 'member', 'part', 'connected', 'linked', 'domain', 'range'];
    
    if (Array.isArray(properties)) {
      properties.forEach(row => {
        if (!row.predicate || !row.predicate.value) {
          console.warn("Warning: Found property row without predicate value", row);
          return;
        }
        
        const predicateValue = row.predicate.value;
        
        if (basicPredicates.includes(predicateValue)) {
          propertyGroups.basic.push(row);
        } else if (relationshipKeywords.some(keyword => 
          predicateValue.toLowerCase().includes(keyword)) || 
          (row.object && row.object.type === 'uri')) {
          propertyGroups.relationships.push(row);
        } else {
          propertyGroups.other.push(row);
        }
      });
    } else {
      console.warn("Warning: properties is not an array:", properties);
    }
    
    // Get common namespaces for the view - temporarily removed since we don't have coreResourceService
    const commonNamespaces = [
      { prefix: 'rdf', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', description: 'RDF core vocabulary' },
      { prefix: 'rdfs', uri: 'http://www.w3.org/2000/01/rdf-schema#', description: 'RDF Schema vocabulary' },
      { prefix: 'owl', uri: 'http://www.w3.org/2002/07/owl#', description: 'Web Ontology Language' },
      { prefix: 'xsd', uri: 'http://www.w3.org/2001/XMLSchema#', description: 'XML Schema Datatypes' }
    ];
    
    // Format the relationship data for the view
    const formattedInDomainOf = inDomainOf.map(prop => ({
      uri: prop.uri,
      label: req.showLabels && labelMap[prop.uri] ? labelMap[prop.uri] : prop.uri.split(/[/#]/).pop()
    }));
    
    const formattedInRangeOf = inRangeOf.map(prop => ({
      uri: prop.uri,
      label: req.showLabels && labelMap[prop.uri] ? labelMap[prop.uri] : prop.uri.split(/[/#]/).pop()
    }));
    
    const formattedSubClasses = subClasses.map(cls => ({
      uri: cls.uri,
      label: req.showLabels && labelMap[cls.uri] ? labelMap[cls.uri] : cls.uri.split(/[/#]/).pop()
    }));
    
    const formattedSuperClasses = superClasses.map(cls => ({
      uri: cls.uri,
      label: req.showLabels && labelMap[cls.uri] ? labelMap[cls.uri] : cls.uri.split(/[/#]/).pop()
    }));

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
      showLabelsToggleState: req.showLabels ? 'false' : 'true',
      
      // Enhanced relationship data
      inDomainOf: formattedInDomainOf,
      inRangeOf: formattedInRangeOf,
      subClasses: formattedSubClasses,
      superClasses: formattedSuperClasses,
      
      // Core resource info - simplified for now
      isCoreResource: false,
      commonNamespaces
    });
  } catch (err) {
    console.error('Error in getResourcePage:', err);
    next(err);
  }
};

/**
 * Fetch properties that have the given URI as their domain
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of property objects
 */
async function fetchPropertiesWithDomain(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?property ?type WHERE {
        ?property <http://www.w3.org/2000/01/rdf-schema#domain> <${safeUri}> .
        OPTIONAL { ?property a ?type }
      }
      LIMIT 50
    `;
    
    const response = await graphdbService.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      return [];
    }
    
    return response.results.bindings.map(binding => ({
      uri: binding.property.value,
      type: binding.type?.value
    }));
  } catch (error) {
    console.error(`Error fetching properties with domain ${uri}:`, error);
    return [];
  }
}

/**
 * Fetch properties that have the given URI as their range
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of property objects
 */
async function fetchPropertiesWithRange(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?property ?type WHERE {
        ?property <http://www.w3.org/2000/01/rdf-schema#range> <${safeUri}> .
        OPTIONAL { ?property a ?type }
      }
      LIMIT 50
    `;
    
    const response = await graphdbService.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      return [];
    }
    
    return response.results.bindings.map(binding => ({
      uri: binding.property.value,
      type: binding.type?.value
    }));
  } catch (error) {
    console.error(`Error fetching properties with range ${uri}:`, error);
    return [];
  }
}

/**
 * Fetch classes that are subclasses of the given URI
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of class objects
 */
async function fetchSubClasses(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?class ?type WHERE {
        ?class <http://www.w3.org/2000/01/rdf-schema#subClassOf> <${safeUri}> .
        OPTIONAL { ?class a ?type }
      }
      LIMIT 50
    `;
    
    const response = await graphdbService.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      return [];
    }
    
    return response.results.bindings.map(binding => ({
      uri: binding.class.value,
      type: binding.type?.value
    }));
  } catch (error) {
    console.error(`Error fetching subclasses of ${uri}:`, error);
    return [];
  }
}

/**
 * Fetch superclasses of the given URI
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of class objects
 */
async function fetchSuperClasses(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?class ?type WHERE {
        <${safeUri}> <http://www.w3.org/2000/01/rdf-schema#subClassOf> ?class .
        OPTIONAL { ?class a ?type }
      }
      LIMIT 50
    `;
    
    const response = await graphdbService.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      return [];
    }
    
    return response.results.bindings.map(binding => ({
      uri: binding.class.value,
      type: binding.type?.value
    }));
  } catch (error) {
    console.error(`Error fetching superclasses of ${uri}:`, error);
    return [];
  }
}