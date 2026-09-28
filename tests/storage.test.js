import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transact, openStore } from '../docs/storage.js';

test('silent transaction times out and aborts instead of hanging', async () => {
 let aborted = false;
 const tx = { objectStore: () => ({ put: () => ({}) }), abort() { aborted = true; this.onabort(); } };
 await assert.rejects(transact({transaction:()=>tx}, 'put', {id:'same-id'}, 10), /timed out/);
 assert.equal(aborted,true);
 tx.oncomplete(); // A late event must not turn the timeout into a success.
});
test('write resolves only when the transaction commits', async () => {
 const request = { result:'same-id' };
 const tx = { objectStore:()=>({put:()=>request}) };
 const result = transact({transaction:()=>tx}, 'put', {id:'same-id'}, 100);
 tx.oncomplete();
 assert.equal(await result,'same-id');
});
test('hung database open times out and closes a late connection', async () => {
 const original = globalThis.indexedDB;
 const request = {};
 globalThis.indexedDB = {open:()=>request};
 try {
  await assert.rejects(openStore(10), /timed out/);
  let closed = false; request.result = {close:()=>{closed=true}};
  request.onsuccess(); assert.equal(closed,true);
 } finally { globalThis.indexedDB = original; }
});
test('failed save exits saving UI, preserves result and retries the same id on a fresh connection', async () => {
 const source = fs.readFileSync(new URL('../docs/app.js',import.meta.url),'utf8');
 const save = source.slice(source.indexOf('async function savePending()'),source.indexOf('\nfunction toggle()'));
 const nodes = Object.fromEntries(['phase','hint','retry','time'].map(id=>[id,{textContent:id==='time'?'0:12.345':''}]));
 const record = {id:'same-id',ms:12345,at:1,scramble:'R U'};
 let calls=0, closed=false, reopened=false;
 const writes=[];
 const context = {pending:record,busy:false,saved:false,db:{close:()=>{closed=true}},
  $:id=>nodes[id], controls(){nodes.retry.disabled=context.busy;}, announce(){}, channel:null,
  refresh:async()=>{}, openStore:async()=>{reopened=true;return {};},
  transact:async(db,action,value)=>{writes.push(value);if (++calls===1) throw new Error('timeout');}
 };
 vm.createContext(context); vm.runInContext(save,context);
 await context.savePending();
 assert.equal(context.busy,false); assert.equal(context.pending,record);
 assert.equal(nodes.phase.textContent,'저장 실패'); assert.equal(nodes.time.textContent,'0:12.345');
 assert.equal(nodes.retry.disabled,false); assert.equal(closed,true);
 await context.savePending();
 assert.equal(reopened,true); assert.equal(context.pending,null); assert.equal(context.saved,true);
 assert.equal(nodes.phase.textContent,'측정 완료'); assert.deepEqual(writes,[record,record]);
});
