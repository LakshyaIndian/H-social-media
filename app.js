/* ============================================================
   H — Personal Feed PWA  |  app.js
   All data in localStorage. No backend.
   ============================================================ */

'use strict';

// ── SERVICE WORKER REGISTRATION ─────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ── STATE ───────────────────────────────────────────────────
const DB_PROFILE = 'h_profile';
const DB_POSTS   = 'h_posts';

let profile = null;
let posts   = [];
let pendingDeleteId = null;
let postImageDataUrl = null;   // for desktop compose
let modalImageDataUrl = null;  // for mobile modal compose
let editAvatarDataUrl = null;
let openDropdownId = null;

// ── LOCAL STORAGE HELPERS ───────────────────────────────────
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(DB_PROFILE)) || null; }
  catch { return null; }
}

function saveProfile(p) {
  localStorage.setItem(DB_PROFILE, JSON.stringify(p));
}

function loadPosts() {
  try { return JSON.parse(localStorage.getItem(DB_POSTS)) || []; }
  catch { return []; }
}

function savePosts(arr) {
  localStorage.setItem(DB_POSTS, JSON.stringify(arr));
}

// ── ID GENERATION ────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── DATE FORMATTING ──────────────────────────────────────────
function formatDate(isoString) {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);

  if (diffMins < 1)  return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHrs  < 24) return `${diffHrs}h`;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day   = d.getDate();
  const month = months[d.getMonth()];
  const year  = d.getFullYear();
  const hours = d.getHours().toString().padStart(2,'0');
  const mins  = d.getMinutes().toString().padStart(2,'0');

  const yearPart = (d.getFullYear() !== now.getFullYear()) ? ` ${year}` : '';
  return `${month} ${day}${yearPart} · ${hours}:${mins}`;
}

function fullDate(isoString) {
  const d = new Date(isoString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} · ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── AVATAR HTML ──────────────────────────────────────────────
function avatarHTML(src, alt) {
  if (src) return `<img src="${src}" alt="${escapeHTML(alt)}" loading="lazy" />`;
  const initials = (alt || '?').charAt(0).toUpperCase();
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#222;color:#fff;font-weight:700;font-size:16px;border-radius:50%;">${initials}</div>`;
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ── ONBOARDING ───────────────────────────────────────────────
function initOnboarding() {
  const screen     = document.getElementById('onboarding');
  const nameInput  = document.getElementById('displayName');
  const userInput  = document.getElementById('username');
  const saveBtn    = document.getElementById('saveProfile');
  const avatarWrap = document.getElementById('avatarUploadWrap');
  const avatarPrev = document.getElementById('avatarPreview');
  const avatarInp  = document.getElementById('avatarInput');
  let avatarData   = null;

  screen.classList.remove('hidden');

  function checkReady() {
    saveBtn.disabled = !(nameInput.value.trim() && userInput.value.trim());
  }

  nameInput.addEventListener('input', checkReady);
  userInput.addEventListener('input', () => {
    userInput.value = userInput.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    checkReady();
  });

  avatarWrap.addEventListener('click', () => avatarInp.click());
  avatarInp.addEventListener('change', () => {
    const file = avatarInp.files[0];
    if (!file) return;
    readImageFile(file, 300, (dataUrl) => {
      avatarData = dataUrl;
      avatarPrev.innerHTML = `<img src="${dataUrl}" alt="avatar" />`;
    });
  });

  saveBtn.addEventListener('click', () => {
    const p = {
      name:     nameInput.value.trim(),
      username: userInput.value.trim(),
      avatar:   avatarData
    };
    saveProfile(p);
    profile = p;
    screen.classList.add('hidden');
    initApp();
  });
}

// ── IMAGE RESIZE HELPER ──────────────────────────────────────
function readImageFile(file, maxSize, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ── APP INIT ─────────────────────────────────────────────────
function initApp() {
  const appEl = document.getElementById('app');
  appEl.classList.remove('hidden');

  posts = loadPosts();

  updateSidebarProfile();
  updateComposeAvatars();
  renderFeed();
  renderProfileView();

  setupCompose();
  setupNavigation();
  setupPostModal();
  setupEditProfile();
}

// ── SIDEBAR PROFILE ──────────────────────────────────────────
function updateSidebarProfile() {
  document.getElementById('sidebarDisplayName').textContent = profile.name;
  document.getElementById('sidebarUsername').textContent    = '@' + profile.username;
  document.getElementById('sidebarAvatar').innerHTML = avatarHTML(profile.avatar, profile.name);
}

function updateComposeAvatars() {
  document.getElementById('composeAvatar').innerHTML = avatarHTML(profile.avatar, profile.name);
  document.getElementById('modalAvatar').innerHTML   = avatarHTML(profile.avatar, profile.name);
}

// ── NAVIGATION ───────────────────────────────────────────────
function setupNavigation() {
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const view = el.dataset.view;
      switchView(view);
      document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll(`[data-view="${view}"]`).forEach(x => x.classList.add('active'));
    });
  });

  document.getElementById('sidebarProfile').addEventListener('click', () => {
    switchView('profile');
    document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('[data-view="profile"]').forEach(x => x.classList.add('active'));
  });
}

