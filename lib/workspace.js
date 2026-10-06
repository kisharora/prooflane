/** Saved research is a snapshot, never silently replaced by a newer run. */
export function selectCandidate({ candidates, saved, view }, id) {
  const current = candidates.find(candidate => candidate.id === id);
  return view === 'shortlist' ? saved[id] || current : current || saved[id];
}
export function createSnapshot(candidate, run) {
  return { ...structuredClone(candidate), savedMode: candidate.synthetic ? 'example' : run.mode, savedCapturedAt: run.capturedAt };
}
export function snapshotProvenance(candidate, run) {
  const mode = candidate.synthetic ? 'example' : candidate.savedMode || run.mode;
  return {
    mode,
    label: mode === 'example' ? 'Fictional example' : mode === 'recorded' ? 'Recorded SerpApi result' : candidate.savedMode ? 'Saved live result' : 'Live SerpApi result',
    capturedAt: candidate.savedCapturedAt || run.capturedAt,
  };
}
