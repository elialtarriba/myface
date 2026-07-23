const DOM = {
    upload: document.getElementById('image-upload'),
    canvasContainer: document.getElementById('canvas-container'),
    mainCanvas: document.getElementById('main-canvas'),
    originalCanvas: document.getElementById('original-canvas'),
    placeholder: document.getElementById('placeholder-text'),
    
    // Sliders
    sBrightness: document.getElementById('adj-brightness'),
    sContrast: document.getElementById('adj-contrast'),
    sTemp: document.getElementById('adj-temperature'),
    sBW: document.getElementById('adj-bw'),
    sWrinkles: document.getElementById('ai-wrinkles'),
    sBlur: document.getElementById('ai-blur'),
    sBrushSize: document.getElementById('brush-size'),
    
    // Values displays
    vBrightness: document.getElementById('val-brightness'),
    vContrast: document.getElementById('val-contrast'),
    vTemp: document.getElementById('val-temperature'),
    vWrinkles: document.getElementById('val-wrinkles'),
    vBlur: document.getElementById('val-blur'),
    vBrushSize: document.getElementById('val-brush-size'),
    
    // Buttons
    btnCompare: document.getElementById('btn-compare'),
    btnCopy: document.getElementById('btn-copy'),
    btnSave: document.getElementById('btn-save'),
    btnExit: document.getElementById('btn-exit'),
    btnClone: document.getElementById('tool-clone'),
    btnIlluminate: document.getElementById('tool-illuminate'),
    btnCrop: document.getElementById('tool-crop'),
    
    // UI Elements
    themeSelector: document.getElementById('theme-selector'),
    brushSettings: document.getElementById('brush-settings'),
    cropSettings: document.getElementById('crop-settings'),
    toolCursor: document.getElementById('tool-cursor'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    aiWarning: document.getElementById('ai-warning'),
    
    // Crop Elements
    cropOverlay: document.getElementById('crop-overlay'),
    cropBox: document.getElementById('crop-box'),
    cropRatio: document.getElementById('crop-ratio'),
    btnApplyCrop: document.getElementById('btn-apply-crop'),
    btnCancelCrop: document.getElementById('btn-cancel-crop'),
    
    // Export Settings
    exportFormat: document.getElementById('export-format'),
    exportQualityContainer: document.getElementById('export-quality-container'),
    exportQuality: document.getElementById('export-quality'),
    valExportQuality: document.getElementById('val-export-quality')
};

const ctx = DOM.mainCanvas.getContext('2d', { willReadFrequently: true });
const origCtx = DOM.originalCanvas.getContext('2d');

// State
let img = new Image();
let originalImageData = null;
let currentImageData = null;
let hasImage = false;

// Tool state
let currentTool = null; // 'clone', 'illuminate', 'crop', null
let isDrawing = false;
let cloneSource = null;
let lastPointerPos = null;

// Crop state
let cropRect = { x: 0, y: 0, w: 100, h: 100 };
let isDraggingCrop = false;
let dragHandle = null; // 'box', 'top-left', 'bottom-right', etc.
let cropDragStart = { x: 0, y: 0 };

// AI Models
let imageSegmenter = null;
let faceLandmarker = null;
let aiMasks = { background: null, face: null };
let aiLoaded = false;

// --- Initialization ---

async function initAIModels() {
    try {
        const vision = await import('./lib/vision_bundle.js');
        const { FilesetResolver, ImageSegmenter, FaceLandmarker } = vision;
        
        DOM.loadingOverlay.classList.remove('hidden');
        DOM.loadingText.textContent = 'Cargando modelos de IA locales...';
        
        // Usar los archivos WebAssembly locales
        const visionResolver = await FilesetResolver.forVisionTasks("./wasm/");

        // Usar el modelo local selfie_segmenter
        imageSegmenter = await ImageSegmenter.createFromOptions(visionResolver, {
            baseOptions: {
                modelAssetPath: "./models/selfie_segmenter.tflite",
                delegate: "GPU"
            },
            outputCategoryMask: true,
            outputConfidenceMasks: false
        });

        // Usar el modelo local face_landmarker
        faceLandmarker = await FaceLandmarker.createFromOptions(visionResolver, {
            baseOptions: {
                modelAssetPath: "./models/face_landmarker.task",
                delegate: "GPU"
            },
            outputFaceBlendshapes: false,
            runningMode: "IMAGE",
            numFaces: 1
        });

        console.log("Modelos locales cargados");
        aiLoaded = true;
        DOM.loadingOverlay.classList.add('hidden');
    } catch (e) {
        console.warn("Error al cargar modelos IA (probablemente abierto desde file:// sin servidor):", e);
        DOM.aiWarning.classList.remove('hidden');
        DOM.loadingOverlay.classList.add('hidden');
    }
}

// Start loading models in background
initAIModels();


// --- Image Loading ---

function loadImage(url) {
    const tempImg = new Image();
    tempImg.crossOrigin = "Anonymous";
    tempImg.onload = () => {
        // Redimensionar imágenes enormes de móviles para no bloquear la IA ni la memoria
        const MAX_SIZE = 1920;
        let w = tempImg.width;
        let h = tempImg.height;
        
        if (w > MAX_SIZE || h > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
            
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const tCtx = canvas.getContext('2d');
            tCtx.drawImage(tempImg, 0, 0, w, h);
            
            img = new Image();
            img.onload = finishLoading;
            img.src = canvas.toDataURL('image/jpeg', 0.9);
        } else {
            img = tempImg;
            finishLoading();
        }
    };
    tempImg.src = url;
}

async function finishLoading() {
    setupCanvases();
    DOM.placeholder.classList.add('hidden');
    DOM.canvasContainer.classList.add('has-image');
    hasImage = true;
    resetAdjustments();
    
    // Reset crop box
    DOM.cropOverlay.classList.add('hidden');
    if (currentTool === 'crop') toggleTool('crop');
    
    if (aiLoaded) {
        // Mostrar cargador y permitir que la interfaz se repinte antes de bloquear con IA
        DOM.loadingOverlay.classList.remove('hidden');
        DOM.loadingText.textContent = 'Analizando imagen...';
        
        setTimeout(async () => {
            await analyzeImage();
            applyAdjustments();
        }, 50); // Dar 50ms a la pantalla para mostrar "Cargando..."
    } else {
        applyAdjustments();
    }
}

DOM.upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const url = URL.createObjectURL(file);
        loadImage(url);
    }
    // reset input so same file can be selected again
    e.target.value = ''; 
});

