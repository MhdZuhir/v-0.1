// WebVOWL-style Ontology Visualization
// This script creates an interactive force-directed graph visualization 
// similar to WebVOWL for displaying ontology structure

document.addEventListener('DOMContentLoaded', function() {
  // Create the visualization container if it doesn't exist
  if (!document.getElementById('ontologyVisualization')) {
    const mainContent = document.querySelector('.ontology-container') || 
                        document.querySelector('main') || 
                        document.body;
    
    const vizContainer = document.createElement('div');
    vizContainer.id = 'ontologyVisualization';
    vizContainer.className = 'webvowl-section';
    
    // Add custom styling
    const style = document.createElement('style');
    style.textContent = `
      .webvowl-section {
        margin: 2rem 0;
        background-color: #ffffff;
        border-radius: 8px;
        border: 1px solid #e0e0e0;
        overflow: hidden;
      }
      
      .viz-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #e0e0e0;
        background-color: #f8f9fa;
      }
      
      .viz-title {
        font-size: 1.4rem;
        color: #000080;
        margin: 0;
      }
      
      .viz-controls {
        display: flex;
        gap: 10px;
      }
      
      .viz-button {
        background-color: #f0f0f0;
        border: 1px solid #ddd;
        padding: 0.4rem 0.8rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.9rem;
      }
      
      .viz-button:hover {
        background-color: #e5e5e5;
      }
      
      .viz-canvas {
        width: 100%;
        height: 600px;
        background-color: #f9f9fa;
        position: relative;
        overflow: hidden;
      }
      
      .viz-legend {
        padding: 1rem;
        background-color: #f8f9fa;
        border-top: 1px solid #e0e0e0;
        font-size: 0.9rem;
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
      }
      
      .legend-item {
        display: flex;
        align-items: center;
        margin-right: 15px;
      }
      
      .legend-color {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        margin-right: 5px;
      }
      
      /* Node styling */
      .vowl-node {
        position: absolute;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        transition: all 0.3s ease;
        overflow: visible;
        z-index: 10;
        font-weight: bold;
        text-align: center;
        color: #fff;
      }
      
      .vowl-node:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 20;
      }
      
      .vowl-node-label {
        position: absolute;
        white-space: nowrap;
        font-size: 12px;
        background-color: rgba(255, 255, 255, 0.9);
        padding: 2px 5px;
        border-radius: 3px;
        border: 1px solid #ccc;
        pointer-events: none;
        z-index: 15;
        color: #333;
      }
      
      /* Edge styling */
      .vowl-edge {
        position: absolute;
        height: 2px;
        background-color: rgba(100, 100, 100, 0.5);
        transform-origin: 0 0;
        z-index: 5;
        pointer-events: none;
      }
      
      .vowl-edge-label {
        position: absolute;
        white-space: nowrap;
        font-size: 10px;
        background-color: rgba(255, 255, 255, 0.8);
        padding: 1px 3px;
        border-radius: 2px;
        border: 1px solid #eee;
        pointer-events: none;
        z-index: 15;
        color: #555;
      }
      
      /* Node type styling */
      .vowl-class {
        background-color: #1E88E5;
        border: 2px solid rgba(30, 136, 229, 0.7);
      }
      
      .vowl-property {
        background-color: #43A047;
        border: 2px solid rgba(67, 160, 71, 0.7);
      }
      
      .vowl-individual {
        background-color: #FB8C00;
        border: 2px solid rgba(251, 140, 0, 0.7);
      }
      
      .vowl-literal {
        background-color: #9C27B0;
        border: 2px solid rgba(156, 39, 176, 0.7);
      }
      
      .vowl-annotation {
        background-color: #607D8B;
        border: 2px solid rgba(96, 125, 139, 0.7);
      }
      
      /* Edge type styling */
      .vowl-domain-range {
        background-color: rgba(100, 100, 100, 0.8);
      }
      
      .vowl-subclass {
        background-color: rgba(30, 136, 229, 0.8);
      }
      
      .vowl-relationship {
        background-color: rgba(67, 160, 71, 0.8);
      }
      
      /* Arrow for directed edges */
      .vowl-arrow {
        position: absolute;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 5px 0 5px 8px;
        border-color: transparent transparent transparent rgba(100, 100, 100, 0.8);
        transform-origin: 0 0;
        z-index: 6;
        pointer-events: none;
      }
      
      /* Info panel for selected nodes */
      .vowl-info-panel {
        position: absolute;
        bottom: 20px;
        right: 20px;
        width: 300px;
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        padding: 15px;
        z-index: 100;
        display: none;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .vowl-info-panel h3 {
        margin-top: 0;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }
      
      .vowl-info-panel p {
        margin: 5px 0;
        font-size: 13px;
      }
      
      .vowl-info-panel .info-uri {
        font-family: monospace;
        font-size: 11px;
        word-break: break-all;
        background-color: #f5f5f5;
        padding: 5px;
        border-radius: 3px;
        margin-top: 10px;
      }
      
      .vowl-info-panel .info-close {
        position: absolute;
        top: 10px;
        right: 10px;
        cursor: pointer;
        font-size: 16px;
        color: #777;
      }
      
      /* Zoom controls */
      .zoom-controls {
        position: absolute;
        bottom: 20px;
        left: 20px;
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 5px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        z-index: 50;
      }
      
      .zoom-btn {
        width: 30px;
        height: 30px;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 18px;
        cursor: pointer;
        user-select: none;
      }
      
      .zoom-btn:hover {
        background-color: #f5f5f5;
      }
      
      .zoom-in {
        border-bottom: 1px solid #ddd;
        border-top-left-radius: 5px;
        border-top-right-radius: 5px;
      }
      
      .zoom-out {
        border-bottom-left-radius: 5px;
        border-bottom-right-radius: 5px;
      }
      
      /* Touch device optimization */
      @media (max-width: 768px) {
        .viz-canvas {
          height: 400px;
        }
        
        .vowl-node {
          transform: scale(0.9);
        }
        
        .zoom-controls {
          transform: scale(1.2);
          bottom: 15px;
          left: 15px;
        }
      }
    `;
    
    // Create content structure
    const vizContent = `
      <div class="viz-header">
        <h3 class="viz-title">Ontology Visualization</h3>
        <div class="viz-controls">
          <button id="resetVisualization" class="viz-button">Reset</button>
          <button id="togglePhysics" class="viz-button">Toggle Physics</button>
        </div>
      </div>
      
      <div id="vizCanvas" class="viz-canvas">
        <!-- Nodes and edges will be added here -->
        
        <!-- Zoom controls -->
        <div class="zoom-controls">
          <div class="zoom-btn zoom-in">+</div>
          <div class="zoom-btn zoom-out">−</div>
        </div>
        
        <!-- Info panel for selected nodes -->
        <div class="vowl-info-panel" id="nodeInfoPanel">
          <span class="info-close">&times;</span>
          <h3 id="infoPanelTitle">Class Name</h3>
          <p id="infoPanelType">Type: Class</p>
          <p id="infoPanelDescription">Description of this entity...</p>
          <div class="info-uri" id="infoPanelUri">http://example.org/ontology#Class</div>
        </div>
      </div>
      
      <div class="viz-legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #1E88E5;"></div>
          <span>Class</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #43A047;"></div>
          <span>Property</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #FB8C00;"></div>
          <span>Individual</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #9C27B0;"></div>
          <span>Literal</span>
        </div>
        <div class="legend-item">
          <div class="legend-color" style="background-color: #607D8B;"></div>
          <span>Annotation</span>
        </div>
      </div>
    `;
    
    // Add elements to the page
    vizContainer.innerHTML = vizContent;
    document.head.appendChild(style);
    
    // Find the best place to insert the visualization
    const overview = document.getElementById('overview');
    if (overview) {
      overview.after(vizContainer);
    } else {
      const titleElement = mainContent.querySelector('h1');
      if (titleElement && titleElement.nextElementSibling) {
        titleElement.nextElementSibling.after(vizContainer);
      } else if (titleElement) {
        titleElement.after(vizContainer);
      } else {
        mainContent.prepend(vizContainer);
      }
    }
    
    // Initialize the visualization
    initWebVOWLVisualization();
  }
});

