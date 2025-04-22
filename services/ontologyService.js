// services/ontologyService.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
// Import the description utilities
const { generateOntologyDescription } = require('../utils/descriptionUtils');

/**
 * Execute a SPARQL query against GraphDB
 * @param {string} query - SPARQL query to execute
 * @returns {Promise<Object>} - Response data from GraphDB
 */
async function executeQuery(query) {
  try {
    console.log('Executing query:', query);
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error executing GraphDB query:', error.message);
    // Print more details if available
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

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
    const data = await executeQuery(query);
    
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
              description: generateFallbackDescription(uri),
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
 * Generate a fallback description for ontologies without descriptions
 * @param {string} uri - Ontology URI
 * @returns {string} - Generated description
 */
function generateFallbackDescription(uri) {
  return generateOntologyDescription(uri);
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
          <http://www.w3.org/2002/07/owl#versionInfo>
        ))
      }
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !data.results.bindings) {
      console.error('Unexpected response format when fetching ontology metadata:', JSON.stringify(data).substring(0, 500));
      return {
        title: uri.split(/[/#]/).pop() || uri,
        description: generateFallbackDescription(uri),
        stats: { classes: 0, properties: 0, individuals: 0 }
      };
    }
    
    const results = data.results.bindings;
    console.log(`Found ${results.length} metadata properties for ${uri}`);
    
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
      version: null
    };
    
    // First pass: collect all values grouped by predicate and language
    results.forEach(result => {
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
      }
    });
    
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
      metadata.description = generateFallbackDescription(uri);
    }
    
    // Try to explore more even if there's no direct metadata
    if (!metadata.description) {
      try {
        metadata.description = await generateDescriptionFromContent(uri);
      } catch (descError) {
        console.error(`Error generating description from content for ${uri}:`, descError.message);
        metadata.description = generateFallbackDescription(uri);
      }
    }
    
    // Count classes, properties, and individuals with improved queries
    try {
      const stats = await getOntologyStats(uri);
      metadata.stats = stats;
    } catch (statsError) {
      console.error(`Error getting stats for ${uri}:`, statsError.message);
      metadata.stats = { classes: 0, properties: 0, individuals: 0 };
    }
    
    // Fetch products related to this ontology
    try {
      const products = await fetchProductsForOntology(uri);
      metadata.products = products;
    } catch (productsError) {
      console.error(`Error fetching products for ${uri}:`, productsError.message);
      metadata.products = [];
    }
    
    // Fetch key relationships in the ontology
    try {
      const relationships = await fetchOntologyRelationships(uri);
      metadata.relationships = relationships;
    } catch (relError) {
      console.error(`Error fetching relationships for ${uri}:`, relError.message);
      metadata.relationships = [];
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ontology ${uri}:`, error.message);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: generateFallbackDescription(uri),
      stats: { classes: 0, properties: 0, individuals: 0 },
      products: [],
      relationships: []
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
    
    const query = `
      SELECT DISTINCT ?product ?name ?description ?type WHERE {
        # Products defined by this ontology (using classes from this ontology)
        {
          ?product a ?type .
          ?type <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic information
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
        UNION
        {
          # Products with predicates from this ontology
          ?product ?predicate ?object .
          ?predicate <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get type information
          OPTIONAL { ?product a ?type . }
          
          # Get basic information
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
        UNION
        {
          # Special case for Notor65 products
          ?product a <http://www.ontologi2025.se/notor65#Notor65_BetaOpti> .
          FILTER(CONTAINS(STR(<${safeUri}>), "notor65"))
          
          BIND(<http://www.ontologi2025.se/notor65#Notor65_BetaOpti> AS ?type)
          
          # Get basic information
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
      }
      LIMIT 25
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !data.results.bindings) {
      return [];
    }
    
    const products = data.results.bindings.map(binding => {
      const productUri = binding.product?.value || '';
      return {
        uri: productUri,
        name: binding.name?.value || productUri.split(/[/#]/).pop() || 'Unnamed Product',
        description: binding.description?.value || '',
        type: binding.type?.value || ''
      };
    });
    
    return products;
  } catch (error) {
    console.error(`Error fetching products for ontology ${uri}:`, error.message);
    return [];
  }
}

/**
 * Fetch key relationships defined in the ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of relationships
 */
async function fetchOntologyRelationships(uri) {
  try {
    console.log(`Fetching relationships for ontology: ${uri}`);
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to get object properties and their domains/ranges
    const query = `
      SELECT DISTINCT ?property ?propertyLabel ?domain ?domainLabel ?range ?rangeLabel WHERE {
        # Get object properties defined in this ontology
        {
          ?property a <http://www.w3.org/2002/07/owl#ObjectProperty> .
          FILTER(STRSTARTS(STR(?property), STR(<${safeUri}>)))
          
          # Get domain and range if available
          OPTIONAL { 
            ?property <http://www.w3.org/2000/01/rdf-schema#domain> ?domain .
            OPTIONAL { ?domain <http://www.w3.org/2000/01/rdf-schema#label> ?domainLabel . }
          }
          OPTIONAL { 
            ?property <http://www.w3.org/2000/01/rdf-schema#range> ?range .
            OPTIONAL { ?range <http://www.w3.org/2000/01/rdf-schema#label> ?rangeLabel . }  
          }
          OPTIONAL { ?property <http://www.w3.org/2000/01/rdf-schema#label> ?propertyLabel . }
        }
        UNION
        {
          ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          ?property a <http://www.w3.org/2002/07/owl#ObjectProperty> .
          
          # Get domain and range if available
          OPTIONAL { 
            ?property <http://www.w3.org/2000/01/rdf-schema#domain> ?domain .
            OPTIONAL { ?domain <http://www.w3.org/2000/01/rdf-schema#label> ?domainLabel . }
          }
          OPTIONAL { 
            ?property <http://www.w3.org/2000/01/rdf-schema#range> ?range .
            OPTIONAL { ?range <http://www.w3.org/2000/01/rdf-schema#label> ?rangeLabel . }  
          }
          OPTIONAL { ?property <http://www.w3.org/2000/01/rdf-schema#label> ?propertyLabel . }
        }
      }
      LIMIT 50
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !data.results.bindings) {
      return [];
    }
    
    const relationships = data.results.bindings.map(binding => {
      const propertyUri = binding.property?.value || '';
      const domainUri = binding.domain?.value || '';
      const rangeUri = binding.range?.value || '';
      
      return {
        property: {
          uri: propertyUri,
          label: binding.propertyLabel?.value || propertyUri.split(/[/#]/).pop() || 'Unnamed Property'
        },
        domain: {
          uri: domainUri,
          label: binding.domainLabel?.value || domainUri.split(/[/#]/).pop() || ''
        },
        range: {
          uri: rangeUri,
          label: binding.rangeLabel?.value || rangeUri.split(/[/#]/).pop() || ''
        }
      };
    });
    
    return relationships;
  } catch (error) {
    console.error(`Error fetching relationships for ontology ${uri}:`, error.message);
    return [];
  }
}

/**
 * Try to generate a description by analyzing ontology content
 * @param {string} uri - Ontology URI
 * @returns {Promise<string>} - Generated description
 */
async function generateDescriptionFromContent(uri) {
  const safeUri = sanitizeSparqlString(uri);
  
  // Extract some class names to get a sense of the domain
  const classQuery = `
    SELECT ?class ?label
    WHERE {
      {
        ?class a <http://www.w3.org/2002/07/owl#Class> .
        FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
      } 
      UNION 
      {
        ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
        FILTER(STRSTARTS(STR(?class), STR(<${safeUri}>)))
      }
      OPTIONAL { ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label }
    } 
    LIMIT 5
  `;
  
  const classData = await executeQuery(classQuery);
  const classNames = classData.results.bindings.map(binding => 
    binding.label ? binding.label.value : binding.class.value.split(/[/#]/).pop()
  );
  
  const name = uri.split(/[/#]/).pop() || 'ontology';
  
  if (classNames.length > 0) {
    return `The ${name} ontology includes concepts such as ${classNames.join(', ')}. This structured vocabulary provides semantic definitions for knowledge representation in its domain.`;
  } else {
    return generateFallbackDescription(uri);
  }
}

/**
 * Get statistics for an ontology with improved and simplified queries
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
            ?individual a <http://www.w3.org/2000/01/rdf-schema#Class> .
            ?individual a <http://www.w3.org/2002/07/owl#ObjectProperty> .
            ?individual a <http://www.w3.org/2002/07/owl#DatatypeProperty> .
            ?individual a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> .
          }
        }
      }
    `;
    
    // Execute all queries in parallel
    console.log('Executing ontology stats queries...');
    const [classesResult, propertiesResult, individualsResult] = await Promise.all([
      executeQuery(classesQuery),
      executeQuery(propertiesQuery),
      executeQuery(individualsQuery)
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
    console.error(`Error getting stats for ontology ${uri}:`, error.message);
    return {
      classes: 0,
      properties: 0,
      individuals: 0
    };
  }
}

/**
 * Get download URL for an ontology in a specific format
 * @param {string} uri - Ontology URI
 * @param {string} format - Download format MIME type (e.g., 'application/rdf+xml')
 * @returns {string} - Download URL
 */
function getDownloadUrl(uri, format) {
  // GraphDB export URL with Content-Disposition header parameter
  return `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}/statements?infer=false&context=<${encodeURIComponent(uri)}>&format=${encodeURIComponent(format)}&filename=ontology`;
}

module.exports = {
  fetchOntologies,
  fetchOntologyMetadata,
  getOntologyStats,
  getDownloadUrl,
  fetchProductsForOntology,
  fetchOntologyRelationships
};