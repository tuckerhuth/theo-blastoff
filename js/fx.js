// Canvas particle layer: smoke, confetti, star streaks. Screen-space,
// sits above the SVG scene, below the UI.
//
// Demand-driven: the render loop runs only while something is alive and
// stops completely when the canvas is empty — an always-on full-screen
// rAF clear is enough sustained GPU load to spin fans on a quiet title
// screen.

let cv, cx;
let parts = [];
let streakUntil = 0;
let rafId = null;
let lastT = 0;

export function initFx(canvas) {
  cv = canvas;
  cx = cv.getContext('2d');
  const resize = () => {
    cv.width = innerWidth * devicePixelRatio;
    cv.height = innerHeight * devicePixelRatio;
    cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
}

function wake() {
  if (rafId === null) {
    lastT = 0;
    rafId = requestAnimationFrame(loop);
  }
}

function loop(ts) {
  rafId = null;
  window.__fxFrames = (window.__fxFrames || 0) + 1; // debug: frame counter
  // Real frame delta, clamped: correct speed on 120Hz displays, no particle
  // teleport after a background-tab stall.
  const dt = lastT ? Math.min((ts - lastT) / 1000, 0.05) : 1 / 60;
  lastT = ts;

  cx.clearRect(0, 0, innerWidth, innerHeight);
  const now = performance.now();

  if (now < streakUntil && Math.random() < 0.5) {
    parts.push({
      kind: 'streak',
      x: Math.random() * innerWidth,
      y: -20,
      vy: 900 + Math.random() * 900,
      len: 40 + Math.random() * 90,
      life: 1.4,
      age: 0,
    });
  }

  parts = parts.filter(p => {
    p.age += dt;
    if (p.age > p.life) return false;
    const t = p.age / p.life;

    if (p.kind === 'smoke') {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy *= 0.985; p.vx *= 0.985;
      p.r += 34 * dt;
      cx.globalAlpha = 0.5 * (1 - t);
      cx.fillStyle = p.hot && t < 0.3 ? '#ffd9a0' : '#cfd2e8';
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill();
    } else if (p.kind === 'confetti') {
      p.vy += 500 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
      cx.globalAlpha = 1 - t * t;
      cx.save();
      cx.translate(p.x, p.y); cx.rotate(p.rot);
      cx.fillStyle = p.color;
      cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      cx.restore();
    } else if (p.kind === 'streak') {
      p.y += p.vy * dt;
      cx.globalAlpha = 0.8 * (1 - t);
      cx.strokeStyle = '#fff';
      cx.lineWidth = 2;
      cx.beginPath();
      cx.moveTo(p.x, p.y);
      cx.lineTo(p.x, p.y - p.len);
      cx.stroke();
      if (p.y - p.len > innerHeight) return false;
    }
    return true;
  });
  cx.globalAlpha = 1;

  // Anything left to animate? Otherwise sleep until the next spawn.
  // (This frame already drew only survivors, so an empty canvas stays clean.)
  if (parts.length || performance.now() < streakUntil) {
    rafId = requestAnimationFrame(loop);
  }
}

export function smoke(x, y, n = 6, hot = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (0.75 + Math.random() * 1.5); // fan mostly sideways/up
    const sp = 90 + Math.random() * 220;
    parts.push({
      kind: 'smoke', x: x + (Math.random() - 0.5) * 60, y,
      vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp * 0.4 - 30,
      r: 16 + Math.random() * 26, life: 1.8 + Math.random() * 1.4, age: 0, hot,
    });
  }
  wake();
}

const CONFETTI_COLORS = ['#ff5a5a', '#ff9438', '#ffd94a', '#7ed957', '#3ec5ff', '#8f6bff', '#ff6bb3'];

export function confettiBurst(x, y, n = 60) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 220 + Math.random() * 480;
    parts.push({
      kind: 'confetti', x, y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260,
      r: 4 + Math.random() * 6,
      rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      life: 1.8 + Math.random() * 1.2, age: 0,
    });
  }
  wake();
}

export function starStreaks(ms) {
  streakUntil = performance.now() + ms;
  wake();
}
