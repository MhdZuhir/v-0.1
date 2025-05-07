// controllers/ontologyController.js - Enhanced version
const axios = require('axios');
const { graphdbConfig } = require('../config/db');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
const ontologyService = require('../services/ontologyService');
const productService = require('../services/productService');
const labelService = require('../services/labelService');
const { generateOntologyDescription } = require('../utils/descriptionUtils');

/**
 * Render ontology list page
 */
exports.getOntologyListPage = async (req, res, next) => {
  try {
    console.log('Fetching ontologies for list page...');
    const ontologies = await ontologyService.fetchOntologies();
    
    res.render('home', {
      title: 'Välkommen till WikiGraph',
      ontologies,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getOntologyListPage:', err);
    next(err);
  }
};

/**
 * Handle ontology detail page request - Enhanced with more data fetching
 */
exports.getOntologyDetailPage = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided',
        showLabels: req.showLabels,
        showLabelsToggleState: req.showLabels ? 'false' : 'true'
      });
    }
    
    console.log(`Fetching detailed data for ontology: ${uri}`);
    
    // 1. Fetch core ontology metadata
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    if (!metadata) {
      console.error(`Failed to fetch metadata for ${uri}`);
      return res.status(404).render('error', {
        title: 'Error',
        message: 'Ontology not found or metadata could not be retrieved',
        showLabels: req.showLabels,
        showLabelsToggleState: req.showLabels ? 'false' : 'true'
      });
    }
    
    // 2. Fetch subjects (classes, properties, etc.) defined in this ontology
    console.log('Fetching subjects for the ontology...');
    const subjects = await fetchOntologySubjects(uri);
    metadata.subjects = subjects;
    
    // 3. Fetch related ontologies with enhanced data
    console.log('Fetching related ontologies...');
    const relatedOntologies = await ontologyService.fetchRelatedOntologies(uri);
    metadata.relatedOntologies = relatedOntologies;
    
    // 4. Fetch relationships (domain/range connections between classes and properties)
    console.log('Fetching ontology relationships...');
    const relationships = await ontologyService.fetchOntologyRelationships(uri);
    metadata.relationships = relationships;
    
    // 5. Fetch products related to this ontology
    console.log('Fetching related products...');
    const products = await productService.fetchProductsByOntology(uri);
    metadata.products = products;
    
    // 6. Fetch additional statistics
    console.log('Fetching ontology statistics...');
    if (!metadata.stats) {
      const stats = await ontologyService.getOntologyStats(uri);
      metadata.stats = stats;
    }
    
    // 7. Generate download links for different formats
    const filenameBase = metadata.title ? 
      metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 
      'ontology';
    
    const downloadLinks = [
      { 
        format: 'RDF/XML', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=rdf`, 
        extension: 'rdf' 
      },
      { 
        format: 'Turtle', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=ttl`, 
        extension: 'ttl' 
      },
      { 
        format: 'N-Triples', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=nt`, 
        extension: 'nt' 
      },
      { 
        format: 'JSON-LD', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=jsonld`, 
        extension: 'jsonld' 
      }
    ];
    
    // 8. Fetch labels for all URIs if needed
    let labelMap = {};
    if (req.showLabels) {
      console.log('Fetching labels for URIs...');
      // Collect all URIs that need labels
      const urisToLabel = [uri];
      
      // Add subject URIs
      subjects.forEach(subject => {
        urisToLabel.push(subject.uri);
        if (subject.type) urisToLabel.push(subject.type);
      });
      
      // Add product URIs
      if (metadata.products) {
        metadata.products.forEach(product => {
          urisToLabel.push(product.uri);
          if (product.type) urisToLabel.push(product.type);
        });
      }
      
      // Add relationship URIs
      if (metadata.relationships) {
        metadata.relationships.forEach(rel => {
          urisToLabel.push(rel.property.uri);
          if (rel.domain.uri) urisToLabel.push(rel.domain.uri);
          if (rel.range.uri) urisToLabel.push(rel.range.uri);
        });
      }
      
      // Add related ontology URIs
      if (metadata.relatedOntologies) {
        metadata.relatedOntologies.forEach(ontology => {
          urisToLabel.push(ontology.uri);
        });
      }
      
      // Fetch labels
      labelMap = await labelService.fetchLabelsForUris(urisToLabel);
      
      // Update subjects with fetched labels
      subjects.forEach(subject => {
        if (labelMap[subject.uri]) {
          subject.label = labelMap[subject.uri];
        }
      });
      
      // Update related ontologies with fetched labels
      if (metadata.relatedOntologies) {
        metadata.relatedOntologies.forEach(ontology => {
          if (labelMap[ontology.uri]) {
            ontology.title = labelMap[ontology.uri];
          }
        });
      }
      
      // Update relationships with fetched labels
      if (metadata.relationships) {
        metadata.relationships.forEach(rel => {
          if (labelMap[rel.property.uri]) {
            rel.property.label = labelMap[rel.property.uri];
          }
          if (rel.domain.uri && labelMap[rel.domain.uri]) {
            rel.domain.label = labelMap[rel.domain.uri];
          }
          if (rel.range.uri && labelMap[rel.range.uri]) {
            rel.range.label = labelMap[rel.range.uri];
          }
        });
      }
    }
    
    // Check if we have annotation properties for helper flag
    const hasAnnotationProperties = subjects.some(subject => 
      subject.typeClass === 'annotation-tag'
    );
    
    // 9. Render the ontology detail page with all collected data
    console.log('Rendering ontology detail page with collected data');
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata
      },
      downloadLinks,
      labelMap,
      hasAnnotationProperties,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getOntologyDetailPage:', err);
    next(err);
  }
};

