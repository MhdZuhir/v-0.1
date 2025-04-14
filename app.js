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
    getValueType: (cell) => cell ? cell.type : '',
    getIconClass: (label) => {
      label = (label || '').toLowerCase();
      if (label.includes('person') || label.includes('människa')) return 'icon-person';
      if (label.includes('place') || label.includes('plats')) return 'icon-place';
      if (label.includes('event') || label.includes('händelse')) return 'icon-event';
      if (label.includes('organization') || label.includes('organisation')) return 'icon-organization';
      if (label.includes('concept') || label.includes('begrepp')) return 'icon-concept';
      return 'icon-default';
    },
    truncate: (text, length) => {
      if (!text) return '';
      return text.length <= length ? text : text.substring(0, length) + '...';
    }
  }
}));
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// System namespaces to filter out
const systemNamespaces = [
  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'http://www.w3.org/2000/01/rdf-schema#',
  'http://www.w3.org/2002/07/owl#',
  'http://www.w3.org/2001/XMLSchema#'
];

// Utility functions
const isSystemResource = uri => {
  if (!uri || typeof uri !== 'string') return false;
  return systemNamespaces.some(namespace => uri.startsWith(namespace));
};

const filterSystemResources = data => {
  return data.filter(row => {
    for (const key in row) {
      if (row[key]?.type === 'uri' && isSystemResource(row[key].value)) return false;
    }
    return true;
  });
};

const sanitizeSparqlString = str => {
  if (!str) return '';
  return str.replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
};

const extractUrisFromResults = results => {
  const uris = new Set();
  results.forEach(row => {
    Object.values(row).forEach(cell => {
      if (cell && cell.type === 'uri') uris.add(cell.value);
    });
  });
  return [...uris];
};

// Function to parse Notor65 data from the paste.txt file
function parseNotor65Data() {
  try {
    const fileContent = fs.readFileSync(path.join(__dirname, 'paste.txt'), 'utf8');
    const entries = [];
    const regex = /notor65:(\d+)\s+a\s+notor65:Notor65_BetaOpti/g;
    let match;
    
    while ((match = regex.exec(fileContent)) !== null) {
      entries.push({
        s: { type: 'uri', value: `notor65:${match[1]}` },
        o: { type: 'uri', value: 'notor65:Notor65_BetaOpti' }
      });
    }
    
    return entries;
  } catch (error) {
    console.error('Error parsing Notor65 data:', error);
    return [];
  }
}

// Fetch human-readable labels for URIs with batching
async function fetchLabelsForUris(uris) {
  if (!uris || uris.length === 0) return {};
  
  // Filter out system URIs
  uris = uris.filter(uri => !isSystemResource(uri));
  if (uris.length === 0) return {};
  
  const labelMap = {};
  const BATCH_SIZE = 20;
  
  try {
    // Split URIs into batches
    const batches = [];
    for (let i = 0; i < uris.length; i += BATCH_SIZE) {
      batches.push(uris.slice(i, i + BATCH_SIZE));
    }
    
    // Process each batch
    for (let batch of batches) {
      try {
        const uriValues = batch.map(uri => `<${uri}>`).join(' ');
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
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query }
        });
        
        const bindings = response.data.results.bindings || [];
        const uriLabels = new Map();
        
        for (const binding of bindings) {
          const uri = binding.uri.value;
          const label = binding.label.value;
          const lang = binding.label['xml:lang'] || '';
          
          if (!uriLabels.has(uri)) uriLabels.set(uri, {});
          
          // Store label by language priority (sv > en > no-lang)
          if (lang === 'sv') {
            uriLabels.get(uri).sv = label;
          } else if (lang === 'en' && !uriLabels.get(uri).sv) {
            uriLabels.get(uri).en = label;
          } else if (!lang && !uriLabels.get(uri).sv && !uriLabels.get(uri).en) {
            uriLabels.get(uri).none = label;
          }
        }
        
        // Add labels from batch to main labelMap
        for (const uri of batch) {
          const labels = uriLabels.get(uri) || {};
          
          if (labels.sv) labelMap[uri] = labels.sv;
          else if (labels.en) labelMap[uri] = labels.en;
          else if (labels.none) labelMap[uri] = labels.none;
          else {
            const lastPart = uri.split(/[/#]/).pop();
            labelMap[uri] = lastPart || uri;
          }
        }
      } catch (batchError) {
        console.error(`Error processing batch:`, batchError.message);
      }
    }
    
    return labelMap;
  } catch (error) {
    console.error('Error in fetchLabelsForUris:', error);
    
    // Fallback: use last part of URI
    for (const uri of uris) {
      const lastPart = uri.split(/[/#]/).pop();
      labelMap[uri] = lastPart || uri;
    }
    
    return labelMap;
  }
}

// GraphDB Query Functions
async function fetchResourceDescription(uri) {
  if (isSystemResource(uri)) return null;
  
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
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    return bindings.length > 0 && bindings[0].description ? bindings[0].description.value : null;
  } catch (error) {
    console.error('Error fetching resource description:', error);
    return null;
  }
}

