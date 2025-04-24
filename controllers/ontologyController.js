// Update to ontologyController.js - getOntologyDetailPage function
// Add this to your existing getOntologyDetailPage function

exports.getOntologyDetailPage = async (req, res, next) => {
  try {
    const uri = req.query.uri;
    
    if (!uri) {
      return res.status(400).render('error', {
        title: 'Error',
        message: 'No ontology URI provided'
      });
    }
    
    const metadata = await ontologyService.fetchOntologyMetadata(uri);
    
    // Add this code to fetch subjects
    // --------------------------------
    const safeUri = sanitizeSparqlString(uri);
    
    // Query to fetch subjects for this ontology
    const subjectsQuery = `
      SELECT DISTINCT ?subject ?type ?label WHERE {
        {
          ?subject <http://www.w3.org/2000/01/rdf-schema#isDefinedBy> <${safeUri}> .
          OPTIONAL { ?subject a ?type }
          OPTIONAL { ?subject <http://www.w3.org/2000/01/rdf-schema#label> ?label }
        } UNION {
          ?subject a ?type .
          FILTER(STRSTARTS(STR(?subject), STR(<${safeUri}>)))
          OPTIONAL { ?subject <http://www.w3.org/2000/01/rdf-schema#label> ?label }
        }
      }
      ORDER BY ?subject
      LIMIT 50
    `;
    
    const subjectsData = await executeQuery(subjectsQuery);
    const subjects = [];
    
    if (subjectsData && subjectsData.results && subjectsData.results.bindings) {
      subjectsData.results.bindings.forEach(binding => {
        if (binding.subject && binding.subject.value) {
          // Determine resource type for styling
          let typeClass = 'default-tag';
          let typeLabel = 'Resurs';
          
          if (binding.type && binding.type.value) {
            if (binding.type.value.includes('Class')) {
              typeClass = 'class-tag';
              typeLabel = 'Klass';
            } else if (binding.type.value.includes('Property')) {
              typeClass = 'property-tag';
              typeLabel = 'Egenskap';
            } else if (binding.type.value.includes('Individual') || binding.type.value.includes('NamedIndividual')) {
              typeClass = 'individual-tag';
              typeLabel = 'Individ';
            }
          }
          
          // Get label or fallback to URI fragment
          const label = binding.label ? 
            binding.label.value : 
            binding.subject.value.split(/[/#]/).pop();
          
          subjects.push({
            uri: binding.subject.value,
            label: label,
            type: binding.type ? binding.type.value : null,
            typeClass: typeClass,
            typeLabel: typeLabel
          });
        }
      });
    }
    
    // Add subjects to metadata
    metadata.subjects = subjects;
    // --------------------------------
    
    // Generate sanitized filename base from the ontology title
    const filenameBase = metadata.title ? 
      metadata.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() :
      'ontology';
    
    // Generate download links for different formats
    const downloadLinks = [
      { 
        format: 'RDF/XML', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=rdf`, 
        extension: 'rdf' 
      },
      { 
        format: 'Turtle', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=ttl`, 
        extension: 'ttl' 
      },
      { 
        format: 'N-Triples', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=nt`, 
        extension: 'nt' 
      },
      { 
        format: 'JSON-LD', 
        url: `/ontology/download?uri=${encodeURIComponent(uri)}&format=jsonld`, 
        extension: 'jsonld' 
      }
    ];
    
    // Fetch labels for all URIs if needed
    let labelMap = {};
    if (req.showLabels) {
      // Collect all URIs that need labels
      const urisToLabel = [uri];
      
      // Add subject URIs
      subjects.forEach(subject => {
        urisToLabel.push(subject.uri);
        if (subject.type) urisToLabel.push(subject.type);
      });
      
      // Add product URIs
      if (metadata.products) {
        metadata.products.forEach(product => {
          urisToLabel.push(product.uri);
          if (product.type) urisToLabel.push(product.type);
        });
      }
      
      // Add relationship URIs
      if (metadata.relationships) {
        metadata.relationships.forEach(rel => {
          urisToLabel.push(rel.property.uri);
          if (rel.domain.uri) urisToLabel.push(rel.domain.uri);
          if (rel.range.uri) urisToLabel.push(rel.range.uri);
        });
      }
      
      // Fetch labels
      labelMap = await labelService.fetchLabelsForUris(urisToLabel);
      
      // Update subjects with fetched labels
      subjects.forEach(subject => {
        if (labelMap[subject.uri]) {
          subject.label = labelMap[subject.uri];
        }
      });
    }
    
    res.render('ontology-detail', {
      title: metadata.title || 'Ontology Details',
      ontology: {
        uri,
        ...metadata
      },
      downloadLinks,
      labelMap,
      showLabels: req.showLabels,
      showLabelsToggleState: req.showLabels ? 'false' : 'true'
    });
  } catch (err) {
    next(err);
  }
};