/**
 * Unified 3D WebGL Fluid Water Engine for Andrey Hong Portfolio
 * Features:
 * - Real 3D liquid water surface covering Header (.nav) and Hero (.hero) seamlessly
 * - 3D Surface Normal mapping, Blinn-Phong specular glints, Fresnel, and dynamic caustics
 * - Interactive 3D water ripples on every cursor movement across Header or Hero
 * - Dark Mode: Deep obsidian crystal pool with neon-lime (#d4ff5f) & cyan highlights (85% peak opacity)
 * - Light Mode: Crisp oceanic turquoise liquid surface with specular sheen
 * - Silky smooth, organic wave dynamics ("jangan terlalu beriak tapi smooth")
 */

(function () {
  'use strict';

  const MAX_RIPPLES = 28;
  const ripples = [];
  let lastX = null;
  let lastY = null;
  let lastTime = 0;
  let animFrameId = null;
  let idleTimer = null;

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

      const baseFreq = 440 + Math.random() * 180;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.0, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.14);

      const vol = Math.min(0.08, 0.02 + intensity * 0.04);
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

  function isDarkMode() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme) return theme === 'dark';
    return !document.documentElement.classList.contains('light');
  }

  // Create unified canvas spanning Header + Hero
  let canvas = null;
  let heroEl = null;
  let navEl = null;

  function initCanvas() {
    heroEl = document.querySelector('.hero');
    navEl = document.querySelector('.nav');
    if (!heroEl) return false;

    // Ensure hero has relative positioning
    heroEl.style.position = 'relative';

    // Remove any legacy duplicate canvases if present
    const oldHeroCanvas = document.getElementById('hero-water-canvas');
    if (oldHeroCanvas) oldHeroCanvas.remove();
    const oldNavCanvas = document.getElementById('nav-water-canvas');
    if (oldNavCanvas) oldNavCanvas.remove();

    canvas = document.getElementById('water-ripple-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'water-ripple-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = `
        position: absolute;
        top: -82px;
        left: 0;
        width: 100%;
        height: calc(100% + 82px);
        pointer-events: none;
        z-index: 1;
        opacity: 0.85;
        transition: opacity 0.4s ease;
        display: block;
      `;
      heroEl.prepend(canvas);
    }

    // Make nav semi-transparent glass so 3D water flows underneath seamlessly
    if (navEl) {
      navEl.style.background = isDarkMode()
        ? 'rgba(11, 12, 13, 0.68)'
        : 'rgba(244, 244, 238, 0.72)';
      navEl.style.backdropFilter = 'blur(14px)';
      navEl.style.webkitBackdropFilter = 'blur(14px)';
    }

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

    function updateTheme() {
      if (!canvas) return;
      const dark = isDarkMode();
      canvas.style.opacity = dark ? '0.85' : '0.80';
      if (navEl) {
        navEl.style.background = dark
          ? 'rgba(11, 12, 13, 0.68)'
          : 'rgba(244, 244, 238, 0.72)';
      }
    }

    const themeObserver = new MutationObserver(() => updateTheme());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    updateTheme();

    /* ==========================================================================
       3D WebGL Shader Engine
       ========================================================================== */
    let gl = null;
    let program = null;
    let uResolution, uTime, uRipples, uRippleParams, uRippleCount, uIsDark, uMouse, uMouseActive;

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
      uniform vec3 u_ripples[${MAX_RIPPLES}]; // xy: uv, z: birthTime
      uniform vec3 u_rippleParams[${MAX_RIPPLES}]; // x: intensity, y: speed, z: wavelength
      uniform int u_rippleCount;
      uniform float u_isDark;
      uniform vec2 u_mouse;
      uniform float u_mouseActive;

      void main() {
        float aspect = u_resolution.x / u_resolution.y;
        vec2 p = vec2(v_uv.x * aspect, v_uv.y);

        // 1. Organic calm 3D water swell (smooth, glassy, continuous)
        float t = u_time * 0.75;
        float w1 = sin(p.x * 2.4 + t * 0.7) * cos(p.y * 2.1 + t * 0.5) * 0.016;
        float w2 = sin(p.x * 3.8 - t * 0.45 + p.y * 2.8) * 0.011;
        float w3 = cos(p.x * 1.5 + p.y * 4.2 + t * 0.8) * 0.009;
        float h = w1 + w2 + w3;

        // Analytical gradient for resting 3D surface
        vec2 grad = vec2(
          cos(p.x * 2.4 + t * 0.7) * 2.4 * cos(p.y * 2.1 + t * 0.5) * 0.016 +
          cos(p.x * 3.8 - t * 0.45 + p.y * 2.8) * 3.8 * 0.011 -
          sin(p.x * 1.5 + p.y * 4.2 + t * 0.8) * 1.5 * 0.009,

          -sin(p.x * 2.4 + t * 0.7) * sin(p.y * 2.1 + t * 0.5) * 2.1 * 0.016 +
          cos(p.x * 3.8 - t * 0.45 + p.y * 2.8) * 2.8 * 0.011 -
          sin(p.x * 1.5 + p.y * 4.2 + t * 0.8) * 4.2 * 0.009
        );

        // 2. Interactive 3D Cursor Waves (Dynamic Ripples)
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          if (i >= u_rippleCount) break;
          vec2 c = vec2(u_ripples[i].x * aspect, u_ripples[i].y);
          float birth = u_ripples[i].z;
          float age = u_time - birth;
          if (age < 0.0 || age > 2.5) continue;

          float intensity = u_rippleParams[i].x;
          float speed = u_rippleParams[i].y;
          float wavelength = u_rippleParams[i].z;

          float d = distance(p, c);
          float waveFront = age * speed;
          float diff = d - waveFront;

          // Smooth Gaussian packet envelope
          float width = 0.08 + age * 0.055;
          float envelope = exp(-(diff * diff) / (2.0 * width * width));
          float decay = exp(-age * 1.65) / (sqrt(d + 0.16));

          float k = 6.2831853 / wavelength;
          float wave = sin(diff * k) * envelope * decay * intensity;
          h += wave;

          vec2 dir = (d > 0.0005) ? normalize(p - c) : vec2(0.0);
          float dWave = cos(diff * k) * k * envelope * decay * intensity;
          grad += dir * dWave;
        }

        // Real-time cursor liquid glow & displacement
        if (u_mouseActive > 0.5) {
          vec2 mPos = vec2(u_mouse.x * aspect, u_mouse.y);
          float mDist = distance(p, mPos);
          float mGlow = exp(-(mDist * mDist) / (2.0 * 0.045 * 0.045)) * 0.016;
          h += mGlow;
          if (mDist > 0.001) {
            grad += normalize(p - mPos) * (-mGlow * 24.0);
          }
        }

        // 3. 3D Surface Normal with strong relief multiplier
        vec3 normal = normalize(vec3(-grad.x * 4.6, -grad.y * 4.6, 1.0));

        // 4. 3D Lighting (Key light, Fill light, Blinn-Phong specular, Fresnel, Caustics)
        vec3 lightDir1 = normalize(vec3(-0.45, 0.60, 0.82));
        vec3 lightDir2 = normalize(vec3(0.55, -0.30, 0.75));
        vec3 viewDir = vec3(0.0, 0.0, 1.0);

        vec3 half1 = normalize(lightDir1 + viewDir);
        vec3 half2 = normalize(lightDir2 + viewDir);

        float spec1 = pow(max(dot(normal, half1), 0.0), 34.0);
        float spec2 = pow(max(dot(normal, half2), 0.0), 18.0) * 0.45;
        float spec = spec1 + spec2;

        float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.8);
        float caustic = pow(abs(h) * 26.0, 1.30);

        vec3 finalColor;
        float alpha;

        if (u_isDark > 0.5) {
          // Dark Mode: Deep obsidian liquid with neon-lime (#d4ff5f) & cyan crystalline glints
          vec3 deepBase = vec3(0.05, 0.07, 0.08);
          vec3 limeAccent = vec3(0.83, 1.0, 0.37);
          vec3 aquaGlow = vec3(0.18, 0.90, 0.82);
          vec3 specWhite = vec3(0.98, 1.0, 0.96);

          vec3 body = mix(deepBase, aquaGlow, clamp(caustic * 0.55 + fresnel * 0.40, 0.0, 1.0));
          body = mix(body, limeAccent, clamp(spec * 0.45 + h * 3.8, 0.0, 1.0));
          finalColor = body + specWhite * spec * 1.15;

          // Clear 3D presence: base resting 0.28, rising to 0.85 on ripples and specular crests
          alpha = clamp(0.26 + spec * 1.45 + caustic * 0.50 + fresnel * 0.32 + abs(h) * 4.5, 0.0, 0.85);
        } else {
          // Light Mode: Clean oceanic turquoise liquid surface
          vec3 shallowAqua = vec3(0.12, 0.68, 0.62);
          vec3 brightAqua = vec3(0.24, 0.86, 0.76);
          vec3 glint = vec3(1.0, 1.0, 1.0);

          vec3 body = mix(shallowAqua, brightAqua, clamp(caustic * 0.65 + fresnel * 0.45, 0.0, 1.0));
          finalColor = mix(body, glint, spec * 0.75);

          alpha = clamp(0.22 + spec * 1.20 + caustic * 0.40 + fresnel * 0.28 + abs(h) * 3.8, 0.0, 0.78);
        }

        gl_FragColor = vec4(finalColor, alpha);
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
            uMouse = gl.getUniformLocation(program, 'u_mouse');
            uMouseActive = gl.getUniformLocation(program, 'u_mouseActive');

            gl.enable(gl.BLEND);
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
          }
        }
      }
    } catch (err) {
      console.warn('WebGL init fallback:', err);
      useWebGL = false;
    }

    let ctx2d = null;
    if (!useWebGL) {
      ctx2d = canvas.getContext('2d');
    }

    /* ==========================================================================
       Resizing
       ========================================================================== */
    let canvasWidth = 0;
    let canvasHeight = 0;
    let dpr = 1;

    function onResize() {
      if (!canvas || !heroEl) return;
      const rect = heroEl.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasWidth = Math.max(rect.width, 320);
      canvasHeight = Math.max(rect.height + 82, 480);

      canvas.width = Math.floor(canvasWidth * dpr);
      canvas.height = Math.floor(canvasHeight * dpr);

      if (useWebGL && gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    }
    window.addEventListener('resize', onResize, { passive: true });
    onResize();

    /* ==========================================================================
       Ripple Management
       ========================================================================== */
    let mouseUVX = -1;
    let mouseUVY = -1;
    let isMouseActive = false;

    function addRipple(localX, localY, intensity = 0.026, speed = 0.38, wavelength = 0.075) {
      if (canvasWidth <= 0 || canvasHeight <= 0) return;
      const now = performance.now() * 0.001;
      const uvX = localX / canvasWidth;
      const uvY = 1.0 - (localY / canvasHeight);

      if (ripples.length >= MAX_RIPPLES) {
        ripples.shift();
      }
      ripples.push({
        x: uvX,
        y: uvY,
        localX: localX,
        localY: localY,
        birth: now,
        intensity: Math.min(0.065, intensity),
        speed: speed,
        wavelength: wavelength,
      });
    }

    // Get pointer coordinates relative to the unified top canvas (spanning nav + hero)
    function getCanvasCoordinates(e) {
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
      }
      return null;
    }

    function onPointerMove(e) {
      const coords = getCanvasCoordinates(e);
      if (!coords) {
        isMouseActive = false;
        return;
      }

      initAudio();
      isMouseActive = true;
      mouseUVX = coords.x / canvasWidth;
      mouseUVY = 1.0 - (coords.y / canvasHeight);

      const x = coords.x;
      const y = coords.y;
      const now = performance.now() * 0.001;

      if (lastX !== null && lastY !== null) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx, dy);
        const dt = now - lastTime;

        // Controlled, smooth ripple threshold: responds reliably without chaos
        if (dist > 12 && dt > 0.02) {
          const speedFactor = Math.min(dist / (dt * 1000), 2.0);
          const intensity = 0.022 + speedFactor * 0.014;
          const waveSpeed = 0.36 + speedFactor * 0.06;
          const wavelength = 0.072 + Math.random() * 0.012;

          addRipple(x, y, intensity, waveSpeed, wavelength);

          if (dist > 75 && Math.random() < 0.16) {
            playWaterDropSound(speedFactor * 0.35);
          }

          lastX = x;
          lastY = y;
          lastTime = now;
        }
      } else {
        lastX = x;
        lastY = y;
        lastTime = now;
        addRipple(x, y, 0.026, 0.38, 0.075);
      }

      resetIdleTimer();
    }

    function onPointerDown(e) {
      const coords = getCanvasCoordinates(e);
      if (!coords) return;
      initAudio();
      const x = coords.x;
      const y = coords.y;

      // Generates a crisp, elegant 3D splash ripple on click
      addRipple(x, y, 0.048, 0.44, 0.082);
      setTimeout(() => addRipple(x, y, 0.032, 0.36, 0.07), 80);
      playWaterDropSound(0.55);
      resetIdleTimer();
    }

    function onPointerLeave() {
      isMouseActive = false;
      lastX = null;
      lastY = null;
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });

    // Idle ambient ripple: gentle droplet when user stops interacting
    function resetIdleTimer() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(triggerAmbientDrop, 3600);
    }

    function triggerAmbientDrop() {
      if (canvasWidth > 0 && canvasHeight > 0) {
        const rx = canvasWidth * (0.2 + Math.random() * 0.6);
        const ry = canvasHeight * (0.2 + Math.random() * 0.6);
        addRipple(rx, ry, 0.020, 0.32, 0.075);
        if (Math.random() < 0.3) {
          playWaterDropSound(0.2);
        }
      }
      resetIdleTimer();
    }
    resetIdleTimer();

    /* ==========================================================================
       Render Loop
       ========================================================================== */
    function render() {
      animFrameId = requestAnimationFrame(render);
      const now = performance.now() * 0.001;
      const dark = isDarkMode();

      // Prune expired ripples
      while (ripples.length > 0 && (now - ripples[0].birth) > 2.6) {
        ripples.shift();
      }

      if (useWebGL && gl && program) {
        gl.useProgram(program);

        gl.uniform2f(uResolution, canvas.width, canvas.height);
        gl.uniform1f(uTime, now);
        gl.uniform1f(uIsDark, dark ? 1.0 : 0.0);
        gl.uniform2f(uMouse, mouseUVX, mouseUVY);
        gl.uniform1f(uMouseActive, isMouseActive ? 1.0 : 0.0);

        const count = ripples.length;
        gl.uniform1i(uRippleCount, count);

        if (count > 0) {
          const rippleData = new Float32Array(MAX_RIPPLES * 3);
          const paramData = new Float32Array(MAX_RIPPLES * 3);

          for (let i = 0; i < count; i++) {
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
        }

        gl.clearColor(0.0, 0.0, 0.0, 0.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      } else if (ctx2d) {
        // High quality 2D Canvas Fallback
        ctx2d.clearRect(0, 0, canvas.width, canvas.height);
        ctx2d.save();
        ctx2d.scale(dpr, dpr);

        for (let i = 0; i < ripples.length; i++) {
          const r = ripples[i];
          const age = now - r.birth;
          if (age < 0 || age > 2.2) continue;

          const progress = age / 2.2;
          const radius = progress * canvasWidth * 0.42;
          const alpha = (1 - progress) * r.intensity * 12;

          ctx2d.beginPath();
          ctx2d.arc(r.localX, r.localY, radius, 0, Math.PI * 2);
          ctx2d.lineWidth = 1.8 + progress * 2;

          if (dark) {
            ctx2d.strokeStyle = `rgba(212, 255, 95, ${Math.min(0.85, alpha)})`;
            ctx2d.shadowColor = 'rgba(212, 255, 95, 0.5)';
            ctx2d.shadowBlur = 10;
          } else {
            ctx2d.strokeStyle = `rgba(20, 140, 122, ${Math.min(0.78, alpha)})`;
            ctx2d.shadowColor = 'rgba(32, 185, 160, 0.4)';
            ctx2d.shadowBlur = 10;
          }
          ctx2d.stroke();
          ctx2d.shadowBlur = 0;
        }

        ctx2d.restore();
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
