export function scramble(length = 20, random = Math.random) {
  const faces = ['U', 'D', 'L', 'R', 'F', 'B'];
  const moves = [];
  let previousAxis = -1;
  for (let i = 0; i < length; i++) {
    const available = faces.filter((_, index) => Math.floor(index / 2) !== previousAxis);
    const face = available[Math.floor(random() * available.length)];
    previousAxis = Math.floor(faces.indexOf(face) / 2);
    moves.push(face + ['', "'", '2'][Math.floor(random() * 3)]);
  }
  return moves.join(' ');
}
export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms));
  return `${Math.floor(total / 60000)}:${String(Math.floor(total / 1000) % 60).padStart(2, '0')}.${String(total % 1000).padStart(3, '0')}`;
}
export function bestTime(records) {
  return records.reduce((best, record) => Math.min(best, record.ms), Infinity);
}
