'use strict';


// ── SERVICE WORKER REGISTRATION ─────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// ── STATE ───────────────────────────────────────────────────
const DB_PROFILE = 'h_profile';
const DB_POSTS   = 'h_posts';
let profile = null, posts = [];
let pendingDeleteId = null;
let postImageDataUrl = null, modalImageDataUrl = null, editAvatarDataUrl = null;

// ── STORAGE ─────────────────────────────────────────────────
function loadProfile() { try { return JSON.parse(localStorage.getItem(DB_PROFILE)) || null; } catch { return null; } }
function saveProfile(p) { localStorage.setItem(DB_PROFILE, JSON.stringify(p)); }
function loadPosts()   { try { return JSON.parse(localStorage.getItem(DB_POSTS)) || []; } catch { return []; } }
function savePosts(a)  { localStorage.setItem(DB_POSTS, JSON.stringify(a)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

// ── DATE ─────────────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso), now = new Date();
  const diffMs = now - d, mins = Math.floor(diffMs/60000), hrs = Math.floor(diffMs/3600000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return mins + 'm';
  if (hrs  < 24) return hrs + 'h';
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const yr = d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '';
  return mo[d.getMonth()] + ' ' + d.getDate() + yr + ' · ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}
function fullDate(iso) {
  const d = new Date(iso), mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ' · ' + mo[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

// ── HELPERS ──────────────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function avatarHTML(src, alt) {
  if (src) return `<img src="${src}" alt="${esc(alt)}" loading="lazy" />`;
  return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#222;color:#fff;font-weight:700;font-size:16px;border-radius:50%;">${(alt||'?').charAt(0).toUpperCase()}</div>`;
}
function readImageFile(file, maxSize, cb) {
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h*maxSize/w); w = maxSize; }
        else       { w = Math.round(w*maxSize/h); h = maxSize; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(c.toDataURL('image/jpeg', 0.82));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

// ── ONBOARDING ───────────────────────────────────────────────
function initOnboarding() {
  const screen = document.getElementById('onboarding');
  const nameInp = document.getElementById('displayName');
  const userInp = document.getElementById('username');
  const saveBtn = document.getElementById('saveProfile');
  const wrap    = document.getElementById('avatarUploadWrap');
  const prev    = document.getElementById('avatarPreview');
  const inp     = document.getElementById('avatarInput');
  let avData    = null;

  screen.classList.remove('hidden');

  const check = () => saveBtn.disabled = !(nameInp.value.trim() && userInp.value.trim());
  nameInp.addEventListener('input', check);
  userInp.addEventListener('input', () => { userInp.value = userInp.value.replace(/[^a-zA-Z0-9_]/g,'').toLowerCase(); check(); });
  wrap.addEventListener('click', () => inp.click());
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    readImageFile(f, 300, d => { avData = d; prev.innerHTML = `<img src="${d}" alt="avatar" />`; });
  });
  saveBtn.addEventListener('click', () => {
    const p = { name: nameInp.value.trim(), username: userInp.value.trim(), avatar: avData };
    saveProfile(p); profile = p;
    screen.classList.add('hidden');
    initApp();
  });
}

// ── APP INIT ─────────────────────────────────────────────────
function initApp() {
  document.getElementById('app').classList.remove('hidden');
  posts = loadPosts();
  updateSidebarProfile(); updateComposeAvatars();
  renderFeed(); renderProfileView();
  setupCompose(); setupNavigation(); setupPostModal(); setupEditProfile();
}

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
    el.addEventListener('click', e => {
      e.preventDefault();
      const v = el.dataset.view; switchView(v);
      document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
      document.querySelectorAll(`[data-view="${v}"]`).forEach(x => x.classList.add('active'));
    });
  });
  document.getElementById('sidebarProfile').addEventListener('click', () => {
    switchView('profile');
    document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('[data-view="profile"]').forEach(x => x.classList.add('active'));
  });
}
function switchView(n) {
  document.getElementById('homeView').classList.toggle('hidden', n !== 'home');
  document.getElementById('profileView').classList.toggle('hidden', n !== 'profile');
  if (n === 'profile') renderProfileView();
}

