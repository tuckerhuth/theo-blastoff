// The conductor: session → rounds → phases → steps.
// A session is 3 launches; every launch is earned by counting UP (build)
// then DOWN (countdown). Steps are gentle: misses only ever make the right
// answer more obvious, so every round ends at BLAST OFF.

import { store } from './store.js';
import { initAudio, speak, hushSpeech, numClip, sfx } from './audio.js';
import { setTargets, clearTargets } from './input.js';
import { makeSequence, makeStep, shuffle } from './tasks.js';
import { roundPlan, afterPhase, afterRound } from './levels.js';
import { ui, STICKERS } from './ui.js';
import { confettiBurst } from './fx.js';
import { voiceExpect, voiceClearExpect, voiceRefresh, voiceQueueSize } from './voice.js';

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// Prompt on gap, not on arm: Theo counts in bursts, and the game only asks
// "what comes next?" after a real silence. Escalation stays gentle, and each
// rung waits its window of SILENCE *after the previous prompt finishes
// speaking* (not a fixed offset from arm) — so a longer spoken prompt never
// crowds the next one back-to-back, and Theo always gets room to answer.
const GAP_PROMPT = 3500;   // first silence before the game asks the question
const RESPOND = 3500;      // response window (silence) after each prompt before escalating

let theme = null;
let running = false;
let sessionStars = 0;

/* ---------------- one answerable step ---------------- */

function doStep({ dir, target, prev, step, ghost = false, provisionalNext = null }) {
  return new Promise((resolve) => {
    let misses = 0;
    let done = false;
    const solo = step.choices.length === 1;
    const useBigSolo = dir === 'down' && solo;
    let els;
    let idleT1 = null, idleT2 = null, idleT3 = null;
    let idleGen = 0; // bumped on every clear/re-arm — invalidates in-flight async rungs

    const correctEl = () => els[solo ? 0 : step.correctIndex];
    // "Counting down! What comes after nine?" — direction context on every
    // prompt. The question is one baked clip (afterN) so the sentence has
    // natural prosody. Speaks the PREVIOUS number, never the answer
    // (guard-safe). The opening step of a phase — including the countdown's
    // solo anchor on the top number — asks "what comes first?" so the child
    // says it (e.g. "ten"), rather than the game announcing the number.
    const dirClip = dir === 'up' ? 'countingup' : 'countingdown';
    const promptClips = () => (prev === null
      ? [dirClip, 'whatfirst']
      : (solo ? [numClip(target)] : [dirClip, `after${prev}`]));

    const clearIdle = () => { idleGen++; clearTimeout(idleT1); clearTimeout(idleT2); clearTimeout(idleT3); };
    const armIdle = () => {
      clearIdle();
      if (ghost) return;
      // Each rung's window is silence AFTER the previous prompt finishes, so
      // the chain is async. A wrong tap re-arms mid-speech; the `alive` token
      // (own generation, not yet answered) stops a stale chain from resuming
      // after its await and double-scheduling the next rung.
      const gen = idleGen;
      const alive = () => !done && gen === idleGen;
      // Rung 1: after a real gap, ask the question.
      idleT1 = setTimeout(async () => {
        if (!alive()) return;
        await speak(promptClips(), { skipIfBusy: true });
        if (!alive()) return;
        // Rung 2: a response window later, ask again + bounce the ghost.
        idleT2 = setTimeout(async () => {
          if (!alive()) return;
          ui.ghostBounceOver(correctEl());
          await speak(promptClips());
          if (!alive()) return;
          // Rung 3: a further window later, glow the answer and say it.
          idleT3 = setTimeout(() => {
            if (!alive()) return;
            ui.feedback(correctEl(), 'glow');
            els.forEach((e, j) => { if (e !== correctEl()) ui.feedback(e, 'dim'); });
            speak([numClip(target)]);
          }, RESPOND);
        }, RESPOND);
      }, GAP_PROMPT);
    };

    const onPick = (i, viaVoice = false) => {
      if (done) return;
      const correct = solo || i === step.correctIndex;
      if (correct) {
        done = true;
        clearIdle();
        hushSpeech(); // he answered — cut off any in-flight prompt/hint mid-word
        clearTargets();
        // Advance the voice expectation provisionally so a number spoken in
        // the gap before the next step arms still lands (tap 3, say "four").
        // Only WITHIN a phase — the last step passes no provisional, so the
        // expectation (and queue) clears at a phase boundary and the next
        // phase starts fresh (the countdown anchor asks, never auto-fires).
        if (provisionalNext) voiceExpect(provisionalNext.n, null, provisionalNext.dir);
        else voiceClearExpect();
        ui.ghostHide();
        sfx.press();
        // Say the number the instant a tile is tapped — immediate, unambiguous
        // confirmation (a tap-first kid, and the tablet has no mic). NOT via
        // mic: there he already said the number himself.
        if (!viaVoice) speak([numClip(target)]);
        const burst = voiceQueueSize() > 0;
        const el = correctEl();
        if (el.classList.contains('tile')) ui.feedback(el, 'correct-pop');
        setTimeout(() => resolve(misses === 0), burst ? 0 : 150);
      } else {
        misses++;
        clearIdle();               // stop the hint ladder during the lock (re-armed after the reshuffle)
        clearTargets();            // lock input during the correction — no machine-gunning
        sfx.softNo();
        ui.feedback(els[i], 'wiggle');
        // Say which number he actually pressed ("No, not seven") — warm, and
        // it doubles as a number-recognition beat.
        speak(['notquite', numClip(step.choices[i])]);
        // A wrong tap costs a short pause, then the tiles reshuffle POSITIONS
        // (same numbers) so tapping the same spot can't win. Escalating help
        // comes later than before, so spraying isn't rewarded on tap 3.
        setTimeout(() => {
          if (done) return; // answered by voice during the lock — nothing to do
          shuffle(step.choices);
          step.correctIndex = step.choices.indexOf(target);
          els = ui.showTiles(step.choices, onPick);
          setTargets(els, onPick, { allowAnywhere: solo });
          if (misses >= 4) {
            ui.feedback(correctEl(), 'glow');
            els.forEach((e) => { if (e !== correctEl()) ui.feedback(e, 'dim'); });
          } else if (misses >= 3) {
            ui.feedback(correctEl(), 'pulse');
          }
          armIdle();
        }, 600);
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
      onPick(solo ? 0 : step.correctIndex, true); // viaVoice — don't echo the number back
    }, dir === 'up' ? 1 : -1);

    if (ghost) {
      // Tutorial demo — but taps outrank it: targets stay armed, and
      // answering early simply beats the ghost to it.
      (async () => {
        await speak(['watchme']);
        if (done) return;
        await ui.ghostTo(correctEl());
        onPick(solo ? 0 : step.correctIndex); // no-op if already answered
        setTimeout(() => ui.ghostHide(), 500);
      })();
    } else {
      // No prompt at arm time — the idle ladder asks only after a real gap.
      armIdle();
    }
  });
}

