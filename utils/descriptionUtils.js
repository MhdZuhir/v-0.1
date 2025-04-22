// utils/descriptionUtils.js

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
      return `Friend of a Friend (FOAF) är en ontologi som beskriver personer, deras aktiviteter och relationer till andra personer och objekt. Den är en grundläggande del av Semantic Web-teknologier och används ofta för att representera sociala nätverk och personlig information.`;
    }
    
    if (uri.includes('skos') || name.includes('skos')) {
      return `Simple Knowledge Organization System (SKOS) är en W3C-rekommendation som tillhandahåller ett standardiserat sätt att representera kunskapsorganisationssystem som tesaurusar, taxonomier och klassificeringsscheman. Den används för att organisera begrepp och deras relationer.`;
    }
    
    if (uri.includes('dublin') || uri.includes('dc/terms') || uri.includes('dcterms')) {
      return `Dublin Core är en uppsättning metadata-termer som används för att beskriva digitala och fysiska resurser. Den innehåller standardiserade element för att identifiera och beskriva resurser som dokument, bilder, ljud och andra mediatyper.`;
    }
    
    if (uri.includes('owl') || name.includes('owl')) {
      return `Web Ontology Language (OWL) är ett semantiskt webbspråk utformat för att representera rik och komplex kunskap om saker, grupper av saker och relationer mellan saker. OWL tillhandahåller mer uttrycksfullhet än RDF och RDFS.`;
    }
    
    if (uri.includes('schema.org') || uri.includes('schema')) {
      return `Schema.org är en samarbetsinsats för att skapa, underhålla och främja scheman för strukturerade data på internet. Den tillhandahåller ett gemensamt vokabulär som webbutvecklare kan använda för att märka upp HTML-sidor på ett sätt som förstås av stora sökmotorer.`;
    }
    
    if (uri.includes('geo') || name.includes('geo')) {
      return `Denna geografiska ontologi definierar koncept och relationer för geografisk information, platser och rumsliga sammanhang. Den kan användas för att representera platser, koordinater, geografiska former och relationer mellan platser.`;
    }
    
    if (uri.includes('time') || name.includes('time')) {
      return `Tidsontologin tillhandahåller vokabulär för att uttrycka tidpunkter, varaktigheter, tidsintervall och temporala relationer. Den gör det möjligt att precisera när händelser inträffar eller när tillstånd är giltiga.`;
    }
    
    if (uri.includes('prov') || name.includes('prov')) {
      return `PROV-ontologin tillhandahåller ett standardiserat sätt att representera och utbyta proveniensdata. Den beskriver hur entiteter, aktiviteter och agenter påverkar varandra och hur data skapas, transformeras och används över tid.`;
    }
    
    if (uri.includes('person') || name.includes('person')) {
      return `Denna personontologi definierar koncept och egenskaper för att beskriva personer, deras egenskaper, relationer och aktiviteter. Den kan användas för att representera individer i olika sammanhang.`;
    }
    
    if (uri.includes('org') || name.includes('org') || name.includes('organization')) {
      return `Organisationsontologin tillhandahåller koncept och relationer för att beskriva organisationsstrukturer, medlemskap, roller och hierarkier. Den gör det möjligt att modellera både formella och informella organisationer och deras interna strukturer.`;
    }
    
    if (uri.includes('event') || name.includes('event')) {
      return `Händelseontologin tillhandahåller ett vokabulär för att beskriva händelser, deras tidpunkter, platser, deltagare och andra relaterade koncept. Den kan användas för att representera olika typer av händelser från historiska till planerade.`;
    }
    
    // Generic ontology description based on name
    return `${capitalizeFirstLetter(name)}-ontologin definierar en strukturerad vokabulär och semantik för kunskapsrepresentation inom sitt domänområde. Den tillhandahåller klasser, egenskaper och individer som kan användas för att modellera information på ett semantiskt rikt sätt. Utforska ontologins struktur för att förstå dess omfattning och användningsområden.`;
  };
  
  /**
   * Extract domain name from a URI
   * @param {string} uri - URI string
   * @returns {string} - Domain name
   */
  const extractDomain = (uri) => {
    try {
      if (!uri) return '';
      const match = uri.match(/^(https?:\/\/)?([^\/]+)/i);
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
  };