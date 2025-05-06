// controllers/ontologyController.js - Fixed version
const ontologyService = require('../services/ontologyService');
const labelService = require('../services/labelService');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');

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
    
    // Fetch ontology metadata
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    
    // Fetch classes for this ontology
    const classes = await ontologyService.fetchOntologyClasses(uri);
    
    // Add classes to metadata
    metadata.classes = classes;
    
    // Fetch properties organized by type
    const properties = await ontologyService.fetchOntologyProperties(uri);
    metadata.properties = properties;
    
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
      
      // Add class URIs
      classes.forEach(cls => {
        urisToLabel.push(cls.uri);
      });
      
      // Add property URIs and their domains/ranges
      Object.values(metadata.properties).forEach(propGroup => {
        propGroup.forEach(prop => {
          urisToLabel.push(prop.uri);
          if (prop.domain) urisToLabel.push(prop.domain);
          if (prop.range) urisToLabel.push(prop.range);
        });
      });
      
      // Add related ontology URIs
      if (metadata.relatedOntologies) {
        metadata.relatedOntologies.forEach(ontology => {
          urisToLabel.push(ontology.uri);
        });
      }
      
      // Fetch labels
      labelMap = await labelService.fetchLabelsForUris(urisToLabel);
      
      // Update classes with fetched labels
      classes.forEach(cls => {
        if (labelMap[cls.uri]) {
          cls.label = labelMap[cls.uri];
        }
      });
      
      // Update properties with fetched labels
      Object.keys(metadata.properties).forEach(propType => {
        metadata.properties[propType].forEach(prop => {
          // Update property label
          if (labelMap[prop.uri]) {
            prop.label = labelMap[prop.uri];
          }
          
          // Update domain and range labels if they exist
          if (prop.domain && labelMap[prop.domain]) {
            prop.domainLabel = labelMap[prop.domain];
          }
          
          if (prop.range && labelMap[prop.range]) {
            prop.rangeLabel = labelMap[prop.range];
          }
        });
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
    
    console.log('Rendering ontology detail page with data:', {
      uri,
      title: metadata.title,
      classCount: classes.length,
      relatedCount: metadata.relatedOntologies?.length || 0
    });
    
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
    
    const data = await ontologyService.executeQuery(triplesQuery);
    
    const triples = [];
    
    if (data && data.results && data.results.bindings) {
      data.results.bindings.forEach(binding => {
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
    // This should be replaced with a call to the productService
    const products = [];
    
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
    // This should be replaced with a call to the productService
    const products = [];
    
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