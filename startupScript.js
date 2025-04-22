// startupScript.js
const fs = require('fs');
const path = require('path');

/**
 * Ensures all necessary directories exist
 */
function ensureDirectoriesExist() {
  const dirs = [
    'utils',
    'services',
    'views',
    'views/layouts',
    'public',
    'public/css',
    'public/js'
  ];
  
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}

/**
 * Copies the contents of a file if it doesn't exist
 */
function copyFileIfNotExists(source, target) {
  if (!fs.existsSync(target)) {
    try {
      fs.copyFileSync(source, target);
      console.log(`Created file: ${target}`);
      return true;
    } catch (error) {
      console.error(`Error creating file ${target}:`, error);
      return false;
    }
  }
  return false;
}

/**
 * Applies CSS updates to the existing styles.css file
 */
function appendCssUpdates() {
  const cssPath = path.join(__dirname, 'public/css/styles.css');
  const cssUpdatesPath = path.join(__dirname, 'cssUpdates.txt');
  
  if (fs.existsSync(cssPath) && fs.existsSync(cssUpdatesPath)) {
    try {
      const existingCss = fs.readFileSync(cssPath, 'utf8');
      const cssUpdates = fs.readFileSync(cssUpdatesPath, 'utf8');
      
      // Only append if the updates are not already in the file
      if (!existingCss.includes('/* Enhanced ontology grid styling */')) {
        fs.appendFileSync(cssPath, '\n\n' + cssUpdates);
        console.log('CSS updates applied to styles.css');
      }
    } catch (error) {
      console.error('Error applying CSS updates:', error);
    }
  }
}

/**
 * Creates the description utilities file
 */
function createDescriptionUtils() {
  const targetPath = path.join(__dirname, 'utils/descriptionUtils.js');
  const content = `// utils/descriptionUtils.js

/**
 * Generate a description for an ontology based on its URI pattern
 * @param {string} uri - Ontology URI
 * @returns {string} - Generated description
 */
const generateOntologyDescription = (uri) => {
  // Extract ontology name and domain
  const name = uri.split(/[/#]/).pop() || 'ontology';
  const domain = extractDomain(uri);
  
  // Check for common prefixes that might hint at the domain
  if (uri.includes('foaf') || name.includes('foaf')) {
    return \`Friend of a Friend (FOAF) är en ontologi som beskriver personer, deras aktiviteter och relationer till andra personer och objekt. Den är en grundläggande del av Semantic Web-teknologier och används ofta för att representera sociala nätverk och personlig information.\`;
  }
  
  if (uri.includes('skos') || name.includes('skos')) {
    return \`Simple Knowledge Organization System (SKOS) är en W3C-rekommendation som tillhandahåller ett standardiserat sätt att representera kunskapsorganisationssystem som tesaurusar, taxonomier och klassificeringsscheman. Den används för att organisera begrepp och deras relationer.\`;
  }
  
  if (uri.includes('dublin') || uri.includes('dc/terms') || uri.includes('dcterms')) {
    return \`Dublin Core är en uppsättning metadata-termer som används för att beskriva digitala och fysiska resurser. Den innehåller standardiserade element för att identifiera och beskriva resurser som dokument, bilder, ljud och andra mediatyper.\`;
  }
  
  if (uri.includes('owl') || name.includes('owl')) {
    return \`Web Ontology Language (OWL) är ett semantiskt webbspråk utformat för att representera rik och komplex kunskap om saker, grupper av saker och relationer mellan saker. OWL tillhandahåller mer uttrycksfullhet än RDF och RDFS.\`;
  }
  
  if (uri.includes('schema.org') || uri.includes('schema')) {
    return \`Schema.org är en samarbetsinsats för att skapa, underhålla och främja scheman för strukturerade data på internet. Den tillhandahåller ett gemensamt vokabulär som webbutvecklare kan använda för att märka upp HTML-sidor på ett sätt som förstås av stora sökmotorer.\`;
  }
  
  if (uri.includes('geo') || name.includes('geo')) {
    return \`Denna geografiska ontologi definierar koncept och relationer för geografisk information, platser och rumsliga sammanhang. Den kan användas för att representera platser, koordinater, geografiska former och relationer mellan platser.\`;
  }
  
  if (uri.includes('time') || name.includes('time')) {
    return \`Tidsontologin tillhandahåller vokabulär för att uttrycka tidpunkter, varaktigheter, tidsintervall och temporala relationer. Den gör det möjligt att precisera när händelser inträffar eller när tillstånd är giltiga.\`;
  }
  
  if (uri.includes('prov') || name.includes('prov')) {
    return \`PROV-ontologin tillhandahåller ett standardiserat sätt att representera och utbyta proveniensdata. Den beskriver hur entiteter, aktiviteter och agenter påverkar varandra och hur data skapas, transformeras och används över tid.\`;
  }
  
  if (uri.includes('person') || name.includes('person')) {
    return \`Denna personontologi definierar koncept och egenskaper för att beskriva personer, deras egenskaper, relationer och aktiviteter. Den kan användas för att representera individer i olika sammanhang.\`;
  }
  
  if (uri.includes('org') || name.includes('org') || name.includes('organization')) {
    return \`Organisationsontologin tillhandahåller koncept och relationer för att beskriva organisationsstrukturer, medlemskap, roller och hierarkier. Den gör det möjligt att modellera både formella och informella organisationer och deras interna strukturer.\`;
  }
  
  if (uri.includes('event') || name.includes('event')) {
    return \`Händelseontologin tillhandahåller ett vokabulär för att beskriva händelser, deras tidpunkter, platser, deltagare och andra relaterade koncept. Den kan användas för att representera olika typer av händelser från historiska till planerade.\`;
  }
  
  // Generic ontology description based on name
  return \`\${capitalizeFirstLetter(name)}-ontologin definierar en strukturerad vokabulär och semantik för kunskapsrepresentation inom sitt domänområde. Den tillhandahåller klasser, egenskaper och individer som kan användas för att modellera information på ett semantiskt rikt sätt. Utforska ontologins struktur för att förstå dess omfattning och användningsområden.\`;
};

/**
 * Extract domain name from a URI
 * @param {string} uri - URI string
 * @returns {string} - Domain name
 */
const extractDomain = (uri) => {
  try {
    if (!uri) return '';
    const match = uri.match(/^(https?:\\/\\/)?([^\\/]+)/i);
    return match ? match[2] : '';
  } catch (error) {
    return '';
  }
};

/**
 * Capitalize first letter of a string
 * @param {string} string - Input string
 * @returns {string} - String with first letter capitalized
 */
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

module.exports = {
  generateOntologyDescription
};`;

  if (!fs.existsSync(targetPath)) {
    try {
      fs.writeFileSync(targetPath, content);
      console.log('Created description utilities file');
    } catch (error) {
      console.error('Error creating description utilities file:', error);
    }
  }
}

