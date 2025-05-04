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
        height: 500px;
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
        font-size: 14px;
        background-color: rgba(255, 255, 255, 0.9);
        padding: 4px 8px;
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
        font-size: 12px;
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
        background-color: #7FB5FF;
        border: 2px solid #5495FF;
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
      
      /* Self-relationship loop */
      .vowl-loop {
        border: none;
        border-top: 2px solid rgba(100, 100, 100, 0.8);
        border-left: 2px solid rgba(100, 100, 100, 0.8);
        border-right: 2px solid rgba(100, 100, 100, 0.8);
        border-bottom: none;
        border-radius: 50% 50% 0 0;
        background-color: transparent;
        height: auto;
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
      
      /* Node content */
      .vowl-node-content {
        font-size: 12px;
        display: block;
        max-width: 90%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
        <h3 class="viz-title">Digital Product Passport Ontology Design Pattern</h3>
        <div class="viz-controls">
          <button id="resetVisualization" class="viz-button">Reset</button>
          <button id="expandVisualization" class="viz-button">Expand All</button>
        </div>
      </div>
      
      <div id="vizCanvas" class="viz-canvas">
        <!-- Nodes and edges will be added here -->
        <div class="zoom-controls">
          <div class="zoom-btn zoom-in">+</div>
          <div class="zoom-btn zoom-out">-</div>
        </div>
      </div>
      
      <div class="viz-legend">
        <div class="legend-item">
          <div class="legend-color" style="background-color: #7FB5FF;"></div>
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
    
    // Initialize the visualization after a short delay to ensure DOM is ready
    setTimeout(() => {
      initializeOntologyVisualization();
    }, 100);
  } else {
    // If container already exists, just re-initialize the visualization
    initializeOntologyVisualization();
  }
});

/**
 * Initialize the ontology visualization with all necessary components
 */
