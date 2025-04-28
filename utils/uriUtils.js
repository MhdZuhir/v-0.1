// utils/uriUtils.js - Fixed to allow RDF properties

const { systemNamespaces } = require('../config/db');

/**
 * Check if a URI is a system resource
 * @param {string} uri - URI to check
 * @returns {boolean} - True if it's a system resource
 */
const isSystemResource = uri => {
  if (!uri || typeof uri !== 'string') return false;
  
  // Make the function more permissive by adding exceptions
  // Allow resources that contain certain keywords even if they're in system namespaces
  if (uri.includes('/ontology') || 
      uri.includes('/resource') || 
      uri.includes('/class') || 
      uri.includes('/product') ||
      uri.includes('/schema.org') ||
      uri.includes('/Property') ||   // Allow Property resources
      uri.includes('#Property')) {   // Allow Property resources with hash notation
    return false;
  }
  
  // Check if the URI starts with any system namespace
  return systemNamespaces.some(namespace => uri.startsWith(namespace));
};

/**
 * Filter out system resources from query results with special handling
 * @param {Array} data - Array of data rows from SPARQL query
 * @returns {Array} - Filtered results
 */
const filterSystemResources = data => {
  // If there are only a few results, don't filter (to avoid empty results)
  if (data.length <= 20) {
    console.log('Only a few results, skipping system resource filtering to avoid empty results');
    return data;
  }

  const filtered = data.filter(row => {
    // Only filter if all subject, predicate and object are system resources
    const allSystem = 
      (!row.s || (row.s.type === 'uri' && isSystemResource(row.s.value))) &&
      (!row.p || (row.p.type === 'uri' && isSystemResource(row.p.value))) &&
      (!row.o || (row.o.type === 'uri' && isSystemResource(row.o.value)));
      
    // Keep the row if not all values are system resources
    return !allSystem;
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
  results.forEach(row => {
    Object.values(row).forEach(cell => {
      if (cell && cell.type === 'uri') uris.add(cell.value);
    });
  });
  return [...uris];
};

module.exports = {
  isSystemResource,
  filterSystemResources,
  extractUrisFromResults
};