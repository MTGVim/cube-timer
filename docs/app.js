import { generateScramble } from './scrambler.js';
import { formatTime, bestTime } from './core.js';
import { openStore, transact } from './storage.js';
const $ = id => document.getElementById(id);
let db, records = [], running = false, busy = false, started = 0, frame = 0, current = '', pending = null, wakeLock = null, saved = false, generating = false;
let channel = null;
try { if ('BroadcastChannel' in window) channel = new BroadcastChannel('cube-timer-records'); } catch (error) { console.warn('Cross-tab notifications unavailable', error); }
const announce = text => { $('status').textContent = text; };
function reportStorageError(action, error) {
  const detail = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
  console.error(`[Cube Timer] ${action}`, error);
  const message = `${action}\n${detail}\n\n이 알림을 캡처해서 알려 주세요. 브라우저 데이터는 삭제하지 마세요.`;
  announce(message);
  window.alert(message);
}

async function prepareScramble() {
  if (running || busy || pending || generating) return;
  generating = true; current = ''; saved = false;
  $('scramble').replaceChildren(); $('scramble').setAttribute('aria-busy', 'true');
  $('phase').textContent = '생성 중'; $('time').textContent = '0:00.000';
  $('hint').textContent = '잠시 기다려 주세요'; announce('스크램블을 생성하고 있습니다.'); controls();
  try {
    current = await generateScramble(); showScramble();
    $('phase').textContent = '준비'; $('hint').textContent = '눌러서 시작';
    announce('새 스크램블로 큐브를 섞은 뒤 시작하세요.');
  } catch {
    $('phase').textContent = '생성 실패'; $('hint').textContent = '새로 섞기를 눌러 다시 시도';
    announce('스크램블을 생성하지 못했습니다. 새로 섞기를 눌러 보세요. 계속 실패하면 온라인에서 앱을 닫고 다시 열어 주세요.');
  } finally {
    generating = false; $('scramble').setAttribute('aria-busy', 'false'); controls();
  }
}

