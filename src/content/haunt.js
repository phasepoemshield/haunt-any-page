// Content script: apply and restore haunt effect
// IIFE with idempotent guard

(function() {
  'use strict';
  
  if (window.__hauntAnyPage) return;
  
  let overlayElement = null;
  let weatherState = null;
  let weatherSettings = null;
  let pageChecksScheduled = false;
  let batElements = [];
  let batSimulationFrame = null;
  let fontFace = null;
  let originalDarkPage = false;
  let appliedOverlayKey = null;
  
  // Bat simulation state
  const bats = [];
  const BAT_COUNT = 6;
  
  // Grid for target selection (3x2)
  const targetGrid = { cols: 3, rows: 2, occupied: [] };
  
  // WCAG relative luminance of the first opaque background (body, then html).
  // A fully transparent background means the browser default: white.
  function backgroundLuminance(el) {
    const match = window.getComputedStyle(el).backgroundColor
      .match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/);
    if (!match) return null;
    const alpha = match[4] === undefined ? 1 : Number(match[4]);
    if (alpha < 0.5) return null;
    const lin = c => {
      c = Number(c) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(match[1]) + 0.7152 * lin(match[2]) + 0.0722 * lin(match[3]);
  }

  function detectDarkPage() {
    if (!document.body) return false;
    const html = document.documentElement;
    const wasOn = html.classList.contains('haunt-on');
    if (wasOn) html.classList.remove('haunt-on');
    const luminance = backgroundLuminance(document.body) ?? backgroundLuminance(html) ?? 1;
    if (wasOn) html.classList.add('haunt-on');
    return luminance < 0.2;
  }
  
  function apply(settings) {
    const html = document.documentElement;
    html.classList.add('haunt-on');
    
    // Detect dark page. At document_start there is no body yet, and the page's own
    // style sheets may not be loaded, so the answer is checked again once the page is ready.
    originalDarkPage = detectDarkPage();
    html.classList.toggle('haunt-dark-page', originalDarkPage);
    schedulePageChecks();
    syncWeatherTone();

    // Toggle effect classes
    html.classList.toggle('haunt-bats', settings.bats);
    html.classList.toggle('haunt-font', settings.font);
    html.classList.toggle('haunt-flicker', settings.flicker);
    
    // Load font
    if (settings.font && !fontFace && typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      const fontUrl = chrome.runtime.getURL('assets/fonts/IMFellDWPica-Regular.ttf');
      fontFace = new FontFace('Haunt Fell', `url("${fontUrl}")`);
      document.fonts.add(fontFace);
      fontFace.load().catch(err => console.warn('Haunt: font load failed', err));
    }
    
    // Build the overlay once; rebuild only when an effect is switched on or off.
    const overlayKey = [settings.bats, settings.flicker].join();
    if (!overlayElement) {
      createOverlay(settings);
      appliedOverlayKey = overlayKey;
    } else if (overlayKey !== appliedOverlayKey) {
      updateOverlay(settings);
      appliedOverlayKey = overlayKey;
    }
  }
  
  function createOverlay(settings) {
    overlayElement = document.createElement('haunt-any-page-overlay');
    overlayElement.setAttribute('aria-hidden', 'true');
    
    const shadow = overlayElement.attachShadow({ mode: 'closed' });
    
    // Create stylesheet
    const styles = createOverlayStyles(settings);
    shadow.adoptedStyleSheets = [styles];
    
    // Create bats
    if (settings.bats) {
      createBats(shadow);
      startBatSimulation();
    }
    
    // Create candle vignette
    const vignette = createVignette(settings.flicker);
    shadow.appendChild(vignette);
    
    document.documentElement.appendChild(overlayElement);
  }
  
  function updateOverlay(settings) {
    // Recreate overlay to update bats/flicker
    if (overlayElement) {
      stopBatSimulation();
      overlayElement.remove();
      overlayElement = null;
      batElements = [];
      bats.length = 0;
    }
    createOverlay(settings);
  }
  
  function createOverlayStyles(settings) {
    const sheet = new CSSStyleSheet();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    let css = `
      :host {
        all: initial;
        display: block;
        position: fixed;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
        z-index: 2147483647;
      }
      
      .bat {
        position: absolute;
        visibility: hidden;
        will-change: transform;
      }
      
      .bat.spawned {
        visibility: visible;
      }
      
      ${!settings.bats || reducedMotion ? '.bat { display: none; }' : ''}
      
      .vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%);
        opacity: 0.15;
        ${settings.flicker && !reducedMotion ? 'animation: candle-flicker 9s steps(1) infinite;' : ''}
      }
      
      ${settings.flicker && !reducedMotion ? `
      @keyframes candle-flicker {
        0%, 33% { opacity: 0.15; }
        34%, 36% { opacity: 0.105; }
        37%, 66% { opacity: 0.15; }
        67%, 68% { opacity: 0.12; }
        69%, 100% { opacity: 0.15; }
      }
      ` : ''}
    `;
    
    sheet.replaceSync(css);
    return sheet;
  }
  
  // ===== Weather: fog =====
  // Independent of the haunted skin: it has its own host element and shadow root, so it
  // works on a page that is not haunted and survives "Restore the page".
  // Three layers of fractal value noise are drawn once into small canvases. The noise
  // lattice wraps horizontally (period = base scale), so the 320px tile repeats without
  // a seam. Each canvas holds the tile twice side by side and drifts by exactly one tile.
  const FOG_PALETTES = {
    // Over a dark page (or a haunted one): pale bone wisps.
    dark: {
      alpha: 1,
      layers: [
        { cls: 'bone', rgb: [233, 227, 210], seed: 11, scale: 3, threshold: 0.36, h: 1.00, opacity: 0.55, secs: 110, reverse: false },
        { cls: 'cool', rgb: [207, 230, 223], seed: 23, scale: 4, threshold: 0.30, h: 0.75, opacity: 0.90, secs: 70, reverse: false },
        { cls: 'warm', rgb: [230, 216, 189], seed: 37, scale: 6, threshold: 0.34, h: 0.55, opacity: 0.80, secs: 45, reverse: true }
      ]
    },
    // Over a normal light page pale fog would be invisible, so the wisps are slate grey.
    // Higher thresholds keep clear gaps between them: fog, not a grey veil.
    light: {
      alpha: 0.7,
      layers: [
        { cls: 'bone', rgb: [98, 108, 122], seed: 11, scale: 3, threshold: 0.42, h: 1.00, opacity: 0.50, secs: 110, reverse: false },
        { cls: 'cool', rgb: [84, 100, 110], seed: 23, scale: 4, threshold: 0.38, h: 0.75, opacity: 0.80, secs: 70, reverse: false },
        { cls: 'warm', rgb: [112, 106, 98], seed: 37, scale: 6, threshold: 0.40, h: 0.55, opacity: 0.70, secs: 45, reverse: true }
      ]
    }
  };
  const FOG_TILE_W = 320;
  const FOG_TILE_H = 140;

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // Dark tone: the page behind the fog is dark. A haunted page always is: light pages are
  // inverted, and the host is counter-filtered in haunt.css so the fog keeps its true colors.
  function weatherTone() {
    if (document.documentElement.classList.contains('haunt-on')) return 'dark';
    return detectDarkPage() ? 'dark' : 'light';
  }

  const WEATHER_CSS = `
    :host { all: initial; }
    .fog-root { position: absolute; left: 0; right: 0; bottom: 0; }
    .fog-breathe { position: absolute; inset: 0; }
    .fog-layer { position: absolute; left: 0; bottom: 0; width: 200%; }
    .fog-layer canvas { display: block; width: 100%; height: 100%; }
    @keyframes fog-breathe { from { opacity: 1; } to { opacity: 0.7; } }
  `;

  function buildWeather(tone) {
    const host = document.createElement('haunt-any-page-weather');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed!important;inset:0!important;overflow:hidden!important;' +
      'pointer-events:none!important;z-index:2147483646!important;display:block!important;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(WEATHER_CSS);
    shadow.adoptedStyleSheets = [sheet];

    const root = document.createElement('div');
    root.className = 'fog-root';
    const breathe = document.createElement('div');
    breathe.className = 'fog-breathe';
    if (!prefersReducedMotion()) {
      breathe.style.animation = 'fog-breathe 12s ease-in-out infinite alternate';
    }
    root.appendChild(breathe);
    shadow.appendChild(root);

    weatherState = { host, root, breathe, tone: null, drifts: [] };
    fillFogLayers(tone);
    document.documentElement.appendChild(host);
  }

  function fillFogLayers(tone) {
    const state = weatherState;
    for (const drift of state.drifts) drift.cancel();
    state.drifts = [];
    state.breathe.replaceChildren();
    state.tone = tone;

    const palette = FOG_PALETTES[tone];
    for (const layer of palette.layers) {
      const div = document.createElement('div');
      div.className = `fog-layer ${layer.cls}`;
      // Layer heights are a share of the fog root, which the Height slider sizes.
      div.style.height = `${layer.h * 100}%`;
      div.style.opacity = String(layer.opacity);
      div.appendChild(createFogCanvas(layer, palette.alpha));
      state.breathe.appendChild(div);
      if (!prefersReducedMotion()) {
        const drift = div.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-50%)' }],
          { duration: layer.secs * 1000, iterations: Infinity, direction: layer.reverse ? 'reverse' : 'normal' }
        );
        state.drifts.push(drift);
      }
    }
  }

  // Density, speed and height are plain numbers written to inline styles and the
  // animations' playback rate, so moving a slider never rebuilds the canvases.
  function updateWeatherParams() {
    const w = weatherSettings;
    const state = weatherState;
    if (!w || !state) return;
    const density = Math.max(0, Math.min(100, Number(w.fogDensity)));
    const speed = Math.max(0, Math.min(100, Number(w.fogSpeed)));
    const height = Math.max(0, Math.min(100, Number(w.fogHeight)));
    // 1.35 keeps the default density at the look approved in the prototype.
    state.root.style.opacity = String(Math.min(1, (density / 100) * 1.35));
    state.root.style.height = `${(15 + 0.85 * height).toFixed(1)}%`;
    const rate = 0.25 + (speed / 100) * 1.5;
    for (const drift of state.drifts) drift.updatePlaybackRate(rate);
  }

  function renderWeather() {
    if (!weatherSettings || !weatherSettings.fog) return;
    // Before <body> exists the page's colors are unknown; wait for the page checks.
    if (!document.body) return;
    const tone = weatherTone();
    if (!weatherState) {
      buildWeather(tone);
    } else if (weatherState.tone !== tone) {
      fillFogLayers(tone);
    }
    if (!weatherState.host.isConnected) document.documentElement.appendChild(weatherState.host);
    updateWeatherParams();
  }

  function applyWeather(settings) {
    weatherSettings = { ...settings };
    if (!weatherSettings.fog) {
      removeWeather();
      return;
    }
    schedulePageChecks();
    renderWeather();
  }

  function removeWeather() {
    if (weatherState) {
      for (const drift of weatherState.drifts) drift.cancel();
      weatherState.host.remove();
      weatherState = null;
    }
  }

  // The haunted skin can be switched on or off while fog is up; the fog tone follows it.
  function syncWeatherTone() {
    if (weatherState) renderWeather();
  }

  // Re-detect dark pages once the document and its style sheets are ready, and once
  // more shortly after for pages that switch to a dark theme in a script.
  function refreshPageTone() {
    const html = document.documentElement;
    if (html.classList.contains('haunt-on')) {
      originalDarkPage = detectDarkPage();
      html.classList.toggle('haunt-dark-page', originalDarkPage);
    }
    renderWeather();
  }

  function schedulePageChecks() {
    if (pageChecksScheduled) return;
    pageChecksScheduled = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refreshPageTone, { once: true });
    }
    if (document.readyState !== 'complete') {
      window.addEventListener('load', refreshPageTone, { once: true });
    }
    setTimeout(refreshPageTone, 1500);
  }

  function createFogCanvas(layer, alphaScale) {
    const w = FOG_TILE_W;
    const h = FOG_TILE_H;
    const canvas = document.createElement('canvas');
    canvas.width = w * 2;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(w, h);
    const data = image.data;
    const [r, g, b] = layer.rgb;

    for (let y = 0; y < h; y++) {
      // Denser towards the bottom, and fading to nothing over the top 35% of the layer
      // so shorter layers have no hard upper edge.
      const t = Math.min(1, y / (h * 0.35));
      const ground = (0.35 + 0.65 * Math.pow(y / h, 1.3)) * (t * t * (3 - 2 * t));
      for (let x = 0; x < w; x++) {
        let noise = 0;
        let amplitude = 0.5;
        let norm = 0;
        let freq = 1;
        for (let octave = 0; octave < 5; octave++) {
          const period = layer.scale * freq;
          noise += amplitude * periodicNoise(
            (x / w) * period,
            (y / h) * period * (h / w) * 2,
            period,
            layer.seed + octave
          );
          norm += amplitude;
          amplitude *= 0.5;
          freq *= 2;
        }
        noise /= norm;
        const a = Math.max(0, Math.min(1, (noise - layer.threshold) / (1 - layer.threshold)));
        const i = (y * w + x) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = Math.round(255 * Math.pow(a, 1.1) * ground * alphaScale);
      }
    }

    ctx.putImageData(image, 0, 0);
    ctx.putImageData(image, w, 0);
    return canvas;
  }

  function latticeValue(x, y, seed) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // Value noise whose lattice repeats every `period` cells in x.
  function periodicNoise(x, y, period, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const wrap = v => ((v % period) + period) % period;
    const a = latticeValue(wrap(xi), yi, seed);
    const b = latticeValue(wrap(xi + 1), yi, seed);
    const c = latticeValue(wrap(xi), yi + 1, seed);
    const d = latticeValue(wrap(xi + 1), yi + 1, seed);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function createBats(shadow) {
    for (let i = 0; i < BAT_COUNT; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('bat');
      svg.setAttribute('viewBox', '-50 -50 100 100');
      svg.style.position = 'absolute';
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', '#120e0c');
      path.setAttribute('stroke', 'rgba(233,227,210,0.22)');
      path.setAttribute('stroke-width', '0.8');
      
      svg.appendChild(path);
      shadow.appendChild(svg);
      batElements.push(svg);
      
      // Initialize bat state
      const span = 46 + Math.random() * 34; // 46-80px
      bats.push({
        svg,
        path,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        tilt: 0,
        phase: Math.random() * Math.PI * 2,
        frequency: (4.2 + Math.random() * 1.4) * Math.sqrt(60 / span),
        span,
        opacity: 0.5 + span / 130,
        cruise: (90 + Math.random() * 60) * (span / 60),
        targetX: 0,
        targetY: 0,
        targetsReached: 0,
        nextDartTime: 0,
        spawnDelay: i * 1.1,
        spawned: false,
        respawnTimer: 0
      });
    }
  }
  
  function startBatSimulation() {
    if (batSimulationFrame) return;
    
    let lastTime = performance.now();
    
    function simulate() {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      
      // Update each bat
      for (const bat of bats) {
        // Spawn delay
        if (!bat.spawned) {
          bat.spawnDelay -= dt;
          if (bat.spawnDelay <= 0) {
            bat.spawned = true;
            bat.svg.classList.add('spawned');
            spawnBat(bat, vw, vh);
          }
          continue;
        }
        
        // Respawn timer
        if (bat.respawnTimer > 0) {
          bat.respawnTimer -= dt;
          if (bat.respawnTimer <= 0) {
            spawnBat(bat, vw, vh);
          }
          continue;
        }
        
        // Physics
        bat.phase += bat.frequency * dt * 2 * Math.PI;
        
        // Wingbeat lift
        const ay = -520 * Math.max(0, Math.cos(bat.phase)) + 165; // net sink of 165
        
        // Steering toward target
        const dx = bat.targetX - bat.x;
        const dy = bat.targetY - bat.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 50) {
          // Reached target
          bat.targetsReached++;
          if (bat.targetsReached >= 3 + Math.floor(Math.random() * 3)) {
            // Fly away and respawn
            pickEdgeTarget(bat, vw, vh, true);
            bat.targetsReached = 0;
          } else {
            pickTarget(bat, vw, vh);
          }
        } else {
          const dirX = dx / dist;
          const dirY = dy / dist;
          bat.vx += dirX * bat.cruise * 1.6 * dt;
          bat.vy += dirY * bat.cruise * 1.6 * dt;
        }
        
        // Erratic dart
        if (now / 1000 > bat.nextDartTime) {
          const dartAngle = Math.atan2(bat.vy, bat.vx) + (0.8 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1);
          const dartSpeed = 60 + Math.random() * 90;
          bat.vx += Math.cos(dartAngle) * dartSpeed;
          bat.vy += Math.sin(dartAngle) * dartSpeed;
          bat.nextDartTime = now / 1000 + 0.18 + Math.random() * 0.42;
        }
        
        bat.vy += ay * dt;
        
        // Speed cap
        const speed = Math.sqrt(bat.vx * bat.vx + bat.vy * bat.vy);
        const maxSpeed = bat.cruise * 1.8;
        if (speed > maxSpeed) {
          bat.vx *= maxSpeed / speed;
          bat.vy *= maxSpeed / speed;
        }
        
        // Separation
        for (const other of bats) {
          if (other === bat || !other.spawned || other.respawnTimer > 0) continue;
          const dx2 = other.x - bat.x;
          const dy2 = other.y - bat.y;
          const d = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d < 180 && d > 0) {
            const force = 520 * (1 - d / 180);
            bat.vx -= (dx2 / d) * force * dt;
            bat.vy -= (dy2 / d) * force * dt;
          }
        }
        
        // Update position
        bat.x += bat.vx * dt;
        bat.y += bat.vy * dt;
        
        // Tilt
        bat.tilt = Math.max(-0.45, Math.min(0.45, bat.vx / (2.2 * bat.cruise)));
        
        // Check if far outside viewport
        if (bat.x < -200 || bat.x > vw + 200 || bat.y < -200 || bat.y > vh + 200) {
          if (bat.targetsReached === 0) {
            // Lost, respawn immediately
            spawnBat(bat, vw, vh);
          } else {
            // Intentional exit, wait before respawn
            bat.svg.classList.remove('spawned');
            bat.respawnTimer = 0.8 + Math.random() * 2.7;
          }
        }
        
        // Render
        renderBat(bat);
      }
      
      batSimulationFrame = requestAnimationFrame(simulate);
    }
    
    batSimulationFrame = requestAnimationFrame(simulate);
  }
  
  function spawnBat(bat, vw, vh) {
    // Spawn from edge (cycle through 4 edges)
    const edge = bats.indexOf(bat) % 4;
    if (edge === 0) { // top
      bat.x = Math.random() * vw;
      bat.y = -100;
    } else if (edge === 1) { // right
      bat.x = vw + 100;
      bat.y = Math.random() * vh;
    } else if (edge === 2) { // bottom
      bat.x = Math.random() * vw;
      bat.y = vh + 100;
    } else { // left
      bat.x = -100;
      bat.y = Math.random() * vh;
    }
    
    bat.vx = 0;
    bat.vy = 0;
    bat.targetsReached = 0;
    bat.svg.classList.add('spawned');
    bat.respawnTimer = 0;
    
    pickTarget(bat, vw, vh);
  }
  
  function pickTarget(bat, vw, vh) {
    // Pick a cell in the grid that's not occupied
    const cells = [];
    for (let row = 0; row < targetGrid.rows; row++) {
      for (let col = 0; col < targetGrid.cols; col++) {
        const cell = row * targetGrid.cols + col;
        if (!targetGrid.occupied.includes(cell)) {
          cells.push(cell);
        }
      }
    }
    
    if (cells.length === 0) {
      // All occupied, pick random
      bat.targetX = Math.random() * vw;
      bat.targetY = Math.random() * vh;
      return;
    }
    
    const cell = cells[Math.floor(Math.random() * cells.length)];
    targetGrid.occupied.push(cell);
    
    setTimeout(() => {
      const idx = targetGrid.occupied.indexOf(cell);
      if (idx > -1) targetGrid.occupied.splice(idx, 1);
    }, 2000);
    
    const col = cell % targetGrid.cols;
    const row = Math.floor(cell / targetGrid.cols);
    
    bat.targetX = (col + Math.random()) * (vw / targetGrid.cols);
    bat.targetY = (row + Math.random()) * (vh / targetGrid.rows);
  }
  
  function pickEdgeTarget(bat, vw, vh, far) {
    // Pick a point far outside viewport
    const edge = Math.floor(Math.random() * 4);
    const margin = far ? 400 : 100;
    if (edge === 0) { // top
      bat.targetX = Math.random() * vw;
      bat.targetY = -margin;
    } else if (edge === 1) { // right
      bat.targetX = vw + margin;
      bat.targetY = Math.random() * vh;
    } else if (edge === 2) { // bottom
      bat.targetX = Math.random() * vw;
      bat.targetY = vh + margin;
    } else { // left
      bat.targetX = -margin;
      bat.targetY = Math.random() * vh;
    }
  }
  
  function renderBat(bat) {
    // Position and rotation
    bat.svg.style.left = `${bat.x - 50}px`;
    bat.svg.style.top = `${bat.y - 50}px`;
    bat.svg.style.width = `${bat.span}px`;
    bat.svg.style.height = `${bat.span}px`;
    bat.svg.style.opacity = bat.opacity;
    bat.svg.style.transform = `rotate(${bat.tilt}rad) scale(${bat.span / 72})`;
    
    // Build path
    const phi = bat.phase;
    const arm = -0.95 * Math.sin(phi);
    const hand = -0.75 * Math.sin(phi - 0.9);
    const fold = 0.42 * Math.max(0, Math.cos(phi - 0.3));
    
    const body = 'M0 -5C3.6 -5 4 -1 3.6 3C3.2 7 1.6 9 0 9C-1.6 9 -3.2 7 -3.6 3C-4 -1 -3.6 -5 0 -5Z' +
                 'M3.2 -7.5a3.2 3.2 0 1 1 -6.4 0a3.2 3.2 0 1 1 6.4 0Z' +
                 'M1.2 -9.6L3.4 -14.2L3.1 -8.4ZM-1.2 -9.6L-3.4 -14.2L-3.1 -8.4Z' +
                 'M1.2 8.4L2.4 11L0.6 9.6ZM-1.2 8.4L-2.4 11L-0.6 9.6Z';
    
    // Right wing skeleton
    const shoulder = { x: 3, y: -3 };
    const elbow = rotatePoint(11, -7, shoulder, arm);
    const wrist = rotatePoint(19, -9, shoulder, arm);
    const tips = [
      rotatePoint(36, -3, shoulder, arm),
      rotatePoint(30, 5, shoulder, arm),
      rotatePoint(20, 8, shoulder, arm)
    ];
    
    // Apply hand rotation and fold
    tips.forEach(tip => {
      const dx = tip.x - wrist.x;
      const dy = tip.y - wrist.y;
      const angle = hand;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rx = dx * cos - dy * sin;
      const ry = dx * sin + dy * cos;
      tip.x = wrist.x + rx * (1 - fold);
      tip.y = wrist.y + ry * (1 - fold);
    });
    
    const hip = { x: 4, y: 6 };
    
    // Right wing path
    const rightWing = `M${shoulder.x} ${shoulder.y}L${elbow.x} ${elbow.y}L${wrist.x} ${wrist.y}L${tips[0].x} ${tips[0].y}` +
                      `Q${(tips[0].x + tips[1].x) / 2 + (tips[1].x - wrist.x) * 0.38} ${(tips[0].y + tips[1].y) / 2 + (tips[1].y - wrist.y) * 0.38} ${tips[1].x} ${tips[1].y}` +
                      `Q${(tips[1].x + tips[2].x) / 2 + (tips[2].x - wrist.x) * 0.38} ${(tips[1].y + tips[2].y) / 2 + (tips[2].y - wrist.y) * 0.38} ${tips[2].x} ${tips[2].y}` +
                      `Q${(tips[2].x + hip.x) / 2 + (hip.x - wrist.x) * 0.38} ${(tips[2].y + hip.y) / 2 + (hip.y - wrist.y) * 0.38} ${hip.x} ${hip.y}Z`;
    
    // Left wing (mirrored)
    const leftWing = rightWing.replace(/x/g, '~').replace(/-/g, '+').replace(/\+/g, '-').replace(/~/g, 'x')
      .replace(/M([\d.-]+)/g, (m, n) => `M${-parseFloat(n)}`)
      .replace(/L([\d.-]+)/g, (m, n) => `L${-parseFloat(n)}`)
      .replace(/Q([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)/g, (m, x1, y, x2) => `Q${-parseFloat(x1)} ${y} ${-parseFloat(x2)}`)
      .replace(/Z/g, 'Z');
    
    bat.path.setAttribute('d', body + rightWing + leftWing);
  }
  
  function rotatePoint(x, y, pivot, angle) {
    const dx = x - pivot.x;
    const dy = y - pivot.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos
    };
  }
  
  function stopBatSimulation() {
    if (batSimulationFrame) {
      cancelAnimationFrame(batSimulationFrame);
      batSimulationFrame = null;
    }
    bats.length = 0;
  }
  
  function createVignette(flicker) {
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    return vignette;
  }
  
  function restore() {
    const html = document.documentElement;
    html.classList.remove('haunt-on', 'haunt-bats', 'haunt-font', 'haunt-flicker', 'haunt-dark-page');
    if (html.classList.length === 0) {
      html.removeAttribute('class');
    }
    
    if (overlayElement) {
      stopBatSimulation();
      overlayElement.remove();
      overlayElement = null;
      batElements = [];
    }
    appliedOverlayKey = null;
    syncWeatherTone();

    if (fontFace) {
      document.fonts.delete(fontFace);
      fontFace = null;
    }
  }
  
  // Message listener
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'haunt:apply') {
        apply(message.settings);
        sendResponse({ success: true });
      } else if (message.type === 'haunt:restore') {
        restore();
        sendResponse({ success: true });
      } else if (message.type === 'weather:apply') {
        applyWeather(message.weather);
        sendResponse({ success: true });
      } else if (message.type === 'weather:status') {
        sendResponse({ fog: Boolean(weatherState) });
      } else if (message.type === 'haunt:status') {
        sendResponse({ haunted: document.documentElement.classList.contains('haunt-on') });
      }
    });
  }

  // If loaded by registerContentScripts (page still loading), apply from stored settings.
  // Content scripts cannot import src/shared/settings.js (it is not web-accessible and
  // must stay that way), so read chrome.storage.local directly. Keep these defaults in
  // sync with DEFAULTS in src/shared/settings.js.
  if (document.readyState === 'loading' && typeof chrome !== 'undefined' && chrome.storage?.local) {
    (async () => {
      try {
        const defaults = { bats: true, font: true, flicker: false };
        const weatherDefaults = { fog: false, fogDensity: 55, fogSpeed: 50, fogHeight: 60 };
        const stored = await chrome.storage.local.get(['defaults', 'sites']);
        const site = stored.sites?.[location.origin] || {};
        const settings = { ...(stored.defaults || defaults), ...site };
        if (settings.haunted && settings.remember) {
          apply(settings);
        }
        const weather = { ...weatherDefaults, ...(site.weather || {}) };
        if (weather.fog && settings.remember) {
          applyWeather(weather);
        }
      } catch (error) {
        console.warn('Haunt: could not load remembered settings', error);
      }
    })();
  }
  
  window.__hauntAnyPage = { apply, restore, applyWeather, removeWeather };
})();
