import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCandidate, createSnapshot, snapshotProvenance } from '../dist/lib/workspace.js';
const original = { id: 'p1', title: 'Original title', synthetic: false, evidence: [{ snippet: 'Original excerpt' }] };
const run = { mode: 'live', capturedAt: '2026-10-01T00:00:00Z' };
test('shortlist details select the saved snapshot instead of a newer board version', () => {
  const snapshot = createSnapshot(original, run), updated = { ...original, title: 'New title' };
  assert.equal(selectCandidate({ candidates: [updated], saved: { p1: snapshot }, view: 'shortlist' }, 'p1').title, 'Original title');
  assert.equal(selectCandidate({ candidates: [updated], saved: { p1: snapshot }, view: 'board' }, 'p1').title, 'New title');
});
test('saved snapshots are deep copies and retain their original capture metadata', () => {
  const candidate = structuredClone(original), snapshot = createSnapshot(candidate, run);
  candidate.evidence[0].snippet = 'Changed later';
  assert.equal(snapshot.evidence[0].snippet, 'Original excerpt'); assert.equal(snapshot.savedCapturedAt, run.capturedAt); assert.equal(snapshot.savedMode, 'live');
});
test('snapshot labels do not inherit the current workspace data mode or capture date', () => {
  const snapshot = createSnapshot(original, run), current = { mode: 'example', capturedAt: '2026-10-06T00:00:00Z' };
  assert.deepEqual(snapshotProvenance(snapshot, current), { mode: 'live', label: 'Saved live result', capturedAt: run.capturedAt });
});
test('fictional snapshot identity cannot become live through a later run', () => {
  const snapshot = createSnapshot({ ...original, synthetic: true }, run);
  assert.equal(snapshot.savedMode, 'example'); assert.equal(snapshotProvenance(snapshot, run).label, 'Fictional example');
});
