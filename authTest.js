// authTest.js - Script to test different authentication methods for GraphDB
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
 * Test connection using basic auth via Axios auth option
 */
async function testBasicAuth() {
  try {
    console.log('\n=== Testing Basic Auth via Axios auth option ===');
    
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    const endpoint = `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`;
    
    const response = await axios.get(endpoint, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query },
      auth: {
        username: graphdbConfig.username,
        password: graphdbConfig.password
      }
    });
    
    console.log(`Success with Basic Auth! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`Failed with Basic Auth. Status: ${error.response?.status || 'Unknown'}`);
    console.error(`Message: ${error.message}`);
    return false;
  }
}

/**
 * Test connection using Authorization header with Basic auth
 */
async function testAuthorizationHeader() {
  try {
    console.log('\n=== Testing Authorization header with Basic auth ===');
    
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    const endpoint = `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`;
    
    // Create Basic auth string: Base64(username:password)
    const auth = Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64');
    
    const response = await axios.get(endpoint, {
      headers: { 
        'Accept': 'application/sparql-results+json',
        'Authorization': `Basic ${auth}`
      },
      params: { query }
    });
    
    console.log(`Success with Authorization header! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`Failed with Authorization header. Status: ${error.response?.status || 'Unknown'}`);
    console.error(`Message: ${error.message}`);
    return false;
  }
}

/**
 * Test connection without authentication (if the repository allows public access)
 */
async function testNoAuth() {
  try {
    console.log('\n=== Testing without authentication ===');
    
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    const endpoint = `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`;
    
    const response = await axios.get(endpoint, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query }
    });
    
    console.log(`Success without authentication! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`Failed without authentication. Status: ${error.response?.status || 'Unknown'}`);
    console.error(`Message: ${error.message}`);
    return false;
  }
}

/**
 * Test if the endpoint is correctly formatted
 */
async function testEndpointFormat() {
  try {
    console.log('\n=== Testing alternative endpoint format ===');
    
    // Try with a different endpoint format
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    const baseUrl = graphdbConfig.endpoint;
    
    // Option 1: Remove trailing slash if present
    const trimmedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Option 2: Add repositories path if not present
    const formattedEndpoint = `${trimmedUrl}/repositories/${graphdbConfig.repository}`;
    
    console.log(`Trying endpoint: ${formattedEndpoint}`);
    
    const response = await axios.get(formattedEndpoint, {
      headers: { 'Accept': 'application/sparql-results+json' },
      params: { query },
      auth: {
        username: graphdbConfig.username,
        password: graphdbConfig.password
      }
    });
    
    console.log(`Success with formatted endpoint! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`Failed with formatted endpoint. Status: ${error.response?.status || 'Unknown'}`);
    console.error(`Message: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('GraphDB connection tests with different authentication methods');
  console.log(`Endpoint: ${graphdbConfig.endpoint}`);
  console.log(`Repository: ${graphdbConfig.repository}`);
  console.log(`Username: ${graphdbConfig.username}`);
  
  const results = {
    basicAuth: await testBasicAuth(),
    authHeader: await testAuthorizationHeader(),
    noAuth: await testNoAuth(),
    endpointFormat: await testEndpointFormat()
  };
  
  console.log('\n=== Test Results Summary ===');
  console.log(`Basic Auth: ${results.basicAuth ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Auth Header: ${results.authHeader ? 'SUCCESS' : 'FAILED'}`);
  console.log(`No Auth: ${results.noAuth ? 'SUCCESS' : 'FAILED'}`);
  console.log(`Endpoint Format: ${results.endpointFormat ? 'SUCCESS' : 'FAILED'}`);
  
  if (results.noAuth && !results.basicAuth && !results.authHeader) {
    console.log('\n⭐ RECOMMENDATION: The repository appears to allow public access. Remove authentication.');
  } else if (results.authHeader && !results.basicAuth) {
    console.log('\n⭐ RECOMMENDATION: Use Authorization header method.');
  } else if (results.basicAuth) {
    console.log('\n⭐ RECOMMENDATION: Use Basic Auth via Axios auth option.');
  } else if (results.endpointFormat) {
    console.log('\n⭐ RECOMMENDATION: Use the formatted endpoint URL.');
  } else {
    console.log('\n❌ All authentication methods failed. Please check your credentials and endpoint URL.');
  }
}

// Run the tests
runAllTests()
  .catch(err => {
    console.error('Unexpected error running tests:', err);
  });