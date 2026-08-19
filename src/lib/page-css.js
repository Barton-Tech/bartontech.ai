// Single theme. There is no dark mode and no toggle.
//
// The dark hero band is a design element, not a mode: white on near-black
// measures 19.4:1, so the most typographically aggressive part of the page
// cannot fail a contrast check. Everything below it sits on the light plane,
// where every text token was measured to clear 4.5:1.
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
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --series-4: #eda100;
  --series-5: #e87ba4;
  --series-6: #008300;
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

/* ---------- hero: inverted in both themes ---------- */
.hero { background:#0b0b0b; color:#fff; padding:26px 0 64px; border-bottom:1px solid rgba(255,255,255,.14); }
.hero__bar { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:56px; }
.hero__updated { font-size:.8rem; color:#8d8b84; }
.hero__mark { font-size:.8rem; letter-spacing:.14em; text-transform:uppercase; color:#8d8b84; font-weight:600; }
.hero__mark b { color:#fff; font-weight:600; }

.hero__eyebrow { font-size:.8rem; letter-spacing:.14em; text-transform:uppercase; color:#8d8b84; margin:0 0 20px; font-weight:600; }
.hero h1 {
  font-size:clamp(2.1rem,5.4vw,4rem); line-height:1.05; letter-spacing:-.03em;
  font-weight:680; margin:0; max-width:19ch; text-wrap:balance;
}
.hero h1 em { font-style:normal; color:#5fa0f0; }
.hero__deck { margin:26px 0 0; max-width:56ch; color:#b9b7ae; font-size:1.08rem; }

.figure-row { display:flex; flex-wrap:wrap; gap:44px 64px; margin-top:52px; padding-top:32px; border-top:1px solid rgba(255,255,255,.14); }
.figure { min-width:150px; }
.figure__value { font-size:clamp(2.4rem,6vw,3.6rem); line-height:1; font-weight:660; letter-spacing:-.035em; }
.figure__value--accent { color:#5fa0f0; }
.figure__label { margin-top:12px; font-size:.83rem; letter-spacing:.1em; text-transform:uppercase; color:#8d8b84; font-weight:600; }
.figure__note { margin-top:7px; font-size:.9rem; color:#b9b7ae; max-width:32ch; }
.hero__foot { margin-top:34px; font-size:.88rem; color:#8d8b84; }

/* ---------- sections ---------- */
main { padding-bottom:96px; }
.section { padding-top:80px; }
.section__num { font-size:.78rem; letter-spacing:.16em; color:var(--text-muted); font-weight:700; }
.section h2 { font-size:clamp(1.5rem,2.6vw,2.1rem); line-height:1.15; letter-spacing:-.022em; margin:10px 0 0; font-weight:640; max-width:22ch; }
.section__note { color:var(--text-secondary); margin:14px 0 0; max-width:64ch; }
.section__head { padding-bottom:26px; border-bottom:1px solid var(--rule); margin-bottom:30px; }

/* ---------- ranked board ---------- */
.board__title { font-size:1.02rem; font-weight:640; letter-spacing:-.01em; margin:0 0 6px; }
.board__sub { color:var(--text-secondary); font-size:.9rem; margin:0 0 20px; max-width:66ch; }
.board { list-style:none; margin:0 0 30px; padding:0; }
.board li { display:grid; grid-template-columns:2.4rem 1fr; gap:18px; padding:20px 0; border-bottom:1px solid var(--grid); align-items:start; }
.board li:first-child { border-top:1px solid var(--grid); }
.board__rank { font-size:1.5rem; font-weight:660; color:var(--text-muted); font-variant-numeric:tabular-nums; line-height:1.2; }
.board li:first-child .board__rank { color:var(--series-1); }
.board__name { font-size:1.12rem; font-weight:600; letter-spacing:-.012em; line-height:1.35; }
.board__meta { margin-top:8px; display:flex; flex-wrap:wrap; gap:8px 18px; align-items:center; font-size:.86rem; color:var(--text-muted); }
.board__track { flex:1 1 160px; min-width:120px; height:6px; background:var(--grid); border-radius:999px; overflow:hidden; }
.board__fill { display:block; height:100%; border-radius:999px; background:var(--series-1); }
.board__score { font-variant-numeric:tabular-nums; color:var(--text-secondary); font-weight:600; }
.board__of { font-weight:400; color:var(--text-muted); }
.board__by { color:var(--text-muted); }

/* ---------- charts ---------- */
.chart { background:var(--surface-1); border:1px solid var(--border); border-radius:14px; padding:24px; margin:0 0 22px; }
.chart__title { font-weight:640; font-size:1.02rem; letter-spacing:-.01em; }
.chart__sub { color:var(--text-secondary); font-size:.9rem; margin:6px 0 0; max-width:66ch; }
.chart__plot { position:relative; margin-top:18px; overflow-x:auto; }
.chart__plot svg { width:100%; height:auto; display:block; min-width:520px; }
.chart--empty .chart__empty { margin-top:16px; padding:44px 20px; text-align:center; color:var(--text-muted);
  border:1px dashed var(--baseline); border-radius:10px; font-size:.92rem; }
.grid { stroke:var(--grid); stroke-width:1; }
.baseline { stroke:var(--baseline); stroke-width:1; }
.line { fill:none; stroke-width:2; stroke-linejoin:round; stroke-linecap:round; }
.band { opacity:.14; }
.dot { stroke:var(--surface-1); stroke-width:2; }
.crosshair { stroke:var(--baseline); stroke-width:1; pointer-events:none; }
.axis,.tip-label { fill:var(--text-muted); font-size:12px; font-family:inherit; }
.tip-label { fill:var(--text-secondary); }
.legend { list-style:none; display:flex; flex-wrap:wrap; gap:6px 18px; padding:0; margin:14px 0 0; font-size:.86rem; color:var(--text-secondary); }
.legend li { display:flex; align-items:center; gap:7px; }
.swatch { width:10px; height:10px; border-radius:3px; display:inline-block; }
.tooltip { position:absolute; pointer-events:none; z-index:3; background:var(--surface-1); border:1px solid var(--border);
  border-radius:10px; padding:10px 12px; font-size:.84rem; box-shadow:0 8px 26px rgba(0,0,0,.16); min-width:140px; }
.tooltip b { display:block; margin-bottom:6px; font-size:.78rem; color:var(--text-muted); font-weight:600; }
.tooltip div { display:flex; justify-content:space-between; gap:16px; }
.tooltip span { color:var(--text-secondary); }
.tooltip em { font-style:normal; font-variant-numeric:tabular-nums; }

.table { margin-top:16px; font-size:.86rem; }
.table summary { cursor:pointer; color:var(--text-secondary); }
.table__scroll { overflow-x:auto; margin-top:12px; }
.table table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; }
.table th,.table td { text-align:right; padding:6px 12px; border-bottom:1px solid var(--grid); white-space:nowrap; }
.table th[scope="row"],.table thead th:first-child { text-align:left; font-weight:600; }
.table td { color:var(--text-secondary); }

/* ---------- prose + faq ---------- */
.prose { max-width:66ch; }
.prose p { color:var(--text-secondary); margin:0 0 16px; }
.prose h3 { font-size:1.05rem; margin:30px 0 8px; font-weight:640; }
.prose code { background:var(--surface-2); border:1px solid var(--border); border-radius:5px; padding:1px 6px; font-size:.86em; }
.faq { margin:0; max-width:70ch; }
.faq dt { font-weight:640; margin-top:28px; font-size:1.03rem; letter-spacing:-.01em; }
.faq dd { margin:8px 0 0; color:var(--text-secondary); }
a { color:var(--link); }

footer { margin-top:88px; padding:32px 0 0; border-top:1px solid var(--rule); color:var(--text-muted); font-size:.88rem; }
footer a { color:var(--text-secondary); }
footer p { max-width:66ch; }

@media (forced-colors: active) {
  .chart,.tooltip,.board li { border:1px solid CanvasText; }
  .swatch,.board__fill { forced-color-adjust:none; }
}
@media (max-width:640px) {
  .figure-row { gap:32px 40px; }
  .section { padding-top:56px; }
}
`;
