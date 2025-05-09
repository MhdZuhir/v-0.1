// testPostQuery.js - Script to test POST method for SPARQL queries
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// GraphDB configuration
const graphdbConfig = {
  endpoint: process.env.GRAPHDB_ENDPOINT || 'https://jthkg.hj.se',
  repository: process.env.GRAPHDB_REPOSITORY || 'JTH-Product-Data',
  username: process.env.GRAPHDB_USERNAME || 'admin',
  password: process.env.GRAPHDB_PASSWORD || 'Endast4JTH'
};

/**
 * Test executing a SPARQL query with POST method
 */
async function testPostQuery() {
  try {
    console.log('Testing SPARQL query with POST method...');
    
    // Ensure endpoint URL is properly formatted
    let endpointUrl = graphdbConfig.endpoint;
    
    // Remove trailing slash if present
    if (endpointUrl.endsWith('/')) {
      endpointUrl = endpointUrl.slice(0, -1);
    }
    
    // Construct the full endpoint URL
    const fullEndpointUrl = `${endpointUrl}/repositories/${graphdbConfig.repository}`;
    console.log(`Using endpoint URL: ${fullEndpointUrl}`);
    
    // Simple test query
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    
    // Setup request config with POST method
    const config = {
      headers: { 
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    // Add authentication
    if (graphdbConfig.username && graphdbConfig.password) {
      const authString = Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64');
      config.headers['Authorization'] = `Basic ${authString}`;
    }
    
    // Send POST request with query as form data
    const response = await axios.post(
      fullEndpointUrl, 
      `query=${encodeURIComponent(query)}`,
      config
    );
    
    console.log(`POST query successful! Status: ${response.status}`);
    
    if (response.data && response.data.results && response.data.results.bindings) {
      console.log(`Retrieved ${response.data.results.bindings.length} results.`);
      console.log('First result:', JSON.stringify(response.data.results.bindings[0], null, 2));
    }
    
    return true;
  } catch (error) {
    console.error('POST query failed:', error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    }
    
    return false;
  }
}

/**
 * Test different repository access methods
 */
async function testRepositoryAccess() {
  try {
    console.log('\n=== Testing different repository access methods ===');
    
    // Ensure endpoint URL is properly formatted
    let endpointUrl = graphdbConfig.endpoint;
    if (endpointUrl.endsWith('/')) {
      endpointUrl = endpointUrl.slice(0, -1);
    }
    
    const methods = [
      {
        name: 'Repository info (no auth)',
        url: `${endpointUrl}/repositories/${graphdbConfig.repository}/size`,
        auth: false
      },
      {
        name: 'Repository info (with auth)',
        url: `${endpointUrl}/repositories/${graphdbConfig.repository}/size`,
        auth: true
      },
      {
        name: 'List repositories (no auth)',
        url: `${endpointUrl}/repositories`,
        auth: false
      },
      {
        name: 'List repositories (with auth)',
        url: `${endpointUrl}/repositories`,
        auth: true
      }
    ];
    
    for (const method of methods) {
      try {
        console.log(`Testing: ${method.name}`);
        
        const config = {
          headers: { 'Accept': 'application/json' }
        };
        
        if (method.auth && graphdbConfig.username && graphdbConfig.password) {
          const authString = Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64');
          config.headers['Authorization'] = `Basic ${authString}`;
        }
        
        const response = await axios.get(method.url, config);
        
        console.log(`Success! Status: ${response.status}`);
      } catch (error) {
        console.error(`Failed. Status: ${error.response?.status || 'Unknown'}`);
      }
    }
  } catch (error) {
    console.error('Error testing repository access:', error.message);
  }
}

/**
 * Test different content types and authentication combinations
 */
async function testContentTypesAndAuth() {
  try {
    console.log('\n=== Testing content types and authentication combinations ===');
    
    // Ensure endpoint URL is properly formatted
    let endpointUrl = graphdbConfig.endpoint;
    if (endpointUrl.endsWith('/')) {
      endpointUrl = endpointUrl.slice(0, -1);
    }
    
    const fullEndpointUrl = `${endpointUrl}/repositories/${graphdbConfig.repository}`;
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    
    const contentTypes = [
      'application/sparql-results+json',
      'application/json'
    ];
    
    const authMethods = [
      {
        name: 'No auth',
        headers: {}
      },
      {
        name: 'Basic auth via Authorization header',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64')}`
        }
      }
    ];
    
    const requestMethods = [
      {
        name: 'GET with query param',
        fn: async (url, headers) => {
          return axios.get(url, {
            headers,
            params: { query }
          });
        }
      },
      {
        name: 'POST form-urlencoded',
        fn: async (url, headers) => {
          return axios.post(
            url, 
            `query=${encodeURIComponent(query)}`, 
            {
              headers: {
                ...headers, 
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );
        }
      },
      {
        name: 'POST with direct-query',
        fn: async (url, headers) => {
          return axios.post(
            url + '?query=' + encodeURIComponent(query), 
            null,
            { headers }
          );
        }
      }
    ];
    
    // Test all combinations
    for (const contentType of contentTypes) {
      for (const authMethod of authMethods) {
        for (const requestMethod of requestMethods) {
          try {
            console.log(`Testing: ${contentType} + ${authMethod.name} + ${requestMethod.name}`);
            
            const headers = {
              'Accept': contentType,
              ...authMethod.headers
            };
            
            const response = await requestMethod.fn(fullEndpointUrl, headers);
            
            console.log(`✅ SUCCESS! Status: ${response.status}`);
          } catch (error) {
            console.error(`❌ FAILED. Status: ${error.response?.status || 'Unknown'}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error testing content types and auth:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('GraphDB SPARQL Query Tests');
  console.log(`Endpoint: ${graphdbConfig.endpoint}`);
  console.log(`Repository: ${graphdbConfig.repository}`);
  console.log(`Username: ${graphdbConfig.username}`);
  
  const postQuerySuccess = await testPostQuery();
  
  if (postQuerySuccess) {
    console.log('\n✅ POST method for SPARQL queries works successfully!');
    console.log('This indicates you should update your GraphDB service to use POST instead of GET for SPARQL queries.');
  } else {
    console.log('\n❌ POST method for SPARQL queries failed.');
    console.log('Let\'s try other approaches to understand what works with your GraphDB setup.');
    
    await testRepositoryAccess();
    await testContentTypesAndAuth();
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the tests
runAllTests()
  .catch(err => {
    console.error('Unexpected error:', err);
  });