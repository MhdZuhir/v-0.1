// services/labelService.js
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { isSystemResource } = require('../utils/uriUtils');

/**
 * Fetch human-readable labels for URIs with batching
 * @param {Array} uris - Array of URIs to fetch labels for
 * @returns {Promise<Object>} - Object mapping URIs to their labels
 */
async function fetchLabelsForUris(uris) {
  if (!uris || uris.length === 0) return {};
  
  // Filter out system URIs
  uris = uris.filter(uri => !isSystemResource(uri));
  if (uris.length === 0) return {};
  
  const labelMap = {};
  const BATCH_SIZE = 20;
  
  try {
    // Split URIs into batches
    const batches = [];
    for (let i = 0; i < uris.length; i += BATCH_SIZE) {
      batches.push(uris.slice(i, i + BATCH_SIZE));
    }
    
    // Process each batch
    for (let batch of batches) {
      try {
        const uriValues = batch.map(uri => `<${uri}>`).join(' ');
        const query = `
          SELECT ?uri ?label WHERE {
            VALUES ?uri { ${uriValues} }
            ?uri ?labelProperty ?label .
            FILTER(?labelProperty IN (
              <http://www.w3.org/2000/01/rdf-schema#label>,
              <http://www.w3.org/2004/02/skos/core#prefLabel>,
              <http://purl.org/dc/elements/1.1/title>,
              <http://purl.org/dc/terms/title>,
              <http://www.w3.org/2004/02/skos/core#altLabel>
            ))
            FILTER(LANG(?label) = "" || LANG(?label) = "sv" || LANG(?label) = "en")
          }
        `;
        
        const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query }
        });
        
        const bindings = response.data.results.bindings || [];
        const uriLabels = new Map();
        
        for (const binding of bindings) {
          const uri = binding.uri.value;
          const label = binding.label.value;
          const lang = binding.label['xml:lang'] || '';
          
          if (!uriLabels.has(uri)) uriLabels.set(uri, {});
          
          // Store label by language priority (sv > en > no-lang)
          if (lang === 'sv') {
            uriLabels.get(uri).sv = label;
          } else if (lang === 'en' && !uriLabels.get(uri).sv) {
            uriLabels.get(uri).en = label;
          } else if (!lang && !uriLabels.get(uri).sv && !uriLabels.get(uri).en) {
            uriLabels.get(uri).none = label;
          }
        }
        
        // Add labels from batch to main labelMap
        for (const uri of batch) {
          const labels = uriLabels.get(uri) || {};
          
          if (labels.sv) labelMap[uri] = labels.sv;
          else if (labels.en) labelMap[uri] = labels.en;
          else if (labels.none) labelMap[uri] = labels.none;
          else {
            const lastPart = uri.split(/[/#]/).pop();
            labelMap[uri] = lastPart || uri;
          }
        }
      } catch (batchError) {
        console.error(`Error processing batch:`, batchError.message);
      }
    }
    
    return labelMap;
  } catch (error) {
    console.error('Error in fetchLabelsForUris:', error);
    
    // Fallback: use last part of URI
    for (const uri of uris) {
      const lastPart = uri.split(/[/#]/).pop();
      labelMap[uri] = lastPart || uri;
    }
    
    return labelMap;
  }
}

module.exports = {
  fetchLabelsForUris
};