DOM.canvasContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    DOM.canvasContainer.style.borderColor = 'var(--accent-color)';
});
DOM.canvasContainer.addEventListener('dragleave', () => {
    DOM.canvasContainer.style.borderColor = '';
});
DOM.canvasContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    DOM.canvasContainer.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImage(URL.createObjectURL(file));
    }
});

function setupCanvases() {
    const w = img.width;
    const h = img.height;
    
    DOM.mainCanvas.width = w;
    DOM.mainCanvas.height = h;
    DOM.originalCanvas.width = w;
    DOM.originalCanvas.height = h;
    
    origCtx.drawImage(img, 0, 0);
    ctx.drawImage(img, 0, 0);
    originalImageData = origCtx.getImageData(0, 0, w, h);
    currentImageData = new ImageData(new Uint8ClampedArray(originalImageData.data), w, h);
}

// --- AI Processing ---
async function analyzeImage() {
    if (!imageSegmenter || !faceLandmarker) return;
    
    try {
        const segResult = await imageSegmenter.segment(img);
        aiMasks.background = segResult.categoryMask.getAsUint8Array();
        
        const faceResult = await faceLandmarker.detect(img);
        aiMasks.face = faceResult.faceLandmarks.length > 0 ? faceResult.faceLandmarks[0] : null;
    } catch (e) {
        console.error("Error analyzing:", e);
    }
    
    DOM.loadingOverlay.classList.add('hidden');
}

// --- Splash Screen ---
document.getElementById('splash-screen').addEventListener('click', function() {
    this.style.opacity = '0';
    this.style.pointerEvents = 'none';
    setTimeout(() => this.classList.add('hidden'), 500);
});

// --- Image Processing (Filters) ---

function resetAdjustments() {
    DOM.sBrightness.value = 0;
    DOM.sContrast.value = 0;
    DOM.sTemp.value = 0;
    DOM.sBW.checked = false;
    DOM.sWrinkles.value = 0;
    DOM.sBlur.value = 0;
    updateDisplayValues();
}

function updateDisplayValues() {
    DOM.vBrightness.textContent = DOM.sBrightness.value;
    DOM.vContrast.textContent = DOM.sContrast.value;
    DOM.vTemp.textContent = DOM.sTemp.value;
    DOM.vWrinkles.textContent = DOM.sWrinkles.value + '%';
    DOM.vBlur.textContent = DOM.sBlur.value + '%';
    DOM.vBrushSize.textContent = DOM.sBrushSize.value + 'px';
}