function showScramble() {
  $('scramble').replaceChildren(...current.split(' ').map(move => {
    const node = document.createElement('span'); node.textContent = move.replace("'", '′'); return node;
  }));
}
function controls() {
  $('timer').disabled = !db || busy || !!pending || generating || !current;
  $('shuffle').disabled = running || busy || !!pending || generating;
  $('delete-all').disabled = !records.length || running || busy || !!pending;
  $('cancel').hidden = !running;
  $('retry').hidden = !pending; $('retry').disabled = busy;
  document.querySelectorAll('[data-delete]').forEach(button => { button.disabled = running || busy || !!pending; });
}
async function refresh() {
  records = (await transact(db, 'getAll')).sort((a, b) => b.at - a.at);
  const best = bestTime(records);
  $('best').textContent = Number.isFinite(best) ? formatTime(best) : '—';
  $('count').textContent = records.length;
  $('records').replaceChildren();
  if (!records.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '첫 번째 기록을 만들어 보세요.\n측정을 마치면 여기에 저장됩니다.'; $('records').append(empty);
  }
  for (const record of records) {
    const article = document.createElement('article'); article.className = 'record';
    const top = document.createElement('div'); top.className = 'record-top';
    const main = document.createElement('div'); main.className = 'record-main';
    const time = document.createElement('strong'); time.className = 'record-time'; time.textContent = formatTime(record.ms); main.append(time);
    if (record.ms === best) { const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = 'BEST'; main.append(badge); }
    const date = document.createElement('time'); date.className = 'record-date'; date.dateTime = new Date(record.at).toISOString(); date.textContent = new Date(record.at).toLocaleString('ko-KR'); main.append(date);
    const remove = document.createElement('button'); remove.textContent = '삭제'; remove.dataset.delete = record.id; remove.setAttribute('aria-label', `${formatTime(record.ms)} 기록 삭제`); remove.onclick = () => deleteRecords(record);
    top.append(main, remove);
    const details = document.createElement('details'); const summary = document.createElement('summary'); summary.textContent = '스크램블 보기'; const moves = document.createElement('p'); moves.textContent = record.scramble; details.append(summary, moves);
    article.append(top, details); $('records').append(article);
  }
  controls();
}
async function keepAwake() {
  try { if ('wakeLock' in navigator && running && document.visibilityState === 'visible') { const lock = await navigator.wakeLock.request('screen'); if (running) wakeLock = lock; else await lock.release(); } } catch {}
}
function releaseAwake() { wakeLock?.release().catch(() => {}); wakeLock = null; }
function tick() { $('time').textContent = formatTime(performance.now() - started); frame = requestAnimationFrame(tick); }
function finishUI() {
  running = false; cancelAnimationFrame(frame); releaseAwake(); $('timer').classList.remove('running'); $('timer').setAttribute('aria-label', '타이머 시작');
}
async function savePending() {
  if (!pending || busy) return;
  busy = true; $('phase').textContent = '저장 중'; $('hint').textContent = '잠시 기다려 주세요'; controls();
  const record = pending;
  try {
    if (!db) db = await openStore();
    await transact(db, 'put', record);
    pending = null; saved = true;
    $('phase').textContent = '측정 완료'; $('hint').textContent = '눌러서 새 스크램블';
    announce('기록을 저장했습니다. 타이머를 누르면 다음 스크램블이 표시됩니다.');
    channel?.postMessage('changed');
    await refresh();
  } catch (error) {
    if (pending) {
      db?.close(); db = null;
      $('phase').textContent = '저장 실패'; $('hint').textContent = '아래 버튼으로 저장 다시 시도';
    }
    reportStorageError(pending ? '기록 저장 실패: 측정 결과를 유지했습니다. 저장 다시 시도를 눌러 주세요.' : '기록은 저장했지만 목록을 불러오지 못했습니다.', error);
  }
  finally { busy = false; controls(); }
}
function toggle() {
  if (!db || busy || pending || generating || !current || $('confirm').open) return;
  if (running) {
    const ms = Math.floor(performance.now() - started);
    finishUI(); $('time').textContent = formatTime(ms);
    pending = { id: crypto.randomUUID(), ms, at: Date.now(), scramble: current };
    $('phase').textContent = '저장 중'; savePending();
  } else {
    if (saved) { prepareScramble(); return; }
    running = true; started = performance.now(); $('timer').classList.add('running'); $('timer').setAttribute('aria-label', '타이머 정지 및 기록 저장'); $('phase').textContent = '측정 중'; $('hint').textContent = '눌러서 정지'; announce(''); controls(); tick(); keepAwake();
  }
}
function confirmDelete(record) {
  $('confirm-title').textContent = record ? '이 기록을 삭제할까요?' : '전체 기록을 삭제할까요?';
  $('confirm-body').textContent = record ? `${formatTime(record.ms)} 기록을 삭제합니다. 삭제한 기록은 복구할 수 없습니다.` : `저장된 기록을 모두 삭제합니다. 삭제한 기록은 복구할 수 없습니다.`;
  $('confirm').returnValue = 'cancel'; $('confirm').showModal();
  return new Promise(resolve => $('confirm').addEventListener('close', () => resolve($('confirm').returnValue === 'delete'), { once: true }));
}
async function deleteRecords(record) {
  if (running || busy || pending || !(await confirmDelete(record))) return;
  busy = true; controls();
  try { await transact(db, record ? 'delete' : 'clear', record?.id); await refresh(); channel?.postMessage('changed'); announce(record ? '기록을 삭제했습니다.' : '전체 기록을 삭제했습니다.'); }
  catch (error) { reportStorageError('기록 삭제 실패', error); }
  finally { busy = false; controls(); }
}
$('timer').onclick = toggle;
$('shuffle').onclick = prepareScramble;
$('cancel').onclick = () => { finishUI(); $('time').textContent = '0:00.000'; $('phase').textContent = '준비'; $('hint').textContent = '눌러서 시작'; announce('측정을 취소했습니다. 기록을 저장하지 않았습니다.'); controls(); };
$('delete-all').onclick = () => deleteRecords(); $('retry').onclick = savePending;
document.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat || $('confirm').open || (event.target.closest('button,summary,input,textarea,a,select') && event.target !== $('timer'))) return;
  event.preventDefault(); toggle();
});
// Prevent a second native button activation on keyup after the global Space handler.
$('timer').addEventListener('keyup', event => { if (event.code === 'Space') event.preventDefault(); });
document.addEventListener('visibilitychange', () => { if (running && document.visibilityState === 'visible') keepAwake(); });
window.addEventListener('beforeunload', event => { if (running || pending) { event.preventDefault(); event.returnValue = ''; } });
if (channel) channel.onmessage = () => { if (db) refresh().catch(error => reportStorageError('기록 불러오기 실패', error)); };
try { db = await openStore(); await refresh(); controls(); window.dispatchEvent(new Event('cube-timer-ready')); prepareScramble(); }
catch (error) {
  $('phase').textContent = '준비 실패'; $('hint').textContent = '아래 버튼으로 다시 불러오기';
  window.dispatchEvent(new Event('cube-timer-init-error'));
  reportStorageError('기록 저장소 열기 또는 기존 기록 이전 실패 (v1.2.1)', error);
}
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').onclick = async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = null; $('install').hidden = true; };
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
