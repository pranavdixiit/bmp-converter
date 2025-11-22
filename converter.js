// converter.js: Browser-only JPG/PNG -> 24-bit BMP, with presets, fit/fill/stretch, and soft UI hooks.

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
scaleModeSelect && scaleModeSelect.addEventListener('change', () => lastImage && drawToCanvas());

// Drag/drop UX
dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.style.borderColor = 'rgba(255,255,255,0.28)'; });
dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = 'rgba(255,255,255,0.12)'; });
dropArea.addEventListener('drop', e => {
  e.preventDefault();
  dropArea.style.borderColor = 'rgba(255,255,255,0.12)';
  loadImage(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => loadImage(e.target.files[0]));

// helpers
function getResolution(){
  if (resolutionSelect.value === 'custom') {
    const w = Math.max(1, parseInt(customW.value) || 160);
    const h = Math.max(1, parseInt(customH.value) || 80);
    return [w, h];
  }
  return resolutionSelect.value.split('x').map(Number);
}

function resizeCanvasToSelection(){
  const [w,h] = getResolution();
  canvas.width = w;
  canvas.height = h;
}

function loadImage(file){
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

function drawToCanvas(){
  if (!lastImage) return;
  const [w,h] = getResolution();
  const mode = (scaleModeSelect && scaleModeSelect.value) || 'stretch';
  canvas.width = w;
  canvas.height = h;
  ctx.clearRect(0,0,w,h);

  // compute draw dims
  const img = lastImage;
  if (mode === 'stretch') {
    ctx.drawImage(img,0,0,w,h);
    return;
  }
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let drawW, drawH, offX, offY;

  if (mode === 'fit'){
    const scale = Math.min(w / img.width, h / img.height);
    drawW = img.width * scale;
    drawH = img.height * scale;
    offX = (w - drawW) / 2;
    offY = (h - drawH) / 2;
  } else { // fill
    const scale = Math.max(w / img.width, h / img.height);
    drawW = img.width * scale;
    drawH = img.height * scale;
    offX = (w - drawW) / 2;
    offY = (h - drawH) / 2;
  }
  ctx.drawImage(img, offX, offY, drawW, drawH);
}

// download BMP
downloadBtn.addEventListener('click', () => {
  const blob = makeBMP();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const [w,h] = getResolution();
  a.href = url;
  a.download = `image_${w}x${h}.bmp`;
  a.click();
  URL.revokeObjectURL(url);
});

// reset
resetBtn.addEventListener('click', () => {
  lastImage = null;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  downloadBtn.style.display = 'none';
  resetBtn.style.display = 'none';
  previewBox.classList.remove('loaded');
  fileInput.value = '';
});

// BMP builder (24-bit top-down)
function makeBMP(){
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0,0,w,h).data;
  const rowSize = w * 3;
  const imageSize = rowSize * h;
  const fileSize = 54 + imageSize;

  const buffer = new ArrayBuffer(fileSize);
  const dv = new DataView(buffer);

  dv.setUint8(0,0x42);
  dv.setUint8(1,0x4D);
  dv.setUint32(2,fileSize,true);
  dv.setUint32(10,54,true);
  dv.setUint32(14,40,true);
  dv.setUint32(18,w,true);
  dv.setInt32(22,-h,true); // negative -> top-down
  dv.setUint16(26,1,true);
  dv.setUint16(28,24,true);

  let offset = 54;
  for (let i=0;i<imgData.length;i+=4){
    dv.setUint8(offset++, imgData[i+2]); // B
    dv.setUint8(offset++, imgData[i+1]); // G
    dv.setUint8(offset++, imgData[i]);   // R
  }

  return new Blob([buffer], {type:'image/bmp'});
}
