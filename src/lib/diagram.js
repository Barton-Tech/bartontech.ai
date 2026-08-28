// The "how this site works" swimlane, generated as inline SVG at build time.
//
// Hand-built rather than rendered from a diagram library: the site ships no
// JavaScript and the build takes no headless-browser dependency, so the
// diagram is authored the same way the charts are. Colors are the site's own
// measured tokens; the dark base band is the hero band reused as a design
// element. Text is hand-wrapped: every label line is authored, not measured,
// so the layout cannot shift under a font fallback.
//
// Geometry: four actor lanes crossed by four process columns, each column a
// numbered top-to-bottom mini-flow that ends in the shared base band (every
// run commits, every commit redeploys). Arrows that would cross a box are
// routed around the column edge instead.

const W = 1060;
const GUTTER = 150;
const COL_W = 210;
const COL_GAP = 16;
const HEADER_H = 56;
const LANE_H = 118;
const LANES = 4;
const BAND_GAP = 14;
const BAND_H = 60;
const H = HEADER_H + LANE_H * LANES + BAND_GAP + BAND_H + 10;

const INK = '#0b0b0b';
const MUTED = '#6f6d69';
const SECONDARY = '#52514e';
const GRID = '#e5e4dd';
const STRIPE = '#f7f6f3';
const ACCENT = '#256abf';

const colX = (i) => GUTTER + 10 + i * (COL_W + COL_GAP);
const laneY = (i) => HEADER_H + i * LANE_H;
const bandY = HEADER_H + LANE_H * LANES + BAND_GAP;

const COLUMNS = [
  { title: 'The monthly board', sub: '1st of the month' },
  { title: 'The recognition loop', sub: 'same monthly run' },
  { title: 'The daily answers', sub: 'every day, 06:37 UTC' },
  { title: 'The model refresh', sub: 'every Monday' },
];

const LANE_LABELS = [
  { lines: ['ChatGPT, Claude', 'and Gemini'], sub: 'the panel' },
  { lines: ['Claude'], sub: 'as editor' },
  { lines: ['A person'], sub: 'the review gate' },
  { lines: ['The pipeline'], sub: 'GitHub Actions' },
];

// col: column index. lane: lane index. lines: authored wrap. person: styled
// as the human gate. Steps are numbered per column, in array order.
const BOXES = [
  // The monthly board
  { id: 'a1', col: 0, lane: 0, lines: ['Each model proposes', 'the hardest unsolved', 'problems, with and', 'without web search'] },
  { id: 'a2', col: 0, lane: 1, lines: ['Claude merges every', 'name against the', 'canonical registry'] },
  { id: 'a3', col: 0, lane: 2, person: true, lines: ['New problems and', 'aliases wait for review'] },
  { id: 'a4', col: 0, lane: 3, lines: ["The month's ranked", 'board is published'] },
  // The recognition loop
  { id: 'b1', col: 1, lane: 0, lines: ['Search on, no hints:', 'what is bartontech.ai?'] },
  { id: 'b2', col: 1, lane: 1, lines: ['Claude judges the last', 'bet, proposes one change'] },
  { id: 'b3', col: 1, lane: 2, person: true, lines: ['A person applies the', 'change, or declines'] },
  { id: 'b4', col: 1, lane: 3, lines: ['Answers and proposal', 'logged, append-only'] },
  // The daily answers
  { id: 'c1', col: 2, lane: 3, lines: ['The date picks one', 'problem off the board'] },
  { id: 'c2', col: 2, lane: 0, lines: ['All three answer it,', 'in every format'] },
  { id: 'c3', col: 2, lane: 1, lines: ['Claude rereads six', 'months, refreshes', 'the themes'] },
  // The model refresh
  { id: 'd1', col: 3, lane: 3, lines: ['Live model lists fetched', 'from each provider'] },
  { id: 'd2', col: 3, lane: 1, lines: ['Claude proposes the', 'lineup, verifies pricing'] },
  { id: 'd3', col: 3, lane: 2, person: true, lines: ['A pull request; a person', 'reviews and merges'] },
];

