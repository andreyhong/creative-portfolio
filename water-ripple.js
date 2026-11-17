/**
 * Water Ripple & Fluid Wave Engine for Andrey Hong Portfolio
 * Confined strictly to Header & Hero section with calm, elegant, silky wave dynamics.
 * Non-overwhelming: subtle, tranquil ripples that react to mouse movements inside hero/header.
 */

(function () {
  'use strict';

  const MAX_RIPPLES = 24;
  const ripples = [];
  let lastX = null;
  let lastY = null;
  let lastTime = 0;
  let idleTimer = null;
  let animFrameId = null;

  // Sound generator using Web Audio API
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

      const baseFreq = 420 + Math.random() * 200;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.14);

      const vol = Math.min(0.12, 0.03 + intensity * 0.05);
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

  // Create canvas container attached to Hero section
  let canvas = null;
  let heroEl = null;

  function initCanvas() {
    heroEl = document.querySelector('.hero');
    if (!heroEl) return false;

    // Ensure hero has relative positioning
    heroEl.style.position = 'relative';

    canvas = document.createElement('canvas');
    canvas.id = 'water-ripple-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = `
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

    // Prepend to hero so it sits on hero background behind content
    heroEl.prepend(canvas);
    return true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEngine);
  } else {
    setupEngine();
  }

  function setupEngine() {
    if (!initCanvas()) {
      setTimeout(setupEngine, 50);
      return;
    }

    function isDarkMode() {
      const theme = document.documentElement.getAttribute('data-theme');
      if (theme) return theme === 'dark';
      return !document.documentElement.classList.contains('light');
    }

    function updateCanvasTheme() {
      if (!canvas) return;
      if (isDarkMode()) {
        canvas.style.mixBlendMode = 'screen';
        canvas.style.opacity = '0.85';
      } else {
        canvas.style.mixBlendMode = 'multiply';
        canvas.style.opacity = '0.55';
      }
    }

    const themeObserver = new MutationObserver(() => updateCanvasTheme());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    updateCanvasTheme();

    // WebGL Shader Setup
    let gl = null;
    let program = null;
    let uResolution, uTime, uRipples, uRippleParams, uRippleCount, uIsDark;

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
      uniform vec3 u_ripples[${MAX_RIPPLES}]; // xy: center in uv, z: birthTime
      uniform vec3 u_rippleParams[${MAX_RIPPLES}]; // x: intensity, y: speed, z: wavelength
      uniform int u_rippleCount;
      uniform float u_isDark;

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = vec2(v_uv.x * aspect, v_uv.y);

        float h = 0.0;
        vec2 grad = vec2(0.0);

        // Calm, gentle ambient surface shimmer
        float amb = sin(p.x * 3.5 + u_time * 0.6) * cos(p.y * 3.5 + u_time * 0.5) * 0.004;
        h += amb;

        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          if (i >= u_rippleCount) break;
          vec2 c = vec2(u_ripples[i].x * aspect, u_ripples[i].y);
          float birth = u_ripples[i].z;
          float age = u_time - birth;
          if (age < 0.0 || age > 2.2) continue;

          float intensity = u_rippleParams[i].x;
          float speed = u_rippleParams[i].y;
          float wavelength = u_rippleParams[i].z;

          float d = distance(p, c);
          float waveFront = age * speed;
          float diff = d - waveFront;

          // Soft Gaussian packet envelope (calm & silky)
          float width = 0.09 + age * 0.05;
          float envelope = exp(- (diff * diff) / (2.0 * width * width));
          float decay = exp(-age * 2.3) / (sqrt(d + 0.15));

          float k = 6.2831853 / wavelength;
          float wave = sin(diff * k) * envelope * decay * intensity;
          h += wave;

          vec2 dir = (d > 0.0005) ? normalize(p - c) : vec2(0.0);
          float dWave = cos(diff * k) * k * envelope * decay * intensity;
          grad += dir * dWave;
        }

        vec3 normal = normalize(vec3(-grad.x * 2.0, -grad.y * 2.0, 1.0));
        vec3 lightDir = normalize(vec3(-0.35, 0.45, 0.82));
        vec3 viewDir = vec3(0.0, 0.0, 1.0);
        vec3 halfDir = normalize(lightDir + viewDir);

        float spec = pow(max(dot(normal, halfDir), 0.0), 30.0);
        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
        float caustic = pow(abs(h) * 22.0, 1.35);

        vec3 color;
        float alpha;

        if (u_isDark > 0.5) {
          // Elegant dark mode: neon-lime accent (#d4ff5f) + crystalline water highlight
          vec3 limeAccent = vec3(0.83, 1.0, 0.37);
          vec3 waterWhite = vec3(0.96, 0.99, 1.0);
          vec3 deepCyan = vec3(0.15, 0.8, 0.75);

          color = mix(limeAccent, waterWhite, spec * 0.65);
          color = mix(color, deepCyan, caustic * 0.25);

          alpha = clamp(spec * 1.5 + caustic * 0.45 + fresnel * 0.2 + abs(h) * 1.8, 0.0, 0.75);
        } else {
          // Light mode: Oceanic turquoise sheen
          vec3 inkShimmer = vec3(0.15, 0.45, 0.4);
          vec3 lightGlint = vec3(0.28, 0.68, 0.55);

          color = mix(inkShimmer, lightGlint, spec);
          alpha = clamp(spec * 1.3 + caustic * 0.35 + fresnel * 0.18 + abs(h) * 1.4, 0.0, 0.65);
        }

        gl_FragColor = vec4(color, alpha);
      }
    `;

    let useWebGL = false;
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
      if (gl) {
        const compile = (type, src) => {
          const s = gl.createShader(type);
          gl.shaderSource(s, src);
          gl.compileShader(s);
          if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn(gl.getShaderInfoLog(s));
            return null;
          }
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
            uIsDark = gl.getUniformLocation(program, 'u_isDark');

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          }
        }
      }
    } catch (err) {
      console.warn('WebGL init failed, using Canvas 2D fallback:', err);
      useWebGL = false;
    }

    let ctx2d = null;
    if (!useWebGL) {
      ctx2d = canvas.getContext('2d');
    }

    // Resize handler confined to Hero element dimensions
    let width = 0;
    let height = 0;
    let dpr = 1;

    function onResize() {
      if (!canvas || !heroEl) return;
      const rect = heroEl.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 320);
      height = Math.max(rect.height, 400);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      if (useWebGL && gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    function addRipple(localX, localY, intensity = 0.025, speed = 0.38, wavelength = 0.075) {
      const now = performance.now() * 0.001;
      const uvX = localX / width;
      const uvY = 1.0 - (localY / height);

      if (ripples.length >= MAX_RIPPLES) {
        ripples.shift();
      }
      ripples.push({
        x: uvX,
        y: uvY,
        screenX: localX,
        screenY: localY,
        birth: now,
        intensity: Math.min(0.06, intensity),
        speed: speed,
        wavelength: wavelength,
      });
    }

    // Check if pointer is inside Header or Hero
    function getHeroCoordinates(e) {
      if (!heroEl) return null;
      const heroRect = heroEl.getBoundingClientRect();
      const navEl = document.querySelector('.nav');
      const navRect = navEl ? navEl.getBoundingClientRect() : null;

      const clientX = e.clientX;
      const clientY = e.clientY;

      // Allow navigation bar interactions to emit ripples into top of hero
      if (navRect && clientY >= navRect.top && clientY <= navRect.bottom && clientX >= navRect.left && clientX <= navRect.right) {
        return {
          x: clientX - heroRect.left,
          y: Math.max(0, clientY - heroRect.top),
        };
      }

      // Check hero bounds
      if (clientY >= heroRect.top && clientY <= heroRect.bottom && clientX >= heroRect.left && clientX <= heroRect.right) {
        return {
          x: clientX - heroRect.left,
          y: clientY - heroRect.top,
        };
      }

      return null;
    }

    // Pointer move in Header/Hero
    function onPointerMove(e) {
      const coords = getHeroCoordinates(e);
      if (!coords) return; // Outside header/hero: do nothing!

      initAudio();
      const x = coords.x;
      const y = coords.y;
      const now = performance.now() * 0.001;

      if (lastX !== null && lastY !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const dt = now - lastTime;

        // Controlled, calm threshold so it doesn't become overly turbulent
        if (dist > 18 && dt > 0.024) {
          const speed = Math.min(dist / (dt * 1000), 1.8);
          const intensity = 0.018 + speed * 0.015;
          const waveSpeed = 0.35 + speed * 0.08;
          const wavelength = 0.07 + Math.random() * 0.015;

          addRipple(x, y, intensity, waveSpeed, wavelength);

          if (dist > 65 && Math.random() < 0.15) {
            playWaterDropSound(speed * 0.4);
          }

          lastX = x;
          lastY = y;
          lastTime = now;
        }
      } else {
        lastX = x;
        lastY = y;
        lastTime = now;
        addRipple(x, y, 0.025, 0.35, 0.075);
      }

      resetIdleTimer();
    }

    function onPointerDown(e) {
      const coords = getHeroCoordinates(e);
      if (!coords) return;

      initAudio();
      const x = coords.x;
      const y = coords.y;

      // Gentle droplet splash in hero
      addRipple(x, y, 0.065, 0.42, 0.08);
      setTimeout(() => addRipple(x, y, 0.04, 0.36, 0.07), 80);

      playWaterDropSound(0.8);
      resetIdleTimer();
    }

    function resetIdleTimer() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(triggerAmbientDrop, 4500);
    }

    function triggerAmbientDrop() {
      if (document.hidden || !heroEl) return;
      const rect = heroEl.getBoundingClientRect();
      // Only trigger if hero is somewhat visible in viewport
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;

      const rx = width * (0.2 + Math.random() * 0.6);
      const ry = height * (0.2 + Math.random() * 0.6);
      addRipple(rx, ry, 0.035, 0.32, 0.08);
      playWaterDropSound(0.3);
      idleTimer = setTimeout(triggerAmbientDrop, 5000 + Math.random() * 3000);
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    resetIdleTimer();

    // Render loop
    function render() {
      animFrameId = requestAnimationFrame(render);

      const now = performance.now() * 0.001;

      while (ripples.length > 0 && (now - ripples[0].birth) > 2.2) {
        ripples.shift();
      }

      const dark = isDarkMode() ? 1.0 : 0.0;

      if (useWebGL && gl && program) {
        gl.useProgram(program);
        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, now);
        gl.uniform1f(uIsDark, dark);
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
      } else if (ctx2d) {
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.save();
        ctx2d.scale(dpr, dpr);

        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          const age = now - r.birth;
          if (age < 0 || age > 2.2) continue;

          const currentR = age * r.speed * width * 0.65;
          const fade = Math.max(0, 1 - (age / 2.2));

          ctx2d.beginPath();
          ctx2d.arc(r.screenX, r.screenY, currentR, 0, Math.PI * 2);
          ctx2d.lineWidth = 1.8 + age * 2.5;

          if (dark > 0.5) {
            ctx2d.strokeStyle = `rgba(212, 255, 95, ${fade * r.intensity * 3.5})`;
          } else {
            ctx2d.strokeStyle = `rgba(32, 108, 98, ${fade * r.intensity * 3.0})`;
          }
          ctx2d.stroke();
        }
        ctx2d.restore();
      }
    }

    animFrameId = requestAnimationFrame(render);
  }

  // Optimize battery and GPU: pause animation loop when tab is hidden
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
        animFrameId = requestAnimationFrame(render);
      }
    }
  });

  // Handle WebGL context loss gracefully
  if (canvas) {
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      useWebGL = false;
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    }, false);

    canvas.addEventListener('webglcontextrestored', () => {
      setupEngine();
    }, false);
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
      if (canvas && heroEl) {
        const rect = heroEl.getBoundingClientRect();
        const localX = x - rect.left;
        const localY = y - rect.top;
        if (localY >= 0 && localY <= rect.height) {
          playWaterDropSound(intensity * 8);
        }
      }
    },
  };
})();