/**
 * Initialize and render the WebVOWL-style visualization
 */
function initWebVOWLVisualization() {
  // Get the canvas element
  const canvas = document.getElementById('vizCanvas');
  if (!canvas) return;
  
  // Clear any existing content
  canvas.innerHTML = `
    <!-- Zoom controls -->
    <div class="zoom-controls">
      <div class="zoom-btn zoom-in">+</div>
      <div class="zoom-btn zoom-out">−</div>
    </div>
    
    <!-- Info panel for selected nodes -->
    <div class="vowl-info-panel" id="nodeInfoPanel">
      <span class="info-close">&times;</span>
      <h3 id="infoPanelTitle">Class Name</h3>
      <p id="infoPanelType">Type: Class</p>
      <p id="infoPanelDescription">Description of this entity...</p>
      <div class="info-uri" id="infoPanelUri">http://example.org/ontology#Class</div>
    </div>
  `;
  
  // Extract ontology data from the page
  const ontologyData = extractOntologyData();
  
  // Set up the physics simulation
  const simulation = setupPhysicsSimulation(ontologyData, canvas);
  
  // Render the visualization with physics
  const elements = renderWebVOWLVisualization(canvas, ontologyData, simulation);
  
  // Store elements globally for access in other functions
  window.vowlElements = elements;
  
  // Add reset functionality
  const resetButton = document.getElementById('resetVisualization');
  if (resetButton) {
    resetButton.addEventListener('click', function() {
      resetSimulation(simulation, ontologyData);
    });
  }
  
  // Add physics toggle functionality
  const toggleButton = document.getElementById('togglePhysics');
  if (toggleButton) {
    toggleButton.addEventListener('click', function() {
      const isRunning = togglePhysics(simulation);
      this.textContent = isRunning ? 'Pause Physics' : 'Resume Physics';
    });
  }
  
  // Add zoom functionality
  setupZoomControls(canvas);
  
  // Setup info panel behavior
  setupInfoPanel();
}

