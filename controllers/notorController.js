// controllers/notorController.js
const notorService = require('../services/notorService');

/**
 * Handle notor page request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
exports.getNotorPage = async (req, res, next) => {
  try {
    const notorEntries = notorService.getNotor65Entries();
    
    res.render('notor', {
      title: 'Notor65 Data',
      entries: notorEntries
    });
  } catch (err) {
    next(err);
  }
};