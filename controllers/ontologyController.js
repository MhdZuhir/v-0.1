// controllers/ontologyController.js
const ontologyService = require('../services/ontologyService');
const productService = require('../services/productService');
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
    
    // Fetch products related to this ontology
    const relatedProducts = await productService.fetchProductsByOntology(uri);
    
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata
      },
      downloadLinks,
      relatedProducts,
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
 * Handle test download for debugging
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