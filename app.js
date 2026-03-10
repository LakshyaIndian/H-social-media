// app.js - Hitgram Main Application Logic

// ──────────────────── Service Worker Registration ────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW error:', err));
  });
}

// ──────────────────── Toast Utility ────────────────────
function showToast(message, type = '', duration = 2800) {
  let toast = document.getElementById('hitgram-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'hitgram-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast ' + type;
  requestAnimationFrame(() => {
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration);
  });
}

// ──────────────────── Blob → Object URL cache ────────────────────
const urlCache = new Map();
function getBlobUrl(blob) {
  if (!blob) return '';
  const key = blob.size + '_' + blob.type;
  if (urlCache.has(key)) return urlCache.get(key);
  const url = URL.createObjectURL(blob);
  urlCache.set(key, url);
  return url;
}

// ──────────────────── Image Rendering ────────────────────
function renderGridItems(images, container) {
  container.innerHTML = '';
  images.forEach((img, i) => {
    const item = createGridItem(img, i);
    container.appendChild(item);
  });
}

function createGridItem(img, index) {
  const item = document.createElement('div');
  item.className = 'grid-item';
  item.style.animationDelay = Math.min(index * 0.04, 0.6) + 's';
  item.dataset.id = img.id;

  const imgEl = document.createElement('img');
  imgEl.loading = 'lazy';
  imgEl.decoding = 'async';
  imgEl.alt = '';

  // Use IntersectionObserver for lazy loading
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        imgEl.src = getBlobUrl(img.blob);
        obs.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px' });

  const overlay = document.createElement('div');
  overlay.className = 'grid-item-overlay';

  const favBtn = document.createElement('button');
  favBtn.className = 'grid-fav-btn' + (img.favorite ? ' faved' : '');
  favBtn.title = 'Favorite';
  favBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${img.favorite ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  favBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isFav = await HitgramDB.toggleFavorite(img.id);
    img.favorite = isFav;
    favBtn.className = 'grid-fav-btn' + (isFav ? ' faved' : '');
    favBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    showToast(isFav ? '❤️ Added to favorites' : 'Removed from favorites');
  });

  item.appendChild(imgEl);
  item.appendChild(overlay);
  item.appendChild(favBtn);

  observer.observe(item);
  item.addEventListener('click', () => openViewer(img));

  return item;
}

// ──────────────────── Fullscreen Viewer ────────────────────
let viewerCurrentImage = null;
let viewerScale = 1;
let viewerPinchDist = null;
let viewerDragStart = null;
let viewerTranslate = { x: 0, y: 0 };
let viewerHeaderTimeout;

