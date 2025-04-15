// utils/uriUtils.js
const { systemNamespaces } = require('../config/db');

/**
 * Check if a URI is a system resource
 * @param {string} uri - URI to check
 * @returns {boolean} - True if it's a system resource
 */
const isSystemResource = uri => {
  if (!uri || typeof uri !== 'string') return false;
  return systemNamespaces.some(namespace => uri.startsWith(namespace));
};

/**
 * Filter out system resources from query results
 * @param {Array} data - Array of data rows from SPARQL query
 * @returns {Array} - Filtered results
 */
const filterSystemResources = data => {
  return data.filter(row => {
    for (const key in row) {
      if (row[key]?.type === 'uri' && isSystemResource(row[key].value)) return false;
    }
    return true;
  });
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