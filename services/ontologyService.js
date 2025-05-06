<<<<<<< HEAD
<<<<<<< HEAD
// services/ontologyService.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
const graphdbClient = require('../utils/graphdbClient');
const { generateOntologyDescription } = require('../utils/descriptionUtils');

/**
 * Fetch all ontologies from the repository
 * @returns {Promise<Array>} - Array of ontology objects
 */
async function fetchOntologies() {
  try {
    console.log('Fetching ontologies from GraphDB...');
    
    // Query to find all ontologies
    const query = `
      SELECT DISTINCT ?uri WHERE {
        {
          # Find explicit ontologies
          ?uri a <http://www.w3.org/2002/07/owl#Ontology> .
        }
        UNION
        {
          # Also find resources that have properties typically used by ontologies
          ?uri ?p ?o .
          FILTER(?p IN (
            <http://www.w3.org/2002/07/owl#imports>,
            <http://purl.org/dc/terms/title>,
            <http://purl.org/dc/elements/1.1/title>,
            <http://www.w3.org/2000/01/rdf-schema#label>
          ))
          # Ensure it's an ontology-like resource
          FILTER(CONTAINS(STR(?uri), "ontology") || REGEX(STR(?uri), "/ont[/#]"))
        }
      }
      ORDER BY ?uri
      LIMIT 100
    `;
    
    const response = await graphdbClient.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      console.error('Unexpected response structure from GraphDB');
      return [];
    }
    
    console.log(`Found ${response.results.bindings.length} potential ontologies`);
    
    // Fetch additional metadata for each ontology (in parallel)
    const ontologies = await Promise.all(
      response.results.bindings
        .filter(binding => binding.uri && binding.uri.value)
        .map(async binding => {
          const uri = binding.uri.value;
          try {
            // Get detailed metadata
            const metadata = await fetchOntologyMetadata(uri);
            
            // Get statistics
            const stats = await getOntologyStats(uri);
            
            return {
              uri,
              title: metadata.title || uri.split(/[/#]/).pop() || uri,
              description: metadata.description || generateOntologyDescription(uri),
              stats
            };
          } catch (err) {
            console.error(`Error fetching metadata for ontology ${uri}:`, err.message);
            return {
              uri,
              title: uri.split(/[/#]/).pop() || uri,
              description: generateOntologyDescription(uri),
              stats: { classes: 0, properties: 0, individuals: 0 }
            };
          }
        })
    );
    
    // Sort ontologies alphabetically by title
    ontologies.sort((a, b) => a.title.localeCompare(b.title));
    
    return ontologies;
  } catch (error) {
    console.error('Error fetching ontologies:', error);
    return [];
  }
}

/**
 * Fetch metadata for a specific ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Ontology metadata
 */
async function fetchOntologyMetadata(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to fetch ontology metadata
    const query = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://purl.org/dc/terms/title>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>,
          <http://www.w3.org/2002/07/owl#versionInfo>,
          <http://purl.org/dc/terms/created>,
          <http://purl.org/dc/terms/modified>,
          <http://www.w3.org/2002/07/owl#imports>
        ))
      }
    `;
    
    const response = await graphdbClient.executeQuery(query);
    
    // Create metadata object
    const metadata = {
      uri,
      title: null,
      description: null,
      version: null,
      created: null,
      modified: null,
      imports: []
    };
    
    if (response && response.results && response.results.bindings) {
      response.results.bindings.forEach(binding => {
        const predicate = binding.p.value;
        const value = binding.o.value;
        
        // Extract relevant information
        if (predicate.includes('label') || predicate.includes('title')) {
          metadata.title = value;
        } else if (predicate.includes('comment') || predicate.includes('description')) {
          metadata.description = value;
        } else if (predicate.includes('versionInfo')) {
          metadata.version = value;
        } else if (predicate.includes('created')) {
          metadata.created = value;
        } else if (predicate.includes('modified')) {
          metadata.modified = value;
        } else if (predicate.includes('imports')) {
          metadata.imports.push(value);
        }
      });
    }
    
    // If title is still not available, use the last part of the URI
    if (!metadata.title) {
      const lastPart = uri.split(/[/#]/).pop();
      metadata.title = lastPart || uri;
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ontology ${uri}:`, error);
    throw error;
  }
}

/**
 * Get statistics for an ontology (classes, properties, individuals)
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Ontology statistics
 */
