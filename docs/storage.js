export function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('cube-timer-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('solves', { keyPath: 'id' });
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Database upgrade blocked'));
    request.onsuccess = () => resolve(request.result);
  });
}
export function transact(db, action, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('solves', action === 'getAll' ? 'readonly' : 'readwrite');
    const request = tx.objectStore('solves')[action](...(value === undefined ? [] : [value]));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}