// ── COMPOSE ──────────────────────────────────────────────────
function setupCompose() {
  const txt = document.getElementById('composeText');
  const btn = document.getElementById('submitPost');
  const img = document.getElementById('postImageInput');
  const prv = document.getElementById('composeImagePreview');
  const pi  = document.getElementById('composePreviewImg');
  const rm  = document.getElementById('removeImg');

  txt.addEventListener('input', () => { txt.style.height='auto'; txt.style.height=txt.scrollHeight+'px'; btn.disabled=!(txt.value.trim()||postImageDataUrl); });
  img.addEventListener('change', () => { const f=img.files[0]; if(!f)return; readImageFile(f,1200,d=>{ postImageDataUrl=d; pi.src=d; prv.classList.remove('hidden'); btn.disabled=false; }); });
  rm.addEventListener('click', () => { postImageDataUrl=null; img.value=''; prv.classList.add('hidden'); pi.src=''; btn.disabled=!txt.value.trim(); });
  btn.addEventListener('click', () => {
    createPost(txt.value, postImageDataUrl);
    txt.value=''; txt.style.height='auto'; postImageDataUrl=null; img.value=''; prv.classList.add('hidden'); pi.src=''; btn.disabled=true;
  });
}

// ── POST MODAL ───────────────────────────────────────────────
function setupPostModal() {
  const modal = document.getElementById('postModal');
  const bd    = document.getElementById('modalBackdrop');
  const ccl   = document.getElementById('cancelModal');
  const txt   = document.getElementById('modalComposeText');
  const btn   = document.getElementById('submitPostModal');
  const img   = document.getElementById('modalPostImageInput');
  const prv   = document.getElementById('modalImagePreview');
  const pi    = document.getElementById('modalPreviewImg');
  const rm    = document.getElementById('modalRemoveImg');

  const open  = () => { modal.classList.remove('hidden'); txt.focus(); };
  const close = () => { modal.classList.add('hidden'); txt.value=''; modalImageDataUrl=null; img.value=''; prv.classList.add('hidden'); pi.src=''; btn.disabled=true; };

  document.getElementById('openPostModal').addEventListener('click', open);
  document.getElementById('openPostModalMobile').addEventListener('click', open);
  bd.addEventListener('click', close);
  ccl.addEventListener('click', close);
  txt.addEventListener('input', () => { btn.disabled=!(txt.value.trim()||modalImageDataUrl); });
  img.addEventListener('change', () => { const f=img.files[0]; if(!f)return; readImageFile(f,1200,d=>{ modalImageDataUrl=d; pi.src=d; prv.classList.remove('hidden'); btn.disabled=false; }); });
  rm.addEventListener('click', () => { modalImageDataUrl=null; img.value=''; prv.classList.add('hidden'); pi.src=''; btn.disabled=!txt.value.trim(); });
  btn.addEventListener('click', () => { createPost(txt.value, modalImageDataUrl); close(); });
}

// ── CREATE POST ──────────────────────────────────────────────
function createPost(text, imageUrl) {
  posts.unshift({ id: uid(), text: text.trim(), image: imageUrl||null, createdAt: new Date().toISOString(),
    author: { name: profile.name, username: profile.username, avatar: profile.avatar } });
  savePosts(posts); renderFeed(); updateProfilePostCount();
}

// ── RENDER FEED ──────────────────────────────────────────────
function renderFeed() {
  const feed = document.getElementById('feed');
  const empty = document.getElementById('emptyFeed');
  if (!posts.length) { feed.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  feed.innerHTML = posts.map(postCardHTML).join('');
  attachPostEvents(feed);
}

function postCardHTML(post) {
  const a = post.author || { name:'You', username: profile.username, avatar: profile.avatar };
  const imgH = post.image ? `<div class="post-image"><img src="${esc(post.image)}" alt="post image" loading="lazy"/></div>` : '';
  const txtH = post.text  ? `<p class="post-text">${esc(post.text)}</p>` : '';
  return `<article class="post-card" data-id="${esc(post.id)}">
    <div class="post-avatar">${avatarHTML(a.avatar, a.name)}</div>
    <div class="post-body">
      <div class="post-header">
        <div class="post-meta">
          <span class="post-displayname">${esc(a.name)}</span>
          <span class="post-username">@${esc(a.username)}</span>
          <span class="post-dot">·</span>
          <span class="post-time" title="${esc(fullDate(post.createdAt))}">${formatDate(post.createdAt)}</span>
        </div>
        <div class="post-menu-wrap">
          <button class="post-menu-btn" data-post-id="${esc(post.id)}" aria-label="Post options">•••</button>
          <div class="post-dropdown hidden" id="dropdown-${esc(post.id)}">
            <div class="post-dropdown-item danger" data-delete-id="${esc(post.id)}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Delete post
            </div>
          </div>
        </div>
      </div>
      ${txtH}${imgH}
    </div>
  </article>`;
}

function attachPostEvents(container) {
  container.querySelectorAll('.post-menu-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.postId;
      const dd = document.getElementById('dropdown-' + id);
      const isOpen = !dd.classList.contains('hidden');
      closeAllDropdowns();
      if (!isOpen) dd.classList.remove('hidden');
    });
  });
  container.querySelectorAll('[data-delete-id]').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); pendingDeleteId = el.dataset.deleteId; closeAllDropdowns(); document.getElementById('deleteModal').classList.remove('hidden'); });
  });
}