async function getOntologyStats(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to count classes defined in this ontology
    const classesQuery = `
      SELECT (COUNT(DISTINCT ?class) AS ?count) WHERE {
        {
          ?class a <http://www.w3.org/2002/07/owl#Class> .
          {
            ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          }
        } UNION {
          ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
          {
            ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          }
        }
      }
    `;
    
    // Query to count properties defined in this ontology
    const propertiesQuery = `
      SELECT (COUNT(DISTINCT ?property) AS ?count) WHERE {
        {
          ?property a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> .
          {
            ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?property), STR(<${safeUri}>)))
          }
        } UNION {
          ?property a <http://www.w3.org/2002/07/owl#ObjectProperty> .
          {
            ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?property), STR(<${safeUri}>)))
          }
        } UNION {
          ?property a <http://www.w3.org/2002/07/owl#DatatypeProperty> .
          {
            ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?property), STR(<${safeUri}>)))
          }
        }
      }
    `;
    
    // Query to count individuals defined in this ontology
    const individualsQuery = `
      SELECT (COUNT(DISTINCT ?individual) AS ?count) WHERE {
        ?individual a ?type .
        FILTER(!(?type IN (
          <http://www.w3.org/2002/07/owl#Class>, 
          <http://www.w3.org/2000/01/rdf-schema#Class>,
          <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>,
          <http://www.w3.org/2002/07/owl#ObjectProperty>,
          <http://www.w3.org/2002/07/owl#DatatypeProperty>
        )))
        {
          ?individual <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        } UNION {
          FILTER(STRSTARTS(STR(?individual), STR(<${safeUri}>)))
        }
      }
    `;
    
    // Execute all queries in parallel
    const [classesResponse, propertiesResponse, individualsResponse] = await Promise.all([
      graphdbClient.executeQuery(classesQuery),
      graphdbClient.executeQuery(propertiesQuery),
      graphdbClient.executeQuery(individualsQuery)
    ]);
    
    // Extract counts
    let classCount = 0;
    let propertyCount = 0;
    let individualCount = 0;
    
    if (classesResponse?.results?.bindings?.length > 0) {
      classCount = parseInt(classesResponse.results.bindings[0].count?.value, 10) || 0;
    }
    
    if (propertiesResponse?.results?.bindings?.length > 0) {
      propertyCount = parseInt(propertiesResponse.results.bindings[0].count?.value, 10) || 0;
    }
    
    if (individualsResponse?.results?.bindings?.length > 0) {
      individualCount = parseInt(individualsResponse.results.bindings[0].count?.value, 10) || 0;
    }
    
    return {
      classes: classCount,
      properties: propertyCount,
      individuals: individualCount
    };
  } catch (error) {
    console.error(`Error getting stats for ontology ${uri}:`, error);
    return {
      classes: 0,
      properties: 0,
      individuals: 0
    };
  }
}

/**
 * Get download URL for an ontology
 * @param {string} uri - Ontology URI
 * @param {string} format - Format MIME type
 * @returns {string} - Download URL
 */
function getDownloadUrl(uri, format) {
  return graphdbClient.getDownloadUrl(uri, format);
}

/**
 * Fetch products for a specific ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of product objects
 */
async function fetchProductsForOntology(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to find products related to this ontology
    const query = `
      SELECT DISTINCT ?product ?name ?description ?type WHERE {
        {
          # Find products directly defined in this ontology
          ?product a ?type .
          FILTER(?type IN (
            <http://schema.org/Product>, 
            <http://purl.org/goodrelations/v1#ProductOrService>
          ))
          {
            ?product <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?product), STR(<${safeUri}>)))
          }
          
          # Get basic properties
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
        }
        UNION
        {
          # Also find products that use concepts from this ontology
          ?product a ?type .
          FILTER(?type IN (
            <http://schema.org/Product>, 
            <http://purl.org/goodrelations/v1#ProductOrService>
          ))
          
          # Find products that reference resources from this ontology
          ?product ?p ?o .
          ?o <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
        }
      }
      LIMIT 50
    `;
    
    const response = await graphdbClient.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      console.error('Unexpected response structure from GraphDB');
      return [];
    }
    
    // Process results
    const products = response.results.bindings.map(binding => {
      return {
        uri: binding.product?.value || '',
        name: binding.name?.value || binding.product?.value?.split(/[/#]/).pop() || 'Unnamed Product',
        description: binding.description?.value || '',
        type: binding.type?.value || ''
      };
    });
    
    return products;
  } catch (error) {
    console.error(`Error fetching products for ontology ${uri}:`, error);
    return [];
  }
}

