// app.js
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000;
const graphdbEndpoint = process.env.GRAPHDB_ENDPOINT || 'http://localhost:7200';
const graphdbRepository = process.env.GRAPHDB_REPOSITORY || 'ontologi2025';

// Configure view engine
app.engine('handlebars', engine({
  helpers: {
    eq: (a, b) => a === b,
    encodeURIComponent: (str) => encodeURIComponent(str),
    lookup: (obj, field) => obj[field],
    getDisplayValue: (cell, showLabels, labelMap) => {
      if (cell && cell.type === 'uri' && showLabels && labelMap && labelMap[cell.value]) {
        return labelMap[cell.value];
      }
      return cell ? cell.value : '';
    },
    getValueType: (cell) => {
      return cell ? cell.type : '';
    },
    // Helper to get the icon CSS class based on label/type
    getIconClass: (label) => {
      label = (label || '').toLowerCase();
      if (label.includes('person') || label.includes('människa')) return 'icon-person';
      if (label.includes('place') || label.includes('plats')) return 'icon-place';
      if (label.includes('event') || label.includes('händelse')) return 'icon-event';
      if (label.includes('organization') || label.includes('organisation')) return 'icon-organization';
      if (label.includes('concept') || label.includes('begrepp')) return 'icon-concept';
      return 'icon-default';
    },
    // Helper for truncating text
    truncate: (text, length) => {
      if (!text) return '';
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    }
  }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Utility function for safe SPARQL queries
function sanitizeSparqlString(str) {
  if (!str) return '';
  return str.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

// Fetch human-readable labels for URIs
async function fetchLabelsForUris(uris) {
  if (!uris || uris.length === 0) return {};
  
  const labelMap = {};
  
  try {
    // Prepare SPARQL query to get labels for all URIs at once
    const uriValues = uris.map(uri => `<${uri}>`).join(' ');
    const query = `
      SELECT ?uri ?label WHERE {
        VALUES ?uri { ${uriValues} }
        ?uri ?labelProperty ?label .
        FILTER(?labelProperty IN (
          <http://www.w3.org/2000/01/rdf-schema#label>,
          <http://www.w3.org/2004/02/skos/core#prefLabel>,
          <http://purl.org/dc/elements/1.1/title>,
          <http://purl.org/dc/terms/title>,
          <http://www.w3.org/2004/02/skos/core#altLabel>
        ))
        FILTER(LANG(?label) = "" || LANG(?label) = "sv" || LANG(?label) = "en")
      }
    `;
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    
    // Create a Map to store labels by URI and language
    const uriLabels = new Map();
    
    // Process all bindings
    for (const binding of bindings) {
      const uri = binding.uri.value;
      const label = binding.label.value;
      const lang = binding.label['xml:lang'] || '';
      
      if (!uriLabels.has(uri)) {
        uriLabels.set(uri, {});
      }
      
      // Store label by language priority (sv > en > no-lang)
      if (lang === 'sv') {
        uriLabels.get(uri).sv = label;
      } else if (lang === 'en' && !uriLabels.get(uri).sv) {
        uriLabels.get(uri).en = label;
      } else if (!lang && !uriLabels.get(uri).sv && !uriLabels.get(uri).en) {
        uriLabels.get(uri).none = label;
      }
    }
    
    // Build final label map with prioritized languages
    for (const uri of uris) {
      const labels = uriLabels.get(uri) || {};
      
      // Use label in priority order: Swedish, English, no language
      // If no label is found, use the last part of the URI
      if (labels.sv) {
        labelMap[uri] = labels.sv;
      } else if (labels.en) {
        labelMap[uri] = labels.en;
      } else if (labels.none) {
        labelMap[uri] = labels.none;
      } else {
        // Extract the last part of the URI (after the last / or #)
        const lastPart = uri.split(/[/#]/).pop();
        labelMap[uri] = lastPart || uri;
      }
    }
    
    return labelMap;
  } catch (error) {
    console.error('Error fetching labels:', error);
    
    // Create fallback labels using the last part of the URI
    for (const uri of uris) {
      const lastPart = uri.split(/[/#]/).pop();
      labelMap[uri] = lastPart || uri;
    }
    
    return labelMap;
  }
}

// Extract URIs from SPARQL results
function extractUrisFromResults(results) {
  const uris = new Set();
  
  results.forEach(row => {
    Object.values(row).forEach(cell => {
      if (cell && cell.type === 'uri') {
        uris.add(cell.value);
      }
    });
  });
  
  return [...uris];
}

// Function to get a description or summary for a resource
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
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    
    if (bindings.length > 0 && bindings[0].description) {
      return bindings[0].description.value;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching resource description:', error);
    return null;
  }
}

// Function to get related resources
async function fetchRelatedResources(uri) {
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?related WHERE {
        {
          <${safeUri}> ?p ?related .
          FILTER(ISURI(?related))
        }
        UNION
        {
          ?related ?p <${safeUri}> .
          FILTER(ISURI(?related))
        }
      }
      LIMIT 10
    `;
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    return bindings.map(binding => binding.related.value);
  } catch (error) {
    console.error('Error fetching related resources:', error);
    return [];
  }
}

// Function to fetch categories/types
async function fetchCategories() {
  try {
    const query = `
      SELECT DISTINCT ?category WHERE {
        ?s a ?category .
      }
      ORDER BY ?category
      LIMIT 100
    `;
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    return bindings.map(binding => binding.category.value);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

// Function to fetch resources by category
async function fetchResourcesByCategory(category) {
  try {
    const safeCategory = sanitizeSparqlString(category);
    const query = `
      SELECT DISTINCT ?resource WHERE {
        ?resource a <${safeCategory}> .
      }
      ORDER BY ?resource
      LIMIT 100
    `;
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    return bindings.map(binding => binding.resource.value);
  } catch (error) {
    console.error('Error fetching resources by category:', error);
    return [];
  }
}

// Routes
app.get('/', async (req, res, next) => {
  try {
    const showLabels = req.query.showLabels !== 'false';
    
    // Fetch categories
    const categories = await fetchCategories();
    
    // Get human-readable labels if needed
    let labelMap = {};
    if (showLabels) {
      labelMap = await fetchLabelsForUris(categories);
    }
    
    res.render('home', {
      title: 'Välkommen till WikiGraph',
      categories: categories.map(category => ({
        uri: category,
        label: showLabels && labelMap[category] ? labelMap[category] : category
      })),
      showLabels: showLabels
    });
  } catch (err) {
    next(err);
  }
});

app.get('/category', async (req, res, next) => {
  try {
    const categoryUri = req.query.uri;
    const showLabels = req.query.showLabels !== 'false';
    
    if (!categoryUri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Ingen kategori angiven'
      });
    }
    
    // Fetch resources for this category
    const resources = await fetchResourcesByCategory(categoryUri);
    
    // Get human-readable labels
    let labelMap = {};
    if (showLabels) {
      const uris = [...resources, categoryUri];
      labelMap = await fetchLabelsForUris(uris);
    }
    
    res.render('category', {
      title: 'Kategori',
      categoryUri: categoryUri,
      categoryLabel: showLabels && labelMap[categoryUri] ? labelMap[categoryUri] : categoryUri,
      resources: resources.map(resource => ({
        uri: resource,
        label: showLabels && labelMap[resource] ? labelMap[resource] : resource
      })),
      showLabels: showLabels
    });
  } catch (err) {
    next(err);
  }
});

app.get('/graphdb', async (req, res, next) => {
  try {
    const showLabels = req.query.showLabels !== 'false'; // Default to true

    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: {
        query: `
          SELECT * WHERE {
            ?s ?p ?o
          } LIMIT 100
        `
      }
    });

    const bindings = response.data.results.bindings || [];
    
    // Get human-readable labels if needed
    let labelMap = {};
    if (showLabels) {
      const uris = extractUrisFromResults(bindings);
      labelMap = await fetchLabelsForUris(uris);
    }
  
    res.render('graphdb', {
      title: 'GraphDB Data',
      message: 'Resultat från GraphDB:',
      rows: bindings,
      labelMap: labelMap,
      showLabels: showLabels
    });
  } catch (err) {
    next(err);
  }
});

app.get('/resource', async (req, res, next) => {
  const uri = req.query.uri;
  const showLabels = req.query.showLabels !== 'false'; // Default to true

  if (!uri) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen URI angiven'
    });
  }

  try {
    const safeUri = sanitizeSparqlString(uri);
    
    // Main resource data
    const dataResponse = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: {
        query: `
          SELECT * WHERE {
            <${safeUri}> ?predicate ?object
          } LIMIT 100
        `
      }
    });

    const data = dataResponse.data.results.bindings || [];
    
    // Fetch resource description
    const description = await fetchResourceDescription(uri);
    
    // Fetch related resources
    const relatedUris = await fetchRelatedResources(uri);
    
    // Fetch type/class information
    const typeResponse = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: {
        query: `
          SELECT ?type WHERE {
            <${safeUri}> a ?type .
          } LIMIT 10
        `
      }
    });
    
    const types = typeResponse.data.results.bindings.map(binding => binding.type.value);
    
    // Get human-readable labels
    let labelMap = {};
    if (showLabels) {
      const uris = extractUrisFromResults(data);
      uris.push(uri);
      uris.push(...relatedUris);
      uris.push(...types);
      labelMap = await fetchLabelsForUris(uris);
    }

    // Group properties by category
    const propertyGroups = {
      basic: [],
      relationships: [],
      other: []
    };
    
    // Basic properties
    const basicPredicates = [
      'http://www.w3.org/2000/01/rdf-schema#label',
      'http://www.w3.org/2000/01/rdf-schema#comment',
      'http://purl.org/dc/terms/title',
      'http://purl.org/dc/elements/1.1/title',
      'http://purl.org/dc/terms/description',
      'http://purl.org/dc/elements/1.1/description'
    ];
    
    // Relationship predicates often contain these strings
    const relationshipKeywords = ['has', 'related', 'member', 'part', 'connected', 'linked'];
    
    data.forEach(row => {
      const predicateValue = row.predicate.value;
      
      if (basicPredicates.includes(predicateValue)) {
        propertyGroups.basic.push(row);
      } else if (relationshipKeywords.some(keyword => predicateValue.toLowerCase().includes(keyword))) {
        propertyGroups.relationships.push(row);
      } else {
        propertyGroups.other.push(row);
      }
    });

    res.render('resource', {
      title: 'Resursdetaljer',
      uri: uri,
      resourceLabel: showLabels && labelMap[uri] ? labelMap[uri] : uri,
      description: description,
      types: types.map(type => ({
        uri: type,
        label: showLabels && labelMap[type] ? labelMap[type] : type
      })),
      propertyGroups: propertyGroups,
      related: relatedUris.map(related => ({
        uri: related,
        label: showLabels && labelMap[related] ? labelMap[related] : related
      })),
      labelMap: labelMap,
      showLabels: showLabels
    });
  } catch (err) {
    next(err);
  }
});

// Custom SPARQL query route
app.get('/query', (req, res) => {
  const showLabels = req.query.showLabels !== 'false'; // Default to true
  
  res.render('query', {
    title: 'SPARQL Query',
    showLabels: showLabels
  });
});

app.post('/query', async (req, res, next) => {
  const query = req.body.query;
  const showLabels = req.body.showLabels !== 'false'; // Default to true
  
  if (!query) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen fråga angiven'
    });
  }

  try {
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });

    const data = response.data.results.bindings || [];
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    
    // Get human-readable labels if needed
    let labelMap = {};
    if (showLabels) {
      const uris = extractUrisFromResults(data);
      labelMap = await fetchLabelsForUris(uris);
    }

    res.render('query-results', {
      title: 'Query Results',
      headers: headers,
      rows: data,
      labelMap: labelMap,
      showLabels: showLabels,
      query: query
    });
  } catch (err) {
    next(err);
  }
});

// Search route
app.get('/search', async (req, res, next) => {
  const searchTerm = req.query.q;
  const showLabels = req.query.showLabels !== 'false';
  
  if (!searchTerm) {
    return res.render('search', {
      title: 'Sök i databasen',
      results: [],
      searchTerm: '',
      showLabels: showLabels
    });
  }
  
  try {
    const safeSearchTerm = sanitizeSparqlString(searchTerm);
    const query = `
      SELECT DISTINCT ?resource WHERE {
        {
          ?resource ?p ?o .
          ?o bif:contains "'${safeSearchTerm}'" .
        }
        UNION
        {
          ?resource <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          FILTER(CONTAINS(LCASE(?label), LCASE("${safeSearchTerm}")))
        }
      }
      LIMIT 50
    `;
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: { query }
    });
    
    const resources = response.data.results.bindings.map(binding => binding.resource.value);
    
    // Get human-readable labels
    let labelMap = {};
    if (showLabels) {
      labelMap = await fetchLabelsForUris(resources);
    }
    
    res.render('search', {
      title: 'Sökresultat',
      results: resources.map(resource => ({
        uri: resource,
        label: showLabels && labelMap[resource] ? labelMap[resource] : resource
      })),
      searchTerm: searchTerm,
      showLabels: showLabels
    });
  } catch (err) {
    next(err);
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', {
    title: 'Error',
    message: 'Ett serverfel inträffade',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// Create necessary directories if they don't exist
const viewsDir = path.join(__dirname, 'views');
const publicDir = path.join(__dirname, 'public');
const cssDir = path.join(publicDir, 'css');
const jsDir = path.join(publicDir, 'js');
const imagesDir = path.join(publicDir, 'images');

if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

if (!fs.existsSync(cssDir)) {
  fs.mkdirSync(cssDir, { recursive: true });
}

if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Export for testing
module.exports = app;