/* ---------------- a phase: count up or down ---------------- */

async function runPhase(dir, plan, { tutorial = false, nextPhase = null } = {}) {
  const seq = makeSequence(dir, plan.len);
  const stats = { steps: 0, firstTry: 0 };
  const anims = []; // fire-and-forget visuals; the phase end waits for all
  let prev = null;

  for (let idx = 0; idx < seq.length; idx++) {
    const target = seq[idx];
    // Countdown always anchors on its first number (the "10!" ritual tap)
    // before asking questions. Level 0 = solo.
    const level = (tutorial || (dir === 'down' && idx === 0)) ? 0 : plan.level;
    const step = makeStep({ dir, target, prev, level });
    const ghost = tutorial && idx === 0;

    const provisionalNext = idx < seq.length - 1
      ? { n: seq[idx + 1], dir: dir === 'up' ? 1 : -1 }
      : nextPhase;
    const firstTry = await doStep({ dir, target, prev, step, ghost, provisionalNext });

    if (prev !== null && !tutorial) {
      stats.steps++;
      if (firstTry) stats.firstTry++;
      store.recordTransition(dir, prev, target, firstTry);
    }

    // Tower, anchor numeral, and sounds update at ACCEPTANCE — the truth of
    // "where am I" never waits for an animation. Visuals run behind during a
    // rapid burst and catch up; the phase end waits for all of them.
    if (dir === 'up') {
      theme.markCounted(target);
      ui.setBigNum(target, { solo: false });
      sfx.thunk();
      // Fire-and-forget the crate flight: the tower + numeral already updated
      // at acceptance (above), so the next question arms immediately instead
      // of waiting ~1s for the animation (which read to Theo as the game being
      // slow to take his answer). Phase end still awaits every crate below.
      const burst = voiceQueueSize() > 0;
      anims.push(theme.loadCrate(target, plan.len, burst));
    } else {
      theme.tickCountdown(target, plan.len);
      sfx.tick(target);
      sfx.rumbleLevel(((plan.len - target + 1) / plan.len) * 0.75);
      if (step.choices.length > 1) ui.setBigNum(target, { solo: false });
      if (voiceQueueSize() === 0) await wait(280);
    }

    if (tutorial && idx === 0) speak(['yourturn']); // non-blocking, tappable through
    prev = target;
  }
  await Promise.all(anims); // rocket visually complete before boarding/launch
  return stats;
}

