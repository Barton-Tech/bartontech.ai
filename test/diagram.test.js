import test from 'node:test';
import assert from 'node:assert/strict';
import { swimlaneSvg, stackSvg } from '../src/lib/diagram.js';

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
