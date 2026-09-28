export async function generateScramble(load = () => import('./vendor/cubing/scramble.js'), timeoutMs = 30000) {
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const { randomScrambleForEvent } = await load();
        const text = (await randomScrambleForEvent('333')).toString().trim();
        if (!/^[URFDLB](?:2|')?(?: [URFDLB](?:2|')?)+$/.test(text)) throw new Error('Invalid scramble');
        return text;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Scramble timed out')), timeoutMs); })
    ]);
  } finally { clearTimeout(timer); }
}
