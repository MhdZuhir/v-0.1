// controllers/ontologyController.js
const ontologyService = require('../services/ontologyService');
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
    
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata
      },
      downloadLinks,
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
      'rdf': { contentType: 'application/rdf+xml', extension: 'rdf', mimeType: 'application/rdf+xml' },
      'ttl': { contentType: 'text/turtle', extension: 'ttl', mimeType: 'text/turtle' },
      'nt': { contentType: 'application/n-triples', extension: 'nt', mimeType: 'text/plain' },
      'jsonld': { contentType: 'application/ld+json', extension: 'jsonld', mimeType: 'application/ld+json' }
    };
    
    const formatInfo = formatMap[format] || formatMap['rdf']; // Default to RDF if invalid format
    
    // Get the ontology metadata for a better filename
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    
    // Generate sanitized filename base from the ontology title
    const filenameBase = metadata.title ? 
      metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() :
      'ontology';
    
    const filename = `${filenameBase}.${formatInfo.extension}`;
    
    // Create the GraphDB URL for fetching the ontology data
    const graphdbUrl = `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}/statements`;
    
    try {
      // Fetch the data from GraphDB
      const response = await axios.get(graphdbUrl, {
        params: {
          infer: false,
          context: `<${uri}>`,
          format: formatInfo.mimeType
        },
        responseType: 'stream',
        headers: {
          'Accept': formatInfo.contentType
        }
      });
      
      // Set the response headers for proper download
      res.setHeader('Content-Type', formatInfo.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Pipe the response stream to the client
      response.data.pipe(res);
    } catch (error) {
      console.error('Error fetching ontology data from GraphDB:', error);
      return res.status(500).render('error', {
        title: 'Error',
        message: 'Failed to retrieve ontology data'
      });
    }
  } catch (err) {
    next(err);
  }
};