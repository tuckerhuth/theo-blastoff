// DOM UI: number tiles, giant countdown numeral, stars, banner, ghost hand,
// sticker shelf, parent panel.

import { store } from './store.js';
import { NUMBER_COLORS } from './themes/rocket.js';
import { tileTapHandler } from './input.js';

export const STICKERS = ['🚀', '⭐', '👨‍🚀', '🪐', '🌙', '☄️', '🛸', '🌈', '🏆', '🦄', '🐉', '🦖'];

const $ = (id) => document.getElementById(id);

export const ui = {
  els: {},

  init() {
    for (const id of ['app', 'scene', 'fx', 'tray', 'bigNum', 'stars', 'banner', 'ghost',
      'parentZone', 'title', 'titleShelf', 'ceremony', 'bigSticker', 'ceremonyShelf',
      'alldone', 'btnOneMore', 'btnAllDone', 'parent', 'parentStats', 'parentToggles',
      'btnTutorial', 'btnReset', 'btnCloseParent', 'playHint']) {
      this.els[id] = $(id);
    }
    this.setStars(0);
  },

  /* ---------- tiles ---------- */

  showTiles(choices, onPickIndex) {
    const tray = this.els.tray;
    tray.replaceChildren();
    const solo = choices.length === 1;
    return choices.map((n, i) => {
      const b = document.createElement('button');
      b.className = 'tile' + (solo ? ' solo' : '');
      b.tabIndex = -1; // focus would let the browser auto-scroll the locked viewport
      b.style.setProperty('--tile-color', NUMBER_COLORS[n]);
      b.style.animationDelay = `${i * 0.07}s`;
      b.dataset.n = n;

      const numeral = document.createElement('span');
      numeral.className = 'numeral';
      numeral.textContent = n;
      b.appendChild(numeral);

      const dots = document.createElement('span');
      dots.className = 'dots';
      dots.style.gridTemplateColumns = `repeat(${Math.min(n, 5)}, 1fr)`;
      for (let d = 0; d < n; d++) dots.appendChild(document.createElement('i'));
      b.appendChild(dots);

      b.addEventListener('pointerdown', tileTapHandler(i));
      tray.appendChild(b);
      return b;
    });
  },

  clearTiles() { this.els.tray.replaceChildren(); },

  feedback(el, kind) {
    // kind: wiggle | pulse | glow | dim | correct-pop
    if (kind === 'wiggle' || kind === 'correct-pop') {
      el.classList.remove(kind);
      void el.offsetWidth; // restart animation
      el.classList.add(kind);
    } else {
      el.classList.add(kind);
    }
  },

  /* ---------- giant countdown numeral ---------- */

  setBigNum(n, { solo = false } = {}) {
    const b = this.els.bigNum;
    b.classList.remove('hidden');
    b.classList.toggle('solo', solo);
    b.textContent = n;
    b.style.setProperty('--big-glow', NUMBER_COLORS[n] || '#4f7bff');
    b.classList.remove('tick');
    void b.offsetWidth;
    b.classList.add('tick');
  },

  hideBigNum() { this.els.bigNum.classList.add('hidden'); },

  /* ---------- HUD / banner ---------- */

  setStars(earned, total = 3) {
    const s = this.els.stars;
    s.replaceChildren();
    for (let i = 0; i < total; i++) {
      const span = document.createElement('span');
      span.className = 'slot' + (i < earned ? ' earned' : '');
      span.textContent = i < earned ? '⭐' : '☆';
      s.appendChild(span);
    }
  },

  banner(text, ms = 2200) {
    const b = this.els.banner;
    b.textContent = text;
    b.classList.remove('hidden');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => b.classList.add('hidden'), ms);
  },

  /* ---------- ghost hand (tutorial + hints) ---------- */

  async ghostTo(el, { press = true } = {}) {
    const g = this.els.ghost;
    const r = el.getBoundingClientRect();
    const tx = r.left + r.width * 0.5 - g.offsetWidth * 0.25;
    const ty = r.top + r.height * 0.55;
    if (g.classList.contains('hidden')) {
      g.style.left = `${innerWidth * 0.5}px`;
      g.style.top = `${innerHeight * 0.75}px`;
      g.classList.remove('hidden');
      await new Promise(r2 => setTimeout(r2, 60));
    }
    g.classList.remove('bouncing');
    g.style.left = `${tx}px`;
    g.style.top = `${ty}px`;
    await new Promise(r2 => setTimeout(r2, 950));
    if (press) {
      g.classList.add('pressing');
      await new Promise(r2 => setTimeout(r2, 420));
      g.classList.remove('pressing');
    }
  },

  async ghostBounceOver(el) {
    await this.ghostTo(el, { press: false });
    this.els.ghost.classList.add('bouncing');
  },

  ghostHide() {
    this.els.ghost.classList.add('hidden');
    this.els.ghost.classList.remove('bouncing', 'pressing');
  },

  /* ---------- overlays / shelf ---------- */

  show(id) { this.els[id].classList.remove('hidden'); },
  hide(id) { this.els[id].classList.add('hidden'); },

  renderShelf(el) {
    el.replaceChildren();
    const recent = store.data.stickers.slice(-14);
    recent.forEach((s, i) => {
      const span = document.createElement('span');
      span.textContent = s;
      span.style.animationDelay = `${i * 0.05}s`;
      el.appendChild(span);
    });
  },

  /* ---------- parent panel ---------- */

  openParent() {
    this.renderParentStats();
    this.renderParentToggles();
    this.show('parent');
  },

  renderParentStats() {
    const d = store.data;
    const wrap = this.els.parentStats;
    wrap.replaceChildren();

    const line = document.createElement('div');
    line.className = 'stat-line';
    line.textContent = `Launches: ${d.launches} · Missions: ${d.missions} · Stickers: ${d.stickers.length} · Level up/down: ${d.levelUp}/${d.levelDown} · Counting to: ${d.seqLenUp} up, ${d.seqLenDown} down`;
    wrap.appendChild(line);

    const addGrid = (title, dir, pairs) => {
      const h = document.createElement('h3');
      h.textContent = title;
      wrap.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'tgrid';
      for (const [from, to] of pairs) {
        const cell = document.createElement('span');
        cell.className = 'tcell';
        const t = d.transitions[store.transKey(dir, from, to)];
        const total = t ? t.ok + t.err : 0;
        if (total >= 3) {
          const rate = t.err / total;
          cell.classList.add(rate < 0.2 ? 'good' : rate < 0.5 ? 'warn' : 'bad');
        }
        cell.textContent = `${from}→${to}${total ? ` (${t.ok}/${total})` : ''}`;
        cell.title = total ? `${t.ok} right first try out of ${total}` : 'no data yet';
        grid.appendChild(cell);
      }
      wrap.appendChild(grid);
    };

    addGrid('Counting UP — first-try success', 'up',
      Array.from({ length: 9 }, (_, i) => [i + 1, i + 2]));
    addGrid('Counting DOWN — first-try success', 'down',
      Array.from({ length: 9 }, (_, i) => [10 - i, 9 - i]));
  },

  renderParentToggles() {
    const wrap = this.els.parentToggles;
    wrap.replaceChildren();
    const toggles = [
      ['voice', 'Voice (counting and prompts)'],
      ['sfx', 'Sound effects'],
      ['keyboardZones', 'Keyboard plays the game (left keys = left tile). Off = keyboard fully ignored.'],
    ];
    for (const [key, label] of toggles) {
      const l = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = store.data.settings[key];
      input.addEventListener('change', () => {
        store.data.settings[key] = input.checked;
        store.save();
      });
      l.appendChild(input);
      l.appendChild(document.createTextNode(label));
      wrap.appendChild(l);
    }
  },

  // Press-and-hold the top-left corner for 3s.
  initParentZone(onOpen) {
    const zone = this.els.parentZone;
    let timer = null;
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    zone.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      cancel();
      timer = setTimeout(() => { timer = null; onOpen(); }, 3000);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
      zone.addEventListener(ev, cancel);
    }
  },
};
