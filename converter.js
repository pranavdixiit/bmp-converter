// ============================================================
// converter.js: Browser-only JPG/PNG -> RGB565 (raw, display-ready)
// ============================================================

const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const previewBox = document.getElementById('previewBox');

const resolutionSelect = document.getElementById('resolutionSelect');
const customBox = document.getElementById('customBox');
const customW = document.getElementById('customW');
const customH = document.getElementById('customH');
const scaleModeSelect = document.getElementById('scaleMode');

let lastImage = null;

// ============================================================
// UI EVENTS
// ============================================================

resolutionSelect.addEventListener('change', () => {
  customBox.style.display =
    (resolutionSelect.value === 'custom') ? 'flex' : 'none';

  if (lastImage) {
    resizeCanvasToSelection();
    drawToCanvas();
  }
});

scaleModeSelect.addEventListener('change', () => {
  if (lastImage) drawToCanvas();
});

// Drag & Drop
dropArea.addEventListener('dragover', e => {
  e.preventDefault();
  dropArea.style.borderColor = 'rgba(255,255,255,0.28)';
});

dropArea.addEventListener('dragleave', () => {
  dropArea.style.borderColor = 'rgba(255,255,255,0.12)';
});

dropArea.addEventListener('drop', e => {
  e.preventDefault();
  dropArea.style.borderColor = 'rgba(255,255,255,0.12)';
  loadImage(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', e => {
  loadImage(e.target.files[0]);
});

// ============================================================
// HELPERS
// ============================================================

function getResolution() {
  if (resolutionSelect.value === 'custom') {
    const w = Math.max(1, parseInt(customW.value) || 160);
    const h = Math.max(1, parseInt(customH.value) || 80);
    return [w, h];
  }
  return resolutionSelect.value.split('x').map(Number);
}

function resizeCanvasToSelection() {
  const [w, h] = getResolution();
  canvas.width = w;
  canvas.height = h;
}

function loadImage(file) {
  if (!file) return;

  const img = new Image();
  resizeCanvasToSelection();

  img.onload = () => {
    lastImage = img;
    drawToCanvas();
    downloadBtn.style.display = 'inline-block';
    resetBtn.style.display = 'inline-block';
    previewBox.classList.add('loaded');
  };

  img.src = URL.createObjectURL(file);
}

function drawToCanvas() {
  if (!lastImage) return;

  const [w, h] = getResolution();
  const mode = scaleModeSelect.value || 'stretch';

  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  const img = lastImage;

  if (mode === 'stretch') {
    ctx.drawImage(img, 0, 0, w, h);
    return;
  }

  let drawW, drawH;
  let offX = 0, offY = 0;

  if (mode === 'fit') {
    const scale = Math.min(w / img.width, h / img.height);
    drawW = img.width * scale;
    drawH = img.height * scale;
  } else {
    const scale = Math.max(w / img.width, h / img.height);
    drawW = img.width * scale;
    drawH = img.height * scale;
  }

  offX = (w - drawW) / 2;
  offY = (h - drawH) / 2;

  ctx.drawImage(img, offX, offY, drawW, drawH);
}

// ============================================================
// RGB565 BUILDER (TOP-DOWN, NO HEADER)
// ============================================================

function makeRGB565(width, height, imageData) {
  const buffer = new ArrayBuffer(width * height * 2);
  const out = new Uint8Array(buffer);

  let p = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const b = imageData[i];


      const g = imageData[i + 1];
      const r = imageData[i + 2];

      const rgb565 =
        ((r & 0xF8) << 8) |
        ((g & 0xFC) << 3) |
        (b >> 3);

      // LOW byte first (ESP32 + TFT_eSPI compatible)

out[p++] = rgb565 >> 8;
      out[p++] = rgb565 & 0xFF;
    }
  }

  return new Blob([buffer], { type: "application/octet-stream" });
}

// ============================================================
// DOWNLOAD RGB565
// ============================================================

downloadBtn.addEventListener('click', () => {
  const [w, h] = getResolution();

  canvas.width = w;
  canvas.height = h;
  drawToCanvas();

  const imageData = ctx.getImageData(0, 0, w, h).data;
  const blob = makeRGB565(w, h, imageData);

  const fileName = `img_${w}x${h}.rgb565`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// ============================================================
// RESET
// ============================================================

resetBtn.addEventListener('click', () => {
  lastImage = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  downloadBtn.style.display = 'none';
  resetBtn.style.display = 'none';
  previewBox.classList.remove('loaded');
  fileInput.value = '';
});












