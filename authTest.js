// authTest.js - Simple script to test GraphDB authentication
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

// Run different authentication test methods
async function runAuthTests() {
  console.log('GraphDB Authentication Test');
  console.log('==========================');
  console.log(`Endpoint: ${graphdbConfig.endpoint}`);
  console.log(`Repository: ${graphdbConfig.repository}`);
  console.log(`Username: ${graphdbConfig.username}`);
  console.log(`Password: ${'*'.repeat(graphdbConfig.password.length)}`);
  console.log();
  
  // Test 1: Using POST with Authorization header
  try {
    console.log('Test 1: POST with Authorization header');
    
    // Create authorization header
    const authString = Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64');
    
    // Test query
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    
    // Prepare request config
    const config = {
      method: 'post',
      url: `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`,
      headers: {
        'Accept': 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`
      },
      data: `query=${encodeURIComponent(query)}`
    };
    
    console.log('Sending request...');
    const response = await axios(config);
    
    console.log(`Success! Status: ${response.status}`);
    if (response.data && response.data.results && response.data.results.bindings) {
      console.log(`Returned ${response.data.results.bindings.length} results`);
      
      if (response.data.results.bindings.length > 0) {
        console.log('First result:');
        console.log(JSON.stringify(response.data.results.bindings[0], null, 2));
      }
    }
    console.log('✅ Test 1 passed!');
  } catch (error) {
    console.error('❌ Test 1 failed!');
    console.error(`Error: ${error.message}`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data)}`);
    }
  }
  
  console.log();
  
  // Test 2: Using GET with URL parameters and Authorization header
  try {
    console.log('Test 2: GET with URL parameters and Authorization header');
    
    // Create authorization header
    const authString = Buffer.from(`${graphdbConfig.username}:${graphdbConfig.password}`).toString('base64');
    
    // Test query
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    
    // Prepare request config
    const config = {
      method: 'get',
      url: `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`,
      headers: {
        'Accept': 'application/sparql-results+json',
        'Authorization': `Basic ${authString}`
      },
      params: {
        query: query
      }
    };
    
    console.log('Sending request...');
    const response = await axios(config);
    
    console.log(`Success! Status: ${response.status}`);
    if (response.data && response.data.results && response.data.results.bindings) {
      console.log(`Returned ${response.data.results.bindings.length} results`);
    }
    console.log('✅ Test 2 passed!');
  } catch (error) {
    console.error('❌ Test 2 failed!');
    console.error(`Error: ${error.message}`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data)}`);
    }
  }
  
  console.log();
  
  // Test 3: Using auth parameter in axios config
  try {
    console.log('Test 3: Using auth parameter in axios config');
    
    // Test query
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 5';
    
    // Prepare request config
    const config = {
      method: 'get',
      url: `${graphdbConfig.endpoint}/repositories/${graphdbConfig.repository}`,
      headers: {
        'Accept': 'application/sparql-results+json'
      },
      params: {
        query: query
      },
      auth: {
        username: graphdbConfig.username,
        password: graphdbConfig.password
      }
    };
    
    console.log('Sending request...');
    const response = await axios(config);
    
    console.log(`Success! Status: ${response.status}`);
    if (response.data && response.data.results && response.data.results.bindings) {
      console.log(`Returned ${response.data.results.bindings.length} results`);
    }
    console.log('✅ Test 3 passed!');
  } catch (error) {
    console.error('❌ Test 3 failed!');
    console.error(`Error: ${error.message}`);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response: ${JSON.stringify(error.response.data)}`);
    }
  }
  
  console.log();
  console.log('Authentication tests completed.');
}

// Run the tests
runAuthTests().catch(err => {
  console.error('Unexpected error:', err);
});