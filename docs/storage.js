const TIMEOUT_MS = 8000;
export function openStore(timeoutMs = TIMEOUT_MS) {
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
export function transact(db, action, value, timeoutMs = TIMEOUT_MS) {
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
