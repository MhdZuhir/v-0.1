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
// Modified services/graphdbService.js
// Add this new function to fetch products

/**
 * Fetch all products from the repository
 * @returns {Promise<Array>} - Array of product objects
 */
async function fetchProducts() {
  try {
    console.log('Fetching products from GraphDB...');
    
    // Query to find products - adjust the product class URI based on your data model
    // This example assumes products have a type/class of 'Product' or similar
    const query = `
      SELECT DISTINCT ?product ?name ?description ?category WHERE {
        {
          # Find entities with common product properties
          ?product a ?type .
          FILTER(?type IN (
            <http://schema.org/Product>, 
            <http://purl.org/goodrelations/v1#ProductOrService>,
            <http://www.w3.org/ns/prov#Entity>,
            <http://www.ontologi2025.se/product#Product>
          ))
          
          # Get basic properties if available
          OPTIONAL { 
            ?product <http://schema.org/name> ?name .
          }
          OPTIONAL { 
            ?product <http://schema.org/description> ?description .
          }
          OPTIONAL { 
            ?product <http://schema.org/category> ?category .
          }
        }
        UNION
        {
          # Alternative approach - find entities with typical product properties
          ?product ?nameProperty ?name .
          FILTER(?nameProperty IN (
            <http://schema.org/name>,
            <http://purl.org/dc/terms/title>,
            <http://www.w3.org/2000/01/rdf-schema#label>
          ))
          
          OPTIONAL {
            ?product ?descProperty ?description .
            FILTER(?descProperty IN (
              <http://schema.org/description>,
              <http://purl.org/dc/terms/description>,
              <http://www.w3.org/2000/01/rdf-schema#comment>
            ))
          }
          
          OPTIONAL {
            ?product ?catProperty ?category .
            FILTER(?catProperty IN (
              <http://schema.org/category>,
              <http://purl.org/dc/terms/subject>
            ))
          }
        }
      }
      ORDER BY ?product
      LIMIT 100
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching products');
      return [];
    }
    
    console.log(`Found ${data.results.bindings.length} potential products`);
    
    // Process results
    const products = data.results.bindings.map(binding => {
      return {
        uri: binding.product?.value || '',
        name: binding.name?.value || binding.product?.value?.split(/[/#]/).pop() || 'Unnamed Product',
        description: binding.description?.value || '',
        category: binding.category?.value || ''
      };
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Fetch detailed product information
 * @param {string} uri - Product URI
 * @returns {Promise<Object>} - Product details
 */
async function fetchProductDetails(uri) {
  if (!uri) return null;
  
  try {
    console.log(`Fetching details for product: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to get all properties of the product
    const query = `
      SELECT ?property ?value WHERE {
        <${safeUri}> ?property ?value .
      }
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching product details');
      return null;
    }
    
    // Transform into a more usable structure
    const details = {
      uri: uri,
      properties: {}
    };
    
    // Group known property types
    const propertyGroups = {
      basic: ['http://schema.org/name', 'http://schema.org/description', 'http://www.w3.org/2000/01/rdf-schema#label'],
      category: ['http://schema.org/category', 'http://purl.org/dc/terms/subject'],
      price: ['http://schema.org/price', 'http://purl.org/goodrelations/v1#hasPriceSpecification'],
      image: ['http://schema.org/image'],
      // Add more property groups as needed
    };
    
    // Initialize details object
    details.name = '';
    details.description = '';
    details.category = '';
    details.price = '';
    details.image = '';
    details.otherProperties = [];
    
    // Process each property
    data.results.bindings.forEach(binding => {
      const property = binding.property.value;
      const value = binding.value;
      
      // Store in the appropriate place based on property URI
      if (propertyGroups.basic.includes(property)) {
        if (property.includes('name') || property.includes('label')) {
          details.name = value.value;
        } else if (property.includes('description')) {
          details.description = value.value;
        }
      } else if (propertyGroups.category.includes(property)) {
        details.category = value.value;
      } else if (propertyGroups.price.includes(property)) {
        details.price = value.value;
      } else if (propertyGroups.image.includes(property)) {
        details.image = value.value;
      } else {
        // Store other properties
        details.otherProperties.push({
          property: property,
          value: value.value,
          type: value.type
        });
      }
      
      // Also store raw properties
      details.properties[property] = value.value;
    });
    
    // If we don't have a name yet, use the last part of the URI
    if (!details.name) {
      details.name = uri.split(/[/#]/).pop() || uri;
    }
    
    return details;
  } catch (error) {
    console.error(`Error fetching product details for ${uri}:`, error);
    return null;
  }
}

// Export the new functions
module.exports = {
  // ... existing exports
  fetchProducts,
  fetchProductDetails
};

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