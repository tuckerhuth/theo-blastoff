// The conductor: session → rounds → phases → steps.
// A session is 3 launches; every launch is earned by counting UP (build)
// then DOWN (countdown). Steps are gentle: misses only ever make the right
// answer more obvious, so every round ends at BLAST OFF.

import { store } from './store.js';
import { initAudio, speak, numClip, sfx } from './audio.js';
import { setTargets, clearTargets } from './input.js';
import { makeSequence, makeStep } from './tasks.js';
import { roundPlan, afterPhase, afterRound } from './levels.js';
import { ui, STICKERS } from './ui.js';
import { confettiBurst } from './fx.js';
import { voiceExpect, voiceClearExpect, voiceRefresh } from './voice.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

let theme = null;
let running = false;
let sessionStars = 0;

/* ---------------- one answerable step ---------------- */

function doStep({ dir, target, prev, step, ghost = false }) {
  return new Promise((resolve) => {
    let misses = 0;
    let done = false;
    const solo = step.choices.length === 1;
    const useBigSolo = dir === 'down' && solo;
    let els;
    let idleT1 = null, idleT2 = null;

    const correctEl = () => els[solo ? 0 : step.correctIndex];

    const clearIdle = () => { clearTimeout(idleT1); clearTimeout(idleT2); };
    const armIdle = () => {
      clearIdle();
      if (ghost) return;
      idleT1 = setTimeout(() => {
        if (done) return;
        speak(solo ? [numClip(target)] : [prev === null ? 'whatfirst' : 'whatnext']);
        ui.ghostBounceOver(correctEl());
      }, 6000);
      idleT2 = setTimeout(() => {
        if (done) return;
        ui.feedback(correctEl(), 'glow');
        els.forEach((e, j) => { if (e !== correctEl()) ui.feedback(e, 'dim'); });
        speak([numClip(target)]);
      }, 12000);
    };

    const onPick = (i) => {
      if (done) return;
      const correct = solo || i === step.correctIndex;
      if (correct) {
        done = true;
        clearIdle();
        clearTargets();
        voiceClearExpect();
        ui.ghostHide();
        sfx.press();
        speak([numClip(target)]);
        const el = correctEl();
        if (el.classList.contains('tile')) ui.feedback(el, 'correct-pop');
        setTimeout(() => resolve(misses === 0), 320);
      } else {
        misses++;
        sfx.softNo();
        ui.feedback(els[i], 'wiggle');
        if (misses === 2) ui.feedback(correctEl(), 'pulse');
        if (misses >= 3) {
          ui.feedback(correctEl(), 'glow');
          els.forEach((e, j) => { if (j !== step.correctIndex) ui.feedback(e, 'dim'); });
        }
        armIdle();
      }
    };

    if (useBigSolo) {
      ui.clearTiles();
      ui.setBigNum(target, { solo: true });
      els = [ui.els.bigNum];
    } else {
      // The big numeral always shows the last number counted, so he can see
      // where he is — the tray never covers it.
      if (prev !== null) ui.setBigNum(prev, { solo: false });
      els = ui.showTiles(step.choices, onPick);
    }
    setTargets(els, onPick, { allowAnywhere: solo });
    // Saying the right number out loud counts too (parent-toggled, additive).
    voiceExpect(target, () => {
      sfx.chime(); // extra sparkle: he SAID it
      onPick(solo ? 0 : step.correctIndex);
    });

    if (ghost) {
      // Tutorial demo: the ghost hand plays this step.
      clearTargets(); // don't let taps race the demo
      (async () => {
        await speak(['watchme']);
        await ui.ghostTo(correctEl());
        onPick(solo ? 0 : step.correctIndex);
        setTimeout(() => ui.ghostHide(), 500);
      })();
    } else {
      if (!solo) speak([prev === null ? 'whatfirst' : 'whatnext'], { interrupt: false });
      armIdle();
    }
  });
}

/* ---------------- a phase: count up or down ---------------- */

async function runPhase(dir, plan, { tutorial = false } = {}) {
  const seq = makeSequence(dir, plan.len);
  const stats = { steps: 0, firstTry: 0 };
  let prev = null;

  for (let idx = 0; idx < seq.length; idx++) {
    const target = seq[idx];
    // Countdown always anchors on its first number (the "10!" ritual tap)
    // before asking questions. Level 0 = solo.
    const level = (tutorial || (dir === 'down' && idx === 0)) ? 0 : plan.level;
    const step = makeStep({ dir, target, prev, level });
    const ghost = tutorial && idx === 0;

    const firstTry = await doStep({ dir, target, prev, step, ghost });

    if (prev !== null && !tutorial) {
      stats.steps++;
      if (firstTry) stats.firstTry++;
      store.recordTransition(dir, prev, target, firstTry);
    }

    if (dir === 'up') {
      const load = theme.loadCrate(target, plan.len);
      sfx.thunk();
      await load;
      ui.setBigNum(target, { solo: false }); // he can always see where he is
    } else {
      theme.tickCountdown(target, plan.len);
      sfx.tick(target);
      sfx.rumbleLevel(((plan.len - target + 1) / plan.len) * 0.75);
      if (step.choices.length > 1) ui.setBigNum(target, { solo: false });
      await wait(280);
    }

    if (tutorial && idx === 0) await speak(['yourturn']);
    prev = target;
  }
  return stats;
}

