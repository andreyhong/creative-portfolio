/**
 * Interactive Dynamics & 3D Physics Engine for Andrey Hong Portfolio
 * Features:
 * - Fluid Custom Cursor & Magnetic Elements
 * - Dynamic Scroll-Driven Diagonal Tilt / Momentum Skew
 * - Highly Interactive Boxes (Cards, Stats, Video, Assets, Tiles)
 * - 3D Perspective Card Tilt with Specular Glare Sheen & Multi-Layer Parallax
 * - Hero Typography 3D Depth Shift
 * - Interactive Video Editing Timeline Scrubber & Real-time Timecode
 * - Dynamic Camera Lens Optical Reflections
 * - Animated Metric Counters (Stats)
 * - Fluid Filter Slider Pill & Smooth Card Transitions
 * - Scroll Progress Wave Bar
 * - Sound Toggle Integration
 */

(function () {
  'use strict';

  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  /* ==========================================================================
     1. SCROLL PROGRESS BAR & INTERACTIVE DIAGONAL DEGREE PIVOT ON SCROLL
     ========================================================================== */
  const progressBar = document.createElement('div');
  progressBar.className = 'scroll-progress-bar';
  progressBar.innerHTML = '<div class="scroll-progress-fill"></div>';
  document.body.prepend(progressBar);
  const progressFill = progressBar.querySelector('.scroll-progress-fill');

  const slantedConfigs = [
    { selector: '.case-section', maxCut: 4.8, invert: false },
    { selector: '.assets-showcase', maxCut: 4.5, invert: true },
    { selector: '.about', maxCut: 5.0, invert: false },
    { selector: '.contact', maxCut: 5.2, invert: false }
  ];

  function updateDiagonalAngles() {
    const vh = window.innerHeight;

    slantedConfigs.forEach(({ selector, maxCut, invert }) => {
      const el = document.querySelector(selector);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > vh + 120) return;

      // Progress: 0 when top enters viewport from bottom, 1 when bottom leaves viewport at top
      const totalSpan = vh + rect.height;
      const progress = Math.max(0, Math.min(1, (vh - rect.top) / totalSpan));

      // t pivots from -1 to +1 as you scroll past
      let t = (progress - 0.5) * 2;
      if (invert) t = -t;

      // Smooth degree transition:
      // When entering: positive slope (+degrees)
      // When centered: 0 (flat horizontal)
      // When scrolled past: negative slope (-degrees)
      const slope = -t * maxCut;

      const tl = slope > 0 ? slope : 0;
      const tr = slope < 0 ? -slope : 0;
      const br = tl;
      const bl = tr;

      el.style.setProperty('--cut-tl', `${tl.toFixed(2)}vw`);
      el.style.setProperty('--cut-tr', `${tr.toFixed(2)}vw`);
      el.style.setProperty('--cut-br', `${br.toFixed(2)}vw`);
      el.style.setProperty('--cut-bl', `${bl.toFixed(2)}vw`);
    });
  }

  let scrollTicking = false;
  function onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressFill.style.width = `${progress}%`;

    if (!scrollTicking) {
      requestAnimationFrame(() => {
        updateDiagonalAngles();
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateDiagonalAngles, { passive: true });
  updateDiagonalAngles();
  document.documentElement.style.setProperty('--scroll-skew', '0deg');

  /* ==========================================================================
     2. FLUID CUSTOM CURSOR & MAGNETIC PHYSICS
     ========================================================================== */
  let cursorDot = null;
  let cursorRing = null;
  let cursorText = null;

  if (isFinePointer) {
    cursorDot = document.createElement('div');
    cursorDot.className = 'custom-cursor-dot';

    cursorRing = document.createElement('div');
    cursorRing.className = 'custom-cursor-ring';

    cursorText = document.createElement('span');
    cursorText.className = 'cursor-badge-text';
    cursorRing.appendChild(cursorText);

    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    }, { passive: true });

    window.addEventListener('mousedown', () => {
      cursorRing.classList.add('cursor-active');
    }, { passive: true });

    window.addEventListener('mouseup', () => {
      cursorRing.classList.remove('cursor-active');
    }, { passive: true });

    function renderCursor() {
      const speed = 0.2;
      ringX += (mouseX - ringX) * speed;
      ringY += (mouseY - ringY) * speed;

      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      requestAnimationFrame(renderCursor);
    }
    requestAnimationFrame(renderCursor);

    function setupCursorInteractions() {
      const interactives = document.querySelectorAll(
        'a, button, .filter, .round-arrow, .project-art, .asset-tile, .video-item, .tool-list span, .service-list > div, .case-stats > div, .case-tiles > div'
      );

      interactives.forEach((el) => {
        el.addEventListener('mouseenter', () => {
          cursorRing.classList.add('cursor-hover');

          if (el.closest('.video-item') || el.classList.contains('video-item')) {
            cursorRing.classList.add('cursor-badge-play');
            cursorText.textContent = 'PLAY ▶';
          } else if (el.closest('.project-art') || el.classList.contains('project-art')) {
            cursorRing.classList.add('cursor-badge-view');
            cursorText.textContent = 'VIEW ↗';
          } else if (el.classList.contains('round-arrow') || el.classList.contains('nav-cta')) {
            cursorRing.classList.add('cursor-badge-click');
            cursorText.textContent = '';
          } else {
            cursorText.textContent = '';
          }
        });

        el.addEventListener('mouseleave', () => {
          cursorRing.classList.remove(
            'cursor-hover',
            'cursor-badge-play',
            'cursor-badge-view',
            'cursor-badge-click'
          );
          cursorText.textContent = '';
        });
      });

      const magnetics = document.querySelectorAll('.round-arrow, .nav-cta, .theme-toggle, .sound-toggle');
      magnetics.forEach((btn) => {
        btn.addEventListener('mousemove', (e) => {
          const rect = btn.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const dx = (e.clientX - cx) * 0.35;
          const dy = (e.clientY - cy) * 0.35;
          btn.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        });

        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'translate3d(0, 0, 0)';
          btn.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          setTimeout(() => { btn.style.transition = ''; }, 400);
        });
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupCursorInteractions);
    } else {
      setupCursorInteractions();
    }
  }

  /* ==========================================================================
     3. HERO SECTION 3D PARALLAX
     ========================================================================== */
  function setupHeroParallax() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const heroTitle = hero.querySelector('h1');
    const heroBottom = hero.querySelector('.hero-bottom p');

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      if (heroTitle) {
        heroTitle.style.transform = `translate3d(${x * 16}px, ${y * 12}px, 0)`;
        heroTitle.style.transition = 'transform 0.1s ease-out';
      }
      if (heroBottom) {
        heroBottom.style.transform = `translate3d(${x * -8}px, ${y * -6}px, 0)`;
        heroBottom.style.transition = 'transform 0.1s ease-out';
      }
    });

    hero.addEventListener('mouseleave', () => {
      if (heroTitle) {
        heroTitle.style.transform = 'translate3d(0, 0, 0)';
        heroTitle.style.transition = 'transform 0.5s ease-out';
      }
      if (heroBottom) {
        heroBottom.style.transform = 'translate3d(0, 0, 0)';
        heroBottom.style.transition = 'transform 0.5s ease-out';
      }
    });
  }

  /* ==========================================================================
     4. KOTAK-KOTAK INTERAKTIF & 3D TILT WITH SPECULAR GLARE
     ========================================================================== */
  function setupInteractiveBoxes() {
    const boxes = document.querySelectorAll(
      '.project-art, .case-tiles > div, .asset-tile, .video-item, .experience > div, .case-stats > div'
    );

    boxes.forEach((box) => {
      if (!box.querySelector('.specular-glare')) {
        const glare = document.createElement('div');
        glare.className = 'specular-glare';
        box.appendChild(glare);
      }

      box.style.transformStyle = 'preserve-3d';

      box.addEventListener('mousemove', (e) => {
        const rect = box.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const px = (x / rect.width - 0.5) * 2;
        const py = (y / rect.height - 0.5) * 2;

        const rotX = -py * 6.5;
        const rotY = px * 6.5;

        box.style.transform = `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-8px) scale3d(1.018, 1.018, 1.018)`;

        const glare = box.querySelector('.specular-glare');
        if (glare) {
          glare.style.opacity = '1';
          glare.style.background = `radial-gradient(circle 260px at ${x}px ${y}px, rgba(212, 255, 95, 0.22), transparent 70%)`;
        }

        // Parallax inner elements
        const serum = box.querySelector('.serum-silhouette');
        if (serum) {
          serum.style.transform = `rotate(16deg) translate3d(${px * 16}px, ${py * 16}px, 45px)`;
        }

        const ring = box.querySelector('.howell-ring');
        if (ring) {
          ring.style.transform = `translate3d(${px * -18}px, ${py * -18}px, 25px)`;
        }

        const cable = box.querySelector('.cable');
        if (cable) {
          cable.style.transform = `rotate(-24deg) translate3d(${px * 14}px, ${py * 14}px, 35px)`;
        }

        const leaves = box.querySelectorAll('.leaf');
        leaves.forEach((l, idx) => {
          const factor = idx === 0 ? 12 : -15;
          l.style.transform = `${idx === 0 ? 'rotate(35deg)' : 'rotate(-18deg)'} translate3d(${px * factor}px, ${py * factor}px, 30px)`;
        });

        const lens = box.querySelector('.lens');
        if (lens) {
          lens.style.transform = `translate3d(${px * -15}px, ${py * -15}px, 35px)`;
          const lensPx = 30 + px * 20;
          const lensPy = 25 + py * 20;
          lens.style.background = `radial-gradient(circle at ${lensPx}% ${lensPy}%, #f4baba, #4f4a71 30%, #0a0a15 65%)`;
        }
      });

      box.addEventListener('mouseleave', () => {
        box.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale3d(1, 1, 1)';
        box.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)';

        const glare = box.querySelector('.specular-glare');
        if (glare) {
          glare.style.opacity = '0';
          glare.style.transition = 'opacity 0.4s ease';
        }

        const serum = box.querySelector('.serum-silhouette');
        if (serum) {
          serum.style.transform = 'rotate(16deg)';
          serum.style.transition = 'transform 0.45s ease';
        }

        const ring = box.querySelector('.howell-ring');
        if (ring) {
          ring.style.transform = '';
          ring.style.transition = 'transform 0.45s ease';
        }

        const cable = box.querySelector('.cable');
        if (cable) {
          cable.style.transform = 'rotate(-24deg)';
          cable.style.transition = 'transform 0.45s ease';
        }

        const leaves = box.querySelectorAll('.leaf');
        leaves.forEach((l, idx) => {
          l.style.transform = idx === 0 ? 'rotate(35deg)' : 'rotate(-18deg)';
          l.style.transition = 'transform 0.45s ease';
        });

        const lens = box.querySelector('.lens');
        if (lens) {
          lens.style.transform = '';
          lens.style.background = '';
          lens.style.transition = 'transform 0.45s ease, background 0.45s ease';
        }

        setTimeout(() => {
          box.style.transition = '';
          box.style.transform = '';
          if (glare) glare.style.transition = '';
          if (serum) serum.style.transition = '';
          if (ring) ring.style.transition = '';
          if (cable) cable.style.transition = '';
          leaves.forEach((l) => (l.style.transition = ''));
          if (lens) lens.style.transition = '';
        }, 450);
      });
    });
  }

  /* ==========================================================================
     5. INTERACTIVE VIDEO EDITING TIMELINE SCRUBBER
     ========================================================================== */
  function setupTimelineScrubber() {
    const editingCard = document.querySelector('.project-art.editing');
    if (!editingCard) return;

    const timeline = editingCard.querySelector('.timeline');
    const timeDisplay = editingCard.querySelector('.editing-frames span:last-child');
    if (!timeline) return;

    const playhead = document.createElement('div');
    playhead.className = 'timeline-playhead';
    timeline.appendChild(playhead);

    const segments = timeline.querySelectorAll('div:not(.timeline-playhead)');

    timeline.addEventListener('mousemove', (e) => {
      e.stopPropagation();
      const rect = timeline.getBoundingClientRect();
      const relX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const pct = relX / rect.width;

      playhead.style.left = `${relX}px`;
      playhead.style.opacity = '1';

      const totalSec = 84;
      const currentSec = Math.floor(pct * totalSec);
      const m = String(Math.floor(currentSec / 60)).padStart(2, '0');
      const s = String(currentSec % 60).padStart(2, '0');
      if (timeDisplay) {
        timeDisplay.textContent = `${m}:${s}`;
        timeDisplay.style.color = '#d4ff5f';
      }

      segments.forEach((seg) => {
        const segRect = seg.getBoundingClientRect();
        const dist = Math.abs((e.clientX - (segRect.left + segRect.width / 2)));
        if (dist < 45) {
          const scaleY = 1 + (1 - dist / 45) * 0.7;
          seg.style.transform = `scaleY(${scaleY})`;
          seg.style.filter = 'brightness(1.3)';
        } else {
          seg.style.transform = 'scaleY(1)';
          seg.style.filter = 'none';
        }
      });
    });

    timeline.addEventListener('mouseleave', () => {
      playhead.style.opacity = '0';
      if (timeDisplay) {
        timeDisplay.textContent = '01:24';
        timeDisplay.style.color = '';
      }
      segments.forEach((seg) => {
        seg.style.transform = 'scaleY(1)';
        seg.style.filter = 'none';
      });
    });
  }

  /* ==========================================================================
     6. ANIMATED STATS COUNTER
     ========================================================================== */
  function setupStatsCounter() {
    const statsContainer = document.querySelector('.case-stats');
    if (!statsContainer) return;

    const statsElements = statsContainer.querySelectorAll('strong');
    let animated = false;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !animated) {
            animated = true;
            statsElements.forEach((el) => {
              const text = el.textContent.trim();

              if (/^\d+$/.test(text)) {
                const target = parseInt(text, 10);
                const pad = text.length;
                animateNumber(el, 0, target, 1200, (n) => String(Math.round(n)).padStart(pad, '0'));
              } else if (text === '100%') {
                animateNumber(el, 0, 100, 1400, (n) => `${Math.round(n)}%`);
              } else if (text === '9:16') {
                el.style.display = 'inline-block';
                el.style.transform = 'scale(0.8)';
                el.style.opacity = '0';
                setTimeout(() => {
                  el.style.transition = 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.6s';
                  el.style.transform = 'scale(1)';
                  el.style.opacity = '1';
                }, 200);
              }
            });
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(statsContainer);

    function animateNumber(element, start, end, duration, formatFn) {
      const startTime = performance.now();
      function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = start + (end - start) * ease;
        element.textContent = formatFn(current);
        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          element.textContent = formatFn(end);
        }
      }
      requestAnimationFrame(update);
    }
  }

  /* ==========================================================================
     7. FLUID FILTER SLIDER PILL
     ========================================================================== */
  function setupFilterPill() {
    const filterContainer = document.querySelector('.filters');
    if (!filterContainer) return;

    const pill = document.createElement('div');
    pill.className = 'filter-sliding-pill';
    filterContainer.prepend(pill);

    function positionPill(activeBtn) {
      if (!activeBtn) return;
      const cRect = filterContainer.getBoundingClientRect();
      const bRect = activeBtn.getBoundingClientRect();

      pill.style.width = `${bRect.width}px`;
      pill.style.height = `${bRect.height}px`;
      pill.style.transform = `translate3d(${bRect.left - cRect.left}px, ${bRect.top - cRect.top}px, 0)`;
      pill.style.opacity = '1';
    }

    const initialActive = filterContainer.querySelector('.filter.active');
    setTimeout(() => positionPill(initialActive), 80);
    window.addEventListener('load', () => positionPill(filterContainer.querySelector('.filter.active')));

    const buttons = filterContainer.querySelectorAll('.filter');
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        positionPill(btn);
      });
    });

    window.addEventListener('resize', () => {
      const curr = filterContainer.querySelector('.filter.active');
      positionPill(curr);
    }, { passive: true });
  }

  /* ==========================================================================
     8. SOUND TOGGLE BUTTON IN NAVBAR
     ========================================================================== */
  function setupSoundToggle() {
    const nav = document.querySelector('.nav');
    const themeToggle = document.querySelector('.theme-toggle');
    if (!nav || !themeToggle) return;

    const soundBtn = document.createElement('button');
    soundBtn.className = 'sound-toggle';
    soundBtn.type = 'button';
    soundBtn.setAttribute('aria-label', 'Toggle water ripple sound');
    soundBtn.setAttribute('aria-pressed', 'false');
    soundBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
      </svg>
      <span class="sound-text">SOUND: OFF</span>
    `;

    themeToggle.parentNode.insertBefore(soundBtn, themeToggle);

    soundBtn.addEventListener('click', () => {
      if (window.PortfolioWater) {
        const isEnabled = window.PortfolioWater.isSoundEnabled();
        const newState = !isEnabled;
        window.PortfolioWater.setSoundEnabled(newState);
        soundBtn.setAttribute('aria-pressed', String(newState));

        if (newState) {
          soundBtn.classList.add('sound-active');
          soundBtn.querySelector('.sound-text').textContent = 'SOUND: ON';
          window.PortfolioWater.triggerSplash(window.innerWidth / 2, 100, 0.08);
        } else {
          soundBtn.classList.remove('sound-active');
          soundBtn.querySelector('.sound-text').textContent = 'SOUND: OFF';
        }
      }
    });
  }

  /* ==========================================================================
     9. INITIALIZATION
     ========================================================================== */
  function initAll() {
    setupHeroParallax();
    setupInteractiveBoxes();
    setupTimelineScrubber();
    setupStatsCounter();
    setupFilterPill();
    setupSoundToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
