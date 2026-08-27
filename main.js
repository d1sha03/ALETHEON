const canvas = document.getElementById('scroll-canvas');
const ctx = canvas.getContext('2d');

const totalFrames = 426;
const images = [];
const loadedImages = new Set();

let currentFrame = 0;
let targetFrame = 0;
const ease = 0.12; // Lower value = smoother/more inertia, higher = more responsive
let lastRenderedFrame = -1;
let needsRedraw = false;

// Helper to format frame filename in order: frame_000000.jpg, frame_000001.jpg, etc.
function getFrameUrl(index) {
  const paddedIndex = String(index).padStart(6, '0');
  return `./frame_${paddedIndex}.jpg`;
}

// Load a single frame image
function loadImage(index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = getFrameUrl(index);
    img.onload = () => {
      images[index] = img;
      loadedImages.add(index);
      needsRedraw = true; // Redraw if we just loaded a frame that should be active
      resolve(img);
    };
    img.onerror = () => {
      console.warn(`Failed to load frame ${index}`);
      resolve(null); // Resolve to not block the preloading queue
    };
  });
}

// Resizes canvas with device pixel ratio scaling for crispness on High-DPI screens
function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;
  needsRedraw = true;
}

// Computes 'cover' scaling and draws the image onto the canvas
function drawFrame(img) {
  if (!img) return;
  
  const imgWidth = img.width;
  const imgHeight = img.height;
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  
  const imgRatio = imgWidth / imgHeight;
  const canvasRatio = canvasWidth / canvasHeight;
  
  let drawWidth, drawHeight, drawX, drawY;
  
  if (canvasRatio > imgRatio) {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgRatio;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * imgRatio;
    drawHeight = canvasHeight;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  }
  
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}

// Finds the closest loaded image index to avoid blank frames
function getClosestLoadedImageIndex(targetIndex) {
  if (loadedImages.has(targetIndex)) return targetIndex;
  
  let offset = 1;
  while (offset < totalFrames) {
    const left = targetIndex - offset;
    const right = targetIndex + offset;
    
    if (left >= 0 && loadedImages.has(left)) {
      return left;
    }
    if (right < totalFrames && loadedImages.has(right)) {
      return right;
    }
    offset++;
  }
  return -1;
}

// Maps window scroll progress to the target frame index
function updateScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight;
  const clientHeight = window.innerHeight;
  
  const maxScroll = scrollHeight - clientHeight;
  if (maxScroll <= 0) return;
  
  const progress = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
  targetFrame = progress * (totalFrames - 1);
}

// Main animation tick
function tick() {
  const diff = targetFrame - currentFrame;
  
  // Interpolation logic
  if (Math.abs(diff) > 0.005) {
    currentFrame += diff * ease;
  } else {
    currentFrame = targetFrame;
  }
  
  const roundedFrame = Math.round(currentFrame);
  
  // Render if the frame changed or canvas was resized/frame was loaded
  if (roundedFrame !== lastRenderedFrame || needsRedraw) {
    const drawIndex = getClosestLoadedImageIndex(roundedFrame);
    if (drawIndex !== -1) {
      drawFrame(images[drawIndex]);
      lastRenderedFrame = roundedFrame;
      needsRedraw = false;
    }
  }
  
  requestAnimationFrame(tick);
}

// Concurrent preloading queue (concurrency limit = 6)
async function preloadImages() {
  // 1. Immediately load frame 0 to draw a cover frame as fast as possible
  const firstFrame = await loadImage(0);
  if (firstFrame) {
    needsRedraw = true;
  }
  
  // 2. Load the remaining frames in the background concurrently
  const concurrency = 6;
  let nextIndex = 1;
  
  async function worker() {
    while (nextIndex < totalFrames) {
      const index = nextIndex++;
      await loadImage(index);
    }
  }
  
  const workers = Array.from({ length: concurrency }, worker);
  await Promise.all(workers);
  console.log('Preloaded all frames successfully.');
}

// Initializer
function init() {
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('scroll', updateScroll, { passive: true });
  
  resizeCanvas();
  preloadImages();
  updateScroll(); // Initial scroll mapping
  requestAnimationFrame(tick); // Start loop
}

init();
