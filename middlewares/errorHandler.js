// middlewares/errorHandler.js

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Ett serverfel inträffade',
      error: process.env.NODE_ENV === 'development' ? err : {}
    });
  };
  
  module.exports = errorHandler;