/**
 * Fetch subjects defined in an ontology with enhanced metadata retrieval
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of subject objects with comprehensive metadata
 */
async function fetchOntologySubjects(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // First query to get all subjects defined in this ontology
    const subjectsQuery = `
      SELECT DISTINCT ?subject ?type WHERE {
        {
          # Get resources defined in this ontology
          ?subject <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          OPTIONAL { ?subject a ?type }
        } UNION {
          # Get resources with URIs that start with the ontology URI
          ?subject a ?type .
          FILTER(STRSTARTS(STR(?subject), STR(<${safeUri}>)))
        }
      }
      ORDER BY ?subject
      LIMIT 200
    `;
    
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query: subjectsQuery }
    });
    
    const subjects = [];
    const processedSubjects = new Set(); // To avoid duplicates
    
    if (response.data && response.data.results && response.data.results.bindings) {
      // Process the subjects and categorize them by type
      for (const binding of response.data.results.bindings) {
        if (binding.subject && binding.subject.value) {
          const subjectUri = binding.subject.value;
          
          // Skip if we've already processed this subject
          if (processedSubjects.has(subjectUri)) {
            continue;
          }
          
          processedSubjects.add(subjectUri);
          
          // Get the subject type
          let typeUri = null;
          if (binding.type && binding.type.value) {
            typeUri = binding.type.value;
          }
          
          // Initialize the subject object
          const subjectObj = {
            uri: subjectUri,
            type: typeUri,
            typeClass: 'default-tag',
            typeLabel: 'Resource'
          };
          
          // Determine resource type based on type URI and subject URI patterns
          if (typeUri) {
            if (typeUri.includes('Class') || subjectUri.includes('/Class')) {
              subjectObj.typeClass = 'class-tag';
              subjectObj.typeLabel = 'Class';
            } else if (typeUri.includes('ObjectProperty') || subjectUri.includes('ObjectProperty')) {
              subjectObj.typeClass = 'property-tag';
              subjectObj.typeLabel = 'Object Property';
            } else if (typeUri.includes('DatatypeProperty') || subjectUri.includes('DatatypeProperty')) {
              subjectObj.typeClass = 'data-property-tag';
              subjectObj.typeLabel = 'Datatype Property';
            } else if (typeUri.includes('AnnotationProperty') || subjectUri.includes('AnnotationProperty')) {
              subjectObj.typeClass = 'annotation-tag';
              subjectObj.typeLabel = 'Annotation Property';
            } else if (typeUri.includes('Property') || subjectUri.includes('Property')) {
              // Generic property if no specific type is identified
              subjectObj.typeClass = 'property-tag';
              subjectObj.typeLabel = 'Property';
            } else if (typeUri.includes('Individual') || typeUri.includes('NamedIndividual')) {
              subjectObj.typeClass = 'individual-tag';
              subjectObj.typeLabel = 'Individual';
            }
          } else {
            // Try to guess type from URI patterns if no explicit type
            if (subjectUri.includes('Property')) {
              subjectObj.typeClass = 'property-tag';
              subjectObj.typeLabel = 'Property';
            } else if (subjectUri.includes('Class')) {
              subjectObj.typeClass = 'class-tag'; 
              subjectObj.typeLabel = 'Class';
            }
          }
          
          // Add to the subjects array
          subjects.push(subjectObj);
        }
      }
    }
    
    // Now fetch additional metadata for each subject
    const enhancedSubjects = await Promise.all(
      subjects.map(async subject => {
        return await enrichSubjectWithMetadata(subject);
      })
    );
    
    console.log(`Found and enriched ${enhancedSubjects.length} subjects for ontology ${uri}`);
    return enhancedSubjects;
  } catch (error) {
    console.error('Error fetching ontology subjects:', error);
    return [];
  }
}

