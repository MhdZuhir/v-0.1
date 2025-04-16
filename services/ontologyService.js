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
              description: "Could not load ontology metadata",
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
    
    if (!data || !data.results || !data.results.bindings) {
      console.error('Unexpected response format when fetching ontology metadata:', JSON.stringify(data).substring(0, 500));
      return {
        title: uri.split(/[/#]/).pop() || uri,
        description: null,
        stats: { classes: 0, properties: 0, individuals: 0 }
      };
    }
    
    const results = data.results.bindings;
    console.log(`Found ${results.length} metadata properties for ${uri}`);
    
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
    
    // Count classes, properties, and individuals with improved queries
    try {
      const stats = await getOntologyStats(uri);
      metadata.stats = stats;
    } catch (statsError) {
      console.error(`Error getting stats for ${uri}:`, statsError.message);
      metadata.stats = { classes: 0, properties: 0, individuals: 0 };
    }
    
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata for ontology ${uri}:`, error.message);
    return {
      title: uri.split(/[/#]/).pop() || uri,
      description: null,
      stats: { classes: 0, properties: 0, individuals: 0 }
    };
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
  getDownloadUrl
};