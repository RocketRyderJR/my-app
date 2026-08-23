// ---------- Kaleidoscope Studio ----------
// Plain HTML/CSS/JS. No frameworks, no build step.

(() => {
  // --- Elements ---
  const canvas = document.getElementById('art');
  const ctx = canvas.getContext('2d');

  const symmetryInput = document.getElementById('symmetry');
  const symmetryValue = document.getElementById('symmetryValue');
  const brushSizeInput = document.getElementById('brushSize');
  const brushSizeValue = document.getElementById('brushSizeValue');
  const hueShiftInput = document.getElementById('hueShift');
  const hueShiftValue = document.getElementById('hueShiftValue');
  const colorInput = document.getElementById('color');

  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');
  const galleryEl = document.getElementById('gallery');
  const emptyMsg = document.getElementById('emptyMsg');

  // --- State ---
  const state = {
    drawing: false,
    lastPoint: null,
    shiftMode: false,
    shiftStart: null,
    hueOffset: 0,
    currentHue: 0,
    baseColor: '#ff5577',
  };

  // Init canvas with a subtle background wash
  function initCanvas() {
    ctx.fillStyle = '#0b0820';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // --- Helpers ---
  function hexToHsl(hex) {
    const m = hex.replace('#', '');
    const bigint = parseInt(m.length === 3
      ? m.split('').map(c => c + c).join('')
      : m, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }

  function hslToCss(h, s, l, a = 1) {
    return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${a})`;
  }

  // Draw a stroke from p0 to p1, mirrored `slices` times around the canvas center.
  function drawSymmetricStroke(p0, p1, options = {}) {
    const slices = parseInt(symmetryInput.value, 10);
    const brush = parseInt(brushSizeInput.value, 10);
    const hueShift = parseFloat(hueShiftInput.value);
    const angleStep = (Math.PI * 2) / slices;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const [h0, s, l] = hexToHsl(state.baseColor);

    for (let i = 0; i < slices; i++) {
      const angle = i * angleStep;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x0 = cos * (p0.x - cx) - sin * (p0.y - cy) + cx;
      const y0 = sin * (p0.x - cx) + cos * (p0.y - cy) + cy;
      const x1 = cos * (p1.x - cx) - sin * (p1.y - cy) + cx;
      const y1 = sin * (p1.x - cx) + cos * (p1.y - cy) + cy;

      // Each slice gets a tiny hue offset so the pattern has subtle color variety.
      const hue = (h0 + state.hueOffset + (i * hueShift)) % 360;

      ctx.strokeStyle = hslToCss(hue, s, l, 0.95);
      ctx.lineWidth = brush;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Accumulate hue so subsequent strokes drift through the color wheel.
    state.hueOffset = (state.hueOffset + hueShift * 0.15) % 360;
  }

  // --- Pointer / mouse handling ---
  function getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    state.drawing = true;
    const p = getPoint(e);
    state.lastPoint = p;
    if (e.shiftKey) {
      state.shiftMode = true;
      state.shiftStart = p;
    } else {
      state.shiftMode = false;
    }
    // Paint a single dot so a tap leaves a mark
    drawSymmetricStroke(p, p);
  }

  function moveDraw(e) {
    if (!state.drawing) return;
    e.preventDefault();
    const p = getPoint(e);
    const target = (e.shiftKey && state.shiftStart) ? state.shiftStart : p;
    drawSymmetricStroke(state.lastPoint, target);
    state.lastPoint = target;
  }

  function endDraw(e) {
    if (!state.drawing) return;
    state.drawing = false;
    state.lastPoint = null;
    state.shiftStart = null;
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', moveDraw);
  window.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', moveDraw, { passive: false });
  canvas.addEventListener('touchend', endDraw);
  canvas.addEventListener('touchcancel', endDraw);

  // --- Keyboard shortcuts ---
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      state.baseColor = randomColor();
      colorInput.value = state.baseColor;
    }
  });

  function randomColor() {
    const h = Math.floor(Math.random() * 360);
    return `hsl(${h}, 80%, 60%)`.toHslHex();
  }

  // Convert an HSL string back to a hex value usable by the color input.
  String.prototype.toHslHex = function () {
    const m = this.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!m) return '#ff5577';
    const h = +m[1] / 360, s = +m[2] / 100, l = +m[3] / 100;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // --- Controls ---
  symmetryInput.addEventListener('input', () => symmetryValue.textContent = symmetryInput.value);
  brushSizeInput.addEventListener('input', () => brushSizeValue.textContent = brushSizeInput.value);
  hueShiftInput.addEventListener('input', () => hueShiftValue.textContent = hueShiftInput.value);
  colorInput.addEventListener('input', () => {
    state.baseColor = colorInput.value;
    state.hueOffset = 0;
  });

  // --- Clear ---
  clearBtn.addEventListener('click', () => {
    initCanvas();
    state.hueOffset = 0;
  });

  // --- Save PNG + Gallery (localStorage) ---
  const STORAGE_KEY = 'kaleidoscope_gallery_v1';

  function loadGallery() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function persistGallery(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function renderGallery() {
    const items = loadGallery();
    galleryEl.innerHTML = '';
    if (items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.innerHTML = 'No saves yet. Tap <strong>Save PNG</strong> on the studio to add a piece here.';
      galleryEl.appendChild(empty);
      return;
    }
    items.forEach((item, idx) => {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = item.dataUrl;
      img.alt = `Saved piece from ${new Date(item.savedAt).toLocaleString()}`;

      const cap = document.createElement('figcaption');
      const label = document.createElement('span');
      label.textContent = new Date(item.savedAt).toLocaleDateString();
      const dl = document.createElement('a');
      dl.textContent = 'Download';
      dl.href = item.dataUrl;
      dl.download = `kaleidoscope-${item.savedAt}.png`;
      dl.style.color = 'inherit';

      const del = document.createElement('button');
      del.textContent = 'Delete';
      del.addEventListener('click', () => {
        const remaining = loadGallery().filter((_, i) => i !== idx);
        persistGallery(remaining);
        renderGallery();
      });

      cap.appendChild(label);
      cap.appendChild(dl);
      cap.appendChild(del);
      fig.appendChild(img);
      fig.appendChild(cap);
      galleryEl.appendChild(fig);
    });
  }

  saveBtn.addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const items = loadGallery();
    items.unshift({ dataUrl, savedAt: Date.now() });
    // Cap gallery size to avoid blowing out localStorage
    persistGallery(items.slice(0, 24));
    renderGallery();
    // Flash feedback by jumping to gallery
    location.hash = '#page-gallery';
  });

  // --- Init ---
  initCanvas();
  renderGallery();
})();
