/**
 * WikiGraph Application JavaScript
 * 
 * This file contains all client-side functionality for the WikiGraph application.
 */

// Handle display toggle for human-readable labels
function initializeDisplayToggle() {
    const displayToggle = document.getElementById('displayToggle');
    
    if (displayToggle) {
      // Add event listener for toggle changes
      displayToggle.addEventListener('change', function() {
        // Store preference in local storage
        localStorage.setItem('showLabels', this.checked);
        
        // Update the display text
        const displayText = document.querySelector('.display-mode-text');
        if (displayText) {
          displayText.textContent = this.checked ? 'På' : 'Av';
        }
        
        // Handle specific page behavior
        const currentPath = window.location.pathname;
        
        if (currentPath === '/query' && document.querySelector('form.query-form')) {
          // On the query form page
          document.getElementById('showLabelsInput').value = this.checked;
        } else if (currentPath.startsWith('/query') && document.querySelector('.query-display')) {
          // On the query results page - resubmit with the same query
          submitQueryWithLabels(this.checked);
        } else {
          // Default behavior - update URL and reload
          updateUrlAndReload(this.checked);
        }
      });
      
      // Initialize from local storage if not in URL
      loadLabelPreference();
    }
  }
  
  // Submit a query form with the current query and updated label setting
  function submitQueryWithLabels(showLabels) {
    // Extract the current query from the page
    const queryElement = document.querySelector('.query-display pre');
    if (!queryElement) return;
    
    const query = queryElement.textContent;
    
    // Create and submit a form
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/query';
    
    const queryInput = document.createElement('input');
    queryInput.type = 'hidden';
    queryInput.name = 'query';
    queryInput.value = query;
    form.appendChild(queryInput);
    
    const showLabelsInput = document.createElement('input');
    showLabelsInput.type = 'hidden';
    showLabelsInput.name = 'showLabels';
    showLabelsInput.value = showLabels;
    form.appendChild(showLabelsInput);
    
    // Preserve hideSystemResources setting if it exists
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('hideSystemResources')) {
      const hideSystemInput = document.createElement('input');
      hideSystemInput.type = 'hidden';
      hideSystemInput.name = 'hideSystemResources';
      hideSystemInput.value = urlParams.get('hideSystemResources');
      form.appendChild(hideSystemInput);
    }
    
    document.body.appendChild(form);
    form.submit();
  }
  
  // Update URL with showLabels parameter and reload the page
  function updateUrlAndReload(showLabels) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('showLabels', showLabels);
    window.location.href = currentUrl.toString();
  }
  
  // Load the label preference from local storage if not specified in URL
  function loadLabelPreference() {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('showLabels')) {
      const storedPref = localStorage.getItem('showLabels');
      if (storedPref !== null) {
        const showLabels = storedPref === 'true';
        const displayToggle = document.getElementById('displayToggle');
        
        if (displayToggle) {
          displayToggle.checked = showLabels;
          
          const displayText = document.querySelector('.display-mode-text');
          if (displayText) {
            displayText.textContent = showLabels ? 'På' : 'Av';
          }
          
          // Update URL and reload based on current page
          const currentPath = window.location.pathname;
          if (currentPath === '/query' && document.querySelector('form.query-form')) {
            // Just update the form input on the query page
            const showLabelsInput = document.getElementById('showLabelsInput');
            if (showLabelsInput) {
              showLabelsInput.value = showLabels;
            }
          } else if (currentPath.startsWith('/query') && document.querySelector('.query-display')) {
            // Resubmit the form on query results page
            submitQueryWithLabels(showLabels);
          } else {
            // Default - update URL and reload
            updateUrlAndReload(showLabels);
          }
        }
      }
    }
  }
  
  // Toggle debug information visibility
  function toggleDebug() {
    const debugInfo = document.getElementById('debugInfo');
    if (debugInfo) {
      debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
    }
  }
  
  // Initialize functionality when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    // Initialize display toggle
    initializeDisplayToggle();
    
    // Add event listener for debug toggle buttons
    const debugToggleBtn = document.querySelector('.debug-panel button');
    if (debugToggleBtn) {
      debugToggleBtn.addEventListener('click', toggleDebug);
    }
  });
/**
 * Ontology Visualization JavaScript
 * Provides functionality for displaying relationships between ontology elements
 */

// Initialize ontology visualization functionality
function initOntologyVisualization() {
  console.log('Initializing ontology visualization features');
  
  // Setup event listeners for relationship visualization buttons
  setupRelationshipVisualizers();
  
  // Setup product display enhancements
  enhanceProductDisplay();
}

// Set up event listeners for relationship visualizer buttons
function setupRelationshipVisualizers() {
  const vizButtons = document.querySelectorAll('.viz-btn');
  
  vizButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      // Store the clicked state to highlight active visualization
      vizButtons.forEach(btn => btn.classList.remove('active-viz'));
      this.classList.add('active-viz');
      
      // We're using link navigation so we don't need additional handling here
      // The SPARQL query embedded in the link will handle the data retrieval
    });
  });
}

// Enhance product display with additional hover effects and functionality
function enhanceProductDisplay() {
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach(card => {
    // Add hover animations and effects
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-5px)';
      this.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.1)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
    });
  });
}

// Function to display relationship details
function showRelationshipDetails(relationshipId) {
  // Find the relationship details element
  const detailsElement = document.getElementById(`relationship-details-${relationshipId}`);
  
  if (detailsElement) {
    // Toggle visibility
    const isHidden = detailsElement.style.display === 'none' || !detailsElement.style.display;
    detailsElement.style.display = isHidden ? 'block' : 'none';
    
    // Update the button text
    const button = document.querySelector(`[data-relationship-id="${relationshipId}"]`);
    if (button) {
      button.textContent = isHidden ? 'Hide Details' : 'View Details';
    }
  }
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  initOntologyVisualization();
  
  // Add event listener to the display toggle to refresh visualizations when labels are toggled
  const displayToggle = document.getElementById('displayToggle');
  if (displayToggle) {
    displayToggle.addEventListener('change', function() {
      // Current page may reload due to label toggle, so no additional handling needed
    });
  }
});