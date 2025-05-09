// serverCheck.js - Script to check GraphDB server configuration
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// GraphDB configuration
const graphdbConfig = {
  endpoint: process.env.GRAPHDB_ENDPOINT || 'https://jthkg.hj.se',
  repository: process.env.GRAPHDB_REPOSITORY || 'JTH-Product-Data',
  username: process.env.GRAPHDB_USERNAME || 'admin',
  password: process.env.GRAPHDB_PASSWORD || 'Endast4JTH '
};

/**
 * Check if the GraphDB server is accessible
 */
async function checkServerAccess() {
  try {
    console.log('\n=== Checking if GraphDB server is accessible ===');
    
    // Try to access the server without a specific repository
    const baseUrl = graphdbConfig.endpoint.endsWith('/') 
      ? graphdbConfig.endpoint.slice(0, -1) 
      : graphdbConfig.endpoint;
    
    console.log(`Trying to access: ${baseUrl}`);
    
    const response = await axios.get(baseUrl, {
      timeout: 5000 // 5 second timeout
    });
    
    console.log(`Server is accessible! Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`Failed to access server: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused. The server might be down or not accepting connections.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Connection timed out. The server might be unreachable or blocked by a firewall.');
    }
    
    return false;
  }
}

/**
 * Check if the repository exists
 */
async function checkRepositoryExists() {
  try {
    console.log('\n=== Checking if repository exists ===');
    
    const baseUrl = graphdbConfig.endpoint.endsWith('/') 
      ? graphdbConfig.endpoint.slice(0, -1) 
      : graphdbConfig.endpoint;
    
    // Try to list repositories
    const reposUrl = `${baseUrl}/repositories`;
    console.log(`Checking repositories at: ${reposUrl}`);
    
    const response = await axios.get(reposUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (response.data && Array.isArray(response.data.results.bindings)) {
      const repositories = response.data.results.bindings.map(binding => binding.id?.value);
      console.log(`Available repositories: ${repositories.join(', ')}`);
      
      const repositoryExists = repositories.includes(graphdbConfig.repository);
      console.log(`Repository '${graphdbConfig.repository}' exists: ${repositoryExists}`);
      
      return repositoryExists;
    } else {
      console.log('Could not determine available repositories');
      return false;
    }
  } catch (error) {
    console.error(`Failed to check repositories: ${error.message}`);
    return false;
  }
}

/**
 * Test with different content types
 */
async function testDifferentContentTypes() {
  try {
    console.log('\n=== Testing different Accept headers ===');
    
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    const baseUrl = graphdbConfig.endpoint.endsWith('/') 
      ? graphdbConfig.endpoint.slice(0, -1) 
      : graphdbConfig.endpoint;
    const endpoint = `${baseUrl}/repositories/${graphdbConfig.repository}`;
    
    const contentTypes = [
      'application/sparql-results+json',
      'application/json',
      'application/xml',
      'text/csv'
    ];
    
    for (const contentType of contentTypes) {
      try {
        console.log(`Testing with Accept: ${contentType}`);
        
        const response = await axios.get(endpoint, {
          headers: { 'Accept': contentType },
          params: { query },
          auth: {
            username: graphdbConfig.username,
            password: graphdbConfig.password
          },
          timeout: 5000
        });
        
        console.log(`Success with ${contentType}! Status: ${response.status}`);
      } catch (error) {
        console.error(`Failed with ${contentType}. Status: ${error.response?.status || 'Unknown'}`);
      }
    }
  } catch (error) {
    console.error(`Error in content type tests: ${error.message}`);
  }
}

/**
 * Check if URL needs adjustment - try different formats
 */
async function testUrlFormats() {
  try {
    console.log('\n=== Testing different URL formats ===');
    
    const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1';
    let baseUrl = graphdbConfig.endpoint;
    
    // Remove trailing slash if present
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    
    const urlFormats = [
      `${baseUrl}/repositories/${graphdbConfig.repository}`,
      `${baseUrl}/repository/${graphdbConfig.repository}`,
      `${baseUrl}/rest/repositories/${graphdbConfig.repository}`,
      `${baseUrl}/sparql/${graphdbConfig.repository}`
    ];
    
    for (const url of urlFormats) {
      try {
        console.log(`Testing URL: ${url}`);
        
        const response = await axios.get(url, {
          headers: { 'Accept': 'application/sparql-results+json' },
          params: { query },
          auth: {
            username: graphdbConfig.username,
            password: graphdbConfig.password
          },
          timeout: 5000
        });
        
        console.log(`Success with URL: ${url}! Status: ${response.status}`);
      } catch (error) {
        console.error(`Failed with URL: ${url}. Status: ${error.response?.status || 'Unknown'}`);
      }
    }
  } catch (error) {
    console.error(`Error in URL format tests: ${error.message}`);
  }
}

// Run all checks
async function runAllChecks() {
  console.log('GraphDB Server Configuration Check');
  console.log(`Endpoint: ${graphdbConfig.endpoint}`);
  console.log(`Repository: ${graphdbConfig.repository}`);
  console.log(`Username: ${graphdbConfig.username}`);
  
  const serverAccessible = await checkServerAccess();
  
  if (serverAccessible) {
    await checkRepositoryExists();
    await testDifferentContentTypes();
    await testUrlFormats();
    
    console.log('\n=== GraphDB Server Check Complete ===');
    console.log('Based on these tests, please update your configuration accordingly.');
  } else {
    console.log('\n❌ Cannot proceed with further checks because the server is not accessible.');
    console.log('Please check the server address and ensure it is running and accessible from your network.');
  }
}

// Run the checks
runAllChecks()
  .catch(err => {
    console.error('Unexpected error:', err);
  });