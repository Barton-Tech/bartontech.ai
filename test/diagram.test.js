import test from 'node:test';
import assert from 'node:assert/strict';
import { swimlaneSvg, stackSvg, discoverySvg } from '../src/lib/diagram.js';

for (const [name, fn, boxes] of [['swimlane', swimlaneSvg, 14], ['stack', stackSvg, 6]]) {
  test(`${name} diagram is labeled, accessible and clean`, () => {
    const svg = fn();
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('role="img"') && svg.includes('<title') && svg.includes('<desc'));
    assert.equal((svg.match(/<rect[^>]*rx="10"/g) || []).length, boxes + 1, 'boxes plus the base band');
    assert.ok(!svg.includes('—') && !/[←→⇒↔]/.test(svg), 'no banned characters');
  });
}

test('the swimlane shows the three human gates in accent color', () => {
  assert.equal((swimlaneSvg().match(/stroke="#256abf"/g) || []).length, 3);
});

test('discovery diagram is labeled, links out to the live files, and stays clean', () => {
  const svg = discoverySvg({ crawlerCount: 19, faqCount: 11 });
  assert.ok(svg.startsWith('<svg'));
  // Unlike the other two diagrams, this one carries real links, so role="img"
  // would hide them from assistive tech: it must be absent here.
  assert.ok(!svg.includes('role="img"'));
  assert.ok(svg.includes('<title') && svg.includes('<desc'));
  assert.equal((svg.match(/<rect[^>]*rx="10"/g) || []).length, 7, 'six info boxes plus the base band');
  assert.ok(!svg.includes('—') && !/[←→⇒↔]/.test(svg), 'no banned characters');
  assert.ok(svg.includes('19 AI crawlers') && svg.includes('11 self-contained FAQ answers'));
  for (const href of ['/sitemap.xml', '/robots.txt', '/llms.txt', '/#faq', '/data/registry/problems.json', '/recognition/']) {
    assert.ok(svg.includes(`href="${href}" class="svg-link"`), `links to ${href}`);
  }
  const links = svg.match(/<a href="[^"]+" class="svg-link" aria-label="[^"]+">/g) || [];
  assert.equal(links.length, 6, 'every svg-link carries an explicit aria-label, since SVG cannot be trusted to compute one from nested tspans');
});