/**
 * Creates the CSS updates file
 */
function createCssUpdatesFile() {
  const targetPath = path.join(__dirname, 'cssUpdates.txt');
  const content = `/* Enhanced ontology grid styling */
.ontology-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  grid-gap: 25px;
  margin: 30px 0;
}

.ontology-card {
  border: 1px solid #ddd;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ontology-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 15px rgba(0, 0, 0, 0.1);
}

.ontology-card-header {
  padding: 18px;
  border-bottom: 1px solid #eaecf0;
  background-color: #f8f9fa;
}

.ontology-card-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2c3e50;
}

.ontology-card-header h3 a {
  color: #0645ad;
  text-decoration: none;
}

.ontology-card-header h3 a:hover {
  text-decoration: underline;
}

.ontology-card-body {
  padding: 18px;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.ontology-card-body .description {
  margin-bottom: 18px;
  font-size: 14px;
  color: #333;
  max-height: 80px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  line-height: 1.5;
}

.ontology-stats {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid #eaecf0;
  font-size: 13px;
  color: #555;
}

.ontology-stats .stat {
  background-color: #f5f7fa;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #eaecf0;
}

.ontology-card-footer {
  padding: 15px;
  border-top: 1px solid #eaecf0;
  text-align: center;
}

.ontology-card-footer .btn {
  width: 100%;
  padding: 10px;
  font-weight: 500;
  transition: background-color 0.2s;
}

/* Enhanced resource description */
.resource-description {
  font-size: 1.1em;
  line-height: 1.7;
  margin-bottom: 25px;
  color: #333;
  background-color: #f9f9f9;
  padding: 20px;
  border-left: 4px solid #0645ad;
  border-radius: 0 4px 4px 0;
}

/* Property group enhancements */
.property-group {
  margin-bottom: 25px;
  border: 1px solid #eaecf0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.property-group-header {
  background-color: #f3f4f6;
  padding: 12px 15px;
  font-weight: 600;
  color: #444;
  border-bottom: 1px solid #eaecf0;
}

.property-table {
  width: 100%;
  border-collapse: collapse;
}

.property-table td {
  padding: 12px 15px;
  border-bottom: 1px solid #eaecf0;
}

.property-name {
  width: 30%;
  font-weight: 600;
  color: #555;
}

/* No data message styling */
.no-data-message {
  padding: 30px;
  text-align: center;
  background-color: #f9f9f9;
  border: 1px solid #eaecf0;
  border-radius: 8px;
  color: #555;
  margin: 30px 0;
}

.no-data-message p {
  font-size: 16px;
  margin-bottom: 15px;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .ontology-grid {
    grid-template-columns: 1fr;
  }
  
  .resource-container {
    flex-direction: column;
  }
  
  .resource-sidebar {
    order: -1;
    margin-bottom: 20px;
  }
}`;

  if (!fs.existsSync(targetPath)) {
    try {
      fs.writeFileSync(targetPath, content);
      console.log('Created CSS updates file');
    } catch (error) {
      console.error('Error creating CSS updates file:', error);
    }
  }
}

/**
 * Updates the ontology service with fallback description logic
 */
function updateOntologyService() {
  const servicePath = path.join(__dirname, 'services/ontologyService.js');
  
  if (fs.existsSync(servicePath)) {
    try {
      let content = fs.readFileSync(servicePath, 'utf8');
      
      // Check if we need to update the file
      if (!content.includes('generateOntologyDescription')) {
        // Add the require statement at the top
        if (!content.includes('descriptionUtils')) {
          const lines = content.split('\n');
          let insertIndex = 2; // After the first line
          
          // Find a good place to insert (after other requires)
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(')) {
              insertIndex = i + 1;
            }
          }
          
          lines.splice(insertIndex, 0, "const { generateOntologyDescription } = require('../utils/descriptionUtils');");
          content = lines.join('\n');
        }
        
        // Replace the generateFallbackDescription function
        if (content.includes('function generateFallbackDescription')) {
          content = content.replace(
            /function generateFallbackDescription\(uri\)[^}]+}/,
            `function generateFallbackDescription(uri) {
  return generateOntologyDescription(uri);
}`
          );
        }
        
        fs.writeFileSync(servicePath, content);
        console.log('Updated ontology service with description utilities');
      }
    } catch (error) {
      console.error('Error updating ontology service:', error);
    }
  }
}

// Run the setup functions
ensureDirectoriesExist();
createDescriptionUtils();
createCssUpdatesFile();
appendCssUpdates();
updateOntologyService();

console.log('Startup script completed');