/* ---------------- one round = one launch ---------------- */

async function runRound({ tutorial = false } = {}) {
  theme.setVariant?.(sessionStars); // e.g. knight's day→night arc across a mission's 3 launches
  theme.reset(true); // empty pad — counting up literally builds the rocket
  ui.hideBigNum();
  const planUp = tutorial ? { level: 0, len: 3, masked: false } : roundPlan('up');
  const planDown = tutorial ? { level: 0, len: 3, masked: false } : roundPlan('down');
  theme.setRange(planUp.len); // one number per round: build to N, count down from N

  // BUILD — counting up. The intro doesn't block: the first question arms
  // immediately, and answering simply cuts the speaker off. Theo outranks
  // Samantha.
  theme.setMasked(planUp.masked);
  theme.setDirection('up');
  speak(tutorial ? ['hello'] : (sessionStars === 0 ? ['hello', 'countup'] : ['countup']), { gap: 0.15 });
  // No cross-phase carryover: the countdown must start FRESH so its anchor
  // asks "what comes first?" and Theo says the top number. The build's last
  // number equals the countdown's first (build to N, count down from N), so
  // a late echo of "N" finishing the build would otherwise queue against a
  // provisional and silently auto-fire the anchor — skipping the question.
  // The last build step clears the expectation (and flushes the queue).
  const upStats = await runPhase('up', planUp, { tutorial });
  sfx.chime();
  ui.clearTiles();
  ui.hideBigNum();

  // the crew boards before the countdown
  speak(['allaboard']);
  sfx.steps();
  await theme.boardCrew();

  // COUNTDOWN — counting down (intro doesn't block here either)
  theme.setMasked(planDown.masked);
  speak(['countdown']);
  theme.preCountdown(planDown.len);
  sfx.rumbleStart();
  sfx.rumbleLevel(0.15);
  const downStats = await runPhase('down', planDown, { tutorial });

  // BLAST OFF
  clearTargets();
  voiceClearExpect();
  ui.hideBigNum();
  ui.clearTiles();
  ui.banner(theme.strings?.finaleBanner ?? 'BLAST OFF!', 2800);
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

// Swaps the active theme the engine drives. Only called at the title screen
// (isRunning() false) — initEngine itself is never re-invoked, since its
// title/parent listeners must bind exactly once.
export function setTheme(t) { theme = t; }
export function isRunning() { return running; }

export function initEngine(selectedTheme) {
  theme = selectedTheme;

  // Respond instantly, never block the start on audio/mic plumbing — iOS
  // is picky about audio-unlock gestures and a hung await here would eat
  // every tap forever ('click' fallback in case pointerdown doesn't fire).
  const startSession = () => {
    if (running) return;
    running = true;
    ui.hide('title');
    initAudio().catch(() => {});
    session().catch(err => { console.error(err); toTitle(); });
    setTimeout(() => voiceRefresh(), 400); // mic permission prompt after liftoff, not during the tap
  };
  ui.els.title.addEventListener('pointerdown', startSession);
  ui.els.title.addEventListener('click', startSession);

  ui.initParentButton(() => ui.openParent());
  ui.els.btnCloseParent.addEventListener('click', () => ui.hide('parent'));
  document.getElementById('btnCloseParentX').addEventListener('click', () => ui.hide('parent'));
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