function initializeOntologyVisualization() {
  // Define ontology data
  const ontologyData = {
    nodes: [
      {
        id: 'digitalProduct',
        type: 'class',
        label: 'Digital Product',
        description: 'Digital representation of a physical product'
      },
      {
        id: 'product',
        type: 'class',
        label: 'Product',
        description: 'Physical product that is described by the DPP'
      },
      {
        id: 'passport',
        type: 'class',
        label: 'Digital Passport',
        description: 'Passport containing product information'
      },
      {
        id: 'materialComposition',
        type: 'class',
        label: 'Material Composition',
        description: 'Materials used in the product'
      },
      {
        id: 'sustainability',
        type: 'class',
        label: 'Sustainability',
        description: 'Sustainability metrics and certifications'
      },
      {
        id: 'supplyChain',
        type: 'class',
        label: 'Supply Chain',
        description: 'Supply chain information and actors'
      },
      {
        id: 'circularityMetrics',
        type: 'class',
        label: 'Circularity Metrics',
        description: 'Metrics related to circular economy'
      },
      {
        id: 'lifecycle',
        type: 'class',
        label: 'Lifecycle',
        description: 'Product lifecycle information'
      }
    ],
    edges: [
      {
        source: 'digitalProduct',
        target: 'product',
        label: 'describes',
        type: 'relationship'
      },
      {
        source: 'digitalProduct',
        target: 'digitalProduct',
        label: 'has part',
        type: 'relationship',
        isLoop: true
      },
      {
        source: 'product',
        target: 'product',
        label: 'has part',
        type: 'relationship',
        isLoop: true
      },
      {
        source: 'passport',
        target: 'digitalProduct',
        label: 'contains',
        type: 'relationship'
      },
      {
        source: 'digitalProduct',
        target: 'materialComposition',
        label: 'has',
        type: 'relationship'
      },
      {
        source: 'digitalProduct',
        target: 'sustainability',
        label: 'has',
        type: 'relationship'
      },
      {
        source: 'digitalProduct',
        target: 'supplyChain',
        label: 'has',
        type: 'relationship'
      },
      {
        source: 'digitalProduct',
        target: 'circularityMetrics',
        label: 'has',
        type: 'relationship'
      },
      {
        source: 'digitalProduct',
        target: 'lifecycle',
        label: 'has',
        type: 'relationship'
      }
    ]
  };
  
  renderOntologyVisualization(ontologyData);
  
  // Set up event handlers
  const resetButton = document.getElementById('resetVisualization');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      renderOntologyVisualization(ontologyData);
    });
  }
  
  const expandButton = document.getElementById('expandVisualization');
  if (expandButton) {
    expandButton.addEventListener('click', () => {
      // Example of expanding the visualization with more nodes
      const expandedData = JSON.parse(JSON.stringify(ontologyData));
      
      // Add more detailed nodes
      expandedData.nodes.push(
        {
          id: 'material',
          type: 'class',
          label: 'Material',
          description: 'Material used in the product'
        },
        {
          id: 'certificate',
          type: 'class',
          label: 'Certificate',
          description: 'Product certifications'
        },
        {
          id: 'manufacturer',
          type: 'class',
          label: 'Manufacturer',
          description: 'Product manufacturer'
        }
      );
      
      // Add connections for new nodes
      expandedData.edges.push(
        {
          source: 'materialComposition',
          target: 'material',
          label: 'contains',
          type: 'relationship'
        },
        {
          source: 'sustainability',
          target: 'certificate',
          label: 'has',
          type: 'relationship'
        },
        {
          source: 'supplyChain',
          target: 'manufacturer',
          label: 'involves',
          type: 'relationship'
        }
      );
      
      renderOntologyVisualization(expandedData);
    });
  }
  
  // Set up zoom controls
  const zoomIn = document.querySelector('.zoom-in');
  const zoomOut = document.querySelector('.zoom-out');
  
  if (zoomIn && zoomOut) {
    let scale = 1;
    const canvas = document.getElementById('vizCanvas');
    
    zoomIn.addEventListener('click', () => {
      scale *= 1.2;
      applyZoom(canvas, scale);
    });
    
    zoomOut.addEventListener('click', () => {
      scale /= 1.2;
      applyZoom(canvas, scale);
    });
  }
}

/**
 * Apply zoom transformation to the visualization
 */
function applyZoom(canvas, scale) {
  const nodes = canvas.querySelectorAll('.vowl-node');
  const labels = canvas.querySelectorAll('.vowl-node-label');
  const edges = canvas.querySelectorAll('.vowl-edge, .vowl-arrow, .vowl-loop');
  const edgeLabels = canvas.querySelectorAll('.vowl-edge-label');
  
  // Get canvas dimensions
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Apply zoom to nodes
  nodes.forEach(node => {
    const x = parseFloat(node.dataset.x || 0);
    const y = parseFloat(node.dataset.y || 0);
    
    // Calculate position relative to center
    const relX = x - centerX;
    const relY = y - centerY;
    
    // Apply zoom relative to center
    const newX = centerX + relX * scale;
    const newY = centerY + relY * scale;
    
    // Position and scale the node
    const nodeSize = parseFloat(node.dataset.size || 70) * scale;
    node.style.width = `${nodeSize}px`;
    node.style.height = `${nodeSize}px`;
    node.style.left = `${newX - nodeSize/2}px`;
    node.style.top = `${newY - nodeSize/2}px`;
    
    // Store the absolute position for edge calculations
    node.dataset.scaledX = newX;
    node.dataset.scaledY = newY;
    node.dataset.scaledSize = nodeSize;
  });
  
  // Update labels
  labels.forEach(label => {
    const nodeId = label.dataset.for;
    const node = document.querySelector(`.vowl-node[data-id="${nodeId}"]`);
    
    if (node) {
      const x = parseFloat(node.dataset.scaledX || 0);
      const y = parseFloat(node.dataset.scaledY || 0);
      const nodeSize = parseFloat(node.dataset.scaledSize || 70);
      
      label.style.left = `${x - label.offsetWidth/2}px`;
      label.style.top = `${y + nodeSize/2 + 10}px`;
    }
  });
  
  // Update edges
  updateEdges();
}