// from, to: box ids; to 'band' targets the base band. side: 'left'/'right'
// routes around the column edge when a straight drop would cross a box.
const FLOWS = [
  { from: 'a1', to: 'a2' },
  { from: 'a2', to: 'a3' },
  { from: 'a3', to: 'a4' },
  { from: 'a4', to: 'band' },
  { from: 'b1', to: 'b2' },
  { from: 'b2', to: 'b3' },
  { from: 'b3', to: 'b4' },
  { from: 'b4', to: 'band' },
  { from: 'c1', to: 'c2', side: 'left' },
  { from: 'c2', to: 'c3' },
  { from: 'c3', to: 'band', side: 'right' },
  { from: 'd1', to: 'd2', side: 'left' },
  { from: 'd2', to: 'd3' },
  { from: 'd3', to: 'band', side: 'right' },
];

const BOX_W = COL_W - 16;
const BOX_H = 84;

function boxRect(b) {
  const x = colX(b.col) + 8;
  const y = laneY(b.lane) + (LANE_H - BOX_H) / 2;
  return { x, y, w: BOX_W, h: BOX_H };
}

function boxSvg(b, step) {
  const { x, y, w, h } = boxRect(b);
  const stroke = b.person ? ACCENT : INK;
  const lineH = 16;
  const textY = y + h / 2 - ((b.lines.length - 1) * lineH) / 2 + 4;
  const text = b.lines
    .map((l, i) => `<tspan x="${x + 40}" y="${textY + i * lineH}">${l}</tspan>`)
    .join('');
  return `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="${stroke}" stroke-width="${b.person ? 1.6 : 1.2}"/>
  <circle cx="${x + 22}" cy="${y + h / 2}" r="11" fill="${b.person ? ACCENT : INK}"/>
  <text x="${x + 22}" y="${y + h / 2 + 4}" text-anchor="middle" font-size="11.5" font-weight="700" fill="#ffffff">${step}</text>
  <text font-size="12.5" fill="${INK}">${text}</text>`;
}

function flowPath(flow, rects) {
  const a = rects[flow.from];
  const b = flow.to === 'band' ? null : rects[flow.to];
  const endY = b ? null : bandY - 3;

  if (!flow.side) {
    // Straight drop from bottom center to top center (or to the band).
    const x = a.x + a.w / 2;
    if (!b) return `M ${x} ${a.y + a.h} L ${x} ${endY}`;
    return `M ${x} ${a.y + a.h} L ${x} ${b.y - 3}`;
  }
  // Elbow around the column edge, to avoid crossing an intervening box.
  const off = 14;
  const edgeX = flow.side === 'left' ? a.x - off : a.x + a.w + off;
  const startX = flow.side === 'left' ? a.x : a.x + a.w;
  const startY = a.y + a.h / 2;
  if (!b) {
    return `M ${startX} ${startY} L ${edgeX} ${startY} L ${edgeX} ${endY}`;
  }
  const targetX = flow.side === 'left' ? b.x : b.x + b.w;
  const targetY = b.y + b.h / 2;
  return `M ${startX} ${startY} L ${edgeX} ${startY} L ${edgeX} ${targetY} L ${targetX + (flow.side === 'left' ? -3 : 3)} ${targetY}`;
}

