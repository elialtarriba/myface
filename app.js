import { FilesetResolver, ImageSegmenter, FaceLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';

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
    vTemp: document.getElementById('val-temperature'),
    sBlackPoint: document.getElementById('adj-blackpoint'),
    vBlackPoint: document.getElementById('val-blackpoint'),
    sWhites: document.getElementById('adj-whites'),
    vWhites: document.getElementById('val-whites'),
    sClarity: document.getElementById('adj-clarity'),
    vClarity: document.getElementById('val-clarity'),
    sHaze: document.getElementById('adj-haze'),
    vHaze: document.getElementById('val-haze'),
    sBW: document.getElementById('adj-bw'),
    sBeauty: document.getElementById('ai-beauty'),
    vBeauty: document.getElementById('val-beauty'),
    sWrinkles: document.getElementById('ai-wrinkles'),
    sBlur: document.getElementById('ai-blur'),
    sBrushSize: document.getElementById('brush-size'),
    
    // Values displays
    vBrightness: document.getElementById('val-brightness'),
    vContrast: document.getElementById('val-contrast'),
    vWrinkles: document.getElementById('val-wrinkles'),
    vBlur: document.getElementById('val-blur'),
    vBrushSize: document.getElementById('val-brush-size'),
    
    // Buttons
    btnCompare: document.getElementById('btn-compare'),
    btnCopy: document.getElementById('btn-copy'),
    btnSave: document.getElementById('btn-save'),
    btnExit: document.getElementById('btn-exit'),
    btnClone: document.getElementById('tool-clone'),
    btnCrop: document.getElementById('tool-crop'),
    
    // UI Elements
    themeSelector: document.getElementById('theme-selector'),
    brushSettings: document.getElementById('brush-settings'),
    cropSettings: document.getElementById('crop-settings'),
    toolCursor: document.getElementById('tool-cursor'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text'),
    aiWarning: document.getElementById('ai-warning'),
    logoTitle: document.querySelector('.logo h1'),
    historyActions: document.getElementById('history-actions'),
    btnUndo: document.getElementById('btn-undo'),
    btnRedo: document.getElementById('btn-redo'),
    btnResetImg: document.getElementById('btn-reset-img'),
    btnSetCloneSource: document.getElementById('btn-set-clone-source'),
    modalReset: document.getElementById('reset-modal'),
    btnConfirmReset: document.getElementById('modal-btn-confirm'),
    btnCancelReset: document.getElementById('modal-btn-cancel'),
    
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

// Navigation & Tabs
const navItems = document.querySelectorAll('.nav-item');
const panels = document.querySelectorAll('.panel-content');
const toolPanelsContainer = document.querySelector('.tool-panels');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        // Remove active class from all
        navItems.forEach(nav => nav.classList.remove('active'));
        panels.forEach(panel => panel.classList.remove('active'));
        
        if (isActive) {
            // If it was already active, we just close the whole panel container
            toolPanelsContainer.classList.add('closed');
        } else {
            // Otherwise, open the panel container and activate the clicked tab
            toolPanelsContainer.classList.remove('closed');
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        }
    });
});

// Swipe down to close panels
let panelTouchStartY = 0;
toolPanelsContainer.addEventListener('touchstart', e => {
    panelTouchStartY = e.touches[0].clientY;
}, {passive: true});

toolPanelsContainer.addEventListener('touchend', e => {
    const touchEndY = e.changedTouches[0].clientY;
    const dy = touchEndY - panelTouchStartY;
    if (dy > 60) { // Deslizar hacia abajo
        toolPanelsContainer.classList.add('closed');
        navItems.forEach(nav => nav.classList.remove('active'));
        panels.forEach(panel => panel.classList.remove('active'));
    }
});

// App Reset (Home Button & Exit Button)
function resetApp() {
    if (hasImage) {
        if (confirm('¿Seguro que quieres borrar la foto actual y volver al inicio?')) {
            location.reload();
        }
    } else {
        location.reload();
    }
}
DOM.logoTitle.addEventListener('click', resetApp);
if (DOM.btnExit) {
    DOM.btnExit.addEventListener('click', resetApp);
}

// State
let img = new Image();
let originalImageData = null;
let currentImageData = null;
let hasImage = false;
let currentTool = null;
let aiLoaded = false;
let imageSegmenter = null;
let faceLandmarker = null;

async function initAI() {
    try {
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
        
        imageSegmenter = await ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
                delegate: "GPU"
            },
            runningMode: "IMAGE",
            outputCategoryMask: true,
            outputConfidenceMasks: false
        });
        
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "IMAGE",
            numFaces: 1
        });
        aiLoaded = true;
        console.log("IA Inicializada Correctamente");
    } catch (e) {
        console.error("Error inicializando IA:", e);
    }
}
initAI();