/**
 * Render the ontology visualization based on the provided data
 */
function renderOntologyVisualization(data) {
  const canvas = document.getElementById('vizCanvas');
  if (!canvas) return;
  
  // Clear any existing content
  // Keep zoom controls
  const zoomControls = canvas.querySelector('.zoom-controls');
  canvas.innerHTML = '';
  if (zoomControls) {
    canvas.appendChild(zoomControls);
  }
  
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  
  // Calculate optimal node positions
  const nodePositions = calculateNodePositions(data.nodes, width, height);
  
  // Create nodes
  const nodeSize = 70;
  data.nodes.forEach(node => {
    const position = nodePositions[node.id];
    
    // Create node element
    const nodeElement = document.createElement('div');
    nodeElement.className = `vowl-node vowl-${node.type}`;
    nodeElement.setAttribute('data-id', node.id);
    nodeElement.setAttribute('data-x', position.x);
    nodeElement.setAttribute('data-y', position.y);
    nodeElement.setAttribute('data-size', nodeSize);
    nodeElement.style.width = `${nodeSize}px`;
    nodeElement.style.height = `${nodeSize}px`;
    nodeElement.style.left = `${position.x - nodeSize/2}px`;
    nodeElement.style.top = `${position.y - nodeSize/2}px`;
    
    // Add content to node
    const nodeContent = document.createElement('span');
    nodeContent.className = 'vowl-node-content';
    nodeContent.textContent = node.label.split(' ')[0]; // First word only for brevity
    nodeElement.appendChild(nodeContent);
    
    // Store the absolute position for edge calculations
    nodeElement.dataset.scaledX = position.x;
    nodeElement.dataset.scaledY = position.y;
    nodeElement.dataset.scaledSize = nodeSize;
    
    // Add tooltip functionality
    nodeElement.addEventListener('click', () => {
      showNodeInfo(node, position.x, position.y);
    });
    
    canvas.appendChild(nodeElement);
    
    // Create node label
    const labelElement = document.createElement('div');
    labelElement.className = 'vowl-node-label';
    labelElement.setAttribute('data-for', node.id);
    labelElement.textContent = node.label;
    labelElement.style.left = `${position.x - (node.label.length * 4)}px`;
    labelElement.style.top = `${position.y + nodeSize/2 + 10}px`;
    canvas.appendChild(labelElement);
  });
  
  // Create edges after nodes to ensure proper layering
  data.edges.forEach(edge => {
    createEdge(canvas, edge, nodePositions, nodeSize);
  });
  
  // Make nodes draggable
  makeNodesDraggable(canvas);
}

/**
 * Calculate optimal positions for nodes using a simple force-directed algorithm
 */
function calculateNodePositions(nodes, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  
  const positions = {};
  
  // For smaller sets, use a circular layout
  if (nodes.length <= 8) {
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      positions[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
  } else {
    // For larger sets, use a more complex layout
    // This is a simplified version - in production, you'd use a proper force-directed algorithm
    
    // Start with a grid layout
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    
    const gridWidth = width * 0.8;
    const gridHeight = height * 0.8;
    
    const cellWidth = gridWidth / cols;
    const cellHeight = gridHeight / rows;
    
    nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      positions[node.id] = {
        x: (col + 0.5) * cellWidth + (width - gridWidth) / 2,
        y: (row + 0.5) * cellHeight + (height - gridHeight) / 2
      };
    });
  }
  
  return positions;
}

/**
 * Create an edge between nodes
 */