function applyAdjustments() {
    if (!hasImage) return;
    
    const brightness = parseInt(DOM.sBrightness.value);
    const contrast = parseInt(DOM.sContrast.value);
    const temp = parseInt(DOM.sTemp.value);
    const isBW = DOM.sBW.checked;
    const blurAmt = parseInt(DOM.sBlur.value);
    const wrinklesAmt = parseInt(DOM.sWrinkles.value);

    const outData = new ImageData(
        new Uint8ClampedArray(currentImageData.data),
        currentImageData.width,
        currentImageData.height
    );
    const data = outData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];

        r += brightness; g += brightness; b += brightness;

        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;

        if (temp > 0) { r += temp; b -= temp/2; } 
        else if (temp < 0) { b -= temp; r += temp/2; }

        if (isBW) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            r = g = b = gray;
        }

        data[i] = r; data[i+1] = g; data[i+2] = b;
    }
    
    ctx.putImageData(outData, 0, 0);
    
    if (blurAmt > 0 && aiMasks.background) applyBackgroundBlur(blurAmt);
    if (wrinklesAmt > 0 && aiMasks.face) applyFaceSmooth(wrinklesAmt);
}

function applyBackgroundBlur(amount) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    
    tCtx.filter = `blur(${amount / 5}px)`;
    tCtx.drawImage(ctx.canvas, 0, 0);
    
    const maskData = aiMasks.background; 
    const currentFrame = ctx.getImageData(0,0,w,h);
    const blurredFrame = tCtx.getImageData(0,0,w,h);
    
    for(let i=0; i<maskData.length; i++) {
        if (maskData[i] === 0) { // Assuming 0 is background
            const px = i * 4;
            currentFrame.data[px] = blurredFrame.data[px];
            currentFrame.data[px+1] = blurredFrame.data[px+1];
            currentFrame.data[px+2] = blurredFrame.data[px+2];
        }
    }
    ctx.putImageData(currentFrame, 0, 0);
}

function applyFaceSmooth(amount) {
    if (!aiMasks.face) return;
    const landmarks = aiMasks.face;
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    
    landmarks.forEach(p => {
        if(p.x < minX) minX = p.x;
        if(p.x > maxX) maxX = p.x;
        if(p.y < minY) minY = p.y;
        if(p.y > maxY) maxY = p.y;
    });
    
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    const x = Math.floor(minX * w);
    const y = Math.floor(minY * h);
    const width = Math.floor((maxX - minX) * w);
    const height = Math.floor((maxY - minY) * h);
    
    if (width <= 0 || height <= 0 || x < 0 || y < 0) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    
    tCtx.filter = `blur(${amount / 10}px)`;
    tCtx.drawImage(ctx.canvas, 0, 0);
    
    const currentFrame = ctx.getImageData(0,0,w,h);
    const blurredFrame = tCtx.getImageData(0,0,w,h);
    
    const cx = x + width/2, cy = y + height/2;
    const rx = width/2, ry = height/2;

    for (let cy_i = y; cy_i < y + height; cy_i++) {
        for (let cx_i = x; cx_i < x + width; cx_i++) {
            const dx = cx_i - cx, dy = cy_i - cy;
            if ((dx*dx)/(rx*rx) + (dy*dy)/(ry*ry) <= 1) {
                const px = (cy_i * w + cx_i) * 4;
                const alpha = amount / 100;
                currentFrame.data[px] = currentFrame.data[px]*(1-alpha) + blurredFrame.data[px]*alpha;
                currentFrame.data[px+1] = currentFrame.data[px+1]*(1-alpha) + blurredFrame.data[px+1]*alpha;
                currentFrame.data[px+2] = currentFrame.data[px+2]*(1-alpha) + blurredFrame.data[px+2]*alpha;
            }
        }
    }
    ctx.putImageData(currentFrame, 0, 0);
}

[DOM.sBrightness, DOM.sContrast, DOM.sTemp, DOM.sBW, DOM.sWrinkles, DOM.sBlur].forEach(el => {
    el.addEventListener('input', () => { updateDisplayValues(); applyAdjustments(); });
});

// --- Manual Tools & Crop ---

function getMousePos(evt, relativeTo = DOM.mainCanvas) {
    const e = evt.touches && evt.touches.length > 0 ? evt.touches[0] : evt;
    const rect = relativeTo.getBoundingClientRect();
    const scaleX = relativeTo.width / rect.width || 1;
    const scaleY = relativeTo.height / rect.height || 1;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
        clientX: e.clientX,
        clientY: e.clientY
    };
}