/**
 * Fetch namespaces used in an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of namespace strings
 */
async function fetchOntologyNamespaces(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to find all namespaces used in the ontology
    const query = `
      SELECT DISTINCT ?namespace WHERE {
        {
          # Find classes and their namespaces
          ?class a <http://www.w3.org/2002/07/owl#Class> .
          {
            ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          }
          BIND(REPLACE(STR(?class), "^(.*[/#])[^/#]*$", "$1") AS ?namespace)
        }
        UNION
        {
          # Find properties and their namespaces
          ?property a ?propType .
          FILTER(?propType IN (
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>,
            <http://www.w3.org/2002/07/owl#ObjectProperty>,
            <http://www.w3.org/2002/07/owl#DatatypeProperty>
          ))
          {
            ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?property), STR(<${safeUri}>)))
          }
          BIND(REPLACE(STR(?property), "^(.*[/#])[^/#]*$", "$1") AS ?namespace)
        }
      }
      ORDER BY ?namespace
    `;
    
    const response = await graphdbClient.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      console.error('Unexpected response structure from GraphDB');
      return [];
    }
    
    // Extract namespaces
    const namespaces = response.results.bindings
      .filter(binding => binding.namespace && binding.namespace.value)
      .map(binding => binding.namespace.value);
    
    // Always add the ontology's own namespace
    if (!namespaces.includes(uri)) {
      namespaces.push(uri);
    }
    
    return [...new Set(namespaces)]; // Remove duplicates
  } catch (error) {
    console.error(`Error fetching namespaces for ontology ${uri}:`, error);
    return [uri]; // Return at least the ontology's own namespace
  }
}

/**
 * Fetch classes defined in an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of class objects
 */
async function fetchOntologyClasses(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to find classes defined in this ontology
    const query = `
      SELECT DISTINCT ?class ?label ?description WHERE {
        {
          ?class a <http://www.w3.org/2002/07/owl#Class> .
          {
            ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          }
        } UNION {
          ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
          {
            ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          } UNION {
            FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          }
        }
        
        # Get label and description if available
        OPTIONAL {
          ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label .
        }
        OPTIONAL {
          ?class ?descProp ?description .
          FILTER(?descProp IN (
            <http://www.w3.org/2000/01/rdf-schema#comment>,
            <http://purl.org/dc/terms/description>,
            <http://purl.org/dc/elements/1.1/description>
          ))
        }
      }
      ORDER BY ?class
      LIMIT 100
    `;
    
    const response = await graphdbClient.executeQuery(query);
    
    if (!response || !response.results || !Array.isArray(response.results.bindings)) {
      console.error('Unexpected response structure from GraphDB');
      return [];
    }
    
    // Process results
    const classes = response.results.bindings.map(binding => {
      return {
        uri: binding.class?.value || '',
        label: binding.label?.value || binding.class?.value?.split(/[/#]/).pop() || '',
        description: binding.description?.value || ''
      };
    });
    
    return classes;
  } catch (error) {
    console.error(`Error fetching classes for ontology ${uri}:`, error);
    return [];
  }
}

/**
 * Fetch minimal metadata for a related ontology (avoids full metadata fetch)
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Basic ontology metadata
 */
async function fetchMinimalOntologyMetadata(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Simplified query to just get title and description
    const query = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://purl.org/dc/terms/title>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>
        ))
      }
      LIMIT 5
    `;
    
    const data = await graphdbClient.executeQuery(query);
    const metadata = {
      title: null,
      description: null
    };
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(result => {
        const predicate = result.p.value;
        const value = result.o.value;
        
        if (predicate.includes('label') || predicate.includes('title')) {
          metadata.title = value;
        } else if (predicate.includes('comment') || predicate.includes('description')) {
          metadata.description = value;
        }
      });
    }
    
    // If title is still not found, use the last part of the URI
    if (!metadata.title) {
      const uriParts = uri.split(/[/#]/);
      metadata.title = uriParts[uriParts.length - 1] || uri;
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching minimal metadata for ontology ${uri}:`, error);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: null
    };
  }
}
// services/ontologyService.js - Fixed version
const graphdbClient = require('../utils/graphdbClient');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
const { generateOntologyDescription } = require('../utils/descriptionUtils')
 parent of b008243 (g)