function createEdge(canvas, edge, nodePositions, nodeSize) {
  if (!nodePositions[edge.source] || !nodePositions[edge.target]) {
    console.error('Missing node position for edge:', edge);
    return;
  }
  
  // Handle self-loops (relationships to self)
  if (edge.isLoop || edge.source === edge.target) {
    createSelfRelationship(
      canvas, 
      nodePositions[edge.source].x, 
      nodePositions[edge.source].y, 
      nodeSize, 
      edge.label
    );
    return;
  }
  
  const sourceX = nodePositions[edge.source].x;
  const sourceY = nodePositions[edge.source].y;
  const targetX = nodePositions[edge.target].x;
  const targetY = nodePositions[edge.target].y;
  
  // Calculate edge properties
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  
  // Calculate start and end points considering node radii
  const nodeRadius = nodeSize / 2;
  const edgeStartX = sourceX + nodeRadius * Math.cos(angle * Math.PI / 180);
  const edgeStartY = sourceY + nodeRadius * Math.sin(angle * Math.PI / 180);
  const edgeEndX = targetX - nodeRadius * Math.cos(angle * Math.PI / 180);
  const edgeEndY = targetY - nodeRadius * Math.sin(angle * Math.PI / 180);
  const edgeLength = Math.sqrt(Math.pow(edgeEndX - edgeStartX, 2) + Math.pow(edgeEndY - edgeStartY, 2));
  
  // Create edge element
  const edgeElement = document.createElement('div');
  edgeElement.className = `vowl-edge vowl-${edge.type || 'relationship'}`;
  edgeElement.setAttribute('data-source', edge.source);
  edgeElement.setAttribute('data-target', edge.target);
  
  // Set edge position and dimensions
  edgeElement.style.width = `${edgeLength}px`;
  edgeElement.style.left = `${edgeStartX}px`;
  edgeElement.style.top = `${edgeStartY}px`;
  edgeElement.style.transform = `rotate(${angle}deg)`;
  canvas.appendChild(edgeElement);
  
  // Create arrow
  const arrowElement = document.createElement('div');
  arrowElement.className = 'vowl-arrow';
  arrowElement.setAttribute('data-source', edge.source);
  arrowElement.setAttribute('data-target', edge.target);
  arrowElement.style.left = `${edgeEndX - 5}px`;
  arrowElement.style.top = `${edgeEndY - 5}px`;
  arrowElement.style.transform = `rotate(${angle}deg)`;
  canvas.appendChild(arrowElement);
  
  // Create edge label
  if (edge.label) {
    const labelElement = document.createElement('div');
    labelElement.className = 'vowl-edge-label';
    labelElement.setAttribute('data-source', edge.source);
    labelElement.setAttribute('data-target', edge.target);
    labelElement.textContent = edge.label;
    
    // Position label at the middle of the edge
    labelElement.style.left = `${sourceX + dx/2 - (edge.label.length * 3)}px`;
    labelElement.style.top = `${sourceY + dy/2 - 15}px`;
    canvas.appendChild(labelElement);
  }
}

/**
 * Create a self-relationship loop
 */
function createSelfRelationship(canvas, x, y, nodeSize, label) {
  const radius = nodeSize * 0.6;
  const nodeRadius = nodeSize / 2;
  
  // Create loop element
  const loopElement = document.createElement('div');
  loopElement.className = 'vowl-loop';
  loopElement.style.position = 'absolute';
  loopElement.style.width = `${radius * 2}px`;
  loopElement.style.height = `${radius}px`;
  loopElement.style.left = `${x - radius}px`;
  loopElement.style.top = `${y - nodeRadius - radius}px`;
  loopElement.style.borderRadius = `${radius}px ${radius}px 0 0`;
  canvas.appendChild(loopElement);
  
  // Create arrow at the end of the loop
  const arrowElement = document.createElement('div');
  arrowElement.className = 'vowl-arrow';
  arrowElement.style.left = `${x + 5}px`;
  arrowElement.style.top = `${y - nodeRadius - 5}px`;
  arrowElement.style.transform = 'rotate(-90deg)';
  canvas.appendChild(arrowElement);
  
  // Create label for the loop
  if (label) {
    const labelElement = document.createElement('div');
    labelElement.className = 'vowl-edge-label';
    labelElement.textContent = label;
    labelElement.style.left = `${x}px`;
    labelElement.style.top = `${y - nodeRadius - radius - 20}px`;
    labelElement.style.transform = 'translateX(-50%)';
    canvas.appendChild(labelElement);
  }
}

