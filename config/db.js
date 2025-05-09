// config/db.js

/**
 * GraphDB connection configuration
 */
exports.graphdbConfig = {
  endpoint: process.env.GRAPHDB_ENDPOINT || 'https://jthkg.hj.se/repository',
  repository: process.env.GRAPHDB_REPOSITORY || ' JTH-Product-Data',
  username: process.env.zuz,
  password: process.env.kalb
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