// Enhanced version of enrichSubjectWithMetadata function in controllers/ontologyController.js

async function enrichSubjectWithMetadata(subject) {
  try {
    const safeUri = sanitizeSparqlString(subject.uri);
    
    // Query for labels, comments, domains, ranges, and other metadata
    const metadataQuery = `
      SELECT ?p ?o WHERE {
        <${safeUri}> ?p ?o .
        FILTER(?p IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://www.w3.org/2000/01/rdf-schema#comment>,
          <http://purl.org/dc/terms/description>,
          <http://www.w3.org/2000/01/rdf-schema#domain>,
          <http://www.w3.org/2000/01/rdf-schema#range>,
          <http://www.w3.org/2000/01/rdf-schema#subClassOf>,
          <http://www.w3.org/2000/01/rdf-schema#subPropertyOf>,
          <http://www.w3.org/2002/07/owl#equivalentClass>,
          <http://www.w3.org/2002/07/owl#equivalentProperty>
        ))
      }
    `;
    
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query: metadataQuery }
    });
    
    // Extract the last part of the URI as a fallback label
    subject.label = subject.uri.split(/[/#]/).pop();
    
    if (response.data && response.data.results && response.data.results.bindings) {
      // Process each metadata property
      for (const binding of response.data.results.bindings) {
        const predicate = binding.p.value;
        const object = binding.o;
        
        switch (predicate) {
          case 'http://www.w3.org/2000/01/rdf-schema#label':
            subject.label = object.value;
            break;
            
          case 'http://www.w3.org/2000/01/rdf-schema#comment':
          case 'http://purl.org/dc/terms/description':
            subject.description = object.value;
            break;
            
          case 'http://www.w3.org/2000/01/rdf-schema#domain':
            if (!subject.domains) subject.domains = [];
            subject.domains.push({
              uri: object.value,
              label: object.value.split(/[/#]/).pop()
            });
            break;
            
          case 'http://www.w3.org/2000/01/rdf-schema#range':
            if (!subject.ranges) subject.ranges = [];
            subject.ranges.push({
              uri: object.value,
              label: object.value.split(/[/#]/).pop()
            });
            break;
            
          case 'http://www.w3.org/2000/01/rdf-schema#subClassOf':
            if (!subject.superClasses) subject.superClasses = [];
            subject.superClasses.push({
              uri: object.value,
              label: object.value.split(/[/#]/).pop()
            });
            break;
            
          case 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf':
            if (!subject.superProperties) subject.superProperties = [];
            subject.superProperties.push({
              uri: object.value,
              label: object.value.split(/[/#]/).pop()
            });
            break;
        }
      }
    }
    
    // If it's a property or class, get domain relationships
    if (subject.typeClass === 'property-tag' || subject.typeClass === 'data-property-tag' || 
        subject.typeClass === 'class-tag') {
      
      // Find classes/properties that have this as domain
      const inDomainQuery = `
        SELECT DISTINCT ?property ?propertyType WHERE {
          ?property <http://www.w3.org/2000/01/rdf-schema#domain> <${safeUri}> .
          OPTIONAL { ?property a ?propertyType }
        }
        LIMIT 25
      `;
      
      try {
        const domainResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query: inDomainQuery }
        });
        
        if (domainResponse.data && 
            domainResponse.data.results && 
            domainResponse.data.results.bindings && 
            domainResponse.data.results.bindings.length > 0) {
          
          subject.inDomainOf = domainResponse.data.results.bindings.map(binding => {
            return {
              uri: binding.property?.value,
              label: binding.property?.value.split(/[/#]/).pop(),
              type: binding.propertyType?.value
            };
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch domain relationships for ${subject.uri}: ${err.message}`);
      }
      
      // Find classes/properties that have this as range
      const inRangeQuery = `
        SELECT DISTINCT ?property ?propertyType WHERE {
          ?property <http://www.w3.org/2000/01/rdf-schema#range> <${safeUri}> .
          OPTIONAL { ?property a ?propertyType }
        }
        LIMIT 25
      `;
      
      try {
        const rangeResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query: inRangeQuery }
        });
        
        if (rangeResponse.data && 
            rangeResponse.data.results && 
            rangeResponse.data.results.bindings && 
            rangeResponse.data.results.bindings.length > 0) {
          
          subject.inRangeOf = rangeResponse.data.results.bindings.map(binding => {
            return {
              uri: binding.property?.value,
              label: binding.property?.value.split(/[/#]/).pop(),
              type: binding.propertyType?.value
            };
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch range relationships for ${subject.uri}: ${err.message}`);
      }
      
      // Find classes that this is a superclass of (only for class-tag)
      if (subject.typeClass === 'class-tag') {
        const subClassQuery = `
          SELECT DISTINCT ?subClass ?subClassType WHERE {
            ?subClass <http://www.w3.org/2000/01/rdf-schema#subClassOf> <${safeUri}> .
            OPTIONAL { ?subClass a ?subClassType }
          }
          LIMIT 25
        `;
        
        try {
          const subClassResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
            headers: { 'Accept': 'application/sparql-results+json' },
            params: { query: subClassQuery }
          });
          
          if (subClassResponse.data && 
              subClassResponse.data.results && 
              subClassResponse.data.results.bindings && 
              subClassResponse.data.results.bindings.length > 0) {
            
            subject.subClasses = subClassResponse.data.results.bindings.map(binding => {
              return {
                uri: binding.subClass?.value,
                label: binding.subClass?.value.split(/[/#]/).pop(),
                type: binding.subClassType?.value
              };
            });
          }
        } catch (err) {
          console.warn(`Failed to fetch subclass relationships for ${subject.uri}: ${err.message}`);
        }
      }
    }
    
    // If it's a property, get examples of its usage if available
    if (subject.typeClass === 'property-tag' || subject.typeClass === 'data-property-tag') {
      const examplesQuery = `
        SELECT ?subject ?object WHERE {
          ?subject <${safeUri}> ?object .
        }
        LIMIT 5
      `;
      
      try {
        const examplesResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query: examplesQuery }
        });
        
        if (examplesResponse.data && 
            examplesResponse.data.results && 
            examplesResponse.data.results.bindings && 
            examplesResponse.data.results.bindings.length > 0) {
          
          subject.examples = examplesResponse.data.results.bindings.map(example => {
            return {
              subject: example.subject?.value,
              subjectLabel: example.subject?.value.split(/[/#]/).pop(),
              object: example.object?.value,
              objectLabel: example.object?.value.split(/[/#]/).pop()
            };
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch examples for ${subject.uri}: ${err.message}`);
      }
    }
    
    return subject;
  } catch (error) {
    console.error(`Error enriching subject ${subject.uri}:`, error);
    return subject; // Return the original subject if enrichment fails
  }
}
/**
 * Fetch description for a resource
 * @param {string} uri - Resource URI
 * @returns {Promise<string>} - Resource description
 */
async function fetchResourceDescription(uri) {
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
    
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    if (response.data && response.data.results && response.data.results.bindings.length > 0) {
      return response.data.results.bindings[0].description.value;
    }
    
    return '';
  } catch (error) {
    console.error(`Error fetching description for ${uri}:`, error);
    return '';
  }
}

/**
 * Handle ontology download request
 */
exports.downloadOntology = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    const format = req.query.format || 'rdf';
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided',
        showLabels: req.showLabels,
        showLabelsToggleState: req.showLabels ? 'false' : 'true'
      });
    }
    
    // Get the appropriate download URL for the requested format
    const downloadUrl = ontologyService.getDownloadUrl(uri, formatToMimeType(format));
    
    // Redirect to the GraphDB download URL
    res.redirect(downloadUrl);
  } catch (err) {
    next(err);
  }
};

/**
 * Convert format string to MIME type
 */
function formatToMimeType(format) {
  const mimeTypes = {
    'rdf': 'application/rdf+xml',
    'ttl': 'text/turtle',
    'nt': 'text/plain',
    'jsonld': 'application/ld+json'
  };
  
  return mimeTypes[format] || 'application/rdf+xml';
}

/**
 * Get ontology products page
 */
exports.getOntologyProducts = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided',
        showLabels: req.showLabels,
        showLabelsToggleState: req.showLabels ? 'false' : 'true'
      });
    }
    
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    const products = await productService.fetchProductsByOntology(uri);
    
    res.render('ontology-products', {
      title: `Products for ${metadata.title}`,
      ontology: {
        uri,
        title: metadata.title
      },
      products,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Test download functionality
 */
exports.testDownload = (req, res) => {
  res.send('Download test successful');
};

/**
 * Return supported ontology formats
 */
exports.getSupportedFormats = (req, res) => {
  res.json({
    formats: [
      { id: 'rdf', name: 'RDF/XML', mimeType: 'application/rdf+xml' },
      { id: 'ttl', name: 'Turtle', mimeType: 'text/turtle' },
      { id: 'nt', name: 'N-Triples', mimeType: 'text/plain' },
      { id: 'jsonld', name: 'JSON-LD', mimeType: 'application/ld+json' }
    ]
  });
};

/**
 * Get ontology triples in JSON format
 */
exports.getOntologyTriples = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).json({
        error: 'No ontology URI provided',
        message: 'An ontology URI is required to fetch triples'
      });
    }
    
    const triples = await fetchOntologyTriples(uri);
    
    res.json({
      uri,
      triples,
      count: triples.length
    });
  } catch (err) {
    console.error('Error in getOntologyTriples:', err);
    res.status(500).json({
      error: 'Server error',
      message: err.message
    });
  }
};

/**
 * Fetch SPO triples for an ontology
 * @param {string} uri - Ontology URI
 * @returns {Promise<Array>} - Array of SPO triple objects
 */
async function fetchOntologyTriples(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to fetch SPO triples for this ontology
    const triplesQuery = `
      SELECT ?s ?p ?o WHERE {
        {
          ?s ?p ?o .
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
        } UNION {
          ?s ?p ?o .
          FILTER(STRSTARTS(STR(?s), STR(<${safeUri}>)))
        }
      }
      ORDER BY ?s ?p ?o
      LIMIT 100
    `;
    
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query: triplesQuery }
    });
    
    const triples = [];
    
    if (response.data && response.data.results && response.data.results.bindings) {
      response.data.results.bindings.forEach(binding => {
        if (binding.s && binding.p && binding.o) {
          triples.push({
            s: binding.s,
            p: binding.p,
            o: binding.o
          });
        }
      });
    }
    
    return triples;
  } catch (error) {
    console.error('Error fetching ontology triples:', error);
    return [];
  }
}

// Export the additional functions so they can be used by other modules if needed
exports.fetchOntologySubjects = fetchOntologySubjects;
exports.fetchOntologyTriples = fetchOntologyTriples;
exports.fetchResourceDescription = fetchResourceDescription;