/**
 * Show info panel for the selected node
 */
function showNodeInfo(node, x, y) {
  // Remove any existing info panel
  const existingPanel = document.querySelector('.vowl-info-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  // Create info panel
  const infoPanel = document.createElement('div');
  infoPanel.className = 'vowl-info-panel';
  infoPanel.style.display = 'block';
  
  // Add content to panel
  infoPanel.innerHTML = `
    <span class="info-close">&times;</span>
    <h3>${node.label}</h3>
    <p><strong>Type:</strong> ${node.type.charAt(0).toUpperCase() + node.type.slice(1)}</p>
    <p><strong>Description:</strong> ${node.description || 'No description available'}</p>
    <div class="info-uri">ontology:${node.id}</div>
  `;
  
  // Add panel to canvas
  const canvas = document.getElementById('vizCanvas');
  canvas.appendChild(infoPanel);
  
  // Add close functionality
  const closeButton = infoPanel.querySelector('.info-close');
  closeButton.addEventListener('click', () => {
    infoPanel.remove();
  });
  
  // Close panel when clicking outside
  canvas.addEventListener('click', (e) => {
    if (!infoPanel.contains(e.target) && !e.target.classList.contains('vowl-node')) {
      infoPanel.remove();
    }
  });
}

/**
 * Make nodes draggable
 */
function makeNodesDraggable(canvas) {
  const nodes = canvas.querySelectorAll('.vowl-node');
  
  nodes.forEach(node => {
    let isDragging = false;
    let offsetX, offsetY;
    
    node.addEventListener('mousedown', startDrag);
    node.addEventListener('touchstart', startDrag);
    
    function startDrag(e) {
      e.preventDefault();
      
      isDragging = true;
      
      // Calculate offset
      const rect = node.getBoundingClientRect();
      if (e.type === 'mousedown') {
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
      } else {
        offsetX = e.touches[0].clientX - rect.left;
        offsetY = e.touches[0].clientY - rect.top;
      }
      
      // Add event listeners for drag and end
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('mouseup', endDrag);
      document.addEventListener('touchend', endDrag);
      
      // Bring to front
      node.style.zIndex = '30';
    }
    
    function drag(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Calculate new position
      const canvasRect = canvas.getBoundingClientRect();
      let clientX, clientY;
      
      if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
      
      const x = clientX - canvasRect.left - offsetX + node.offsetWidth / 2;
      const y = clientY - canvasRect.top - offsetY + node.offsetHeight / 2;
      
      // Update node position
      const nodeSize = parseFloat(node.dataset.size || 70);
      node.style.left = `${x - nodeSize/2}px`;
      node.style.top = `${y - nodeSize/2}px`;
      
      // Update dataset values
      node.dataset.x = x;
      node.dataset.y = y;
      node.dataset.scaledX = x;
      node.dataset.scaledY = y;
      
      // Update label position
      const nodeId = node.getAttribute('data-id');
      const label = canvas.querySelector(`.vowl-node-label[data-for="${nodeId}"]`);
      if (label) {
        label.style.left = `${x - label.offsetWidth/2}px`;
        label.style.top = `${y + nodeSize/2 + 10}px`;
      }
      
      // Update edges
      updateEdges();
    }
    
    function endDrag() {
      isDragging = false;
      
      // Reset z-index
      node.style.zIndex = '10';
      
      // Remove event listeners
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', endDrag);
      document.removeEventListener('touchend', endDrag);
    }
  });
}

/**
 * Update all edges when nodes move
 */
function updateEdges() {
  const canvas = document.getElementById('vizCanvas');
  if (!canvas) return;
  
  // Update regular edges
  const edges = canvas.querySelectorAll('.vowl-edge');
  const arrows = canvas.querySelectorAll('.vowl-arrow:not([data-is-loop])');
  const edgeLabels = canvas.querySelectorAll('.vowl-edge-label:not([data-is-loop])');
  
  edges.forEach(edge => {
    const sourceId = edge.getAttribute('data-source');
    const targetId = edge.getAttribute('data-target');
    
    if (sourceId === targetId) return; // Skip loops
    
    const sourceNode = canvas.querySelector(`.vowl-node[data-id="${sourceId}"]`);
    const targetNode = canvas.querySelector(`.vowl-node[data-id="${targetId}"]`);
    
    if (!sourceNode || !targetNode) return;
    
    const sourceX = parseFloat(sourceNode.dataset.scaledX || 0);
    const sourceY = parseFloat(sourceNode.dataset.scaledY || 0);
    const targetX = parseFloat(targetNode.dataset.scaledX || 0);
    const targetY = parseFloat(targetNode.dataset.scaledY || 0);
    
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    const nodeRadius = parseFloat(sourceNode.dataset.scaledSize || 70) / 2;
    
    // Calculate edge start and end points
    const edgeStartX = sourceX + nodeRadius * Math.cos(angle * Math.PI / 180);
    const edgeStartY = sourceY + nodeRadius * Math.sin(angle * Math.PI / 180);
    const edgeEndX = targetX - nodeRadius * Math.cos(angle * Math.PI / 180);
    const edgeEndY = targetY - nodeRadius * Math.sin(angle * Math.PI / 180);
    const edgeLength = Math.sqrt(Math.pow(edgeEndX - edgeStartX, 2) + Math.pow(edgeEndY - edgeStartY, 2));
    
    // Update edge
    edge.style.width = `${edgeLength}px`;
    edge.style.left = `${edgeStartX}px`;
    edge.style.top = `${edgeStartY}px`;
    edge.style.transform = `rotate(${angle}deg)`;
    
    // Update corresponding arrow
    const arrow = canvas.querySelector(`.vowl-arrow[data-source="${sourceId}"][data-target="${targetId}"]`);
    if (arrow) {
      arrow.style.left = `${edgeEndX - 5}px`;
      arrow.style.top = `${edgeEndY - 5}px`;
      arrow.style.transform = `rotate(${angle}deg)`;
    }
    
    // Update corresponding label
    const label = canvas.querySelector(`.vowl-edge-label[data-source="${sourceId}"][data-target="${targetId}"]`);
    if (label) {
      label.style.left = `${sourceX + dx/2 - label.offsetWidth/2}px`;
      label.style.top = `${sourceY + dy/2 - 15}px`;
    }
  });
  
  // Update self-relationship loops
  const loops = canvas.querySelectorAll('.vowl-loop');
  loops.forEach(loop => {
    // Find the corresponding node
    const nodeId = loop.getAttribute('data-for');
    const node = canvas.querySelector(`.vowl-node[data-id="${nodeId}"]`);
    
    if (!node) return;
    
    const x = parseFloat(node.dataset.scaledX || 0);
    const y = parseFloat(node.dataset.scaledY || 0);
    const nodeSize = parseFloat(node.dataset.scaledSize || 70);
    const radius = nodeSize * 0.6;
    
    // Update loop position
    loop.style.left = `${x - radius}px`;
    loop.style.top = `${y - nodeSize/2 - radius}px`;
    
    // Update corresponding arrow
    const arrow = canvas.querySelector(`.vowl-arrow[data-is-loop][data-for="${nodeId}"]`);
    if (arrow) {
      arrow.style.left = `${x + 5}px`;
      arrow.style.top = `${y - nodeSize/2 - 5}px`;
    }
    
    // Update corresponding label
    const label = canvas.querySelector(`.vowl-edge-label[data-is-loop][data-for="${nodeId}"]`);
    if (label) {
      label.style.left = `${x}px`;
      label.style.top = `${y - nodeSize/2 - radius - 20}px`;
    }
  });
}