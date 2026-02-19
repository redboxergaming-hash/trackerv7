import {
  endFast,
  getActiveFast,
  getFastingStreak,
  getLastCompletedFast,
  startFast
} from './storage.js';

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export async function getFastingViewModel(personId, options = {}) {
  const now = Number(options.now ?? Date.now());
  const presetHours = Number(options.presetHours ?? 16);

  const active = await getActiveFast(personId);
  const lastCompleted = await getLastCompletedFast(personId);
  const streak = await getFastingStreak(personId);

  const activeDurationMs = active ? now - active.startAt : null;
  const lastDurationMs = !active && lastCompleted ? lastCompleted.endAt - lastCompleted.startAt : null;
  const targetEndAt = active ? active.startAt + (presetHours * 60 * 60 * 1000) : null;

  return {
    active,
    streak,
    ctaLabel: active ? 'End fast' : 'Start fast',
    durationLabel: active
      ? `Active duration: ${formatDuration(activeDurationMs)}`
      : `Last fast duration: ${lastDurationMs != null ? formatDuration(lastDurationMs) : '—'}`,
    targetEndLabel: active ? `Target end: ${formatTime(targetEndAt)}` : ''
  };
}

export async function toggleFast(personId) {
  const active = await getActiveFast(personId);
  if (active) {
    return endFast(personId);
  }
  return startFast(personId);
}
