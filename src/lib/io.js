import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export const paths = {
  config: (...p) => path.join(ROOT, 'config', ...p),
  data: (...p) => path.join(ROOT, 'data', ...p),
  registry: () => path.join(ROOT, 'data/registry/problems.json'),
  tracker: (date) => path.join(ROOT, 'data/tracker', `${date}.json`),
  anchor: (date) => path.join(ROOT, 'data/anchor', `${date}.json`),
  index: (month) => path.join(ROOT, 'data/index', `${month}.json`),
  batch: (date) => path.join(ROOT, 'data/batches', `${date}.json`),
  dist: (...p) => path.join(ROOT, 'dist', ...p),
};

export function readJSON(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && fallback !== undefined) return fallback;
    throw err;
  }
}

export function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function exists(file) {
  return fs.existsSync(file);
}

export function listJSON(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// Every run records the configs it was produced under, so a chart can be
// annotated where methodology changed rather than silently drifting.
export function provenance(config, extra = {}) {
  return {
    prompt_version: config.sampling.prompt_version,
    samples_per_question: config.sampling.samples_per_question,
    harness_version: 1,
    ...extra,
  };
}

export function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}