// Add the new fetchRelatedOntologies function to the ontologyService.js file
parent of 0cf6365 (fixat)

/**
 * Fetch all ontologies from the repository
 * @returns {Promise<Array>} - Array of ontology objects
 */
async function fetchOntologies() {
  try {
    // Improved query to find all ontology IRIs with better UNION structure
    const query = `
      SELECT DISTINCT ?ontology WHERE {
        {
          ?ontology a <http://www.w3.org/2002/07/owl#Ontology> .
        } 
        UNION 
        {
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> ?ontology .
        } 
        UNION 
        {
          ?s <http://www.w3.org/2002/07/owl#imports> ?ontology .
        }
      }
      ORDER BY ?ontology
    `;
    
    console.log('Fetching all ontologies...');
    const data = await graphdbClient.executeQuery(query);
    
    if (!data || !data.results || !data.results.bindings) {
      console.error('Unexpected response format when fetching ontologies:', JSON.stringify(data).substring(0, 500));
      return [];
    }
    
    console.log(`Found ${data.results.bindings.length} ontologies`);
    const ontologyUris = data.results.bindings
      .filter(binding => binding.ontology && binding.ontology.value)
      .map(binding => binding.ontology.value);
    
    // Get metadata for each ontology using Promise.all for parallel processing
    // but with a limit to prevent overwhelming the server
    const results = [];
    const batchSize = 5; // Process 5 ontologies at a time
    
    for (let i = 0; i < ontologyUris.length; i += batchSize) {
      const batch = ontologyUris.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async uri => {
          try {
            const metadata = await fetchOntologyMetadata(uri);
            return {
              uri,
              ...metadata
            };
          } catch (err) {
            console.error(`Error fetching metadata for ${uri}:`, err.message);
            return {
              uri,
              title: uri.split(/[/#]/).pop() || uri,
              description: generateOntologyDescription(uri),
              error: true,
              stats: { classes: 0, properties: 0, individuals: 0 }
            };
          }
        })
      );
      
      results.push(...batchResults);
    }
    
    console.log(`Successfully processed ${results.length} ontologies`);
    return results;
  } catch (error) {
    console.error('Error fetching ontologies:', error.message);
    return [];
  }
}


/**
 * Fetch metadata for a specific ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Ontology metadata
 */