DOM.btnClone.addEventListener('click', () => toggleTool('clone'));
DOM.btnIlluminate.addEventListener('click', () => toggleTool('illuminate'));
DOM.btnCrop.addEventListener('click', () => toggleTool('crop'));

function toggleTool(tool) {
    if (currentTool === tool) {
        currentTool = null;
        DOM.btnClone.classList.remove('active');
        DOM.btnIlluminate.classList.remove('active');
        DOM.btnCrop.classList.remove('active');
        DOM.brushSettings.classList.add('hidden');
        DOM.cropSettings.classList.add('hidden');
        DOM.toolCursor.classList.add('hidden');
        DOM.cropOverlay.classList.add('hidden');
        DOM.mainCanvas.style.cursor = 'default';
    } else {
        currentTool = tool;
        DOM.btnClone.classList.toggle('active', tool === 'clone');
        DOM.btnIlluminate.classList.toggle('active', tool === 'illuminate');
        DOM.btnCrop.classList.toggle('active', tool === 'crop');
        
        DOM.brushSettings.classList.toggle('hidden', tool === 'crop');
        DOM.cropSettings.classList.toggle('hidden', tool !== 'crop');
        
        DOM.mainCanvas.style.cursor = tool === 'crop' ? 'crosshair' : 'none';
        DOM.toolCursor.classList.toggle('hidden', tool === 'crop');
        
        if (tool === 'crop' && hasImage) initCropBox();
        else DOM.cropOverlay.classList.add('hidden');
        
        cloneSource = null;
    }
}

DOM.sBrushSize.addEventListener('input', () => {
    DOM.vBrushSize.textContent = DOM.sBrushSize.value + 'px';
    updateCursorSize();
});

function updateCursorSize() {
    const size = DOM.sBrushSize.value;
    DOM.toolCursor.style.width = size + 'px';
    DOM.toolCursor.style.height = size + 'px';
}
updateCursorSize();

// Interaction for Brush Tools
DOM.mainCanvas.addEventListener('mousemove', handlePointerMove);
DOM.mainCanvas.addEventListener('touchmove', handlePointerMove, {passive: false});

DOM.mainCanvas.addEventListener('mousedown', handlePointerDown);
DOM.mainCanvas.addEventListener('touchstart', handlePointerDown, {passive: false});

window.addEventListener('mouseup', handlePointerUp);
window.addEventListener('touchend', handlePointerUp);

function handlePointerMove(e) {
    if (e.type === 'touchmove') e.preventDefault(); // prevent scroll
    if (currentTool === 'crop' || !currentTool || !hasImage) return;
    
    const evt = e.touches ? e.touches[0] : e;
    const size = parseInt(DOM.sBrushSize.value);
    DOM.toolCursor.style.left = (evt.clientX - size/2) + 'px';
    DOM.toolCursor.style.top = (evt.clientY - size/2) + 'px';
    
    if (isDrawing) {
        const pos = getMousePos(e);
        applyTool(pos);
        lastPointerPos = pos;
    }
}

function handlePointerDown(e) {
    if (currentTool === 'crop' || !currentTool || !hasImage) return;
    const pos = getMousePos(e);
    
    if (currentTool === 'clone' && !cloneSource) {
        cloneSource = pos;
        alert("Origen de clonación establecido.");
        return;
    }

    isDrawing = true;
    lastPointerPos = pos;
    applyTool(pos);
}

function handlePointerUp() {
    if(isDrawing) {
        isDrawing = false;
        currentImageData = ctx.getImageData(0, 0, DOM.mainCanvas.width, DOM.mainCanvas.height);
    }
    isDraggingCrop = false;
    dragHandle = null;
}

function applyTool(pos) {
    const size = parseInt(DOM.sBrushSize.value);
    const rect = DOM.mainCanvas.getBoundingClientRect();
    const scaleX = DOM.mainCanvas.width / rect.width;
    const actualSize = size * scaleX;

    if (currentTool === 'illuminate') {
        ctx.globalCompositeOperation = 'color-dodge';
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, actualSize/2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    } else if (currentTool === 'clone' && cloneSource) {
        const dx = pos.x - lastPointerPos.x;
        const dy = pos.y - lastPointerPos.y;
        cloneSource.x += dx; cloneSource.y += dy;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, actualSize/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(DOM.mainCanvas, 
            cloneSource.x - actualSize/2, cloneSource.y - actualSize/2, actualSize, actualSize,
            pos.x - actualSize/2, pos.y - actualSize/2, actualSize, actualSize
        );
        ctx.restore();
    }
}

