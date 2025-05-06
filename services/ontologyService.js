// Add the new fetchRelatedOntologies function to the ontologyService.js file

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

// Make sure to also add fetchRelatedOntologies to the module.exports
module.exports = {
  executeQuery,
  fetchOntologies,
  fetchOntologyMetadata,
  getOntologyStats,
  getDownloadUrl,
  fetchProductsForOntology,
  fetchOntologyNamespaces,
  fetchOntologyClasses,
  fetchMinimalOntologyMetadata,
  fetchRelatedOntologies, // Add this to the exports
  fetchMinimalOntologyMetadata // Also add this helper function
};