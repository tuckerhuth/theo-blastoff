// Boot: storage → UI → scene → input → engine.

import { store } from './store.js';
import { ui } from './ui.js';
import { initFx } from './fx.js';
import { initInput } from './input.js';
import { rocketTheme } from './themes/rocket.js';
import { initEngine } from './engine.js';
import { initVoice } from './voice.js';

store.load();
ui.init();
initVoice(document.getElementById('micDot'), document.getElementById('micCaption'));
initFx(ui.els.fx);
rocketTheme.mount(ui.els.scene);
initInput(ui.els.app);
initEngine(rocketTheme);

// Debug handle (harmless in production; handy for poking at state).
window.__blastoff = { store, ui };

// If anything breaks on a device we can't inspect, the device itself
// reports it: uncaught errors show in a small strip (tap to dismiss).
function reportError(msg) {
  const el = document.getElementById('errBadge');
  el.textContent = `⚠️ ${msg}`;
  el.classList.remove('hidden');
  el.onclick = () => el.classList.add('hidden');
}
window.addEventListener('error', (e) => reportError(e.message || 'script error'));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason?.message || String(e.reason || 'promise error')));

// Offline support — only once deployed (local http dev stays cache-free).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // When an update finishes installing it takes control mid-session; swap to
  // the new version immediately if we're safely on the title screen (kills
  // the "refreshed twice too fast, still stale" race).
  let swapped = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const onTitle = !document.getElementById('title').classList.contains('hidden');
    if (swapped || !onTitle) return;
    swapped = true;
    location.reload();
  });
}
