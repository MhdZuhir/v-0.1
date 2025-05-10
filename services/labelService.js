// services/labelService.js - Fixed version with authentication

/**
 * Service for retrieving human-readable labels for URIs
 */

const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { isSystemResource } = require('../utils/uriUtils');
const { getAuthHeaders } = require('../utils/authUtils');

/**
 * Fetch human-readable labels for URIs with batching for performance
 * @param {Array} uris - Array of URIs to fetch labels for
 * @returns {Promise<Object>} - Object mapping URIs to their labels
 */
async function fetchLabelsForUris(uris) {
  if (!uris || !Array.isArray(uris) || uris.length === 0) {
    console.log('No URIs provided to fetchLabelsForUris');
    return {};
  }
  
  // Prepare the URI set - remove duplicates and filter system resources
  const uniqueUris = [...new Set(uris)];
  const filteredUris = uniqueUris.filter(uri => {
    // Always allow core RDF/RDFS resources even if they're system resources
    if (uri.includes('/Property') || 
        uri.includes('/Class') || 
        uri.includes('/Resource') || 
        uri.includes('/Literal')) {
      return true;
    }
    return !isSystemResource(uri);
  });
  
  if (filteredUris.length === 0) {
    console.log('No non-system URIs to fetch labels for');
    return {};
  }
  
  const labelMap = {};
  const BATCH_SIZE = 20; // Process URIs in batches of 20 for better performance
  
  try {
    // Split URIs into batches
    const batches = [];
    for (let i = 0; i < filteredUris.length; i += BATCH_SIZE) {
      batches.push(filteredUris.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Processing ${filteredUris.length} URIs in ${batches.length} batches`);
    
    // Process each batch in sequence (not parallel to avoid overwhelming the server)
    for (const batch of batches) {
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
              <http://schema.org/name>,
              <http://www.w3.org/2004/02/skos/core#altLabel>
            ))
            FILTER(LANG(?label) = "" || LANG(?label) = "sv" || LANG(?label) = "en")
          }
          LIMIT 200
        `;
        
        const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
          headers: getAuthHeaders(),
          params: { query }
        });
        
        if (!response.data || !response.data.results || !Array.isArray(response.data.results.bindings)) {
          console.warn('Unexpected response format when fetching labels');
          continue;
        }
        
        const bindings = response.data.results.bindings;
        const batchUriLabels = new Map();
        
        // Group labels by URI and language
        for (const binding of bindings) {
          if (!binding.uri || !binding.label) continue;
          
          const uri = binding.uri.value;
          const label = binding.label.value;
          const lang = binding.label['xml:lang'] || '';
          
          if (!batchUriLabels.has(uri)) {
            batchUriLabels.set(uri, { sv: null, en: null, none: null });
          }
          
          // Store label by language priority (sv > en > no-lang)
          if (lang === 'sv') {
            batchUriLabels.get(uri).sv = label;
          } else if (lang === 'en' && !batchUriLabels.get(uri).sv) {
            batchUriLabels.get(uri).en = label;
          } else if (!lang && !batchUriLabels.get(uri).sv && !batchUriLabels.get(uri).en) {
            batchUriLabels.get(uri).none = label;
          }
        }
        
        // Add labels from batch to main labelMap using language priority
        for (const uri of batch) {
          const labels = batchUriLabels.get(uri) || {};
          
          // Select the best label based on language priority
          if (labels.sv) labelMap[uri] = labels.sv;
          else if (labels.en) labelMap[uri] = labels.en;
          else if (labels.none) labelMap[uri] = labels.none;
          else {
            // Use last part of URI as fallback label
            const lastPart = uri.split(/[/#]/).pop();
            labelMap[uri] = lastPart || uri;
          }
        }
      } catch (batchError) {
        console.error(`Error processing label batch:`, batchError.message);
        if (batchError.response && batchError.response.status === 401) {
          console.error('Authentication failed. Please check credentials.');
        }
        // Continue with next batch despite error
      }
    }
    
    console.log(`Successfully fetched ${Object.keys(labelMap).length} labels`);
    return labelMap;
  } catch (error) {
    console.error('Error in fetchLabelsForUris:', error);
    
    // Fallback: use last part of URI for all URIs
    const fallbackMap = {};
    for (const uri of filteredUris) {
      const lastPart = uri.split(/[/#]/).pop();
      fallbackMap[uri] = lastPart || uri;
    }
    
    return fallbackMap;
  }
}

module.exports = {
  fetchLabelsForUris
};