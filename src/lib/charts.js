// Server-rendered inline SVG. No chart library: the data is small, the output
// is static, and this keeps the build dependency-free.
//
// Palette is the validated categorical order (slots 1-6), which clears every
// adjacent CVD and normal-vision gate in both modes. Light-mode slots 3, 4 and
// 5 sit below 3:1 against the surface, so the relief rule applies: every chart
// on this site ships a legend and a table view.

export const SERIES = 6;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const fmtPct = (n) => `${(n * 100).toFixed(1)}%`;

function scale(domain, range) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

function niceTicks(max, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) * mag;
  const out = [];
  for (let v = 0; v <= max + step / 2; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

function emptyFrame(title, note) {
  return `<figure class="chart chart--empty">
  <figcaption class="chart__title">${esc(title)}</figcaption>
  <div class="chart__empty">${esc(note)}</div>
</figure>`;
}

// Multi-series time line. `series` is [{ name, points:[{x,y,low,high}] }] where
// x is an ISO date or month string. A variance band is drawn wherever low/high
// are present.
export function lineChart({
  title,
  subtitle = '',
  series,
  yFormat = fmtPct,
  yMax: forcedMax,
  emptyNote = 'Collecting. The first points appear once the daily run has completed.',
  id,
}) {
  const withData = series.filter((s) => s.points.length > 0);
  if (withData.length === 0) return emptyFrame(title, emptyNote);

  const W = 860;
  const H = 340;
  const M = { top: 16, right: 132, bottom: 34, left: 48 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const xs = [...new Set(withData.flatMap((s) => s.points.map((p) => p.x)))].sort();
  const xIndex = new Map(xs.map((x, i) => [x, i]));
  const maxY =
    forcedMax ??
    Math.max(
      ...withData.flatMap((s) => s.points.map((p) => Math.max(p.y, p.high ?? 0))),
      0.0001,
    );

  const x = scale([0, Math.max(xs.length - 1, 1)], [M.left, M.left + plotW]);
  const y = scale([0, maxY], [M.top + plotH, M.top]);
  const ticks = niceTicks(maxY);

  const grid = ticks
    .map(
      (t) =>
        `<line class="grid" x1="${M.left}" x2="${M.left + plotW}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>` +
        `<text class="axis" x="${M.left - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${esc(yFormat(t))}</text>`,
    )
    .join('');

  const step = Math.max(1, Math.ceil(xs.length / 7));
  const xAxis = xs
    .map((label, i) =>
      i % step === 0 || i === xs.length - 1
        ? `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 10}" text-anchor="middle">${esc(label.slice(5))}</text>`
        : '',
    )
    .join('');

  const marks = withData
    .map((s, i) => {
      const slot = (i % SERIES) + 1;
      const pts = s.points
        .slice()
        .sort((a, b) => xIndex.get(a.x) - xIndex.get(b.x));

      const band =
        pts.every((p) => p.low != null && p.high != null) && pts.length > 1
          ? `<path class="band" fill="var(--series-${slot})" d="${
              pts.map((p, k) => `${k ? 'L' : 'M'}${x(xIndex.get(p.x)).toFixed(1)},${y(p.high).toFixed(1)}`).join('') +
              pts
                .slice()
                .reverse()
                .map((p) => `L${x(xIndex.get(p.x)).toFixed(1)},${y(p.low).toFixed(1)}`)
                .join('') +
              'Z'
            }"/>`
          : '';

      const line = `<path class="line" stroke="var(--series-${slot})" d="${pts
        .map((p, k) => `${k ? 'L' : 'M'}${x(xIndex.get(p.x)).toFixed(1)},${y(p.y).toFixed(1)}`)
        .join('')}"/>`;

      const dots =
        pts.length <= 14
          ? pts
              .map(
                (p) =>
                  `<circle class="dot" fill="var(--series-${slot})" cx="${x(xIndex.get(p.x)).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="4"/>`,
              )
              .join('')
          : '';

      // Direct labels for four series or fewer; past that the legend carries
      // identity on its own. Long names are clipped to the right margin.
      const last = pts[pts.length - 1];
      const short = s.name.length > 17 ? `${s.name.slice(0, 16)}\u2026` : s.name;
      const label =
        withData.length <= 4
          ? `<text class="tip-label" x="${(x(xIndex.get(last.x)) + 10).toFixed(1)}" y="${(y(last.y) + 4).toFixed(1)}">${esc(short)}</text>`
          : '';

      return band + line + dots + label;
    })
    .join('');

  const legend = `<ul class="legend">${withData
    .map(
      (s, i) =>
        `<li><span class="swatch" style="background:var(--series-${(i % SERIES) + 1})"></span>${esc(s.name)}</li>`,
    )
    .join('')}</ul>`;

  const table = dataTable(
    xs,
    withData.map((s) => ({
      name: s.name,
      values: xs.map((xv) => {
        const p = s.points.find((q) => q.x === xv);
        return p ? yFormat(p.y) : '';
      }),
    })),
    { rowHeader: 'Series', caption: title },
  );

  const payload = esc(
    JSON.stringify({
      xs,
      series: withData.map((s) => ({
        name: s.name,
        points: s.points.map((p) => ({ x: p.x, y: yFormat(p.y) })),
      })),
      geom: { left: M.left, width: plotW },
    }),
  );

  return `<figure class="chart" id="${esc(id)}">
  <figcaption class="chart__title">${esc(title)}</figcaption>
  ${subtitle ? `<p class="chart__sub">${esc(subtitle)}</p>` : ''}
  ${legend}
  <div class="chart__plot" data-chart="${payload}" tabindex="0" role="group" aria-label="${esc(title)} chart, scrollable">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">
      ${grid}
      <line class="baseline" x1="${M.left}" x2="${M.left + plotW}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>
      ${marks}
      ${xAxis}
      <line class="crosshair" y1="${M.top}" y2="${M.top + plotH}" x1="0" x2="0" style="opacity:0"/>
    </svg>
    <div class="tooltip" hidden></div>
  </div>
  ${table}
</figure>`;
}

// Horizontal bars for ranked magnitude. 4px rounded data-ends, 2px surface gap
// between adjacent bars.
export function barChart({ title, subtitle = '', rows, format = fmtPct, emptyNote, id }) {
  if (!rows || rows.length === 0)
    return emptyFrame(title, emptyNote ?? 'Collecting. The board appears after the first monthly run.');

  const rowH = 34;
  const gap = 2;
  const W = 860;
  const labelW = 210;
  const valueW = 70;
  const H = rows.length * (rowH + gap);
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  const barW = W - labelW - valueW;

  const bars = rows
    .map((r, i) => {
      const slot = (i % SERIES) + 1;
      const w = Math.max((r.value / max) * barW, 2);
      const yPos = i * (rowH + gap);
      return (
        `<text class="bar-label" x="${labelW - 12}" y="${yPos + rowH / 2 + 5}" text-anchor="end">${esc(r.name)}</text>` +
        `<rect class="bar" fill="var(--series-${slot})" x="${labelW}" y="${yPos + 5}" width="${w.toFixed(1)}" height="${rowH - 10}" rx="4"/>` +
        `<text class="bar-value" x="${labelW + w + 10}" y="${yPos + rowH / 2 + 5}">${esc(format(r.value))}</text>`
      );
    })
    .join('');

  const table = dataTable(
    ['Score'],
    rows.map((r) => ({ name: r.name, values: [format(r.value)] })),
    { rowHeader: 'Problem', caption: title },
  );

  return `<figure class="chart" id="${esc(id)}">
  <figcaption class="chart__title">${esc(title)}</figcaption>
  ${subtitle ? `<p class="chart__sub">${esc(subtitle)}</p>` : ''}
  <div class="chart__plot" tabindex="0" role="group" aria-label="${esc(title)} chart, scrollable">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}" preserveAspectRatio="xMidYMid meet">${bars}</svg>
  </div>
  ${table}
</figure>`;
}

export function dataTable(columns, rows, { rowHeader = 'Series', caption = '' } = {}) {
  return `<details class="table">
  <summary>Table view${caption ? `: ${esc(caption)}` : ''}</summary>
  <div class="table__scroll" tabindex="0" role="group" aria-label="${esc(caption || 'Data table')}, scrollable"><table>
    ${caption ? `<caption class="visually-hidden">${esc(caption)}</caption>` : ''}
    <thead><tr><th scope="col">${esc(rowHeader)}</th>${columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (r) =>
          `<tr><th scope="row">${esc(r.name)}</th>${r.values.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`,
      )
      .join('')}</tbody>
  </table></div>
</details>`;
}

// Ranked board. Rank is stated as a numeral rather than implied by bar length,
// which is what lets the panel's ordering and the confidence-weighted score
// disagree without the chart looking wrong.
export function rankedBoard({ rows, emptyNote = 'Collecting. The first board appears after the monthly index run.' }) {
  if (!rows || rows.length === 0) {
    return `<div class="chart chart--empty"><div class="chart__empty">${esc(emptyNote)}</div></div>`;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  const items = rows
    .map((r, i) => {
      const pct = ((r.value / max) * 100).toFixed(1);
      const by = r.providers?.length ? `named by ${r.providers.length} of 3 models` : '';
      return `<li>
      <div class="board__rank" aria-hidden="true">${i + 1}</div>
      <div>
        <div class="board__name"><span class="visually-hidden">Rank ${i + 1}. </span>${esc(r.name)}</div>
        <div class="board__meta">
          <span class="board__score">${r.value}</span>
          <span class="board__track"><span class="board__fill" style="width:${pct}%"></span></span>
          ${by ? `<span class="board__by">${esc(by)}</span>` : ''}
        </div>
      </div>
    </li>`;
    })
    .join('');
  const table = dataTable(
    ['Panel score'],
    rows.map((r) => ({ name: r.name, values: [String(r.value)] })),
    { rowHeader: 'Problem', caption: 'Problem index board' },
  );
  return `<ol class="board">${items}</ol>${table}`;
}

export function statTile({ label, value, note = '' }) {
  return `<div class="stat">
  <div class="stat__label">${esc(label)}</div>
  <div class="stat__value">${esc(value)}</div>
  ${note ? `<div class="stat__note">${esc(note)}</div>` : ''}
</div>`;
}

export { esc, fmtPct };
