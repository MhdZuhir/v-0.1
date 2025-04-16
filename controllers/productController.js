// controllers/productController.js
const graphdbService = require('../services/graphdbService');
const labelService = require('../services/labelService');

/**
 * Handle product list page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getProductListPage = async (req, res, next) => {
  try {
    console.log('Handling product list page request...');
    
    // Fetch products from GraphDB
    const products = await graphdbService.fetchProducts();
    console.log(`Retrieved ${products.length} products to display`);
    
    // Fetch labels if needed
    let labelMap = {};
    if (req.showLabels && products.length > 0) {
      const uris = products.map(product => product.uri);
      labelMap = await labelService.fetchLabelsForUris(uris);
    }
    
    // Enhance products with labels if available
    const enhancedProducts = products.map(product => ({
      ...product,
      displayName: req.showLabels && labelMap[product.uri] ? labelMap[product.uri] : product.name
    }));
    
    res.render('products', {
      title: 'Produkter',
      products: enhancedProducts,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getProductListPage:', err);
    next(err);
  }
};

/**
 * Handle product detail page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getProductDetailPage = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'Ingen produkt-URI angiven'
      });
    }
    
    console.log(`Fetching product details for ${uri}`);
    const productDetails = await graphdbService.fetchProductDetails(uri);
    
    if (!productDetails) {
      return res.status(404).render('error', {
        title: 'Error',
        message: 'Produkten kunde inte hittas'
      });
    }
    
    // Get labels for URIs in the product properties
    let labelMap = {};
    if (req.showLabels) {
      const uris = [uri];
      
      // Add any URI values from other properties
      productDetails.otherProperties.forEach(prop => {
        if (prop.type === 'uri') {
          uris.push(prop.value);
        }
      });
      
      labelMap = await labelService.fetchLabelsForUris(uris);
    }
    
    res.render('product-detail', {
      title: productDetails.name,
      product: productDetails,
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    console.error('Error in getProductDetailPage:', err);
    next(err);
  }
};