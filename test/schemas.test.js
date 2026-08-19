// Provider constraint: strict structured outputs require every object to
// close itself (additionalProperties:false) and to require every property.
// One loose object fails at request time, on a paid call.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as schemas from '../src/lib/schemas.js';

function walk(node, path, schemaName) {
  if (Array.isArray(node)) return node.forEach((n, i) => walk(n, `${path}[${i}]`, schemaName));
  if (node === null || typeof node !== 'object') return;
  if (node.type === 'object' && node.properties) {
    assert.equal(node.additionalProperties, false, `${schemaName}${path}: additionalProperties must be false`);
    assert.deepEqual(
      [...(node.required ?? [])].sort(),
      Object.keys(node.properties).sort(),
      `${schemaName}${path}: required must list every property`,
    );
  }
  for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`, schemaName);
}

for (const [name, schema] of Object.entries(schemas)) {
  test(`${name} satisfies the strict structured-output contract`, () => {
    walk(schema, '', name);
  });
}