export function swimlaneSvg() {
  const rects = Object.fromEntries(BOXES.map((b) => [b.id, boxRect(b)]));
  const stepByBox = new Map();
  for (const col of [0, 1, 2, 3]) {
    BOXES.filter((b) => b.col === col).forEach((b, i) => stepByBox.set(b.id, i + 1));
  }

  const stripes = LANE_LABELS.map((_, i) =>
    i % 2 === 1
      ? `<rect x="0" y="${laneY(i)}" width="${W}" height="${LANE_H}" fill="${STRIPE}"/>`
      : '',
  ).join('');

  const laneLines = LANE_LABELS.map(
    (_, i) => `<line x1="0" y1="${laneY(i)}" x2="${W}" y2="${laneY(i)}" stroke="${GRID}" stroke-width="1"/>`,
  ).join('');

  const laneLabels = LANE_LABELS.map((l, i) => {
    const cy = laneY(i) + LANE_H / 2;
    const base = cy - ((l.lines.length - 1) * 17) / 2 - 4;
    const main = l.lines
      .map((t, j) => `<tspan x="18" y="${base + j * 17}">${t}</tspan>`)
      .join('');
    return `<text font-size="13.5" font-weight="650" fill="${INK}">${main}</text>
    <text x="18" y="${base + l.lines.length * 17 + 1}" font-size="11.5" fill="${MUTED}">${l.sub}</text>`;
  }).join('');

  const colHeads = COLUMNS.map((c, i) => {
    const x = colX(i) + 8;
    return `<text x="${x}" y="24" font-size="12.5" font-weight="700" letter-spacing=".02em" fill="${INK}">${c.title}</text>
    <text x="${x}" y="42" font-size="11.5" fill="${MUTED}">${c.sub}</text>`;
  }).join('');

  const boxes = BOXES.map((b) => boxSvg(b, stepByBox.get(b.id))).join('');
  const flows = FLOWS.map(
    (f) => `<path d="${flowPath(f, rects)}" fill="none" stroke="${SECONDARY}" stroke-width="1.4" marker-end="url(#arrowhead)"/>`,
  ).join('');

  const bandText = 'The site. Every run commits to the append-only record; every commit rebuilds and redeploys the page, the feeds and the open JSON data.';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="swimlane-title swimlane-desc" font-family="system-ui,-apple-system,'Segoe UI',sans-serif">
  <title id="swimlane-title">How this site works: four scheduled processes across four actors</title>
  <desc id="swimlane-desc">A swimlane diagram. Four lanes: the three-model panel, Claude as editor, a person as review gate, and the pipeline. Four columns cross them. Monthly board: the panel proposes problems, Claude merges names against the registry, new problems and aliases wait for human review, the ranked board is published. Recognition loop: the panel answers a neutral question about bartontech.ai, Claude judges the previous experiment and proposes one change, a person applies or declines it, and the answers and proposal are logged append-only. Daily answers: the date picks a problem, all three models answer in every format, Claude refreshes the themes. Model refresh: live model lists are fetched, Claude proposes the lineup, a person merges the pull request. Every column ends at the site: each run commits to the append-only record and each commit redeploys the page and its open data.</desc>
  <defs>
    <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
      <path d="M 1 1 L 7 4 L 1 7 Z" fill="${SECONDARY}"/>
    </marker>
  </defs>
  ${stripes}
  ${laneLines}
  <line x1="${GUTTER}" y1="0" x2="${GUTTER}" y2="${bandY - BAND_GAP + 4}" stroke="${GRID}" stroke-width="1"/>
  ${colHeads}
  ${laneLabels}
  ${flows}
  ${boxes}
  <rect x="0" y="${bandY}" width="${W}" height="${BAND_H}" rx="10" fill="${INK}"/>
  <text x="18" y="${bandY + BAND_H / 2 + 4.5}" font-size="13" fill="#ffffff">${bandText}</text>
</svg>`;
}

// The stack, as a left-to-right pipeline: schedules run the harness, the
// harness talks to the model APIs and commits to the record, the record
// deploys to the edge, the edge serves people and crawlers the same page.
// Same visual language as the swimlane: same tokens, same dark base band.
const STAGES = [
  { title: 'GitHub Actions', lines: ['Daily answers, 06:37', 'Monthly index, the 1st', 'Weekly refresh, Monday'] },
  { title: 'The harness', lines: ['Node, open source.', 'Spend guard first,', 'then the model calls'] },
  { title: 'The record', lines: ['Append-only JSON,', 'versioned in git.', 'Every run is a commit'] },
  { title: 'Cloudflare', lines: ['Every push rebuilds;', 'static assets served', 'from the edge'] },
  { title: 'Readers', lines: ['People and AI crawlers.', 'The same page,', 'no cloaking'] },
];

export function stackSvg() {
  const W2 = 1060;
  const BOX_W2 = 188;
  const GAP = 26;
  const x0 = (W2 - (STAGES.length * BOX_W2 + (STAGES.length - 1) * GAP)) / 2;
  const satY = 16;
  const satH = 72;
  const mainY = 150;
  const mainH = 96;
  const bandY2 = 286;
  const bandH2 = 58;
  const H2 = bandY2 + bandH2 + 10;

  const stageX = (i) => x0 + i * (BOX_W2 + GAP);

  const boxes = STAGES.map((s, i) => {
    const x = stageX(i);
    const lines = s.lines
      .map((l, j) => `<tspan x="${x + 16}" y="${mainY + 46 + j * 16}">${l}</tspan>`)
      .join('');
    return `
  <rect x="${x}" y="${mainY}" width="${BOX_W2}" height="${mainH}" rx="10" fill="#ffffff" stroke="${INK}" stroke-width="1.2"/>
  <text x="${x + 16}" y="${mainY + 26}" font-size="13.5" font-weight="650" fill="${INK}">${s.title}</text>
  <text font-size="11.5" fill="${SECONDARY}">${lines}</text>`;
  }).join('');

  const flows = STAGES.slice(0, -1)
    .map((_, i) => {
      const x = stageX(i) + BOX_W2;
      const y = mainY + mainH / 2;
      return `<path d="M ${x} ${y} L ${x + GAP - 4} ${y}" fill="none" stroke="${SECONDARY}" stroke-width="1.4" marker-end="url(#arrowhead2)"/>`;
    })
    .join('');

  // The model APIs sit above the harness; the exchange runs both ways.
  const satX = stageX(1) - 16;
  const satW = BOX_W2 + 32;
  const midX = satX + satW / 2;
  const satellite = `
  <rect x="${satX}" y="${satY}" width="${satW}" height="${satH}" rx="10" fill="#ffffff" stroke="${ACCENT}" stroke-width="1.6"/>
  <text x="${satX + 16}" y="${satY + 26}" font-size="13.5" font-weight="650" fill="${INK}">Three model APIs</text>
  <text x="${satX + 16}" y="${satY + 46}" font-size="11.5" fill="${SECONDARY}">OpenAI, Anthropic, Google:</text>
  <text x="${satX + 16}" y="${satY + 61}" font-size="11.5" fill="${SECONDARY}">structured outputs, search</text>
  <path d="M ${midX - 5} ${satY + satH} L ${midX - 5} ${mainY - 4}" fill="none" stroke="${SECONDARY}" stroke-width="1.4" marker-end="url(#arrowhead2)"/>
  <path d="M ${midX + 5} ${mainY} L ${midX + 5} ${satY + satH + 4}" fill="none" stroke="${SECONDARY}" stroke-width="1.4" marker-end="url(#arrowhead2)"/>`;

  const bandLines = [
    'Zero JavaScript leaves the server: the page is HTML and CSS, and the only script tag is JSON-LD structured data.',
    'Everything else is open JSON, an Atom feed and llms.txt, served without authentication.',
  ];

  return `<svg viewBox="0 0 ${W2} ${H2}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="stack-title stack-desc" font-family="system-ui,-apple-system,'Segoe UI',sans-serif">
  <title id="stack-title">The stack: from scheduled runs to served page</title>
  <desc id="stack-desc">A pipeline diagram in five stages. GitHub Actions runs the schedules: daily answers, the monthly index, the weekly refresh. The harness, open-source Node, runs a spend guard first and then calls the three model APIs from OpenAI, Anthropic and Google, which sit above it with a two-way exchange. Results are committed to an append-only JSON record versioned in git. Every push makes Cloudflare rebuild and serve the static site from the edge. Readers, both people and AI crawlers, get the same page. A base note states that zero JavaScript leaves the server: the page is HTML and CSS, the only script tag is JSON-LD structured data, and everything else is open JSON, a feed and llms.txt.</desc>
  <defs>
    <marker id="arrowhead2" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
      <path d="M 1 1 L 7 4 L 1 7 Z" fill="${SECONDARY}"/>
    </marker>
  </defs>
  ${satellite}
  ${flows}
  ${boxes}
  <rect x="0" y="${bandY2}" width="${W2}" height="${bandH2}" rx="10" fill="${INK}"/>
  <text font-size="13" fill="#ffffff">${bandLines
    .map((l, i) => `<tspan x="18" y="${bandY2 + 24 + i * 19}">${l}</tspan>`)
    .join('')}</text>
</svg>`;
}
