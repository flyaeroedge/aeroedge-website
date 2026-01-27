/* ============================================
   AEROEDGE WEBSITE - Main JavaScript
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {

  // ---------- Mobile Navigation Toggle ----------
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function() {
      navToggle.classList.toggle('active');
      nav.classList.toggle('active');
    });

    // Close nav when clicking a link
    const navLinks = nav.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', function() {
        navToggle.classList.remove('active');
        nav.classList.remove('active');
      });
    });

    // Close nav when clicking outside
    document.addEventListener('click', function(e) {
      if (!nav.contains(e.target) && !navToggle.contains(e.target)) {
        navToggle.classList.remove('active');
        nav.classList.remove('active');
      }
    });
  }

  // ---------- Mobile Dropdown Toggle ----------
  const navDropdowns = document.querySelectorAll('.nav-dropdown');
  navDropdowns.forEach(dropdown => {
    const dropdownLink = dropdown.querySelector('.nav-link');
    if (dropdownLink) {
      dropdownLink.addEventListener('click', function(e) {
        // Only toggle on mobile (touch devices or narrow screens)
        if (window.innerWidth <= 768) {
          e.preventDefault();
          // Close other dropdowns
          navDropdowns.forEach(other => {
            if (other !== dropdown) {
              other.classList.remove('dropdown-open');
            }
          });
          // Toggle this dropdown
          dropdown.classList.toggle('dropdown-open');
        }
      });
    }
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.nav-dropdown')) {
      navDropdowns.forEach(dropdown => {
        dropdown.classList.remove('dropdown-open');
      });
    }
  });

  // ---------- Smooth Scroll for Anchor Links ----------
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const headerHeight = document.querySelector('.header')?.offsetHeight || 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ---------- Header Background on Scroll ----------
  const header = document.querySelector('.header');
  if (header) {
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
      const currentScroll = window.pageYOffset;

      // Add shadow when scrolled
      if (currentScroll > 10) {
        header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
      } else {
        header.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
      }

      lastScroll = currentScroll;
    });
  }

  // ---------- Intersection Observer for Animations ----------
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe elements that should animate on scroll
  document.querySelectorAll('.tool-card, .coming-soon-card, .card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });

  // ---------- Video Background Handling ----------
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    // Force play on load (iOS fix)
    heroVideo.play().catch(function() {
      // Autoplay blocked - try playing on first user interaction
      document.addEventListener('touchstart', function playOnTouch() {
        heroVideo.play();
        document.removeEventListener('touchstart', playOnTouch);
      }, { once: true });
    });

    // Handle video load errors gracefully
    heroVideo.addEventListener('error', function() {
      console.log('Video failed to load, fallback to static background');
      this.style.display = 'none';
    });
  }

  // ---------- Active Nav Link Highlighting ----------
  const sections = document.querySelectorAll('section[id]');
  const navLinksAll = document.querySelectorAll('.nav-link');

  function highlightNavLink() {
    const scrollPos = window.pageYOffset + 100;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        navLinksAll.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', highlightNavLink);

  // ---------- Waitlist Form Handling ----------
  const waitlistForms = document.querySelectorAll('.waitlist-form');
  waitlistForms.forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const email = this.querySelector('input[type="email"]').value;

      // For now, just show a confirmation
      // Replace with actual form handling (Formspree, Netlify Forms, etc.)
      const button = this.querySelector('button');
      const originalText = button.textContent;
      button.textContent = 'Added!';
      button.disabled = true;

      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
        this.reset();
      }, 2000);

      console.log('Waitlist signup:', email);
    });
  });

  // ---------- Beta Banner Handling ----------
  const betaBanner = document.getElementById('beta-banner');
  const betaBannerDismiss = document.getElementById('beta-banner-dismiss');
  const body = document.body;

  if (betaBanner) {
    // Check if banner was previously dismissed
    const bannerDismissed = localStorage.getItem('betaBannerDismissed');

    if (bannerDismissed) {
      betaBanner.classList.add('hidden');
      body.classList.remove('has-beta-banner');
    }

    // Handle dismiss button
    if (betaBannerDismiss) {
      betaBannerDismiss.addEventListener('click', function() {
        betaBanner.classList.add('hidden');
        body.classList.remove('has-beta-banner');
        localStorage.setItem('betaBannerDismissed', 'true');
      });
    }
  }

  // ---------- Beta Form Tracking ----------
  function trackFormEvent(event, details) {
    var timestamp = new Date().toISOString();
    var trackingData = {
      event: event,
      details: details || {},
      timestamp: timestamp,
      page: window.location.pathname,
      userAgent: navigator.userAgent
    };

    // Log to console for debugging
    console.log('[Form Tracking]', event, details || '');

    // Store in localStorage for review
    var formEvents = JSON.parse(localStorage.getItem('betaFormEvents') || '[]');
    formEvents.push(trackingData);
    // Keep last 100 events
    if (formEvents.length > 100) formEvents = formEvents.slice(-100);
    localStorage.setItem('betaFormEvents', JSON.stringify(formEvents));
  }

  // ---------- Beta Form Handling ----------
  const betaForm = document.getElementById('beta-form');
  const betaFormMessage = document.getElementById('beta-form-message');

  if (betaForm) {
    // Track form view
    trackFormEvent('form_viewed');

    // Track field interactions
    var formFields = betaForm.querySelectorAll('input, textarea');
    formFields.forEach(function(field) {
      field.addEventListener('focus', function() {
        trackFormEvent('field_focused', { field: this.id || this.name });
      }, { once: true });
    });

    // Track submit button click
    var submitBtn = betaForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        trackFormEvent('submit_clicked');
      });
    }

    betaForm.addEventListener('submit', function(e) {
      // Get form data for validation
      const firstName = document.getElementById('beta-firstname').value.trim();
      const lastName = document.getElementById('beta-lastname').value.trim();
      const email = document.getElementById('beta-email').value.trim();

      // Basic validation
      if (!firstName || !lastName || !email) {
        e.preventDefault();
        trackFormEvent('validation_error', { reason: 'missing_fields', firstName: !!firstName, lastName: !!lastName, email: !!email });
        showFormMessage('Please fill in all required fields.', 'error');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        e.preventDefault();
        trackFormEvent('validation_error', { reason: 'invalid_email', email: email });
        showFormMessage('Please enter a valid email address.', 'error');
        return;
      }

      // Validation passed - form will submit to iframe
      trackFormEvent('form_submitted', { email: email });
      const submitButton = betaForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Submitting...';
      submitButton.disabled = true;

      // Show success after brief delay (form submits to hidden iframe)
      setTimeout(function() {
        showFormMessage('Thanks for signing up! We\'ll be in touch when the beta launches.', 'success');
        submitButton.textContent = 'Request Sent!';
        betaForm.reset();

        setTimeout(function() {
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }, 3000);
      }, 1000);
    });

    function showFormMessage(message, type) {
      if (betaFormMessage) {
        betaFormMessage.textContent = message;
        betaFormMessage.className = 'beta-form-message ' + type;

        // Auto-hide error messages after 5 seconds
        if (type === 'error') {
          setTimeout(function() {
            betaFormMessage.className = 'beta-form-message';
          }, 5000);
        }
      }
    }
  }

});

// ---------- Feature Modal Handling ----------
let modalTriggerElement = null;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // Store the element that triggered the modal
    modalTriggerElement = document.activeElement;

    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Focus the close button or first focusable element
    const closeBtn = modal.querySelector('.modal-close');
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (closeBtn) {
      closeBtn.focus();
    } else if (firstFocusable) {
      firstFocusable.focus();
    }

    // Set up focus trap
    setupFocusTrap(modal);
  }
}

function closeModal() {
  const activeModal = document.querySelector('.modal-overlay.active');
  if (activeModal) {
    activeModal.classList.remove('active');
    document.body.classList.remove('modal-open');

    // Return focus to the trigger element
    if (modalTriggerElement) {
      modalTriggerElement.focus();
      modalTriggerElement = null;
    }
  }
}

function setupFocusTrap(modal) {
  const focusableElements = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  modal.addEventListener('keydown', function trapFocus(e) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }

    // Remove listener when modal closes
    if (!modal.classList.contains('active')) {
      modal.removeEventListener('keydown', trapFocus);
    }
  });
}

// Close modal on overlay click
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// ---------- Utility Functions ----------

/**
 * Debounce function for performance
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
