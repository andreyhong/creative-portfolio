/**
 * Dynamic Fluid & Water Ripple Engine for Andrey Hong Portfolio
 * Features:
 * - DARK MODE: Tranquil, calm, still liquid glass water with 85% opacity (no turbulent ripples / "jangan beriak")
 * - LIGHT MODE: Elegant, sparkling crystal water ripples confined to the Header section (.nav)
 */

(function () {
  'use strict';

  function isDarkMode() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) return theme === 'dark';
    return !document.documentElement.classList.contains('light');
  }

  /* ==========================================================================
     1. SOUND GENERATOR (Subtle water drops for header clicks in Light Mode)
     ========================================================================== */
  let audioCtx = null;
  let soundEnabled = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playWaterDropSound(intensity = 0.5) {
    if (!soundEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const baseFreq = 440 + Math.random() * 180;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.14);

      const vol = Math.min(0.08, 0.02 + intensity * 0.03);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      // Ignore audio glitch
    }
  }

  /* ==========================================================================
     2. CANVASES SETUP
     - heroCanvas: Dark Mode tranquil still water (85% opacity, zero wave ripples)
     - navCanvas: Light Mode interactive water ripples confined to header (.nav)
     ========================================================================== */
  let heroCanvas = null;
  let heroEl = null;
  let navCanvas = null;
  let navEl = null;

  function initCanvases() {
    heroEl = document.querySelector('.hero');
    navEl = document.querySelector('.nav');

    if (!heroEl && !navEl) return false;

    // 1. Dark Mode Still Water Canvas (in .hero)
    if (heroEl) {
      heroEl.style.position = 'relative';
      heroCanvas = document.createElement('canvas');
      heroCanvas.id = 'hero-water-canvas';
      heroCanvas.setAttribute('aria-hidden', 'true');
      heroCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        mix-blend-mode: screen;
        opacity: 0.85;
        transition: opacity 0.4s ease;
      `;
      heroEl.prepend(heroCanvas);
    }

    // 2. Light Mode Header Water Canvas (in .nav)
    if (navEl) {
      navEl.style.position = 'relative';
      navCanvas = document.createElement('canvas');
      navCanvas.id = 'nav-water-canvas';
      navCanvas.setAttribute('aria-hidden', 'true');
      navCanvas.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1;
        mix-blend-mode: multiply;
        opacity: 0.75;
        transition: opacity 0.4s ease;
        display: none;
      `;
      navEl.prepend(navCanvas);
    }

    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupWaterEngine);
  } else {
    setupWaterEngine();
  }

  function setupWaterEngine() {
    if (!initCanvases()) {
      setTimeout(setupWaterEngine, 50);
      return;
    }

    /* ==========================================================================
       3. THEME SYNCHRONIZATION
       ========================================================================== */
    function syncThemeElements() {
      const dark = isDarkMode();
      if (heroCanvas) {
        heroCanvas.style.display = dark ? 'block' : 'none';
        heroCanvas.style.opacity = '0.85';
      }
      if (navCanvas) {
        navCanvas.style.display = dark ? 'none' : 'block';
        navCanvas.style.opacity = '0.75';
      }
    }

    const themeObserver = new MutationObserver(() => syncThemeElements());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    syncThemeElements();

    /* ==========================================================================
       4. DARK MODE: CALM STILL WATER ENGINE (NO RIPPLES / "JANGAN BERIAK")
       Glassy, smooth, serene surface with soft ambient crystalline sheen
       ========================================================================== */
    let glHero = null;
    let programHero = null;
    let uHeroResolution, uHeroTime;

    const vsSrc = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Dark Mode Still Water Shader: Smooth organic ambient shimmer, ZERO wave ripples
    const fsDarkSrc = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = vec2(v_uv.x * aspect, v_uv.y);

        // Calm, tranquil, smooth glassy liquid surface (no ripples)
        float wave1 = sin(p.x * 1.6 + u_time * 0.22) * cos(p.y * 1.6 + u_time * 0.18) * 0.0022;
        float wave2 = sin(p.x * 2.8 - u_time * 0.15 + p.y * 1.4) * 0.0012;
        float h = wave1 + wave2;

        vec2 grad = vec2(
          cos(p.x * 1.6 + u_time * 0.22) * 1.6 * cos(p.y * 1.6 + u_time * 0.18) * 0.0022,
          -sin(p.x * 1.6 + u_time * 0.22) * sin(p.y * 1.6 + u_time * 0.18) * 1.6 * 0.0022
        );

        vec3 normal = normalize(vec3(-grad.x * 1.8, -grad.y * 1.8, 1.0));
        vec3 lightDir = normalize(vec3(-0.35, 0.45, 0.82));
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 halfDir = normalize(lightDir + viewDir);

        // Soft, serene specular glints with 85% opacity clarity
        float spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.65;
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2) * 0.35;
        float caustic = pow(abs(h) * 18.0, 1.15) * 0.45;

        vec3 limeAccent = vec3(0.83, 1.0, 0.37);
        vec3 waterWhite = vec3(0.96, 0.99, 1.0);
        vec3 deepCyan = vec3(0.12, 0.82, 0.76);

        vec3 color = mix(limeAccent, waterWhite, spec * 0.65);
        color = mix(color, deepCyan, caustic * 0.25);

        // 85% max opacity
        float alpha = clamp(spec * 1.2 + caustic * 0.45 + fresnel * 0.25 + abs(h) * 1.5, 0.0, 0.85);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    try {
      if (heroCanvas) {
        glHero = heroCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
        if (glHero) {
          const compile = (type, src) => {
            const s = glHero.createShader(type);
            glHero.shaderSource(s, src);
            glHero.compileShader(s);
            if (!glHero.getShaderParameter(s, glHero.COMPILE_STATUS)) return null;
            return s;
          };

          const vs = compile(glHero.VERTEX_SHADER, vsSrc);
          const fs = compile(glHero.FRAGMENT_SHADER, fsDarkSrc);

          if (vs && fs) {
            programHero = glHero.createProgram();
            glHero.attachShader(programHero, vs);
            glHero.attachShader(programHero, fs);
            glHero.linkProgram(programHero);

            if (glHero.getProgramParameter(programHero, glHero.LINK_STATUS)) {
              glHero.useProgram(programHero);

              const buffer = glHero.createBuffer();
              glHero.bindBuffer(glHero.ARRAY_BUFFER, buffer);
              glHero.bufferData(
                glHero.ARRAY_BUFFER,
                new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
                glHero.STATIC_DRAW
              );

              const aPos = glHero.getAttribLocation(programHero, 'a_position');
              glHero.enableVertexAttribArray(aPos);
              glHero.vertexAttribPointer(aPos, 2, glHero.FLOAT, false, 0, 0);

              uHeroResolution = glHero.getUniformLocation(programHero, 'u_resolution');
              uHeroTime = glHero.getUniformLocation(programHero, 'u_time');

              glHero.enable(glHero.BLEND);
              glHero.blendFunc(glHero.SRC_ALPHA, glHero.ONE_MINUS_SRC_ALPHA);
            }
          }
        }
      }
    } catch (e) {
      glHero = null;
    }

    /* ==========================================================================
       5. LIGHT MODE: HEADER WATER RIPPLE ENGINE (.nav)
       Interactive, crystal fresh water ripples in the header
       ========================================================================== */
    const MAX_NAV_RIPPLES = 16;
    const navRipples = [];
    let navCtx2d = null;
    if (navCanvas) {
      navCtx2d = navCanvas.getContext('2d');
    }

    let lastNavX = null;
    let lastNavY = null;
    let lastNavTime = 0;

    function addNavRipple(x, y, intensity = 0.03, speed = 0.42, wavelength = 0.08) {
      const now = performance.now() * 0.001;
      if (navRipples.length >= MAX_NAV_RIPPLES) {
        navRipples.shift();
      }
      navRipples.push({
        x: x,
        y: y,
        birth: now,
        intensity: intensity,
        speed: speed,
        wavelength: wavelength,
      });
    }

    // Pointer move in Header (.nav)
    if (navEl) {
      navEl.addEventListener('pointermove', (e) => {
        if (isDarkMode()) return; // Light mode only
        const rect = navEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const now = performance.now() * 0.001;

        if (lastNavX !== null && lastNavY !== null) {
          const dx = x - lastNavX;
          const dy = y - lastNavY;
          const dist = Math.hypot(dx, dy);
          const dt = now - lastNavTime;

          if (dist > 16 && dt > 0.03) {
            const speed = Math.min(dist / (dt * 1000), 1.5);
            addNavRipple(x, y, 0.025 + speed * 0.015, 0.4 + speed * 0.08);
            lastNavX = x;
            lastNavY = y;
            lastNavTime = now;
          }
        } else {
          lastNavX = x;
          lastNavY = y;
          lastNavTime = now;
          addNavRipple(x, y, 0.03, 0.42);
        }
      }, { passive: true });

      navEl.addEventListener('pointerdown', (e) => {
        if (isDarkMode()) return;
        const rect = navEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        initAudio();
        addNavRipple(x, y, 0.065, 0.48);
        playWaterDropSound(0.7);
      }, { passive: true });
    }

    /* ==========================================================================
       6. RESIZING
       ========================================================================== */
    let dpr = 1;

    function onResize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Hero Canvas (Dark Mode)
      if (heroCanvas && heroEl) {
        const rect = heroEl.getBoundingClientRect();
        const w = Math.max(rect.width, 320);
        const h = Math.max(rect.height, 400);
        heroCanvas.width = Math.floor(w * dpr);
        heroCanvas.height = Math.floor(h * dpr);
        if (glHero) {
          glHero.viewport(0, 0, heroCanvas.width, heroCanvas.height);
        }
      }

      // Nav Canvas (Light Mode Header)
      if (navCanvas && navEl) {
        const rect = navEl.getBoundingClientRect();
        const w = Math.max(rect.width, 320);
        const h = Math.max(rect.height, 60);
        navCanvas.width = Math.floor(w * dpr);
        navCanvas.height = Math.floor(h * dpr);
      }
    }
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    /* ==========================================================================
       7. RENDER LOOP
       ========================================================================== */
    let animFrameId = null;

    function render() {
      animFrameId = requestAnimationFrame(render);
      const dark = isDarkMode();
      const now = performance.now() * 0.001;

      if (dark) {
        // Dark Mode: Render calm still liquid water in .hero
        if (!heroCanvas || heroCanvas.style.display === 'none') return;

        if (glHero && programHero) {
          glHero.useProgram(programHero);
          glHero.uniform2f(uHeroResolution, heroCanvas.width, heroCanvas.height);
          glHero.uniform1f(uHeroTime, now);

          glHero.clearColor(0.0, 0.0, 0.0, 0.0);
          glHero.clear(glHero.COLOR_BUFFER_BIT);
          glHero.drawArrays(glHero.TRIANGLES, 0, 6);
        }
      } else {
        // Light Mode: Render sparkling water ripples in header (.nav)
        if (!navCanvas || !navCtx2d || navCanvas.style.display === 'none') return;
        navCtx2d.clearRect(0, 0, navCanvas.width, navCanvas.height);

        while (navRipples.length > 0 && (now - navRipples[0].birth) > 2.2) {
          navRipples.shift();
        }

        const navW = navCanvas.width / dpr;
        navCtx2d.save();
        navCtx2d.scale(dpr, dpr);

        for (let i = 0; i < navRipples.length; i++) {
          const r = navRipples[i];
          const age = now - r.birth;
          if (age < 0 || age > 2.2) continue;

          const currentR = age * r.speed * navW * 0.35;
          const fade = Math.max(0, 1 - (age / 2.2));

          // Crystal aquatic turquoise ripple ring
          navCtx2d.beginPath();
          navCtx2d.arc(r.x, r.y, currentR, 0, Math.PI * 2);
          navCtx2d.lineWidth = 1.6 + age * 2.2;
          navCtx2d.strokeStyle = `rgba(32, 138, 120, ${fade * r.intensity * 4.2})`;
          navCtx2d.shadowColor = 'rgba(60, 200, 175, 0.5)';
          navCtx2d.shadowBlur = 8;
          navCtx2d.stroke();
          navCtx2d.shadowBlur = 0;
        }

        navCtx2d.restore();
      }
    }

    animFrameId = requestAnimationFrame(render);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animFrameId) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        }
      } else {
        if (!animFrameId) {
          lastNavTime = performance.now() * 0.001;
          navRipples.length = 0;
          animFrameId = requestAnimationFrame(render);
        }
      }
    });
  }

  // Sound toggle API
  window.PortfolioWater = {
    setSoundEnabled(enabled) {
      soundEnabled = !!enabled;
      if (soundEnabled) initAudio();
      return soundEnabled;
    },
    isSoundEnabled() {
      return soundEnabled;
    },
    triggerSplash(x, y, intensity = 0.05) {
      if (soundEnabled) {
        playWaterDropSound(intensity * 6);
      }
    },
  };
})();