/* ---------------- one round = one launch ---------------- */

async function runRound({ tutorial = false } = {}) {
  theme.reset(true); // empty pad — counting up literally builds the rocket
  ui.hideBigNum();
  const planUp = tutorial ? { level: 0, len: 3, masked: false } : roundPlan('up');
  const planDown = tutorial ? { level: 0, len: 3, masked: false } : roundPlan('down');
  theme.setRange(planUp.len); // one number per round: build to N, count down from N

  // BUILD — counting up
  theme.setMasked(planUp.masked);
  theme.setDirection('up');
  await speak(tutorial ? ['hello'] : ['hello', 'countup'], { gap: 0.15 });
  const upStats = await runPhase('up', planUp, { tutorial });
  sfx.chime();
  ui.clearTiles();
  ui.hideBigNum();

  // the crew boards before the countdown
  speak(['allaboard']);
  sfx.steps();
  await theme.boardCrew();

  // COUNTDOWN — counting down
  theme.setMasked(planDown.masked);
  await speak(['countdown']);
  theme.preCountdown(planDown.len);
  sfx.rumbleStart();
  sfx.rumbleLevel(0.15);
  const downStats = await runPhase('down', planDown, { tutorial });

  // BLAST OFF
  clearTargets();
  voiceClearExpect();
  ui.hideBigNum();
  ui.clearTiles();
  ui.banner('BLAST OFF!', 2800);
  speak(['blastoff']);
  sfx.rumbleLevel(1);
  sfx.whoosh();
  await theme.launch([ui.els.scene]);
  sfx.rumbleStop();
  sfx.fanfare();
  await speak([`great${1 + Math.floor(Math.random() * 3)}`]);

  if (!tutorial) {
    const accUp = afterPhase('up', upStats);
    const accDown = afterPhase('down', downStats);
    afterRound(accUp, accDown);
  }
  store.data.launches++;
  store.save();
}

/* ---------------- ceremony + all-done ---------------- */

async function ceremony() {
  store.data.missions++;
  const sticker = STICKERS[(store.data.stickers.length) % STICKERS.length];
  store.data.stickers.push(sticker);
  store.save();

  ui.els.bigSticker.textContent = sticker;
  ui.renderShelf(ui.els.ceremonyShelf);
  ui.show('ceremony');
  sfx.fanfare();
  confettiBurst(innerWidth / 2, innerHeight / 2.4, 100);
  await speak(['mission']);
  await wait(1600);
  ui.hide('ceremony');

  ui.show('alldone');
  speak(['onemore']);
  const choice = await new Promise((resolve) => {
    ui.els.btnOneMore.onclick = () => resolve('more');
    ui.els.btnAllDone.onclick = () => resolve('done');
  });
  ui.hide('alldone');
  return choice;
}

/* ---------------- session ---------------- */

async function session() {
  sessionStars = 0;
  ui.setStars(0);

  if (!store.data.tutorialDone) {
    await runRound({ tutorial: true });
    store.data.tutorialDone = true;
    store.save();
    sessionStars = 1;
  } else {
    await runRound();
    sessionStars = 1;
  }
  ui.setStars(sessionStars);

  while (sessionStars < 3) {
    await wait(700);
    await runRound();
    sessionStars++;
    ui.setStars(sessionStars);
  }

  await wait(600);
  const choice = await ceremony();
  if (choice === 'more') {
    speak(['ready']);
    return session();
  }
  speak(['alldone']);
  toTitle();
}

function toTitle() {
  running = false;
  sfx.rumbleStop(0.2); // never leave the rumble loop running (audible "whistle")
  clearTargets();
  voiceClearExpect();
  theme.reset();
  ui.hideBigNum();
  ui.clearTiles();
  ui.renderShelf(ui.els.titleShelf);
  ui.show('title');
}

/* ---------------- bootstrap ---------------- */

export function initEngine(selectedTheme) {
  theme = selectedTheme;

  ui.els.title.addEventListener('pointerdown', async () => {
    if (running) return;
    running = true;
    await initAudio();
    voiceRefresh(); // start the mic if the parent enabled it
    ui.hide('title');
    session().catch(err => { console.error(err); toTitle(); });
  });

  ui.initParentButton(() => ui.openParent());
  ui.els.btnCloseParent.addEventListener('click', () => ui.hide('parent'));
  ui.els.btnTutorial.addEventListener('click', () => {
    store.data.tutorialDone = false;
    store.save();
    ui.hide('parent');
  });
  ui.els.btnReset.addEventListener('click', () => {
    if (confirm('Erase all progress, stats, and stickers?')) {
      store.reset();
      location.reload();
    }
  });

  ui.renderShelf(ui.els.titleShelf);
}