function switchView(name) {
  document.getElementById('homeView').classList.toggle('hidden', name !== 'home');
  document.getElementById('profileView').classList.toggle('hidden', name !== 'profile');
  if (name === 'profile') renderProfileView();
}

// ── COMPOSE (DESKTOP) ────────────────────────────────────────
function setupCompose() {
  const textEl    = document.getElementById('composeText');
  const submitBtn = document.getElementById('submitPost');
  const imgInput  = document.getElementById('postImageInput');
  const imgPrev   = document.getElementById('composeImagePreview');
  const prevImg   = document.getElementById('composePreviewImg');
  const removeBtn = document.getElementById('removeImg');

  textEl.addEventListener('input', () => {
    textEl.style.height = 'auto';
    textEl.style.height = textEl.scrollHeight + 'px';
    updateSubmitState(textEl, submitBtn);
  });

  imgInput.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (!file) return;
    readImageFile(file, 1200, (dataUrl) => {
      postImageDataUrl = dataUrl;
      prevImg.src = dataUrl;
      imgPrev.classList.remove('hidden');
      updateSubmitState(textEl, submitBtn);
    });
  });

  removeBtn.addEventListener('click', () => {
    postImageDataUrl = null;
    imgInput.value = '';
    imgPrev.classList.add('hidden');
    prevImg.src = '';
    updateSubmitState(textEl, submitBtn);
  });

  submitBtn.addEventListener('click', () => {
    createPost(textEl.value, postImageDataUrl);
    textEl.value = '';
    textEl.style.height = 'auto';
    postImageDataUrl = null;
    imgInput.value = '';
    imgPrev.classList.add('hidden');
    prevImg.src = '';
    updateSubmitState(textEl, submitBtn);
  });
}

function updateSubmitState(textEl, btn) {
  btn.disabled = !(textEl.value.trim() || postImageDataUrl || modalImageDataUrl);
}

