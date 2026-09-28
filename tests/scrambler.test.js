import test from 'node:test';
import assert from 'node:assert/strict';
import { generateScramble } from '../docs/scrambler.js';
import { puzzles } from 'cubing/puzzles';

test('shipped bundle generates valid random-state scrambles outside solved/one-move states', async () => {
 const kpuzzle = await puzzles['3x3x3'].kpuzzle();
 const solved = kpuzzle.defaultPattern();
 const signature = p => JSON.stringify([p.patternData.EDGES,p.patternData.CORNERS]);
 const forbidden = new Set([signature(solved)]);
 for (const face of 'URFDLB') for (const suffix of ['', "'", '2']) forbidden.add(signature(solved.applyAlg(face+suffix)));
 const seen = new Set();
 for (let i=0;i<10;i++) {
  const text = await generateScramble();
  assert.match(text,/^[URFDLB2' ]+$/);
  const state = signature(solved.applyAlg(text));
  assert.ok(!forbidden.has(state)); seen.add(state);
 }
 assert.equal(seen.size,10);
});
test('generation reports import failure, invalid moves and timeout; retry can succeed', async () => {
 await assert.rejects(generateScramble(async()=>{throw new Error('offline')}),/offline/);
 await assert.rejects(generateScramble(async()=>({randomScrambleForEvent:async()=> 'Error'})),/Invalid/);
 await assert.rejects(generateScramble(()=>new Promise(()=>{}),10),/timed out/);
 assert.equal(await generateScramble(async()=>({randomScrambleForEvent:async()=> 'R U2 F\''})),"R U2 F'");
});
