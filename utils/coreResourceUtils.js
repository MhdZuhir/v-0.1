// utils/coreResourceUtils.js

/**
 * Core RDF/RDFS/OWL resource utilities 
 * Provides hardcoded information and descriptions for core semantic web resources
 * that may not be properly defined in the database
 */

/**
 * Get rich description and metadata for core ontology resources
 * @param {string} uri - Resource URI
 * @returns {Object|null} - Resource information or null if not a core resource
 */
function getCoreResourceInfo(uri) {
    // Map of built-in RDF/RDFS/OWL resources with their descriptions
    const coreResources = {
      'http://www.w3.org/2000/01/rdf-schema#Resource': {
        label: 'Resource',
        description: 'The class resource, everything. All other classes are subclasses of this class.',
        type: 'Class',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Core Class' },
          { name: 'Definition', value: 'The class of everything. All other classes are subclasses of this class.' },
          { name: 'Usage', value: 'Serves as the root class of the RDF class hierarchy. Every resource in RDF is an instance of rdfs:Resource.' }
        ],
        examples: [
          '# All resources are instances of rdfs:Resource',
          '?anyResource rdf:type rdfs:Resource .',
          '',
          '# All classes are subclasses of rdfs:Resource',
          'rdfs:Class rdfs:subClassOf rdfs:Resource .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#Class', label: 'rdfs:Class' },
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', label: 'rdf:Property' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#Literal', label: 'rdfs:Literal' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#Class': {
        label: 'Class',
        description: 'The class of classes. This is the metaclass for all classes in RDF Schema.',
        type: 'Class',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Metaclass' },
          { name: 'Definition', value: 'The class of classes.' },
          { name: 'Superclass', value: 'rdfs:Resource' },
          { name: 'Instances', value: 'All RDF classes are instances of rdfs:Class' }
        ],
        examples: [
          '# Defining a new class',
          'ex:Person rdf:type rdfs:Class .',
          '',
          '# Querying for all classes',
          'SELECT ?class WHERE { ?class rdf:type rdfs:Class }'
        ],
        related: [
          { uri: 'http://www.w3.org/2002/07/owl#Class', label: 'owl:Class' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#subClassOf', label: 'rdfs:subClassOf' },
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', label: 'rdf:type' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#Literal': {
        label: 'Literal',
        description: 'The class of literal values, e.g. textual strings and integers.',
        type: 'Class',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Core Class' },
          { name: 'Definition', value: 'The class of literal values, e.g. textual strings and integers.' },
          { name: 'Superclass', value: 'rdfs:Resource' },
          { name: 'Usage', value: 'Properties with literal values use rdfs:Literal as their range.' }
        ],
        examples: [
          '# Simple literal',
          '"Hello World"',
          '',
          '# Language-tagged literal',
          '"Hej Världen"@sv',
          '',
          '# Typed literal',
          '"42"^^xsd:integer',
          '',
          '# Defining a property with literal range',
          'ex:name rdfs:range rdfs:Literal .'
        ],
        related: [
          { uri: 'http://www.w3.org/2001/XMLSchema#string', label: 'xsd:string' },
          { uri: 'http://www.w3.org/2001/XMLSchema#integer', label: 'xsd:integer' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#range', label: 'rdfs:range' }
        ]
      },
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property': {
        label: 'Property',
        description: 'The class of RDF properties. rdf:Property represents a relationship between subject and object resources or between a subject resource and a literal.',
        type: 'Class',
        namespace: 'RDF',
        properties: [
          { name: 'Type', value: 'Core Class' },
          { name: 'Definition', value: 'The class of RDF properties.' },
          { name: 'Usage', value: 'Used to define properties that relate resources to other resources or to literal values.' }
        ],
        examples: [
          '# Defining a new property',
          'ex:hasName rdf:type rdf:Property .',
          '',
          '# Using the property',
          'ex:Person1 ex:hasName "John Doe" .',
          '',
          '# Setting domain and range',
          'ex:hasName rdfs:domain ex:Person .',
          'ex:hasName rdfs:range rdfs:Literal .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#domain', label: 'rdfs:domain' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#range', label: 'rdfs:range' },
          { uri: 'http://www.w3.org/2002/07/owl#ObjectProperty', label: 'owl:ObjectProperty' },
          { uri: 'http://www.w3.org/2002/07/owl#DatatypeProperty', label: 'owl:DatatypeProperty' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#domain': {
        label: 'domain',
        description: 'Indicates the class of resources that can have the specified property.',
        type: 'Property',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Core Property' },
          { name: 'Definition', value: 'A domain of a property states that any resource that has a given property is an instance of the specified class.' },
          { name: 'Domain', value: 'rdf:Property' },
          { name: 'Range', value: 'rdfs:Class' }
        ],
        examples: [
          '# Setting domain for a property',
          'ex:hasName rdfs:domain ex:Person .',
          '',
          '# This implies that',
          '# If something has hasName, then it is a Person',
          'ex:John ex:hasName "John Doe" .',
          '# This infers: ex:John rdf:type ex:Person .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#range', label: 'rdfs:range' },
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', label: 'rdf:Property' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#range': {
        label: 'range',
        description: 'Indicates the class or datatype that the values of a property must belong to.',
        type: 'Property',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Core Property' },
          { name: 'Definition', value: 'A range of a property states that the values of the property are instances of the specified class or datatype.' },
          { name: 'Domain', value: 'rdf:Property' },
          { name: 'Range', value: 'rdfs:Class' }
        ],
        examples: [
          '# Setting range for a property',
          'ex:hasChild rdfs:range ex:Person .',
          '',
          '# This implies that',
          '# If something is the object of hasChild, then it is a Person',
          'ex:John ex:hasChild ex:Jane .',
          '# This infers: ex:Jane rdf:type ex:Person .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#domain', label: 'rdfs:domain' },
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', label: 'rdf:Property' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#subClassOf': {
        label: 'subClassOf',
        description: 'Indicates that all instances of one class are instances of another.',
        type: 'Property',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Core Property' },
          { name: 'Definition', value: 'The rdfs:subClassOf property specifies a subclass/superclass relationship between classes.' },
          { name: 'Domain', value: 'rdfs:Class' },
          { name: 'Range', value: 'rdfs:Class' },
          { name: 'Characteristics', value: 'Transitive' }
        ],
        examples: [
          '# Defining a class hierarchy',
          'ex:Woman rdfs:subClassOf ex:Person .',
          'ex:Mother rdfs:subClassOf ex:Woman .',
          '',
          '# This implies that',
          'ex:Mother rdfs:subClassOf ex:Person .',
          '',
          '# All instances are inherited',
          'ex:Mary rdf:type ex:Mother .',
          '# This infers: ',
          '# ex:Mary rdf:type ex:Woman .',
          '# ex:Mary rdf:type ex:Person .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#Class', label: 'rdfs:Class' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf', label: 'rdfs:subPropertyOf' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#subPropertyOf': {
        label: 'subPropertyOf',
        description: 'Indicates that all resources related by one property are also related by another.',
        type: 'Property',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Core Property' },
          { name: 'Definition', value: 'The rdfs:subPropertyOf property specifies a subproperty/superproperty relationship between properties.' },
          { name: 'Domain', value: 'rdf:Property' },
          { name: 'Range', value: 'rdf:Property' },
          { name: 'Characteristics', value: 'Transitive' }
        ],
        examples: [
          '# Defining a property hierarchy',
          'ex:hasMother rdfs:subPropertyOf ex:hasParent .',
          '',
          '# If a resource has a more specific property',
          'ex:John ex:hasMother ex:Mary .',
          '# This infers:',
          '# ex:John ex:hasParent ex:Mary .'
        ],
        related: [
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', label: 'rdf:Property' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#subClassOf', label: 'rdfs:subClassOf' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#label': {
        label: 'label',
        description: 'Provides a human-readable name for a resource.',
        type: 'Property',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Annotation Property' },
          { name: 'Definition', value: 'Provides a human-readable version of a resource\'s name.' },
          { name: 'Domain', value: 'rdfs:Resource' },
          { name: 'Range', value: 'rdfs:Literal' }
        ],
        examples: [
          '# Adding labels to resources',
          'ex:Person rdfs:label "Person" .',
          'ex:Person rdfs:label "Person"@en .',
          'ex:Person rdfs:label "Person"@sv .',
          '',
          '# Labels for individuals',
          'ex:John rdfs:label "John Smith" .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#comment', label: 'rdfs:comment' },
          { uri: 'http://www.w3.org/2004/02/skos/core#prefLabel', label: 'skos:prefLabel' }
        ]
      },
      'http://www.w3.org/2000/01/rdf-schema#comment': {
        label: 'comment',
        description: 'Provides a human-readable description of a resource.',
        type: 'Property',
        namespace: 'RDF Schema',
        properties: [
          { name: 'Type', value: 'Annotation Property' },
          { name: 'Definition', value: 'Provides a human-readable description of a resource.' },
          { name: 'Domain', value: 'rdfs:Resource' },
          { name: 'Range', value: 'rdfs:Literal' }
        ],
        examples: [
          '# Adding comments to resources',
          'ex:Person rdfs:comment "The class of all persons." .',
          'ex:Person rdfs:comment "The class of all persons."@en .',
          'ex:hasAge rdfs:comment "Relates a person to their age in years."@en .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#label', label: 'rdfs:label' },
          { uri: 'http://purl.org/dc/terms/description', label: 'dcterms:description' }
        ]
      },
      'http://www.w3.org/1999/02/22-rdf-syntax-ns#type': {
        label: 'type',
        description: 'Indicates that a resource is a member of a class.',
        type: 'Property',
        namespace: 'RDF',
        properties: [
          { name: 'Type', value: 'Core Property' },
          { name: 'Definition', value: 'Indicates that a resource is an instance of a class.' },
          { name: 'Domain', value: 'rdfs:Resource' },
          { name: 'Range', value: 'rdfs:Class' }
        ],
        examples: [
          '# Assigning a type to a resource',
          'ex:John rdf:type ex:Person .',
          '',
          '# Shorthand notation using "a"',
          'ex:John a ex:Person .',
          '',
          '# Multiple types are allowed',
          'ex:John a ex:Person, ex:Employee .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#Class', label: 'rdfs:Class' },
          { uri: 'http://www.w3.org/2000/01/rdf-schema#subClassOf', label: 'rdfs:subClassOf' }
        ]
      },
      'http://www.w3.org/2002/07/owl#Class': {
        label: 'Class',
        description: 'The class of OWL classes. owl:Class is a subclass of rdfs:Class.',
        type: 'Class',
        namespace: 'OWL',
        properties: [
          { name: 'Type', value: 'Metaclass' },
          { name: 'Definition', value: 'The class of OWL classes.' },
          { name: 'Superclass', value: 'rdfs:Class' },
          { name: 'Added in', value: 'OWL 1.0' }
        ],
        examples: [
          '# Defining an OWL class',
          'ex:Person rdf:type owl:Class .',
          '',
          '# Defining class expressions',
          'ex:Parent rdf:type owl:Class ;',
          '  owl:equivalentClass [',
          '    rdf:type owl:Class ;',
          '    owl:intersectionOf (',
          '      ex:Person',
          '      [ rdf:type owl:Restriction ;',
          '        owl:onProperty ex:hasChild ;',
          '        owl:someValuesFrom ex:Person ]',
          '    )',
          '  ] .'
        ],
        related: [
          { uri: 'http://www.w3.org/2000/01/rdf-schema#Class', label: 'rdfs:Class' },
          { uri: 'http://www.w3.org/2002/07/owl#Restriction', label: 'owl:Restriction' },
          { uri: 'http://www.w3.org/2002/07/owl#ObjectProperty', label: 'owl:ObjectProperty' }
        ]
      },
      'http://www.w3.org/2002/07/owl#ObjectProperty': {
        label: 'ObjectProperty',
        description: 'The class of OWL object properties, relating objects to other objects.',
        type: 'Class',
        namespace: 'OWL',
        properties: [
          { name: 'Type', value: 'Property Class' },
          { name: 'Definition', value: 'The class of OWL object properties.' },
          { name: 'Superclass', value: 'rdf:Property' },
          { name: 'Usage', value: 'Object properties link individuals to individuals.' }
        ],
        examples: [
          '# Defining an object property',
          'ex:hasParent rdf:type owl:ObjectProperty .',
          '',
          '# Using object properties',
          'ex:John ex:hasParent ex:Mary .',
          '',
          '# Defining characteristics',
          'ex:hasParent rdf:type owl:ObjectProperty ;',
          '  rdfs:domain ex:Person ;',
          '  rdfs:range ex:Person ;',
          '  owl:inverseOf ex:hasChild .'
        ],
        related: [
          { uri: 'http://www.w3.org/2002/07/owl#DatatypeProperty', label: 'owl:DatatypeProperty' },
          { uri: 'http://www.w3.org/2002/07/owl#inverseOf', label: 'owl:inverseOf' },
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', label: 'rdf:Property' }
        ]
      },
      'http://www.w3.org/2002/07/owl#DatatypeProperty': {
        label: 'DatatypeProperty',
        description: 'The class of OWL datatype properties, relating objects to literal values.',
        type: 'Class',
        namespace: 'OWL',
        properties: [
          { name: 'Type', value: 'Property Class' },
          { name: 'Definition', value: 'The class of OWL datatype properties.' },
          { name: 'Superclass', value: 'rdf:Property' },
          { name: 'Usage', value: 'Datatype properties link individuals to literal values.' }
        ],
        examples: [
          '# Defining a datatype property',
          'ex:hasAge rdf:type owl:DatatypeProperty .',
          '',
          '# Using datatype properties',
          'ex:John ex:hasAge "42"^^xsd:integer .',
          '',
          '# Defining datatype property characteristics',
          'ex:hasAge rdf:type owl:DatatypeProperty ;',
          '  rdfs:domain ex:Person ;',
          '  rdfs:range xsd:nonNegativeInteger ;',
          '  rdfs:label "has age"@en .'
        ],
        related: [
          { uri: 'http://www.w3.org/2002/07/owl#ObjectProperty', label: 'owl:ObjectProperty' },
          { uri: 'http://www.w3.org/2001/XMLSchema#integer', label: 'xsd:integer' },
          { uri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property', label: 'rdf:Property' }
        ]
      }
    };
    
    // Return the resource info if it exists in our map
    return coreResources[uri] || null;
  }
  
  module.exports = {
    getCoreResourceInfo
  };