import test from 'node:test';
import assert from 'node:assert/strict';
import { recognitionSystem, recognitionUser, solutionSystem, themesUser } from '../src/lib/prompts.js';

test('the recognition prompt stays blind: it never describes the site', () => {
  // The log measures whether models can find out what the site is. A prompt
  // that leaks the subject would measure prompt-following instead.
  const text = `${recognitionSystem()} ${recognitionUser({ month: '2026-09' })}`.toLowerCase();
  for (const leak of ['martech', 'marketing', 'problem', 'index', 'unsolved', 'board']) {
    assert.ok(!text.includes(leak), `recognition prompt leaks the word "${leak}"`);
  }
});

test('solutionSystem carries the format instruction verbatim', () => {
  const sys = solutionSystem({ id: 'haiku', label: 'A haiku', instruction: 'Exactly three lines.' });
  assert.ok(sys.includes('Exactly three lines.'));
});

test('themesUser feeds only the default panel of a multi-format day', () => {
  const user = themesUser({
    date: '2026-08-20',
    boards: [],
    previous: null,
    solutions: [{
      date: '2026-08-20',
      problem: { canonical_name: 'P', canonical_id: 'p' },
      default_format: 'b',
      formats: [
        { format: { id: 'a' }, answers: [{ label: 'M1', first_move: 'FROM_A', hardest_part: 'h', confidence: 'low' }] },
        { format: { id: 'b' }, answers: [{ label: 'M1', first_move: 'FROM_B', hardest_part: 'h', confidence: 'low' }] },
      ],
    }],
  });
  assert.ok(user.includes('FROM_B'));
  assert.ok(!user.includes('FROM_A'), 'non-default panels must not multiply themes input');
});
