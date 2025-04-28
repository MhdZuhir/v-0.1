// services/graphdbService.js - Fixed version
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
  if (!uri) return null;
  
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
  if (!uri) return [];
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?related WHERE {
        { <${safeUri}> ?p ?related . FILTER(ISURI(?related)) }
        UNION
        { ?related ?p <${safeUri}> . FILTER(ISURI(?related)) }
        FILTER(?related != <${safeUri}>)
      }
      LIMIT 10
    `;
    
    const data = await executeQuery(query);
    const bindings = data.results.bindings || [];
    let relatedUris = bindings.map(binding => binding.related.value);
    
    // Filter out system resources if needed, but keep key RDF/OWL resources
    relatedUris = relatedUris.filter(uri => {
      // Always allow these important resources
      if (uri.includes('/Property') || 
          uri.includes('/Class') || 
          uri.includes('/Resource') || 
          uri.includes('/Literal')) {
        return true;
      }
      
      return !isSystemResource(uri);
    });
    
    return relatedUris;
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
  if (!category) return [];
  
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
    
    // Filter system resources, but keep important ones
    return resources.filter(resource => {
      // Always allow these important resources
      if (resource.includes('/Property') || 
          resource.includes('/Class') || 
          resource.includes('/Resource') || 
          resource.includes('/Literal')) {
        return true;
      }
      
      return !isSystemResource(resource);
    });
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
  if (!uri) return [];
  
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
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.warn('Unexpected response format when fetching resource types');
      return [];
    }
    
    const types = data.results.bindings.map(binding => binding.type.value);
    
    // Special case handling for core RDF terms
    if (types.length === 0) {
      // Add the appropriate type for core RDF/RDFS resources
      const coreType = getCoreRdfResourceType(uri);
      if (coreType) {
        return [coreType];
      }
    }
    
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
  if (!uri) return [];
  
  try {
    console.log(`Fetching properties for resource: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Enhanced query that works better for all resource types
    const query = `
      SELECT ?predicate ?object WHERE {
        <${safeUri}> ?predicate ?object .
      }
      LIMIT 200
    `;
    
    const data = await executeQuery(query);
    
    // Ensure we have a valid response with bindings array
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching resource properties');
      return [];
    }
    
    let properties = data.results.bindings || [];
    console.log(`Found ${properties.length} raw properties for ${uri}`);
    
    // Special handling for core RDF/RDFS/OWL terms that might be missing from the database
    if (properties.length === 0) {
      properties = getCoreRdfResourceProperties(uri);
      
      if (properties.length > 0) {
        console.log(`Added hardcoded information for ${uri}`);
      }
    }
    
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
    
    console.log(`Returning ${properties.length} filtered properties for ${uri}`);
    return properties;
  } catch (error) {
    console.error(`Error fetching resource properties for ${uri}:`, error);
    return [];
  }
}

/**
 * Get hardcoded properties for core RDF/RDFS/OWL resources
 * @param {string} uri - Resource URI
 * @returns {Array} - Array of property-object pairs
 */
function getCoreRdfResourceProperties(uri) {
  // This function provides hardcoded information for important RDF/RDFS resources
  // that may not be explicitly defined in the database
  switch (uri) {
    case 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property':
      return [
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#label' },
          object: { type: 'literal', value: 'Property' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#comment' },
          object: { type: 'literal', value: 'The class of RDF properties.' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy' },
          object: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' }
        }
      ];
    
    case 'http://www.w3.org/2000/01/rdf-schema#Literal':
      return [
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#label' },
          object: { type: 'literal', value: 'Literal' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#comment' },
          object: { type: 'literal', value: 'The class of literal values, e.g. textual strings and integers. Properties with literal values use rdfs:Literal as their range.' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#subClassOf' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Resource' }
        }
      ];
    
    case 'http://www.w3.org/2000/01/rdf-schema#Class':
      return [
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#label' },
          object: { type: 'literal', value: 'Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#comment' },
          object: { type: 'literal', value: 'The class of classes.' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#subClassOf' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Resource' }
        }
      ];
    
    case 'http://www.w3.org/2000/01/rdf-schema#Resource':
      return [
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#label' },
          object: { type: 'literal', value: 'Resource' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#comment' },
          object: { type: 'literal', value: 'The class of everything. All other classes are subclasses of this class.' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#' }
        }
      ];
      
    case 'http://www.w3.org/2002/07/owl#Class':
      return [
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#label' },
          object: { type: 'literal', value: 'Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#comment' },
          object: { type: 'literal', value: 'The class of OWL classes.' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Class' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#isDefinedBy' },
          object: { type: 'uri', value: 'http://www.w3.org/2002/07/owl#' }
        },
        {
          predicate: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#subClassOf' },
          object: { type: 'uri', value: 'http://www.w3.org/2000/01/rdf-schema#Class' }
        }
      ];
      
    default:
      return [];
  }
}

/**
 * Get the type for core RDF/RDFS/OWL resources
 * @param {string} uri - Resource URI
 * @returns {string|null} - Type URI or null
 */
function getCoreRdfResourceType(uri) {
  switch (uri) {
    case 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property':
    case 'http://www.w3.org/2000/01/rdf-schema#Literal':
    case 'http://www.w3.org/2000/01/rdf-schema#Class':
    case 'http://www.w3.org/2000/01/rdf-schema#Resource':
    case 'http://www.w3.org/2002/07/owl#Class':
      return 'http://www.w3.org/2000/01/rdf-schema#Class';
    
    case 'http://www.w3.org/2002/07/owl#ObjectProperty':
    case 'http://www.w3.org/2002/07/owl#DatatypeProperty':
      return 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';
    
    default:
      return null;
  }
}

/**
 * Fetch basic information about a class
 * @param {string} uri - Class URI
 * @returns {Promise<Object>} - Class information
 */
async function fetchClassInfo(uri) {
  if (!uri) return null;
  
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
    
    // For standard RDF/RDFS classes, add hardcoded information if nothing was found
    if (Object.keys(properties).length === 0) {
      const coreProps = getCoreRdfResourceProperties(uri);
      
      coreProps.forEach(prop => {
        const predicate = prop.predicate.value;
        const value = prop.object.value;
        
        if (predicate.includes('label')) {
          properties.label = value;
        } else if (predicate.includes('comment')) {
          properties.description = value;
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
  if (!classUri) return [];
  
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
  if (!uri) return [];
  
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

module.exports = {
  executeQuery,
  fetchResourceDescription,
  fetchRelatedResources,
  fetchCategories,
  fetchResourcesByCategory,
  searchResources,
  fetchResourceTypes,
  fetchResourceProperties,
  // Class and individual methods
  fetchClassInfo,
  fetchClassIndividuals,
  fetchIndividualProperties
};