let isDrawing = false;
let lastPointerPos = null;
let cloneSource = null;
let aiMasks = { bg: null, face: null };

// History State
const MAX_HISTORY = 10;
let history = [];
let historyIndex = -1;

function saveState() {
    if (!originalImageData) return;
    
    // If we are not at the end of the history, truncate the future
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    const copy = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
    );
    
    history.push(copy);
    if (history.length > MAX_HISTORY) {
        history.shift();
    } else {
        historyIndex++;
    }
    updateHistoryUI();
}

function updateHistoryUI() {
    DOM.btnUndo.disabled = historyIndex <= 0;
    DOM.btnRedo.disabled = historyIndex >= history.length - 1;
    DOM.btnResetImg.disabled = !hasImage;
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClickSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function restoreState(index) {
    const state = history[index];
    originalImageData = new ImageData(
        new Uint8ClampedArray(state.data),
        state.width,
        state.height
    );
    applyAdjustments();
    updateHistoryUI();
}

DOM.btnUndo.addEventListener('click', () => {
    if (historyIndex > 0) {
        playClickSound();
        historyIndex--;
        restoreState(historyIndex);
    }
});
DOM.btnRedo.addEventListener('click', () => {
    if (historyIndex < history.length - 1) {
        playClickSound();
        historyIndex++;
        restoreState(historyIndex);
    }
});
DOM.btnResetImg.addEventListener('click', () => {
    if (hasImage) {
        playClickSound();
        DOM.modalReset.classList.add('active');
    }
});

DOM.btnCancelReset.addEventListener('click', () => {
    DOM.modalReset.classList.remove('active');
});

DOM.btnConfirmReset.addEventListener('click', () => {
    DOM.modalReset.classList.remove('active');
    
    // Restablecer deslizadores
    DOM.sBrightness.value = 0;
    DOM.sContrast.value = 0;
    DOM.sTemp.value = 0;
    DOM.sBlackPoint.value = 0;
    DOM.sWhites.value = 0;
    DOM.sClarity.value = 0;
    DOM.sHaze.value = 0;
    DOM.sBeauty.value = 0;
    DOM.sWrinkles.value = 0;
    DOM.sBlur.value = 0;
    
    if (history.length > 0) {
        historyIndex = 0;
        restoreState(0);
        saveState();
    } else {
        updateDisplayValues();
        applyAdjustments();
    }
});

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
    
    // Setup history
    originalImageData = ctx.getImageData(0, 0, DOM.mainCanvas.width, DOM.mainCanvas.height);
    currentImageData = ctx.getImageData(0, 0, DOM.mainCanvas.width, DOM.mainCanvas.height);
    history = [];
    historyIndex = -1;
    saveState();
    DOM.historyActions.classList.remove('hidden');

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
    DOM.sBlackPoint.value = 0;
    DOM.sWhites.value = 0;
    DOM.sClarity.value = 0;
    DOM.sHaze.value = 0;
    DOM.sBeauty.value = 0;
    DOM.sWrinkles.value = 0;
    DOM.sBlur.value = 0;
    updateDisplayValues();
}

function updateDisplayValues() {
    DOM.vBrightness.textContent = DOM.sBrightness.value;
    DOM.vContrast.textContent = DOM.sContrast.value;
    DOM.vTemp.textContent = DOM.sTemp.value;
    DOM.vBlackPoint.textContent = DOM.sBlackPoint.value;
    DOM.vWhites.textContent = DOM.sWhites.value;
    DOM.vClarity.textContent = DOM.sClarity.value;
    DOM.vHaze.textContent = DOM.sHaze.value;
    DOM.vBeauty.textContent = DOM.sBeauty.value + '%';
    DOM.vWrinkles.textContent = DOM.sWrinkles.value + '%';
    DOM.vBlur.textContent = DOM.sBlur.value + '%';
    DOM.vBrushSize.textContent = DOM.sBrushSize.value + 'px';
}

