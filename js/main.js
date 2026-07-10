// Boot: storage → UI → scene → input → engine.

import { store } from './store.js';
import { ui } from './ui.js';
import { initFx } from './fx.js';
import { initInput } from './input.js';
import { THEMES, setActiveTheme, activeTheme } from './themes/index.js';
import { initEngine, setTheme, isRunning } from './engine.js';
import { initVoice } from './voice.js';
import { setVoicePack, hushSpeech } from './audio.js';

store.load();
ui.init();
initVoice(document.getElementById('micDot'), document.getElementById('micCaption'));
initFx(ui.els.fx);

const startingTheme = setActiveTheme(store.data.theme);
setVoicePack(startingTheme.name);
startingTheme.mount(ui.els.scene);
initInput(ui.els.app);
initEngine(startingTheme);

// Switch the active game world (rocket/knight/...). Only takes effect at the
// title screen — mid-round switches would swap art/voice under the child's
// feet. The title-screen theme cards and voice commands (js/main.js Stage 3)
// both call this.
function switchTheme(name) {
  if (isRunning()) return;
  const next = THEMES[name];
  if (!next || next === activeTheme()) return;
  hushSpeech();
  activeTheme().unmount?.(); // before the new mount, so CSS-var overrides never stack
  const t = setActiveTheme(name);
  store.data.theme = name;
  store.save();
  t.mount(ui.els.scene);
  setTheme(t);
  setVoicePack(t.name);
}

// Debug handle (harmless in production; handy for poking at state).
window.__blastoff = { store, ui, switchTheme };

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