// ── POST MODAL (MOBILE) ──────────────────────────────────────
function setupPostModal() {
  const modal       = document.getElementById('postModal');
  const backdrop    = document.getElementById('modalBackdrop');
  const cancelBtn   = document.getElementById('cancelModal');
  const textEl      = document.getElementById('modalComposeText');
  const submitBtn   = document.getElementById('submitPostModal');
  const imgInput    = document.getElementById('modalPostImageInput');
  const imgPrev     = document.getElementById('modalImagePreview');
  const prevImg     = document.getElementById('modalPreviewImg');
  const removeBtn   = document.getElementById('modalRemoveImg');

  function openModal() {
    modal.classList.remove('hidden');
    textEl.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
    textEl.value = '';
    modalImageDataUrl = null;
    imgInput.value = '';
    imgPrev.classList.add('hidden');
    prevImg.src = '';
    submitBtn.disabled = true;
  }

  document.getElementById('openPostModal').addEventListener('click', openModal);
  document.getElementById('openPostModalMobile').addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  textEl.addEventListener('input', () => {
    submitBtn.disabled = !(textEl.value.trim() || modalImageDataUrl);
  });

  imgInput.addEventListener('change', () => {
    const file = imgInput.files[0];
    if (!file) return;
    readImageFile(file, 1200, (dataUrl) => {
      modalImageDataUrl = dataUrl;
      prevImg.src = dataUrl;
      imgPrev.classList.remove('hidden');
      submitBtn.disabled = false;
    });
  });

  removeBtn.addEventListener('click', () => {
    modalImageDataUrl = null;
    imgInput.value = '';
    imgPrev.classList.add('hidden');
    prevImg.src = '';
    submitBtn.disabled = !textEl.value.trim();
  });

  submitBtn.addEventListener('click', () => {
    createPost(textEl.value, modalImageDataUrl);
    closeModal();
  });
}

// ── CREATE POST ──────────────────────────────────────────────
function createPost(text, imageUrl) {
  const post = {
    id:        uid(),
    text:      text.trim(),
    image:     imageUrl || null,
    createdAt: new Date().toISOString(),
    author: {
      name:     profile.name,
      username: profile.username,
      avatar:   profile.avatar
    }
  };
  posts.unshift(post);
  savePosts(posts);
  renderFeed();
  updateProfilePostCount();
}

// ── RENDER FEED ──────────────────────────────────────────────
function renderFeed() {
  const feed      = document.getElementById('feed');
  const emptyEl   = document.getElementById('emptyFeed');

  if (posts.length === 0) {
    feed.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  feed.innerHTML = posts.map(postCardHTML).join('');
  attachPostEvents(feed);
}

function postCardHTML(post) {
  const author  = post.author || { name: 'You', username: profile.username, avatar: profile.avatar };
  const imgHTML = post.image
    ? `<div class="post-image"><img src="${escapeHTML(post.image)}" alt="post image" loading="lazy" /></div>`
    : '';
  const textHTML = post.text
    ? `<p class="post-text">${escapeHTML(post.text)}</p>`
    : '';

  return `
  <article class="post-card" data-id="${escapeHTML(post.id)}">
    <div class="post-avatar">${avatarHTML(author.avatar, author.name)}</div>
    <div class="post-body">
      <div class="post-header">
        <div class="post-meta">
          <span class="post-displayname">${escapeHTML(author.name)}</span>
          <span class="post-username">@${escapeHTML(author.username)}</span>
          <span class="post-dot">·</span>
          <span class="post-time" title="${escapeHTML(fullDate(post.createdAt))}">${formatDate(post.createdAt)}</span>
        </div>
        <div class="post-menu-wrap">
          <button class="post-menu-btn" data-post-id="${escapeHTML(post.id)}" aria-label="Post options">•••</button>
          <div class="post-dropdown hidden" id="dropdown-${escapeHTML(post.id)}">
            <div class="post-dropdown-item danger" data-delete-id="${escapeHTML(post.id)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete post
            </div>
          </div>
        </div>
      </div>
      ${textHTML}
      ${imgHTML}
    </div>
  </article>`;
}

function attachPostEvents(container) {
  // Menu toggle
  container.querySelectorAll('.post-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.postId;
      const dropdown = document.getElementById('dropdown-' + id);
      const isOpen = !dropdown.classList.contains('hidden');

      closeAllDropdowns();
      if (!isOpen) {
        dropdown.classList.remove('hidden');
        openDropdownId = id;
      }
    });
  });

  // Delete
  container.querySelectorAll('[data-delete-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingDeleteId = el.dataset.deleteId;
      closeAllDropdowns();
      openDeleteModal();
    });
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.post-dropdown').forEach(d => d.classList.add('hidden'));
  openDropdownId = null;
}