/**
 * Extract ontology data from the current page
 */
function extractOntologyData() {
  const ontologyTitle = document.querySelector('h1')?.textContent || 'Ontology';
  const ontologyUri = document.querySelector('.metadata-section code')?.textContent || '';
  
  // Collect classes from the page
  const classes = [];
  document.querySelectorAll('.class-item, #classes .entity-item, .entity-items .class-item').forEach((element, index) => {
    const nameElement = element.querySelector('h3') || element;
    const nameText = nameElement.textContent.replace(/\s*\<.*\>\s*$/, '').trim(); // Remove the type indicator like <c>
    const descElement = element.querySelector('.property-description') || element.querySelector('p');
    const description = descElement ? descElement.textContent.trim() : '';
    const uriElement = element.querySelector('code');
    const uri = uriElement ? uriElement.textContent.trim() : '';
    
    classes.push({
      id: `class_${index}`,
      name: nameText,
      description: description,
      uri: uri,
      type: 'class',
      size: 60 + (description.length > 0 ? 10 : 0) // Bigger if it has a description
    });
  });
  
  // Collect properties from the page
  const properties = [];
  document.querySelectorAll('.property-item, #object-properties .entity-item, .entity-items .property-item').forEach((element, index) => {
    const nameElement = element.querySelector('h3') || element;
    const nameText = nameElement.textContent.replace(/\s*\<.*\>\s*$/, '').trim();
    const descElement = element.querySelector('.property-description') || element.querySelector('p');
    const description = descElement ? descElement.textContent.trim() : '';
    const uriElement = element.querySelector('code');
    const uri = uriElement ? uriElement.textContent.trim() : '';
    
    // Try to extract domain and range
    let domain = '';
    let range = '';
    
    const domainElement = element.textContent.match(/Domain:?\s*([^\n]+)/i);
    if (domainElement) {
      domain = domainElement[1].trim();
    }
    
    const rangeElement = element.textContent.match(/Range:?\s*([^\n]+)/i);
    if (rangeElement) {
      range = rangeElement[1].trim();
    }
    
    properties.push({
      id: `property_${index}`,
      name: nameText,
      description: description,
      uri: uri,
      type: 'property',
      domain: domain,
      range: range,
      size: 50
    });
  });
  
  // Collect individuals if available
  const individuals = [];
  document.querySelectorAll('.individual-item').forEach((element, index) => {
    const nameElement = element.querySelector('h3') || element;
    const nameText = nameElement.textContent.replace(/\s*\<.*\>\s*$/, '').trim();
    const uriElement = element.querySelector('code');
    const uri = uriElement ? uriElement.textContent.trim() : '';
    
    individuals.push({
      id: `individual_${index}`,
      name: nameText,
      uri: uri,
      type: 'individual',
      size: 40
    });
  });
  
  // Add annotation properties
  const annotations = [];
  document.querySelectorAll('#annotation-properties .entity-item').forEach((element, index) => {
    const nameElement = element.querySelector('h3') || element;
    const nameText = nameElement.textContent.replace(/\s*\<.*\>\s*$/, '').trim();
    const descElement = element.querySelector('.property-description') || element.querySelector('p');
    const description = descElement ? descElement.textContent.trim() : '';
    const uriElement = element.querySelector('code');
    const uri = uriElement ? uriElement.textContent.trim() : '';
    
    annotations.push({
      id: `annotation_${index}`,
      name: nameText,
      description: description,
      uri: uri,
      type: 'annotation',
      size: 45
    });
  });
  
  // If not enough entities found, add placeholders based on stats
  const statsElements = document.querySelectorAll('.stats-summary .stat-item');
  let classStats = 0, propertyStats = 0, individualStats = 0;
  
  if (statsElements.length >= 3) {
    classStats = parseInt(statsElements[0].querySelector('.stat-value')?.textContent || '0');
    propertyStats = parseInt(statsElements[1].querySelector('.stat-value')?.textContent || '0');
    individualStats = parseInt(statsElements[2].querySelector('.stat-value')?.textContent || '0');
  }
  
  // Add placeholder classes if needed
  if (classes.length === 0 && classStats > 0) {
    for (let i = 0; i < Math.min(classStats, 10); i++) {
      classes.push({
        id: `class_placeholder_${i}`,
        name: `Class ${i+1}`,
        type: 'class',
        size: 60
      });
    }
  }
  
  // Add placeholder properties if needed
  if (properties.length === 0 && propertyStats > 0) {
    for (let i = 0; i < Math.min(propertyStats, 10); i++) {
      properties.push({
        id: `property_placeholder_${i}`,
        name: `Property ${i+1}`,
        type: 'property',
        size: 50
      });
    }
  }
  
  // Generate relationships between entities
  const relationships = [];
  
  // Connect classes with properties based on domain/range
  properties.forEach(property => {
    // Find domain class
    if (property.domain) {
      const domainClass = classes.find(c => 
        c.name === property.domain || 
        property.domain.includes(c.name));
      
      if (domainClass) {
        relationships.push({
          source: domainClass.id,
          target: property.id,
          type: 'domain-range',
          label: 'domain'
        });
      }
    }
    
    // Find range class
    if (property.range) {
      const rangeClass = classes.find(c => 
        c.name === property.range || 
        property.range.includes(c.name));
      
      if (rangeClass) {
        relationships.push({
          source: property.id,
          target: rangeClass.id,
          type: 'domain-range',
          label: 'range'
        });
      }
    }
  });
  
  // Connect classes with their subclasses if found in description
  classes.forEach((classA, i) => {
    classes.forEach((classB, j) => {
      if (i !== j) {
        // Check for subclass relationship in description
        if (classB.description && 
            (classB.description.toLowerCase().includes(`subclass of ${classA.name.toLowerCase()}`) ||
             classB.description.toLowerCase().includes(`subclass of: ${classA.name.toLowerCase()}`))) {
          relationships.push({
            source: classB.id,
            target: classA.id,
            type: 'subclass',
            label: 'subClassOf'
          });
        }
      }
    });
  });
  
  // Add some placeholder relationships if none found
  if (relationships.length === 0) {
    // Connect each property with at least one class
    properties.forEach((property, i) => {
      if (classes.length > 0) {
        const classIndex = i % classes.length;
        relationships.push({
          source: classes[classIndex].id,
          target: property.id,
          type: 'domain-range',
          label: 'domain'
        });
        
        // Add range to another class if available
        if (classes.length > 1) {
          const rangeIndex = (i + 1) % classes.length;
          relationships.push({
            source: property.id,
            target: classes[rangeIndex].id,
            type: 'domain-range',
            label: 'range'
          });
        }
      }
    });
    
    // Add subclass relationships between classes
    if (classes.length > 1) {
      for (let i = 1; i < classes.length; i++) {
        if (Math.random() > 0.3) { // 70% chance to create a subclass relationship
          relationships.push({
            source: classes[i].id,
            target: classes[0].id,
            type: 'subclass',
            label: 'subClassOf'
          });
        }
      }
    }
  }
  
  // Collect all nodes
  const nodes = [
    ...classes,
    ...properties,
    ...individuals,
    ...annotations
  ];
  
  return {
    title: ontologyTitle,
    uri: ontologyUri,
    nodes: nodes,
    edges: relationships,
    stats: {
      classes: classStats || classes.length,
      properties: propertyStats || properties.length,
      individuals: individualStats || individuals.length
    }
  };
}

