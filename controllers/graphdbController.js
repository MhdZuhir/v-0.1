// controllers/graphdbController.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');

/**
 * Diagnostic endpoint for GraphDB connection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDiagnosticPage = async (req, res) => {
  try {
    let bindings = [];
    let errorMessage = '';
    let debugInfo = {
      endpoint: graphdbConfig.endpoint,
      repository: graphdbConfig.repository,
      queryExecuted: false,
      resultCount: 0,
      filteredCount: 0,
      timestamp: new Date().toISOString()
    };

    // Allow a custom query for diagnostics
    const customQuery = req.query.query;
    const query = customQuery || `
      SELECT ?s ?p ?o WHERE { 
        ?s ?p ?o 
        FILTER(STRSTARTS(STR(?s), "http://www.w3id.org/")) 
      } 
      LIMIT 20
    `;
    
    debugInfo.query = query;
    
    try {
      console.log(`Executing diagnostic query: ${query}`);
      
      const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
        headers: { 'Accept': 'application/sparql-results+json' },
        params: { query }
      });
      
      debugInfo.queryExecuted = true;
      debugInfo.responseStatus = response.status;
      
      if (response.data && response.data.results && Array.isArray(response.data.results.bindings)) {
        bindings = response.data.results.bindings || [];
        debugInfo.resultCount = bindings.length;
        
        if (bindings.length > 0) {
          const firstRow = bindings[0];
          debugInfo.firstRowKeys = Object.keys(firstRow);
          
          // Inspect the structure of the first row more deeply
          debugInfo.firstRowStructure = {};
          for (const key in firstRow) {
            const cell = firstRow[key];
            debugInfo.firstRowStructure[key] = {
              type: cell.type,
              hasValue: cell.value !== undefined,
              value: cell.value ? cell.value.substring(0, 50) + (cell.value.length > 50 ? '...' : '') : null
            };
          }
        }
      } else {
        debugInfo.unexpectedResponseStructure = true;
        debugInfo.responsePreview = JSON.stringify(response.data).substring(0, 500);
        errorMessage = "GraphDB response doesn't have the expected structure";
      }
    } catch (dbErr) {
      console.error('Error querying GraphDB:', dbErr);
      errorMessage = "Could not retrieve data from GraphDB. " + dbErr.message;
      debugInfo.error = dbErr.message;
      debugInfo.errorStack = dbErr.stack;
    }
    
    // Add ontology detection for debugging
    try {
      const ontologyQuery = `
        SELECT DISTINCT ?ontology WHERE {
          {
            ?ontology a <http://www.w3.org/2002/07/owl#Ontology> .
          } UNION {
            ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> ?ontology .
          } UNION {
            ?s <http://www.w3.org/2002/07/owl#imports> ?ontology .
          }
        }
        LIMIT 10
      `;
      
      const ontologyResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
        headers: { 'Accept': 'application/sparql-results+json' },
        params: { query: ontologyQuery }
      });
      
      if (ontologyResponse.data && ontologyResponse.data.results && Array.isArray(ontologyResponse.data.results.bindings)) {
        const ontologies = ontologyResponse.data.results.bindings.map(binding => binding.ontology.value);
        debugInfo.detectedOntologies = ontologies;
        
        // For the first ontology, get class and property counts to debug the stats issue
        if (ontologies.length > 0) {
          const testOntology = ontologies[0];
          
          // Test the class counting query
          const classTestQuery = `
            SELECT (COUNT(DISTINCT ?class) AS ?count) WHERE {
              {
                ?class a <http://www.w3.org/2002/07/owl#Class> .
                {
                  ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${testOntology}> .
                } UNION {
                  FILTER(STRSTARTS(STR(?class), STR(<${testOntology}>)))
                }
              } UNION {
                ?class a <http://www.w3.org/2000/01/rdf-schema#Class> .
                {
                  ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${testOntology}> .
                } UNION {
                  FILTER(STRSTARTS(STR(?class), STR(<${testOntology}>)))
                }
              }
            }
          `;
          
          const classResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
            headers: { 'Accept': 'application/sparql-results+json' },
            params: { query: classTestQuery }
          });
          
          if (classResponse.data && classResponse.data.results && classResponse.data.results.bindings.length > 0) {
            debugInfo.testOntology = testOntology;
            debugInfo.testClassCount = classResponse.data.results.bindings[0].count?.value || '0';
          }
        }
      }
    } catch (ontErr) {
      console.error('Error in ontology detection:', ontErr);
      debugInfo.ontologyError = ontErr.message;
    }
    
    debugInfo.originalCount = bindings.length;
    
    res.render('graphdb', {
      title: 'GraphDB Diagnostic Data',
      message: errorMessage || 'Raw Data from GraphDB:',
      rows: bindings,
      labelMap: {},
      debug: debugInfo,
      diagnosticMode: true,
      showLabels: req.showLabels
    });
  } catch (err) {
    console.error('Unexpected error in /graphdb route:', err);
    res.status(500).send(`
      <h1>Server Error</h1>
      <p>There was an error processing your request:</p>
      <pre>${err.stack}</pre>
    `);
  }
};