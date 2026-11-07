// Content script: apply and restore haunt effect
// IIFE with idempotent guard

(function() {
  'use strict';
  
  if (window.__hauntAnyPage) return;
  
  let overlayElement = null;
  let fogCanvases = null;
  let batElements = [];
  let batSimulationFrame = null;
  let fontFace = null;
  let originalDarkPage = false;
  
  // Bat simulation state
  const bats = [];
  const BAT_COUNT = 6;
  
  // Grid for target selection (3x2)
  const targetGrid = { cols: 3, rows: 2, occupied: [] };
  
  function detectDarkPage() {
    if (!document.body) return false;
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return false;
    const [, r, g, b] = match.map(Number);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5;
  }
  
  function apply(settings) {
    const html = document.documentElement;
    html.classList.add('haunt-on');
    
    // Detect dark page
    if (document.body) {
      originalDarkPage = detectDarkPage();
    } else {
      const observer = new MutationObserver(() => {
        if (document.body) {
          originalDarkPage = detectDarkPage();
          html.classList.toggle('haunt-dark-page', originalDarkPage);
          observer.disconnect();
        }
      });
      observer.observe(html, { childList: true });
    }
    html.classList.toggle('haunt-dark-page', originalDarkPage);
    
    // Toggle effect classes
    html.classList.toggle('haunt-fog', settings.fog);
    html.classList.toggle('haunt-bats', settings.bats);
    html.classList.toggle('haunt-font', settings.font);
    html.classList.toggle('haunt-flicker', settings.flicker);
    
    // Set fog density
    if (settings.fog && typeof settings.fogDensity === 'number') {
      html.style.setProperty('--haunt-fog', (settings.fogDensity / 100).toFixed(2));
    }
    
    // Load font
    if (settings.font && !fontFace) {
      const fontUrl = chrome.runtime.getURL('assets/fonts/IMFellDWPica-Regular.ttf');
      fontFace = new FontFace('Haunt Fell', `url("${fontUrl}")`);
      document.fonts.add(fontFace);
      fontFace.load().catch(err => console.warn('Haunt: font load failed', err));
    }
    
    // Create overlay once
    if (!overlayElement) {
      createOverlay(settings);
    } else {
      updateOverlay(settings);
    }
  }
  
  function createOverlay(settings) {
    overlayElement = document.createElement('haunt-any-page-overlay');
    overlayElement.setAttribute('aria-hidden', 'true');
    
    const shadow = overlayElement.attachShadow({ mode: 'closed' });
    
    // Create stylesheet
    const styles = createOverlayStyles(settings);
    shadow.adoptedStyleSheets = [styles];
    
    // Create fog layers
    if (settings.fog) {
      const fogContainer = createFogLayers();
      shadow.appendChild(fogContainer);
    }
    
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
    // Recreate overlay to update fog/bats visibility
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
      
      .fog-container {
        position: absolute;
        inset: 0;
        opacity: ${settings.fog ? 'var(--fog-opacity, 0.55)' : '0'};
        ${reducedMotion ? '' : 'animation: fog-breathe 12s ease-in-out infinite alternate;'}
      }
      
      .fog-layer {
        position: absolute;
        inset: 0;
        width: 200%;
        height: 100%;
        ${reducedMotion ? '' : 'animation-timing-function: linear; animation-iteration-count: infinite;'}
      }
      
      .fog-layer.bone { ${reducedMotion ? '' : 'animation: fog-drift 110s linear infinite;'} }
      .fog-layer.cool { ${reducedMotion ? '' : 'animation: fog-drift 70s linear infinite;'} }
      .fog-layer.warm { ${reducedMotion ? '' : 'animation: fog-drift 45s linear infinite reverse;'} }
      
      .fog-layer canvas {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      
      ${reducedMotion ? '' : `
      @keyframes fog-drift {
        from { transform: translateX(0); }
        to { transform: translateX(-50%); }
      }
      
      @keyframes fog-breathe {
        from { opacity: var(--fog-opacity, 0.55); }
        to { opacity: calc(var(--fog-opacity, 0.55) * 0.7); }
      }
      `}
      
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
  
  function createFogLayers() {
    if (fogCanvases) return fogCanvases.container;
    
    const container = document.createElement('div');
    container.className = 'fog-container';
    
    // Three fog layers: bone, cool, warm
    const layers = [
      { class: 'bone', color: '#e9e3d2', seed: 3, freq: 0.36, threshold: 0, height: 1.0 },
      { class: 'cool', color: '#cfe6df', seed: 4, freq: 0.30, threshold: 0, height: 0.75 },
      { class: 'warm', color: '#e6d8bd', seed: 6, freq: 0.34, threshold: 0, height: 0.55 }
    ];
    
    fogCanvases = { container, canvases: [] };
    
    for (const layer of layers) {
      const div = document.createElement('div');
      div.className = `fog-layer ${layer.class}`;
      
      const canvas = createFogCanvas(layer);
      div.appendChild(canvas);
      container.appendChild(div);
      fogCanvases.canvases.push(canvas);
    }
    
    return container;
  }
  
  function createFogCanvas(layer) {
    const canvas = document.createElement('canvas');
    const width = 640; // 320px tile repeated twice
    const height = 140;
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Value noise with 5 octaves
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const xNorm = (x % 320) / 320; // periodic in x
        const yNorm = y / height;
        
        let noise = 0;
        let amplitude = 1;
        let frequency = layer.freq;
        let maxValue = 0;
        
        for (let octave = 0; octave < 5; octave++) {
          noise += valueNoise(xNorm * frequency + layer.seed, yNorm * frequency + layer.seed) * amplitude;
          maxValue += amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        noise /= maxValue;
        
        // Alpha based on threshold and y gradient
        let alpha = (noise - layer.threshold) / (1 - layer.threshold);
        alpha = Math.max(0, Math.min(1, alpha));
        alpha = Math.pow(alpha, 1.1);
        
        // Denser near bottom
        const yGradient = 0.35 + 0.65 * Math.pow(yNorm, 1.3);
        alpha *= yGradient;
        
        // Only render if in height range
        if (yNorm > layer.height) {
          alpha = 0;
        }
        
        const idx = (y * width + x) * 4;
        const rgb = hexToRgb(layer.color);
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        data[idx + 3] = alpha * 255;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }
  
  // Simple value noise
  function valueNoise(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    const xf = x - X;
    const yf = y - Y;
    
    const a = hash(X, Y);
    const b = hash(X + 1, Y);
    const c = hash(X, Y + 1);
    const d = hash(X + 1, Y + 1);
    
    const u = fade(xf);
    const v = fade(yf);
    
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  
  function hash(x, y) {
    let h = x * 374761393 + y * 668265263;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = (h ^ (h >>> 16));
    return (h & 0x7fffffff) / 0x7fffffff;
  }
  
  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
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
    html.classList.remove('haunt-on', 'haunt-fog', 'haunt-bats', 'haunt-font', 'haunt-flicker', 'haunt-dark-page');
    html.style.removeProperty('--haunt-fog');
    
    if (overlayElement) {
      stopBatSimulation();
      overlayElement.remove();
      overlayElement = null;
      fogCanvases = null;
      batElements = [];
    }
    
    if (fontFace) {
      document.fonts.delete(fontFace);
      fontFace = null;
    }
  }
  
  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'haunt:apply') {
      apply(message.settings);
      sendResponse({ success: true });
    } else if (message.type === 'haunt:restore') {
      restore();
      sendResponse({ success: true });
    }
  });
  
  // If loaded by registerContentScripts, apply from stored settings
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      const { loadSite, originOf } = await import(chrome.runtime.getURL('src/shared/settings.js'));
      const origin = originOf(location.href);
      if (!origin) return;
      
      const settings = await loadSite(origin);
      if (settings.haunted && settings.remember) {
        apply(settings);
      }
    });
  }
  
  window.__hauntAnyPage = { apply, restore };
})();