/**
 * Set up the physics simulation for force-directed layout
 */
function setupPhysicsSimulation(data, canvas) {
  // Create a simple physics simulation
  const nodes = data.nodes.map(node => ({
    ...node,
    x: Math.random() * canvas.offsetWidth,
    y: Math.random() * canvas.offsetHeight,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null
  }));
  
  // Convert edge references from IDs to node objects
  const edges = data.edges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (sourceNode && targetNode) {
      return {
        ...edge,
        source: sourceNode,
        target: targetNode
      };
    }
    return null;
  }).filter(e => e !== null);
  
  // Create simulation object
  const simulation = {
    nodes,
    edges,
    isRunning: true,
    alpha: 1,
    alphaMin: 0.001,
    alphaDecay: 0.0228,
    centerX: canvas.offsetWidth / 2,
    centerY: canvas.offsetHeight / 2,
    strength: -800,
    distance: 150,
    
    // Physics tick function
    tick: function() {
      if (!this.isRunning || this.alpha < this.alphaMin) return;
      
      // Apply forces
      // Repulsive force between all nodes
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const nodeA = this.nodes[i];
          const nodeB = this.nodes[j];
          
          // Skip fixed nodes
          if ((nodeA.fx !== null && nodeA.fy !== null) && 
              (nodeB.fx !== null && nodeB.fy !== null)) continue;
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          
          // Repulsive force (inverse square law)
          const force = this.strength / (distance * distance);
          
          // Normalized direction vector
          const unitX = dx / distance;
          const unitY = dy / distance;
          
          // Apply forces
          if (nodeA.fx === null) {
            nodeA.vx -= unitX * force / nodeA.size;
            nodeA.vy -= unitY * force / nodeA.size;
          }
          
          if (nodeB.fx === null) {
            nodeB.vx += unitX * force / nodeB.size;
            nodeB.vy += unitY * force / nodeB.size;
          }
        }
      }
      
      // Attractive force along edges
      this.edges.forEach(edge => {
        const source = edge.source;
        const target = edge.target;
        
        // Skip fixed nodes
        if ((source.fx !== null && source.fy !== null) && 
            (target.fx !== null && target.fy !== null)) return;
        
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        
        // Spring force (Hooke's law)
        const force = (distance - this.distance) * 0.1;
        
        // Normalized direction vector
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Apply forces
        if (source.fx === null) {
          source.vx += unitX * force;
          source.vy += unitY * force;
        }
        
        if (target.fx === null) {
          target.vx -= unitX * force;
          target.vy -= unitY * force;
        }
      });
      
      // Centering force towards the middle of the canvas
      this.nodes.forEach(node => {
        if (node.fx !== null && node.fy !== null) return;
        
        const dx = this.centerX - node.x;
        const dy = this.centerY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Gentle force towards center
        node.vx += dx * 0.003;
        node.vy += dy * 0.003;
        
        // Boundary forces to keep nodes on screen
        const padding = node.size;
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        
        if (node.x < padding) node.vx += 1;
        if (node.x > canvasWidth - padding) node.vx -= 1;
        if (node.y < padding) node.vy += 1;
        if (node.y > canvasHeight - padding) node.vy -= 1;
        
        // Update position with velocity
        node.x += node.vx * 0.5;
        node.y += node.vy * 0.5;
        
        // Damping
        node.vx *= 0.9;
        node.vy *= 0.9;
      });
      
      // Decay alpha
      this.alpha *= (1 - this.alphaDecay);
      
      return true; // Simulation updated
    },
    
    // Restart the simulation
    restart: function() {
      this.alpha = 1;
      this.isRunning = true;
    },
    
    // Toggle simulation state
    toggle: function() {
      this.isRunning = !this.isRunning;
      if (this.isRunning && this.alpha < 0.1) {
        this.alpha = 0.1; // Boost alpha when restarting
      }
      return this.isRunning;
    },
    
    // Reset node positions
    reset: function() {
      this.nodes.forEach(node => {
        node.x = Math.random() * canvas.offsetWidth;
        node.y = Math.random() * canvas.offsetHeight;
        node.vx = 0;
        node.vy = 0;
        node.fx = null;
        node.fy = null;
      });
      this.alpha = 1;
      this.isRunning = true;
    }
  };
  
  return simulation;
}

