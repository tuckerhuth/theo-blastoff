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
initVoice(document.getElementById('micDot'));
initFx(ui.els.fx);
rocketTheme.mount(ui.els.scene);
initInput(ui.els.app);
initEngine(rocketTheme);

// Debug handle (harmless in production; handy for poking at state).
window.__blastoff = { store, ui };

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
