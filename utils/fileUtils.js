// utils/fileUtils.js
const fs = require('fs');
const path = require('path');

/**
 * Parse Notor65 data from the paste.txt file
 * @returns {Array} - Array of Notor65 entries
 */
function parseNotor65Data() {
  try {
    const fileContent = fs.readFileSync(path.join(__dirname, '../paste.txt'), 'utf8');
    const entries = [];
    const regex = /notor65:(\d+)\s+a\s+notor65:Notor65_BetaOpti/g;
    let match;
    
    while ((match = regex.exec(fileContent)) !== null) {
      entries.push({
        s: { type: 'uri', value: `notor65:${match[1]}` },
        o: { type: 'uri', value: 'notor65:Notor65_BetaOpti' }
      });
    }
    
    return entries;
  } catch (error) {
    console.error('Error parsing Notor65 data:', error);
    return [];
  }
}

module.exports = {
  parseNotor65Data
};