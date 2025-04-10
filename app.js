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

// Routes
app.get('/', (req, res) => {
  res.render('home', {
    title: 'Välkommen',
    message: 'Detta är startsidan för din NGSI-LD/GraphDB-applikation.'
  });
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
      title: 'GraphDB Query',
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
    const response = await axios.get(`${graphdbEndpoint}/repositories/${graphdbRepository}`, {
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

    const data = response.data.results.bindings || [];
    
    // Get human-readable labels if needed
    let labelMap = {};
    if (showLabels) {
      // Add the URI itself to the list of URIs to fetch labels for
      const uris = extractUrisFromResults(data);
      uris.push(uri);
      labelMap = await fetchLabelsForUris(uris);
    }

    res.render('resource', {
      title: 'Resursdetaljer',
      uri: uri,
      resourceLabel: showLabels && labelMap[uri] ? labelMap[uri] : uri,
      rows: data,
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

if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Export for testing
module.exports = app;