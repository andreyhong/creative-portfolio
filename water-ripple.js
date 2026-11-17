/**
 * Dynamic Fluid & Elemental Engine for Andrey Hong Portfolio
 * Features:
 * - DARK MODE: Calm, tranquil, ultra-smooth water ripple & wave dynamics (soft & non-turbulent)
 * - LIGHT MODE: Vibrant, realistic Fire & Ember Flame particle system following the cursor
 */

(function () {
  'use strict';

  function isDarkMode() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) return theme === 'dark';
    return !document.documentElement.classList.contains('light');
  }

  /* ==========================================================================
     1. SOUND GENERATOR (Web Audio API - Active for subtle water drops in Dark Mode)
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
    if (!soundEnabled || !audioCtx || !isDarkMode()) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      const baseFreq = 420 + Math.random() * 180;
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
     - waterCanvas: Confined to Hero for silky water ripples in Dark Mode
     - fireCanvas: Fixed viewport canvas for fire following cursor in Light Mode
     ========================================================================== */
  let waterCanvas = null;
  let heroEl = null;
  let fireCanvas = null;
  let fireCtx = null;

  function initCanvases() {
    heroEl = document.querySelector('.hero');
    if (!heroEl) return false;

    heroEl.style.position = 'relative';

    // 1. Water Canvas (Dark Mode)
    waterCanvas = document.createElement('canvas');
    waterCanvas.id = 'water-ripple-canvas';
    waterCanvas.setAttribute('aria-hidden', 'true');
    waterCanvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      mix-blend-mode: screen;
      opacity: 0.65;
      transition: opacity 0.4s ease;
    `;
    heroEl.prepend(waterCanvas);

    // 2. Fire Canvas (Light Mode)
    fireCanvas = document.createElement('canvas');
    fireCanvas.id = 'fire-cursor-canvas';
    fireCanvas.setAttribute('aria-hidden', 'true');
    fireCanvas.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 99990;
      display: none;
    `;
    document.body.appendChild(fireCanvas);
    fireCtx = fireCanvas.getContext('2d');

    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupElementalEngine);
  } else {
    setupElementalEngine();
  }

  function setupElementalEngine() {
    if (!initCanvases()) {
      setTimeout(setupElementalEngine, 50);
      return;
    }

    /* ==========================================================================
       3. THEME SYNCHRONIZATION
       ========================================================================== */
    function syncThemeElements() {
      const dark = isDarkMode();
      if (waterCanvas) {
        waterCanvas.style.display = dark ? 'block' : 'none';
      }
      if (fireCanvas) {
        fireCanvas.style.display = dark ? 'none' : 'block';
      }
    }

    const themeObserver = new MutationObserver(() => syncThemeElements());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    syncThemeElements();

    /* ==========================================================================
       4. DARK MODE: ULTRA-SMOOTH WATER RIPPLE ENGINE
       ========================================================================== */
    const MAX_RIPPLES = 24;
    const ripples = [];
    let lastX = null;
    let lastY = null;
    let lastTime = 0;
    let idleTimer = null;

    let gl = null;
    let program = null;
    let uResolution, uTime, uRipples, uRippleParams, uRippleCount;

    const vertexSrc = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentSrc = `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec3 u_ripples[${MAX_RIPPLES}];
      uniform vec3 u_rippleParams[${MAX_RIPPLES}];
      uniform int u_rippleCount;

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = vec2(v_uv.x * aspect, v_uv.y);

        float h = 0.0;
        vec2 grad = vec2(0.0);

        // Calm, gentle ambient surface shimmer (ultra smooth, tranquil)
        float amb = sin(p.x * 2.2 + u_time * 0.35) * cos(p.y * 2.2 + u_time * 0.3) * 0.0016;
        h += amb;

        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          if (i >= u_rippleCount) break;
          vec2 c = vec2(u_ripples[i].x * aspect, u_ripples[i].y);
          float birth = u_ripples[i].z;
          float age = u_time - birth;
          if (age < 0.0 || age > 2.6) continue;

          float intensity = u_rippleParams[i].x;
          float speed = u_rippleParams[i].y;
          float wavelength = u_rippleParams[i].z;

          float d = distance(p, c);
          float waveFront = age * speed;
          float diff = d - waveFront;

          // Wide Gaussian envelope: smooth, silky rolling wave, no harsh ripples
          float width = 0.15 + age * 0.08;
          float envelope = exp(- (diff * diff) / (2.0 * width * width));
          float decay = exp(-age * 1.5) / (sqrt(d + 0.28));

          float k = 6.2831853 / wavelength;
          float wave = sin(diff * k) * envelope * decay * intensity;
          h += wave;

          vec2 dir = (d > 0.0005) ? normalize(p - c) : vec2(0.0);
          float dWave = cos(diff * k) * k * envelope * decay * intensity;
          grad += dir * dWave;
        }

        vec3 normal = normalize(vec3(-grad.x * 1.3, -grad.y * 1.3, 1.0));
        vec3 lightDir = normalize(vec3(-0.35, 0.45, 0.82));
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 halfDir = normalize(lightDir + viewDir);

        // Soft, elegant specular sheen instead of sharp glare
        float spec = pow(max(dot(normal, halfDir), 0.0), 16.0) * 0.45;
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.2) * 0.3;
        float caustic = pow(abs(h) * 12.0, 1.1) * 0.32;

        vec3 limeAccent = vec3(0.83, 1.0, 0.37);
        vec3 waterWhite = vec3(0.96, 0.99, 1.0);
        vec3 deepCyan = vec3(0.15, 0.8, 0.75);

        vec3 color = mix(limeAccent, waterWhite, spec * 0.6);
        color = mix(color, deepCyan, caustic * 0.2);

        float alpha = clamp(spec * 0.85 + caustic * 0.28 + fresnel * 0.15 + abs(h) * 0.85, 0.0, 0.45);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    let useWebGL = false;
    try {
      gl = waterCanvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
      if (gl) {
        const compile = (type, src) => {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
          return s;
        };

        const vs = compile(gl.VERTEX_SHADER, vertexSrc);
        const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);

        if (vs && fs) {
          program = gl.createProgram();
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);

          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            useWebGL = true;
            gl.useProgram(program);

            const buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
              gl.STATIC_DRAW
            );

            const aPos = gl.getAttribLocation(program, 'a_position');
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

            uResolution = gl.getUniformLocation(program, 'u_resolution');
            uTime = gl.getUniformLocation(program, 'u_time');
            uRipples = gl.getUniformLocation(program, 'u_ripples');
            uRippleParams = gl.getUniformLocation(program, 'u_rippleParams');
            uRippleCount = gl.getUniformLocation(program, 'u_rippleCount');

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          }
        }
      }
    } catch (err) {
      useWebGL = false;
    }

    let ctx2dWater = null;
    if (!useWebGL && waterCanvas) {
      ctx2dWater = waterCanvas.getContext('2d');
    }

    let waterWidth = 0;
    let waterHeight = 0;
    let dpr = 1;

    function onResize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Water canvas size (hero)
      if (waterCanvas && heroEl) {
        const rect = heroEl.getBoundingClientRect();
        waterWidth = Math.max(rect.width, 320);
        waterHeight = Math.max(rect.height, 400);
        waterCanvas.width = Math.floor(waterWidth * dpr);
        waterCanvas.height = Math.floor(waterHeight * dpr);
        if (useWebGL && gl) {
          gl.viewport(0, 0, waterCanvas.width, waterCanvas.height);
        }
      }

      // Fire canvas size (viewport)
      if (fireCanvas) {
        fireCanvas.width = Math.floor(window.innerWidth * dpr);
        fireCanvas.height = Math.floor(window.innerHeight * dpr);
      }
    }
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    function addRipple(localX, localY, intensity = 0.012, speed = 0.32, wavelength = 0.085) {
      const now = performance.now() * 0.001;
      const uvX = localX / waterWidth;
      const uvY = 1.0 - (localY / waterHeight);

      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({
        x: uvX,
        y: uvY,
        screenX: localX,
        screenY: localY,
        birth: now,
        intensity: Math.min(0.025, intensity), // Smooth, soft amplitude
        speed: speed,
        wavelength: wavelength,
      });
    }

    function getHeroCoordinates(e) {
      if (!heroEl) return null;
      const heroRect = heroEl.getBoundingClientRect();
      const navEl = document.querySelector('.nav');
      const navRect = navEl ? navEl.getBoundingClientRect() : null;

      const clientX = e.clientX;
      const clientY = e.clientY;

      if (navRect && clientY >= navRect.top && clientY <= navRect.bottom && clientX >= navRect.left && clientX <= navRect.right) {
        return {
          x: clientX - heroRect.left,
          y: Math.max(0, clientY - heroRect.top),
        };
      }

      if (clientY >= heroRect.top && clientY <= heroRect.bottom && clientX >= heroRect.left && clientX <= heroRect.right) {
        return {
          x: clientX - heroRect.left,
          y: clientY - heroRect.top,
        };
      }
      return null;
    }

    /* ==========================================================================
       5. LIGHT MODE: FIRE & EMBER CURSOR TRAIL ENGINE
       ========================================================================== */
    const fireParticles = [];
    const MAX_FIRE_PARTICLES = 160;
    let mouseX = -100;
    let mouseY = -100;
    let prevMouseX = -100;
    let prevMouseY = -100;
    let lastSpawnTime = 0;

    function spawnFireParticles(x, y, count = 3, spread = 6) {
      for (let i = 0; i < count; i++) {
        if (fireParticles.length >= MAX_FIRE_PARTICLES) {
          fireParticles.shift();
        }
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * spread;
        const isSpark = Math.random() < 0.28;

        fireParticles.push({
          x: x + Math.cos(angle) * speed,
          y: y + Math.sin(angle) * speed,
          vx: (Math.random() - 0.5) * (isSpark ? 3.5 : 1.8),
          vy: -Math.random() * (isSpark ? 5.5 : 3.8) - 1.2, // Buoyant upward lift
          life: 1.0,
          decay: isSpark ? 0.018 + Math.random() * 0.02 : 0.024 + Math.random() * 0.03,
          size: isSpark ? 1.5 + Math.random() * 2 : 12 + Math.random() * 16,
          isSpark: isSpark
        });
      }
    }

    // Pointer event listeners
    window.addEventListener('pointermove', (e) => {
      const dark = isDarkMode();
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (dark) {
        // Dark Mode: smooth water ripples in header/hero
        const coords = getHeroCoordinates(e);
        if (!coords) return;
        initAudio();
        const x = coords.x;
        const y = coords.y;
        const now = performance.now() * 0.001;

        if (lastX !== null && lastY !== null) {
          const dx = x - lastX;
          const dy = y - lastY;
          const dist = Math.hypot(dx, dy);
          const dt = now - lastTime;

          if (dist > 22 && dt > 0.03) {
            const speed = Math.min(dist / (dt * 1000), 1.5);
            const intensity = 0.008 + speed * 0.006;
            const waveSpeed = 0.28 + speed * 0.05;
            const wavelength = 0.085 + Math.random() * 0.015;

            addRipple(x, y, intensity, waveSpeed, wavelength);
            if (dist > 75 && Math.random() < 0.12) {
              playWaterDropSound(speed * 0.35);
            }
            lastX = x;
            lastY = y;
            lastTime = now;
          }
        } else {
          lastX = x;
          lastY = y;
          lastTime = now;
          addRipple(x, y, 0.012, 0.3, 0.085);
        }
        resetIdleTimer();
      } else {
        // Light Mode: fire following cursor
        const dist = Math.hypot(mouseX - prevMouseX, mouseY - prevMouseY);
        if (dist > 4) {
          const count = Math.min(7, Math.floor(dist * 0.35) + 2);
          spawnFireParticles(mouseX, mouseY, count, 8);
          prevMouseX = mouseX;
          prevMouseY = mouseY;
        }
      }
    }, { passive: true });

    window.addEventListener('pointerdown', (e) => {
      const dark = isDarkMode();
      if (dark) {
        const coords = getHeroCoordinates(e);
        if (!coords) return;
        initAudio();
        addRipple(coords.x, coords.y, 0.035, 0.35, 0.085);
        playWaterDropSound(0.6);
        resetIdleTimer();
      } else {
        // Burst of flame sparks on click in light mode
        spawnFireParticles(e.clientX, e.clientY, 16, 14);
      }
    }, { passive: true });

    function resetIdleTimer() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(triggerAmbientDrop, 5000);
    }

    function triggerAmbientDrop() {
      if (document.hidden || !heroEl || !isDarkMode()) return;
      const rect = heroEl.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      const rx = waterWidth * (0.2 + Math.random() * 0.6);
      const ry = waterHeight * (0.2 + Math.random() * 0.6);
      addRipple(rx, ry, 0.015, 0.28, 0.09);
      playWaterDropSound(0.25);
      idleTimer = setTimeout(triggerAmbientDrop, 6000 + Math.random() * 3500);
    }
    resetIdleTimer();

    /* ==========================================================================
       6. RENDER LOOP
       ========================================================================== */
    let animFrameId = null;

    function render() {
      animFrameId = requestAnimationFrame(render);
      const dark = isDarkMode();

      if (dark) {
        // Render Dark Mode Water
        if (!waterCanvas || waterCanvas.style.display === 'none') return;
        const now = performance.now() * 0.001;

        while (ripples.length > 0 && (now - ripples[0].birth) > 2.6) {
          ripples.shift();
        }

        if (useWebGL && gl && program) {
          gl.useProgram(program);
          gl.uniform2f(uResolution, waterCanvas.width, waterCanvas.height);
          gl.uniform1f(uTime, now);
          gl.uniform1i(uRippleCount, ripples.length);

          const rippleData = new Float32Array(MAX_RIPPLES * 3);
          const paramData = new Float32Array(MAX_RIPPLES * 3);

          for (let i = 0; i < ripples.length; i++) {
            const r = ripples[i];
            const idx = i * 3;
            rippleData[idx] = r.x;
            rippleData[idx + 1] = r.y;
            rippleData[idx + 2] = r.birth;
            paramData[idx] = r.intensity;
            paramData[idx + 1] = r.speed;
            paramData[idx + 2] = r.wavelength;
          }

          gl.uniform3fv(uRipples, rippleData);
          gl.uniform3fv(uRippleParams, paramData);

          gl.clearColor(0.0, 0.0, 0.0, 0.0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        } else if (ctx2dWater) {
          ctx2dWater.clearRect(0, 0, waterCanvas.width, waterCanvas.height);
          ctx2dWater.save();
          ctx2dWater.scale(dpr, dpr);

          for (let i = 0; i < ripples.length; i++) {
            const r = ripples[i];
            const age = now - r.birth;
            if (age < 0 || age > 2.6) continue;

            const currentR = age * r.speed * waterWidth * 0.65;
            const fade = Math.max(0, 1 - (age / 2.6));

            ctx2dWater.beginPath();
            ctx2dWater.arc(r.screenX, r.screenY, currentR, 0, Math.PI * 2);
            ctx2dWater.lineWidth = 1.6 + age * 2.0;
            ctx2dWater.strokeStyle = `rgba(212, 255, 95, ${fade * r.intensity * 2.8})`;
            ctx2dWater.stroke();
          }
          ctx2dWater.restore();
        }
      } else {
        // Render Light Mode Fire
        if (!fireCanvas || !fireCtx || fireCanvas.style.display === 'none') return;
        fireCtx.clearRect(0, 0, fireCanvas.width, fireCanvas.height);

        const now = performance.now();
        // Gentle dancing flicker when cursor is hovering or still
        if (mouseX > 0 && mouseY > 0 && (now - lastSpawnTime > 50)) {
          spawnFireParticles(mouseX, mouseY, 2, 5);
          lastSpawnTime = now;
        }

        fireCtx.save();
        fireCtx.scale(dpr, dpr);

        for (let i = fireParticles.length - 1; i >= 0; i--) {
          const p = fireParticles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy *= 0.98;
          p.vx *= 0.97;
          p.life -= p.decay;

          if (p.life <= 0) {
            fireParticles.splice(i, 1);
            continue;
          }

          const currentRadius = p.isSpark ? p.size : p.size * (0.4 + (1.0 - p.life) * 0.85);
          const alpha = Math.min(1.0, p.life * 1.25);

          if (p.isSpark) {
            // Embers and flying sparks
            fireCtx.beginPath();
            fireCtx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            fireCtx.fillStyle = `rgba(255, ${Math.floor(160 + p.life * 90)}, 40, ${alpha})`;
            fireCtx.shadowColor = '#ff6600';
            fireCtx.shadowBlur = 5;
            fireCtx.fill();
          } else {
            // Realistic flame ball
            const grad = fireCtx.createRadialGradient(
              p.x, p.y, 0,
              p.x, p.y, Math.max(1, currentRadius)
            );

            // Rich warm fire gradient clearly visible on light backgrounds
            grad.addColorStop(0, `rgba(255, 255, 180, ${alpha * 0.95})`);
            grad.addColorStop(0.25, `rgba(255, 160, 20, ${alpha * 0.85})`);
            grad.addColorStop(0.65, `rgba(230, 50, 10, ${alpha * 0.55})`);
            grad.addColorStop(1, `rgba(140, 10, 0, 0)`);

            fireCtx.beginPath();
            fireCtx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            fireCtx.fillStyle = grad;
            fireCtx.fill();
          }
        }

        fireCtx.restore();
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
          lastTime = performance.now() * 0.001;
          ripples.length = 0;
          fireParticles.length = 0;
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
      if (soundEnabled && isDarkMode()) {
        playWaterDropSound(intensity * 6);
      }
    },
  };
})();
