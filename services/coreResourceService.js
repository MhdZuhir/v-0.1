// services/coreResourceService.js
const { getCoreResourceInfo } = require('../utils/coreResourceUtils');

/**
 * Service to enhance RDF/RDFS/OWL core resource information
 */

/**
 * Enhances resource data with core resource information if available
 * @param {string} uri - Resource URI
 * @param {Object} existingData - Current resource data from GraphDB
 * @returns {Object} - Enhanced resource data
 */
async function enhanceResourceData(uri, existingData = {}) {
  // Check if this is a core resource that needs special handling
  const coreInfo = getCoreResourceInfo(uri);
  
  // If not a core resource, just return the existing data
  if (!coreInfo) {
    return existingData;
  }
  
  // Create enhanced data by combining existing data with core information
  const enhancedData = {
    ...existingData,
    isCoreResource: true,
    namespace: coreInfo.namespace,
    description: coreInfo.description || existingData.description,
    properties: coreInfo.properties || [],
    examples: coreInfo.examples || [],
    related: coreInfo.related || [],
    resourceType: coreInfo.type || 'Resource'
  };
  
  return enhancedData;
}

/**
 * Check if a URI is a core semantic web resource
 * @param {string} uri - Resource URI
 * @returns {boolean} - True if it's a core resource
 */
function isCoreResource(uri) {
  return !!getCoreResourceInfo(uri);
}

/**
 * Get a list of important namespaces with their prefixes
 * @returns {Array} - Array of namespace objects
 */
function getCommonNamespaces() {
  return [
    { prefix: 'rdf', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#', description: 'RDF core vocabulary' },
    { prefix: 'rdfs', uri: 'http://www.w3.org/2000/01/rdf-schema#', description: 'RDF Schema vocabulary' },
    { prefix: 'owl', uri: 'http://www.w3.org/2002/07/owl#', description: 'Web Ontology Language' },
    { prefix: 'xsd', uri: 'http://www.w3.org/2001/XMLSchema#', description: 'XML Schema Datatypes' },
    { prefix: 'skos', uri: 'http://www.w3.org/2004/02/skos/core#', description: 'Simple Knowledge Organization System' },
    { prefix: 'dc', uri: 'http://purl.org/dc/elements/1.1/', description: 'Dublin Core elements' },
    { prefix: 'dcterms', uri: 'http://purl.org/dc/terms/', description: 'Dublin Core terms' },
    { prefix: 'foaf', uri: 'http://xmlns.com/foaf/0.1/', description: 'Friend of a Friend' }
  ];
}

module.exports = {
  enhanceResourceData,
  isCoreResource,
  getCommonNamespaces
};