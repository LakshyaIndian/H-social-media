import { useState, useEffect, useRef, useCallback } from "react";

// ── Storage keys ──
const KEY_PROFILE = "h_profile";
const KEY_POSTS   = "h_posts";
const MAX_CHARS   = 280;

// ── Helpers ──
const genId    = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const initials = n => n.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const fmtDate  = iso => {
  const d = new Date(iso), now = new Date(), diff = (now-d)/1000;
  if (diff < 60)   return Math.floor(diff)+"s";
  if (diff < 3600) return Math.floor(diff/60)+"m";
  if (diff < 86400)return Math.floor(diff/3600)+"h";
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"})
    +" · "+d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false});
};
const resizeImg = (file, maxPx) => new Promise(res => {
  const r = new FileReader();
  r.onload = e => {
    const img = new Image();
    img.onload = () => {
      let w=img.width, h=img.height;
      if(w>maxPx||h>maxPx){ if(w>h){h=Math.round(h*maxPx/w);w=maxPx;}else{w=Math.round(w*maxPx/h);h=maxPx;} }
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      res(c.toDataURL("image/jpeg",0.82));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
});
const loadLS = (k,fb) => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } };
const saveLS = (k,v) => { try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} };

// ── SVG Icons ──
const Ic = ({d,size=20,fill="none",sw=2,extra=""}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
    strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
    {d}
  </svg>
);
const IcHome     = ({s=22}) => <Ic size={s} d={<><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></>}/>;
const IcSearch   = ({s=22}) => <Ic size={s} d={<><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></>}/>;
const IcBell     = ({s=22}) => <Ic size={s} d={<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></>}/>;
const IcMail     = ({s=22}) => <Ic size={s} d={<><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></>}/>;
const IcBkmk     = ({s=22}) => <Ic size={s} d={<path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>}/>;
const IcUser     = ({s=22}) => <Ic size={s} d={<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></>}/>;
const IcImg      = ({s=20}) => <Ic size={s} d={<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>}/>;
const IcTrash    = ({s=18}) => <Ic size={s} d={<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>}/>;
const IcReply    = ({s=18}) => <Ic size={s} sw={1.75} d={<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>}/>;
const IcRepost   = ({s=18}) => <Ic size={s} sw={1.75} d={<><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></>}/>;
const IcHeart    = ({s=18,filled=false}) => <Ic size={s} sw={1.75} fill={filled?"#f91880":"none"} d={<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke={filled?"#f91880":"currentColor"}/>}/>;
const IcShare    = ({s=18}) => <Ic size={s} sw={1.75} d={<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>}/>;
const IcDots     = ({s=18}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>;
const IcGlobe    = ({s=13}) => <Ic size={s} d={<><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></>}/>;
const IcFeather  = ({s=28}) => <Ic size={s} sw={1.5} d={<><path d="M20.24 12.24a6 6 0 00-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></>}/>;
const IcPlus     = ({s=14}) => <Ic size={s} d={<><path d="M12 5v14M5 12h14"/></>}/>;

// ── CSS (injected once) ──
const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#000;--bg-el:#0d0d0d;--bg-card:#111;--bg-hov:#161616;
  --border:#222;--border-l:#2f2f2f;
  --acc:#fff;--acc-dim:#e7e9ea;--muted:#71767b;--muted-l:#555;
  --blue:#1d9bf0;--red:#f4212e;
}
body{background:var(--bg);color:var(--acc-dim);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:0}
.shell{display:flex;justify-content:center;max-width:1300px;margin:0 auto;min-height:100vh}

/* sidebar */
.sidebar{width:275px;position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:0 12px;flex-shrink:0;overflow:hidden}
.sb-logo{display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:9999px;margin:4px 0 4px -4px;cursor:pointer;transition:background .15s;text-decoration:none;color:var(--acc)}
.sb-logo:hover{background:var(--bg-hov)}
.logo-h{font-size:28px;font-weight:800;letter-spacing:-1px;font-style:italic}
.sb-nav{flex:1;padding-top:4px}
.nav-it{display:flex;align-items:center;gap:20px;padding:12px;border-radius:9999px;cursor:pointer;color:var(--acc-dim);font-size:1.15rem;font-weight:400;margin-bottom:2px;transition:background .15s;width:fit-content}
.nav-it:hover{background:var(--bg-hov)}
.nav-it.active{font-weight:700;color:var(--acc)}
.sb-prof{display:flex;align-items:center;gap:12px;padding:12px;border-radius:9999px;cursor:pointer;transition:background .15s;margin-bottom:16px}
.sb-prof:hover{background:var(--bg-hov)}
.sb-prof-name{font-weight:700;font-size:.9rem;color:var(--acc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-prof-handle{font-size:.82rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* main col */
.main-col{width:600px;border-left:1px solid var(--border);border-right:1px solid var(--border);min-height:100vh;flex-shrink:0}
.tl-header{position:sticky;top:0;z-index:100;background:rgba(0,0,0,.85);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:16px 16px 0}
.tl-header h2{font-size:1.2rem;font-weight:800;color:var(--acc);padding-bottom:14px}
.tabs{display:flex;margin:0 -16px}
.tab{flex:1;text-align:center;padding:14px 0;font-size:.9rem;font-weight:500;color:var(--muted);cursor:pointer;position:relative;transition:background .15s}
.tab:hover{background:rgba(255,255,255,.03)}
.tab.active{color:var(--acc);font-weight:700}
.tab.active::after{content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:56px;height:4px;background:var(--blue);border-radius:9999px}

/* composer */
.composer{display:flex;gap:12px;padding:12px 16px 10px;border-bottom:1px solid var(--border)}
.c-body{flex:1;min-width:0}
.c-audience{display:inline-flex;align-items:center;gap:4px;color:var(--blue);font-size:.82rem;font-weight:700;padding:3px 10px;border:1px solid var(--blue);border-radius:9999px;margin-bottom:8px;cursor:pointer}
.c-textarea{width:100%;background:transparent;border:none;outline:none;color:var(--acc);font-size:1.2rem;font-family:inherit;resize:none;line-height:1.5;min-height:60px;caret-color:var(--blue)}
.c-textarea::placeholder{color:var(--muted)}
.c-divider{height:1px;background:var(--border);margin:10px 0}
.c-actions{display:flex;align-items:center;justify-content:space-between}
.c-tools{display:flex;align-items:center;gap:2px}
.tool-btn{background:none;border:none;color:var(--blue);cursor:pointer;padding:8px;border-radius:9999px;display:flex;align-items:center;transition:background .15s}
.tool-btn:hover{background:rgba(29,155,240,.1)}
.char-ct{font-size:.82rem;color:var(--muted)}
.char-ct.warn{color:#ffd400}.char-ct.danger{color:var(--red)}
.post-btn{background:var(--acc);color:var(--bg);border:none;border-radius:9999px;padding:8px 20px;font-size:.92rem;font-weight:700;cursor:pointer;transition:background .15s;font-family:inherit}
.post-btn:hover{background:#e7e9ea}
.post-btn:disabled{opacity:.4;cursor:not-allowed}
.c-img-prev{position:relative;margin-top:8px;border-radius:12px;overflow:hidden;border:1px solid var(--border)}
.c-img-prev img{width:100%;max-height:280px;object-fit:cover;display:block}
.rm-img{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.75);border:none;color:#fff;border-radius:9999px;width:30px;height:30px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center}
.rm-img:hover{background:rgba(0,0,0,.9)}

/* post card */
.post-card{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;position:relative;animation:postIn .2s ease}
@keyframes postIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
.post-card:hover{background:var(--bg-hov)}
.p-body{flex:1;min-width:0}
.p-header{display:flex;align-items:baseline;gap:4px;flex-wrap:wrap;margin-bottom:2px}
.p-name{font-weight:700;font-size:.92rem;color:var(--acc)}
.p-handle,.p-dot,.p-time{color:var(--muted);font-size:.88rem}
.p-text{font-size:.95rem;line-height:1.55;color:var(--acc-dim);white-space:pre-wrap;word-break:break-word;margin-bottom:4px}
.p-img{border-radius:12px;overflow:hidden;margin-top:10px;border:1px solid var(--border)}
.p-img img{width:100%;max-height:500px;object-fit:cover;display:block}
.p-actions{display:flex;align-items:center;gap:20px;margin-top:10px}
.p-act{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:.82rem;cursor:pointer;padding:4px;border-radius:9999px;transition:color .15s;background:none;border:none;font-family:inherit}
.p-act:hover{color:var(--blue)}
.p-act.like:hover{color:#f91880}
.p-act.liked{color:#f91880}

/* avatar */
.avatar{border-radius:9999px;overflow:hidden;background:var(--bg-el);flex-shrink:0}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
.avatar-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--blue);color:#fff;font-weight:700}

/* menu */
.menu-wrap{position:absolute;top:10px;right:12px}
.menu-trig{background:none;border:none;color:var(--muted);cursor:pointer;width:34px;height:34px;border-radius:9999px;display:flex;align-items:center;justify-content:center;opacity:0;transition:background .15s,opacity .15s}
.post-card:hover .menu-trig{opacity:1}
.menu-trig:hover{background:rgba(29,155,240,.1);color:var(--blue)}
.dropdown{position:absolute;top:calc(100% + 4px);right:0;background:var(--bg-card);border:1px solid var(--border-l);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.8);min-width:200px;z-index:999;overflow:hidden;animation:menuIn .12s ease}
@keyframes menuIn{from{opacity:0;transform:scale(.95) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}
.dd-item{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;font-size:.92rem;font-weight:500;color:var(--acc-dim);transition:background .15s}
.dd-item:hover{background:var(--bg-hov)}
.dd-item.danger{color:var(--red)}

/* empty */
.empty{display:flex;flex-direction:column;align-items:center;padding:60px 32px;gap:12px;text-align:center}
.empty-icon{width:60px;height:60px;border-radius:9999px;background:var(--bg-el);display:flex;align-items:center;justify-content:center;color:var(--muted);margin-bottom:8px}
.empty h3{font-size:1.5rem;font-weight:800;color:var(--acc)}
.empty p{font-size:.92rem;color:var(--muted);max-width:300px;line-height:1.5}

/* right sidebar */
.rsidebar{width:350px;padding:12px 24px;flex-shrink:0}
.srch-bar{background:var(--bg-el);border:1px solid transparent;border-radius:9999px;display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:16px;transition:border-color .15s,background .15s}
.srch-bar:focus-within{background:var(--bg);border-color:var(--blue)}
.srch-bar input{background:none;border:none;outline:none;color:var(--acc);font-size:.92rem;font-family:inherit;width:100%}
.srch-bar input::placeholder{color:var(--muted)}
.widget{background:var(--bg-el);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid var(--border)}
.widget h3{font-size:1.05rem;font-weight:800;color:var(--acc);margin-bottom:12px}
.w-stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:.88rem}
.w-stat:last-child{border-bottom:none}
.w-label{color:var(--muted)}.w-val{font-weight:700;color:var(--acc)}

/* modal */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:var(--bg);border-radius:16px;width:90%;max-width:480px;padding:40px 32px;animation:slideUp .25s ease;border:1px solid var(--border);max-height:90vh;overflow-y:auto}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.modal-logo{text-align:center;margin-bottom:24px;font-size:42px;font-weight:800;color:var(--acc);font-style:italic;letter-spacing:-2px}
.modal h2{font-size:1.6rem;font-weight:800;color:var(--acc);margin-bottom:8px}
.modal>p{color:var(--muted);font-size:.92rem;margin-bottom:24px;line-height:1.5}
.av-area{display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:24px;cursor:pointer}
.av-circle{width:80px;height:80px;border-radius:9999px;border:2px dashed var(--border-l);display:flex;align-items:center;justify-content:center;overflow:hidden;transition:border-color .15s;background:var(--bg-el)}
.av-area:hover .av-circle{border-color:var(--blue)}
.av-circle img{width:100%;height:100%;object-fit:cover}
.av-label{font-size:.88rem;color:var(--blue);font-weight:600}
.field{margin-bottom:18px}
.field label{display:block;font-size:.82rem;color:var(--muted);margin-bottom:6px;font-weight:500}
.field input{width:100%;background:#0d0d0d;border:1px solid var(--border-l);border-radius:12px;padding:13px 16px;color:var(--acc);font-size:.97rem;font-family:inherit;outline:none;transition:border-color .15s}
.field input:focus{border-color:var(--blue)}
.field input::placeholder{color:var(--muted-l)}
.field-hint{font-size:.78rem;color:var(--muted);margin-top:4px}
.modal-submit{width:100%;background:var(--acc);color:var(--bg);border:none;border-radius:9999px;padding:14px;font-size:.97rem;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;margin-top:8px}
.modal-submit:hover{background:#e7e9ea}
.modal-submit:disabled{opacity:.4;cursor:not-allowed}

/* toast */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--blue);color:#fff;padding:11px 22px;border-radius:9999px;font-size:.88rem;font-weight:600;z-index:99999;animation:toastIn .2s ease,toastOut .2s ease 2.3s forwards;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.5)}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateX(-50%) translateY(12px)}}

/* mobile */
.mob-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,.92);border-top:1px solid var(--border);backdrop-filter:blur(12px);z-index:1000;padding-bottom:env(safe-area-inset-bottom)}
.mob-nav-inner{display:flex}
.mob-item{flex:1;display:flex;align-items:center;justify-content:center;padding:14px 8px;color:var(--acc-dim);cursor:pointer}
@media(max-width:1100px){.rsidebar{display:none}}
@media(max-width:768px){
  .sidebar{display:none}
  .main-col{width:100%;border:none}
  .shell{flex-direction:column}
  .mob-nav{display:block}
  body{padding-bottom:70px}
}
`;

// ── Avatar component ──
const Avatar = ({ src, name, size = 40 }) => (
  <div className="avatar" style={{ width: size, height: size }}>
    {src
      ? <img src={src} alt="avatar" />
      : <div className="avatar-ph" style={{ fontSize: size * 0.35 }}>{initials(name)}</div>}
  </div>
);

// ── Toast ──
const Toast = ({ msg, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2700); return () => clearTimeout(t); }, []);
  return <div className="toast">{msg}</div>;
};

// ── Onboarding ──
const Onboarding = ({ onDone }) => {
  const [name, setName]     = useState("");
  const [handle, setHandle] = useState("");
  const [avatar, setAvatar] = useState(null);
  const fileRef = useRef();

  const handleFile = async e => {
    const f = e.target.files[0];
    if (!f) return;
    const data = await resizeImg(f, 300);
    setAvatar(data);
  };
  const handleHandle = e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
  const canSubmit = name.trim() && handle.trim();

  const submit = () => {
    const h = handle.startsWith("@") ? handle : "@" + handle;
    const p = { name: name.trim(), handle: h, avatar };
    saveLS(KEY_PROFILE, p);
    onDone(p);
  };

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-logo">H</div>
        <h2>Welcome to H</h2>
        <p>Your personal offline space. Set up your profile to get started.</p>

        <div className="av-area" onClick={() => fileRef.current.click()}>
          <div className="av-circle">
            {avatar
              ? <img src={avatar} alt="avatar" />
              : <IcPlus s={28} />}
          </div>
          <span className="av-label">{avatar ? "Change photo" : "Add profile photo"}</span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
        </div>

        <div className="field">
          <label>Display Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" maxLength={50} autoComplete="off" />
        </div>
        <div className="field">
          <label>Username</label>
          <input value={handle} onChange={handleHandle} placeholder="username" maxLength={30} autoComplete="off" />
          <div className="field-hint">Will appear as @{handle || "username"}</div>
        </div>
        <button className="modal-submit" disabled={!canSubmit} onClick={submit}>Let's go →</button>
      </div>
    </div>
  );
};

// ── Post Card ──
const PostCard = ({ post, profile, onDelete, onLike }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <article className="post-card">
      <Avatar src={profile.avatar} name={profile.name} size={40} />
      <div className="p-body">
        <div className="p-header">
          <span className="p-name">{profile.name}</span>
          <span className="p-handle">{profile.handle}</span>
          <span className="p-dot">·</span>
          <span className="p-time">{fmtDate(post.timestamp)}</span>
        </div>
        {post.text && <div className="p-text">{post.text}</div>}
        {post.image && <div className="p-img"><img src={post.image} alt="post" loading="lazy" /></div>}
        <div className="p-actions">
          <button className="p-act"><IcReply /> <span>0</span></button>
          <button className="p-act"><IcRepost /> <span>0</span></button>
          <button className={`p-act like${post.liked ? " liked" : ""}`} onClick={() => onLike(post.id)}>
            <IcHeart filled={post.liked} /> <span>{post.likes}</span>
          </button>
          <button className="p-act"><IcShare /></button>
        </div>
      </div>
      <div className="menu-wrap" ref={menuRef}>
        <button className="menu-trig" onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}>
          <IcDots />
        </button>
        {menuOpen && (
          <div className="dropdown">
            <div className="dd-item danger" onClick={() => { onDelete(post.id); setMenuOpen(false); }}>
              <IcTrash /> Delete
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

// ── Composer ──
const Composer = ({ profile, onPost }) => {
  const [text, setText]   = useState("");
  const [img, setImg]     = useState(null);
  const fileRef = useRef();
  const taRef   = useRef();

  const charCls = text.length > 260 ? "char-ct danger" : text.length > 220 ? "char-ct warn" : "char-ct";
  const canPost = text.trim().length > 0 || img;

  const handleImg = async e => {
    const f = e.target.files[0]; if (!f) return;
    setImg(await resizeImg(f, 1200));
  };
  const handleKey = e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canPost) submit(); };

  const submit = () => {
    onPost({ id: genId(), text: text.trim(), image: img, timestamp: new Date().toISOString(), liked: false, likes: 0 });
    setText(""); setImg(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="composer">
      <Avatar src={profile.avatar} name={profile.name} size={40} />
      <div className="c-body">
        <div className="c-audience"><IcGlobe /> Everyone</div>
        <textarea
          ref={taRef}
          className="c-textarea"
          placeholder="What's happening?"
          maxLength={MAX_CHARS}
          rows={2}
          value={text}
          onChange={e => { setText(e.target.value); e.target.style.height="auto"; e.target.style.height=e.target.scrollHeight+"px"; }}
          onKeyDown={handleKey}
        />
        {img && (
          <div className="c-img-prev">
            <img src={img} alt="preview" />
            <button className="rm-img" onClick={() => setImg(null)}>✕</button>
          </div>
        )}
        <div className="c-divider" />
        <div className="c-actions">
          <div className="c-tools">
            <label className="tool-btn" title="Add photo">
              <IcImg />
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImg} />
            </label>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {text.length > 0 && <span className={charCls}>{text.length}</span>}
            <button className="post-btn" disabled={!canPost} onClick={submit}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main App ──
export default function App() {
  const [profile, setProfile] = useState(() => loadLS(KEY_PROFILE, null));
  const [posts, setPosts]     = useState(() => loadLS(KEY_POSTS, []));
  const [toast, setToast]     = useState(null);

  // Persist posts
  useEffect(() => { saveLS(KEY_POSTS, posts); }, [posts]);

  const showToast = msg => { setToast(null); setTimeout(() => setToast(msg), 10); };

  const handleOnboard = p => { setProfile(p); showToast("Welcome to H ✦"); };

  const handlePost = p => {
    setPosts(prev => [p, ...prev]);
    showToast("Your post is live ✦");
  };

  const handleDelete = id => {
    setPosts(prev => prev.filter(p => p.id !== id));
    showToast("Post deleted");
  };

  const handleLike = id => {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  };

  const postCount   = posts.length;
  const photoCount  = posts.filter(p => p.image).length;
  const since = postCount > 0
    ? new Date(posts[posts.length-1].timestamp).toLocaleDateString("en-US",{month:"short",year:"numeric"})
    : new Date().toLocaleDateString("en-US",{month:"short",year:"numeric"});

  // Sidebar avatar
  const SbAvatar = profile ? (
    profile.avatar
      ? <img src={profile.avatar} alt="av" style={{width:40,height:40,borderRadius:"50%",objectFit:"cover"}} />
      : <div style={{width:40,height:40,borderRadius:"50%",background:"var(--blue)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:"1rem"}}>{initials(profile.name)}</div>
  ) : null;

  return (
    <>
      <style>{CSS}</style>

      {!profile && <Onboarding onDone={handleOnboard} />}

      {profile && (
        <div className="shell">
          {/* Left sidebar */}
          <nav className="sidebar">
            <a className="sb-logo" href="#"><span className="logo-h">H</span></a>
            <div className="sb-nav">
              {[["Home", <IcHome/>, true], ["Explore", <IcSearch/>], ["Notifications", <IcBell/>],
                ["Messages", <IcMail/>], ["Bookmarks", <IcBkmk/>], ["Profile", <IcUser/>]
              ].map(([label, icon, active]) => (
                <div key={label} className={`nav-it${active?" active":""}`}>{icon}<span>{label}</span></div>
              ))}
            </div>
            <div className="sb-prof">
              {SbAvatar}
              <div style={{flex:1,minWidth:0}}>
                <div className="sb-prof-name">{profile.name}</div>
                <div className="sb-prof-handle">{profile.handle}</div>
              </div>
              <span style={{color:"var(--muted)"}}>···</span>
            </div>
          </nav>

          {/* Main */}
          <main className="main-col">
            <div className="tl-header">
              <h2>For You</h2>
              <div className="tabs">
                <div className="tab active">For You</div>
                <div className="tab">Following</div>
              </div>
            </div>
            <Composer profile={profile} onPost={handlePost} />
            <div>
              {posts.length === 0
                ? <div className="empty">
                    <div className="empty-icon"><IcFeather /></div>
                    <h3>Nothing here yet</h3>
                    <p>When you post something, it will show up here.</p>
                  </div>
                : posts.map(p => (
                    <PostCard key={p.id} post={p} profile={profile}
                      onDelete={handleDelete} onLike={handleLike} />
                  ))
              }
            </div>
          </main>

          {/* Right sidebar */}
          <aside className="rsidebar">
            <div className="srch-bar">
              <IcSearch s={18} />
              <input placeholder="Search H" />
            </div>
            <div className="widget">
              <h3>Your Stats</h3>
              <div className="w-stat"><span className="w-label">Posts</span><span className="w-val">{postCount}</span></div>
              <div className="w-stat"><span className="w-label">With photos</span><span className="w-val">{photoCount}</span></div>
              <div className="w-stat"><span className="w-label">Member since</span><span className="w-val">{since}</span></div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile nav */}
      {profile && (
        <div className="mob-nav">
          <div className="mob-nav-inner">
            {[<IcHome/>, <IcSearch/>, <IcBell/>, <IcUser/>].map((ic, i) => (
              <div key={i} className="mob-item">{ic}</div>
            ))}
          </div>
        </div>
      )}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </>
  );
}