function openViewer(img) {
  viewerCurrentImage = img;
  const viewer = document.getElementById('image-viewer');
  const viewerImg = document.getElementById('viewer-img');
  const favBtn = document.getElementById('viewer-fav-btn');

  viewerImg.src = getBlobUrl(img.blob);
  viewerImg.className = 'viewer-zoom-in';
  viewerScale = 1;
  viewerTranslate = { x: 0, y: 0 };
  applyViewerTransform();

  if (favBtn) {
    favBtn.className = 'viewer-action-btn' + (img.favorite ? ' faved' : '');
    favBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${img.favorite ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  }

  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';

  showViewerHeader();
}

function closeViewer() {
  const viewer = document.getElementById('image-viewer');
  viewer.classList.remove('open');
  document.body.style.overflow = '';
  viewerCurrentImage = null;
  clearTimeout(viewerHeaderTimeout);
}

function applyViewerTransform() {
  const img = document.getElementById('viewer-img');
  if (!img) return;
  img.style.transform = `translate(${viewerTranslate.x}px, ${viewerTranslate.y}px) scale(${viewerScale})`;
}

function showViewerHeader() {
  const header = document.querySelector('.viewer-header');
  const footer = document.querySelector('.viewer-footer');
  if (header) header.classList.remove('hidden');
  if (footer) footer.classList.remove('hidden');
  clearTimeout(viewerHeaderTimeout);
  viewerHeaderTimeout = setTimeout(() => {
    if (header) header.classList.add('hidden');
    if (footer) footer.classList.add('hidden');
  }, 3000);
}

function initViewer() {
  const viewer = document.getElementById('image-viewer');
  const imgWrap = viewer.querySelector('.viewer-img-wrap');
  const viewerImg = document.getElementById('viewer-img');
  const closeBtn = document.getElementById('viewer-close');
  const favBtn = document.getElementById('viewer-fav-btn');
  const downloadBtn = document.getElementById('viewer-download-btn');

  closeBtn.addEventListener('click', closeViewer);

  // Tap to show/hide header
  imgWrap.addEventListener('click', () => showViewerHeader());

  // Favorite
  if (favBtn) {
    favBtn.addEventListener('click', async () => {
      if (!viewerCurrentImage) return;
      const isFav = await HitgramDB.toggleFavorite(viewerCurrentImage.id);
      viewerCurrentImage.favorite = isFav;
      favBtn.className = 'viewer-action-btn' + (isFav ? ' faved' : '');
      favBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      // Update grid item if visible
      const gridItem = document.querySelector(`.grid-item[data-id="${viewerCurrentImage.id}"] .grid-fav-btn`);
      if (gridItem) {
        gridItem.className = 'grid-fav-btn' + (isFav ? ' faved' : '');
        gridItem.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="${isFav ? 'currentColor' : 'none'}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      }
      showToast(isFav ? '❤️ Added to favorites' : 'Removed from favorites');
    });
  }

  // Download
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!viewerCurrentImage) return;
      const url = getBlobUrl(viewerCurrentImage.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'hitgram-image-' + Date.now() + '.' + (viewerCurrentImage.blob.type.split('/')[1] || 'jpg');
      a.click();
      showToast('Image saved!', 'success');
    });
  }

  // Keyboard close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeViewer();
  });

  // Touch gestures
  let touchStartY = 0;
  let touchStartX = 0;
  let isSwiping = false;

  imgWrap.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      isSwiping = false;
      viewerPinchDist = null;
      viewerImg.style.transition = 'none';
    } else if (e.touches.length === 2) {
      viewerPinchDist = getTouchDist(e.touches);
      isSwiping = false;
      viewerImg.style.transition = 'none';
    }
  }, { passive: true });

  imgWrap.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      if (viewerPinchDist) {
        const delta = dist / viewerPinchDist;
        viewerScale = Math.min(Math.max(viewerScale * delta, 0.5), 5);
        viewerPinchDist = dist;
        applyViewerTransform();
      }
      return;
    }
    if (e.touches.length === 1 && viewerScale <= 1) {
      const dy = e.touches[0].clientY - touchStartY;
      const dx = e.touches[0].clientX - touchStartX;
      if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
        isSwiping = true;
        const progress = Math.min(dy / 200, 1);
        viewer.style.opacity = 1 - progress * 0.6;
        viewer.style.transform = `translateY(${dy * 0.4}px)`;
      }
    }
  }, { passive: false });

  imgWrap.addEventListener('touchend', (e) => {
    viewerPinchDist = null;
    viewerImg.style.transition = '';
    if (isSwiping) {
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (dy > 100) {
        closeViewer();
      }
      viewer.style.opacity = '';
      viewer.style.transform = '';
      isSwiping = false;
    }
    // Double tap to zoom
    if (e.changedTouches.length === 1) {
      const now = Date.now();
      if (now - (imgWrap._lastTap || 0) < 300) {
        if (viewerScale > 1) {
          viewerScale = 1;
          viewerTranslate = { x: 0, y: 0 };
        } else {
          viewerScale = 2.5;
        }
        applyViewerTransform();
      }
      imgWrap._lastTap = now;
    }
  }, { passive: true });
}

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ──────────────────── Upload Handler ────────────────────
function initUploadModal() {
  const addBtn = document.getElementById('btn-add');
  const modal = document.getElementById('upload-modal');
  const dropZone = document.getElementById('upload-drop-zone');
  const fileInput = document.getElementById('file-input');
  const progressWrap = document.getElementById('upload-progress-wrap');
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');

  if (!addBtn || !modal) return;

  addBtn.addEventListener('click', () => modal.classList.add('open'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    processFiles(Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', () => {
    processFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });

  async function processFiles(files) {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) { showToast('Please select image files', 'error'); return; }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles = imageFiles.filter(f => {
      if (f.size > MAX_SIZE) { showToast(`${f.name} is too large (max 10MB)`, 'error'); return false; }
      return true;
    });

    if (!validFiles.length) return;

    const count = await HitgramDB.getImageCount();
    const remaining = HitgramDB.MAX_IMAGES - count;
    if (remaining <= 0) {
      showToast(`Storage full! Max ${HitgramDB.MAX_IMAGES} images`, 'error');
      return;
    }

    const toProcess = validFiles.slice(0, remaining);
    progressWrap.classList.add('active');
    let done = 0;

    for (const file of toProcess) {
      try {
        await HitgramDB.addImage(file, []);
        done++;
        const pct = Math.round((done / toProcess.length) * 100);
        progressBar.style.width = pct + '%';
        progressText.textContent = `Uploading ${done} / ${toProcess.length}...`;
      } catch (e) {
        console.error('Upload error:', e);
      }
    }

    setTimeout(() => {
      progressWrap.classList.remove('active');
      progressBar.style.width = '0%';
      modal.classList.remove('open');
      showToast(`✅ Added ${done} image${done !== 1 ? 's' : ''}!`, 'success');
      // Reload grid
      if (window.loadExploreGrid) window.loadExploreGrid();
    }, 600);
  }
}

// ──────────────────── PWA Install Banner ────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (!localStorage.getItem('hitgram-install-dismissed')) {
    setTimeout(() => {
      const banner = document.getElementById('install-banner');
      if (banner) banner.classList.add('show');
    }, 3000);
  }
});

function initInstallBanner() {
  const banner = document.getElementById('install-banner');
  const installBtn = document.getElementById('install-btn');
  const dismissBtn = document.getElementById('install-dismiss');
  if (!banner) return;

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      banner.classList.remove('show');
      if (outcome === 'accepted') showToast('🎉 Hitgram installed!', 'success');
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      banner.classList.remove('show');
      localStorage.setItem('hitgram-install-dismissed', '1');
    });
  }
}

window.HitgramApp = { showToast, getBlobUrl, renderGridItems, createGridItem, initViewer, initUploadModal, initInstallBanner, closeViewer, openViewer };
