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

  // Initialize search validation
  initializeSearchValidation();
});

// Function to initialize search validation
function initializeSearchValidation() {
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const errorMessage = document.getElementById('searchError');

  searchForm.addEventListener('submit', function(e) {
    const value = searchInput.value.trim();
    if (!value) {
      e.preventDefault(); // Prevent form submission if the input is empty
      searchInput.classList.add('input-error'); // Add error style to input
      errorMessage.style.display = 'block'; // Show error message
    } else {
      searchInput.classList.remove('input-error'); // Remove error style
      errorMessage.style.display = 'none'; // Hide error message
    }
  });
}

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