async function fetchRelatedResources(uri) {
  if (isSystemResource(uri)) return [];
  
  try {
    const safeUri = sanitizeSparqlString(uri);
    const query = `
      SELECT DISTINCT ?related WHERE {
        { <${safeUri}> ?p ?related . FILTER(ISURI(?related)) }
        UNION
        { ?related ?p <${safeUri}> . FILTER(ISURI(?related)) }
      }
      LIMIT 10
    `;
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    const relatedUris = bindings.map(binding => binding.related.value);
    return relatedUris.filter(uri => !isSystemResource(uri));
  } catch (error) {
    console.error('Error fetching related resources:', error);
    return [];
  }
}

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
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    const categories = bindings.map(binding => binding.category.value);
    return categories.filter(category => !isSystemResource(category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

async function fetchResourcesByCategory(category) {
  if (isSystemResource(category)) return [];
  
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
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    const bindings = response.data.results.bindings || [];
    const resources = bindings.map(binding => binding.resource.value);
    return resources.filter(resource => !isSystemResource(resource));
  } catch (error) {
    console.error('Error fetching resources by category:', error);
    return [];
  }
}

// Routes
app.get('/', async (req, res, next) => {
  try {
    const showLabels = req.query.showLabels !== 'false';
    const categories = await fetchCategories();
    let labelMap = showLabels ? await fetchLabelsForUris(categories) : {};
    
    res.render('home', {
      title: 'Välkommen till WikiGraph',
      categories: categories.map(category => ({
        uri: category,
        label: showLabels && labelMap[category] ? labelMap[category] : category
      })),
      showLabels
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
    
    if (isSystemResource(categoryUri)) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Systemkategorier kan inte visas'
      });
    }
    
    const resources = await fetchResourcesByCategory(categoryUri);
    let labelMap = {};
    
    if (showLabels) {
      const uris = [...resources, categoryUri];
      labelMap = await fetchLabelsForUris(uris);
    }
    
    res.render('category', {
      title: 'Kategori',
      categoryUri,
      categoryLabel: showLabels && labelMap[categoryUri] ? labelMap[categoryUri] : categoryUri,
      resources: resources.map(resource => ({
        uri: resource,
        label: showLabels && labelMap[resource] ? labelMap[resource] : resource
      })),
      showLabels
    });
  } catch (err) {
    next(err);
  }
});

