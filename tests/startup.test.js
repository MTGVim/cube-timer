import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../docs/index.html',import.meta.url),'utf8');
const bootstrap=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace("import('./app.js?v=1.2.1')",'loadApp()');
function run(loadApp) {
 const nodes=Object.fromEntries(['phase','hint','status','reload-app'].map(id=>[id,{textContent:'',hidden:true}]));
 const events={};let timeout,cleared=false,alert='',registered=false;
 vm.runInNewContext(bootstrap,{
  document:{getElementById:id=>nodes[id]},location:{reload(){}},console,
  navigator:{serviceWorker:{register:async()=>{registered=true}}},
  window:{addEventListener:(name,fn)=>{events[name]=fn},alert:value=>{alert=value}},
  setTimeout:fn=>{timeout=fn;return 1},clearTimeout:()=>{cleared=true},loadApp
 });
 return {nodes,events,expire:()=>timeout(),get alert(){return alert},get cleared(){return cleared},get registered(){return registered}};
}
test('module loading failure shows actual error and still registers updates',async()=>{
 const app=run(()=>Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
 await Promise.resolve();
 assert.equal(app.registered,true);assert.equal(app.nodes['reload-app'].hidden,false);
 assert.match(app.alert,/TypeError: Failed to fetch dynamically imported module/);
 assert.equal(app.nodes.phase.textContent,'실행 오류');
});
test('silent initialization stall exposes timeout and retry; ready cancels watchdog',()=>{
 const stalled=run(()=>new Promise(()=>{}));stalled.expire();
 assert.match(stalled.alert,/StartupTimeout/);assert.equal(stalled.nodes['reload-app'].hidden,false);
 const ready=run(()=>Promise.resolve());ready.events['cube-timer-ready']();
 assert.equal(ready.cleared,true);assert.equal(ready.alert,'');
});
