// services/productService.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
const { isSystemResource } = require('../utils/uriUtils');
const labelService = require('./labelService');

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
            <http://www.ontologi2025.se/product#Product>,
            <http://www.ontologi2025.se/notor65#Notor65_BetaOpti>
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
          
          # Look for specific Notor65 products
          OPTIONAL {
            ?product a <http://www.ontologi2025.se/notor65#Notor65_BetaOpti> .
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
        category: binding.category?.value || '',
        isNotor: binding.product?.value?.includes('notor65') || false
      };
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Fetch products related to a specific ontology
 * @param {string} ontologyUri - URI of the ontology
 * @returns {Promise<Array>} - Array of product objects
 */
async function fetchProductsByOntology(ontologyUri) {
  try {
    console.log(`Fetching products for ontology: ${ontologyUri}`);
    const safeUri = sanitizeSparqlString(ontologyUri);
    
    const query = `
      SELECT DISTINCT ?product ?name ?description WHERE {
        # Products defined by the ontology
        {
          ?product a ?type .
          ?type <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties if available
          OPTIONAL { 
            ?product <http://schema.org/name> ?name .
          }
          OPTIONAL { 
            ?product <http://schema.org/description> ?description .
          }
          OPTIONAL {
            ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name .
          }
        }
        UNION
        {
          # Products using classes from this ontology
          ?product a ?class .
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties if available
          OPTIONAL { 
            ?product <http://schema.org/name> ?name .
          }
          OPTIONAL { 
            ?product <http://schema.org/description> ?description .
          }
          OPTIONAL {
            ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name .
          }
        }
        UNION
        {
          # Special case for Notor65 products if this is the Notor65 ontology
          ?product a <http://www.ontologi2025.se/notor65#Notor65_BetaOpti> .
          FILTER(CONTAINS(STR(<${safeUri}>), "notor65"))
          
          # Get basic properties
          OPTIONAL { 
            ?product <http://schema.org/name> ?name .
          }
          OPTIONAL { 
            ?product <http://schema.org/description> ?description .
          }
          OPTIONAL {
            ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name .
          }
        }
      }
      ORDER BY ?product
      LIMIT 100
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching products by ontology');
      return [];
    }
    
    console.log(`Found ${data.results.bindings.length} products for ontology ${ontologyUri}`);
    
    // Process results
    const products = data.results.bindings.map(binding => {
      const productUri = binding.product?.value || '';
      return {
        uri: productUri,
        name: binding.name?.value || productUri.split(/[/#]/).pop() || 'Unnamed Product',
        description: binding.description?.value || '',
        isNotor: productUri.includes('notor65')
      };
    });
    
    return products;
  } catch (error) {
    console.error(`Error fetching products for ontology ${ontologyUri}:`, error);
    return [];
  }
}

/**
 * Fetch specific Notor65 products
 * @returns {Promise<Array>} - Array of Notor65 product objects
 */
async function fetchNotorProducts() {
  try {
    console.log('Fetching Notor65 products...');
    
    const query = `
      SELECT DISTINCT ?product ?name ?articleNumber ?color ?lumen ?cct WHERE {
        ?product a <http://www.ontologi2025.se/notor65#Notor65_BetaOpti> .
        
        OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        OPTIONAL { ?product <http://www.ontologi2025.se/notor65#articleNumber> ?articleNumber . }
        OPTIONAL { ?product <http://www.ontologi2025.se/notor65#color> ?color . }
        OPTIONAL { ?product <http://www.ontologi2025.se/notor65#lumenOutput> ?lumen . }
        OPTIONAL { ?product <http://www.ontologi2025.se/notor65#cct> ?cct . }
      }
      ORDER BY ?product
      LIMIT 100
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching Notor products');
      return [];
    }
    
    console.log(`Found ${data.results.bindings.length} Notor65 products`);
    
    // Process results
    const products = data.results.bindings.map(binding => {
      const uri = binding.product?.value || '';
      const id = uri.split(/[/#]/).pop() || '';
      
      return {
        uri: uri,
        id: id,
        name: binding.name?.value || `Notor65 ${id}`,
        articleNumber: binding.articleNumber?.value || '',
        color: binding.color?.value || '',
        lumenOutput: binding.lumen?.value || '',
        cct: binding.cct?.value || ''
      };
    });
    
    return products;
  } catch (error) {
    console.error('Error fetching Notor products:', error);
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
      notor: [
        'http://www.ontologi2025.se/notor65#articleNumber',
        'http://www.ontologi2025.se/notor65#color',
        'http://www.ontologi2025.se/notor65#lumenOutput',
        'http://www.ontologi2025.se/notor65#cct'
      ]
    };
    
    // Check if it's a Notor product
    const isNotor = uri.includes('notor65');
    
    // Initialize details object
    details.name = '';
    details.description = '';
    details.category = '';
    details.price = '';
    details.image = '';
    details.isNotor = isNotor;
    details.notorProperties = {};
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
      } else if (isNotor && propertyGroups.notor.includes(property)) {
        // Handle Notor-specific properties
        if (property.includes('articleNumber')) {
          details.notorProperties.articleNumber = value.value;
        } else if (property.includes('color')) {
          details.notorProperties.color = value.value;
        } else if (property.includes('lumenOutput')) {
          details.notorProperties.lumenOutput = value.value;
        } else if (property.includes('cct')) {
          details.notorProperties.cct = value.value;
        }
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
    
    // For Notor products, set a default name if not found
    if (isNotor && !details.name) {
      const id = uri.split(/[/#]/).pop() || '';
      details.name = `Notor65 ${id}`;
    }
    
    return details;
  } catch (error) {
    console.error(`Error fetching product details for ${uri}:`, error);
    return null;
  }
}

module.exports = {
  fetchProducts,
  fetchProductsByOntology,
  fetchNotorProducts,
  fetchProductDetails
};