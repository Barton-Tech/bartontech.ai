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

test('tracker prompts carry the entity list and the pass instruction', async () => {
  const { trackerSystem, trackerUser } = await import('../src/lib/prompts.js');
  const sys = trackerSystem({ entities: ['Acme', 'Globex'] });
  assert.ok(sys.includes('Acme, Globex'));
  assert.ok(trackerUser({ text: 'Q?' }, { grounded: true }).includes('Search for current information'));
  assert.ok(trackerUser({ text: 'Q?' }, { grounded: false }).includes('Do not search'));
});

test('index prompts cover both passes and an empty registry', async () => {
  const { PROBLEM_INDEX_SYSTEM, problemIndexUser, reconciliationSystem, reconciliationUser } = await import('../src/lib/prompts.js');
  assert.ok(PROBLEM_INDEX_SYSTEM.includes('Unsolved'));
  assert.ok(problemIndexUser({ grounded: true, month: 'M' }).includes('Search for current sources'));
  assert.ok(problemIndexUser({ grounded: false, month: 'M' }).includes('Do not search'));
  const withAliases = reconciliationSystem({ problems: [{ id: 'a', canonical_name: 'A', definition: 'D.', aliases: ['B'] }] });
  assert.ok(withAliases.includes('Also called: B'));
  const bare = reconciliationSystem({ problems: [{ id: 'a', canonical_name: 'A', definition: 'D.', aliases: [] }] });
  assert.ok(bare.includes('none recorded'));
  assert.ok(reconciliationSystem({ problems: [] }).includes('(registry is empty)'));
  assert.ok(reconciliationUser([{ provider: 'p', name: 'N', category: 'c', confidence: 'high', definition: 'D', why_unsolved: 'W' }]).includes('[p] N'));
});

test('solution and themes prompts carry their optional fields', async () => {
  const { solutionUser, themesSystem, themesUser } = await import('../src/lib/prompts.js');
  const full = solutionUser({ problem: 'P', plain: 'pp', definition: 'D', why_unsolved: 'W', format: { label: 'A memo' } });
  assert.ok(full.includes('in plain terms: pp') && full.includes('blocked it so far: W') && full.includes('a memo'));
  const min = solutionUser({ problem: 'P', plain: '', definition: 'D', why_unsolved: '', format: { label: 'X' } });
  assert.ok(!min.includes('plain terms') && !min.includes('blocked'));
  assert.ok(themesSystem().includes('Keep names stable'));
  const withBoards = themesUser({
    date: 'd',
    boards: [{ month: 'M', board: [{ canonical_name: 'P', canonical_id: 'p', score: 3 }] }],
    solutions: [],
    previous: { themes: [{ name: 'T', trend: 'steady', plain: 'pl' }] },
  });
  assert.ok(withBoards.includes('1. P (id p, score 3)') && withBoards.includes('T (steady)'));
});

test('model refresh prompts flag missing models as urgent', async () => {
  const { modelRefreshSystem, modelRefreshUser } = await import('../src/lib/prompts.js');
  assert.ok(modelRefreshSystem().includes('Stability is preferred'));
  const cfg = { providers: { a: { enabled: true, models: { bulk: 'm' } } }, pricing: {} };
  assert.ok(modelRefreshUser({ config: cfg, available: {}, missing: ['a.bulk=m'] }).includes('URGENT'));
  assert.ok(!modelRefreshUser({ config: cfg, available: {}, missing: [] }).includes('URGENT'));
});