function applyAdjustments() {
    if (!hasImage) return;
    
    const brightness = parseInt(DOM.sBrightness.value);
    const contrast = parseInt(DOM.sContrast.value);
    const temp = parseInt(DOM.sTemp.value);
    const blackPt = parseInt(DOM.sBlackPoint.value);
    const whitePt = parseInt(DOM.sWhites.value);
    const blurAmt = parseInt(DOM.sBlur.value);
    const wrinklesAmt = parseInt(DOM.sWrinkles.value);
    const beautyAmt = parseInt(DOM.sBeauty.value);
    const clarity = parseInt(DOM.sClarity.value);
    const haze = parseInt(DOM.sHaze.value);

    const outData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
    );
    const data = outData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];

        r += brightness; g += brightness; b += brightness;

        r = factor * (r - 128) + 128;
        g = factor * (g - 128) + 128;
        b = factor * (b - 128) + 128;
        
        // Punto Negro y Blancos
        if (blackPt !== 0) {
            r = r - blackPt * ((255 - r) / 255);
            g = g - blackPt * ((255 - g) / 255);
            b = b - blackPt * ((255 - b) / 255);
        }
        if (whitePt !== 0) {
            r = r + whitePt * (r / 255);
            g = g + whitePt * (g / 255);
            b = b + whitePt * (b / 255);
        }

        // Temperatura
        r += temp;
        b -= temp;

        data[i] = r; data[i+1] = g; data[i+2] = b;
    }
    
    ctx.putImageData(outData, 0, 0);
    
    // Claridad y Neblina (post-procesado con ctx.filter y blend modes)
    if (clarity !== 0 || haze !== 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = ctx.canvas.width;
        tempCanvas.height = ctx.canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(ctx.canvas, 0, 0);

        // 1. Neblina (Haze/Dehaze)
        if (haze !== 0) {
            if (haze > 0) {
                // Dehaze: overlay increases contrast and saturation
                ctx.globalCompositeOperation = 'overlay';
                ctx.globalAlpha = haze / 100;
                ctx.drawImage(tempCanvas, 0, 0);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1.0;
                tCtx.drawImage(ctx.canvas, 0, 0);
            } else {
                // Haze: white/grey semi-transparent layer
                ctx.fillStyle = `rgba(220, 225, 230, ${Math.abs(haze) / 100})`;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                tCtx.drawImage(ctx.canvas, 0, 0);
            }
        }

        // 2. Claridad
        if (clarity !== 0) {
            if (clarity > 0) {
                // Sharpen (via SVG filter)
                const amt = clarity / 25.0; 
                const matrix = `0 ${-amt} 0 ${-amt} ${1 + 4*amt} ${-amt} 0 ${-amt} 0`;
                const matrixEl = document.getElementById('sharpen-matrix');
                if (matrixEl) matrixEl.setAttribute('kernelMatrix', matrix);
                ctx.filter = 'url(#sharpen-filter)';
            } else {
                // Blur
                const bAmt = Math.abs(clarity) / 10;
                ctx.filter = `blur(${bAmt}px)`;
            }
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.filter = 'none';
        }
    }

    if (blurAmt > 0) {
        if (aiMasks.background) applyBackgroundBlur(blurAmt);
        else applyBackgroundBlurFallback(blurAmt);
    }
    if (wrinklesAmt > 0 || beautyAmt > 0) {
        if (aiMasks.face) applyFaceEnhancements(wrinklesAmt, beautyAmt);
        else applyFaceEnhancementsFallback(wrinklesAmt, beautyAmt);
    }
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

function applyBackgroundBlurFallback(amount) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    
    tCtx.filter = `blur(${amount / 5}px)`;
    tCtx.drawImage(ctx.canvas, 0, 0);
    
    const currentFrame = ctx.getImageData(0,0,w,h);
    const blurredFrame = tCtx.getImageData(0,0,w,h);
    
    const cx = w/2, cy = h/2;
    const maxDist = Math.min(w, h) * 0.8;
    
    for (let cy_i = 0; cy_i < h; cy_i++) {
        for (let cx_i = 0; cx_i < w; cx_i++) {
            const dx = cx_i - cx, dy = cy_i - cy;
            const dist = Math.sqrt(dx*dx + dy*dy);
            // Si está lejos del centro (fondo), aplicamos blur
            if (dist > maxDist * 0.3) {
                let alpha = (dist - maxDist * 0.3) / (maxDist * 0.4);
                if (alpha > 1) alpha = 1;
                const px = (cy_i * w + cx_i) * 4;
                currentFrame.data[px] = currentFrame.data[px]*(1-alpha) + blurredFrame.data[px]*alpha;
                currentFrame.data[px+1] = currentFrame.data[px+1]*(1-alpha) + blurredFrame.data[px+1]*alpha;
                currentFrame.data[px+2] = currentFrame.data[px+2]*(1-alpha) + blurredFrame.data[px+2]*alpha;
            }
        }
    }
    ctx.putImageData(currentFrame, 0, 0);
}

