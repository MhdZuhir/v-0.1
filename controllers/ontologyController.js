// controllers/ontologyController.js
const ontologyService = require('../services/ontologyService');

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
    
    // Generate download links for different formats
    const downloadLinks = [
      { format: 'RDF/XML', url: ontologyService.getDownloadUrl(uri, 'application/rdf+xml'), extension: 'rdf' },
      { format: 'Turtle', url: ontologyService.getDownloadUrl(uri, 'text/turtle'), extension: 'ttl' },
      { format: 'N-Triples', url: ontologyService.getDownloadUrl(uri, 'text/plain'), extension: 'nt' },
      { format: 'JSON-LD', url: ontologyService.getDownloadUrl(uri, 'application/ld+json'), extension: 'jsonld' }
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