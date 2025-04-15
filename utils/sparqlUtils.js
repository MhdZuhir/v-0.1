// utils/sparqlUtils.js

/**
 * Sanitize a string for use in SPARQL queries
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeSparqlString = str => {
    if (!str) return '';
    return str.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
  };
  
  module.exports = {
    sanitizeSparqlString
  };