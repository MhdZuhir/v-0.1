// public/js/ontology-connections.js

/**
 * Ontology Connection Handler - Enhances the browsing experience by showing ontology connections
 */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize ontology connection feature
    initOntologyConnections();
    
    // Setup detail page network visualization if we're on the detail page
    setupNetworkVisualization();
  });
  
  /**
   * Initialize ontology connections on the home page
   */
  function initOntologyConnections() {
    const ontologyCards = document.querySelectorAll('.ontology-card');
    if (ontologyCards.length === 0) return;
    
    // Map of ontologies
    const ontologies = {};
    
    // Extract ontology information from cards
    ontologyCards.forEach((card, index) => {
      try {
        const titleElement = card.querySelector('.ontology-card-header h3 a');
        if (!titleElement) return;
        
        const uri = titleElement.getAttribute('href').split('uri=')[1].split('&')[0];
        const title = titleElement.textContent.trim();
        
        // Get stats if available
        const statsElements = card.querySelectorAll('.ontology-stats .stat');
        const classes = statsElements.length > 0 ? 
          parseInt(statsElements[0].textContent.match(/\d+/)[0]) : 0;
        const props = statsElements.length > 1 ? 
          parseInt(statsElements[1].textContent.match(/\d+/)[0]) : 0;
        
        ontologies[uri] = {
          uri: decodeURIComponent(uri),
          title,
          element: card,
          index,
          classes,
          properties: props,
          connections: []
        };
        
        // Add a small badge showing number of connections (will be updated later)
        const headerElement = card.querySelector('.ontology-card-header');
        if (headerElement) {
          const badge = document.createElement('div');
          badge.className = 'connectivity-badge';
          badge.textContent = '0';
          badge.dataset.connections = '0';
          headerElement.appendChild(badge);
        }
      } catch (err) {
        console.error('Error processing ontology card:', err);
      }
    });
    
    // Create connections between ontologies
    const uris = Object.keys(ontologies);
    
    // Create a connection matrix
    for (let i = 0; i < uris.length; i++) {
      for (let j = i + 1; j < uris.length; j++) {
        const uriA = uris[i];
        const uriB = uris[j];
        const ontologyA = ontologies[uriA];
        const ontologyB = ontologies[uriB];
        
        // Determine connection strength based on various factors
        let connectionScore = 0;
        
        // 1. Similar class counts
        const classRatio = Math.min(ontologyA.classes, ontologyB.classes) / 
                           Math.max(ontologyA.classes, ontologyB.classes) || 0;
        connectionScore += classRatio * 0.4;
        
        // 2. Similar property counts
        const propRatio = Math.min(ontologyA.properties, ontologyB.properties) / 
                         Math.max(ontologyA.properties, ontologyB.properties) || 0;
        connectionScore += propRatio * 0.3;
        
        // 3. Similar title words (simple text similarity)
        const wordsA = ontologyA.title.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const wordsB = ontologyB.title.toLowerCase().split(/\W+/).filter(w => w.length > 3);
        const commonWords = wordsA.filter(word => wordsB.includes(word));
        connectionScore += (commonWords.length / Math.max(wordsA.length, wordsB.length) || 0) * 0.3;
        
        // Create connection if score is high enough
        if (connectionScore > 0.4) {
          ontologyA.connections.push({
            target: ontologyB,
            score: connectionScore
          });
          
          ontologyB.connections.push({
            target: ontologyA,
            score: connectionScore
          });
        }
      }
    }
    
    // Ensure minimum connectivity (each ontology should have at least one connection)
    uris.forEach(uri => {
      const ontology = ontologies[uri];
      
      if (ontology.connections.length === 0) {
        // Find the closest ontology
        let bestMatch = null;
        let bestScore = -1;
        
        uris.forEach(otherUri => {
          if (otherUri !== uri) {
            const other = ontologies[otherUri];
            
            // Simple distance score based on array index
            const indexDistance = Math.abs(ontology.index - other.index);
            const score = 1 / (1 + indexDistance);
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = other;
            }
          }
        });
        
        // Connect to the best match
        if (bestMatch) {
          ontology.connections.push({
            target: bestMatch,
            score: 0.3
          });
          
          bestMatch.connections.push({
            target: ontology,
            score: 0.3
          });
        }
      }
    });
    
    // Update badges to show connection count
    uris.forEach(uri => {
      const ontology = ontologies[uri];
      const card = ontology.element;
      const badge = card.querySelector('.connectivity-badge');
      
      if (badge) {
        const count = ontology.connections.length;
        badge.textContent = count;
        badge.dataset.connections = count;
        
        // Add tooltip
        badge.title = `${count} relaterade ontologier`;
        
        // Style based on connection count
        if (count > 3) {
          badge.style.backgroundColor = '#2e7d32'; // Green for high connectivity
        } else if (count > 1) {
          badge.style.backgroundColor = '#0645ad'; // Blue for medium connectivity
        } else {
          badge.style.backgroundColor = '#757575'; // Gray for low connectivity
        }
      }
      
      // Add hover effect to show connections
      card.addEventListener('mouseenter', function() {
        highlightConnections(ontology, ontologies);
      });
      
      card.addEventListener('mouseleave', function() {
        resetConnections(ontologies);
      });
    });
    
    // Log connection info for debugging
    console.log('Ontology connections initialized:', ontologies);
  }
  
  /**
   * Highlight connected ontologies when hovering
   */
  function highlightConnections(ontology, allOntologies) {
    // Reset all first
    resetConnections(allOntologies);
    
    // Highlight the connected ontologies
    ontology.connections.forEach(connection => {
      const connectedCard = connection.target.element;
      
      // Add a highlighted class
      connectedCard.classList.add('connected-highlight');
      
      // Add a visual connection line (optional)
      const strength = Math.floor(connection.score * 5);
      connectedCard.style.boxShadow = `0 0 ${strength}px ${3 + strength}px rgba(6, 69, 173, 0.3)`;
    });
    
    // Highlight current ontology
    ontology.element.classList.add('focus-highlight');
    ontology.element.style.boxShadow = '0 0 8px 5px rgba(6, 69, 173, 0.4)';
    ontology.element.style.zIndex = '10';
  }
  
  /**
   * Reset connection highlights
   */
  function resetConnections(allOntologies) {
    const uris = Object.keys(allOntologies);
    
    uris.forEach(uri => {
      const card = allOntologies[uri].element;
      card.classList.remove('connected-highlight', 'focus-highlight');
      card.style.boxShadow = '';
      card.style.zIndex = '';
    });
  }
  
  /**
   * Setup the network visualization on detail page
   */
  function setupNetworkVisualization() {
    const networkContainer = document.getElementById('ontologyNetwork');
    if (!networkContainer) return;
    
    // Make the visualization interactive
    const nodes = networkContainer.querySelectorAll('.ontology-network-node');
    
    nodes.forEach(node => {
      // Add highlight effect on hover
      node.addEventListener('mouseenter', function() {
        this.style.transform = 'scale(1.1)';
        this.style.boxShadow = '0 0 10px rgba(6, 69, 173, 0.5)';
        this.style.zIndex = '100';
      });
      
      node.addEventListener('mouseleave', function() {
        if (this.classList.contains('primary')) {
          this.style.transform = '';
          this.style.boxShadow = '';
          this.style.zIndex = '2';
        } else {
          this.style.transform = '';
          this.style.boxShadow = '';
          this.style.zIndex = '2';
        }
      });
    });
  }