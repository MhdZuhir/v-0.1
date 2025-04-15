// services/ontologyService.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');

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
 * Fetch all ontologies from the repository
 * @returns {Promise<Array>} - Array of ontology objects
 */
async function fetchOntologies() {
  try {
    // Query to find all ontology IRIs
    const query = `
      SELECT DISTINCT ?ontology WHERE {
        {
          ?ontology a <http://www.w3.org/2002/07/owl#Ontology> .
        } UNION {
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> ?ontology .
        } UNION {
          ?s <http://www.w3.org/2002/07/owl#imports> ?ontology .
        }
      }
      ORDER BY ?ontology
    `;
    
    const data = await executeQuery(query);
    const ontologyUris = data.results.bindings.map(binding => binding.ontology.value);
    
    // Get metadata for each ontology
    const ontologies = await Promise.all(
      ontologyUris.map(async uri => {
        const metadata = await fetchOntologyMetadata(uri);
        return {
          uri,
          ...metadata
        };
      })
    );
    
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
    const query = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/title>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://purl.org/dc/terms/description>,
          <http://purl.org/dc/elements/1.1/description>,
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
    const results = data.results.bindings;
    
    // Extract metadata from results
    const metadata = {
      title: null,
      description: null,
      creator: null,
      publisher: null,
      created: null,
      modified: null,
      version: null
    };
    
    results.forEach(result => {
      const predicate = result.p.value;
      const value = result.o.value;
      
      if (predicate.includes('label') || predicate.includes('title')) {
        metadata.title = value;
      } else if (predicate.includes('comment') || predicate.includes('description')) {
        metadata.description = value;
      } else if (predicate.includes('creator')) {
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
    
    // If title is not found, use the last part of the URI
    if (!metadata.title) {
      const uriParts = uri.split(/[/#]/);
      metadata.title = uriParts[uriParts.length - 1] || uri;
    }
    
    // Count classes, properties, and individuals
    const stats = await getOntologyStats(uri);
    metadata.stats = stats;
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ontology ${uri}:`, error);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: null
    };
  }
}

/**
 * Get statistics for an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Object>} - Ontology statistics
 */
async function getOntologyStats(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to count classes in the ontology
    const classesQuery = `
      SELECT (COUNT(DISTINCT ?class) AS ?count) WHERE {
        {
          ?class a <http://www.w3.org/2002/07/owl#Class> .
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        } UNION {
          ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        }
      }
    `;
    
    // Query to count properties in the ontology
    const propertiesQuery = `
      SELECT (COUNT(DISTINCT ?property) AS ?count) WHERE {
        {
          ?property a <http://www.w3.org/2002/07/owl#ObjectProperty> .
          ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        } UNION {
          ?property a <http://www.w3.org/2002/07/owl#DatatypeProperty> .
          ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        } UNION {
          ?property a <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> .
          ?property <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        }
      }
    `;
    
    // Query to count individuals in the ontology
    const individualsQuery = `
      SELECT (COUNT(DISTINCT ?individual) AS ?count) WHERE {
        ?individual a <http://www.w3.org/2002/07/owl#NamedIndividual> .
        ?individual <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
      }
    `;
    
    // Execute all queries in parallel
    const [classesResult, propertiesResult, individualsResult] = await Promise.all([
      executeQuery(classesQuery),
      executeQuery(propertiesQuery),
      executeQuery(individualsQuery)
    ]);
    
    // Extract counts from results
    const classesCount = classesResult.results.bindings[0]?.count?.value || 0;
    const propertiesCount = propertiesResult.results.bindings[0]?.count?.value || 0;
    const individualsCount = individualsResult.results.bindings[0]?.count?.value || 0;
    
    return {
      classes: parseInt(classesCount),
      properties: parseInt(propertiesCount),
      individuals: parseInt(individualsCount)
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
 * Get download URL for an ontology in a specific format
 * @param {string} uri - Ontology URI
 * @param {string} format - Download format (e.g., 'rdf', 'ttl', 'json-ld')
 * @returns {string} - Download URL
 */
function getDownloadUrl(uri, format) {
  // GraphDB export URL - this may need to be adapted to your GraphDB setup
  return `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}/statements?infer=false&context=<${encodeURIComponent(uri)}>&format=${format}`;
}

module.exports = {
  fetchOntologies,
  fetchOntologyMetadata,
  getOntologyStats,
  getDownloadUrl
};