/**
 * Reset the simulation to its initial state
 */
function resetSimulation(simulation, data) {
  // Reset node positions
  simulation.reset();
}

/**
 * Toggle the physics simulation on/off
 */
function togglePhysics(simulation) {
  return simulation.toggle();
}

/**
 * Set up zoom controls
 */
function setupZoomControls(canvas) {
  let currentScale = 1.0;
  const minScale = 0.5;
  const maxScale = 2.0;
  const scaleStep = 0.1;
  
  // Set transform origin to center
  canvas.style.transformOrigin = 'center center';
  
  // Get zoom buttons
  const zoomInBtn = canvas.querySelector('.zoom-in');
  const zoomOutBtn = canvas.querySelector('.zoom-out');
  
  // Add zoom in functionality
  zoomInBtn.addEventListener('click', function() {
    if (currentScale < maxScale) {
      currentScale += scaleStep;
      applyZoom();
    }
  });
  
  // Add zoom out functionality
  zoomOutBtn.addEventListener('click', function() {
    if (currentScale > minScale) {
      currentScale -= scaleStep;
      applyZoom();
    }
  });
  
  // Apply zoom level
  function applyZoom() {
    canvas.style.transform = `scale(${currentScale})`;
  }
  
  // Add mousewheel zoom
  canvas.addEventListener('wheel', function(e) {
    e.preventDefault();
    
    // Determine zoom direction
    if (e.deltaY < 0 && currentScale < maxScale) {
      // Zoom in
      currentScale += scaleStep;
    } else if (e.deltaY > 0 && currentScale > minScale) {
      // Zoom out
      currentScale -= scaleStep;
    }
    
    applyZoom();
  });
}

