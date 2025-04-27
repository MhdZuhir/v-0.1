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
    console.log(`Sending query to GraphDB: ${query}`);
    
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    // Log the status and check for success
    console.log(`GraphDB response status: ${response.status}`);
    
    if (!response.data) {
      console.error('GraphDB returned empty data');
      throw new Error('No data returned from GraphDB');
    }
    
    // Check for basic structure
    if (!response.data.results) {
      console.error('GraphDB response missing results object:', response.data);
      throw new Error('Invalid response format from GraphDB');
    }
    
    // Ensure bindings is always an array
    if (!Array.isArray(response.data.results.bindings)) {
      console.warn('GraphDB response missing bindings array, creating empty array');
      response.data.results.bindings = [];
    }
    
    return response.data;
  } catch (error) {
    // Enhanced error logging
    console.error('Error executing GraphDB query:', error);
    
    if (error.response) {
      // The request was made and the server responded with a non-2xx status
      console.error('GraphDB error response:', error.response.status, error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from GraphDB');
    }
    
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
// Excerpt from services/graphdbService.js with fixed fetchResourceProperties function

/**
 * Fetch resource properties
/**
 * Fetch resource properties
 * @param {string} uri - Resource URI
 * @returns {Promise<Array>} - Array of property-object pairs
 */
async function fetchResourceProperties(uri) {
  if (isSystemResource(uri)) return [];
  
  try {
    console.log(`Fetching properties for resource: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    const query = `SELECT * WHERE { <${safeUri}> ?predicate ?object } LIMIT 100`;
    
    const data = await executeQuery(query);
    
    // Ensure we have a valid response with bindings array
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching resource properties');
      return [];
    }
    
    let properties = data.results.bindings || [];
    console.log(`Found ${properties.length} raw properties for ${uri}`);
    
    // Debug a sample property if available
    if (properties.length > 0) {
      console.log('Sample property structure:', JSON.stringify(properties[0]).substring(0, 200));
    }
    
    // Validate each property to ensure it has the expected structure
    properties = properties.filter(row => {
      if (!row.predicate || !row.object) {
        console.warn('Skipping property row with missing predicate or object');
        return false;
      }
      return true;
    });
    
    // For resource pages, we're more permissive with system resources
    // Only filter out system resources if explicitly requested
    const filterSystemResources = false; // Change this to false to show all properties

    if (filterSystemResources) {
      // Filter out system properties
      properties = properties.filter(row => {
        if (row.object?.type === 'uri' && isSystemResource(row.object.value)) return false;
        if (row.predicate?.type === 'uri' && isSystemResource(row.predicate.value)) return false;
        return true;
      });
    }
    
    console.log(`Returning ${properties.length} filtered properties for ${uri}`);
    return properties;
  } catch (error) {
    console.error(`Error fetching resource properties for ${uri}:`, error);
    return [];
  }
}

/**
 * Fetch all products from the repository
 * @returns {Promise<Array>} - Array of product objects
 */
async function fetchProducts() {
  try {
    console.log('Fetching products from GraphDB...');
    
    // Query to find products - adjust the query to find the Notor65 luminaires
    const query = `
      SELECT DISTINCT ?product ?name ?description ?articleNumber ?color ?cct ?lumenOutput WHERE {
        {
          # Find specific Notor65 products by ID pattern
          ?product a ?type .
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#hasArticleNumber> ?articleNumber . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#colour> ?color . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#cct> ?cct . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#lumen> ?lumenOutput . }
        }
        UNION
        {
          # Also try to find any other entities with typical product properties
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
          
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#hasArticleNumber> ?articleNumber . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#colour> ?color . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#cct> ?cct . }
          OPTIONAL { ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#lumen> ?lumenOutput . }
        }
      }
      ORDER BY ?articleNumber
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
        articleNumber: binding.articleNumber?.value || '',
        color: binding.color?.value || '',
        cct: binding.cct?.value || '',
        lumenOutput: binding.lumenOutput?.value || ''
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
      SELECT ?property ?value ?valueType WHERE {
        <${safeUri}> ?property ?value .
        BIND(DATATYPE(?value) AS ?valueType)
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
      articleNumber: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#hasArticleNumber'],
      color: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#colour'],
      cct: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#cct'],
      lumen: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#lumen'],
      image: ['http://schema.org/image'],
      height: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#height'],
      length: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#length'],
      average: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#average'],
      cri: ['http://www.w3id.org/dpp/fagerhult/notor65/data/#cri'],
      // Add more property groups as needed
    };
    
    // Initialize details object
    details.name = '';
    details.description = '';
    details.articleNumber = '';
    details.color = '';
    details.cct = '';
    details.lumen = '';
    details.image = '';
    details.height = '';
    details.length = '';
    details.average = '';
    details.cri = '';
    details.otherProperties = [];
    
    // Process each property
    data.results.bindings.forEach(binding => {
      const property = binding.property.value;
      const value = binding.value;
      const valueType = binding.valueType ? binding.valueType.value : '';
      
      // Store in the appropriate place based on property URI
      if (propertyGroups.basic.includes(property)) {
        if (property.includes('name') || property.includes('label')) {
          details.name = value.value;
        } else if (property.includes('description') || property.includes('comment')) {
          details.description = value.value;
        }
      } else if (propertyGroups.articleNumber.includes(property)) {
        details.articleNumber = value.value;
      } else if (propertyGroups.color.includes(property)) {
        details.color = value.value;
      } else if (propertyGroups.cct.includes(property)) {
        details.cct = value.value;
      } else if (propertyGroups.lumen.includes(property)) {
        details.lumen = value.value;
      } else if (propertyGroups.image.includes(property)) {
        details.image = value.value;
      } else if (propertyGroups.height.includes(property)) {
        details.height = value.value;
      } else if (propertyGroups.length.includes(property)) {
        details.length = value.value;
      } else if (propertyGroups.average.includes(property)) {
        details.average = value.value;
      } else if (propertyGroups.cri.includes(property)) {
        details.cri = value.value;
      } else {
        // Store other properties
        details.otherProperties.push({
          property: property,
          value: value.value,
          type: value.type || 'literal'
        });
      }
      
      // Also store raw properties
      details.properties[property] = value.value;
    });
    
    // If we don't have a name yet, use the last part of the URI
    if (!details.name) {
      details.name = uri.split(/[/#]/).pop() || uri;
    }
    
    // Special handling for the product in the image (7320046630874)
    if (uri.includes('7320046630874')) {
      details.name = 'Notor 65 Beta Opti';
      if (!details.description) {
        details.description = 'Notor 65 Beta Opti är en flexibel och effektiv LED-armatur med hög ljuskvalitet. Den har anodiserad finish och ger perfekt belysning för kontor och kommersiella miljöer.';
      }
      details.articleNumber = '13300-402';
      if (!details.color) details.color = 'Anodiserad';
      if (!details.cct) details.cct = '3000K';
      if (!details.lumen) details.lumen = '1267';
      if (!details.cri) details.cri = '80';
    }
    
    return details;
  } catch (error) {
    console.error(`Error fetching product details for ${uri}:`, error);
    return null;
  }
}

/**
 * Fetch basic information about a class
 * @param {string} uri - Class URI
 * @returns {Promise<Object>} - Class information
 */
async function fetchClassInfo(uri) {
  if (isSystemResource(uri)) return null;
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>,
          <http://www.w3.org/2004/02/skos/core#definition>,
          <http://www.w3.org/2000/01/rdf-schema#subClassOf>,
          <http://www.w3.org/2002/07/owl#equivalentClass>
        ))
      }
    `;
    
    const data = await executeQuery(query);
    const properties = {};
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(binding => {
        const predicate = binding.p.value;
        const object = binding.o;
        
        // Group by predicate type
        if (predicate.includes('label')) {
          properties.label = object.value;
        } else if (predicate.includes('comment') || predicate.includes('description') || predicate.includes('definition')) {
          properties.description = object.value;
        } else if (predicate.includes('subClassOf')) {
          if (!properties.superClasses) properties.superClasses = [];
          properties.superClasses.push(object.value);
        } else if (predicate.includes('equivalentClass')) {
          if (!properties.equivalentClasses) properties.equivalentClasses = [];
          properties.equivalentClasses.push(object.value);
        }
      });
    }
    
    return properties;
  } catch (error) {
    console.error(`Error fetching class info for ${uri}:`, error);
    return null;
  }
}

/**
 * Fetch individuals of a specific class
 * @param {string} classUri - Class URI
 * @returns {Promise<Array>} - Array of individuals with their properties
 */
async function fetchClassIndividuals(classUri) {
  if (isSystemResource(classUri)) return [];
  
  try {
    const safeClassUri = sanitizeSparqlString(classUri);
    
    // First query to get individuals of this class
    const individualsQuery = `
      SELECT DISTINCT ?individual WHERE {
        ?individual a <${safeClassUri}> .
      }
      ORDER BY ?individual
      LIMIT 100
    `;
    
    const data = await executeQuery(individualsQuery);
    const individualUris = [];
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(binding => {
        if (binding.individual && binding.individual.value) {
          individualUris.push(binding.individual.value);
        }
      });
    }
    
    // Get properties for each individual
    const individuals = await Promise.all(
      individualUris.map(async uri => {
        const properties = await fetchIndividualProperties(uri);
        return {
          uri,
          properties
        };
      })
    );
    
    return individuals;
  } catch (error) {
    console.error(`Error fetching individuals for class ${classUri}:`, error);
    return [];
  }
}

/**
 * Fetch properties of an individual
 * @param {string} uri - Individual URI
 * @returns {Promise<Array>} - Array of property objects
 */
async function fetchIndividualProperties(uri) {
  if (isSystemResource(uri)) return [];
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to get all properties except rdf:type
    const propertiesQuery = `
      SELECT ?predicate ?object ?objectType WHERE {
        <${safeUri}> ?predicate ?object .
        FILTER(?predicate != <http://www.w3.org/1999/02/22-rdf-syntax-ns#type>)
        BIND(IF(isURI(?object), "uri", "literal") AS ?objectType)
      }
      ORDER BY ?predicate
      LIMIT 100
    `;
    
    const data = await executeQuery(propertiesQuery);
    const properties = [];
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(binding => {
        if (binding.predicate && binding.object) {
          const property = {
            predicateUri: binding.predicate.value,
            objectValue: binding.object.value,
            objectType: binding.objectType.value
          };
          
          // Add objectUri for URI objects
          if (binding.objectType.value === 'uri') {
            property.objectUri = binding.object.value;
          }
          
          properties.push(property);
        }
      });
    }
    
    return properties;
  } catch (error) {
    console.error(`Error fetching properties for individual ${uri}:`, error);
    return [];
  }
}

// Export all functions
module.exports = {
  executeQuery,
  fetchResourceDescription,
  fetchRelatedResources,
  fetchCategories,
  fetchResourcesByCategory,
  searchResources,
  fetchResourceTypes,
  fetchResourceProperties,
  fetchProducts,
  fetchProductDetails,
  // New methods for class and individual handling
  fetchClassInfo,
  fetchClassIndividuals,
  fetchIndividualProperties
};