// --- CROP TOOL LOGIC ---

function initCropBox() {
    DOM.cropOverlay.classList.remove('hidden');
    // Set crop box to cover mostly center of canvas visually
    const cRect = DOM.mainCanvas.getBoundingClientRect();
    const padding = 20;
    cropRect = {
        x: padding,
        y: padding,
        w: cRect.width - padding * 2,
        h: cRect.height - padding * 2
    };
    enforceCropRatio();
    updateCropBoxUI();
}

function updateCropBoxUI() {
    const cRect = DOM.mainCanvas.getBoundingClientRect();
    const contRect = DOM.canvasContainer.getBoundingClientRect();
    // Offset to match canvas position inside container
    const offsetX = cRect.left - contRect.left;
    const offsetY = cRect.top - contRect.top;

    DOM.cropBox.style.left = (offsetX + cropRect.x) + 'px';
    DOM.cropBox.style.top = (offsetY + cropRect.y) + 'px';
    DOM.cropBox.style.width = cropRect.w + 'px';
    DOM.cropBox.style.height = cropRect.h + 'px';
}

function enforceCropRatio() {
    const ratio = DOM.cropRatio.value;
    if (ratio === 'free') return;
    const targetRatio = parseFloat(ratio);
    
    // adjust height based on width
    cropRect.h = cropRect.w / targetRatio;
    
    // ensure it fits in canvas
    const cRect = DOM.mainCanvas.getBoundingClientRect();
    if (cropRect.h > cRect.height) {
        cropRect.h = cRect.height;
        cropRect.w = cropRect.h * targetRatio;
    }
}

DOM.cropRatio.addEventListener('change', () => {
    enforceCropRatio();
    updateCropBoxUI();
});

// Dragging Logic for Crop
function startCropDrag(e) {
    const evt = e.touches ? e.touches[0] : e;
    if (e.target && e.target.classList && e.target.classList.contains('crop-handle')) {
        dragHandle = Array.from(e.target.classList).find(c => c.includes('-'));
    } else {
        dragHandle = 'box';
    }
    isDraggingCrop = true;
    cropDragStart = { x: evt.clientX, y: evt.clientY };
    if(e.stopPropagation) e.stopPropagation();
}

DOM.cropBox.addEventListener('mousedown', startCropDrag);
DOM.cropBox.addEventListener('touchstart', startCropDrag, {passive: false});

function moveCropDrag(e) {
    if (!isDraggingCrop || currentTool !== 'crop') return;
    if (e.type === 'touchmove') e.preventDefault(); // prevent scroll
    
    const evt = e.touches ? e.touches[0] : e;
    const dx = evt.clientX - cropDragStart.x;
    const dy = evt.clientY - cropDragStart.y;
    cropDragStart = { x: evt.clientX, y: evt.clientY };
    
    const cRect = DOM.mainCanvas.getBoundingClientRect();
    const ratio = DOM.cropRatio.value;
    const keepRatio = ratio !== 'free';
    const targetRatio = keepRatio ? parseFloat(ratio) : null;

    if (dragHandle === 'box') {
        cropRect.x += dx;
        cropRect.y += dy;
    } else {
        if (dragHandle.includes('left')) {
            cropRect.x += dx; cropRect.w -= dx;
        }
        if (dragHandle.includes('right')) {
            cropRect.w += dx;
        }
        if (dragHandle.includes('top')) {
            cropRect.y += dy; cropRect.h -= dy;
        }
        if (dragHandle.includes('bottom')) {
            cropRect.h += dy;
        }
        
        // Enforce aspect ratio when resizing
        if (keepRatio) {
            if (dragHandle.includes('left') || dragHandle.includes('right')) {
                cropRect.h = cropRect.w / targetRatio;
            } else {
                cropRect.w = cropRect.h * targetRatio;
            }
        }
    }

    // Constraints
    if (cropRect.w < 50) cropRect.w = 50;
    if (cropRect.h < 50) cropRect.h = 50;
    if (cropRect.x < 0) cropRect.x = 0;
    if (cropRect.y < 0) cropRect.y = 0;
    if (cropRect.x + cropRect.w > cRect.width) {
        if(dragHandle === 'box') cropRect.x = cRect.width - cropRect.w;
        else cropRect.w = cRect.width - cropRect.x;
    }
    if (cropRect.y + cropRect.h > cRect.height) {
        if(dragHandle === 'box') cropRect.y = cRect.height - cropRect.h;
        else cropRect.h = cRect.height - cropRect.y;
    }

    updateCropBoxUI();
}

