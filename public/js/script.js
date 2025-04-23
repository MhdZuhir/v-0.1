/**
 * WikiGraph Application JavaScript
 * 
 * This file contains all client-side functionality for the WikiGraph application.
 * Completely rewritten toggle handling for maximum compatibility.
 */

// Document ready handler
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, initializing application...');
  
  // Initialize display toggle
  initializeDisplayToggle();
  
  // Add event listener for debug toggle buttons
  const debugToggleBtn = document.querySelector('.debug-panel button');
  if (debugToggleBtn) {
    debugToggleBtn.addEventListener('click', toggleDebug);
  }
  
  // Initialize ontology visualization if available
  if (typeof initOntologyVisualization === 'function') {
    initOntologyVisualization();
  }
});

// Handle display toggle for human-readable labels
function initializeDisplayToggle() {
  const displayToggle = document.getElementById('displayToggle');
  
  if (!displayToggle) {
    console.error('Display toggle checkbox not found!');
    return;
  }
  
  console.log('Display toggle found, initializing...');
  
  // First check if we need to set initial state from URL or localStorage
  setInitialToggleState(displayToggle);
  
  // Add event listener for toggle changes
  displayToggle.addEventListener('change', function() {
    // Get the new state
    const isChecked = this.checked;
    console.log('Toggle changed to:', isChecked);
    
    // Update UI immediately
    updateToggleUI(isChecked);
    
    // Store in localStorage for persistence
    localStorage.setItem('showLabels', isChecked ? 'true' : 'false');
    
    // Reload page with updated URL parameter
    reloadWithUpdatedParameter(isChecked);
  });
}

// Set initial toggle state from URL or localStorage
function setInitialToggleState(toggleElement) {
  // First check URL because it takes precedence
  const urlParams = new URLSearchParams(window.location.search);
  let showLabels;
  
  if (urlParams.has('showLabels')) {
    // Use URL parameter value
    const paramValue = urlParams.get('showLabels');
    showLabels = !(paramValue === 'false'); // Only 'false' turns it off
    console.log('Setting initial state from URL parameter:', paramValue, '→', showLabels);
  } else {
    // Fall back to localStorage if available
    const storedValue = localStorage.getItem('showLabels');
    if (storedValue !== null) {
      showLabels = storedValue !== 'false'; // Only 'false' turns it off
      console.log('Setting initial state from localStorage:', storedValue, '→', showLabels);
    } else {
      // Default to true if neither is available
      showLabels = true;
      console.log('No saved preference found, defaulting to:', showLabels);
    }
  }
  
  // Set the checkbox state
  toggleElement.checked = showLabels;
  
  // Update UI to match
  updateToggleUI(showLabels);
}

// Update the UI elements related to the toggle
function updateToggleUI(showLabels) {
  const displayText = document.querySelector('.display-mode-text');
  if (displayText) {
    displayText.textContent = showLabels ? 'På' : 'Av';
  }
}

// Reload the page with updated showLabels parameter
function reloadWithUpdatedParameter(showLabels) {
  // Special handling for query page
  const currentPath = window.location.pathname;
  
  // Handle the query form page specially
  if (currentPath === '/query' && document.querySelector('form.query-form')) {
    const showLabelsInput = document.getElementById('showLabelsInput');
    if (showLabelsInput) {
      // Just update the hidden input value - don't reload
      showLabelsInput.value = showLabels ? 'true' : 'false';
      console.log('Updated showLabelsInput value to:', showLabelsInput.value);
      return; // Don't reload
    }
  }
  
  // Handle query results page specially
  if (currentPath.startsWith('/query') && document.querySelector('.query-display')) {
    submitQueryWithLabels(showLabels);
    return; // Don't use the default reload
  }
  
  // Default behavior for all other pages - update URL and reload
  const currentUrl = new URL(window.location.href);
  // Be explicit with string values, not boolean
  currentUrl.searchParams.set('showLabels', showLabels ? 'true' : 'false');
  console.log('Reloading with URL:', currentUrl.toString());
  window.location.href = currentUrl.toString();
}

// Submit a query form with the current query and updated label setting
function submitQueryWithLabels(showLabels) {
  // Extract the current query from the page
  const queryElement = document.querySelector('.query-display pre');
  if (!queryElement) {
    console.error('Query element not found');
    return;
  }
  
  const query = queryElement.textContent;
  console.log('Submitting query with labels:', showLabels);
  
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
  // Be explicit with string values, not boolean
  showLabelsInput.value = showLabels ? 'true' : 'false';
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

// Toggle debug information visibility
function toggleDebug() {
  const debugInfo = document.getElementById('debugInfo');
  if (debugInfo) {
    debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
  }
}

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