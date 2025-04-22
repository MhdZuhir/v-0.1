// controllers/ontologyController.js
const ontologyService = require('../services/ontologyService');
const productService = require('../services/productService');
const labelService = require('../services/labelService');
const axios = require('axios');
const { graphdbConfig } = require('../config/db');

/**
 * Handle ontology list page request (home page)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getOntologyListPage = async (req, res, next) => {
  try {
    const ontologies = await ontologyService.fetchOntologies();
    
    res.render('home', {
      title: 'Ontology Browser',
      ontologies,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle ontology detail page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
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
    
    // Fetch additional data for enhanced ontology view
    let products = [];
    let relationships = [];
    let labelMap = {};
    
    try {
      // Get products related to this ontology 
      if (!metadata.products) {
        products = await ontologyService.fetchProductsForOntology(uri);
      } else {
        products = metadata.products;
      }
      
      // Get relationships defined in this ontology
      if (!metadata.relationships) {
        relationships = await ontologyService.fetchOntologyRelationships(uri);
      } else {
        relationships = metadata.relationships;
      }
      
      // Fetch labels for all URIs if needed
      if (req.showLabels) {
        // Collect all URIs that need labels
        const urisToLabel = [uri];
        
        // Add product URIs 
        products.forEach(product => {
          urisToLabel.push(product.uri);
          if (product.type) urisToLabel.push(product.type);
        });
        
        // Add relationship URIs
        relationships.forEach(rel => {
          urisToLabel.push(rel.property.uri);
          if (rel.domain.uri) urisToLabel.push(rel.domain.uri);
          if (rel.range.uri) urisToLabel.push(rel.range.uri);
        });
        
        // Fetch labels
        labelMap = await labelService.fetchLabelsForUris(urisToLabel);
        
        // Update with fetched labels
        products = products.map(product => ({
          ...product,
          name: labelMap[product.uri] || product.name,
          typeLabel: product.type && labelMap[product.type] ? labelMap[product.type] : undefined
        }));
        
        relationships = relationships.map(rel => ({
          property: {
            uri: rel.property.uri,
            label: labelMap[rel.property.uri] || rel.property.label
          },
          domain: {
            uri: rel.domain.uri,
            label: rel.domain.uri && labelMap[rel.domain.uri] ? labelMap[rel.domain.uri] : rel.domain.label
          },
          range: {
            uri: rel.range.uri,
            label: rel.range.uri && labelMap[rel.range.uri] ? labelMap[rel.range.uri] : rel.range.label
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching additional ontology data:', error);
      // Continue with what we have even if there was an error
    }
    
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata,
        products: products || [],
        relationships: relationships || []
      },
      downloadLinks,
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle ontology download request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.downloadOntology = async (req, res, next) => {
  try {
    const { uri, format } = req.query;
    
    if (!uri || !format) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Missing required parameters'
      });
    }
    
    // Map the format parameter to the correct MIME type and file extension
    const formatMap = {
      'rdf': { contentType: 'application/rdf+xml', extension: 'rdf', acceptHeader: 'application/rdf+xml' },
      'ttl': { contentType: 'text/turtle', extension: 'ttl', acceptHeader: 'text/turtle' },
      'nt': { contentType: 'application/n-triples', extension: 'nt', acceptHeader: 'application/n-triples' },
      'jsonld': { contentType: 'application/ld+json', extension: 'jsonld', acceptHeader: 'application/ld+json' }
    };
    
    const formatInfo = formatMap[format] || formatMap['rdf']; // Default to RDF if invalid format
    
    // Get the ontology metadata for a better filename
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    
    // Generate sanitized filename base from the ontology title
    const filenameBase = metadata.title ? 
      metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() :
      'ontology';
    
    const filename = `${filenameBase}.${formatInfo.extension}`;
    
    // Create a SPARQL CONSTRUCT query instead of using the statements endpoint
    const constructQuery = `
      CONSTRUCT {
        ?s ?p ?o
      } WHERE {
        {
          # Get triples where the ontology URI is the subject
          <${uri}> ?p ?o .
          BIND(<${uri}> AS ?s)
        } UNION {
          # Get triples for classes defined in this ontology
          ?s a ?type .
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${uri}> .
          ?s ?p ?o .
          FILTER(?type IN (<http://www.w3.org/2002/07/owl#Class>, <http://www.w3.org/2000/01/rdf-schema#Class>))
        } UNION {
          # Get triples for properties defined in this ontology
          ?s a ?type .
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${uri}> .
          ?s ?p ?o .
          FILTER(?type IN (<http://www.w3.org/2002/07/owl#ObjectProperty>, <http://www.w3.org/2002/07/owl#DatatypeProperty>, <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property>))
        } UNION {
          # Get triples for individuals defined in this ontology
          ?s a ?type .
          ?s <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${uri}> .
          ?s ?p ?o .
          FILTER(?type IN (<http://www.w3.org/2002/07/owl#NamedIndividual>))
        } UNION {
          # Get triples based on namespace
          ?s ?p ?o .
          FILTER(STRSTARTS(STR(?s), STR(<${uri}>)))
        }
      }
    `;
    
    try {
      console.log(`Executing CONSTRUCT query for ontology download: ${uri} in format ${format}`);
      
      // Use the CONSTRUCT query approach instead of statements endpoint
      const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
        params: {
          query: constructQuery
        },
        responseType: 'stream',
        headers: {
          'Accept': formatInfo.acceptHeader
        }
      });
      
      // Check if the response is valid
      if (response.status !== 200) {
        throw new Error(`GraphDB returned status code ${response.status}`);
      }
      
      // Add some debugging to capture empty responses
      let chunks = [];
      let hasData = false;
      let responseComplete = false;
      
      response.data.on('data', chunk => {
        hasData = true;
        chunks.push(chunk);
      });
      
      response.data.on('end', () => {
        responseComplete = true;
        
        // If we got no data at all, log this and return an error
        if (!hasData || (chunks.length === 0)) {
          console.error(`Empty response from GraphDB for ontology ${uri} in format ${format}`);
          // Only send error if we haven't already sent headers
          if (!res.headersSent) {
            res.status(404).render('error', {
              title: 'Error',
              message: 'No data was returned for the requested ontology. The ontology may not exist or may not have any triples.'
            });
          }
          return;
        }
        
        // Otherwise, send the response to the client if we haven't already
        if (!res.headersSent) {
          // Set the response headers for proper download
          res.setHeader('Content-Type', formatInfo.contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          
          // Create a new stream from our chunks and pipe it to the response
          const { Readable } = require('stream');
          const dataStream = new Readable();
          chunks.forEach(chunk => dataStream.push(chunk));
          dataStream.push(null); // Signal the end of the stream
          dataStream.pipe(res);
        }
      });
      
      response.data.on('error', (err) => {
        console.error(`Stream error for ontology ${uri} in format ${format}:`, err);
        if (!res.headersSent) {
          res.status(500).render('error', {
            title: 'Error',
            message: 'Error streaming data from GraphDB: ' + err.message
          });
        }
      });
      
      // Set a timeout to catch perpetually pending responses
      setTimeout(() => {
        if (!responseComplete && !res.headersSent) {
          console.error(`Request timed out for ontology ${uri} in format ${format}`);
          res.status(504).render('error', {
            title: 'Error',
            message: 'Request timed out waiting for data from GraphDB'
          });
        }
      }, 30000); // 30 second timeout
    } catch (error) {
      console.error('Error fetching ontology data from GraphDB:', error);
      return res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to retrieve ontology data: ' + error.message
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Fetch object relationships for an ontology
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getOntologyRelationships = async (req, res, next) => {
  try {
    const { uri } = req.query;
    
    if (!uri) {
      return res.status(400).json({
        error: 'Missing ontology URI parameter'
      });
    }
    
    const relationships = await ontologyService.fetchOntologyRelationships(uri);
    
    res.json({
      uri,
      relationships,
      count: relationships.length
    });
  } catch (err) {
    console.error('Error getting ontology relationships:', err);
    res.status(500).json({
      error: 'Failed to fetch relationships: ' + err.message
    });
  }
};

/**
 * Fetch products associated with an ontology
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getOntologyProducts = async (req, res, next) => {
  try {
    const { uri } = req.query;
    
    if (!uri) {
      return res.status(400).json({
        error: 'Missing ontology URI parameter'
      });
    }
    
    const products = await ontologyService.fetchProductsForOntology(uri);
    
    res.json({
      uri,
      products,
      count: products.length
    });
  } catch (err) {
    console.error('Error getting ontology products:', err);
    res.status(500).json({
      error: 'Failed to fetch products: ' + err.message
    });
  }
};

/**
 * Test download route for debugging
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.testDownload = (req, res) => {
  const { format = 'ttl' } = req.query;
  
  const formatMap = {
    'rdf': { 
      contentType: 'application/rdf+xml', 
      data: '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:ex="http://example.org/"><rdf:Description rdf:about="http://example.org/test"><rdf:type rdf:resource="http://example.org/Test"/></rdf:Description></rdf:RDF>' 
    },
    'ttl': { 
      contentType: 'text/turtle', 
      data: '@prefix ex: <http://example.org/> .\n@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .\n\nex:test rdf:type ex:Test .\n' 
    },
    'nt': { 
      contentType: 'application/n-triples', 
      data: '<http://example.org/test> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://example.org/Test> .\n' 
    },
    'jsonld': { 
      contentType: 'application/ld+json', 
      data: '{\n  "@context": {\n    "ex": "http://example.org/",\n    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"\n  },\n  "@id": "ex:test",\n  "@type": "ex:Test"\n}\n' 
    }
  };
  
  const formatInfo = formatMap[format] || formatMap['ttl'];
  
  res.setHeader('Content-Type', formatInfo.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="test.${format}"`);
  res.send(formatInfo.data);
};

/**
 * Get supported formats from GraphDB
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getSupportedFormats = async (req, res) => {
  try {
    const formatResponse = await axios.get(`${graphdbConfig.endpoint}/protocol`);
    res.json(formatResponse.data);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      endpoint: graphdbConfig.endpoint
    });
  }
};
// controllers/ontologyController.js - Add these additional functions

/**
 * Debug endpoint to list all products
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.debugProducts = async (req, res, next) => {
  try {
    const allProducts = await productService.fetchProducts();
    
    res.render('debug-products', {
      title: 'Debug Products',
      products: allProducts,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * View products related to a specific ontology
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
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
    const products = await productService.fetchProductsByOntology(uri);
    
    res.render('ontology-products', {
      title: `Products for ${metadata.title || 'Ontology'}`,
      ontology: {
        uri,
        title: metadata.title || uri.split(/[/#]/).pop() || uri
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
 * Rebuild product index by scanning for common product patterns
 * This improved version actually scans the database for products
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.rebuildProductIndex = async (req, res, next) => {
  try {
    // First, detect products using the enhanced detection method
    // This assumes you've added the detectProducts function to productService
    console.log('Starting product index rebuild...');
    const detectedProducts = await productService.detectProducts();
    
    console.log(`Detection complete. Found ${detectedProducts.length} products.`);
    
    // Render a results page instead of just redirecting
    res.render('rebuild-results', {
      title: 'Product Index Rebuild',
      products: detectedProducts,
      count: detectedProducts.length,
      timestamp: new Date().toISOString(),
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in rebuildProductIndex:', err);
    next(err);
  }
};