app.get('/graphdb', async (req, res, next) => {
  try {
    const showLabels = req.query.showLabels !== 'false';
    let bindings = [];
    let errorMessage = '';
    let debugInfo = {
      endpoint: graphdbEndpoint,
      repository: graphdbRepository,
      queryExecuted: false,
      resultCount: 0,
      filteredCount: 0,
      timestamp: new Date().toISOString()
    };

    try {
      const query = `SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10`;
      debugInfo.query = query;
      
      const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
        headers: { 'Accept': 'application/sparql-results+json' },
        params: { query }
      });
      
      debugInfo.queryExecuted = true;
      debugInfo.responseStatus = response.status;
      
      if (response.data && response.data.results && Array.isArray(response.data.results.bindings)) {
        bindings = response.data.results.bindings || [];
        debugInfo.resultCount = bindings.length;
        
        if (bindings.length > 0) {
          const firstRow = bindings[0];
          debugInfo.firstRowKeys = Object.keys(firstRow);
        }
      } else {
        debugInfo.unexpectedResponseStructure = true;
        errorMessage = "GraphDB response doesn't have the expected structure";
      }
    } catch (dbErr) {
      console.error('Error querying GraphDB:', dbErr);
      errorMessage = "Could not retrieve data from GraphDB. " + dbErr.message;
      debugInfo.error = dbErr.message;
    }
    
    debugInfo.originalCount = bindings.length;
    
    res.render('graphdb', {
      title: 'GraphDB Diagnostic Data',
      message: errorMessage || 'Raw Data from GraphDB:',
      rows: bindings,
      labelMap: {},
      showLabels: false,
      debug: debugInfo,
      diagnosticMode: true
    });
  } catch (err) {
    console.error('Unexpected error in /graphdb route:', err);
    res.status(500).send(`
      <h1>Server Error</h1>
      <p>There was an error processing your request:</p>
      <pre>${err.stack}</pre>
    `);
  }
});

app.get('/resource', async (req, res, next) => {
  const uri = req.query.uri;
  const showLabels = req.query.showLabels !== 'false';

  if (!uri) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen URI angiven'
    });
  }
  
  if (isSystemResource(uri)) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Systemresurser kan inte visas'
    });
  }

  try {
    const safeUri = sanitizeSparqlString(uri);
    
    const dataResponse = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: {
        query: `SELECT * WHERE { <${safeUri}> ?predicate ?object } LIMIT 100`
      }
    });

    let data = dataResponse.data.results.bindings || [];
    data = data.filter(row => {
      if (row.object?.type === 'uri' && isSystemResource(row.object.value)) return false;
      if (row.predicate?.type === 'uri' && isSystemResource(row.predicate.value)) return false;
      return true;
    });
    
    const description = await fetchResourceDescription(uri);
    const relatedUris = await fetchRelatedResources(uri);
    
    const typeResponse = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: {
        query: `
          SELECT DISTINCT ?type WHERE {
            { <${safeUri}> a ?type . }
            UNION
            { <${safeUri}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> ?type . }
          } LIMIT 10
        `
      }
    });
    
    let types = typeResponse.data.results.bindings.map(binding => binding.type.value)
      .filter(type => !isSystemResource(type));
    
    if (types.length === 0) {
      const typePredicates = [
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.w3.org/2000/01/rdf-schema#type',
        'http://purl.org/dc/terms/type'
      ];
      
      data.forEach(row => {
        if (typePredicates.includes(row.predicate.value) && row.object.type === 'uri') {
          const type = row.object.value;
          if (!isSystemResource(type)) {
            types.push(type);
          }
        }
      });
    }
    
    let labelMap = {};
    if (showLabels) {
      const uris = extractUrisFromResults(data);
      uris.push(uri, ...relatedUris, ...types);
      labelMap = await fetchLabelsForUris(uris);
    }

    const propertyGroups = {
      basic: [],
      relationships: [],
      other: []
    };
    
    const basicPredicates = [
      'http://www.w3.org/2000/01/rdf-schema#label',
      'http://www.w3.org/2000/01/rdf-schema#comment',
      'http://purl.org/dc/terms/title',
      'http://purl.org/dc/elements/1.1/title',
      'http://purl.org/dc/terms/description',
      'http://purl.org/dc/elements/1.1/description'
    ];
    
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

    if (propertyGroups.basic.length === 0) delete propertyGroups.basic;
    if (propertyGroups.relationships.length === 0) delete propertyGroups.relationships;
    if (propertyGroups.other.length === 0) delete propertyGroups.other;

    res.render('resource', {
      title: 'Resursdetaljer',
      uri,
      resourceLabel: showLabels && labelMap[uri] ? labelMap[uri] : uri,
      description,
      types: types.map(type => ({
        uri: type,
        label: showLabels && labelMap[type] ? labelMap[type] : type
      })),
      propertyGroups,
      related: relatedUris.map(related => ({
        uri: related,
        label: showLabels && labelMap[related] ? labelMap[related] : related
      })),
      labelMap,
      showLabels
    });
  } catch (err) {
    next(err);
  }
});

