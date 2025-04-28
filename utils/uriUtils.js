// utils/uriUtils.js - Fixed to properly handle important system resources

const { systemNamespaces } = require('../config/db');

/**
 * Check if a URI is a system resource that should be filtered
 * @param {string} uri - URI to check
 * @returns {boolean} - True if it's a system resource that should be filtered
 */
const isSystemResource = uri => {
  if (!uri || typeof uri !== 'string') return false;
  
  // Important RDF/RDFS/OWL resources that should always be allowed
  const allowedResources = [
    // RDF core classes
    'http://www.w3.org/2000/01/rdf-schema#Resource',
    'http://www.w3.org/2000/01/rdf-schema#Class',
    'http://www.w3.org/2000/01/rdf-schema#Literal',
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
    // OWL core classes
    'http://www.w3.org/2002/07/owl#Class',
    'http://www.w3.org/2002/07/owl#DatatypeProperty',
    'http://www.w3.org/2002/07/owl#ObjectProperty'
  ];
  
  // Allow these specific resources to always be shown
  if (allowedResources.includes(uri)) {
    return false;
  }
  
  // Also allow resources that contain certain keywords even if they're in system namespaces
  if (uri.includes('/ontology') || 
      uri.includes('/resource') || 
      uri.includes('/class') || 
      uri.includes('/product') ||
      uri.includes('/schema.org') ||
      uri.includes('/Property') ||
      uri.includes('#Property')) {
    return false;
  }
  
  // Check if the URI starts with any system namespace
  return systemNamespaces.some(namespace => uri.startsWith(namespace));
};

/**
 * Filter out system resources from query results
 * @param {Array} data - Array of data rows from SPARQL query
 * @returns {Array} - Filtered results
 */
const filterSystemResources = data => {
  // If there are only a few results, don't filter (to avoid empty results)
  if (!data || data.length <= 20) {
    console.log('Only a few results, skipping system resource filtering to avoid empty results');
    return data;
  }

  const filtered = data.filter(row => {
    // We'll check if all variables with URIs are system resources
    // Only filter if all URI values are system resources
    
    let hasUriValue = false;
    let allSystemUris = true;
    
    // Check each variable/column in the row
    Object.values(row).forEach(cell => {
      if (cell && cell.type === 'uri') {
        hasUriValue = true;
        if (!isSystemResource(cell.value)) {
          allSystemUris = false;
        }
      }
    });
    
    // Keep the row if it either has no URIs or not all URIs are system resources
    return !hasUriValue || !allSystemUris;
  });
  
  // If filtering would remove all results, return the original data
  if (filtered.length === 0 && data.length > 0) {
    console.log('Filtering would remove all results, returning original data');
    return data;
  }
  
  return filtered;
};

/**
 * Extract URIs from query results
 * @param {Array} results - Array of result rows
 * @returns {Array} - Array of URIs
 */
const extractUrisFromResults = results => {
  const uris = new Set();
  
  if (!results || !Array.isArray(results)) {
    return [];
  }
  
  results.forEach(row => {
    if (!row) return;
    
    Object.values(row).forEach(cell => {
      if (cell && cell.type === 'uri') {
        uris.add(cell.value);
      }
    });
  });
  
  return [...uris];
};

module.exports = {
  isSystemResource,
  filterSystemResources,
  extractUrisFromResults
};