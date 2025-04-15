// services/graphdbService.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
const { isSystemResource } = require('../utils/uriUtils');

/**
 * Execute a SPARQL query against GraphDB
 * @param {string} query - SPARQL query to execute
 * @returns {Promise<Object>} - Response data from GraphDB
 */
async function executeQuery(query) {
  try {
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error executing GraphDB query:', error);
    throw error;
  }
}

/**
 * Fetch resource description (comments, definitions, etc.)
 * @param {string} uri - Resource URI
 * @returns {Promise<string|null>} - Resource description or null if not found
 */
async function fetchResourceDescription(uri) {
  if (isSystemResource(uri)) return null;
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT ?description WHERE {
        <${safeUri}> ?p ?description .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>,
          <http://www.w3.org/2004/02/skos/core#definition>
        ))
        FILTER(LANG(?description) = "" || LANG(?description) = "sv" || LANG(?description) = "en")
      }
      LIMIT 1
    `;
    
    const data = await executeQuery(query);
    const bindings = data.results.bindings || [];
    return bindings.length > 0 && bindings[0].description ? bindings[0].description.value : null;
  } catch (error) {
    console.error('Error fetching resource description:', error);
    return null;
  }
}

/**
 * Fetch resources related to a specific URI
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of related resource URIs
 */
async function fetchRelatedResources(uri) {
  if (isSystemResource(uri)) return [];
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?related WHERE {
        { <${safeUri}> ?p ?related . FILTER(ISURI(?related)) }
        UNION
        { ?related ?p <${safeUri}> . FILTER(ISURI(?related)) }
      }
      LIMIT 10
    `;
    
    const data = await executeQuery(query);
    const bindings = data.results.bindings || [];
    const relatedUris = bindings.map(binding => binding.related.value);
    return relatedUris.filter(uri => !isSystemResource(uri));
  } catch (error) {
    console.error('Error fetching related resources:', error);
    return [];
  }
}

/**
 * Fetch all categories from the repository
 * @returns {Promise<Array>} - Array of category URIs
 */
async function fetchCategories() {
  try {
    const query = `
      SELECT DISTINCT ?category WHERE {
        ?s a ?category .
      }
      ORDER BY ?category
      LIMIT 100
    `;
    
    const data = await executeQuery(query);
    const bindings = data.results.bindings || [];
    const categories = bindings.map(binding => binding.category.value);
    return categories.filter(category => !isSystemResource(category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

/**
 * Fetch resources belonging to a specific category
 * @param {string} category - Category URI
 * @returns {Promise<Array>} - Array of resource URIs
 */
async function fetchResourcesByCategory(category) {
  if (isSystemResource(category)) return [];
  
  try {
    const safeCategory = sanitizeSparqlString(category);
    const query = `
      SELECT DISTINCT ?resource WHERE {
        ?resource a <${safeCategory}> .
      }
      ORDER BY ?resource
      LIMIT 100
    `;
    
    const data = await executeQuery(query);
    const bindings = data.results.bindings || [];
    const resources = bindings.map(binding => binding.resource.value);
    return resources.filter(resource => !isSystemResource(resource));
  } catch (error) {
    console.error('Error fetching resources by category:', error);
    return [];
  }
}

/**
 * Search for resources matching a search term
 * @param {string} searchTerm - Term to search for
 * @returns {Promise<Array>} - Array of matching resource URIs
 */
async function searchResources(searchTerm) {
  try {
    const safeSearchTerm = sanitizeSparqlString(searchTerm);
    
    const query = `
      SELECT DISTINCT ?resource WHERE {
        {
          ?resource ?p ?o .
          FILTER(ISURI(?resource))
          FILTER(CONTAINS(LCASE(STR(?o)), LCASE("${safeSearchTerm}")))
        }
        UNION
        {
          ?resource ?p ?o .
          FILTER(ISURI(?resource))
          FILTER(CONTAINS(LCASE(STR(?resource)), LCASE("${safeSearchTerm}")))
        }
      }
      LIMIT 50
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      throw new Error('Unexpected response structure from GraphDB');
    }
    
    // Extract resources
    let resources = [];
    data.results.bindings.forEach(binding => {
      if (binding.resource && binding.resource.value) {
        resources.push(binding.resource.value);
      }
    });
    
    // Filter system resources
    return resources.filter(resource => !isSystemResource(resource));
  } catch (error) {
    console.error('Error searching resources:', error);
    throw error;
  }
}

/**
 * Fetch resource types (rdf:type)
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of type URIs
 */
async function fetchResourceTypes(uri) {
  if (isSystemResource(uri)) return [];
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?type WHERE {
        { <${safeUri}> a ?type . }
        UNION
        { <${safeUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type . }
      } LIMIT 10
    `;
    
    const data = await executeQuery(query);
    const types = data.results.bindings.map(binding => binding.type.value)
      .filter(type => !isSystemResource(type));
    
    return types;
  } catch (error) {
    console.error('Error fetching resource types:', error);
    return [];
  }
}

/**
 * Fetch resource properties
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of property-object pairs
 */
async function fetchResourceProperties(uri) {
  if (isSystemResource(uri)) return [];
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `SELECT * WHERE { <${safeUri}> ?predicate ?object } LIMIT 100`;
    
    const data = await executeQuery(query);
    let properties = data.results.bindings || [];
    
    // Filter out system properties
    properties = properties.filter(row => {
      if (row.object?.type === 'uri' && isSystemResource(row.object.value)) return false;
      if (row.predicate?.type === 'uri' && isSystemResource(row.predicate.value)) return false;
      return true;
    });
    
    return properties;
  } catch (error) {
    console.error('Error fetching resource properties:', error);
    return [];
  }
}

module.exports = {
  executeQuery,
  fetchResourceDescription,
  fetchRelatedResources,
  fetchCategories,
  fetchResourcesByCategory,
  searchResources,
  fetchResourceTypes,
  fetchResourceProperties
};