async function fetchOntologyMetadata(uri) {
  try {
    console.log(`Fetching metadata for ontology: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Expanded query to capture more description predicates
    const query = `
      SELECT ?p ?o ?lang WHERE {
        <${safeUri}> ?p ?o .
        OPTIONAL { 
          BIND(LANG(?o) AS ?lang) 
        }
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/title>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>,
          <http://www.w3.org/2004/02/skos/core#definition>,
          <http://www.w3.org/ns/prov#description>,
          <http://schema.org/description>,
          <http://purl.org/vocab/vann/description>,
          <http://purl.org/dc/terms/abstract>,
          <http://purl.org/dc/terms/creator>,
          <http://purl.org/dc/elements/1.1/creator>,
          <http://purl.org/dc/terms/publisher>,
          <http://purl.org/dc/elements/1.1/publisher>,
          <http://purl.org/dc/terms/created>,
          <http://purl.org/dc/terms/modified>,
          <http://www.w3.org/2002/07/owl#versionInfo>,
          <http://purl.org/vocab/vann/preferredNamespacePrefix>,
          <http://purl.org/vocab/vann/preferredNamespaceUri>,
          <http://purl.org/dc/terms/license>
        ))
      }
    `;
    
    const data = await graphdbClient.executeQuery(query);
    
    // Enhanced metadata extraction with language preference
    const metadata = {
      title: null,
      titlesByLang: { sv: null, en: null, default: null },
      description: null,
      descriptionsByLang: { sv: null, en: null, default: null },
      creator: null,
      publisher: null,
      created: null,
      modified: null,
      version: null,
      license: null,
      preferredNamespacePrefix: null,
      preferredNamespaceUri: null
    };
    
    // First pass: collect all values grouped by predicate and language
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(result => {
        const predicate = result.p.value;
        const value = result.o.value;
        const lang = result.lang ? result.lang.value : 'default';
        
        // Group labels and titles
        if (predicate.includes('label') || predicate.includes('title')) {
          if (lang === 'sv') metadata.titlesByLang.sv = value;
          else if (lang === 'en') metadata.titlesByLang.en = value;
          else if (!metadata.titlesByLang.default) metadata.titlesByLang.default = value;
        } 
        // Group descriptions, comments, definitions, abstracts
        else if (predicate.includes('comment') || 
                predicate.includes('description') || 
                predicate.includes('definition') || 
                predicate.includes('abstract')) {
          if (lang === 'sv') metadata.descriptionsByLang.sv = value;
          else if (lang === 'en') metadata.descriptionsByLang.en = value;
          else if (!metadata.descriptionsByLang.default) metadata.descriptionsByLang.default = value;
        } 
        // Handle other properties
        else if (predicate.includes('creator')) {
          metadata.creator = value;
        } else if (predicate.includes('publisher')) {
          metadata.publisher = value;
        } else if (predicate.includes('created')) {
          metadata.created = value;
        } else if (predicate.includes('modified')) {
          metadata.modified = value;
        } else if (predicate.includes('versionInfo')) {
          metadata.version = value;
        } else if (predicate.includes('license')) {
          metadata.license = value;
        } else if (predicate.includes('preferredNamespacePrefix')) {
          metadata.preferredNamespacePrefix = value;
        } else if (predicate.includes('preferredNamespaceUri')) {
          metadata.preferredNamespaceUri = value;
        }
      });
    }
    
    // Second pass: select the best value with language preference (Swedish > English > default)
    metadata.title = metadata.titlesByLang.sv || metadata.titlesByLang.en || metadata.titlesByLang.default;
    metadata.description = metadata.descriptionsByLang.sv || metadata.descriptionsByLang.en || metadata.descriptionsByLang.default;
    
    // If title is still not found, use the last part of the URI
    if (!metadata.title) {
      const uriParts = uri.split(/[/#]/);
      metadata.title = uriParts[uriParts.length - 1] || uri;
    }
    
    // If description is not found, generate a fallback
    if (!metadata.description) {
      metadata.description = generateOntologyDescription(uri);
    }
    
    // Count classes, properties, and individuals with improved queries
    try {
      const stats = await getOntologyStats(uri);
      metadata.stats = stats;
    } catch (statsError) {
      console.error(`Error getting stats for ${uri}:`, statsError.message);
      metadata.stats = { classes: 0, properties: 0, individuals: 0 };
    }
    
    // Fetch namespaces used in this ontology
    try {
      const namespaces = await fetchOntologyNamespaces(uri);
      metadata.namespaces = namespaces;
    } catch (nsError) {
      console.error(`Error fetching namespaces for ${uri}:`, nsError.message);
      metadata.namespaces = [];
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ontology ${uri}:`, error.message);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: generateOntologyDescription(uri),
      stats: { classes: 0, properties: 0, individuals: 0 }
    };
  }
}

/**
 * Fetch namespaces used in an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of namespace objects
 */
