// converter.js: Browser-only JPG/PNG -> 24-bit BMP

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

resolutionSelect.addEventListener('change', () => {
  if (resolutionSelect.value === 'custom') {
    customBox.style.display = 'flex';
  } else {
    customBox.style.display = 'none';
  }
  if (lastImage) {
    resizeCanvasToSelection();
    drawToCanvas();
  }
});

scaleModeSelect.addEventListener('change', () => lastImage && drawToCanvas());

// Drag/drop UX
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
fileInput.addEventListener('change', e => loadImage(e.target.files[0]));

// ===== Helpers =====

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

  let drawW, drawH, offX, offY;

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

// ===== Download BMP =====

downloadBtn.addEventListener('click', () => {
  const [w, h] = getResolution();

  canvas.width = w;
  canvas.height = h;
  drawToCanvas();

  const imageData = ctx.getImageData(0, 0, w, h).data;
  const blob = makeBMP(w, h, imageData);

  const fileName = `img_${Date.now()}.bmp`;

  const url = window.URL.createObjectURL(
      new Blob([blob], { type: "application/octet-stream" })
  );

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});



// ===== Reset =====

resetBtn.addEventListener('click', () => {
  lastImage = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  downloadBtn.style.display = 'none';
  resetBtn.style.display = 'none';
  previewBox.classList.remove('loaded');
  fileInput.value = '';
});

// ===== BMP Builder (24-bit, bottom-up, BGR) =====

// ===== BMP Builder (RGB565, Little Endian, TFT READY) =====
function makeBMP(width, height, imageData) {

  const bytesPerPixel = 3;
  const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const dataSize = rowStride * height;
  const fileSize = 54 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const dv = new DataView(buffer);
  let p = 0;

  // ===== BMP HEADER =====
  dv.setUint8(p++, 0x42); // B
  dv.setUint8(p++, 0x4D); // M
  dv.setUint32(p, fileSize, true); p += 4;
  dv.setUint32(p, 0, true); p += 4;
  dv.setUint32(p, 54, true); p += 4;

  // ===== DIB HEADER =====
  dv.setUint32(p, 40, true); p += 4;
  dv.setInt32(p, width, true); p += 4;
  dv.setInt32(p, height, true); p += 4;
  dv.setUint16(p, 1, true); p += 2;
  dv.setUint16(p, 24, true); p += 2; // ✅ 24-bit
  dv.setUint32(p, 0, true); p += 4;
  dv.setUint32(p, dataSize, true); p += 4;
  dv.setUint32(p, 2835, true); p += 4;
  dv.setUint32(p, 2835, true); p += 4;
  dv.setUint32(p, 0, true); p += 4;
  dv.setUint32(p, 0, true); p += 4;

  // ===== PIXELS (BOTTOM-UP, BGR) =====
  let offset = 54;

  for (let y = height - 1; y >= 0; y--) {
    let rowStart = offset;

    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      dv.setUint8(offset++, imageData[i + 2]); // B
      dv.setUint8(offset++, imageData[i + 1]); // G
      dv.setUint8(offset++, imageData[i]);     // R
    }

    // Padding
    while (offset - rowStart < rowStride) {
      dv.setUint8(offset++, 0);
    }
  }

  return new Blob([buffer], { type: "image/bmp" });
}

