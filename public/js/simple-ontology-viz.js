// circular-ontology-viz.js
document.addEventListener('DOMContentLoaded', function() {
    // Create the visualization container if it doesn't exist
    if (!document.getElementById('ontologyVisualization')) {
      const mainContent = document.querySelector('.ontology-container') || 
                          document.querySelector('main') || 
                          document.body;
      
      const vizContainer = document.createElement('div');
      vizContainer.id = 'ontologyVisualization';
      vizContainer.className = 'ontology-section';
      
      // Add custom styling
      const style = document.createElement('style');
      style.textContent = `
        #ontologyVisualization {
          margin: 2rem 0;
          padding: 1rem;
          background-color: #ffffff;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
        }
        
        .viz-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .viz-title {
          font-size: 1.4rem;
          color: #000080;
          margin: 0;
        }
        
        .viz-toggle {
          background-color: #f0f0f0;
          border: 1px solid #ddd;
          padding: 0.4rem 0.8rem;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        
        .viz-toggle:hover {
          background-color: #e5e5e5;
        }
        
        .viz-canvas {
          width: 100%;
          height: 500px;
          background-color: #fff;
          border: 1px solid #eee;
          border-radius: 4px;
          margin-bottom: 1rem;
          position: relative;
        }
        
        .ontology-node {
          position: absolute;
          border-radius: 50%;
          background-color: white;
          border: 2px solid #0645ad;
          color: #0645ad;
          text-align: center;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .ontology-node:hover {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        }
        
        .relation-line {
          position: absolute;
          height: 2px;
          background-color: rgba(100, 150, 220, 0.5);
          transform-origin: 0 0;
          z-index: 5;
        }
        
        .relation-line.highlighted {
          background-color: rgba(70, 130, 210, 0.8);
          height: 3px;
        }
      `;
      
      // Create content structure
      const vizContent = `
        <div class="viz-header">
          <h2 class="viz-title">Ontology Overview</h2>
          <button id="refreshVisualization" class="viz-toggle">Refresh</button>
        </div>
        
        <div id="vizCanvas" class="viz-canvas">
          <!-- Nodes and connections will be added here -->
        </div>
      `;
      
      // Add elements to the page
      vizContainer.innerHTML = vizContent;
      document.head.appendChild(style);
      
      // Insert at the appropriate location
      const targetPoint = document.getElementById('overview') || 
                         document.getElementById('classes') ||
                         document.querySelector('h2');
      
      if (targetPoint) {
        targetPoint.parentNode.insertBefore(vizContainer, targetPoint);
      } else {
        mainContent.appendChild(vizContainer);
      }
      
      // Initialize the visualization
      initOntologyVisualization();
    }
  });
  
  /**
   * Initialize and render the ontology visualization
   */
  function initOntologyVisualization() {
    // Get the canvas element
    const canvas = document.getElementById('vizCanvas');
    if (!canvas) return;
    
    // Clear any existing content
    canvas.innerHTML = '';
    
    // Extract ontology data from the page
    const ontologyData = extractOntologyData();
    
    // Render visualization on the canvas
    renderVisualization(canvas, ontologyData);
    
    // Add refresh functionality
    const refreshButton = document.getElementById('refreshVisualization');
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        initOntologyVisualization();
      });
    }
  }
  
  /**
   * Extract ontology data from the current page
   * @returns {Object} Ontology data structure
   */
  function extractOntologyData() {
    // Get ontology title
    const title = document.querySelector('h1')?.textContent || 'Ontology';
    
    // Try to extract classes and properties
    let nodes = [];
    let relationships = [];
    
    // Try to find class information in the page
    // These selectors might need adjustment based on your HTML structure
    const classSelectors = [
      '.class-item', 
      '#classes .entity-item', 
      '.entity-items .class-item',
      '.subject-card'
    ];
    
    // Try each selector to find classes
    let foundClasses = false;
    for (const selector of classSelectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach((element, index) => {
          // Try to get a name from the element
          const nameElement = element.querySelector('h3') || 
                             element.querySelector('.subject-card-header') ||
                             element;
          
          const name = nameElement.textContent.split(' ')[0].trim();
          
          if (name && !nodes.some(n => n.id === name)) {
            nodes.push({
              id: name,
              name: name,
              type: 'class'
            });
            foundClasses = true;
          }
        });
        
        if (foundClasses) break;
      }
    }
    
    // If no classes found, look for any namespaces or prefixes
    if (!foundClasses) {
      document.querySelectorAll('code, .namespace-prefix, .resource-uri').forEach((element, index) => {
        const text = element.textContent.trim();
        
        // Extract prefixes or namespace fragments
        const prefixMatch = text.match(/([a-zA-Z0-9_]+):/);
        if (prefixMatch && prefixMatch[1]) {
          const prefix = prefixMatch[1];
          if (!nodes.some(n => n.id === prefix)) {
            nodes.push({
              id: prefix,
              name: prefix,
              type: 'prefix'
            });
          }
        } else if (text.includes('/')) {
          // Extract the last part of a URI as a node
          const parts = text.split('/');
          const lastPart = parts[parts.length - 1].split('#')[0];
          if (lastPart && !nodes.some(n => n.id === lastPart)) {
            nodes.push({
              id: lastPart,
              name: lastPart,
              type: 'namespace'
            });
          }
        }
      });
    }
    
    // If still not enough nodes, create example data
    if (nodes.length < 5) {
      nodes = [
        { id: 'dpp', name: 'dpp', type: 'namespace' },
        { id: 'dpp-core', name: 'dpp.core', type: 'namespace' },
        { id: 'dpp-ont', name: 'dpp.ont', type: 'namespace' },
        { id: 'fagerhult', name: 'fager...', type: 'namespace' },
        { id: 'ispo', name: 'ispo', type: 'namespace' },
        { id: 'supply', name: 'supply...', type: 'namespace' },
        { id: 'align', name: 'Align...', type: 'namespace' },
        { id: 'EoL', name: 'EoL', type: 'namespace' },
        { id: 'ispo-owl', name: 'ispo.owl', type: 'namespace' }
      ];
    }
    
    // Create relationships between nodes
    // For a nice visualization, create connections between some nodes
    const nodeIds = nodes.map(n => n.id);
    
    // Create a set of reasonable connections between nodes
    // Each node should connect to about 3 other nodes
    for (let i = 0; i < nodes.length; i++) {
      // Connect to 2-4 other nodes
      const connectionCount = Math.floor(Math.random() * 3) + 2;
      
      for (let j = 0; j < connectionCount; j++) {
        // Pick a random node that's not this node
        let targetIndex;
        do {
          targetIndex = Math.floor(Math.random() * nodes.length);
        } while (targetIndex === i);
        
        // Add the relationship
        relationships.push({
          source: nodes[i].id,
          target: nodes[targetIndex].id
        });
      }
    }
    
    return {
      title,
      nodes,
      relationships
    };
  }
  
  /**
   * Render ontology visualization on canvas using a circular layout
   * @param {HTMLElement} canvas - Container element
   * @param {Object} data - Ontology data
   */
  function renderVisualization(canvas, data) {
    // Get canvas dimensions
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Calculate a good radius for the circle
    const radius = Math.min(width, height) * 0.38;
    
    // Position nodes in a circle
    const nodes = data.nodes.map((node, index) => {
      // Calculate position on the circle
      const angle = (index / data.nodes.length) * 2 * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      return {
        ...node,
        x,
        y,
        size: 60, // Node size in pixels
        angle
      };
    });
    
    // Create the connection lines first (so they appear behind nodes)
    data.relationships.forEach(rel => {
      const sourceNode = nodes.find(n => n.id === rel.source);
      const targetNode = nodes.find(n => n.id === rel.target);
      
      if (sourceNode && targetNode) {
        // Create connection line
        createConnectionLine(canvas, sourceNode, targetNode);
      }
    });
    
    // Create DOM elements for each node
    nodes.forEach(node => {
      createNodeElement(canvas, node);
    });
  }
  
  /**
   * Create a node element in the visualization
   * @param {HTMLElement} canvas - Canvas element
   * @param {Object} node - Node data
   */
  function createNodeElement(canvas, node) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'ontology-node';
    nodeElement.style.left = `${node.x - node.size/2}px`;
    nodeElement.style.top = `${node.y - node.size/2}px`;
    nodeElement.style.width = `${node.size}px`;
    nodeElement.style.height = `${node.size}px`;
    nodeElement.textContent = node.name;
    nodeElement.title = node.name;
    
    // Store node data for relationship handling
    nodeElement.dataset.nodeId = node.id;
    nodeElement.dataset.nodeX = node.x;
    nodeElement.dataset.nodeY = node.y;
    
    // Add hover behavior to highlight connections
    nodeElement.addEventListener('mouseenter', function() {
      highlightNodeConnections(this.dataset.nodeId, true);
    });
    
    nodeElement.addEventListener('mouseleave', function() {
      highlightNodeConnections(this.dataset.nodeId, false);
    });
    
    canvas.appendChild(nodeElement);
  }
  
  /**
   * Create a connection line between two nodes
   * @param {HTMLElement} canvas - Canvas element
   * @param {Object} sourceNode - Source node
   * @param {Object} targetNode - Target node
   */
  function createConnectionLine(canvas, sourceNode, targetNode) {
    // Create line element
    const line = document.createElement('div');
    line.className = 'relation-line';
    
    // Calculate line dimensions
    const length = Math.sqrt(
      Math.pow(targetNode.x - sourceNode.x, 2) + 
      Math.pow(targetNode.y - sourceNode.y, 2)
    );
    
    const angle = Math.atan2(
      targetNode.y - sourceNode.y,
      targetNode.x - sourceNode.x
    ) * 180 / Math.PI;
    
    // Position and rotate the line
    line.style.left = `${sourceNode.x}px`;
    line.style.top = `${sourceNode.y}px`;
    line.style.width = `${length}px`;
    line.style.transform = `rotate(${angle}deg)`;
    
    // Store connection data for highlighting
    line.dataset.sourceId = sourceNode.id;
    line.dataset.targetId = targetNode.id;
    
    canvas.appendChild(line);
  }
  
  /**
   * Highlight connections for a specific node
   * @param {string} nodeId - ID of the node to highlight connections for
   * @param {boolean} highlight - Whether to highlight (true) or unhighlight (false)
   */
  function highlightNodeConnections(nodeId, highlight) {
    // Get all connection lines
    const lines = document.querySelectorAll('.relation-line');
    
    lines.forEach(line => {
      // Check if this line connects to the node
      if (line.dataset.sourceId === nodeId || line.dataset.targetId === nodeId) {
        if (highlight) {
          line.classList.add('highlighted');
        } else {
          line.classList.remove('highlighted');
        }
      }
    });
    
    // Highlight/unhighlight the node
    const node = document.querySelector(`.ontology-node[data-node-id="${nodeId}"]`);
    if (node) {
      if (highlight) {
        node.style.transform = 'scale(1.1)';
        node.style.boxShadow = '0 0 10px rgba(0, 100, 200, 0.5)';
        node.style.zIndex = '20';
      } else {
        node.style.transform = '';
        node.style.boxShadow = '';
        node.style.zIndex = '10';
      }
    }
  }