function applyFaceEnhancements(wrinklesAmt, beautyAmt) {
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
    
    const blurPx = (wrinklesAmt / 10) + (beautyAmt / 20);
    const br = 100 + (beautyAmt / 5);
    const ct = 100 + (beautyAmt / 10);
    const sat = 100 + (beautyAmt / 10);
    tCtx.filter = `blur(${blurPx}px) brightness(${br}%) contrast(${ct}%) saturate(${sat}%)`;
    
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
                const alpha = Math.max(wrinklesAmt, beautyAmt) / 100;
                currentFrame.data[px] = currentFrame.data[px]*(1-alpha) + blurredFrame.data[px]*alpha;
                currentFrame.data[px+1] = currentFrame.data[px+1]*(1-alpha) + blurredFrame.data[px+1]*alpha;
                currentFrame.data[px+2] = currentFrame.data[px+2]*(1-alpha) + blurredFrame.data[px+2]*alpha;
            }
        }
    }
    ctx.putImageData(currentFrame, 0, 0);
}

function applyFaceEnhancementsFallback(wrinklesAmt, beautyAmt) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d');
    
    const blurPx = (wrinklesAmt / 10) + (beautyAmt / 20);
    const br = 100 + (beautyAmt / 5);
    const ct = 100 + (beautyAmt / 10);
    const sat = 100 + (beautyAmt / 10);
    tCtx.filter = `blur(${blurPx}px) brightness(${br}%) contrast(${ct}%) saturate(${sat}%)`;
    
    tCtx.drawImage(ctx.canvas, 0, 0);
    
    const currentFrame = ctx.getImageData(0,0,w,h);
    const blurredFrame = tCtx.getImageData(0,0,w,h);
    
    // Asumir que la cara está en el centro
    const cx = w/2, cy = h/2;
    const rx = w * 0.3, ry = h * 0.4;

    for (let cy_i = 0; cy_i < h; cy_i++) {
        for (let cx_i = 0; cx_i < w; cx_i++) {
            const dx = cx_i - cx, dy = cy_i - cy;
            if ((dx*dx)/(rx*rx) + (dy*dy)/(ry*ry) <= 1) {
                const px = (cy_i * w + cx_i) * 4;
                // Fade radial
                const dist = Math.sqrt((dx*dx)/(rx*rx) + (dy*dy)/(ry*ry));
                const fade = 1 - dist;
                const baseAlpha = Math.max(wrinklesAmt, beautyAmt) / 100;
                const alpha = baseAlpha * fade;
                
                currentFrame.data[px] = currentFrame.data[px]*(1-alpha) + blurredFrame.data[px]*alpha;
                currentFrame.data[px+1] = currentFrame.data[px+1]*(1-alpha) + blurredFrame.data[px+1]*alpha;
                currentFrame.data[px+2] = currentFrame.data[px+2]*(1-alpha) + blurredFrame.data[px+2]*alpha;
            }
        }
    }
    ctx.putImageData(currentFrame, 0, 0);
}

[DOM.sBrightness, DOM.sContrast, DOM.sTemp, DOM.sBlackPoint, DOM.sWhites, DOM.sWrinkles, DOM.sBlur, DOM.sClarity, DOM.sHaze, DOM.sBeauty].forEach(el => {
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
DOM.btnCrop.addEventListener('click', () => toggleTool('crop'));

DOM.btnSetCloneSource.addEventListener('click', () => {
    cloneSource = null;
    alert("Haz clic o arrastra sobre la foto para fijar el nuevo origen de clonación.");
});

function toggleTool(tool) {
    if (currentTool === tool) {
        currentTool = null;
        DOM.btnClone.classList.remove('active');
        DOM.btnCrop.classList.remove('active');
        DOM.brushSettings.classList.add('hidden');
        DOM.cropSettings.classList.add('hidden');
        DOM.toolCursor.classList.add('hidden');
        DOM.cropOverlay.classList.add('hidden');
        DOM.mainCanvas.style.cursor = 'default';
    } else {
        currentTool = tool;
        DOM.btnClone.classList.toggle('active', tool === 'clone');
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
        cloneSource = { x: pos.x - 40, y: pos.y }; // Auto-fijar origen para que funcione inmediatamente
    }

    isDrawing = true;
    lastPointerPos = pos;
    applyTool(pos);
}

function handlePointerUp() {
    if(isDrawing) {
        isDrawing = false;
        // FIx: Actualizar la imagen base para que los deslizadores no borren el dibujo
        originalImageData = ctx.getImageData(0, 0, DOM.mainCanvas.width, DOM.mainCanvas.height);
        saveState();
    }
    isDraggingCrop = false;
    dragHandle = null;
}

function applyTool(pos) {
    const size = parseInt(DOM.sBrushSize.value);
    const rect = DOM.mainCanvas.getBoundingClientRect();
    const scaleX = DOM.mainCanvas.width / rect.width;
    const actualSize = size * scaleX;

    if (currentTool === 'clone' && cloneSource) {
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


