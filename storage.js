const DB_NAME = 'macroTrackerDB';
const DB_VERSION = 1;

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function toDateKey(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const fastingLogs = db.createObjectStore('fastingLogs', { keyPath: 'id' });
      fastingLogs.createIndex('byPersonStart', ['personId', 'startAt']);
      fastingLogs.createIndex('byPersonDate', ['personId', 'dateKey']);
      fastingLogs.createIndex('byPersonEnd', ['personId', 'endAt']);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getFastingLogsByPerson(personId) {
  const db = await openDb();
  const tx = db.transaction('fastingLogs', 'readonly');
  const byPersonStart = tx.objectStore('fastingLogs').index('byPersonStart');
  const range = IDBKeyRange.bound([personId, 0], [personId, Number.MAX_SAFE_INTEGER]);
  const logs = await promisify(byPersonStart.getAll(range));
  return logs.sort((a, b) => b.startAt - a.startAt);
}

export async function getActiveFast(personId) {
  const logs = await getFastingLogsByPerson(personId);
  return logs.find((entry) => entry.endAt == null) ?? null;
}

export async function getLastCompletedFast(personId) {
  const logs = await getFastingLogsByPerson(personId);
  return logs.find((entry) => Number.isFinite(entry.endAt) && entry.endAt >= entry.startAt) ?? null;
}

export async function startFast(personId, now = Date.now()) {
  const active = await getActiveFast(personId);
  if (active) return active;

  const entry = {
    id: createId(),
    personId,
    startAt: Number(now),
    endAt: null,
    dateKey: toDateKey(now)
  };

  const db = await openDb();
  const tx = db.transaction('fastingLogs', 'readwrite');
  tx.objectStore('fastingLogs').put(entry);
  await txDone(tx);
  return entry;
}

export async function endFast(personId, now = Date.now()) {
  const active = await getActiveFast(personId);
  if (!active) return null;

  const ended = {
    ...active,
    endAt: Math.max(Number(now), Number(active.startAt))
  };

  const db = await openDb();
  const tx = db.transaction('fastingLogs', 'readwrite');
  tx.objectStore('fastingLogs').put(ended);
  await txDone(tx);
  return ended;
}

function dayIndexFromDateKey(dateKey) {
  const ms = Date.parse(`${dateKey}T00:00:00`);
  return Math.floor(ms / 86400000);
}

export async function getFastingStreak(personId) {
  const logs = await getFastingLogsByPerson(personId);
  const completedDateKeys = [...new Set(logs.filter((item) => item.endAt != null).map((item) => item.dateKey))]
    .sort((a, b) => b.localeCompare(a));

  if (!completedDateKeys.length) return 0;

  let streak = 1;
  let prev = dayIndexFromDateKey(completedDateKeys[0]);
  for (let i = 1; i < completedDateKeys.length; i += 1) {
    const current = dayIndexFromDateKey(completedDateKeys[i]);
    if (prev - current === 1) {
      streak += 1;
      prev = current;
      continue;
    }
    break;
  }

  return streak;
}

export async function exportAllData() {
  const db = await openDb();
  const tx = db.transaction('fastingLogs', 'readonly');
  const fastingLogs = await promisify(tx.objectStore('fastingLogs').getAll());
  return { fastingLogs };
}

export async function importAllData(payload) {
  const fastingLogs = Array.isArray(payload?.fastingLogs) ? payload.fastingLogs : [];
  const db = await openDb();
  const tx = db.transaction('fastingLogs', 'readwrite');
  const store = tx.objectStore('fastingLogs');
  store.clear();
  fastingLogs.forEach((item) => {
    if (!item?.id || !item?.personId || !Number.isFinite(Number(item.startAt))) return;
    store.put({
      id: String(item.id),
      personId: String(item.personId),
      startAt: Number(item.startAt),
      endAt: item.endAt == null ? null : Number(item.endAt),
      dateKey: typeof item.dateKey === 'string' ? item.dateKey : toDateKey(item.startAt)
    });
  });
  await txDone(tx);
}
