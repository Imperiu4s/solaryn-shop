(function () {
  const SPRITE = 64;
  const TAU = Math.PI * 2;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const PARTICLES = {
    christmas: { kind: 'snow', colors: ['#ffffff', '#e8f4ff', '#d6ecff'], count: 70 },
    halloween: { kind: 'leaf', colors: ['#ff8a1f', '#e2600b', '#b4441a', '#8a2f1d', '#b46cff'], count: 24 },
    newyear: { kind: 'confetti', colors: ['#f5cf5b', '#e0ad2e', '#dfe5ff', '#b9c6ff', '#ffffff'], count: 40 },
    valentine: { kind: 'heart', colors: ['#ff5c8a', '#ff9ec0', '#e5356b'], count: 22, rise: true },
    carnival: { kind: 'confetti', colors: ['#ffd23f', '#43d3ff', '#ff5a6e', '#3ee08a', '#b46cff'], count: 46 },
    easter: { kind: 'petal', colors: ['#f7b3d4', '#ffd6e8', '#ffffff', '#c8f2d0', '#fff1a8'], count: 28 },
    national: { kind: 'ribbon', colors: ['#e8343f', '#ffffff', '#3fae5a'], count: 26 },
    summer: { kind: 'glow', colors: ['#ffcf3a', '#ffe58a', '#2fd0e3', '#9af0ff'], count: 22, rise: true }
  };

  function drawParticleShape(g, kind, color) {
    const c = SPRITE / 2;
    g.fillStyle = color;
    if (kind === 'snow' || kind === 'glow') {
      const grad = g.createRadialGradient(c, c, 0, c, c, c);
      grad.addColorStop(0, color);
      grad.addColorStop(kind === 'snow' ? 0.45 : 0.3, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.beginPath(); g.arc(c, c, c, 0, TAU); g.fill();
    } else if (kind === 'leaf') {
      g.beginPath();
      g.moveTo(c, 4);
      g.bezierCurveTo(SPRITE - 6, 18, SPRITE - 10, SPRITE - 14, c, SPRITE - 6);
      g.bezierCurveTo(10, SPRITE - 14, 6, 18, c, 4);
      g.fill();
      g.globalAlpha = 0.45;
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(c, 8); g.lineTo(c, SPRITE - 4); g.stroke();
    } else if (kind === 'confetti') {
      g.fillRect(c - 10, c - 18, 20, 36);
    } else if (kind === 'ribbon') {
      g.fillRect(c - 7, c - 22, 14, 44);
    } else if (kind === 'heart') {
      heartPath(g, c, c + 4, 26);
      g.fill();
    } else if (kind === 'petal') {
      g.beginPath(); g.ellipse(c, c, 12, 22, 0, 0, TAU); g.fill();
    }
  }

  function heartPath(g, x, y, s) {
    g.beginPath();
    g.moveTo(x, y + s * 0.55);
    g.bezierCurveTo(x - s * 1.1, y - s * 0.1, x - s * 0.55, y - s * 0.95, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.55, y - s * 0.95, x + s * 1.1, y - s * 0.1, x, y + s * 0.55);
    g.closePath();
  }

  function spawnParticle(def, sprites, initial) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const kind = def.kind;
    const size = kind === 'snow' ? rand(2, 7) : kind === 'glow' ? rand(6, 22) : kind === 'heart' ? rand(8, 18) : kind === 'leaf' ? rand(10, 20) : rand(5, 11);
    const speed = kind === 'snow' ? rand(0.35, 1.15) : kind === 'glow' ? rand(0.12, 0.37) : kind === 'heart' ? rand(0.25, 0.6) : rand(0.5, 1.4);
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : (def.rise ? h + size * 2 : -size * 2),
      size,
      speed,
      sway: rand(0.4, 1.8),
      phase: Math.random() * TAU,
      freq: rand(0.006, 0.018),
      rot: Math.random() * TAU,
      spin: kind === 'snow' || kind === 'glow' ? 0 : (Math.random() - 0.5) * 0.06,
      flip: Math.random() * TAU,
      alpha: kind === 'glow' ? rand(0.18, 0.43) : kind === 'snow' ? rand(0.35, 0.85) : rand(0.45, 0.85),
      sprite: Math.floor(Math.random() * sprites.length)
    };
  }

  function drawBat(g, x, y, s, flap, dir) {
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    const lift = flap * s * 0.55;
    g.fillStyle = '#120a16';
    g.strokeStyle = 'rgba(255,150,60,0.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, -s * 0.15);

    g.quadraticCurveTo(-s * 0.5, -s * 0.35 - lift, -s * 1.15, -s * 0.2 - lift);
    g.quadraticCurveTo(-s * 0.95, s * 0.05 - lift * 0.4, -s * 0.8, s * 0.1 - lift * 0.3);
    g.quadraticCurveTo(-s * 0.62, -s * 0.02 - lift * 0.3, -s * 0.45, s * 0.12 - lift * 0.15);
    g.quadraticCurveTo(-s * 0.3, 0, -s * 0.12, s * 0.18);

    g.quadraticCurveTo(0, s * 0.42, s * 0.12, s * 0.18);

    g.quadraticCurveTo(s * 0.3, 0, s * 0.45, s * 0.12 - lift * 0.15);
    g.quadraticCurveTo(s * 0.62, -s * 0.02 - lift * 0.3, s * 0.8, s * 0.1 - lift * 0.3);
    g.quadraticCurveTo(s * 0.95, s * 0.05 - lift * 0.4, s * 1.15, -s * 0.2 - lift);
    g.quadraticCurveTo(s * 0.5, -s * 0.35 - lift, 0, -s * 0.15);
    g.closePath();
    g.fill();
    g.stroke();

    g.beginPath();
    g.moveTo(-s * 0.1, -s * 0.15); g.lineTo(-s * 0.14, -s * 0.36); g.lineTo(-s * 0.02, -s * 0.2);
    g.moveTo(s * 0.1, -s * 0.15); g.lineTo(s * 0.14, -s * 0.36); g.lineTo(s * 0.02, -s * 0.2);
    g.fill();
    g.fillStyle = '#ffb347';
    g.beginPath(); g.arc(-s * 0.05, -s * 0.06, s * 0.035, 0, TAU); g.arc(s * 0.05, -s * 0.06, s * 0.035, 0, TAU); g.fill();
    g.restore();
  }

  function drawGhost(g, x, y, s, t, alpha) {
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    const glow = g.createRadialGradient(0, 0, s * 0.2, 0, 0, s * 1.4);
    glow.addColorStop(0, 'rgba(220,210,255,0.25)');
    glow.addColorStop(1, 'rgba(220,210,255,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, 0, s * 1.4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(245,242,255,0.92)';
    g.beginPath();
    g.moveTo(-s * 0.55, s * 0.6);
    g.lineTo(-s * 0.55, -s * 0.05);
    g.arc(0, -s * 0.05, s * 0.55, Math.PI, 0);
    g.lineTo(s * 0.55, s * 0.6);

    const sway = Math.sin(t * 0.005) * s * 0.06;
    for (let i = 0; i < 3; i++) {
      const x1 = s * 0.55 - (s * 1.1 * (i + 1)) / 3;
      const cx = (s * 0.55 - (s * 1.1 * i) / 3 + x1) / 2 + sway;
      g.quadraticCurveTo(cx, s * 0.92, x1, s * 0.6);
    }
    g.closePath();
    g.fill();
    g.fillStyle = '#2a1830';
    g.beginPath(); g.ellipse(-s * 0.19, -s * 0.1, s * 0.08, s * 0.12, 0, 0, TAU); g.ellipse(s * 0.19, -s * 0.1, s * 0.08, s * 0.12, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(0, s * 0.14, s * 0.09, s * 0.11, 0, 0, TAU); g.fill();
    g.restore();
  }

  function drawSpider(g, x, y, s, t) {
    g.save();
    g.strokeStyle = 'rgba(230,230,240,0.55)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, y - s * 0.4); g.stroke();
    g.translate(x, y);
    g.strokeStyle = '#6b5478';
    g.lineWidth = Math.max(1.6, s * 0.08);
    for (let i = 0; i < 4; i++) {
      const wiggle = Math.sin(t * 0.01 + i) * s * 0.05;
      const yy = -s * 0.15 + i * s * 0.14;
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, yy);
        g.quadraticCurveTo(d * s * 0.45, yy - s * 0.25 + wiggle, d * s * 0.7, yy + s * 0.18);
        g.stroke();
      }
    }
    g.fillStyle = '#4a3656';
    g.strokeStyle = 'rgba(255,140,40,0.7)';
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, s * 0.05, s * 0.28, s * 0.34, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, -s * 0.32, s * 0.16, 0, TAU); g.fill();
    g.fillStyle = '#ff7a1f';
    g.beginPath(); g.arc(-s * 0.06, -s * 0.34, s * 0.035, 0, TAU); g.arc(s * 0.06, -s * 0.34, s * 0.035, 0, TAU); g.fill();
    g.restore();
  }

  function drawPumpkin(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    const flicker = 0.75 + Math.sin(t * 0.02) * 0.12 + Math.sin(t * 0.053) * 0.08;
    const glow = g.createRadialGradient(0, 0, s * 0.1, 0, 0, s * 1.6);
    glow.addColorStop(0, `rgba(255,140,30,${0.35 * flicker})`);
    glow.addColorStop(1, 'rgba(255,140,30,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, 0, s * 1.6, 0, TAU); g.fill();
    g.fillStyle = '#e86a10';
    for (const [dx, rx] of [[-0.42, 0.42], [0.42, 0.42], [0, 0.5]]) {
      g.beginPath(); g.ellipse(dx * s, 0, rx * s, s * 0.6, 0, 0, TAU); g.fill();
    }
    g.fillStyle = '#3d5b1e';
    g.fillRect(-s * 0.06, -s * 0.78, s * 0.12, s * 0.22);
    g.fillStyle = `rgba(255,220,90,${flicker})`;
    g.beginPath(); g.moveTo(-s * 0.36, -s * 0.12); g.lineTo(-s * 0.16, -s * 0.12); g.lineTo(-s * 0.26, -s * 0.3); g.fill();
    g.beginPath(); g.moveTo(s * 0.36, -s * 0.12); g.lineTo(s * 0.16, -s * 0.12); g.lineTo(s * 0.26, -s * 0.3); g.fill();
    g.beginPath();
    g.moveTo(-s * 0.4, s * 0.12);
    for (let i = 0; i <= 6; i++) g.lineTo(-s * 0.4 + (s * 0.8 * i) / 6, s * 0.12 + (i % 2 ? s * 0.1 : 0));
    g.quadraticCurveTo(0, s * 0.5, -s * 0.4, s * 0.12);
    g.fill();
    g.restore();
  }

  function drawGarland(g, w, t) {
    const span = 130;
    const sag = 16;
    const top = 2;
    const colors = ['#ff4f4f', '#f2c14e', '#4fd17c', '#5ab4ff', '#ff8ad8'];
    g.save();
    g.strokeStyle = 'rgba(30,40,30,0.85)';
    g.lineWidth = 1.6;
    g.beginPath();
    for (let x = -span / 2; x < w + span; x += span) {
      g.moveTo(x, top);
      g.quadraticCurveTo(x + span / 2, top + sag * 2, x + span, top);
    }
    g.stroke();
    let i = 0;
    for (let x = -span / 2; x < w + span; x += span) {
      for (const f of [0.2, 0.5, 0.8]) {
        const bx = x + span * f;
        const by = top + 2 * sag * 2 * f * (1 - f) + 6;
        const color = colors[i % colors.length];
        const on = 0.55 + 0.45 * Math.sin(t * 0.004 + i * 1.9);
        const halo = g.createRadialGradient(bx, by, 0, bx, by, 13);
        halo.addColorStop(0, color);
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.35 * on;
        g.fillStyle = halo;
        g.beginPath(); g.arc(bx, by, 13, 0, TAU); g.fill();
        g.globalAlpha = 0.6 + 0.4 * on;
        g.fillStyle = color;
        g.beginPath(); g.ellipse(bx, by, 3.2, 4.6, 0, 0, TAU); g.fill();
        g.fillStyle = '#3a3a3a';
        g.fillRect(bx - 2, by - 7, 4, 3);
        i++;
      }
    }
    g.restore();
  }

  function drawSnowDrift(g, w, h) {
    g.save();
    g.fillStyle = 'rgba(240,248,255,0.16)';
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w + 40; x += 40) g.lineTo(x, h - 10 - Math.sin(x * 0.013) * 6 - Math.sin(x * 0.041) * 3);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawSleigh(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#9a6538';
    g.lineWidth = 1.6;
    g.lineCap = 'round';

    for (let k = 0; k < 2; k++) {
      const rx = s * 1.6 + k * s * 1.25;
      const bob = Math.sin(t * 0.02 + k) * s * 0.06;
      g.strokeStyle = '#9a6538';
      for (const lx of [-0.28, -0.1, 0.12, 0.3]) {
        g.beginPath(); g.moveTo(rx + lx * s, bob + s * 0.1); g.lineTo(rx + lx * s + Math.sin(t * 0.05 + lx * 9) * s * 0.12, bob + s * 0.42); g.stroke();
      }
      g.beginPath(); g.ellipse(rx, bob, s * 0.42, s * 0.16, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(rx + s * 0.32, bob - s * 0.05); g.lineTo(rx + s * 0.55, bob - s * 0.38); g.lineTo(rx + s * 0.68, bob - s * 0.32); g.lineTo(rx + s * 0.45, bob - s * 0.02); g.fill();
      g.strokeStyle = 'rgba(255,215,120,0.85)';
      g.beginPath(); g.moveTo(rx + s * 0.56, bob - s * 0.4); g.lineTo(rx + s * 0.5, bob - s * 0.6); g.moveTo(rx + s * 0.56, bob - s * 0.4); g.lineTo(rx + s * 0.68, bob - s * 0.58); g.stroke();
    }
    if (k0RedNose(t)) {
      g.fillStyle = '#ff3b3b';
      g.beginPath(); g.arc(s * 1.6 + s * 1.25 + s * 0.7, Math.sin(t * 0.02 + 1) * s * 0.06 - s * 0.3, s * 0.06, 0, TAU); g.fill();
    }

    g.strokeStyle = 'rgba(255,215,120,0.5)';
    g.beginPath(); g.moveTo(s * 0.55, -s * 0.15); g.lineTo(s * 1.3, 0); g.stroke();

    g.fillStyle = '#b3242c';
    g.beginPath();
    g.moveTo(-s * 0.7, -s * 0.3); g.lineTo(s * 0.55, -s * 0.3); g.quadraticCurveTo(s * 0.7, -s * 0.05, s * 0.45, s * 0.12); g.lineTo(-s * 0.6, s * 0.12); g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(255,215,120,0.9)';
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-s * 0.75, s * 0.28); g.lineTo(s * 0.6, s * 0.28); g.quadraticCurveTo(s * 0.85, s * 0.28, s * 0.8, s * 0.08); g.stroke();
    g.fillStyle = '#e6e6e6';
    g.beginPath(); g.arc(-s * 0.2, -s * 0.45, s * 0.2, 0, TAU); g.fill();
    g.fillStyle = '#c62a2a';
    g.beginPath(); g.moveTo(-s * 0.38, -s * 0.52); g.lineTo(-s * 0.02, -s * 0.52); g.lineTo(-s * 0.3, -s * 0.9); g.fill();
    g.restore();
  }
  function k0RedNose(t) { return Math.sin(t * 0.01) > -0.2; }

  function newFirework(w, h, colors) {
    return { x: rand(w * 0.08, w * 0.92), y: h + 10, ty: rand(h * 0.12, h * 0.45), vy: rand(-7.5, -5.5), color: pick(colors), sparks: null, age: 0 };
  }
  function updateFirework(fw) {
    if (!fw.sparks) {
      fw.y += fw.vy;
      fw.vy *= 0.985;
      if (fw.y <= fw.ty || fw.vy > -1.2) {
        const n = 46;
        fw.sparks = Array.from({ length: n }, (_, i) => {
          const a = (i / n) * TAU + Math.random() * 0.1;
          const sp = rand(1.6, 3.6);
          return { x: fw.x, y: fw.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 };
        });
      }
      return true;
    }
    let alive = false;
    for (const s of fw.sparks) {
      s.x += s.vx; s.y += s.vy; s.vx *= 0.975; s.vy = s.vy * 0.975 + 0.035; s.life -= 0.012;
      if (s.life > 0) alive = true;
    }
    return alive;
  }
  function drawFirework(g, fw) {
    g.save();
    if (!fw.sparks) {
      g.fillStyle = fw.color;
      g.globalAlpha = 0.9;
      g.beginPath(); g.arc(fw.x, fw.y, 2, 0, TAU); g.fill();
      g.globalAlpha = 0.35;
      g.fillRect(fw.x - 0.8, fw.y, 1.6, 18);
    } else {
      g.fillStyle = fw.color;
      for (const s of fw.sparks) {
        if (s.life <= 0) continue;
        g.globalAlpha = Math.max(0, s.life) * 0.9;
        g.beginPath(); g.arc(s.x, s.y, 1.8, 0, TAU); g.fill();
      }
    }
    g.restore();
  }

  function drawCupidArrow(g, x, y, s, dir) {
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    g.rotate(-0.08);
    g.strokeStyle = '#c99a5b';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-s, 0); g.lineTo(s * 0.8, 0); g.stroke();
    g.fillStyle = '#ff5c8a';
    heartPath(g, s * 0.95, s * 0.02, s * 0.22);
    g.fill();
    g.fillStyle = '#ffd1e0';
    for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(-s, 0); g.lineTo(-s * 0.78, d * s * 0.16); g.lineTo(-s * 0.6, 0); g.closePath(); g.fill();
    }
    g.restore();
  }

  function drawBalloon(g, x, y, s, t, color) {
    g.save();
    const sway = Math.sin(t * 0.004 + x) * s * 0.15;
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y + s * 0.55); g.quadraticCurveTo(x + sway, y + s * 1.4, x - sway, y + s * 2.4); g.stroke();
    g.fillStyle = color;
    heartPath(g, x, y, s * 0.6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.beginPath(); g.ellipse(x - s * 0.22, y - s * 0.22, s * 0.08, s * 0.14, -0.6, 0, TAU); g.fill();
    g.restore();
  }

  function drawMask(g, x, y, s, rot, color) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-s, -s * 0.15);
    g.quadraticCurveTo(-s * 0.9, -s * 0.55, -s * 0.35, -s * 0.4);
    g.quadraticCurveTo(0, -s * 0.25, s * 0.35, -s * 0.4);
    g.quadraticCurveTo(s * 0.9, -s * 0.55, s, -s * 0.15);
    g.quadraticCurveTo(s * 0.85, s * 0.45, s * 0.3, s * 0.3);
    g.quadraticCurveTo(0, s * 0.05, -s * 0.3, s * 0.3);
    g.quadraticCurveTo(-s * 0.85, s * 0.45, -s, -s * 0.15);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.ellipse(-s * 0.42, -s * 0.06, s * 0.2, s * 0.12, 0.2, 0, TAU); g.ellipse(s * 0.42, -s * 0.06, s * 0.2, s * 0.12, -0.2, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(-s * 0.15, -s * 0.38); g.quadraticCurveTo(-s * 0.1, -s * 1.1, s * 0.35, -s * 1.25); g.stroke();
    g.restore();
  }

  function drawStreamer(g, st, t) {
    g.save();
    g.strokeStyle = st.color;
    g.globalAlpha = 0.55;
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const yy = st.y + i * st.len / 24;
      const xx = st.x + Math.sin(t * 0.004 + st.phase + i * 0.55) * st.amp;
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke();
    g.restore();
  }

  function drawBunny(g, x, y, s, hop) {
    g.save();
    g.translate(x, y - Math.abs(Math.sin(hop)) * s * 0.9);
    g.fillStyle = '#f4efe8';
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(0, 0, s * 0.62, s * 0.45, -0.15, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.arc(s * 0.55, -s * 0.32, s * 0.3, 0, TAU); g.fill(); g.stroke();
    const earTilt = Math.sin(hop) * 0.25;
    for (const [ox, rot] of [[0.45, -0.25], [0.65, 0.1]]) {
      g.save(); g.translate(s * ox, -s * 0.55); g.rotate(rot - earTilt);
      g.beginPath(); g.ellipse(0, -s * 0.32, s * 0.1, s * 0.34, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#f7b3d4';
      g.beginPath(); g.ellipse(0, -s * 0.32, s * 0.05, s * 0.24, 0, 0, TAU); g.fill();
      g.fillStyle = '#f4efe8';
      g.restore();
    }
    g.beginPath(); g.arc(-s * 0.62, -s * 0.08, s * 0.16, 0, TAU); g.fill();
    g.fillStyle = '#2b2b2b';
    g.beginPath(); g.arc(s * 0.68, -s * 0.38, s * 0.045, 0, TAU); g.fill();
    g.fillStyle = '#f08fb5';
    g.beginPath(); g.arc(s * 0.84, -s * 0.28, s * 0.04, 0, TAU); g.fill();
    g.restore();
  }

  function drawEgg(g, x, y, s, colors) {
    g.save();
    g.translate(x, y);
    g.beginPath(); g.ellipse(0, 0, s * 0.42, s * 0.56, 0, 0, TAU);
    g.fillStyle = colors[0];
    g.fill();
    g.clip();
    g.fillStyle = colors[1];
    g.fillRect(-s, -s * 0.12, s * 2, s * 0.16);
    g.fillStyle = colors[2];
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * s * 0.18, s * 0.26, s * 0.05, 0, TAU); g.fill(); }
    g.beginPath();
    g.strokeStyle = colors[2];
    g.lineWidth = s * 0.05;
    for (let i = -3; i <= 3; i++) g.lineTo(i * s * 0.14, -s * 0.3 + (i % 2 ? -s * 0.08 : 0));
    g.stroke();
    g.restore();
  }

  function drawCockade(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(t * 0.0015) * 0.12);

    for (const [dx, color] of [[-0.25, '#e8343f'], [0.05, '#ffffff'], [0.3, '#3fae5a']]) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(dx * s, s * 0.3); g.lineTo(dx * s + s * 0.18, s * 0.3); g.lineTo(dx * s + s * 0.12, s * 1.25); g.lineTo(dx * s + s * 0.03, s * 1.1); g.lineTo(dx * s - s * 0.06, s * 1.25);
      g.closePath(); g.fill();
    }
    const rings = [[1, '#3fae5a'], [0.68, '#ffffff'], [0.38, '#e8343f']];
    for (const [r, color] of rings) {
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const rr = s * 0.62 * r * (1 + Math.sin(a * 16) * 0.035);
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath(); g.fill();
    }
    g.restore();
  }

  function drawSun(g, x, y, s, t) {
    g.save();
    g.translate(x, y);
    const glow = g.createRadialGradient(0, 0, s * 0.3, 0, 0, s * 2.2);
    glow.addColorStop(0, 'rgba(255,207,58,0.38)');
    glow.addColorStop(1, 'rgba(255,207,58,0)');
    g.fillStyle = glow;
    g.beginPath(); g.arc(0, 0, s * 2.2, 0, TAU); g.fill();
    g.rotate(t * 0.0002);
    g.fillStyle = 'rgba(255,214,90,0.4)';
    for (let i = 0; i < 12; i++) {
      g.rotate(TAU / 12);
      g.beginPath(); g.moveTo(-s * 0.08, s * 0.75); g.lineTo(0, s * (1.45 + (i % 2) * 0.3)); g.lineTo(s * 0.08, s * 0.75); g.fill();
    }
    g.fillStyle = 'rgba(255,212,70,0.85)';
    g.beginPath(); g.arc(0, 0, s * 0.62, 0, TAU); g.fill();
    g.restore();
  }

  function drawGull(g, x, y, s, flap) {
    g.save();
    g.strokeStyle = 'rgba(240,250,255,0.85)';
    g.lineWidth = 2;
    g.lineCap = 'round';
    const lift = flap * s * 0.35;
    g.beginPath();
    g.moveTo(x - s, y - lift);
    g.quadraticCurveTo(x - s * 0.45, y - s * 0.35 - lift * 0.5, x, y);
    g.quadraticCurveTo(x + s * 0.45, y - s * 0.35 - lift * 0.5, x + s, y - lift);
    g.stroke();
    g.restore();
  }

  function scheduleNext(state, key, min, max) { state.next[key] = state.t + rand(min, max) * 1000; }
  const due = (state, key) => state.t >= (state.next[key] || 0);

  const SCENES = {
    halloween: {
      init(st) { scheduleNext(st, 'bats', 2, 5); scheduleNext(st, 'ghost', 6, 12); scheduleNext(st, 'spider', 10, 18); },
      fg(g, st, w, h) {
        if (due(st, 'bats')) {
          scheduleNext(st, 'bats', 11, 20);
          const dir = Math.random() < 0.5 ? 1 : -1;
          const baseY = rand(h * 0.12, h * 0.6);
          const n = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < n; i++) {
            st.walkers.push({ type: 'bat', x: dir > 0 ? -60 - i * 45 : w + 60 + i * 45, y: baseY + rand(-50, 50), s: rand(14, 24), vx: dir * rand(2.2, 3.4), dir, phase: Math.random() * TAU });
          }
        }
        if (due(st, 'ghost')) {
          scheduleNext(st, 'ghost', 22, 38);
          const left = Math.random() < 0.5;
          st.walkers.push({ type: 'ghost', x: left ? rand(30, w * 0.25) : rand(w * 0.75, w - 30), y: h - rand(70, 160), s: rand(26, 36), born: st.t, life: 9000, drift: left ? 0.25 : -0.25 });
        }
        if (due(st, 'spider')) {
          scheduleNext(st, 'spider', 26, 45);
          st.walkers.push({ type: 'spider', x: rand(w * 0.15, w * 0.85), born: st.t, life: 11000, depth: rand(110, 220), s: rand(20, 26) });
        }

        drawPumpkin(g, w - 36, h - 26, 18, st.t);
        drawPumpkin(g, w - 78, h - 22, 13, st.t + 900);
      }
    },
    christmas: {
      init(st) { scheduleNext(st, 'sleigh', 8, 15); },
      bg(g, st, w, h) { drawSnowDrift(g, w, h); },
      fg(g, st, w, h) {
        drawGarland(g, w, st.t);
        if (due(st, 'sleigh')) {
          scheduleNext(st, 'sleigh', 35, 60);
          st.walkers.push({ type: 'sleigh', x: -220, y: rand(h * 0.14, h * 0.32), s: rand(24, 30), vx: rand(1.8, 2.4) });
        }
      }
    },
    newyear: {
      init(st) { st.fireworks = []; scheduleNext(st, 'fw', 0.5, 2); },
      bg(g, st, w, h) {
        if (due(st, 'fw')) { scheduleNext(st, 'fw', 1.2, 3.5); st.fireworks.push(newFirework(w, h, ['#f5cf5b', '#ffffff', '#b9c6ff', '#ff8ad8', '#7fe7ff'])); }
        st.fireworks = st.fireworks.filter((fw) => { const alive = updateFirework(fw); if (alive) drawFirework(g, fw); return alive; });
      }
    },
    valentine: {
      init(st) { scheduleNext(st, 'arrow', 5, 9); scheduleNext(st, 'balloon', 9, 15); },
      fg(g, st, w, h) {
        if (due(st, 'arrow')) {
          scheduleNext(st, 'arrow', 16, 28);
          const dir = Math.random() < 0.5 ? 1 : -1;
          st.walkers.push({ type: 'arrow', x: dir > 0 ? -80 : w + 80, y: rand(h * 0.15, h * 0.7), s: 34, vx: dir * 9, dir });
        }
        if (due(st, 'balloon')) {
          scheduleNext(st, 'balloon', 20, 34);
          const x = Math.random() < 0.5 ? rand(30, w * 0.2) : rand(w * 0.8, w - 30);
          st.walkers.push({ type: 'balloon', x, y: h + 30, s: rand(22, 30), vy: rand(0.6, 0.9), color: pick(['#ff5c8a', '#e5356b', '#ff9ec0']) });
        }
      }
    },
    carnival: {
      init(st) {
        st.streamers = Array.from({ length: 7 }, () => ({ x: rand(0, window.innerWidth), y: rand(-window.innerHeight, window.innerHeight), len: rand(80, 140), amp: rand(6, 14), phase: rand(0, TAU), vy: rand(0.35, 0.7), color: pick(['#ffd23f', '#43d3ff', '#ff5a6e', '#3ee08a', '#b46cff']) }));
        scheduleNext(st, 'mask', 4, 9);
      },
      bg(g, st, w, h) {
        for (const s of st.streamers) {
          s.y += s.vy;
          if (s.y > h + 10) { s.y = -s.len - rand(0, 200); s.x = rand(0, w); }
          drawStreamer(g, s, st.t);
        }
      },
      fg(g, st, w, h) {
        if (due(st, 'mask')) {
          scheduleNext(st, 'mask', 18, 30);
          st.walkers.push({ type: 'mask', x: rand(w * 0.1, w * 0.9), y: h + 40, s: rand(22, 30), vy: rand(0.7, 1.1), rot: rand(-0.3, 0.3), color: pick(['#ffd23f', '#43d3ff', '#ff5a6e', '#b46cff']) });
        }
      }
    },
    easter: {
      init(st) { scheduleNext(st, 'bunny', 4, 8); },
      bg(g, st, w, h) {
        drawEgg(g, 28, h - 24, 26, ['#f7b3d4', '#fff1a8', '#ffffff']);
        drawEgg(g, 54, h - 18, 20, ['#c8f2d0', '#f7b3d4', '#ffffff']);
        drawEgg(g, w - 30, h - 22, 24, ['#b9d8ff', '#fff1a8', '#ffffff']);
      },
      fg(g, st, w, h) {
        if (due(st, 'bunny')) {
          scheduleNext(st, 'bunny', 20, 35);
          const dir = Math.random() < 0.5 ? 1 : -1;
          st.walkers.push({ type: 'bunny', x: dir > 0 ? -40 : w + 40, y: h - 22, s: 20, vx: dir * 1.9, dir, hop: 0 });
        }
      }
    },
    national: {
      init(st) { st.fireworks = []; scheduleNext(st, 'fw', 3, 6); },
      bg(g, st, w, h) {
        if (due(st, 'fw')) { scheduleNext(st, 'fw', 4, 9); st.fireworks.push(newFirework(w, h, ['#e8343f', '#ffffff', '#3fae5a'])); }
        st.fireworks = st.fireworks.filter((fw) => { const alive = updateFirework(fw); if (alive) drawFirework(g, fw); return alive; });
      },
      fg(g, st, w, h) { drawCockade(g, w - 34, h - 58, 24, st.t); }
    },
    summer: {
      init(st) { scheduleNext(st, 'gulls', 3, 7); },
      bg(g, st, w) { drawSun(g, w - 40, 40, 34, st.t); },
      fg(g, st, w, h) {
        if (due(st, 'gulls')) {
          scheduleNext(st, 'gulls', 14, 24);
          const dir = Math.random() < 0.5 ? 1 : -1;
          const y = rand(h * 0.1, h * 0.35);
          for (let i = 0; i < 3; i++) st.walkers.push({ type: 'gull', x: dir > 0 ? -40 - i * 60 : w + 40 + i * 60, y: y + i * 18 * (i % 2 ? 1 : -1), s: rand(10, 14), vx: dir * rand(1.4, 1.9), phase: Math.random() * TAU });
        }
      }
    }
  };

  function stepWalker(g, wk, st, w, h) {
    const t = st.t;
    switch (wk.type) {
      case 'bat':
        wk.x += wk.vx;
        drawBat(g, wk.x, wk.y + Math.sin(t * 0.004 + wk.phase) * 18, wk.s, Math.sin(t * 0.03 + wk.phase), wk.dir);
        return wk.dir > 0 ? wk.x < w + 120 : wk.x > -120;
      case 'ghost': {
        const age = t - wk.born;
        const a = Math.min(1, age / 1500, (wk.life - age) / 1500);
        wk.x += wk.drift;
        drawGhost(g, wk.x, wk.y + Math.sin(t * 0.002) * 10, wk.s, t, Math.max(0, a) * 0.75);
        return age < wk.life;
      }
      case 'spider': {
        const age = t - wk.born;
        const p = age / wk.life;
        const y = wk.depth * Math.sin(Math.min(1, p) * Math.PI) - 20;
        if (y > -15) drawSpider(g, wk.x + Math.sin(t * 0.0015) * 3, y, wk.s, t);
        return age < wk.life;
      }
      case 'sleigh':
        wk.x += wk.vx;
        drawSleigh(g, wk.x, wk.y + Math.sin(t * 0.0015) * 12, wk.s, t);
        return wk.x < w + 260;
      case 'arrow':
        wk.x += wk.vx;
        drawCupidArrow(g, wk.x, wk.y + Math.sin(wk.x * 0.01) * 4, wk.s, wk.dir);
        return wk.dir > 0 ? wk.x < w + 100 : wk.x > -100;
      case 'balloon':
        wk.y -= wk.vy;
        drawBalloon(g, wk.x + Math.sin(t * 0.0012) * 8, wk.y, wk.s, t, wk.color);
        return wk.y > -wk.s * 3;
      case 'mask':
        wk.y -= wk.vy;
        g.globalAlpha = 0.85;
        drawMask(g, wk.x + Math.sin(t * 0.0018 + wk.x) * 14, wk.y, wk.s, wk.rot + Math.sin(t * 0.002) * 0.15, wk.color);
        g.globalAlpha = 1;
        return wk.y > -wk.s * 2;
      case 'bunny':
        wk.x += wk.vx;
        wk.hop += 0.11;
        g.save();
        if (wk.dir < 0) { g.translate(wk.x * 2, 0); g.scale(-1, 1); }
        drawBunny(g, wk.x, wk.y, wk.s, wk.hop);
        g.restore();
        return wk.dir > 0 ? wk.x < w + 60 : wk.x > -60;
      case 'gull':
        wk.x += wk.vx;
        drawGull(g, wk.x, wk.y + Math.sin(t * 0.002 + wk.phase) * 6, wk.s, Math.sin(t * 0.012 + wk.phase));
        return wk.vx > 0 ? wk.x < w + 60 : wk.x > -60;
      default:
        return false;
    }
  }

  let bg = null;
  let fg = null;
  let bgCtx = null;
  let fgCtx = null;
  let active = null;
  let particles = [];
  let sprites = [];
  let state = null;
  let timer = null;
  let dpr = 1;
  let frame = 0;

  function makeCanvas(cls) {
    const c = document.createElement('canvas');
    c.className = cls;
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function resize() {
    if (!bg) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [bg, fg]) {
      c.width = Math.round(window.innerWidth * dpr);
      c.height = Math.round(window.innerHeight * dpr);
    }
  }

  function tick() {
    timer = null;
    if (!active) return;
    const def = PARTICLES[active];
    const scene = SCENES[active] || {};
    const w = window.innerWidth;
    const h = window.innerHeight;
    frame++;
    state.t = performance.now() - state.start;

    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, w, h);
    if (scene.bg) scene.bg(bgCtx, state, w, h);
    for (const p of particles) {
      p.y += def.rise ? -p.speed : p.speed;
      p.rot += p.spin;
      p.flip += 0.03;
      const x = p.x + Math.sin(frame * p.freq + p.phase) * p.sway * 10;
      if (def.rise ? p.y < -p.size * 3 : p.y > h + p.size * 3) Object.assign(p, spawnParticle(def, sprites, false));
      const sprite = sprites[p.sprite] || sprites[0];
      bgCtx.globalAlpha = p.alpha;
      if (p.spin) {
        bgCtx.save();
        bgCtx.translate(x, p.y);
        bgCtx.rotate(p.rot);
        bgCtx.scale(Math.cos(p.flip) * 0.8 + 0.2, 1);
        bgCtx.drawImage(sprite, -p.size, -p.size, p.size * 2, p.size * 2);
        bgCtx.restore();
      } else {
        bgCtx.drawImage(sprite, x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
    }
    bgCtx.globalAlpha = 1;

    fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fgCtx.clearRect(0, 0, w, h);
    if (scene.fg) scene.fg(fgCtx, state, w, h);
    state.walkers = state.walkers.filter((wk) => stepWalker(fgCtx, wk, state, w, h));

    timer = requestAnimationFrame(tick);
  }

  function baseLayer() {
    return document.getElementById('particleCanvas');
  }

  function start(key) {
    const def = PARTICLES[key];
    if (!bg) {
      bg = makeCanvas('season-canvas');
      fg = makeCanvas('season-overlay');
      const base = baseLayer();
      if (base && base.parentNode) base.parentNode.insertBefore(bg, base.nextSibling);
      else document.body.insertBefore(bg, document.body.firstChild);
      document.body.appendChild(fg);
      bgCtx = bg.getContext('2d');
      fgCtx = fg.getContext('2d');
      window.addEventListener('resize', resize);
    }
    bg.style.display = '';
    fg.style.display = '';
    resize();
    active = key;
    sprites = def.colors.map((color) => {
      const s = document.createElement('canvas');
      s.width = s.height = SPRITE;
      drawParticleShape(s.getContext('2d'), def.kind, color);
      return s;
    });
    const count = window.innerWidth < 700 ? Math.round(def.count * 0.5) : def.count;
    particles = Array.from({ length: count }, () => spawnParticle(def, sprites, true));
    state = { start: performance.now(), t: 0, next: {}, walkers: [] };
    if (SCENES[key] && SCENES[key].init) SCENES[key].init(state);
    const base = baseLayer();
    if (base) base.style.visibility = 'hidden';
    if (!timer) timer = requestAnimationFrame(tick);
  }

  function stop() {
    active = null;
    if (timer) { cancelAnimationFrame(timer); timer = null; }
    for (const [c, g] of [[bg, bgCtx], [fg, fgCtx]]) {
      if (!c) continue;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      c.style.display = 'none';
    }
    const base = baseLayer();
    if (base) base.style.visibility = '';
  }

  function sync() {
    const key = document.documentElement.getAttribute('data-theme');
    if (reduceMotion || !PARTICLES[key]) { if (active) stop(); return; }
    if (key !== active) start(key);
  }

  function init() {
    sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
