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
    // Pause video on mobile to save data
    if (window.innerWidth < 768) {
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
    }

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

  // ---------- Beta Form Handling ----------
  const betaForm = document.getElementById('beta-form');
  const betaFormMessage = document.getElementById('beta-form-message');

  if (betaForm) {
    betaForm.addEventListener('submit', function(e) {
      // Get form data for validation
      const firstName = document.getElementById('beta-firstname').value.trim();
      const lastName = document.getElementById('beta-lastname').value.trim();
      const email = document.getElementById('beta-email').value.trim();

      // Basic validation
      if (!firstName || !lastName || !email) {
        e.preventDefault();
        showFormMessage('Please fill in all required fields.', 'error');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        e.preventDefault();
        showFormMessage('Please enter a valid email address.', 'error');
        return;
      }

      // If validation passes, show success message
      // The form will submit to Google Forms via the hidden iframe
      const submitButton = betaForm.querySelector('button[type="submit"]');
      const originalText = submitButton.textContent;
      submitButton.textContent = 'Submitting...';
      submitButton.disabled = true;

      // Show success message after a short delay (to allow form submission)
      setTimeout(() => {
        showFormMessage('Thanks for signing up! We\'ll be in touch when the beta launches.', 'success');
        submitButton.textContent = 'Request Sent!';

        // Reset form after delay
        setTimeout(() => {
          betaForm.reset();
          submitButton.textContent = originalText;
          submitButton.disabled = false;
        }, 3000);
      }, 500);
    });

    function showFormMessage(message, type) {
      if (betaFormMessage) {
        betaFormMessage.textContent = message;
        betaFormMessage.className = 'beta-form-message ' + type;

        // Auto-hide error messages after 5 seconds
        if (type === 'error') {
          setTimeout(() => {
            betaFormMessage.className = 'beta-form-message';
          }, 5000);
        }
      }
    }
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