window.addEventListener('mousemove', moveCropDrag);
window.addEventListener('touchmove', moveCropDrag, {passive: false});

DOM.btnCancelCrop.addEventListener('click', () => toggleTool('crop'));

DOM.btnApplyCrop.addEventListener('click', async () => {
    if (!hasImage) return;
    
    // Convert visually cropped rect to actual pixel coordinates
    const cRect = DOM.mainCanvas.getBoundingClientRect();
    const scaleX = DOM.mainCanvas.width / cRect.width;
    const scaleY = DOM.mainCanvas.height / cRect.height;
    
    const sX = cropRect.x * scaleX;
    const sY = cropRect.y * scaleY;
    const sW = cropRect.w * scaleX;
    const sH = cropRect.h * scaleY;
    
    // Create new image from the cropped area
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sW;
    tempCanvas.height = sH;
    const tCtx = tempCanvas.getContext('2d');
    
    // Draw cropped portion
    tCtx.drawImage(DOM.mainCanvas, sX, sY, sW, sH, 0, 0, sW, sH);
    
    // Load it back as the new base image
    const croppedUrl = tempCanvas.toDataURL('image/png');
    loadImage(croppedUrl);
    toggleTool('crop');
});

// --- Export Settings & Logic ---

DOM.exportFormat.addEventListener('change', () => {
    if (DOM.exportFormat.value === 'image/png') {
        DOM.exportQualityContainer.classList.add('hidden');
    } else {
        DOM.exportQualityContainer.classList.remove('hidden');
    }
});

DOM.exportQuality.addEventListener('input', () => {
    DOM.valExportQuality.textContent = DOM.exportQuality.value + '%';
});

// --- Theme Selector ---
DOM.themeSelector.addEventListener('change', (e) => {
    document.documentElement.setAttribute('data-theme', e.target.value);
});

// --- Export & Compare ---

function startCompare() {
    if(hasImage && currentTool !== 'crop') {
        DOM.mainCanvas.classList.add('hidden');
        DOM.originalCanvas.classList.remove('hidden');
    }
}
function stopCompare() {
    if(hasImage) {
        DOM.mainCanvas.classList.remove('hidden');
        DOM.originalCanvas.classList.add('hidden');
    }
}

DOM.btnCompare.addEventListener('mousedown', startCompare);
DOM.btnCompare.addEventListener('touchstart', startCompare, {passive: true});
DOM.btnCompare.addEventListener('mouseup', stopCompare);
DOM.btnCompare.addEventListener('touchend', stopCompare);
DOM.btnCompare.addEventListener('mouseleave', stopCompare);

DOM.btnSave.addEventListener('click', () => {
    if (!hasImage) return;
    
    const format = DOM.exportFormat.value;
    const quality = parseInt(DOM.exportQuality.value) / 100;
    
    const link = document.createElement('a');
    let ext = 'png';
    if(format === 'image/jpeg') ext = 'jpg';
    if(format === 'image/webp') ext = 'webp';
    
    link.download = `difuminar_edit.${ext}`;
    link.href = DOM.mainCanvas.toDataURL(format, quality);
    link.click();
});

DOM.btnCopy.addEventListener('click', async () => {
    if (!hasImage) return;
    try {
        const format = 'image/png'; // Portapapeles suele requerir PNG de forma estándar web, aunque usemos la opción elegida, para máxima compatibilidad forzamos png en toBlob o usamos el seleccionado si el navegador lo soporta.
        // Safari/Chrome soportan copiar PNG al portapapeles.
        DOM.mainCanvas.toBlob(async (blob) => {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            alert('Imagen copiada al portapapeles');
        }, 'image/png'); // Siempre PNG para clipboard por compatibilidad
    } catch (e) {
        alert('Tu navegador no soporta la API del portapapeles para imágenes.');
    }
});

DOM.btnExit.addEventListener('click', () => {
    hasImage = false;
    DOM.canvasContainer.classList.remove('has-image');
    DOM.placeholder.classList.remove('hidden');
    ctx.clearRect(0,0, DOM.mainCanvas.width, DOM.mainCanvas.height);
    origCtx.clearRect(0,0, DOM.originalCanvas.width, DOM.originalCanvas.height);
    resetAdjustments();
    if(currentTool) toggleTool(currentTool);
});
