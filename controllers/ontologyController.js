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
 * Handle ontology detail page request
 */
exports.getOntologyDetailPage = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided'
      });
    }
    
    console.log(`Fetching ontology details for: ${uri}`);
    
    // Fetch enhanced metadata with classes and properties
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    
    // Fetch related ontologies
    const relatedOntologies = await ontologyService.fetchRelatedOntologies(uri);
    metadata.relatedOntologies = relatedOntologies;
    
    // Generate download links for different formats
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
    
    // Fetch labels for all URIs if needed
    let labelMap = {};
    if (req.showLabels) {
      // Collect all URIs that need labels
      const urisToLabel = [uri];
      
      // Add class URIs
      metadata.classes.forEach(cls => {
        urisToLabel.push(cls.uri);
      });
      
      // Add property URIs and their domains/ranges
      if (metadata.properties.objectProperties) {
        metadata.properties.objectProperties.forEach(prop => {
          urisToLabel.push(prop.uri);
          if (prop.domain) urisToLabel.push(prop.domain);
          if (prop.range) urisToLabel.push(prop.range);
        });
      }
      
      if (metadata.properties.datatypeProperties) {
        metadata.properties.datatypeProperties.forEach(prop => {
          urisToLabel.push(prop.uri);
          if (prop.domain) urisToLabel.push(prop.domain);
        });
      }
      
      if (metadata.properties.annotationProperties) {
        metadata.properties.annotationProperties.forEach(prop => {
          urisToLabel.push(prop.uri);
        });
      }
      
      // Add related ontology URIs
      metadata.relatedOntologies.forEach(ont => {
        urisToLabel.push(ont.uri);
      });
      
      // Fetch labels
      labelMap = await labelService.fetchLabelsForUris(urisToLabel);
      console.log(`Fetched ${Object.keys(labelMap).length} labels for ontology detail page`);
    }
    
    // Render the ontology detail page
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata
      },
      downloadLinks,
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getOntologyDetailPage:', err);
    next(err);
  }
};

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
        message: 'No ontology URI provided'
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
 * Rebuild product index
 */
exports.rebuildProductIndex = async (req, res, next) => {
  try {
    const products = await productService.detectProducts();
    
    res.render('rebuild-results', {
      title: 'Product Index Rebuilt',
      products,
      count: products.length,
      timestamp: new Date().toISOString(),
      showLabels: req.showLabels
    });
  } catch (err) {
    next(err);
  }
};
// controllers/ontologyController.js - Update to include related ontologies

/**
 * Handle ontology detail page request
 */
exports.getOntologyDetailPage = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided'
      });
    }
    
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    
    // Fetch subjects for this ontology
    const subjects = await fetchOntologySubjects(uri);
    
    // Add subjects to metadata
    metadata.subjects = subjects;
    
    // Fetch related ontologies
    const relatedOntologies = await ontologyService.fetchRelatedOntologies(uri);
    metadata.relatedOntologies = relatedOntologies;
    
    // Generate sanitized filename base from the ontology title
    const filenameBase = metadata.title ? 
      metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() :
      'ontology';
    
    // Generate download links for different formats
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
    
    // Fetch labels for all URIs if needed
    let labelMap = {};
    if (req.showLabels) {
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
    }
    
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata,
        subjects: subjects
      },
      downloadLinks,
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getOntologyDetailPage:', err);
    next(err);
  }
};
/**
 * Get ontology products page
 */
exports.getOntologyProducts = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided'
      });
    }
    
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    const products = await ontologyService.fetchProductsForOntology(uri);
    
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
 * Debug products page
 */
exports.debugProducts = async (req, res, next) => {
  try {
    const products = await productService.detectProducts();
    
    res.render('debug-products', {
      title: 'Debug Products',
      products,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rebuild product index
 */
exports.rebuildProductIndex = async (req, res, next) => {
  try {
    const products = await productService.detectProducts();
    
    res.render('rebuild-results', {
      title: 'Product Index Rebuilt',
      products,
      count: products.length,
      timestamp: new Date().toISOString(),
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};