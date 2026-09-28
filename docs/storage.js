const TIMEOUT_MS = 8000;
export function openLegacyStore(timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cube-timer-v1', 1);
    let settled = false;
    const finish = (error, db) => {
      if (settled) { db?.close(); return; }
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(db);
    };
    const timer = setTimeout(() => finish(new Error('Database open timed out')), timeoutMs);
    request.onupgradeneeded = () => {
      if (settled) { request.transaction.abort(); return; }
      request.result.createObjectStore('solves', { keyPath: 'id' });
    };
    request.onerror = () => finish(request.error || new Error('Database open failed'));
    request.onblocked = () => finish(new Error('Database upgrade blocked'));
    request.onsuccess = () => finish(null, request.result);
  });
}
export function transactLegacy(db, action, value, timeoutMs = TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('solves', action === 'getAll' ? 'readonly' : 'readwrite');
    const request = tx.objectStore('solves')[action](...(value === undefined ? [] : [value]));
    let settled = false;
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(request.result);
    };
    const timer = setTimeout(() => {
      finish(new Error('Database transaction timed out'));
      try { tx.abort(); } catch {}
    }, timeoutMs);
    tx.oncomplete = () => finish();
    tx.onerror = () => finish(tx.error || request.error || new Error('Transaction failed'));
    tx.onabort = () => finish(tx.error || new Error('Transaction aborted'));
  });
}

const STORAGE_KEY = 'cube-timer-records-v2';
function readRecords(storage) {
  const records = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
  if (!Array.isArray(records)) throw new Error('Saved records are not an array');
  return records;
}
// IndexedDB is used only once to preserve records from previous releases.
export async function openStore(timeoutMs = TIMEOUT_MS, storage = localStorage) {
  if (storage.getItem(STORAGE_KEY) === null) {
    const legacy = await openLegacyStore(timeoutMs);
    try {
      const records = await transactLegacy(legacy, 'getAll', undefined, timeoutMs);
      // Another tab may have completed migration while this one was waiting.
      if (storage.getItem(STORAGE_KEY) === null) storage.setItem(STORAGE_KEY, JSON.stringify(records));
    } finally { legacy.close(); }
  }
  readRecords(storage);
  return { storage, close() {} };
}
export function transact(db, action, value) {
  const records = readRecords(db.storage);
  if (action === 'getAll') return records;
  let next;
  if (action === 'put') next = [...records.filter(record => record.id !== value.id), value];
  else if (action === 'delete') next = records.filter(record => record.id !== value);
  else if (action === 'clear') next = [];
  else throw new Error(`Unsupported storage action: ${action}`);
  // setItem either completes synchronously or throws; no unresolved transaction.
  db.storage.setItem(STORAGE_KEY, JSON.stringify(next));
}
