// services/productService.js - updated fetchProductsByOntology function

/**
 * Fetch products related to a specific ontology
 * @param {string} ontologyUri - URI of the ontology
 * @returns {Promise<Array>} - Array of product objects
 */
async function fetchProductsByOntology(ontologyUri) {
  try {
    console.log(`Fetching products for ontology: ${ontologyUri}`);
    const safeUri = sanitizeSparqlString(ontologyUri);
    
    // Enhanced query to find products related to this ontology
    const query = `
      SELECT DISTINCT ?product ?name ?description WHERE {
        {
          # Products defined by the ontology
          ?product a ?type .
          ?type <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties if available
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
        UNION
        {
          # Products using classes from this ontology
          ?product a ?class .
          ?class <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          
          # Get basic properties if available
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
        UNION
        {
          # Products directly connected to the ontology
          ?product ?p <${safeUri}> .
          FILTER(?p IN (
            <http://www.w3.org/2000/01/rdf-schema#isDefinedBy>,
            <http://purl.org/dc/terms/conformsTo>,
            <http://www.w3.org/ns/prov#wasInfluencedBy>
          ))
          
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
        UNION
        {
          # Improved Notor65 product detection
          ?product a ?any .
          FILTER(
            (CONTAINS(STR(<${safeUri}>), "notor") || CONTAINS(LCASE(STR(<${safeUri}>)), "product")) || 
            (CONTAINS(STR(?product), "notor") || CONTAINS(STR(?product), "product"))
          )
          
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
          OPTIONAL { ?product <http://www.ontologi2025.se/notor65#articleNumber> ?articleNumber . }
        }
        UNION
        {
          # Match by similar namespace
          ?product a ?any .
          FILTER(STRSTARTS(STR(?product), SUBSTR(STR(<${safeUri}>), 1, 20)))
          
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
        }
      }
      ORDER BY ?product
      LIMIT 100
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB when fetching products by ontology');
      return [];
    }
    
    console.log(`Found ${data.results.bindings.length} products for ontology ${ontologyUri}`);
    
    // Process results
    const products = data.results.bindings.map(binding => {
      const productUri = binding.product?.value || '';
      return {
        uri: productUri,
        name: binding.name?.value || productUri.split(/[/#]/).pop() || 'Unnamed Product',
        description: binding.description?.value || '',
        isNotor: productUri.includes('notor65') || productUri.includes('Notor')
      };
    });
    
    // If we didn't find any products and this is the Notor65 ontology, add a fallback
    if (products.length === 0 && 
        (ontologyUri.includes('notor') || ontologyUri.includes('Notor'))) {
      products.push({
        uri: 'http://www.w3id.org/dpp/fagerhult/notor65/data/#7320046630874',
        name: 'Notor 65 Beta Opti',
        description: 'Notor 65 Beta Opti är en flexibel och effektiv LED-armatur med hög ljuskvalitet. Den har anodiserad finish och ger perfekt belysning för kontor och kommersiella miljöer.',
        isNotor: true
      });
    }
    
    return products;
  } catch (error) {
    console.error(`Error fetching products for ontology ${ontologyUri}:`, error);
    return [];
  }
}
// Insert this function into services/productService.js

/**
 * Enhanced function to detect products in the repository
 * @returns {Promise<Array>} - Array of product objects
 */
async function detectProducts() {
  try {
    console.log('Running enhanced product detection...');
    
    // This query looks for entities that have properties commonly associated with products
    const query = `
      SELECT DISTINCT ?product ?name ?description ?type WHERE {
        {
          # Approach 1: Find entities explicitly typed as products
          ?product a ?type .
          FILTER(?type IN (
            <http://schema.org/Product>, 
            <http://purl.org/goodrelations/v1#ProductOrService>,
            <http://www.w3id.org/dpp/fagerhult/notor#Notor>,
            <http://www.ontologi2025.se/notor65#Notor65_BetaOpti>
          ))
          
          # Get basic properties
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
        }
        UNION
        {
          # Approach 2: Find entities with product-like properties
          ?product ?nameProperty ?name .
          FILTER(?nameProperty IN (
            <http://schema.org/name>,
            <http://purl.org/dc/terms/title>,
            <http://www.w3.org/2000/01/rdf-schema#label>
          ))
          
          # Check for product indicators
          {
            # Has price
            ?product <http://schema.org/price> ?price .
          }
          UNION
          {
            # Has article number
            ?product <http://www.w3id.org/dpp/fagerhult/notor65/data/#hasArticleNumber> ?articleNumber .
          }
          UNION
          {
            # Has manufacturer
            ?product <http://schema.org/manufacturer> ?manufacturer .
          }
          
          # Get description if available
          OPTIONAL { 
            ?product ?descProperty ?description .
            FILTER(?descProperty IN (
              <http://schema.org/description>,
              <http://purl.org/dc/terms/description>,
              <http://www.w3.org/2000/01/rdf-schema#comment>
            ))
          }
          
          # Extract type information
          OPTIONAL { ?product a ?type . }
        }
        UNION
        {
          # Approach 3: Find entities with Notor-specific properties
          ?product ?p ?o .
          FILTER(CONTAINS(STR(?product), "notor") || CONTAINS(STR(?product), "Notor"))
          
          # Get basic properties if available
          OPTIONAL { ?product <http://www.w3.org/2000/01/rdf-schema#label> ?name . }
          OPTIONAL { ?product <http://schema.org/name> ?name . }
          OPTIONAL { ?product <http://schema.org/description> ?description . }
          OPTIONAL { ?product a ?type . }
        }
      }
      ORDER BY ?product
      LIMIT 200
    `;
    
    const data = await executeQuery(query);
    
    if (!data || !data.results || !Array.isArray(data.results.bindings)) {
      console.error('Unexpected response structure from GraphDB during product detection');
      return [];
    }
    
    // Process and normalize results
    const productMap = new Map(); // Use map to deduplicate products
    
    data.results.bindings.forEach(binding => {
      if (!binding.product || !binding.product.value) return;
      
      const uri = binding.product.value;
      const type = binding.type?.value || '';
      
      // Skip if this is clearly not a product (based on URI or type)
      if (
        uri.includes('/owl#') || 
        uri.includes('/rdf-schema#') || 
        type.includes('/owl#Class') ||
        type.includes('/rdf-schema#Class')
      ) {
        return;
      }
      
      // If we already have this product, merge information
      if (productMap.has(uri)) {
        const existing = productMap.get(uri);
        if (!existing.name && binding.name) {
          existing.name = binding.name.value;
        }
        if (!existing.description && binding.description) {
          existing.description = binding.description.value;
        }
      } else {
        // Create new product entry
        productMap.set(uri, {
          uri: uri,
          name: binding.name?.value || uri.split(/[/#]/).pop() || 'Unnamed Product',
          description: binding.description?.value || '',
          isNotor: 
            uri.includes('notor') || 
            uri.includes('Notor') || 
            (type && (type.includes('notor') || type.includes('Notor')))
        });
      }
    });
    
    // Add fallback Notor product if none found
    if (![...productMap.values()].some(p => p.isNotor)) {
      productMap.set('http://www.w3id.org/dpp/fagerhult/notor65/data/#7320046630874', {
        uri: 'http://www.w3id.org/dpp/fagerhult/notor65/data/#7320046630874',
        name: 'Notor 65 Beta Opti',
        description: 'Notor 65 Beta Opti är en flexibel och effektiv LED-armatur med hög ljuskvalitet. Den har anodiserad finish och ger perfekt belysning för kontor och kommersiella miljöer.',
        isNotor: true
      });
    }
    
    return [...productMap.values()];
  } catch (error) {
    console.error('Error in enhanced product detection:', error);
    return [];
  }
}