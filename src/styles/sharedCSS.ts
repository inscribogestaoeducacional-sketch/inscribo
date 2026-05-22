export const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Plus Jakarta Sans', sans-serif; color: #111827; overflow-x: hidden; background: #fff; }

@keyframes fadeUp    { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn    { from{opacity:0} to{opacity:1} }
@keyframes floatY    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
@keyframes slideLeft { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes pulse2    { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes scaleIn   { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
@keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }

.reveal { opacity:0; transform:translateY(32px); transition:opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.reveal.in { opacity:1; transform:none; }
.d1.in { transition-delay:.07s; }
.d2.in { transition-delay:.14s; }
.d3.in { transition-delay:.21s; }

.s-title { font-family:'Bricolage Grotesque',sans-serif; font-weight:900; line-height:1.06; letter-spacing:-.04em; }

.btn-g {
  display:inline-flex; align-items:center; gap:8px;
  background:#00523C; color:#fff; border:none; border-radius:999px;
  padding:15px 32px; font-size:15px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:transform .18s, box-shadow .18s, background .18s;
  box-shadow:0 4px 24px rgba(0,82,60,.3);
  font-family:'Plus Jakarta Sans',sans-serif;
}
.btn-g:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(0,82,60,.4); background:#006B50; }

.btn-white {
  display:inline-flex; align-items:center; gap:8px;
  background:#fff; color:#00523C; border:none; border-radius:999px;
  padding:15px 32px; font-size:15px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:transform .18s, box-shadow .18s;
  box-shadow:0 6px 28px rgba(0,0,0,.18);
  font-family:'Plus Jakarta Sans',sans-serif;
}
.btn-white:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(0,0,0,.25); }

.btn-ghost {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(255,255,255,.1); color:#fff;
  border:1.5px solid rgba(255,255,255,.35); border-radius:999px;
  padding:14px 28px; font-size:14px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:background .2s, border-color .2s;
  font-family:'Plus Jakarta Sans',sans-serif;
}
.btn-ghost:hover { background:rgba(255,255,255,.2); border-color:rgba(255,255,255,.6); }

.btn-outline-green {
  display:inline-flex; align-items:center; gap:8px;
  background:transparent; color:#00523C;
  border:1.5px solid #00523C; border-radius:999px;
  padding:11px 24px; font-size:13px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:background .2s, color .2s;
  font-family:'Plus Jakarta Sans',sans-serif;
}
.btn-outline-green:hover { background:#00523C; color:#fff; }

.btn-teal {
  display:inline-flex; align-items:center; gap:8px;
  background:#00A896; color:#fff; border:none; border-radius:999px;
  padding:15px 32px; font-size:15px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:transform .18s, box-shadow .18s;
  box-shadow:0 4px 24px rgba(0,168,150,.35);
  font-family:'Plus Jakarta Sans',sans-serif;
}
.btn-teal:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(0,168,150,.45); }

.card {
  background:#fff; border:1.5px solid #E8ECF0; border-radius:20px;
  transition:border-color .25s, box-shadow .25s, transform .25s;
}
.card:hover { border-color:#0DD3BF; box-shadow:0 16px 48px rgba(13,211,191,.15); transform:translateY(-6px); }

.card-dark {
  background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); border-radius:20px;
  transition:border-color .25s, background .25s, transform .25s;
}
.card-dark:hover { background:rgba(255,255,255,.09); border-color:rgba(13,211,191,.5); transform:translateY(-4px); }

.tag-g { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:7px 18px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; background:#E6F7F5; color:#00523C; border:1px solid #A7F3D0; font-family:'Plus Jakarta Sans',sans-serif; }
.tag-d { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:7px 18px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; background:rgba(255,255,255,.1); color:rgba(255,255,255,.9); border:1px solid rgba(255,255,255,.2); font-family:'Plus Jakarta Sans',sans-serif; }

.inp { width:100%; padding:13px 16px; border-radius:11px; border:1.5px solid #D1D5DB; font-size:14px; outline:none; transition:border-color .2s, box-shadow .2s; background:#fff; font-family:'Plus Jakarta Sans',sans-serif; color:#111827; }
.inp:focus { border-color:#00A896; box-shadow:0 0 0 4px rgba(0,168,150,.1); }

.ticker-wrap { overflow:hidden; width:100%; }
.ticker-track { display:flex; animation:slideLeft 36s linear infinite; width:max-content; }
.ticker-track:hover { animation-play-state:paused; }

.grid-pattern { background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px); background-size:64px 64px; }

.faq-btn { width:100%; text-align:left; background:none; border:none; padding:22px 0; font-size:15px; font-weight:700; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-family:'Plus Jakarta Sans',sans-serif; color:#111827; gap:16px; }

/* Navbar */
.nav-link { color:rgba(255,255,255,.85); text-decoration:none; font-size:14px; font-weight:600; transition:color .2s; white-space:nowrap; }
.nav-link:hover { color:#fff; }
.nav-link-scrolled { color:#4B5563; text-decoration:none; font-size:14px; font-weight:600; transition:color .2s; white-space:nowrap; }
.nav-link-scrolled:hover { color:#00523C; }
.nav-dropdown { position:absolute; top:calc(100% + 8px); left:0; background:#fff; border-radius:16px; padding:10px; border:1px solid #E5E7EB; box-shadow:0 16px 48px rgba(0,0,0,.12); min-width:220px; z-index:200; animation:slideDown .18s ease; }
.nav-dropdown-item { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; color:#374151; font-size:14px; font-weight:600; text-decoration:none; transition:background .15s, color .15s; }
.nav-dropdown-item:hover { background:#E6F7F5; color:#00523C; }
.nav-mobile-btn { display:none; background:none; border:none; cursor:pointer; padding:4px; }

/* Footer link hover */
.footer-link { color:rgba(255,255,255,.7); text-decoration:none; font-size:14px; transition:color .2s; }
.footer-link:hover { color:#0DD3BF; }

/* Section padding */
.section-pad { padding:112px 48px; }

/* Responsive */
@media (max-width:1100px) {
  .hero-cols { flex-direction:column !important; }
  .hero-right { display:none !important; }
  .hero-ctas { justify-content:center !important; }
  .hero-text-block { text-align:center !important; }
  .hero-social { justify-content:center !important; }
  .hero-badge { display:inline-flex; }
  .grid-3 { grid-template-columns:1fr 1fr !important; }
  .grid-4 { grid-template-columns:1fr 1fr !important; }
  .steps-g { grid-template-columns:1fr !important; }
}
@media (max-width:768px) {
  .nav-links-desk { display:none !important; }
  .nav-ctas-desk { display:none !important; }
  .nav-mobile-btn { display:block !important; }
  .grid-3 { grid-template-columns:1fr !important; }
  .form-g { grid-template-columns:1fr !important; }
  .section-pad { padding:72px 24px !important; }
  .footer-grid { grid-template-columns:1fr 1fr !important; }
}
@media (max-width:480px) {
  .grid-4 { grid-template-columns:1fr !important; }
  .footer-grid { grid-template-columns:1fr !important; }
}
`
