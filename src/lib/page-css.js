// Single theme. There is no dark mode and no toggle.
//
// The dark hero band is a design element, not a mode: white on near-black
// measures 19.4:1, so the most typographically aggressive part of the page
// cannot fail a contrast check. Everything below it sits on the light plane,
// where every text token was measured to clear 4.5:1 (muted gray #6f6d69 at
// 5.03:1, links #256abf at 5.26:1).
export const CSS = `
:root {
  color-scheme: light;
  --plane: #f7f6f3;
  --surface-1: #ffffff;
  --surface-2: #f2f1ec;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #6f6d69;
  --grid: #e5e4dd;
  --baseline: #c3c2b7;
  --border: rgba(11,11,11,0.10);
  --rule: rgba(11,11,11,0.14);
  --link: #256abf;
  --accent: #2a78d6;
}

* { box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
:focus-visible { outline: 2px solid var(--link); outline-offset: 3px; border-radius: 3px; }
.hero :focus-visible { outline-color: #7fb2f5; }
.skip-link { position:absolute; left:12px; top:-48px; z-index:10; background:var(--surface-1); color:var(--text-primary);
  border:1px solid var(--border); border-radius:6px; padding:9px 15px; text-decoration:none; }
.skip-link:focus { top:12px; }
.visually-hidden { position:absolute; width:1px; height:1px; margin:-1px; padding:0; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }

body {
  margin:0; background:var(--plane); color:var(--text-primary);
  font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}
.wrap { max-width:1080px; margin:0 auto; padding:0 24px; }

/* ---------- hero ---------- */
.hero { background:#0b0b0b; color:#fff; padding:26px 0 58px; border-bottom:1px solid rgba(255,255,255,.14); }
.hero__bar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:56px; }
.hero__mark { font-size:.8rem; letter-spacing:.14em; text-transform:uppercase; color:#8d8b84; font-weight:600; }
.hero__mark b { color:#fff; font-weight:600; }
.hero__updated { font-size:.8rem; color:#8d8b84; }
.hero__eyebrow { font-size:.8rem; letter-spacing:.14em; text-transform:uppercase; color:#8d8b84; margin:0 0 20px; font-weight:600; }
.hero__eyebrow time { color:inherit; }
.hero h1 {
  font-size:clamp(2.1rem,5.4vw,4rem); line-height:1.05; letter-spacing:-.03em;
  font-weight:680; margin:0; max-width:20ch; text-wrap:balance;
}
.hero h1 em { font-style:normal; color:#5fa0f0; }
.hero__deck { margin:26px 0 0; max-width:58ch; color:#b9b7ae; font-size:1.08rem; }
.hero__term-name { font-style:italic; }
.hero__foot { margin-top:30px; font-size:.88rem; color:#8d8b84; }

/* ---------- sections ---------- */
main { padding-bottom:96px; }
.section { padding-top:76px; }
.section__num { font-size:.78rem; letter-spacing:.16em; color:var(--text-muted); font-weight:700; }
.section h2 { font-size:clamp(1.5rem,2.6vw,2.1rem); line-height:1.15; letter-spacing:-.022em; margin:10px 0 0; font-weight:640; max-width:24ch; }
.section__note { color:var(--text-secondary); margin:14px 0 0; max-width:64ch; }
.section__head { padding-bottom:26px; border-bottom:1px solid var(--rule); margin-bottom:30px; }

.empty { padding:44px 20px; text-align:center; color:var(--text-muted);
  border:1px dashed var(--baseline); border-radius:12px; font-size:.92rem; }

/* ---------- daily answers ---------- */
.solutions__meta { color:var(--text-secondary); margin:0 0 22px; max-width:66ch; }
.solutions__format { display:inline-block; background:var(--surface-2); border:1px solid var(--border);
  border-radius:999px; padding:3px 11px; font-size:.8rem; color:var(--text-secondary); margin-left:6px; }
.answers { display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); margin:0; padding:0; list-style:none; }
.answer { background:var(--surface-1); border:1px solid var(--border); border-radius:14px; padding:20px; display:flex; flex-direction:column; }
.answer__who { display:flex; align-items:baseline; gap:10px; margin-bottom:14px; }
.answer__model { font-weight:660; letter-spacing:-.01em; }
.answer__id { font-size:.78rem; color:var(--text-muted); font-variant-numeric:tabular-nums; }
.answer__body { white-space:pre-wrap; margin:0 0 16px; font-size:.95rem; line-height:1.55; }
.answer__body--verse { font-style:italic; }
.answer__foot { margin-top:auto; padding-top:14px; border-top:1px solid var(--grid); font-size:.86rem; }
.answer__foot dt { font-size:.74rem; letter-spacing:.1em; text-transform:uppercase; color:var(--text-muted); font-weight:600; margin-top:10px; }
.answer__foot dt:first-child { margin-top:0; }
.answer__foot dd { margin:3px 0 0; color:var(--text-secondary); }
.answer__conf { font-size:.78rem; color:var(--text-muted); margin:12px 0 0; }

/* ---------- ranked board ---------- */
.board__title { font-size:1.02rem; font-weight:640; letter-spacing:-.01em; margin:0 0 6px; }
.board__sub { color:var(--text-secondary); font-size:.9rem; margin:0 0 20px; max-width:66ch; }
.board { list-style:none; margin:0 0 30px; padding:0; }
.board li { display:grid; grid-template-columns:2.4rem 1fr; gap:18px; padding:20px 0; border-bottom:1px solid var(--grid); align-items:start; }
.board li:first-child { border-top:1px solid var(--grid); }
.board__rank { font-size:1.5rem; font-weight:660; color:var(--text-muted); font-variant-numeric:tabular-nums; line-height:1.2; }
.board li:first-child .board__rank { color:var(--accent); }
.board__name { font-size:1.12rem; font-weight:600; letter-spacing:-.012em; line-height:1.35; }
.board__meta { margin-top:8px; display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; font-size:.86rem; color:var(--text-muted); }
.board__track { flex:1 1 160px; min-width:120px; height:6px; background:var(--grid); border-radius:999px; overflow:hidden; }
.board__fill { display:block; height:100%; border-radius:999px; background:var(--accent); }
.board__score { font-variant-numeric:tabular-nums; color:var(--text-secondary); font-weight:600; }
.board__by { color:var(--text-muted); }

/* ---------- themes ---------- */
.themes { list-style:none; margin:0; padding:0; }
.theme { padding:20px 0; border-bottom:1px solid var(--grid); }
.theme:first-child { border-top:1px solid var(--grid); }
.theme__head { display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; }
.theme__name { font-size:1.12rem; font-weight:600; letter-spacing:-.012em; }
.theme__trend { font-size:.72rem; letter-spacing:.08em; text-transform:uppercase; font-weight:600;
  border:1px solid var(--border); border-radius:999px; padding:2px 10px; color:var(--text-muted); }
.theme__trend--new, .theme__trend--rising { color:var(--link); border-color:var(--link); }
.theme__plain { margin:8px 0 0; color:var(--text-secondary); max-width:66ch; }
.theme__evidence { margin:6px 0 0; font-size:.86rem; color:var(--text-secondary); max-width:66ch; }

/* ---------- table view (board fallback) ---------- */
.table { margin-top:16px; font-size:.86rem; }
.table summary { cursor:pointer; color:var(--text-secondary); }
.table__scroll { overflow-x:auto; margin-top:12px; }
.table table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; }
.table th,.table td { text-align:right; padding:6px 12px; border-bottom:1px solid var(--grid); white-space:nowrap; }
.table th[scope="row"],.table thead th:first-child { text-align:left; font-weight:600; }
.table td { color:var(--text-secondary); }

/* ---------- faq + footer ---------- */
.faq { margin:0; max-width:70ch; }
.faq dt { font-weight:640; margin-top:28px; font-size:1.03rem; letter-spacing:-.01em; }
.faq dd { margin:8px 0 0; color:var(--text-secondary); }
a { color:var(--link); }

footer { margin-top:88px; padding:32px 0 40px; border-top:1px solid var(--rule); color:var(--text-muted); font-size:.88rem; }
footer a { color:var(--text-secondary); }
footer p { max-width:66ch; }

@media (forced-colors: active) {
  .answer,.board li { border:1px solid CanvasText; }
  .board__fill { forced-color-adjust:none; }
}
@media (max-width:640px) {
  .section { padding-top:56px; }
}
`;
