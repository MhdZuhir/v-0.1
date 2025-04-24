// public/js/ontology-subjects.js

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the subjects display
    initSubjectsDisplay();
  
    // Add filtering capability to the subjects list
    setupSubjectFiltering();
  });
  
  /**
   * Initialize the subjects display
   */
  function initSubjectsDisplay() {
    // Show only a limited number of subjects initially
    const subjectCards = document.querySelectorAll('.subject-card');
    const maxInitialSubjects = 12; // Show only 12 subjects initially
    
    if (subjectCards.length > maxInitialSubjects) {
      // Hide cards beyond the initial count
      for (let i = maxInitialSubjects; i < subjectCards.length; i++) {
        subjectCards[i].classList.add('hidden');
      }
      
      // Show the "show more" button
      const showMoreBtn = document.getElementById('showMoreSubjects');
      if (showMoreBtn) {
        showMoreBtn.style.display = 'block';
        
        // Add event listener to show more subjects
        showMoreBtn.addEventListener('click', function() {
          const hiddenCards = document.querySelectorAll('.subject-card.hidden');
          
          // Show next batch of cards
          const batchSize = 12;
          let shownCount = 0;
          
          hiddenCards.forEach(card => {
            if (shownCount < batchSize) {
              card.classList.remove('hidden');
              shownCount++;
            }
          });
          
          // Hide the button if all cards are shown
          if (document.querySelectorAll('.subject-card.hidden').length === 0) {
            showMoreBtn.style.display = 'none';
          }
        });
      }
    }
  }
  
  /**
   * Setup filtering capability for the subjects list
   */
  function setupSubjectFiltering() {
    const filterInput = document.getElementById('subjectFilter');
    if (!filterInput) return;
    
    filterInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      const subjectCards = document.querySelectorAll('.subject-card');
      
      // Reset visibility for all cards
      subjectCards.forEach(card => {
        // Remove hidden class that might have been added by the "show more" feature
        card.classList.remove('hidden');
        
        const subjectLabel = card.querySelector('h3 a').textContent.toLowerCase();
        const subjectUri = card.querySelector('.subject-uri code').textContent.toLowerCase();
        const subjectType = card.querySelector('.subject-type-tag')?.textContent.toLowerCase() || '';
        
        // Hide or show based on search term
        if (searchTerm === '' || 
            subjectLabel.includes(searchTerm) || 
            subjectUri.includes(searchTerm) ||
            subjectType.includes(searchTerm)) {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      });
      
      // Hide the "show more" button if filtering is active
      const showMoreBtn = document.getElementById('showMoreSubjects');
      if (showMoreBtn) {
        showMoreBtn.style.display = searchTerm === '' ? 'block' : 'none';
      }
      
      // Display message if no results
      const noResultsMsg = document.getElementById('noSubjectsResults');
      if (noResultsMsg) {
        const visibleCount = Array.from(subjectCards).filter(card => card.style.display !== 'none').length;
        noResultsMsg.style.display = visibleCount === 0 ? 'block' : 'none';
      }
    });
  }
  
  /**
   * Toggle view between grid and list view
   */
  function toggleSubjectsView(viewType) {
    const subjectsContainer = document.querySelector('.subjects-grid');
    if (!subjectsContainer) return;
    
    // Toggle the class based on view type
    if (viewType === 'grid') {
      subjectsContainer.classList.remove('subjects-list-view');
      subjectsContainer.classList.add('subjects-grid-view');
    } else {
      subjectsContainer.classList.remove('subjects-grid-view');
      subjectsContainer.classList.add('subjects-list-view');
    }
    
    // Update active button state
    document.querySelectorAll('.view-toggle-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`.view-toggle-btn[data-view="${viewType}"]`).classList.add('active');
    
    // Store preference in localStorage
    localStorage.setItem('subjectsViewPreference', viewType);
  }
  
  /**
   * Filter subjects by type
   */
  function filterSubjectsByType(typeFilter) {
    const subjectCards = document.querySelectorAll('.subject-card');
    
    subjectCards.forEach(card => {
      const typeTag = card.querySelector('.subject-type-tag');
      const cardType = typeTag ? typeTag.textContent.toLowerCase() : '';
      
      if (typeFilter === 'all' || cardType.includes(typeFilter.toLowerCase())) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
    
    // Update active button state
    document.querySelectorAll('.type-filter-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`.type-filter-btn[data-type="${typeFilter}"]`).classList.add('active');
  }