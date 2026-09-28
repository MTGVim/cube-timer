import test from 'node:test';
import assert from 'node:assert/strict';
import { scramble, formatTime, bestTime } from '../docs/core.js';
import fs from 'node:fs';
import vm from 'node:vm';
test('20 legal moves, no consecutive rotations on the same axis', () => {
 for(let n=0;n<1000;n++) {
  const moves=scramble().split(' '); assert.equal(moves.length,20);
  for(let i=0;i<moves.length;i++) {
   assert.match(moves[i],/^[UDLRFB]('|2)?$/);
   if(i) assert.notEqual(Math.floor('UDLRFB'.indexOf(moves[i][0])/2),Math.floor('UDLRFB'.indexOf(moves[i-1][0])/2));
  }
 }
});
test('time boundaries and best record after deletion', () => {
 assert.equal(formatTime(0),'0:00.000'); assert.equal(formatTime(59999.9),'0:59.999'); assert.equal(formatTime(60000),'1:00.000'); assert.equal(formatTime(3600000),'60:00.000');
 const records=[{ms:12500},{ms:5000},{ms:6000}]; assert.equal(bestTime(records),5000); records.splice(1,1); assert.equal(bestTime(records),6000); assert.equal(bestTime([]),Infinity);
});
test('PWA shell assets exist and install caches all assets under a project subpath', async () => {
 const handlers={};let cached=[];
 const context={self:{registration:{scope:'https://example.github.io/cube-timer/'},addEventListener:(type,fn)=>handlers[type]=fn},caches:{open:async()=>({addAll:async assets=>{cached=assets}})}};
 vm.runInNewContext(fs.readFileSync(new URL('../docs/sw.js',import.meta.url),'utf8'),context);
 let done; handlers.install({waitUntil:p=>done=p});await done;
 assert.ok(cached.includes('./app.js'));
 for(const asset of cached) assert.ok(fs.existsSync(new URL('../docs/'+(asset==='./'?'index.html':asset),import.meta.url)),asset);
 const manifest=JSON.parse(fs.readFileSync(new URL('../docs/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');assert.equal(manifest.display,'standalone');
});