function closeAllDropdowns() { document.querySelectorAll('.post-dropdown').forEach(d => d.classList.add('hidden')); }
document.addEventListener('click', closeAllDropdowns);

document.getElementById('deleteBackdrop').addEventListener('click', () => { document.getElementById('deleteModal').classList.add('hidden'); pendingDeleteId=null; });
document.getElementById('cancelDelete').addEventListener('click',   () => { document.getElementById('deleteModal').classList.add('hidden'); pendingDeleteId=null; });
document.getElementById('confirmDelete').addEventListener('click',  () => {
  if (!pendingDeleteId) return;
  posts = posts.filter(p => p.id !== pendingDeleteId);
  savePosts(posts); pendingDeleteId=null;
  document.getElementById('deleteModal').classList.add('hidden');
  renderFeed(); renderProfileView();
});

// ── PROFILE VIEW ─────────────────────────────────────────────
function renderProfileView() {
  document.getElementById('profileAvatarLarge').innerHTML = avatarHTML(profile.avatar, profile.name);
  document.getElementById('profileDisplayName').textContent = profile.name;
  document.getElementById('profileUsername').textContent = '@' + profile.username;
  updateProfilePostCount();
  const pf = document.getElementById('profileFeed');
  if (!posts.length) { pf.innerHTML='<div class="empty-feed"><div class="empty-icon">✦</div><p>No posts yet.</p></div>'; return; }
  pf.innerHTML = posts.map(postCardHTML).join('');
  attachPostEvents(pf);
}
function updateProfilePostCount() { document.getElementById('postCount').textContent = posts.length; }

// ── EDIT PROFILE ─────────────────────────────────────────────
function setupEditProfile() {
  const modal    = document.getElementById('editProfileModal');
  const bd       = document.getElementById('editProfileBackdrop');
  const ccl      = document.getElementById('cancelEditProfile');
  const sav      = document.getElementById('saveEditProfile');
  const nameInp  = document.getElementById('editDisplayName');
  const userInp  = document.getElementById('editUsername');
  const wrap     = document.getElementById('editAvatarWrap');
  const prev     = document.getElementById('editAvatarPreview');
  const inp      = document.getElementById('editAvatarInput');

  document.getElementById('editProfileBtn').addEventListener('click', () => {
    nameInp.value = profile.name; userInp.value = profile.username;
    prev.innerHTML = avatarHTML(profile.avatar, profile.name);
    editAvatarDataUrl = profile.avatar;
    modal.classList.remove('hidden');
  });
  wrap.addEventListener('click', () => inp.click());
  inp.addEventListener('change', () => { const f=inp.files[0]; if(!f)return; readImageFile(f,300,d=>{ editAvatarDataUrl=d; prev.innerHTML=`<img src="${d}" alt="avatar"/>`; }); });
  userInp.addEventListener('input', () => { userInp.value = userInp.value.replace(/[^a-zA-Z0-9_]/g,'').toLowerCase(); });

  const close = () => modal.classList.add('hidden');
  bd.addEventListener('click', close);
  ccl.addEventListener('click', close);
  sav.addEventListener('click', () => {
    const n = nameInp.value.trim(), u = userInp.value.trim();
    if (!n || !u) return;
    profile = { name:n, username:u, avatar:editAvatarDataUrl };
    saveProfile(profile);
    posts = posts.map(p => ({...p, author:{name:n,username:u,avatar:editAvatarDataUrl}}));
    savePosts(posts);
    updateSidebarProfile(); updateComposeAvatars(); renderProfileView(); renderFeed();
    close();
  });
}

// ── BOOT ─────────────────────────────────────────────────────
profile = loadProfile();
if (!profile) { initOnboarding(); }
else { document.getElementById('onboarding').classList.add('hidden'); initApp(); }
