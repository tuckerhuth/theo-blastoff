// DOM UI: number tiles, giant countdown numeral, stars, banner, ghost hand,
// sticker shelf, parent panel.

import { store, GAME_VERSION } from './store.js';
import { numberColors } from './themes/index.js';
import { tileTapHandler } from './input.js';
import { nudge } from './levels.js';
import { voiceSupported, voiceRefresh, micStatus, voiceAuditLog } from './voice.js';
import { audioState } from './audio.js';

export const STICKERS = ['🚀', '⭐', '👨‍🚀', '🪐', '🌙', '☄️', '🛸', '🌈', '🏆', '🦄', '🐉', '🦖'];

const $ = (id) => document.getElementById(id);

export const ui = {
  els: {},

  init() {
    for (const id of ['app', 'scene', 'fx', 'tray', 'bigNum', 'stars', 'banner', 'ghost',
      'title', 'titleShelf', 'ceremony', 'bigSticker', 'ceremonyShelf',
      'alldone', 'btnOneMore', 'btnAllDone', 'parent', 'parentStats', 'parentToggles',
      'parentLevels', 'parentVoice', 'micDot', 'parentBtn', 'btnTutorial', 'btnReset', 'btnCloseParent', 'playHint']) {
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
      b.style.setProperty('--tile-color', numberColors()[n]);
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
    b.style.setProperty('--big-glow', numberColors()[n] || '#4f7bff');
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

  // text: a string, or { title, subtitle } for a two-line finale (the
  // knight theme's "Victory!" / "The wyrm is slayne").
  banner(text, ms = 2200) {
    const b = this.els.banner;
    if (text && typeof text === 'object') {
      b.replaceChildren();
      const t = document.createElement('span');
      t.className = 'banner-title';
      t.textContent = text.title;
      b.appendChild(t);
      if (text.subtitle) {
        const s = document.createElement('span');
        s.className = 'banner-sub';
        s.textContent = text.subtitle;
        b.appendChild(s);
      }
    } else {
      b.textContent = text;
    }
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
    this.renderParentLevels();
    this.renderParentToggles();
    this.renderParentVoice();
    // Health line: makes any "broken on my phone" screenshot self-diagnosing.
    const sw = navigator.serviceWorker?.controller ? 'on' : 'none';
    document.getElementById('parentTip').textContent =
      `Open this panel any time with the ⚙️ (hold it on a touchscreen). ` +
      `Build ${GAME_VERSION} · sw: ${sw} · audio: ${audioState()} · mic: ${micStatus()}`;
    this.show('parent');
  },

  // Skip-ahead / ease-back steppers. Take effect next round.
  renderParentLevels() {
    const wrap = this.els.parentLevels;
    wrap.replaceChildren();
    const h = document.createElement('h3');
    h.textContent = 'Difficulty (changes apply to the next round)';
    wrap.appendChild(h);

    const rows = [
      ['up', 'level', 'Counting UP — level (1–4)', () => store.data.levelUp],
      ['down', 'level', 'Counting DOWN — level (1–4)', () => store.data.levelDown],
      [null, 'len', 'Counting to / down from (3–10)', () => store.data.seqLen],
    ];
    for (const [dir, what, label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'stepper';
      const span = document.createElement('span');
      span.textContent = label;
      row.appendChild(span);
      const minus = document.createElement('button');
      minus.textContent = '−';
      const val = document.createElement('b');
      val.textContent = value();
      const plus = document.createElement('button');
      plus.textContent = '+';
      const bump = (delta) => () => {
        nudge(dir, what, delta);
        val.textContent = value();
        this.renderParentStats();
      };
      minus.addEventListener('click', bump(-1));
      plus.addEventListener('click', bump(+1));
      row.append(minus, val, plus);
      wrap.appendChild(row);
    }
  },

  renderParentStats() {
    const d = store.data;
    const wrap = this.els.parentStats;
    wrap.replaceChildren();

    const line = document.createElement('div');
    line.className = 'stat-line';
    line.textContent = `Launches: ${d.launches} · Missions: ${d.missions} · Stickers: ${d.stickers.length} · Level up/down: ${d.levelUp}/${d.levelDown} · Counting to ${d.seqLen}`;
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
      ['showNumbers', 'Show the tower numbers (easier — recognition instead of recall)'],
    ];
    if (voiceSupported()) {
      toggles.push(['micOn', '🎤 Say the number out loud (experimental — saying the right number counts as a tap; uses the browser’s speech service)']);
    }
    for (const [key, label] of toggles) {
      const l = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = store.data.settings[key];
      input.addEventListener('change', () => {
        store.data.settings[key] = input.checked;
        store.save();
        if (key === 'micOn') voiceRefresh(); // ask for the mic right away
      });
      l.appendChild(input);
      l.appendChild(document.createTextNode(label));
      wrap.appendChild(l);
    }
  },

  // Voice audit: what the recognizer heard and what happened to it,
  // interleaved with the clips the game spoke. This is how "he said the
  // right number and nothing happened" gets diagnosed after a play session
  // — mid-speech drops leave no other trace (see voiceAudit in voice.js).
  renderParentVoice() {
    const wrap = this.els.parentVoice;
    wrap.replaceChildren();
    const log = voiceAuditLog();
    if (!log.length) return; // mic never used on this device — say nothing
    const h = document.createElement('h3');
    h.textContent = '🎤 Voice log (newest first · ▶ = game clip · 🔇 = game was speaking)';
    wrap.appendChild(h);
    const pre = document.createElement('pre');
    pre.className = 'voicelog';
    pre.textContent = log.slice(-60).reverse().map((e) => {
      const time = new Date(e.t).toLocaleTimeString();
      return e.clip !== undefined
        ? `${time}  ▶ ${e.clip}`
        : `${time}  “${e.heard}”${e.muted ? ' 🔇' : ''} → ${e.verdict}`;
    }).join('\n');
    wrap.appendChild(pre);
    const copy = document.createElement('button');
    copy.textContent = `Copy full log (${log.length})`;
    copy.addEventListener('click', () => {
      navigator.clipboard?.writeText(JSON.stringify(log)).then(
        () => { copy.textContent = 'Copied ✓'; },
        () => { copy.textContent = 'Copy blocked — screenshot instead'; });
    });
    wrap.appendChild(copy);
  },

  // Visible ⚙️: instant click with a mouse (Theo doesn't use one), but on a
  // touchscreen it takes a 2s hold — a progress ring fills — so screen
  // mashing can't open it.
  initParentButton(onOpen) {
    const btn = this.els.parentBtn;
    let raf = null;
    const cancel = () => {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      btn.style.removeProperty('--hold');
    };
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.pointerType === 'mouse') { onOpen(); return; }
      cancel();
      const start = performance.now();
      const step = () => {
        const p = (performance.now() - start) / 2000;
        btn.style.setProperty('--hold', Math.min(1, p));
        if (p >= 1) { cancel(); onOpen(); } else { raf = requestAnimationFrame(step); }
      };
      raf = requestAnimationFrame(step);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
      btn.addEventListener(ev, cancel);
    }
  },
};
