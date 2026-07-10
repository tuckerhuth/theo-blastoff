// Boot: storage → UI → scene → input → engine.

import { store } from './store.js';
import { ui } from './ui.js';
import { initFx } from './fx.js';
import { initInput } from './input.js';
import { rocketTheme } from './themes/rocket.js';
import { initEngine } from './engine.js';

store.load();
ui.init();
initFx(ui.els.fx);
rocketTheme.mount(ui.els.scene);
initInput(ui.els.app);
initEngine(rocketTheme);

// Debug handle (harmless in production; handy for poking at state).
window.__blastoff = { store, ui };

// Offline support — only once deployed (dev stays cache-free).
if ('serviceWorker' in navigator && location.hostname.endsWith('github.io')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