async function fetchOntologyNamespaces(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Modified query with proper syntax
    const query = `
      SELECT DISTINCT ?prefix ?namespace WHERE {
        # Find explicit namespace declarations
        {
          <${safeUri}> <http://purl.org/vocab/vann/preferredNamespacePrefix> ?prefix .
          <${safeUri}> <http://purl.org/vocab/vann/preferredNamespaceUri> ?namespace .
        }
        UNION
        {
          # Try to extract namespaces from resources defined in this ontology
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          BIND(REPLACE(STR(?s), "(#|/)[^#/]*$", "$1") AS ?namespace)
          BIND(STRAFTER(STRBEFORE(STR(?namespace), "/ontology/"), "/") AS ?prefix)
          FILTER(BOUND(?prefix) && ?prefix != "")
        }
      }
      LIMIT 10
    `;
    
    const data = await graphdbClient.executeQuery(query);
    const namespaces = [];
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(binding => {
        if (binding.prefix && binding.namespace) {
          namespaces.push({
            prefix: binding.prefix.value,
            uri: binding.namespace.value
          });
        }
      });
    }
    
    // Add common namespaces if none found
    if (namespaces.length === 0) {
      namespaces.push(
        { prefix: 'rdf', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
        { prefix: 'rdfs', uri: 'http://www.w3.org/2000/01/rdf-schema#' },
        { prefix: 'owl', uri: 'http://www.w3.org/2002/07/owl#' },
        { prefix: 'xsd', uri: 'http://www.w3.org/2001/XMLSchema#' }
      );
      
      // Try to extract a namespace from the ontology URI
      const baseUri = uri.replace(/[#/][^#/]*$/, '');
      if (baseUri) {
        const prefix = baseUri.split('/').pop() || 'ont';
        namespaces.push({ prefix, uri: baseUri + '#' });
      }
    }
    
    return namespaces;
  } catch (error) {
    console.error(`Error fetching namespaces for ontology ${uri}:`, error);
    return [
      { prefix: 'rdf', uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' },
      { prefix: 'rdfs', uri: 'http://www.w3.org/2000/01/rdf-schema#' },
      { prefix: 'owl', uri: 'http://www.w3.org/2002/07/owl#' },
      { prefix: 'xsd', uri: 'http://www.w3.org/2001/XMLSchema#' }
    ];
  }
}

/**
 * Fetch ontology classes defined in an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of class objects
 */
async function fetchOntologyClasses(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?class ?label ?comment WHERE {
        {
          ?class a <http://www.w3.org/2002/07/owl#Class> .
          FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label }
          OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#comment> ?comment }
        }
        UNION
        {
          ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
          FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
          OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label }
          OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#comment> ?comment }
        }
        UNION
        {
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          ?class a ?type .
          FILTER(?type IN (<http://www.w3.org/2002/07/owl#Class>, <http://www.w3.org/2000/01/rdf-schema#Class>))
          OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label }
          OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#comment> ?comment }
        }
      }
      ORDER BY ?class
      LIMIT 100
    `;
    
    const data = await graphdbClient.executeQuery(query);
    const classes = [];
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(binding => {
        if (binding.class) {
          classes.push({
            uri: binding.class.value,
            label: binding.label ? binding.label.value : binding.class.value.split(/[/#]/).pop(),
            description: binding.comment ? binding.comment.value : null
          });
        }
      });
    }
    
    return classes;
  } catch (error) {
    console.error(`Error fetching classes for ontology ${uri}:`, error);
    return [];
  }
}

/**
<<<<<<< HEAD
 * Get statistics for an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Ontology statistics
 */
async function getOntologyStats(uri) {
  try {
    console.log(`Getting stats for ontology: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Simplified query to count classes in the ontology
    const classesQuery = `
      SELECT (COUNT(DISTINCT ?class) AS ?count) WHERE {
        {
          ?class a <http://www.w3.org/2002/07/owl#Class> .
          FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
        } 
        UNION 
        {
          ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
          FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
        }
        UNION
        {
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          ?class a ?type .
          FILTER(?type IN (<http://www.w3.org/2002/07/owl#Class>, <http://www.w3.org/2000/01/rdf-schema#Class>))
        }
      }
    `;
    
    // Simplified query to count properties
    const propertiesQuery = `
      SELECT (COUNT(DISTINCT ?property) AS ?count) WHERE {
        {
          ?property a ?type .
          FILTER(?type IN (
            <http://www.w3.org/2002/07/owl#ObjectProperty>, 
            <http://www.w3.org/2002/07/owl#DatatypeProperty>,
            <http://www.w3.org/2002/07/owl#AnnotationProperty>,
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>
          ))
          FILTER(STRSTARTS(STR(?property), STR(<${safeUri}>)))
        }
        UNION
        {
          ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          ?property a ?type .
          FILTER(?type IN (
            <http://www.w3.org/2002/07/owl#ObjectProperty>, 
            <http://www.w3.org/2002/07/owl#DatatypeProperty>,
            <http://www.w3.org/2002/07/owl#AnnotationProperty>,
            <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>
          ))
        }
      }
    `;
    
    // Simplified query to count individuals
    const individualsQuery = `
      SELECT (COUNT(DISTINCT ?individual) AS ?count) WHERE {
        {
          ?individual a <http://www.w3.org/2002/07/owl#NamedIndividual> .
          FILTER(STRSTARTS(STR(?individual), STR(<${safeUri}>)))
        }
        UNION
        {
          ?individual <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          ?individual a <http://www.w3.org/2002/07/owl#NamedIndividual> .
        }
        UNION
        {
          ?individual a ?class .
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          FILTER NOT EXISTS { 
            ?individual a <http://www.w3.org/2002/07/owl#Class> .
          }
          FILTER NOT EXISTS {
            ?individual a <http://www.w3.org/2000/01/rdf-schema#Class> .
          }
        }
      }
    `;
    
    // Execute all queries in parallel
    console.log('Executing ontology stats queries...');
    const [classesResult, propertiesResult, individualsResult] = await Promise.all([
      graphdbClient.executeQuery(classesQuery),
      graphdbClient.executeQuery(propertiesQuery),
      graphdbClient.executeQuery(individualsQuery)
    ]);
    
    // Extract counts from results
    const classesCount = classesResult?.results?.bindings[0]?.count?.value || 0;
    const propertiesCount = propertiesResult?.results?.bindings[0]?.count?.value || 0;
    const individualsCount = individualsResult?.results?.bindings[0]?.count?.value || 0;
    
    console.log(`Stats for ${uri}: Classes=${classesCount}, Properties=${propertiesCount}, Individuals=${individualsCount}`);
    
    return {
      classes: parseInt(classesCount, 10),
      properties: parseInt(propertiesCount, 10),
      individuals: parseInt(individualsCount, 10)
    };
  } catch (error) {
    console.error(`Error getting stats for ontology ${uri}:`, error);
    return {
      classes: 0,
      properties: 0,
      individuals: 0
    };
  }
}

