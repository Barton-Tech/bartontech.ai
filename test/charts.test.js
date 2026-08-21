import test from 'node:test';
import assert from 'node:assert/strict';
import { SERIES, lineChart, barChart, dataTable, rankedBoard, statTile, esc, fmtPct } from '../src/lib/charts.js';

test('esc neutralizes markup; fmtPct formats', () => {
  assert.equal(esc(`<a b="c">&'`), '&lt;a b=&quot;c&quot;&gt;&amp;&#39;');
  assert.equal(fmtPct(0.1234), '12.3%');
  assert.equal(SERIES, 6);
});

test('lineChart draws bands, dots and direct labels for small series', () => {
  const svg = lineChart({
    title: 'T', subtitle: 'S', id: 'c1',
    series: [
      { name: 'A very long series name here', points: [
        { x: '2026-01', y: 0.1, low: 0.05, high: 0.2 },
        { x: '2026-02', y: 0.2, low: 0.1, high: 0.3 },
      ] },
      { name: 'B', points: [{ x: '2026-01', y: 0.3, low: 0.2, high: 0.4 }, { x: '2026-02', y: 0.1, low: 0.05, high: 0.2 }] },
    ],
  });
  for (const bit of ['class="band"', 'class="dot"', 'tip-label', '…', 'chart__sub', 'legend']) {
    assert.ok(svg.includes(bit), `missing ${bit}`);
  }
});

test('lineChart drops dots and labels at scale, honors yMax', () => {
  const many = (n) => ({ name: `S${n}`, points: Array.from({ length: 16 }, (_, i) => ({ x: `2026-${String(i + 1).padStart(2, '0')}`, y: i / 20 })) });
  const svg = lineChart({ title: 'T', id: 'c2', series: [1, 2, 3, 4, 5].map(many), yMax: 1 });
  assert.ok(!svg.includes('class="dot"'));
  assert.ok(!svg.includes('tip-label'));
});

test('lineChart and barChart render empty frames without data', () => {
  assert.ok(lineChart({ title: 'T', series: [{ name: 'A', points: [] }] }).includes('chart--empty'));
  assert.ok(barChart({ title: 'T', rows: [] }).includes('chart--empty'));
});

test('barChart renders ranked bars with values', () => {
  const svg = barChart({ title: 'T', subtitle: 'S', id: 'b1', rows: [{ name: 'A', value: 0.5 }, { name: 'B', value: 0.25 }] });
  assert.equal((svg.match(/class="bar"/g) || []).length, 2);
  assert.ok(svg.includes('50.0%'));
});

test('dataTable emits scoped headers', () => {
  const html = dataTable(['X'], [{ name: 'R', values: ['v'] }], { rowHeader: 'H', caption: 'Cap' });
  assert.ok(html.includes('th scope="col"') && html.includes('th scope="row"') && html.includes('Cap'));
});

test('rankedBoard links rows, shows provider counts, and has an empty state', () => {
  const html = rankedBoard({
    title: 'T', subtitle: 'S',
    rows: [{ name: 'A', value: 10, providers: ['x', 'y'], href: '/problems/a/' }, { name: 'B', value: 5 }],
  });
  assert.ok(html.includes('named by 2 of 3 models'));
  assert.ok(html.includes('href="/problems/a/"'));
  assert.ok(rankedBoard({ rows: [] }).includes('chart--empty'));
});

test('statTile renders with and without a note', () => {
  assert.ok(statTile({ label: 'L', value: 'V', note: 'N' }).includes('stat__note'));
  assert.ok(!statTile({ label: 'L', value: 'V' }).includes('stat__note'));
});
