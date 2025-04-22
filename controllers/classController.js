// controllers/classController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');
const { isSystemResource } = require('../utils/uriUtils');
const { sanitizeSparqlString } = require('../utils/sparqlUtils');
const axios = require('axios');
const { graphdbConfig } = require('../config/db');

/**
 * Handle class page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getClassPage = async (req, res, next) => {
  try {
    const classUri = req.query.uri;
    
    if (!classUri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Ingen klass-URI angiven'
      });
    }
    
    if (isSystemResource(classUri)) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Systemklasser kan inte visas'
      });
    }
    
    // Fetch basic class information
    const classInfo = await graphdbService.fetchClassInfo(classUri);
    
    // Fetch individuals belonging to this class
    const individuals = await graphdbService.fetchClassIndividuals(classUri);
    
    // Get labels if needed
    let labelMap = {};
    if (req.showLabels) {
      const uris = [classUri, ...individuals.map(item => item.uri)];
      // Add property URIs
      individuals.forEach(individual => {
        if (individual.properties) {
          individual.properties.forEach(prop => {
            if (prop.predicateUri) uris.push(prop.predicateUri);
            if (prop.objectUri) uris.push(prop.objectUri);
          });
        }
      });
      labelMap = await labelService.fetchLabelsForUris(uris);
    }
    
    res.render('class', {
      title: req.showLabels && labelMap[classUri] ? labelMap[classUri] : classUri.split(/[/#]/).pop(),
      classUri,
      classLabel: req.showLabels && labelMap[classUri] ? labelMap[classUri] : classUri.split(/[/#]/).pop(),
      classInfo,
      individuals: individuals.map(individual => ({
        ...individual,
        label: req.showLabels && labelMap[individual.uri] ? labelMap[individual.uri] : individual.uri.split(/[/#]/).pop(),
        properties: individual.properties.map(prop => ({
          ...prop,
          predicateLabel: req.showLabels && labelMap[prop.predicateUri] ? labelMap[prop.predicateUri] : prop.predicateUri.split(/[/#]/).pop(),
          objectLabel: prop.objectUri && req.showLabels && labelMap[prop.objectUri] ? labelMap[prop.objectUri] : prop.objectValue
        }))
      })),
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getClassPage:', err);
    next(err);
  }
};

/**
 * Handle individual detail page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getIndividualPage = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Ingen individ-URI angiven'
      });
    }
    
    if (isSystemResource(uri)) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Systemresurser kan inte visas'
      });
    }
    
    // Fetch all properties of this individual
    const properties = await graphdbService.fetchResourceProperties(uri);
    
    // Fetch individual's classes
    const classes = await graphdbService.fetchResourceTypes(uri);
    
    // Fetch related resources
    const related = await graphdbService.fetchRelatedResources(uri);
    
    // Get labels if needed
    let labelMap = {};
    if (req.showLabels) {
      const uris = [uri, ...classes, ...related];
      
      // Add property URIs
      properties.forEach(prop => {
        if (prop.predicate?.type === 'uri') uris.push(prop.predicate.value);
        if (prop.object?.type === 'uri') uris.push(prop.object.value);
      });
      
      labelMap = await labelService.fetchLabelsForUris(uris);
    }
    
    res.render('individual', {
      title: req.showLabels && labelMap[uri] ? labelMap[uri] : uri.split(/[/#]/).pop(),
      uri,
      individualLabel: req.showLabels && labelMap[uri] ? labelMap[uri] : uri.split(/[/#]/).pop(),
      classes: classes.map(classUri => ({
        uri: classUri,
        label: req.showLabels && labelMap[classUri] ? labelMap[classUri] : classUri.split(/[/#]/).pop()
      })),
      properties,
      related: related.map(relatedUri => ({
        uri: relatedUri,
        label: req.showLabels && labelMap[relatedUri] ? labelMap[relatedUri] : relatedUri.split(/[/#]/).pop()
      })),
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getIndividualPage:', err);
    next(err);
  }
};

/**
 * Handle browse classes page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.browseClassesPage = async (req, res, next) => {
  try {
    const classType = req.query.classType || 'owl'; // 'owl', 'rdfs', or 'all'
    const filter = req.query.filter || '';
    
    let classTypeUri = '';
    switch (classType) {
      case 'owl':
        classTypeUri = '<http://www.w3.org/2002/07/owl#Class>';
        break;
      case 'rdfs':
        classTypeUri = '<http://www.w3.org/2000/01/rdf-schema#Class>';
        break;
      default:
        classTypeUri = '?classType';
        break;
    }
    
    // Build query based on parameters
    let query = `
      SELECT DISTINCT ?class WHERE {
        ?class a ${classTypeUri} .
    `;
    
    // Add filter if provided
    if (filter) {
      const safeFilter = sanitizeSparqlString(filter);
      query += `
        FILTER(
          CONTAINS(LCASE(STR(?class)), LCASE("${safeFilter}"))
          ${req.showLabels ? `|| EXISTS { ?class <http://www.w3.org/2000/01/rdf-schema#label> ?label . FILTER(CONTAINS(LCASE(?label), LCASE("${safeFilter}"))) }` : ''}
        )
      `;
    }
    
    // Filter out system classes
    query += `
        FILTER(!STRSTARTS(STR(?class), "http://www.w3.org/1999/02/22-rdf-syntax-ns#"))
        FILTER(!STRSTARTS(STR(?class), "http://www.w3.org/2000/01/rdf-schema#"))
        FILTER(!STRSTARTS(STR(?class), "http://www.w3.org/2002/07/owl#"))
      }
      ORDER BY ?class
      LIMIT 100
    `;
    
    // Execute query
    const response = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    const classUris = [];
    if (response.data && response.data.results && response.data.results.bindings) {
      response.data.results.bindings.forEach(binding => {
        if (binding.class && binding.class.value) {
          classUris.push(binding.class.value);
        }
      });
    }
    
    // Get details for each class
    const classDetails = await Promise.all(
      classUris.map(async uri => {
        try {
          // Get class info
          const info = await graphdbService.fetchClassInfo(uri);
          
          // Count individuals
          const countQuery = `
            SELECT (COUNT(DISTINCT ?individual) AS ?count) WHERE {
              ?individual a <${uri}> .
            }
          `;
          const countResponse = await axios.get(`${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`, {
            headers: { 'Accept': 'application/sparql-results+json' },
            params: { query: countQuery }
          });
          
          let individualCount = 0;
          if (countResponse.data && 
              countResponse.data.results && 
              countResponse.data.results.bindings && 
              countResponse.data.results.bindings.length > 0 &&
              countResponse.data.results.bindings[0].count) {
            individualCount = parseInt(countResponse.data.results.bindings[0].count.value, 10);
          }
          
          return {
            uri,
            label: info?.label || uri.split(/[/#]/).pop() || uri,
            description: info?.description || null,
            individualCount
          };
        } catch (err) {
          console.error(`Error fetching details for class ${uri}:`, err);
          return {
            uri,
            label: uri.split(/[/#]/).pop() || uri,
            description: null,
            individualCount: 0
          };
        }
      })
    );
    
    // Get labels if needed
    if (req.showLabels) {
      const labelMap = await labelService.fetchLabelsForUris(classUris);
      
      // Update labels
      classDetails.forEach(details => {
        if (labelMap[details.uri]) {
          details.label = labelMap[details.uri];
        }
      });
    }
    
    res.render('browse-classes', {
      title: 'Bläddra i klasser',
      classType,
      filter,
      classes: classDetails,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in browseClassesPage:', err);
    next(err);
  }
};