/**
 * Fetch products related to a specific ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of products
 */
async function fetchProductsForOntology(uri) {
  try {
    console.log(`Fetching products for ontology: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to find products related to this ontology
    const query = `
      SELECT DISTINCT ?product ?name ?description WHERE {
        {
          # Products defined by the ontology
          ?product a ?type .
          ?type <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties if available
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
        UNION
        {
          # Products using classes from this ontology
          ?product a ?class .
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties if available
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
      }
      ORDER BY ?product
      LIMIT 100
    `;
    
    const data = await graphdbClient.executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure when fetching products by ontology');
      return [];
    }
    
    console.log(`Found ${data.results.bindings.length} products for ontology ${uri}`);
    
    // Process results
    const products = data.results.bindings.map(binding => {
      const productUri = binding.product?.value || '';
      return {
        uri: productUri,
        name: binding.name?.value || productUri.split(/[/#]/).pop() || 'Unnamed Product',
        description: binding.description?.value || '',
        isNotor: productUri.includes('notor65') || productUri.includes('Notor')
      };
    });
    
    return products;
  } catch (error) {
    console.error(`Error fetching products for ontology ${uri}:`, error);
=======
 * Fetch minimal metadata for a related ontology (avoids full metadata fetch)
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Basic ontology metadata
 */
async function fetchMinimalOntologyMetadata(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Simplified query to just get title and description
    const query = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://purl.org/dc/terms/title>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>
        ))
      }
      LIMIT 5
    `;
    
    const data = await graphdbClient.executeQuery(query);
    const metadata = {
      title: null,
      description: null
    };
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(result => {
        const predicate = result.p.value;
        const value = result.o.value;
        
        if (predicate.includes('label') || predicate.includes('title')) {
          metadata.title = value;
        } else if (predicate.includes('comment') || predicate.includes('description')) {
          metadata.description = value;
        }
      });
    }
    
    // If title is still not found, use the last part of the URI
    if (!metadata.title) {
      const uriParts = uri.split(/[/#]/);
      metadata.title = uriParts[uriParts.length - 1] || uri;
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching minimal metadata for ontology ${uri}:`, error);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: null
    };
  }
}
/**
 * Fetch ontologies related to a specific ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of related ontology objects
 */
async function fetchRelatedOntologies(uri) {
  try {
    console.log(`Fetching related ontologies for: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to find related ontologies through imports, references, or extensions
    const query = `
      SELECT DISTINCT ?relatedOntology WHERE {
        {
          # Imported ontologies
          <${safeUri}> <http://www.w3.org/2002/07/owl#imports> ?relatedOntology .
        }
        UNION
        {
          # Ontologies that import this ontology
          ?relatedOntology <http://www.w3.org/2002/07/owl#imports> <${safeUri}> .
          ?relatedOntology a <http://www.w3.org/2002/07/owl#Ontology> .
        }
        UNION
        {
          # Ontologies referenced by classes or properties in this ontology
          ?resource <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          ?resource ?p ?o .
          ?o <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> ?relatedOntology .
          FILTER(?relatedOntology != <${safeUri}>)
        }
        UNION
        {
          # Ontologies that reference classes or properties from this ontology
          ?resource <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> ?relatedOntology .
          ?resource ?p ?o .
          ?o <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          FILTER(?relatedOntology != <${safeUri}>)
        }
      }
      LIMIT 10
    `;
    
    const data = await graphdbClient.executeQuery(query);
    const relatedOntologies = [];
    
    if (data && data.results && data.results.bindings) {
      console.log(`Found ${data.results.bindings.length} related ontologies`);
      
      // Process in batches for metadata retrieval
      const ontologyUris = data.results.bindings
        .filter(binding => binding.relatedOntology && binding.relatedOntology.value)
        .map(binding => binding.relatedOntology.value);
      
      // Get basic metadata for each related ontology
      for (const relatedUri of ontologyUris) {
        try {
          // Get minimal metadata
          const metadata = await fetchMinimalOntologyMetadata(relatedUri);
          relatedOntologies.push({
            uri: relatedUri,
            title: metadata.title || relatedUri.split(/[/#]/).pop() || relatedUri,
            description: metadata.description || ''
          });
        } catch (err) {
          console.error(`Error fetching metadata for related ontology ${relatedUri}:`, err.message);
          // Still include the ontology, but with limited info
          relatedOntologies.push({
            uri: relatedUri,
            title: relatedUri.split(/[/#]/).pop() || relatedUri,
            description: ''
          });
        }
      }
    }
    
    return relatedOntologies;
  } catch (error) {
    console.error(`Error fetching related ontologies for ${uri}:`, error);
>>>>>>> parent of 0cf6365 (fixat)
    return [];
  }
}

/**
<<<<<<< HEAD
 * Get download URL for an ontology in a specific format
 * @param {string} uri - Ontology URI
 * @param {string} format - Download format MIME type (e.g., 'application/rdf+xml')
 * @returns {string} - Download URL
 */
function getDownloadUrl(uri, format) {
  return graphdbClient.getDownloadUrl(uri, format);
}

/**
 * Execute a SPARQL query against GraphDB (wrapper for backward compatibility)
 * @param {string} query - SPARQL query to execute
 * @returns {Promise<Object>} - Response data from GraphDB
 */
function executeQuery(query) {
  return graphdbClient.executeQuery(query);
}

>>>>>>> parent of b008243 (g)
=======
 * Fetch minimal metadata for a related ontology (avoids full metadata fetch)
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Basic ontology metadata
 */
async function fetchMinimalOntologyMetadata(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Simplified query to just get title and description
    const query = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://purl.org/dc/terms/title>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>
        ))
      }
      LIMIT 5
    `;
    
    const data = await graphdbClient.executeQuery(query);
    const metadata = {
      title: null,
      description: null
    };
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(result => {
        const predicate = result.p.value;
        const value = result.o.value;
        
        if (predicate.includes('label') || predicate.includes('title')) {
          metadata.title = value;
        } else if (predicate.includes('comment') || predicate.includes('description')) {
          metadata.description = value;
        }
      });
    }
    
    // If title is still not found, use the last part of the URI
    if (!metadata.title) {
      const uriParts = uri.split(/[/#]/);
      metadata.title = uriParts[uriParts.length - 1] || uri;
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching minimal metadata for ontology ${uri}:`, error);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: null
    };
  }
}

// Make sure to also add fetchRelatedOntologies to the module.exports
>>>>>>> parent of 0cf6365 (fixat)
module.exports = {
  executeQuery,
  fetchOntologies,
  fetchOntologyMetadata,
  getOntologyStats,
  getDownloadUrl,
  fetchProductsForOntology,
  fetchOntologyNamespaces,
<<<<<<< HEAD
  fetchOntologyClasses,
<<<<<<< HEAD
  fetchRelatedOntologies,
  fetchMinimalOntologyMetadata
=======
  fetchOntologyClasses
>>>>>>> parent of b008243 (g)
=======
  fetchMinimalOntologyMetadata,
  fetchRelatedOntologies, // Add this to the exports
  fetchMinimalOntologyMetadata // Also add this helper function
>>>>>>> parent of 0cf6365 (fixat)
};