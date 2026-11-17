// Andrey Hong Portfolio - Core Interactions & Smooth Filter Transitions
(function () {
  'use strict';

  // Dynamic Year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile Menu
  const menu = document.getElementById('menu');
  const nav = document.getElementById('nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
      menu.textContent = open ? '✕' : '☰';
    });

    document.querySelectorAll('nav a').forEach((a) => {
      a.addEventListener('click', () => {
        nav.classList.remove('open');
        menu.setAttribute('aria-expanded', 'false');
        menu.textContent = '☰';
      });
    });
  }

  // Smooth Project Filter Transitions
  const filterButtons = document.querySelectorAll('.filter');
  const projectCards = document.querySelectorAll('.project');

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      button.classList.add('active');

      const chosen = button.dataset.filter;

      projectCards.forEach((card) => {
        const matches = chosen === 'all' || card.dataset.category === chosen;
        if (matches) {
          card.hidden = false;
          card.style.opacity = '0';
          card.style.transform = 'scale(0.96) translateY(12px)';

          requestAnimationFrame(() => {
            card.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'scale(1) translateY(0)';
            setTimeout(() => {
              card.style.transform = '';
              card.style.transition = '';
            }, 420);
          });
        } else {
          card.hidden = true;
        }
      });
    });
  });

  // Intersection Observer Reveal
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('revealed');
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 }
  );

  document.querySelectorAll('.section, .project').forEach((el) => {
    el.classList.add('reveal');
    observer.observe(el);
  });
})();