document.addEventListener('click', closeAllDropdowns);

// ── DELETE FLOW ──────────────────────────────────────────────
function openDeleteModal() {
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
  pendingDeleteId = null;
}

document.getElementById('deleteBackdrop').addEventListener('click', closeDeleteModal);
document.getElementById('cancelDelete').addEventListener('click', closeDeleteModal);

document.getElementById('confirmDelete').addEventListener('click', () => {
  if (!pendingDeleteId) return;
  posts = posts.filter(p => p.id !== pendingDeleteId);
  savePosts(posts);
  closeDeleteModal();
  renderFeed();
  renderProfileView();
});

// ── PROFILE VIEW ─────────────────────────────────────────────
function renderProfileView() {
  document.getElementById('profileAvatarLarge').innerHTML = avatarHTML(profile.avatar, profile.name);
  document.getElementById('profileDisplayName').textContent = profile.name;
  document.getElementById('profileUsername').textContent = '@' + profile.username;
  updateProfilePostCount();

  const profileFeed = document.getElementById('profileFeed');
  if (posts.length === 0) {
    profileFeed.innerHTML = '<div class="empty-feed"><div class="empty-icon">✦</div><p>No posts yet.</p></div>';
    return;
  }
  profileFeed.innerHTML = posts.map(postCardHTML).join('');
  attachPostEvents(profileFeed);
}

function updateProfilePostCount() {
  document.getElementById('postCount').textContent = posts.length;
}

// ── EDIT PROFILE ─────────────────────────────────────────────
function setupEditProfile() {
  const modal      = document.getElementById('editProfileModal');
  const backdrop   = document.getElementById('editProfileBackdrop');
  const cancelBtn  = document.getElementById('cancelEditProfile');
  const saveBtn    = document.getElementById('saveEditProfile');
  const nameInput  = document.getElementById('editDisplayName');
  const userInput  = document.getElementById('editUsername');
  const avatarWrap = document.getElementById('editAvatarWrap');
  const avatarPrev = document.getElementById('editAvatarPreview');
  const avatarInp  = document.getElementById('editAvatarInput');

  document.getElementById('editProfileBtn').addEventListener('click', () => {
    nameInput.value = profile.name;
    userInput.value = profile.username;
    avatarPrev.innerHTML = avatarHTML(profile.avatar, profile.name);
    editAvatarDataUrl = profile.avatar;
    modal.classList.remove('hidden');
  });

  avatarWrap.addEventListener('click', () => avatarInp.click());
  avatarInp.addEventListener('change', () => {
    const file = avatarInp.files[0];
    if (!file) return;
    readImageFile(file, 300, (dataUrl) => {
      editAvatarDataUrl = dataUrl;
      avatarPrev.innerHTML = `<img src="${dataUrl}" alt="avatar" />`;
    });
  });

  userInput.addEventListener('input', () => {
    userInput.value = userInput.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
  });

  function closeModal() { modal.classList.add('hidden'); }
  backdrop.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  saveBtn.addEventListener('click', () => {
    const newName = nameInput.value.trim();
    const newUser = userInput.value.trim();
    if (!newName || !newUser) return;

    profile = { name: newName, username: newUser, avatar: editAvatarDataUrl };
    saveProfile(profile);

    // Update posts authored by the user (same username) – best effort
    posts = posts.map(p => ({
      ...p,
      author: { name: newName, username: newUser, avatar: editAvatarDataUrl }
    }));
    savePosts(posts);

    updateSidebarProfile();
    updateComposeAvatars();
    renderProfileView();
    renderFeed();
    closeModal();
  });
}

// ── BOOT ─────────────────────────────────────────────────────
(function boot() {
  profile = loadProfile();
  if (!profile) {
    initOnboarding();
  } else {
    document.getElementById('onboarding').classList.add('hidden');
    initApp();
  }
})();
