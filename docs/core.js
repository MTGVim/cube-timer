export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms));
  return `${Math.floor(total / 60000)}:${String(Math.floor(total / 1000) % 60).padStart(2, '0')}.${String(total % 1000).padStart(3, '0')}`;
}
export function bestTime(records) {
  return records.reduce((best, record) => Math.min(best, record.ms), Infinity);
}
