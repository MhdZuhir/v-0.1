// config/db.js

/**
 * GraphDB connection configuration - Updated for online GraphDB
 */
exports.graphdbConfig = {
    endpoint: process.env.GRAPHDB_ENDPOINT || 'https://jthkg.hj.se',
    repository: process.env.GRAPHDB_REPOSITORY || 'JTH-Product-Data ',
    // Add authentication headers for the online instance
    auth: {
        username: process.env.GRAPHDB_USERNAME || 'admin',
        password: process.env.GRAPHDB_PASSWORD || 'Endast4JTH'
    }
};

/**
 * System namespaces to filter out from results
 */
exports.systemNamespaces = [
    'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'http://www.w3.org/2000/01/rdf-schema#',
    'http://www.w3.org/2002/07/owl#',
    'http://www.w3.org/2001/XMLSchema#'
];