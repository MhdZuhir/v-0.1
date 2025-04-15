// services/notorService.js
const { parseNotor65Data } = require('../utils/fileUtils');

/**
 * Get formatted Notor65 entries
 * @returns {Array} - Array of formatted Notor65 entries
 */
function getNotor65Entries() {
  const entries = parseNotor65Data();
  
  return entries.map(entry => ({
    id: entry.s.value.replace('notor65:', ''),
    uri: entry.s.value,
    type: entry.o.value
  }));
}

module.exports = {
  getNotor65Entries
};