/**
 * Show info panel with node information
 */
function showInfoPanel(node) {
  const panel = document.getElementById('nodeInfoPanel');
  const title = document.getElementById('infoPanelTitle');
  const type = document.getElementById('infoPanelType');
  const description = document.getElementById('infoPanelDescription');
  const uri = document.getElementById('infoPanelUri');
  
  // Update panel content
  title.textContent = node.name;
  type.textContent = `Type: ${node.type.charAt(0).toUpperCase() + node.type.slice(1)}`;
  description.textContent = node.description || 'No description available.';
  uri.textContent = node.uri || '';
  
  // Show the panel
  panel.style.display = 'block';
}

/**
 * Setup info panel behavior
 */
function setupInfoPanel() {
  const panel = document.getElementById('nodeInfoPanel');
  const closeBtn = panel.querySelector('.info-close');
  
  // Add close button functionality
  closeBtn.addEventListener('click', function() {
    panel.style.display = 'none';
  });
}

/**
 * Setup dragging behavior for nodes
 */
function setupNodeDragging(element, node, simulation) {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  // Mouse down event
  element.addEventListener('mousedown', startDrag);
  element.addEventListener('touchstart', handleTouchStart);
  
  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    
    // Calculate offset from node center
    const rect = element.getBoundingClientRect();
    offsetX = e.clientX - (rect.left + rect.width/2);
    offsetY = e.clientY - (rect.top + rect.height/2);
    
    // Fix node position during drag
    node.fx = node.x;
    node.fy = node.y;
    
    // Add move and up listeners to document
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
  }
  
  function handleTouchStart(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      isDragging = true;
      
      // Calculate offset
      const rect = element.getBoundingClientRect();
      offsetX = touch.clientX - (rect.left + rect.width/2);
      offsetY = touch.clientY - (rect.top + rect.height/2);
      
      // Fix node position
      node.fx = node.x;
      node.fy = node.y;
      
      // Add touch listeners
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }
  }
  
  function drag(e) {
    if (!isDragging) return;
    
    // Get canvas and its position
    const canvas = document.getElementById('vizCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    // Update node fixed position
    node.fx = e.clientX - canvasRect.left - offsetX;
    node.fy = e.clientY - canvasRect.top - offsetY;
    
    // Ensure within boundaries
    node.fx = Math.max(node.size/2, Math.min(canvas.offsetWidth - node.size/2, node.fx));
    node.fy = Math.max(node.size/2, Math.min(canvas.offsetHeight - node.size/2, node.fy));
  }
  
  function handleTouchMove(e) {
    if (!isDragging || e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    const canvas = document.getElementById('vizCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    
    // Update node fixed position
    node.fx = touch.clientX - canvasRect.left - offsetX;
    node.fy = touch.clientY - canvasRect.top - offsetY;
    
    // Ensure within boundaries
    node.fx = Math.max(node.size/2, Math.min(canvas.offsetWidth - node.size/2, node.fx));
    node.fy = Math.max(node.size/2, Math.min(canvas.offsetHeight - node.size/2, node.fy));
  }
  
  function endDrag() {
    if (isDragging) {
      isDragging = false;
      
      // When shift key is pressed, keep the node fixed, otherwise release it
      if (!window.event.shiftKey) {
        node.fx = null;
        node.fy = null;
      }
      
      // Remove event listeners
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', endDrag);
    }
  }
  
  function handleTouchEnd() {
    if (isDragging) {
      isDragging = false;
      
      // Release the node (mobile doesn't have shift key equivalent)
      node.fx = null;
      node.fy = null;
      
      // Remove touch event listeners
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    }
  }
}

/**
 * Render the WebVOWL-style visualization
 */
function renderWebVOWLVisualization(canvas, data, simulation) {
  // Create DOM elements for nodes and edges
  const elements = {
    nodes: [],
    edges: [],
    nodeLabels: [],
    edgeLabels: [],
    arrows: []
  };
  
  // Create edge elements first (lower z-index)
  simulation.edges.forEach((edge, index) => {
    // Create edge element
    const edgeElement = document.createElement('div');
    edgeElement.className = `vowl-edge vowl-${edge.type}`;
    edgeElement.id = `edge_${index}`;
    canvas.appendChild(edgeElement);
    
    // Create arrow element
    const arrowElement = document.createElement('div');
    arrowElement.className = 'vowl-arrow';
    arrowElement.id = `arrow_${index}`;
    canvas.appendChild(arrowElement);
    
    // Create edge label if it has one
    if (edge.label) {
      const labelElement = document.createElement('div');
      labelElement.className = 'vowl-edge-label';
      labelElement.id = `edge_label_${index}`;
      labelElement.textContent = edge.label;
      canvas.appendChild(labelElement);
      elements.edgeLabels.push(labelElement);
    }
    
    elements.edges.push(edgeElement);
    elements.arrows.push(arrowElement);
  });
  
  // Create node elements
  simulation.nodes.forEach((node) => {
    // Create node element
    const nodeElement = document.createElement('div');
    nodeElement.className = `vowl-node vowl-${node.type}`;
    nodeElement.id = node.id;
    
    // Set size
    nodeElement.style.width = `${node.size}px`;
    nodeElement.style.height = `${node.size}px`;
    
    // Set initial position
    nodeElement.style.left = `${node.x - node.size/2}px`;
    nodeElement.style.top = `${node.y - node.size/2}px`;
    
    // Add abbreviated name inside
    const nameAbbr = node.name.split(' ').map(word => word.charAt(0)).join('');
    nodeElement.textContent = nameAbbr.length > 0 ? nameAbbr : '?';
    
    // Create node label
    const labelElement = document.createElement('div');
    labelElement.className = 'vowl-node-label';
    labelElement.textContent = node.name;
    
    // Add node to canvas
    canvas.appendChild(nodeElement);
    canvas.appendChild(labelElement);
    
    // Add click event to show info panel
    nodeElement.addEventListener('click', function(e) {
      showInfoPanel(node);
      e.stopPropagation(); // Prevent canvas click
    });
    
    // Add dragging behavior
    setupNodeDragging(nodeElement, node, simulation);
    
    elements.nodes.push(nodeElement);
    elements.nodeLabels.push(labelElement);
  });
  
  // Set up animation loop
  let animationFrameId;
  
  function animate() {
    // Update simulation
    const updated = simulation.tick();
    
    // Update node positions
    simulation.nodes.forEach((node, i) => {
      const nodeElement = elements.nodes[i];
      const labelElement = elements.nodeLabels[i];
      
      // Update node position
      nodeElement.style.left = `${node.x - node.size/2}px`;
      nodeElement.style.top = `${node.y - node.size/2}px`;
      
      // Update label position
      labelElement.style.left = `${node.x + node.size/2 + 5}px`;
      labelElement.style.top = `${node.y - 10}px`;
    });
    
    // Update edge positions and angles
    simulation.edges.forEach((edge, i) => {
      const edgeElement = elements.edges[i];
      const arrowElement = elements.arrows[i];
      
      // Get positions
      const source = edge.source;
      const target = edge.target;
      
      // Calculate distance and angle
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      
      // Position edge with offset from source node center
      const sourceRadius = source.size / 2;
      const targetRadius = target.size / 2;
      
      // Calculate start and end positions considering node radii
      const edgeLength = distance - sourceRadius - targetRadius;
      
      // Update edge
      edgeElement.style.width = `${edgeLength}px`;
      edgeElement.style.left = `${source.x + sourceRadius * Math.cos(angle * Math.PI / 180)}px`;
      edgeElement.style.top = `${source.y + sourceRadius * Math.sin(angle * Math.PI / 180)}px`;
      edgeElement.style.transform = `rotate(${angle}deg)`;
      
      // Update arrow
      arrowElement.style.left = `${target.x - targetRadius * Math.cos(angle * Math.PI / 180) - 8}px`;
      arrowElement.style.top = `${target.y - targetRadius * Math.sin(angle * Math.PI / 180) - 5}px`;
      arrowElement.style.transform = `rotate(${angle}deg)`;
      
      // Update edge label if it exists
      const labelIndex = elements.edgeLabels.findIndex(label => label.id === `edge_label_${i}`);
      if (labelIndex !== -1) {
        const labelElement = elements.edgeLabels[labelIndex];
        labelElement.style.left = `${source.x + dx/2}px`;
        labelElement.style.top = `${source.y + dy/2 - 15}px`;
      } 
    });
    
    // Continue animation if simulation is still active
    if (simulation.isRunning && simulation.alpha > simulation.alphaMin) {
      animationFrameId = requestAnimationFrame(animate);
    }
  }
  
  // Start animation
  animate();
  
  // Add canvas click handler to hide info panel
  canvas.addEventListener('click', function(e) {
    if (e.target === canvas) {
      document.getElementById('nodeInfoPanel').style.display = 'none';
    }
  });
  
  // Return created elements for reference
  return elements;
}