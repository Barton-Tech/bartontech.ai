// Light values on bare :root; dark redefined under both the OS media query and
// the explicit [data-theme] stamp, so the toggle wins in both directions.
export const CSS = `
:root {
  color-scheme: light;
  --plane: #f9f9f7;
  --surface-1: #fcfcfb;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #6f6d69;
  --grid: #e1e0d9;
  --baseline: #c3c2b7;
  --border: rgba(11,11,11,0.10);
  --link: #256abf;
  --series-1: #2a78d6;
  --series-2: #eb6834;
  --series-3: #1baf7a;
  --series-4: #eda100;
  --series-5: #e87ba4;
  --series-6: #008300;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --plane: #0d0d0d;
    --surface-1: #1a1a19;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #898781;
    --grid: #2c2c2a;
    --baseline: #383835;
    --border: rgba(255,255,255,0.10);
    --link: #3987e5;
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --series-4: #c98500;
    --series-5: #d55181;
    --series-6: #008300;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --plane: #0d0d0d;
  --surface-1: #1a1a19;
  --text-primary: #ffffff;
  --text-secondary: #c3c2b7;
  --text-muted: #898781;
  --grid: #2c2c2a;
  --baseline: #383835;
  --border: rgba(255,255,255,0.10);
  --link: #3987e5;
  --series-1: #3987e5;
  --series-2: #d95926;
  --series-3: #199e70;
  --series-4: #c98500;
  --series-5: #d55181;
  --series-6: #008300;
}

* { box-sizing: border-box; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
.skip-link {
  position: absolute; left: 8px; top: -48px; z-index: 10;
  background: var(--surface-1); color: var(--text-primary);
  border: 1px solid var(--border); border-radius: 8px;
  padding: 8px 14px; text-decoration: none;
}
.skip-link:focus { top: 8px; }
.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px;
  padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
body {
  margin: 0;
  background: var(--plane);
  color: var(--text-primary);
  font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1000px; margin: 0 auto; padding: 40px 20px 80px; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
h1 { font-size: 1.6rem; margin: 0 0 6px; letter-spacing: -0.01em; }
.tagline { color: var(--text-secondary); margin: 0; max-width: 62ch; }
.theme-toggle {
  background: var(--surface-1); color: var(--text-secondary);
  border: 1px solid var(--border); border-radius: 8px;
  padding: 6px 12px; font: inherit; font-size: 0.85rem; cursor: pointer;
}
h2 { font-size: 1.05rem; margin: 48px 0 4px; letter-spacing: -0.005em; }
.section-note { color: var(--text-secondary); margin: 0 0 20px; font-size: 0.92rem; max-width: 68ch; }

.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 28px 0 8px; }
.stat { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.stat__label { font-size: 0.78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.stat__value { font-size: 1.5rem; font-weight: 600; margin-top: 6px; line-height: 1.2; }
.stat__note { font-size: 0.82rem; color: var(--text-secondary); margin-top: 6px; }

.chart { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin: 0 0 20px; }
.chart__title { font-weight: 600; font-size: 0.98rem; }
.chart__sub { color: var(--text-secondary); font-size: 0.87rem; margin: 4px 0 0; max-width: 68ch; }
.chart__plot { position: relative; margin-top: 14px; overflow-x: auto; }
.chart__plot:focus-visible, .table__scroll:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.chart__plot svg { width: 100%; height: auto; display: block; min-width: 520px; }
.chart--empty .chart__empty {
  margin-top: 14px; padding: 40px 20px; text-align: center;
  color: var(--text-muted); border: 1px dashed var(--baseline); border-radius: 8px; font-size: 0.9rem;
}

.grid { stroke: var(--grid); stroke-width: 1; }
.baseline { stroke: var(--baseline); stroke-width: 1; }
.line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.band { opacity: 0.14; }
.dot { stroke: var(--surface-1); stroke-width: 2; }
.crosshair { stroke: var(--baseline); stroke-width: 1; pointer-events: none; }
.axis, .bar-label, .bar-value, .tip-label { fill: var(--text-muted); font-size: 12px; font-family: inherit; }
.bar-label, .bar-value { fill: var(--text-secondary); font-size: 13px; }
.bar-value { font-variant-numeric: tabular-nums; }
.tip-label { fill: var(--text-secondary); font-size: 12px; }
.bar { stroke: var(--surface-1); stroke-width: 2; }

.legend { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 16px; padding: 0; margin: 12px 0 0; font-size: 0.84rem; color: var(--text-secondary); }
.legend li { display: flex; align-items: center; gap: 6px; }
.swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }

.tooltip {
  position: absolute; pointer-events: none; z-index: 3;
  background: var(--surface-1); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px; font-size: 0.82rem;
  box-shadow: 0 6px 20px rgba(0,0,0,0.14); min-width: 130px;
}
.tooltip b { display: block; margin-bottom: 4px; font-size: 0.78rem; color: var(--text-muted); font-weight: 500; }
.tooltip div { display: flex; justify-content: space-between; gap: 14px; }
.tooltip span { color: var(--text-secondary); }
.tooltip em { font-style: normal; font-variant-numeric: tabular-nums; }

.table { margin-top: 14px; font-size: 0.85rem; }
.table summary { cursor: pointer; color: var(--text-secondary); }
.table__scroll { overflow-x: auto; margin-top: 10px; }
.table table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.table th, .table td { text-align: right; padding: 5px 10px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
.table th[scope="row"], .table thead th:first-child { text-align: left; font-weight: 500; }
.table td { color: var(--text-secondary); }

footer { margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.85rem; }
footer a { color: var(--text-secondary); }
a { color: var(--link); }
.prose { max-width: 68ch; }
.prose h3 { font-size: 0.98rem; margin: 26px 0 6px; }
.prose p { color: var(--text-secondary); margin: 0 0 12px; }
.prose code { background: var(--surface-1); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; font-size: 0.86em; }
.faq { margin: 0; }
.faq dt { font-weight: 600; margin-top: 22px; }
.faq dd { margin: 6px 0 0; color: var(--text-secondary); }
@media (forced-colors: active) {
  .chart, .stat, .tooltip { border: 1px solid CanvasText; }
  .swatch { forced-color-adjust: none; }
}
`;