app.get('/query', (req, res) => {
  const showLabels = req.query.showLabels !== 'false';
  res.render('query', { title: 'SPARQL Query', showLabels });
});

app.post('/query', async (req, res, next) => {
  const query = req.body.query;
  const showLabels = req.body.showLabels !== 'false';
  const hideSystemResources = req.body.hideSystemResources !== 'false';
  
  if (!query) {
    return res.status(400).render('error', {
      title: 'Error',
      message: 'Ingen fråga angiven'
    });
  }

  try {
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });

    let data = response.data.results.bindings || [];
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    
    if (hideSystemResources) {
      data = filterSystemResources(data);
    }
    
    let labelMap = {};
    if (showLabels) {
      const uris = extractUrisFromResults(data);
      labelMap = await fetchLabelsForUris(uris);
    }

    res.render('query-results', {
      title: 'Query Results',
      headers,
      rows: data,
      labelMap,
      showLabels,
      hideSystemResources,
      query
    });
  } catch (err) {
    next(err);
  }
});

app.get('/search', async (req, res, next) => {
  let searchTerm = req.query.q || '';
  const showLabels = req.query.showLabels !== 'false';
  
  // Trim whitespace from the search term
  searchTerm = searchTerm.trim();
  
  if (!searchTerm) {
    return res.render('search', {
      title: 'Sök i databasen',
      results: [],
      searchTerm: '',
      showLabels
    });
  }
  
  try {
    const safeSearchTerm = sanitizeSparqlString(searchTerm);
    
    // Enhanced search query to find more relevant results
    // Using direct equals comparison for exact matches like product numbers
    const query = `
      SELECT DISTINCT ?resource WHERE {
        {
          # Exact match in literals (for codes, IDs, etc.)
          ?resource ?p ?exactMatch .
          FILTER(ISURI(?resource))
          FILTER(STR(?exactMatch) = "${safeSearchTerm}")
        }
        UNION
        {
          # Search in literals (object values)
          ?resource ?p ?o .
          FILTER(ISURI(?resource))
          FILTER(CONTAINS(LCASE(STR(?o)), LCASE("${safeSearchTerm}")))
        }
        UNION
        {
          # Search in URI paths
          ?resource ?p ?o .
          FILTER(ISURI(?resource))
          FILTER(CONTAINS(LCASE(STR(?resource)), LCASE("${safeSearchTerm}")))
        }
        UNION
        {
          # Specific search in labels with exact match
          ?resource <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          FILTER(STR(?label) = "${safeSearchTerm}")
        }
        UNION
        {
          # Specific search in labels
          ?resource <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${safeSearchTerm}")))
        }
        UNION
        {
          # Search in any alternate labels
          ?resource <http://www.w3.org/2004/02/skos/core#altLabel> ?altLabel .
          FILTER(CONTAINS(LCASE(STR(?altLabel)), LCASE("${safeSearchTerm}")))
        }
        UNION
        {
          # Search in titles
          ?resource <http://purl.org/dc/terms/title> ?title .
          FILTER(CONTAINS(LCASE(STR(?title)), LCASE("${safeSearchTerm}")))
        }
      }
      LIMIT 100
    `;
    
    console.log('Executing search query for term:', safeSearchTerm);
    
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    console.log('Search response status:', response.status);
    
    // Improved error checking for the response structure
    if (!response.data || !response.data.results || !Array.isArray(response.data.results.bindings)) {
      console.error('Unexpected response structure:', JSON.stringify(response.data).substring(0, 200));
      throw new Error('Unexpected response structure from GraphDB');
    }
    
    const bindings = response.data.results.bindings;
    console.log(`Found ${bindings.length} results before filtering`);
    
    // Extract resources with more robust handling
    let resources = [];
    bindings.forEach(binding => {
      if (binding.resource && binding.resource.value) {
        resources.push(binding.resource.value);
      }
    });
    
    // Remove duplicates
    resources = [...new Set(resources)];
    
    // Filter system resources
    resources = resources.filter(resource => !isSystemResource(resource));
    console.log(`Found ${resources.length} results after filtering`);
    
    // Try a fallback search if no results found
    if (resources.length === 0 && safeSearchTerm.length > 3) {
      console.log('No results found, trying fallback tokenized search');
      
      // Create a tokenized version of the search term
      const tokens = safeSearchTerm.split(/\s+/).filter(t => t.length > 2);
      
      if (tokens.length > 0) {
        // Create a SPARQL query with individual token matches
        const tokenFilters = tokens.map(token => 
          `CONTAINS(LCASE(STR(?o)), LCASE("${sanitizeSparqlString(token)}"))`
        ).join(' || ');
        
        const fallbackQuery = `
          SELECT DISTINCT ?resource WHERE {
            ?resource ?p ?o .
            FILTER(ISURI(?resource))
            FILTER(${tokenFilters})
          }
          LIMIT 100
        `;
        
        console.log('Executing fallback search');
        
        const fallbackResponse = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query: fallbackQuery }
        });
        
        if (fallbackResponse.data && fallbackResponse.data.results && Array.isArray(fallbackResponse.data.results.bindings)) {
          const fallbackBindings = fallbackResponse.data.results.bindings;
          fallbackBindings.forEach(binding => {
            if (binding.resource && binding.resource.value) {
              resources.push(binding.resource.value);
            }
          });
          
          // Remove duplicates again
          resources = [...new Set(resources)];
          
          // Filter system resources
          resources = resources.filter(resource => !isSystemResource(resource));
          console.log(`Found ${resources.length} results after fallback search`);
        }
      }
    }
    
    let labelMap = {};
    if (showLabels && resources.length > 0) {
      labelMap = await fetchLabelsForUris(resources);
    }
    
    // Add resource type icons - Simple type detection based on URI patterns
    const resourcesWithLabels = resources.map(resource => {
      const label = showLabels && labelMap[resource] ? labelMap[resource] : resource;
      const uri = resource.toLowerCase();
      
      // Default type detection based on common patterns
      let type = 'default';
      if (uri.includes('person') || uri.includes('agent') || uri.includes('author') || uri.includes('creator')) {
        type = 'person';
      } else if (uri.includes('place') || uri.includes('location') || uri.includes('area') || uri.includes('region')) {
        type = 'place';
      } else if (uri.includes('event') || uri.includes('activity')) {
        type = 'event';
      } else if (uri.includes('organization') || uri.includes('institution') || uri.includes('company')) {
        type = 'organization';
      } else if (uri.includes('concept') || uri.includes('topic') || uri.includes('subject')) {
        type = 'concept';
      }
      
      return {
        uri: resource,
        label,
        type
      };
    });
    
    res.render('search', {
      title: 'Sökresultat',
      results: resourcesWithLabels,
      searchTerm,
      showLabels
    });
  } catch (err) {
    console.error('Search error:', err);
    res.render('search', {
      title: 'Sökfel',
      error: `Ett fel uppstod vid sökning: ${err.message}`,
      searchTerm,
      showLabels
    });
  }
});

app.get('/notor', async (req, res, next) => {
  try {
    const showLabels = req.query.showLabels !== 'false';
    const entries = parseNotor65Data();
    
    const notorEntries = entries.map(entry => ({
      id: entry.s.value.replace('notor65:', ''),
      uri: entry.s.value,
      type: entry.o.value
    }));
    
    res.render('notor', {
      title: 'Notor65 Data',
      entries: notorEntries,
      showLabels
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

// Create necessary directories
const dirs = [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'public'),
  path.join(__dirname, 'public/css'),
  path.join(__dirname, 'public/js'),
  path.join(__dirname, 'public/images')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;