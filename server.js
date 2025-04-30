// server.js
const fs = require('fs');
const path = require('path');
const app = require('./app');

// Run the startup script to ensure all extensions are in place
require('./startupScript');

// Get port from environment
const port = process.env.PORT || 3000;

// Create necessary directories
const dirs = [
  path.join(__dirname, 'views'),
  path.join(__dirname, 'public'),
  path.join(__dirname, 'public/css'),
  path.join(__dirname, 'public/js'),
  path.join(__dirname, 'public/images')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`Ontology browser with enhanced descriptions is now available`);
});