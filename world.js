/* SolarCenter világ: a Solaryn spawn pixel-diorámája a fejlécben, alatta a föld rétegei.
   Minden alacsony felbontásban rajzolódik, és egész szorzóval nagyítódik. A jelenet a témából
   és a valós napszakból áll össze; az animáció csak látható oldalon fut. */
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hx = (h) => {
    const n = parseInt(h.slice(1), 16);
    return h.length === 4
      ? [((n >> 8) & 15) * 17, ((n >> 4) & 15) * 17, (n & 15) * 17]
      : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const css = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

  const motionOff = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Égbolt és fény ---------------------------------------------------------------------
  const RAMPS = {
    night: ['#060a18', '#0a1126', '#0e1933', '#142340', '#1b2e4c'],
    dawn: ['#1c2548', '#413768', '#864d70', '#d3715d', '#f6b168'],
    day: ['#2b6fc4', '#3d88d6', '#5aa2e2', '#80bcec', '#b0d9f3'],
    dusk: ['#151a3d', '#39295a', '#773864', '#c5533f', '#ef8b3a']
  };
  const AMBIENT = { night: [0.4, 0.46, 0.68], dawn: [0.98, 0.78, 0.68], day: [1, 1, 1], dusk: [0.86, 0.58, 0.54] };
  const DAYLIGHT = [
    [7.5, 16.3], [7.0, 17.1], [6.1, 17.8], [6.2, 19.6], [5.3, 20.3], [4.8, 20.7],
    [5.0, 20.7], [5.7, 20.0], [6.5, 19.0], [7.2, 18.0], [6.9, 16.3], [7.4, 15.9]
  ];

  function moonPhase(d) {
    const ref = Date.UTC(2000, 0, 6, 18, 14);
    const syn = 29.530588853;
    return (((d.getTime() - ref) / 86400000) % syn + syn) % syn / syn;
  }

  function solar(date) {
    const d = date || new Date();
    const [rise, set] = DAYLIGHT[d.getMonth()];
    const h = d.getHours() + d.getMinutes() / 60;
    const tw = 0.9;
    const weights = { night: 0, dawn: 0, day: 0, dusk: 0 };
    if (h < rise - tw || h > set + tw) weights.night = 1;
    else if (h < rise) { const t = (h - (rise - tw)) / tw; weights.night = 1 - t; weights.dawn = t; }
    else if (h < rise + tw) { const t = (h - rise) / tw; weights.dawn = 1 - t; weights.day = t; }
    else if (h < set - tw) weights.day = 1;
    else if (h < set) { const t = (h - (set - tw)) / tw; weights.day = 1 - t; weights.dusk = t; }
    else { const t = (h - set) / tw; weights.dusk = 1 - t; weights.night = t; }
    const dayLen = set - rise;
    const sunP = (h - rise) / dayLen;
    const nightLen = 24 - dayLen;
    const moonH = h < rise ? h + 24 : h;
    const moonP = (moonH - set) / nightLen;
    return { weights, sunP, moonP, phase: moonPhase(d), hour: h, rise, set };
  }

  function fixedSolar(mode, base) {
    const out = Object.assign({}, base);
    const w = { night: 0, dawn: 0, day: 0, dusk: 0 };
    w[mode] = 1;
    out.weights = w;
    out.sunP = mode === 'day' ? 0.34 : mode === 'dawn' ? 0.03 : mode === 'dusk' ? 0.97 : -1;
    out.moonP = mode === 'night' ? 0.62 : -1;
    return out;
  }

  function rampColor(ramps, w, t) {
    let col = [0, 0, 0];
    for (const k of Object.keys(w)) {
      if (!w[k]) continue;
      const stops = ramps[k] || RAMPS[k];
      const p = clamp(t, 0, 0.9999) * (stops.length - 1);
      const i = Math.floor(p);
      const c = mixc(hx(stops[i]), hx(stops[i + 1]), p - i);
      col = [col[0] + c[0] * w[k], col[1] + c[1] * w[k], col[2] + c[2] * w[k]];
    }
    return col;
  }

  // ---- Alap anyagok --------------------------------------------------------------------------
  const MAT = {
    grass: ['#3e7a3a', '#4f9043', '#2f6232'], grassTop: '#6bb04e',
    dirt: ['#5b4030', '#4d3527', '#6a4b37', '#43291f'],
    path: ['#83796a', '#6e6556', '#94897a'],
    stone: ['#8c8b84', '#75746e', '#a09f97', '#5e5d58'],
    plaster: ['#d9c8a2', '#c6b48d'], wood: ['#5b3c25', '#47301c', '#70492c'],
    roof: ['#6e7c39', '#58662c', '#838b40', '#47582a'], roof2: ['#a56a34', '#8b5527', '#bd7e41', '#744420'],
    leaf: ['#2f6b38', '#3f8244', '#225428', '#5a9c50'], pine: ['#1f5238', '#2b6546', '#163e2b', '#3a7a56'],
    trunk: ['#4a3220', '#382517'],
    mount: ['#5a6279', '#4c5369', '#6d7591'], mount2: ['#465066', '#3b4458', '#556079'],
    hill: ['#2f5a3c', '#3a6a46', '#264d33'],
    win: '#ffc65e', winOff: '#3b5668', lamp: '#ffd98a',
    portal: ['#7a3cff', '#a35cff', '#5a1fd0', '#caa0ff'], banner: '#b4392c',
    flower: ['#f7d154', '#ef6f6c', '#e9e4d8', '#b98cf0'],
    cloud: ['#ffffff', '#dfe8f2', '#c3d0e0'],
    wool: ['#f1eee6', '#d9d5ca'], woolDark: '#3a3530'
  };

  // Témák: anyag-felülírás, táj, időjárás, kellékek, rejtett kincs.
  const THEMES = {
    solaryn: { biome: 'A spawn', trees: ['oak', 'pine', 'oak'], weather: 'fireflies', time: 'real', critter: 'sheep', props: ['flower', 'flower', 'bush'] },
    'solaryn-light': { biome: 'Napos dombok', trees: ['oak', 'oak', 'birch'], weather: null, time: 'day', critter: 'sheep', clouds: 2, birds: true, props: ['flower', 'flower', 'flower', 'bush'] },
    ice: {
      biome: 'Fagyott vidék', trees: ['pine'], weather: 'snow', time: 'night', critter: 'penguin', aurora: true, snow: true,
      sky: { night: ['#030817', '#061230', '#0a2047', '#113260', '#1b4a7c'] },
      mat: { grass: ['#dfeaf3', '#cfdfee', '#b9cfe3'], grassTop: '#f4faff', dirt: ['#7fa0bd', '#6d8fae', '#8fb0ca', '#5f80a0'], path: ['#b4c9dc', '#a0b8cf', '#c6d8e8'], mount: ['#8fb0cf', '#7396b8', '#b8d4ea'], mount2: ['#6c8fb3', '#5a7da2', '#86a7c6'], hill: ['#2a4a60', '#34566e', '#223e52'], pine: ['#18423f', '#225450', '#10322f', '#2f6a64'], roof: ['#3d5a78', '#32506d', '#4a6a88', '#2a4560'], roof2: ['#3d5a78', '#32506d', '#4a6a88', '#2a4560'], plaster: ['#c0d0dc', '#a9bccb'] },
      props: ['icespike', 'snowman', 'icespike', 'bush']
    },
    crimson: {
      biome: 'Parázsföld', trees: ['dead'], weather: 'embers', time: 'night', critter: 'cat', moon: 'blood', lava: true,
      sky: { night: ['#0a0305', '#190509', '#2b0a10', '#471016', '#701c15'] },
      mat: { grass: ['#2c1a1c', '#3a2224', '#211214'], grassTop: '#5a2a22', dirt: ['#2a1416', '#1f0e10', '#361a1a', '#170a0b'], path: ['#3a2a2a', '#2e2020', '#4a3634'], stone: ['#4c3c3c', '#3c2e2e', '#5e4c4a', '#2c2020'], plaster: ['#6a4c46', '#573c38'], wood: ['#2a1a18', '#1f1210', '#38241f'], roof: ['#3a1616', '#2c1010', '#4c1c1a', '#200c0c'], roof2: ['#3a1616', '#2c1010', '#4c1c1a', '#200c0c'], mount: ['#3a1a1e', '#2c1216', '#4c2226'], mount2: ['#260e12', '#1c0a0c', '#34151a'], hill: ['#1e0c0e', '#28100f', '#160808'], trunk: ['#1c1010', '#120a0a'], win: '#ff7b35', lamp: '#ff8a3c', portal: ['#ff3b1f', '#ff6a2a', '#c21f12', '#ffb36a'] },
      props: ['lavapool', 'obelisk', 'lavapool', 'rock']
    },
    emerald: {
      biome: 'Ősi erdő', trees: ['bigoak', 'oak', 'pine', 'bigoak'], treeDensity: 2, weather: 'fireflies', fireflies: 44, time: 'dusk', critter: 'fox',
      sky: { dusk: ['#07150f', '#0c2419', '#143826', '#2c5a35', '#6a8c3f'] },
      mat: { grass: ['#2f7a3f', '#3f9a4e', '#215f30'], grassTop: '#7fd070', leaf: ['#1f6a3a', '#2f8a4a', '#154f2a', '#59b060'], hill: ['#123a24', '#1a4a2e', '#0e2f1c'], mount: ['#27503a', '#1e4230', '#36664a'], mount2: ['#1a3a2a', '#143022', '#244a36'], roof: ['#3a7a3f', '#2d6a33', '#4c8f4a', '#225626'], roof2: ['#3a7a3f', '#2d6a33', '#4c8f4a', '#225626'], win: '#d8f58a', lamp: '#c9f27a' },
      props: ['mushroom', 'fern', 'mushroom', 'fern', 'flower']
    },
    amethyst: {
      biome: 'Kristályvölgy', trees: ['crystal', 'pine'], weather: 'sparkle', time: 'dusk', critter: 'cat', meteors: true,
      sky: { dusk: ['#0b0620', '#1b0e3c', '#35195f', '#6a2a86', '#c0529a'] },
      mat: { grass: ['#4d3a78', '#5d4890', '#3c2c60'], grassTop: '#9a7ad6', dirt: ['#2c2048', '#231a3a', '#37285a', '#1c142e'], path: ['#6a5a90', '#58497c', '#7c6ca4'], stone: ['#6e6090', '#5a4e78', '#8476a8', '#463c62'], plaster: ['#bfb0da', '#a899c8'], wood: ['#3a2850', '#2c1e40', '#4a3460'], roof: ['#6a3fb0', '#58309a', '#7f54c6', '#46267c'], roof2: ['#6a3fb0', '#58309a', '#7f54c6', '#46267c'], mount: ['#4a2f78', '#3c2564', '#5e3e92'], mount2: ['#34205a', '#2a1a4a', '#40286a'], hill: ['#2a1a4c', '#34205a', '#20143c'], pine: ['#4a2f88', '#5a3aa0', '#38246c', '#7a54c8'], win: '#e6b4ff', lamp: '#d9a0ff' },
      props: ['crystal', 'crystal', 'crystal', 'rock']
    },
    turquoise: {
      biome: 'Elsüllyedt város', trees: ['coral', 'kelp', 'kelp'], treeDensity: 1.4, weather: 'bubbles', time: 'night', critter: 'fish', underwater: true, noClouds: true, noStars: true, noBody: true,
      sky: { night: ['#0f8a94', '#0c7382', '#0a5c6e', '#084a5a', '#063a48'] },
      ambient: [0.62, 0.86, 0.9],
      mat: { grass: ['#c9b98a', '#b8a878', '#a89868'], grassTop: '#e0d2a4', dirt: ['#8c7e5c', '#7c6e4e', '#9c8e6a', '#6c6042'], path: ['#b4a880', '#a49870', '#c4b890'], mount: ['#0d6474', '#0b5868', '#127484'], mount2: ['#0a5262', '#084858', '#0d5c6c'], hill: ['#0a4a5a', '#0c5666', '#083e4c'], roof: ['#1d8a82', '#177a72', '#28a096', '#116a64'], roof2: ['#c85a6e', '#b04a5e', '#dc6c80', '#963c4e'], leaf: ['#18947e', '#22ac92', '#107a68', '#3cc4a8'], win: '#fff2a8', lamp: '#fff2a8' },
      props: ['coralbit', 'shell', 'coralbit', 'kelp']
    },
    halloween: {
      biome: 'Tökföld', trees: ['dead', 'dead', 'pine'], weather: 'leaves', time: 'night', critter: 'cat', moon: 'big', treasureProp: 'pumpkin',
      sky: { night: ['#0a0614', '#170a26', '#2a0f38', '#4a1a3c', '#8a3a24'] },
      mat: { grass: ['#3a3322', '#4a4028', '#2a2618'], grassTop: '#6a5a2a', dirt: ['#2c2018', '#221812', '#382a1e', '#1a120c'], roof: ['#2c2438', '#22182c', '#3a3048', '#181020'], roof2: ['#3c2a1c', '#2c1e14', '#4c3626', '#201610'], hill: ['#1a1428', '#221a34', '#120e1e'], mount: ['#2a1e40', '#201834', '#382a52'], mount2: ['#1c1430', '#150f26', '#261c3e'], pine: ['#1a2a24', '#22342c', '#121e1a', '#2c4034'], win: '#ff9a2a', lamp: '#ffa23a', portal: ['#ff8a1f', '#ffb13a', '#b4580f', '#ffd98a'] },
      props: ['pumpkin', 'grave', 'pumpkin', 'grave', 'rock']
    },
    christmas: {
      biome: 'Téli falu', trees: ['pine'], weather: 'snow', time: 'real', critter: 'sheep', snow: true, lights: true,
      mat: { grass: ['#e4edf4', '#d3e0ec', '#bfd1e2'], grassTop: '#f6fbff', dirt: ['#6e5a50', '#5e4c44', '#7e6a5e', '#4e3e36'], path: ['#b9c6d2', '#a5b5c4', '#cad6e0'], roof: ['#a43a34', '#8c2e2a', '#bc4a42', '#742422'], roof2: ['#2f6a4c', '#26583e', '#3a7c5a', '#1e4a34'], mount: ['#a8bdd2', '#8ea6bf', '#cbdbe9'], mount2: ['#8099b4', '#6c86a2', '#9cb2c8'], hill: ['#2a4a44', '#34564e', '#223e38'], win: '#ffcf70', lamp: '#ffe2a0' },
      props: ['present', 'xmastree', 'snowman', 'present', 'bush']
    },
    newyear: {
      biome: 'Szilveszter', trees: ['pine', 'oak'], weather: null, time: 'night', critter: 'sheep', fireworks: true, lights: true,
      sky: { night: ['#040512', '#080a22', '#0d1132', '#141a42', '#1f2652'] },
      mat: { roof: ['#2a3060', '#22284e', '#343a72', '#1a2040'], roof2: ['#6a5a2a', '#584a20', '#7c6a34', '#463a18'], win: '#ffe28a', lamp: '#ffe28a' },
      props: ['rocket', 'bush', 'rocket', 'flower']
    },
    valentine: {
      biome: 'Rózsakert', trees: ['blossom', 'blossom', 'oak'], weather: 'petals', time: 'dusk', critter: 'sheep',
      sky: { dusk: ['#2a0f2c', '#5a1c48', '#a0345f', '#e8607a', '#ffb09a'] },
      mat: { grass: ['#4f8a4a', '#5f9a56', '#3f763e'], grassTop: '#8ac070', roof: ['#b8395e', '#9c2c4e', '#d04a70', '#7e2240'], roof2: ['#e27a96', '#ca6482', '#f08eaa', '#ac4e6a'], leaf: ['#e87aa0', '#f49ab8', '#cc5c84', '#ffc0d4'], win: '#ffd0a0', lamp: '#ffc0c8' },
      props: ['heartbush', 'flower', 'heartbush', 'flower', 'flower']
    },
    carnival: {
      biome: 'Karnevál', trees: ['oak'], weather: 'confetti', time: 'dusk', critter: 'sheep', lights: true,
      sky: { dusk: ['#120c3a', '#2c1a68', '#5a2a98', '#b8408c', '#ffa04a'] },
      mat: { roof: ['#e8b92a', '#d0a01e', '#f8cf40', '#b4880f'], roof2: ['#2aa8d8', '#1e90c0', '#40bce8', '#0f78a4'], plaster: ['#efe4cc', '#ddd0b4'], win: '#ffe48a', lamp: '#fff0a8' },
      props: ['balloon', 'mask', 'balloon', 'flower']
    },
    easter: {
      biome: 'Tavaszi rét', trees: ['blossom', 'oak', 'birch'], weather: 'petals', time: 'day', critter: 'bunny', clouds: 2,
      sky: { day: ['#6fb8e8', '#8ccaee', '#a8daf2', '#c8e8f4', '#e8f4ee'] },
      mat: { grass: ['#6ec26a', '#82d27c', '#58a858'], grassTop: '#b4ec94', roof: ['#e8a0c0', '#d488ac', '#f4b8d0', '#be7096'], roof2: ['#9ad8a8', '#84c494', '#b0e8bc', '#6eae80'], leaf: ['#f4b8d0', '#fcd0e0', '#e49ab8', '#ffe4ee'] },
      props: ['egg', 'flower', 'egg', 'flower', 'flower', 'egg']
    },
    national: {
      biome: 'Ünnepi tér', trees: ['oak'], weather: null, time: 'day', critter: 'sheep', flags: true, clouds: 1,
      mat: { roof: ['#b53a3a', '#9c2e2e', '#c84c4a', '#822424'], roof2: ['#3a8a4c', '#2e763e', '#4c9e5c', '#22622e'], plaster: ['#efece4', '#dcd8cc'], banner: '#c8323c' },
      props: ['hunflag', 'flower', 'cockade', 'hunflag', 'flower']
    },
    summer: {
      biome: 'Tengerpart', trees: ['palm'], weather: null, time: 'day', critter: 'crab', sea: true, clouds: 1, birds: true, bigSun: true,
      sky: { day: ['#1e86d4', '#34a0e4', '#58b8ee', '#88d0f4', '#c8ecf8'] },
      mat: { grass: ['#ecd9a0', '#e0ca8c', '#d4bc7c'], grassTop: '#f8ecbc', dirt: ['#c8ae74', '#b89e64', '#d8be84', '#a88e54'], path: ['#d8c48c', '#c8b47c', '#e4d09c'], roof: ['#d4a24a', '#bc8c3a', '#e4b45c', '#a4782e'], roof2: ['#2fb4c4', '#209cac', '#44c8d8', '#148490'], leaf: ['#2f9a4e', '#3fb25e', '#22803e', '#5ccc78'], hill: ['#3f9a7e', '#4fae8e', '#32826a'], mount: ['#7fb8c8', '#6ca6b8', '#9ccad8'], mount2: ['#5f9cb0', '#4e8ca0', '#74aec0'] },
      props: ['umbrella', 'shell', 'sandcastle', 'umbrella', 'shell']
    }
  };

  const VIEW_POS = {
    home: 0, skin: 930, cosmetics: 930, market: 300, trades: 300, coin: 300, wallet: 300, transfer: 300, redeem: 300, ledger: 300,
    ranks: 610, sanction: 1240, security: 1240, players: 1540, casino: 1540, staffApply: 1540, mediaCalendar: 1540, faq: 1810, legal: 1810,
    playerProfile: 1540, deviceDetail: 1240
  };
  const WORLD_LEN = 2100;
  const BLOCK_SIZE = 4;
  const DOLL_HOME_X = -70;
  const BLOCK_KINDS = [
    { k: 'stone', label: 'Kő', c: '#8c8b84' }, { k: 'brick', label: 'Tégla', c: '#a0523f' }, { k: 'wood', label: 'Fa', c: '#70492c' }, { k: 'dirt', label: 'Föld', c: '#5b4030' },
    { k: 'leaf', label: 'Lomb', c: '#3f8244' }, { k: 'gold', label: 'Arany', c: '#e8c14a' }, { k: 'crystal', label: 'Kristály', c: '#a35cff' }, { k: 'lamp', label: 'Lámpa', c: '#ffd98a' }
  ];

  // ---- Offscreen réteg, földszintről felfelé mért koordinátákkal --------------------------------
  class Layer {
    constructor(len, height, below, para) {
      this.len = len; this.h = height; this.below = below; this.para = para;
      this.c = document.createElement('canvas');
      this.c.width = len; this.c.height = height + below;
      this.ctx = this.c.getContext('2d');
      this.base = height;
      this.tint = null;
      this.cache = new Map();
    }
    color(col) {
      const key = typeof col === 'string' ? col : col.join(',');
      let v = this.cache.get(key);
      if (!v) {
        v = this.tint(typeof col === 'string' ? hx(col) : col);
        v = css(v);
        this.cache.set(key, v);
      }
      return v;
    }
    r(x, y, w, h, col, raw) {
      if (w <= 0 || h <= 0) return;
      const ctx = this.ctx;
      ctx.fillStyle = raw ? col : this.color(col);
      const cy = this.base - y - h;
      ctx.fillRect(x, cy, w, h);
      if (x < 0) ctx.fillRect(x + this.len, cy, w, h);
      if (x + w > this.len) ctx.fillRect(x - this.len, cy, w, h);
    }
  }

  // ---- Építőkockák --------------------------------------------------------------------------
  const S = {
    speckle(l, x, y, w, h, cols, rand, density) {
      const n = Math.round(w * h * density);
      for (let i = 0; i < n; i++) l.r(x + Math.floor(rand() * w), y + Math.floor(rand() * h), 1, 1, cols[Math.floor(rand() * cols.length)]);
    },
    canopy(l, cx, cy, rx, ry, cols, rand, noBottom) {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
          const edge = 0.82 + rand() * 0.28;
          if (d > edge) continue;
          if (noBottom && dy < -ry * 0.55 && rand() < 0.4) continue;
          const light = (-dx * 0.55 + dy * 0.9) / Math.max(rx, ry) + (rand() - 0.5) * 0.7;
          let c = cols[0];
          if (light > 0.55) c = cols[3] || cols[1];
          else if (light > 0.15) c = cols[1];
          else if (light < -0.42) c = cols[2];
          l.r(cx + dx, cy + dy, 1, 1, c);
        }
      }
    },
    oak(l, x, s, mat, rand) {
      const h = 8 + s * 3;
      l.r(x - 1, 0, 3, h, mat.trunk[0]);
      l.r(x + 1, 0, 1, h, mat.trunk[1]);
      l.r(x - 2, 0, 1, 2, mat.trunk[1]);
      l.r(x + 2, 0, 1, 2, mat.trunk[1]);
      const rx = 6 + s * 2, ry = 5 + s;
      S.canopy(l, x, h + ry - 2, rx, ry, mat.leaf, rand);
      S.canopy(l, x - rx + 2, h + 1, Math.max(3, rx - 3), Math.max(3, ry - 2), mat.leaf, rand);
      S.canopy(l, x + rx - 2, h + 2, Math.max(3, rx - 3), Math.max(3, ry - 2), mat.leaf, rand);
    },
    bigoak(l, x, s, mat, rand) {
      const h = 16 + s * 4;
      l.r(x - 3, 0, 6, h, mat.trunk[0]);
      l.r(x + 1, 0, 2, h, mat.trunk[1]);
      l.r(x - 5, 0, 2, 3, mat.trunk[1]);
      l.r(x + 3, 0, 3, 3, mat.trunk[1]);
      S.canopy(l, x, h + 12, 15 + s * 2, 11 + s, mat.leaf, rand);
      S.canopy(l, x - 12, h + 4, 9, 7, mat.leaf, rand);
      S.canopy(l, x + 12, h + 6, 9, 7, mat.leaf, rand);
    },
    birch(l, x, s, mat, rand) {
      const h = 10 + s * 3;
      l.r(x - 1, 0, 2, h, '#d9d4c7');
      for (let i = 1; i < h; i += 3) l.r(x - 1 + (i % 2), i, 1, 1, '#4a4238');
      S.canopy(l, x, h + 4, 5 + s, 5 + s, mat.leaf, rand);
    },
    blossom(l, x, s, mat, rand) {
      const h = 8 + s * 2;
      l.r(x - 1, 0, 2, h, mat.trunk[0]);
      S.canopy(l, x, h + 5, 7 + s, 5 + s, mat.leaf, rand);
    },
    pine(l, x, s, mat, rand) {
      const tiers = 3 + s;
      l.r(x - 1, 0, 2, 4, mat.trunk[0]);
      let y = 3, w = 6 + s * 2;
      for (let t = 0; t < tiers; t++) {
        const th = 5;
        for (let i = 0; i < th; i++) {
          const iw = Math.max(1, w - Math.floor((i / th) * (w - 1)));
          l.r(x - iw, y + i, iw, 1, mat.pine[rand() < 0.3 ? 3 : 1]);
          l.r(x, y + i, iw, 1, mat.pine[rand() < 0.25 ? 2 : 0]);
        }
        y += 3;
        w = Math.max(2, w - 2);
      }
      if (mat.snowCap) {
        l.r(x - 1, y + 2, 2, 2, mat.snowCap);
        l.r(x - 3, y - 1, 2, 1, mat.snowCap);
        l.r(x + 1, y - 1, 2, 1, mat.snowCap);
      }
    },
    dead(l, x, s, mat, rand) {
      const h = 12 + s * 4;
      const c = mat.trunk[0];
      l.r(x - 1, 0, 2, h, c);
      for (let i = 0; i < 4 + s; i++) {
        const by = 5 + Math.floor(rand() * (h - 5));
        const dir = rand() < 0.5 ? -1 : 1;
        const len = 3 + Math.floor(rand() * 5);
        for (let j = 0; j < len; j++) l.r(x + dir * (j + 1) - (dir < 0 ? 0 : 1) + (dir > 0 ? 1 : -1), by + Math.floor(j / 2), 1, 1, c);
      }
    },
    palm(l, x, s, mat, rand) {
      const h = 16 + s * 3;
      let tx = x;
      for (let i = 0; i < h; i += 2) { l.r(tx, i, 2, 2, i % 4 ? mat.trunk[0] : mat.trunk[1]); if (i === 6 || i === 12) tx += 1; }
      for (const [dx, dy, len] of [[-1, 0, 8], [1, 0, 8], [-1, 1, 5], [1, 1, 5], [-1, -1, 6], [1, -1, 6]]) {
        let px = tx, py = h;
        for (let i = 0; i < len; i++) {
          px += dx; py += (i < len / 2 ? dy + (dy >= 0 ? 0 : 0) : -1);
          l.r(px, py, 2, 1, mat.leaf[i % 3 === 0 ? 3 : 1]);
          l.r(px, py - 1, 1, 1, mat.leaf[2]);
        }
      }
      l.r(tx - 1, h - 2, 2, 2, '#6e4a2a');
    },
    crystal(l, x, s, mat, rand) {
      const cols = [mat.roof[3], mat.roof[0], mat.roof[2], '#e6d0ff'];
      const shard = (ox, h, w) => {
        for (let i = 0; i < h; i++) {
          const iw = i > h - w ? h - i : w;
          l.r(ox, i, iw, 1, cols[1]);
          l.r(ox, i, Math.max(1, iw >> 1), 1, cols[2]);
          if (i % 5 === 2) l.r(ox + iw - 1, i, 1, 1, cols[0]);
        }
        l.r(ox, h - 2, 1, 2, cols[3]);
      };
      shard(x - 2, 14 + s * 4, 4);
      shard(x + 2, 8 + s * 2, 3);
      shard(x - 5, 6 + s * 2, 3);
    },
    coral(l, x, s, mat, rand) {
      const c = mat.roof2;
      const arm = (ax, ay, len, dir) => {
        for (let i = 0; i < len; i++) { l.r(ax, ay + i, 2, 1, c[i % 3 === 0 ? 2 : 0]); if (i && i % 3 === 0) ax += dir; }
        return [ax, ay + len];
      };
      arm(x, 0, 8 + s * 2, 0);
      arm(x + 1, 4, 7 + s, 1);
      arm(x - 1, 3, 6 + s, -1);
    },
    kelp(l, x, s, mat, rand) {
      const h = 16 + s * 6;
      for (let i = 0; i < h; i++) {
        const ox = Math.round(Math.sin(i / 3) * 1.4);
        l.r(x + ox, i, 2, 1, mat.leaf[i % 4 === 0 ? 3 : 1]);
        if (i % 4 === 1) l.r(x + ox + (i % 8 === 1 ? 2 : -2), i, 2, 1, mat.leaf[0]);
      }
    },
    roofGable(l, x, y, w, rh, cols, rand, snow) {
      for (let i = 0; i < rh; i++) {
        const inset = Math.round((i * (w / 2)) / rh);
        const rw = w - inset * 2;
        if (rw <= 0) break;
        l.r(x + inset, y + i, rw, 1, cols[0]);
        l.r(x + inset, y + i, 1, 1, cols[2]);
        l.r(x + inset + rw - 1, y + i, 1, 1, cols[3]);
        for (let px = x + inset + 1; px < x + inset + rw - 1; px += 2 + (i % 2)) {
          const n = rand();
          if (n < 0.28) l.r(px, y + i, 2, 1, cols[1]);
          else if (n < 0.42) l.r(px, y + i, 1, 1, cols[2]);
        }
        if (snow) { l.r(x + inset, y + i + 1, 2, 1, snow); l.r(x + inset + rw - 2, y + i + 1, 2, 1, snow); }
      }
      if (snow) l.r(x + w / 2 - 1, y + rh - 1, 2, 2, snow);
    },
    roofHip(l, x, y, w, rh, cols, rand, snow) {
      for (let i = 0; i < rh; i++) {
        const inset = i;
        const rw = w - inset * 2;
        if (rw <= 0) break;
        l.r(x + inset, y + i, rw, 1, i % 2 ? cols[0] : cols[1]);
        for (let px = x + inset; px < x + inset + rw - 1; px += 3) {
          const n = rand();
          if (n < 0.25) l.r(px, y + i, 2, 1, cols[2]);
          else if (n < 0.45) l.r(px, y + i, 1, 1, cols[3]);
        }
      }
      if (snow) {
        const topW = w - rh * 2;
        if (topW > 0) l.r(x + rh, y + rh, topW, 2, snow);
        for (let i = 0; i < rh; i += 1) { l.r(x + i, y + i + 1, 1, 1, snow); l.r(x + w - i - 1, y + i + 1, 1, 1, snow); }
      }
    }
  };

  function buildTown(W, l, mat, env, rand, cfg) {
    const lit = env.night > 0.25;
    const lights = W.lights;
    const hits = W.hits;
    const snow = cfg.snow ? '#eef6fc' : null;
    const winCol = lit ? mat.win : mat.winOff;

    function win(x, y, w, h) {
      l.r(x - 1, y - 1, w + 2, h + 2, mat.wood[1]);
      if (lit) l.r(x, y, w, h, winCol, true);
      else l.r(x, y, w, h, winCol);
      l.r(x + (w >> 1), y, 1, h, mat.wood[1]);
      l.r(x, y + (h >> 1), w, 1, mat.wood[1]);
      if (lit) lights.push({ x: x + w / 2, y: y + h / 2, r: 14, c: mat.win, a: 0.5 });
    }
    function door(x, w, h) {
      l.r(x - 1, 0, w + 2, h + 1, mat.stone[1]);
      l.r(x, 0, w, h, mat.wood[1]);
      for (let i = x + 1; i < x + w; i += 2) l.r(i, 0, 1, h, mat.wood[0]);
      l.r(x + w - 2, 3, 1, 1, '#d9b24a');
    }
    function house(x, w, h, o) {
      o = o || {};
      const cols = o.roof || mat.roof;
      l.r(x, 0, w, 4, mat.stone[1]);
      S.speckle(l, x, 0, w, 4, [mat.stone[0], mat.stone[3], mat.stone[2]], rand, 0.45);
      l.r(x, 4, w, h - 4, mat.plaster[0]);
      S.speckle(l, x, 4, w, h - 4, [mat.plaster[1]], rand, 0.1);
      l.r(x, 4, 2, h - 4, mat.wood[0]);
      l.r(x + w - 2, 4, 2, h - 4, mat.wood[1]);
      l.r(x, h - 2, w, 2, mat.wood[0]);
      l.r(x, 4, w, 1, mat.wood[1]);
      if (w > 30) l.r(x + (w >> 1) - 1, 4, 2, h - 6, mat.wood[1]);
      if (h > 22) l.r(x, (h >> 1) + 2, w, 1, mat.wood[1]);
      const dw = 7;
      const dx = o.doorX != null ? x + o.doorX : x + (w >> 1) - 3;
      door(dx, dw, 11);
      const rows = h > 22 ? [8, (h >> 1) + 5] : [8];
      rows.forEach((wy, ri) => {
        for (let wx = x + 5; wx < x + w - 8; wx += 12) {
          if (ri === 0 && wx + 5 > dx - 1 && wx < dx + dw + 1) continue;
          win(wx, wy, 5, 6);
        }
      });
      const over = 3;
      if (o.hip) S.roofHip(l, x - over, h, w + over * 2, o.rh || 12, cols, rand, snow);
      else S.roofGable(l, x - over, h, w + over * 2, o.rh || Math.round((w + 6) * 0.55), cols, rand, snow);
      if (o.chimney) {
        const cx = x + w - 9;
        const ctop = h + (o.rh || 10);
        l.r(cx, h + 2, 4, ctop - h - 2, mat.stone[1]);
        l.r(cx - 1, ctop, 6, 2, mat.stone[0]);
        W.smoke.push({ x: cx + 2, y: ctop + 2 });
      }
      if (cfg.lights) {
        const palette = ['#ff5a5a', '#ffd25a', '#5ad2ff', '#7ae07a'];
        for (let i = 0; i < w + 6; i += 3) {
          const c = palette[(i / 3) % 4];
          l.r(x - 3 + i, h - 1, 1, 1, c, false);
          lights.push({ x: x - 3 + i, y: h - 1, r: 4, c, a: 0.55, tw: true });
        }
      }
    }
    function lamp(x, h) {
      l.r(x, 0, 1, h, mat.wood[1]);
      l.r(x - 2, h, 5, 1, mat.wood[1]);
      l.r(x - 1, h - 3, 3, 3, lit ? mat.lamp : '#c9b98a', false);
      l.r(x - 1, h - 3, 3, 1, mat.wood[1]);
      if (lit) lights.push({ x: x + 0.5, y: h - 1.5, r: 20, c: mat.lamp, a: 0.75 });
    }
    function tower(x, w, h, o) {
      o = o || {};
      const stone = o.stone || mat.stone;
      l.r(x, 0, w, h, stone[0]);
      for (let yy = 0; yy < h; yy += 3) {
        for (let xx = x + ((yy / 3) % 2 ? 0 : 2); xx < x + w - 1; xx += 4) {
          l.r(xx, yy, 3, 1, rand() < 0.5 ? stone[1] : stone[2]);
          l.r(xx + 3, yy, 1, 3, stone[3]);
        }
      }
      l.r(x + w - 2, 0, 2, h, stone[1]);
      l.r(x, 0, 2, h, stone[2]);
      if (o.cren !== false) {
        l.r(x - 2, h, w + 4, 2, stone[1]);
        for (let i = x - 2; i < x + w + 2; i += 4) l.r(i, h + 2, 2, 3, stone[0]);
      }
      if (o.cone) {
        S.roofGable(l, x - 3, h + 2, w + 6, Math.round(w * 0.95), o.cone, rand, snow);
      }
      if (o.win) for (let wy = 10; wy < h - 6; wy += 14) win(x + (w >> 1) - 2, wy, 4, 6);
    }
    function banner(x, y, h, col, w) {
      w = w || 5;
      l.r(x - 1, y, 1, h + 3, mat.wood[1]);
      W.flags.push({ x, y: y + 3, w, h, c: l.color(col), d: l.color(mixc(hx(col), [0, 0, 0], 0.25)) });
    }

    // --- 0: Főkapu a portállal, ahogy a szerveren is áll
    const G0 = 0;
    (function gate() {
      const cx = G0;
      tower(cx - 31, 62, 34, { cren: false });
      const roofC = mat.roof;
      S.roofGable(l, cx - 37, 34, 74, 30, roofC, rand, snow);
      l.r(cx - 31, 33, 62, 2, mat.wood[0]);
      // boltív
      const R0 = 15;
      for (let i = -R0 - 3; i <= R0 + 3; i++) {
        const top = Math.round(Math.sqrt(Math.max(0, (R0 + 3) * (R0 + 3) - i * i)));
        l.r(cx + i, 12, 1, top + 1, '#a9a69c');
        if (i % 2 === 0) l.r(cx + i, 12 + top - 1, 1, 1, '#c8c5ba');
      }
      for (let i = -R0; i <= R0; i++) {
        const top = Math.round(Math.sqrt(Math.max(0, R0 * R0 - i * i)));
        l.r(cx + i, 12, 1, top, '#120a22', true);
      }
      l.r(cx - R0 - 3, 0, 3, 13, '#a9a69c');
      l.r(cx + R0 + 1, 0, 3, 13, '#a9a69c');
      l.r(cx - R0, 0, R0 * 2 + 1, 12, '#120a22', true);
      W.portal = { x: cx - R0, y: 0, w: R0 * 2 + 1, r: R0, base: 12 };
      lights.push({ x: cx, y: 16, r: 42, c: mat.portal[1], a: 0.65, always: true });
      hits.push({ id: 'portal', x: cx - R0, y: 0, w: R0 * 2 + 1, h: 27, label: 'Portál' });
      // lépcső
      l.r(cx - 24, 0, 48, 1, mat.path[2]);
      l.r(cx - 20, 1, 40, 0, mat.path[0]);
      // oszlopok lámpával
      tower(cx - 47, 8, 26, { cren: false });
      tower(cx + 39, 8, 26, { cren: false });
      l.r(cx - 48, 26, 10, 2, mat.stone[2]);
      l.r(cx + 38, 26, 10, 2, mat.stone[2]);
      l.r(cx - 45, 28, 4, 4, lit ? mat.lamp : '#c9b98a');
      l.r(cx + 41, 28, 4, 4, lit ? mat.lamp : '#c9b98a');
      if (lit) {
        lights.push({ x: cx - 43, y: 30, r: 24, c: mat.lamp, a: 0.8 });
        lights.push({ x: cx + 43, y: 30, r: 24, c: mat.lamp, a: 0.8 });
      }
      // zászló
      banner(cx - 60, 26, 16, mat.banner, 12);
      l.r(cx - 61, 0, 1, 30, mat.wood[1]);
      // melléképületek
      house(cx - 112, 44, 26, { chimney: true, rh: 22 });
      house(cx + 62, 40, 24, { roof: mat.roof2, rh: 20 });
      house(cx + 110, 30, 18, { hip: true, rh: 8 });
      house(cx - 150, 26, 16, { roof: mat.roof2, hip: true, rh: 8 });
      lamp(cx - 66, 16); lamp(cx + 56, 16); lamp(cx - 122, 14); lamp(cx + 146, 14);
    })();

    // --- 300: Piac
    (function market() {
      const cx = 300;
      const stall = (x, c1, c2) => {
        l.r(x, 0, 2, 16, mat.wood[1]);
        l.r(x + 26, 0, 2, 16, mat.wood[1]);
        l.r(x, 0, 28, 7, mat.wood[0]);
        for (let i = 2; i < 26; i += 5) l.r(x + i, 7, 3, 2, ['#e8c14a', '#ef6f6c', '#7fd07f', '#9ad0ff'][Math.floor(rand() * 4)]);
        for (let i = -3; i < 31; i += 4) {
          const c = (i + 3) % 8 === 0 ? c1 : c2;
          l.r(x + i, 16, 4, 5, c);
          l.r(x + i + 1, 21, 2, 2, c);
        }
        l.r(x - 3, 16, 34, 1, mat.wood[1]);
      };
      stall(cx - 70, '#c8452f', '#e9e0cc');
      stall(cx - 30, '#e0a82a', '#e9e0cc');
      stall(cx + 10, '#3f7fd0', '#e9e0cc');
      house(cx + 50, 36, 22, { roof: mat.roof2, rh: 18, chimney: true });
      house(cx - 112, 34, 20, { hip: true, rh: 9 });
      // zsákok, ládák
      l.r(cx - 40, 0, 7, 6, mat.wood[2]); l.r(cx - 40, 3, 7, 1, mat.wood[1]);
      l.r(cx + 42, 0, 5, 5, '#c8a050'); l.r(cx + 42, 5, 3, 1, '#e8c070');
      lamp(cx - 80, 16); lamp(cx + 44, 16);
    })();

    // --- 610: Vár, rangzászlókkal
    (function castle() {
      const cx = 610;
      tower(cx - 40, 80, 30, {});
      tower(cx - 58, 20, 50, { win: true, cone: mat.roof2 });
      tower(cx + 38, 20, 50, { win: true, cone: mat.roof2 });
      tower(cx - 14, 28, 44, { win: true });
      l.r(cx - 9, 0, 18, 16, '#1c1420', true);
      for (let i = -9; i < 9; i += 3) l.r(cx + i, 8, 1, 8, mat.stone[3]);
      ['#ff9f2e', '#9a6cff', '#ff4d6d', '#3ee0a0', '#ffc42e'].forEach((c, i) => {
        banner(cx - 38 + i * 19, 18, 11, c, 6);
        l.r(cx - 39 + i * 19, 18, 1, 3, mat.wood[1]);
      });
      banner(cx, 49, 12, '#ffc42e', 9);
      l.r(cx - 1, 44, 1, 6, mat.wood[1]);
      lamp(cx - 70, 16); lamp(cx + 66, 16);
    })();

    // --- 930: Szabóház kiterített köpenyekkel
    (function tailor() {
      const cx = 930;
      house(cx - 28, 56, 30, { rh: 26, chimney: true });
      house(cx - 70, 32, 20, { roof: mat.roof2, hip: true, rh: 9 });
      l.r(cx + 34, 0, 1, 22, mat.wood[1]);
      l.r(cx + 72, 0, 1, 22, mat.wood[1]);
      l.r(cx + 34, 21, 39, 1, mat.wood[2]);
      ['#ff4d6d', '#ffc42e', '#3ee0a0', '#9a6cff', '#4fd3ff'].forEach((c, i) => {
        const x = cx + 37 + i * 7;
        l.r(x, 9, 5, 12, c);
        l.r(x + 4, 9, 1, 12, mixc(hx(c), [0, 0, 0], 0.3));
      });
      lamp(cx + 80, 16);
    })();

    // --- 1240: Őrtorony és várfal
    (function watch() {
      const cx = 1240;
      tower(cx - 90, 180, 16, {});
      tower(cx - 13, 26, 66, { win: true });
      tower(cx - 100, 16, 30, {});
      tower(cx + 86, 16, 30, {});
      l.r(cx - 7, 0, 14, 12, '#1a1418', true);
      for (let i = -7; i < 7; i += 3) l.r(cx + i, 0, 1, 12, mat.stone[3]);
      // pajzs
      l.r(cx - 8, 40, 16, 11, '#3b6aa0'); l.r(cx - 6, 37, 12, 3, '#3b6aa0'); l.r(cx - 3, 35, 6, 2, '#3b6aa0');
      l.r(cx - 1, 35, 2, 16, '#e8c14a'); l.r(cx - 8, 45, 16, 2, '#e8c14a');
      banner(cx, 71, 14, mat.banner, 12);
      l.r(cx - 1, 66, 1, 6, mat.wood[1]);
      lamp(cx - 40, 26); lamp(cx + 40, 26);
    })();

    // --- 1540: Fogadó, tűzrakás, kockázó sátor
    (function tavern() {
      const cx = 1540;
      house(cx - 66, 58, 30, { rh: 22, hip: false, chimney: true, roof: mat.roof2 });
      // cégér
      l.r(cx - 8, 22, 10, 1, mat.wood[1]);
      l.r(cx - 2, 13, 8, 8, mat.wood[2]);
      l.r(cx, 15, 4, 4, '#e8c14a');
      // tűz
      W.fire = { x: cx + 18, y: 0 };
      l.r(cx + 14, 0, 9, 2, mat.wood[1]);
      l.r(cx + 8, 0, 3, 3, mat.wood[0]);
      l.r(cx + 26, 0, 3, 3, mat.wood[0]);
      lights.push({ x: cx + 18, y: 4, r: 30, c: '#ff9a3c', a: 0.8, tw: true, always: true });
      // sátor
      const tx = cx + 44;
      for (let i = 0; i < 22; i++) {
        const w = 44 - i * 2;
        for (let j = 0; j < w; j += 6) l.r(tx + i + j, i, 3, 1, '#c8352f');
        for (let j = 3; j < w; j += 6) l.r(tx + i + j, i, 3, 1, '#ece2cc');
      }
      l.r(tx + 18, 0, 8, 12, '#1a1218', true);
      l.r(tx + 21, 22, 1, 6, mat.wood[1]);
      l.r(tx + 22, 25, 5, 3, '#ffc42e');
      lamp(cx - 78, 16); lamp(cx + 94, 16);
    })();

    // --- 1810: Könyvtár és útjelző
    (function library() {
      const cx = 1810;
      house(cx - 34, 68, 34, { rh: 30, chimney: false });
      l.r(cx - 6, 34, 12, 12, mat.stone[2]);
      l.r(cx - 4, 36, 8, 8, lit ? mat.win : mat.winOff);
      if (lit) lights.push({ x: cx, y: 40, r: 22, c: mat.win, a: 0.65 });
      // útjelző
      l.r(cx + 48, 0, 2, 22, mat.wood[1]);
      l.r(cx + 42, 16, 14, 4, mat.wood[2]);
      l.r(cx + 48, 10, 11, 4, mat.wood[2]);
      house(cx + 66, 30, 18, { roof: mat.roof2, hip: true, rh: 9 });
      lamp(cx - 46, 16);
    })();
  }

  // Ritkított kellékek a témához
  const PROPS = {
    flower(l, x, mat, rand) {
      const c = mat.flower[Math.floor(rand() * mat.flower.length)];
      l.r(x, 0, 1, 2, mat.leaf[1]);
      l.r(x - 1, 2, 3, 1, c); l.r(x, 3, 1, 1, c); l.r(x, 1, 1, 1, c);
    },
    bush(l, x, mat, rand) { S.canopy(l, x, 2, 4, 3, mat.leaf, rand); },
    fern(l, x, mat) { l.r(x, 0, 1, 4, mat.leaf[1]); l.r(x - 2, 2, 2, 1, mat.leaf[3]); l.r(x + 1, 3, 2, 1, mat.leaf[3]); },
    rock(l, x, mat, rand) { l.r(x - 3, 0, 7, 3, mat.stone[1]); l.r(x - 2, 3, 5, 1, mat.stone[0]); l.r(x - 2, 2, 2, 1, mat.stone[2]); },
    mushroom(l, x, mat) {
      l.r(x, 0, 2, 4, '#e8dfca');
      l.r(x - 3, 4, 8, 3, '#d8504a'); l.r(x - 2, 7, 6, 1, '#d8504a');
      l.r(x - 1, 5, 2, 1, '#f4ece0'); l.r(x + 2, 6, 1, 1, '#f4ece0');
    },
    pumpkin(l, x, mat, rand, W) {
      l.r(x - 4, 0, 9, 6, '#d9711f'); l.r(x - 5, 1, 11, 4, '#d9711f');
      l.r(x - 2, 0, 1, 6, '#a84f12'); l.r(x + 2, 0, 1, 6, '#a84f12');
      l.r(x, 6, 2, 2, '#4a5a2a');
      const on = W.env.night > 0.25;
      l.r(x - 3, 3, 2, 1, on ? '#ffe28a' : '#3a1c08'); l.r(x + 2, 3, 2, 1, on ? '#ffe28a' : '#3a1c08');
      l.r(x - 2, 1, 5, 1, on ? '#ffe28a' : '#3a1c08');
      if (on) W.lights.push({ x, y: 3, r: 14, c: '#ff9a2a', a: 0.6, tw: true });
      W.hits.push({ id: 'prop:pumpkin', x: x - 5, y: 0, w: 11, h: 8, label: 'Tök' });
    },
    grave(l, x, mat) {
      l.r(x - 3, 0, 7, 8, '#6c6a72'); l.r(x - 2, 8, 5, 1, '#6c6a72'); l.r(x + 3, 0, 1, 8, '#4c4a52');
      l.r(x, 3, 1, 4, '#3c3a42'); l.r(x - 1, 5, 3, 1, '#3c3a42');
    },
    snowman(l, x, mat, rand, W) {
      l.r(x - 4, 0, 9, 7, '#f4f8fc'); l.r(x - 3, 7, 7, 5, '#f4f8fc'); l.r(x + 3, 1, 2, 5, '#cfdcea');
      l.r(x - 1, 9, 1, 1, '#22222a'); l.r(x + 1, 9, 1, 1, '#22222a'); l.r(x, 8, 2, 1, '#e8742a');
      l.r(x - 3, 12, 7, 1, '#22222a'); l.r(x - 2, 13, 5, 3, '#22222a');
      W.hits.push({ id: 'prop:snowman', x: x - 4, y: 0, w: 9, h: 16, label: 'Hóember' });
    },
    icespike(l, x, mat, rand) {
      const h = 8 + Math.floor(rand() * 10);
      for (let i = 0; i < h; i++) {
        const w = Math.max(1, 4 - Math.floor((i / h) * 4));
        l.r(x - w, i, w, 1, '#b8e4fa'); l.r(x, i, w, 1, '#86c4e8');
      }
    },
    lavapool(l, x, mat, rand, W) {
      l.r(x - 9, 0, 19, 1, '#ff7a2a', false);
      l.r(x - 7, 1, 15, 1, '#ffb43a');
      W.lights.push({ x, y: 1, r: 26, c: '#ff5a1f', a: 0.7, tw: true, always: true });
    },
    obelisk(l, x, mat) {
      l.r(x - 3, 0, 7, 20, mat.stone[3]); l.r(x - 2, 20, 5, 4, mat.stone[3]); l.r(x - 1, 24, 3, 2, mat.stone[3]);
      for (let y = 4; y < 20; y += 5) l.r(x, y, 1, 3, '#ff6a2a');
    },
    crystal(l, x, mat, rand, W) {
      S.crystal(l, x, 0, mat, rand);
      W.hits.push({ id: 'prop:crystal', x: x - 5, y: 0, w: 11, h: 15, label: 'Kristály', tone: Math.floor(rand() * 5) });
    },
    coralbit(l, x, mat, rand) { S.coral(l, x, 0, mat, rand); },
    shell(l, x, mat) { l.r(x - 2, 0, 5, 2, '#f4c8b8'); l.r(x - 1, 2, 3, 1, '#f4c8b8'); l.r(x, 0, 1, 3, '#d89c8c'); },
    kelp(l, x, mat, rand) { S.kelp(l, x, 0, mat, rand); },
    present(l, x, mat, rand, W) {
      const c = ['#d8352f', '#2f8a4c', '#3a6ad0', '#d8a82f'][Math.floor(rand() * 4)];
      l.r(x - 3, 0, 7, 6, c); l.r(x, 0, 1, 6, '#f4e8c8'); l.r(x - 3, 3, 7, 1, '#f4e8c8'); l.r(x - 1, 6, 1, 1, '#f4e8c8'); l.r(x + 1, 6, 1, 1, '#f4e8c8');
      W.hits.push({ id: 'prop:present', x: x - 3, y: 0, w: 7, h: 7, label: 'Ajándék' });
    },
    xmastree(l, x, mat, rand, W) {
      S.pine(l, x, 3, mat, rand);
      const pal = ['#ff5a5a', '#ffd25a', '#5ad2ff', '#ff8af0'];
      for (let i = 0; i < 16; i++) {
        const y = 5 + Math.floor(rand() * 16);
        const dx = Math.round((rand() - 0.5) * (22 - y) * 0.8);
        const c = pal[i % 4];
        l.r(x + dx, y, 1, 1, c);
        W.lights.push({ x: x + dx, y, r: 4, c, a: 0.7, tw: true, always: true });
      }
      l.r(x - 1, 22, 2, 2, '#ffe28a');
      W.lights.push({ x, y: 23, r: 10, c: '#ffe28a', a: 0.8, tw: true, always: true });
    },
    rocket(l, x, mat) { l.r(x, 0, 1, 8, mat.wood[1]); l.r(x - 1, 8, 3, 4, '#d8352f'); l.r(x, 12, 1, 2, '#f4e8c8'); },
    heartbush(l, x, mat, rand, W) {
      const c = '#e8466e';
      l.r(x - 3, 3, 3, 2, c); l.r(x + 1, 3, 3, 2, c); l.r(x - 3, 1, 7, 2, c); l.r(x - 2, 0, 5, 1, c); l.r(x - 1, -1 + 1, 3, 1, c);
      W.hits.push({ id: 'prop:heart', x: x - 4, y: 0, w: 9, h: 6, label: 'Szív' });
    },
    balloon(l, x, mat, rand) {
      const c = ['#e8466e', '#ffd23f', '#43d3ff', '#7ae07a'][Math.floor(rand() * 4)];
      l.r(x, 0, 1, 14, '#c9b98a'); l.r(x - 2, 14, 5, 6, c); l.r(x - 1, 20, 3, 1, c); l.r(x - 1, 13, 3, 1, c); l.r(x - 1, 18, 1, 1, '#ffffff');
    },
    mask(l, x, mat, rand, W) {
      l.r(x, 0, 1, 6, mat.wood[1]); l.r(x - 4, 6, 9, 4, '#7a3cff'); l.r(x - 3, 10, 2, 1, '#ffd23f'); l.r(x + 2, 10, 2, 1, '#ffd23f');
      l.r(x - 3, 7, 2, 2, '#120a22'); l.r(x + 2, 7, 2, 2, '#120a22');
      W.hits.push({ id: 'prop:mask', x: x - 4, y: 6, w: 9, h: 5, label: 'Álarc' });
    },
    egg(l, x, mat, rand, W) {
      const c = ['#ff9ec0', '#9ad8ff', '#ffe28a', '#b4f0a0', '#d0b0ff'][Math.floor(rand() * 5)];
      l.r(x - 2, 0, 5, 5, c); l.r(x - 1, 5, 3, 2, c);
      l.r(x - 2, 2, 5, 1, '#ffffff'); l.r(x + 2, 0, 1, 5, mixc(hx(c), [0, 0, 0], 0.15));
      W.hits.push({ id: 'prop:egg', x: x - 2, y: 0, w: 5, h: 7, label: 'Hímes tojás', uid: x });
    },
    hunflag(l, x, mat, rand, W) {
      l.r(x, 0, 1, 26, '#e8e4d8');
      l.r(x + 1, 22, 12, 3, '#c8323c'); l.r(x + 1, 19, 12, 3, '#f4f2ea'); l.r(x + 1, 16, 12, 3, '#3a8a4c');
      W.hits.push({ id: 'prop:flag', x: x, y: 14, w: 14, h: 12, label: 'Zászló' });
    },
    cockade(l, x) {
      l.r(x, 0, 1, 6, '#6b4a2a');
      l.r(x - 3, 6, 7, 7, '#3a8a4c'); l.r(x - 2, 7, 5, 5, '#f4f2ea'); l.r(x - 1, 8, 3, 3, '#c8323c');
    },
    umbrella(l, x, mat, rand) {
      const a = ['#e8466e', '#2fb4c4', '#ffd23f'][Math.floor(rand() * 3)];
      l.r(x, 0, 1, 14, '#e8dfca');
      for (let i = 0; i < 6; i++) { const w = 18 - i * 3; for (let j = 0; j < w; j += 2) l.r(x - w / 2 + j, 14 + i, 1, 1, a); for (let j = 1; j < w; j += 2) l.r(x - w / 2 + j, 14 + i, 1, 1, '#f8f4e8'); }
    },
    sandcastle(l, x, mat, rand, W) {
      const c = mat.path[0];
      l.r(x - 8, 0, 17, 5, c); l.r(x - 7, 5, 4, 4, c); l.r(x + 4, 5, 4, 4, c); l.r(x - 2, 5, 5, 7, c);
      for (const o of [-7, -5, 4, 6, -2, 0, 2]) l.r(x + o, o > -3 && o < 3 ? 12 : 9, 1, 1, c);
      l.r(x, 12, 1, 5, '#6b4a2a'); l.r(x + 1, 15, 4, 2, '#e8466e');
      l.r(x - 1, 0, 3, 3, mat.path[1]);
      W.hits.push({ id: 'prop:sandcastle', x: x - 8, y: 0, w: 17, h: 17, label: 'Homokvár' });
    }
  };

  // ---- A betűk a szerver égboltjáról -----------------------------------------------------------
  const SKY_LETTERS = {
    S: ['#####', '#....', '#....', '#####', '....#', '....#', '#####'],
    O: ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    A: ['#####', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    R: ['####.', '#...#', '#...#', '####.', '#..#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#']
  };

  function hexAlpha(col, a) { const c = typeof col === 'string' ? hx(col) : col; return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }

  // ---- Világ ------------------------------------------------------------------------------------
  class World {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts || {};
      this.themeKey = 'solaryn';
      this.camX = VIEW_POS.home;
      this.camTarget = this.camX;
      this.view = 'home';
      this.timeOverride = null;
      this.weatherOverride = null;
      this.particles = [];
      this.fx = [];
      this.hits = [];
      this.lights = [];
      this.smoke = [];
      this.critters = [];
      this.blocks = [];
      this.t = 0;
      this.frame = 0;
      this.showLetters = true;
      this.placed = this.loadPlaced();
      this.placedGlows = [];
      this.undoStack = [];
      this.creative = false;
      this.hd = true;
      this.S = 1;
      this.sprites = new Map();
      this.shadeCache = new Map();
      this.rubble = [];
      this.rubbleH = {};
      this.friends = [];
      this.tags = [];
      this.costMs = 0;
      this.slow = 0;
      this.lettersDirty = true;
      this.hover = null;
      this.listeners = {};
      this.doll = null;
      this.dollWalk = 0;
      this.running = false;
      this.lastBuildKey = '';
      this.resize();
      this.bind();
    }

    on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
    emit(ev, data) { (this.listeners[ev] || []).forEach((f) => f(data)); }

    cfg() { return THEMES[this.themeKey] || THEMES.solaryn; }

    solarNow() {
      const base = solar();
      const c = this.cfg();
      const mode = this.timeOverride || (c.time !== 'real' ? c.time : null);
      if (mode) return fixedSolar(mode, base);
      return base;
    }

    env() {
      const sol = this.solarNow();
      const w = sol.weights;
      const c = this.cfg();
      const amb = c.ambient || [0, 1, 2].map((i) => Object.keys(w).reduce((s, k) => s + AMBIENT[k][i] * w[k], 0));
      const ramps = Object.assign({}, RAMPS, c.sky || {});
      const horizon = rampColor(ramps, w, 1);
      const night = c.underwater ? 0.6 : w.night + (w.dusk + w.dawn) * 0.45;
      return { sol, amb, ramps, horizon, night, w };
    }

    mats() {
      const c = this.cfg();
      const m = Object.assign({}, MAT, c.mat || {});
      if (c.snow) m.snowCap = '#eef6fc';
      return m;
    }

    resize() {
      const fixed = this.opts.fixed;
      if (fixed) {
        this.S = 1; this.scale = 1; this.hd = false; this.dpr = 1;
        this.W = fixed.w; this.H = fixed.h;
        this.canvas.width = fixed.w; this.canvas.height = fixed.h;
        this.ground = this.H - (this.opts.groundRows || 16);
        return;
      }
      const rect = this.canvas.getBoundingClientRect();
      const cw = Math.max(1, Math.round(rect.width || this.canvas.clientWidth || window.innerWidth));
      const ch = Math.max(1, Math.round(rect.height || this.canvas.clientHeight || 200));
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const devW = Math.round(cw * dpr), devH = Math.round(ch * dpr);
      const px = Math.max(1, Math.round(clamp(cw / 480, 2, 6) * dpr));
      const W = Math.ceil(devW / px), H = Math.ceil(devH / px);
      const S = this.hd ? px : 1;
      const cvW = this.hd ? devW : W, cvH = this.hd ? devH : H;
      if (this.px === px && this.S === S && this.W === W && this.H === H && this.canvas.width === cvW && this.canvas.height === cvH) return;
      this.px = px;
      this.dpr = dpr;
      this.S = S;
      this.scale = px / dpr;
      this.W = W;
      this.H = H;
      this.cssH = ch;
      this.fadeSnap = null;
      this.canvas.width = cvW;
      this.canvas.height = cvH;
      this.ground = this.H - (this.opts.groundRows || 16);
      this.groundCss = ch - this.ground * this.scale;
      this.skyKey = '';
      if (this.env0) this.seedParticles(true);
      if (this.layers) this.render(0);
    }

    // --- Rétegek felépítése
    rebuild() {
      if (this.layers && this.running && !motionOff() && this.canvas.width > 1) {
        const snap = document.createElement('canvas');
        snap.width = this.canvas.width; snap.height = this.canvas.height;
        snap.getContext('2d').drawImage(this.canvas, 0, 0);
        this.fadeSnap = snap;
        this.fadeA = 1;
      }
      const env = this.env();
      this.env0 = env;
      this.sprites = new Map();
      this.shadeCache = new Map();
      const c = this.cfg();
      const mat = this.mats();
      const lights = [];
      const hits = [];
      this.lights = lights;
      this.hits = hits;
      this.smoke = [];
      this.fire = null;
      this.portal = null;
      const amb = env.amb;
      const mkTint = (haze) => (col) => {
        const lit = [col[0] * amb[0], col[1] * amb[1], col[2] * amb[2]];
        return haze ? mixc(lit, env.horizon, haze) : lit;
      };
      const seed = 1234 + Object.keys(THEMES).indexOf(this.themeKey) * 77;

      // távoli hegyek
      const far = new Layer(900, 120, 40, 0.1); far.tint = mkTint(0.56);
      this.ridge(far, seed + 1, 52, 34, 4, 3, mat.mount, c.snow ? '#e8f2fa' : null);
      const far2 = new Layer(1100, 120, 40, 0.2); far2.tint = mkTint(0.36);
      this.ridge(far2, seed + 2, 32, 22, 3, 2, mat.mount2, null);

      // lebegő szigetek, ahogy a spawn fölött is
      const isl = new Layer(1000, 150, 10, 0.3); isl.tint = mkTint(0.3);
      if (!c.sea) this.islands(isl, seed + 3, mat, env, lights);

      // közepes erdő
      const mid = new Layer(1400, 110, 40, 0.55); mid.tint = mkTint(0.16);
      this.forest(mid, seed + 4, mat, c);

      // fő sík
      const main = new Layer(WORLD_LEN, 130, 60, 1); main.tint = mkTint(0);
      const W = { lights: [], hits, smoke: this.smoke, env, flags: [] };
      const rand = rng(seed + 5);
      this.groundBand(main, mat, rand, c);
      buildTown(W, main, mat, env, rand, c);
      this.fire = W.fire; this.portal = W.portal;
      this.lightsMain = W.lights;
      this.scatter(main, W, mat, rand, c);
      this.flags = W.flags;
      this.mat = mat;
      this.placedLayer = new Layer(WORLD_LEN, 130, 0, 1);
      this.placedLayer.tint = mkTint(0);
      this.placedGlows = [];
      this.placed.forEach((b) => {
        this.paintBlock(b);
        if (b.k === 'lamp') this.placedGlows.push(b);
      });

      this.layers = { far, far2, isl, mid, main };
      this.mat = mat;
      this.buildGlow();
      this.buildStars(seed);
      this.buildClouds(seed, env, c);
      this.buildLetters(env, c);
      this.buildCritters(c);
      this.seedParticles(true);
      this.skyKey = '';
      this.portalTile = null;
      this.lettersDirty = true;
      this.emit('rebuilt', { env });
    }

    ridge(l, seed, base, amp, stepW, stepH, cols, cap) {
      const rand = rng(seed);
      const L = l.len;
      const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
      const fr = [2, 3, 5, 9, 17];
      const hAt = (x) => {
        let v = 0;
        fr.forEach((f, i) => { v += Math.sin((x / L) * 6.28318 * f + ph[i]) / (i * 0.8 + 1); });
        const h = base + amp * v * 0.55;
        return Math.max(4, Math.round(h / stepH) * stepH);
      };
      for (let x = 0; x < L; x += stepW) {
        const h = hAt(x), nxt = hAt(x + stepW);
        l.r(x, 0, stepW, h, cols[0]);
        l.r(x, Math.max(0, h - 4), stepW, 4, nxt >= h ? cols[1] : cols[2]);
        if (cap && h > base + amp * 0.2) l.r(x, h - 3, stepW, 3, cap);
      }
    }

    islands(l, seed, mat, env, lights) {
      const rand = rng(seed);
      const on = env.night > 0.25;
      this.islandLights = [];
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 110 + Math.floor(rand() * 50);
        const y = 62 + Math.floor(rand() * 42);
        const w = 12 + Math.floor(rand() * 12);
        for (let j = 0; j < 6; j++) {
          const iw = w - j * 3;
          if (iw <= 0) break;
          l.r(x - (iw >> 1), y - j * 2 - 2, iw, 2, j === 0 ? mat.stone[2] : mat.stone[j % 2 ? 1 : 3]);
        }
        l.r(x - (w >> 1), y, w, 1, mat.grass[1]);
        l.r(x - 2, y + 1, 4, 3, mat.stone[0]);
        l.r(x - 1, y + 4, 2, 2, on ? mat.lamp : '#c9b98a');
        if (on) this.islandLights.push({ x, y: y + 5, r: 12, c: mat.lamp, a: 0.65 });
      }
    }

    forest(l, seed, mat, c) {
      const rand = rng(seed);
      const L = l.len;
      const p = [rand() * 6.28, rand() * 6.28];
      const hillAt = (x) => Math.round(8 + 5 * Math.sin((x / L) * 6.28318 * 3 + p[0]) + 3 * Math.sin((x / L) * 6.28318 * 7 + p[1]));
      for (let x = 0; x < L; x += 2) {
        const h = hillAt(x);
        l.r(x, 0, 2, h, mat.hill[0]);
        l.r(x, h - 2, 2, 2, mat.hill[1]);
        if (rand() < 0.25) l.r(x, h - 3, 1, 1, mat.hill[1]);
      }
      if (c.sea) return;
      const kinds = c.trees || ['oak'];
      const step = 8 / (c.treeDensity || 1);
      for (let x = 0; x < L; x += step + rand() * step) {
        const k = kinds[Math.floor(rand() * kinds.length)];
        const s = 1 + Math.floor(rand() * 3);
        l.ctx.save();
        l.base -= hillAt(x) - 1;
        const fn = S[k === 'bigoak' ? 'oak' : k];
        fn(l, Math.round(x), s, mat, rand);
        l.base += hillAt(x) - 1;
        l.ctx.restore();
      }
    }

    groundBand(l, mat, rand, c) {
      const L = l.len;
      for (let x = 0; x < L; x++) {
        const bump = Math.sin(x / 37) + Math.sin(x / 11) > 1.2 ? 1 : 0;
        l.r(x, -1, 1, 2 + bump, mat.grass[rand() < 0.3 ? 2 : rand() < 0.5 ? 1 : 0]);
        l.r(x, 1 + bump - 1, 1, 1, rand() < 0.5 ? mat.grassTop : mat.grass[1]);
        l.r(x, -3 - (rand() < 0.4 ? 1 : 0), 1, 2 + 1, mat.grass[2]);
      }
      for (let y = -60; y < -3; y++) {
        for (let x = 0; x < L; x += 2) {
          const n = rand();
          l.r(x, y, 2, 1, mat.dirt[n < 0.55 ? 0 : n < 0.78 ? 1 : n < 0.93 ? 2 : 3]);
        }
      }
      const plazas = [[-60, 120], [240, 130], [550, 130], [890, 90], [1170, 150], [1490, 150], [1770, 110]];
      plazas.forEach(([x, w]) => {
        for (let i = 0; i < w; i += 3) {
          const edge = Math.min(i, w - i);
          if (edge < 6 && rand() < 0.5) continue;
          l.r(x + i, -1, 3, 2, mat.path[Math.floor(rand() * 3)]);
          l.r(x + i + 2, -1, 1, 2, mat.path[1]);
        }
      });
      // földbe ágyazott kövek
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(rand() * L), y = -6 - Math.floor(rand() * 52);
        l.r(x, y, 4 + Math.floor(rand() * 5), 3, mat.stone[1]);
        l.r(x + 1, y + 2, 3, 1, mat.stone[0]);
      }
      if (c.lava) {
        for (let i = 0; i < 60; i++) {
          const x = Math.floor(rand() * L), y = -6 - Math.floor(rand() * 40);
          let cx = x;
          for (let j = 0; j < 10; j++) { l.r(cx, y + (j % 3 === 0 ? 1 : 0), 2, 1, j % 4 ? '#ff6a2a' : '#ffb43a'); cx += 2; }
        }
      }
    }

    scatter(l, W, mat, rand, c) {
      const props = c.props || [];
      const L = l.len;
      const treeKinds = c.trees || ['oak'];
      const clear = [[-160, 330], [190, 220], [520, 180], [860, 170], [1130, 220], [1470, 190], [1750, 170]];
      const blocked = (x) => clear.some(([a, w]) => x > a && x < a + w);
      const wrap = (x) => (x < 0 ? x + L : x);
      const trees = c.sea ? 12 : 26;
      for (let i = 0; i < trees; i++) {
        const x = Math.floor(rand() * L);
        if (blocked(x) || blocked(x - L)) continue;
        const k = treeKinds[Math.floor(rand() * treeKinds.length)];
        S[k](l, x, Math.floor(rand() * 3), mat, rand);
      }
      if (c.sea) {
        // homokos part mentén sekély víz
      }
      // kellékek a helyeken kívül és a terek szélén
      let placed = 0;
      const spots = [-178, -172, 184, 196, 416, 430, 512, 700, 722, 836, 850, 1030, 1090, 1120, 1360, 1400, 1450, 1470, 1660, 1680, 1720, 1742, 1930, 1990, 2050];
      spots.forEach((x, i) => {
        if (!props.length) return;
        const kind = props[i % props.length];
        const fn = PROPS[kind];
        if (fn) fn(l, wrap(x + Math.floor(rand() * 6)), mat, rand, W);
        placed++;
      });
      // szabad kellékek a szabad szakaszokon
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(rand() * L);
        if (blocked(x) || blocked(x - L)) continue;
        const kind = props[Math.floor(rand() * props.length)];
        if (kind && ['flower', 'bush', 'fern', 'rock', 'shell', 'mushroom', 'kelp', 'coralbit'].includes(kind)) PROPS[kind](l, x, mat, rand, W);
      }
      if (props.length && c.props.includes('xmastree')) PROPS.xmastree(l, 96 + 76, mat, rand, W);
    }

    buildGlow() {
      const all = (this.lightsMain || []).concat(this.lights || []);
      this.glowSprites = new Map();
      this.glowAll = all;
      this.islandGlow = this.islandLights || [];
    }

    glowSprite(col, r) {
      const key = col + r;
      let s = this.glowSprites.get(key);
      if (s) return s;
      const c = document.createElement('canvas');
      c.width = c.height = r * 2;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, hexAlpha(col, 0.55));
      g.addColorStop(0.35, hexAlpha(col, 0.2));
      g.addColorStop(1, hexAlpha(col, 0));
      x.fillStyle = g;
      x.fillRect(0, 0, r * 2, r * 2);
      this.glowSprites.set(key, c);
      return c;
    }

    buildStars(seed) {
      const rand = rng(seed + 9);
      this.stars = [];
      for (let i = 0; i < 180; i++) {
        this.stars.push({ x: rand(), y: rand() * 0.9, b: rand(), tw: rand() < 0.2, c: rand() < 0.12 ? '#ffd9a8' : rand() < 0.15 ? '#a8c8ff' : '#ffffff', big: rand() < 0.07 });
      }
    }

    buildClouds(seed, env, c) {
      const rand = rng(seed + 11);
      const mk = (len, count, haze, big) => {
        const l = new Layer(len, 60, 0, 0);
        l.tint = (col) => mixc([col[0] * env.amb[0], col[1] * env.amb[1], col[2] * env.amb[2]], env.horizon, haze);
        for (let i = 0; i < count; i++) {
          const x = Math.floor(rand() * len);
          const y = 6 + Math.floor(rand() * 40);
          const parts = 3 + Math.floor(rand() * 4);
          let cx = x;
          for (let p = 0; p < parts; p++) {
            const w = (6 + Math.floor(rand() * 8)) * (big ? 2 : 1);
            const h = (2 + Math.floor(rand() * 2)) * (big ? 2 : 1);
            l.r(cx, y, w, h, MAT.cloud[1]);
            l.r(cx + 2, y + h, w - 4, big ? 3 : 2, MAT.cloud[0]);
            l.r(cx, y, w, 1, MAT.cloud[2]);
            cx += w - 3;
          }
        }
        return l;
      };
      const n = c.noClouds ? 0 : (c.clouds || 1);
      this.clouds = n ? [mk(1100, 9 * n, 0.25, true), mk(800, 8 * n, 0.45, false)] : [];
    }

    buildLetters(env, c, force) {
      const word = 'SOLARYN';
      const b = 4;
      if (force || !this.blocks.length) {
        this.blocks = [];
        if (force) { this.rubble = []; this.rubbleH = {}; }
        const rand = rng(77);
        let x = 0;
        for (const ch of word) {
          const g = SKY_LETTERS[ch];
          g.forEach((row, r) => {
            [...row].forEach((v, i) => {
              if (v !== '#') return;
              const lamp = rand() < 0.14;
              const tone = rand();
              this.blocks.push({ x: x + i * b, y: (6 - r) * b, lamp, tone, fall: 0, vy: 0, gone: false, ch });
            });
          });
          x += 6 * b;
        }
        this.lettersW = x - b;
        this.lettersDirty = true;
      }
      const night = env.night;
      const stone = c.underwater ? [150, 220, 210] : hx((this.mats().roof2 || MAT.roof2)[0]);
      this.letterCol = [
        mixc(mixc([214, 164, 92], stone, 0.12), [40, 30, 20], night * 0.5),
        mixc(mixc([188, 136, 70], stone, 0.12), [30, 22, 16], night * 0.5),
        mixc(mixc([236, 190, 112], stone, 0.12), [60, 44, 28], night * 0.45)
      ];
    }

    buildCritters(c) {
      const kind = c.critter || 'sheep';
      if (this.critters.length && this.critters[0].kind === kind) return;
      this.critters = [];
      const n = kind === 'fish' ? 12 : 3;
      for (let i = 0; i < n; i++) {
        const home = [-60, 70, 180][i % 3] + (i * 37) % 40;
        this.critters.push({
          kind, x: home, home, dir: i % 2 ? 1 : -1, t: Math.random() * 100, state: 'walk', jump: 0, pets: 0,
          yw: kind === 'fish' ? 18 + (i * 13) % 56 : 0, sp: 0.1 + (i % 3) * 0.05
        });
      }
    }

    seedParticles(keep) {
      const c = this.cfg();
      let kind = this.weatherOverride || c.weather;
      if (kind === 'fireflies' && this.env0 && this.env0.night < 0.3) kind = null;
      if (keep && this.particleKind === kind && this.particles.length) return;
      this.particleKind = kind;
      this.particles = [];
      if (!kind || kind === 'clear') return;
      const n = {
        snow: 160, rain: 180, embers: 60, fireflies: c.fireflies || 22, bubbles: 40, petals: 44, confetti: 70, sparkle: 44, leaves: 28
      }[kind] || 30;
      for (let i = 0; i < n; i++) this.particles.push(this.newParticle(kind, true));
    }

    newParticle(kind, anywhere) {
      const W = this.W, H = this.H, g = this.ground;
      const r = Math.random;
      switch (kind) {
        case 'snow': return { x: r() * W, y: anywhere ? r() * H : -2, vx: -0.05 + r() * 0.1, vy: 0.12 + r() * 0.3, s: r() < 0.2 ? 2 : 1, c: '#ffffff', a: 0.55 + r() * 0.45 };
        case 'rain': return { x: r() * W, y: anywhere ? r() * H : -4, vx: -0.45, vy: 3 + r() * 1.6, s: 1, c: '#a8c8ec', a: 0.35 + r() * 0.3, len: 3 + Math.floor(r() * 2) };
        case 'embers': return { x: r() * W, y: anywhere ? r() * H : g, vx: -0.1 + r() * 0.2, vy: -0.14 - r() * 0.34, s: r() < 0.2 ? 2 : 1, c: r() < 0.5 ? '#ff7a2a' : '#ffc14a', a: 0.9, life: 40 + r() * 180, age: 0 };
        case 'fireflies': return { x: r() * W, y: g - 6 - r() * (Math.min(70, g - 8)), vx: 0, vy: 0, s: 1, c: '#e6f58a', a: 1, ph: r() * 6.28, fx: r() * W, fy: r() * Math.min(70, g) };
        case 'bubbles': return { x: r() * W, y: anywhere ? r() * H : H + 4, vx: 0, vy: -0.12 - r() * 0.28, s: 2 + Math.floor(r() * 3), c: '#bff4f4', a: 0.75, ph: r() * 6.28, bubble: true };
        case 'petals': return { x: r() * W, y: anywhere ? r() * H : -2, vx: 0.08 + r() * 0.16, vy: 0.1 + r() * 0.22, s: r() < 0.3 ? 2 : 1, c: r() < 0.5 ? '#ffb3c8' : '#ffd6e2', a: 0.9, ph: r() * 6.28 };
        case 'confetti': return { x: r() * W, y: anywhere ? r() * H : -2, vx: -0.1 + r() * 0.2, vy: 0.2 + r() * 0.4, s: 2, c: ['#ffd23f', '#43d3ff', '#ff5a6e', '#7ae07a', '#c58bff'][Math.floor(r() * 5)], a: 1, ph: r() * 6.28 };
        case 'sparkle': return { x: r() * W, y: r() * g, vx: 0, vy: -0.02, s: 1, c: r() < 0.5 ? '#e6d0ff' : '#ffffff', a: 1, ph: r() * 6.28 };
        case 'leaves': return { x: r() * W, y: anywhere ? r() * H : -2, vx: -0.25 - r() * 0.2, vy: 0.14 + r() * 0.2, s: 2, c: ['#d9711f', '#a84f12', '#e8a23a'][Math.floor(r() * 3)], a: 1, ph: r() * 6.28 };
        default: return { x: 0, y: 0, vx: 0, vy: 0, s: 1, c: '#fff', a: 0 };
      }
    }

    // --- Ég
    q(v) { return Math.round(v * this.S) / this.S; }
    pY(para) { return this.q((this.scrollLow || 0) * (1 - para) * 0.4); }

    paintSky() {
      const env = this.env0;
      const key = [this.H, this.W, this.themeKey, Math.round(env.sol.hour * 6), this.timeOverride].join('|');
      if (key === this.skyKey && this.skyCanvas) return;
      this.skyKey = key;
      const strip = document.createElement('canvas');
      strip.width = 4; strip.height = this.H;
      const x = strip.getContext('2d');
      const bands = 26;
      const top = Math.max(1, this.ground);
      for (let y = 0; y < this.H; y++) {
        const t = clamp(y / top, 0, 1);
        const q = t * bands;
        const b0 = Math.floor(q);
        const f = q - b0;
        const ca = css(rampColor(env.ramps, env.w, b0 / bands));
        const cb = css(rampColor(env.ramps, env.w, (b0 + 1) / bands));
        for (let px = 0; px < 4; px++) {
          const dith = [[0.2, 0.7], [0.9, 0.45]][y % 2][px % 2];
          x.fillStyle = f > dith ? cb : ca;
          x.fillRect(px, y, 1, 1);
        }
      }
      const c = document.createElement('canvas');
      c.width = this.W; c.height = this.H;
      const cx = c.getContext('2d');
      cx.fillStyle = cx.createPattern(strip, 'repeat-x');
      cx.fillRect(0, 0, this.W, this.H);
      this.skyCanvas = c;
    }

    camOffset(para) {
      return this.camX * para - this.W * 0.5;
    }

    drawStrip(c, L, off, y) {
      const ctx = this.ctx;
      const ox = this.q(((off % L) + L) % L);
      const src = Math.min(L, Math.floor(ox));
      const frac = ox - src;
      const need = this.W + 2;
      const w1 = Math.min(L - src, need);
      if (w1 > 0) ctx.drawImage(c, src, 0, w1, c.height, -frac, y, w1, c.height);
      if (w1 < need) ctx.drawImage(c, 0, 0, Math.min(L, need - w1), c.height, w1 - frac, y, Math.min(L, need - w1), c.height);
    }

    drawLayer(layer) {
      this.drawStrip(layer.c, layer.len, this.camOffset(layer.para), this.ground - layer.base + this.pY(layer.para));
    }

    toScreen(worldX, para) {
      const L = WORLD_LEN;
      const off = this.camOffset(para == null ? 1 : para);
      let sx = worldX - off;
      if (para == null || para === 1) {
        sx = ((sx % L) + L) % L;
        if (sx > L - 200) sx -= L;
      }
      return sx;
    }

    sprite(key, size, paint) {
      let s = this.sprites.get(key);
      if (s) return s;
      s = document.createElement('canvas');
      s.width = s.height = size;
      paint(s.getContext('2d'));
      this.sprites.set(key, s);
      return s;
    }

    drawBody(env) {
      const ctx = this.ctx;
      const sol = env.sol;
      const c = this.cfg();
      this.sunRect = null;
      this.moonRect = null;
      if (c.noBody) return;
      const arcH = Math.max(36, (this.ground - 16) * 0.74);
      const py = this.pY(0.05);
      if (sol.sunP > -0.06 && sol.sunP < 1.06) {
        const x = lerp(this.W * 0.06, this.W * 0.94, clamp(sol.sunP, 0, 1)) - this.camX * 0.005;
        const y = this.ground - Math.sin(clamp(sol.sunP, 0, 1) * Math.PI) * arcH - 2 + py;
        const r = c.bigSun ? 13 : 9;
        if (this.sunWobble) {
          this.sunWobbleY = Math.sin(this.t * 34) * this.sunWobble;
          this.sunWobble *= Math.pow(0.8, this.lastDt || 0);
          if (this.sunWobble < 0.1) { this.sunWobble = 0; this.sunWobbleY = 0; }
        }
        const frame = Math.floor(this.t * 2.5) % 6;
        const size = (r + 9) * 2;
        const s = this.sprite(`sun${r}_${frame}`, size, (x2) => this.paintSun(x2, r + 9, r, frame));
        ctx.drawImage(s, this.q(x - size / 2), this.q(y + (this.sunWobbleY || 0) - size / 2));
        this.sunRect = { x: x - r - 4, y: y - r - 4, w: r * 2 + 8, h: r * 2 + 8 };
      }
      if (sol.moonP > -0.02 && sol.moonP < 1.02) {
        const x = lerp(this.W * 0.1, this.W * 0.9, clamp(sol.moonP, 0, 1));
        const y = this.ground - Math.sin(clamp(sol.moonP, 0, 1) * Math.PI) * arcH - 2 + py;
        const r = c.moon === 'big' ? 15 : c.moon === 'blood' ? 11 : 8;
        const size = (r + 10) * 2;
        const s = this.sprite(`moon${r}_${c.moon || ''}_${sol.phase.toFixed(2)}`, size, (x2) => this.paintMoon(x2, r + 10, r, sol.phase, c));
        ctx.drawImage(s, this.q(x - size / 2), this.q(y - size / 2));
        this.moonRect = { x: x - r - 3, y: y - r - 3, w: r * 2 + 6, h: r * 2 + 6 };
      }
    }

    paintSun(ctx, o, r, frame) {
      const col = this.cfg().underwater ? '#fff2c0' : '#ffd25a';
      const hi = '#fff6d0', mid = '#ffb732';
      ctx.fillStyle = hexAlpha(col, 0.16);
      for (let d = r + 7; d > r; d -= 3) {
        for (let a = -d; a <= d; a++) {
          const hw = Math.round(Math.sqrt(d * d - a * a));
          if ((a & 1) === 0) ctx.fillRect(o - hw, o + a, hw * 2, 1);
        }
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.28318 + (frame / 6) * (6.28318 / 12);
        const long = i % 2 === 0;
        const r1 = r + 2, r2 = r + (long ? 7 : 4);
        ctx.fillStyle = long ? col : mid;
        for (let k = r1; k < r2; k++) ctx.fillRect(Math.round(o + Math.cos(a) * k), Math.round(o + Math.sin(a) * k), 1, 1);
      }
      for (let a = -r; a <= r; a++) {
        const hw = Math.round(Math.sqrt(r * r - a * a));
        ctx.fillStyle = a < -r * 0.3 ? hi : a < r * 0.45 ? col : mid;
        ctx.fillRect(o - hw, o + a, hw * 2, 1);
      }
      ctx.fillStyle = hi;
      ctx.fillRect(o - Math.round(r * 0.5), o - Math.round(r * 0.5), Math.round(r * 0.4), 1);
    }

    paintMoon(ctx, o, r, phase, c) {
      const blood = c.moon === 'blood';
      const big = c.moon === 'big';
      const lit = blood ? '#e8423a' : big ? '#f0a23c' : '#e9edf6';
      const dark = blood ? '#7c1a1a' : big ? '#a86420' : '#7f89a6';
      const crater = blood ? '#b42a26' : big ? '#c98230' : '#b4bccf';
      ctx.fillStyle = hexAlpha(lit, 0.1);
      for (let d = r + 8; d > r; d -= 3) {
        for (let a = -d; a <= d; a++) {
          const hw = Math.round(Math.sqrt(d * d - a * a));
          if ((a & 1) === 0) ctx.fillRect(o - hw, o + a, hw * 2, 1);
        }
      }
      const p = blood || big ? 0.5 : phase;
      const k = Math.cos(p * 6.28318);
      const waxing = p < 0.5;
      for (let a = -r; a <= r; a++) {
        const hw = Math.sqrt(Math.max(0, r * r - a * a));
        const edge = hw * k;
        const left = waxing ? edge : -hw;
        const right = waxing ? hw : -edge;
        ctx.fillStyle = hexAlpha(dark, 0.55);
        ctx.fillRect(Math.round(o - hw), o + a, Math.round(hw * 2), 1);
        ctx.fillStyle = lit;
        ctx.fillRect(Math.round(o + left), o + a, Math.max(0, Math.round(right - left)), 1);
      }
      ctx.fillStyle = crater;
      const n = Math.max(1, Math.round(r / 5));
      ctx.fillRect(o - n * 2, o - n, n * 2, n);
      ctx.fillRect(o + n, o + n, n + 1, n);
      ctx.fillRect(o - n, o + n * 2, n, n);
    }

    drawStars(env) {
      const ctx = this.ctx;
      const c = this.cfg();
      if (c.noStars) return;
      const vis = clamp(env.night * 1.4 - 0.3, 0, 1);
      if (vis <= 0.02) return;
      const shift = this.camX * 0.02;
      const py = this.pY(0.02);
      for (const s of this.stars) {
        const x = (((s.x * this.W * 1.5 - shift) % this.W) + this.W) % this.W;
        const y = s.y * this.ground + py;
        let a = (0.3 + s.b * 0.7) * vis;
        if (s.tw) a *= 0.55 + 0.45 * Math.sin(this.t * 1.6 + s.b * 40);
        ctx.fillStyle = hexAlpha(s.c, a);
        const bx = this.q(x), by = this.q(y);
        ctx.fillRect(bx, by, 1, 1);
        if (s.big) {
          ctx.fillStyle = hexAlpha(s.c, a * 0.4);
          ctx.fillRect(bx - 1, by, 3, 1);
          ctx.fillRect(bx, by - 1, 1, 3);
        }
      }
    }

    // A sarki fényt külön, ritkábban festjük, a képernyőre minden képkockán kerül.
    drawAurora(dt) {
      if (!this.auroraC || this.auroraC.width !== this.W || this.auroraC.height !== this.H) {
        this.auroraC = document.createElement('canvas');
        this.auroraC.width = this.W; this.auroraC.height = this.H;
        this.auroraT = 99;
      }
      this.auroraT += dt;
      if (this.auroraT >= 1) {
        this.auroraT = 0;
        const x2 = this.auroraC.getContext('2d');
        x2.clearRect(0, 0, this.W, this.H);
        const t = this.t * 0.25;
        const bands = [['#39f0b0', 0.32, 0.20], ['#5a9cff', 0.22, 0.34], ['#c37aff', 0.14, 0.12]];
        bands.forEach(([col, alpha, top], bi) => {
          for (let x = 0; x < this.W; x += 3) {
            const nx = x / this.W;
            const y0 = this.ground * (top + 0.08 * Math.sin(nx * 7 + t + bi * 2) + 0.03 * Math.sin(nx * 21 - t * 2));
            const h = this.ground * (0.18 + 0.09 * Math.sin(nx * 11 + t * 1.3 + bi));
            const a = alpha * (0.55 + 0.45 * Math.sin(nx * 17 + t * 2.1 + bi));
            for (let i = 0; i < h; i += 3) {
              const fade = a * (1 - i / h);
              if (fade < 0.02) break;
              x2.fillStyle = hexAlpha(col, fade);
              x2.fillRect(x, Math.round(y0 + i), 3, 3);
            }
          }
        });
      }
      this.ctx.drawImage(this.auroraC, 0, 0);
    }

    paintLetters() {
      const b = 4;
      if (!this.lettersC) {
        this.lettersC = document.createElement('canvas');
        this.lettersC.width = this.lettersW + 8;
        this.lettersC.height = 32;
      }
      const x2 = this.lettersC.getContext('2d');
      x2.clearRect(0, 0, this.lettersC.width, this.lettersC.height);
      const glow = this.env0.night > 0.3;
      for (const bl of this.blocks) {
        if (bl.gone || bl.falling) continue;
        const x = bl.x, y = 24 - bl.y;
        const col = this.letterCol[bl.tone < 0.45 ? 0 : bl.tone < 0.8 ? 1 : 2];
        x2.fillStyle = css(col);
        x2.fillRect(x, y, b, b);
        x2.fillStyle = css(mixc(col, [255, 255, 255], 0.2));
        x2.fillRect(x, y, b, 1);
        x2.fillStyle = css(mixc(col, [0, 0, 0], 0.32));
        x2.fillRect(x + b - 1, y + 1, 1, b - 1);
        x2.fillRect(x, y + b - 1, b, 1);
        if (bl.lamp && glow) {
          x2.fillStyle = '#ffd98a';
          x2.fillRect(x + 1, y + 1, 2, 2);
        }
      }
      this.lettersDirty = false;
    }

    dropBlock(bl) {
      if (bl.falling || bl.gone) return;
      bl.falling = true;
      bl.vy = 0;
      bl.fall = 0;
      this.lettersDirty = true;
    }

    drawLetters(env, dt) {
      if (!this.showLetters || this.ground < 96) return;
      const ctx = this.ctx;
      const dc = (((this.camX + WORLD_LEN / 2) % WORLD_LEN) + WORLD_LEN) % WORLD_LEN - WORLD_LEN / 2;
      const off = dc * 0.22 - this.W * 0.5;
      const anchor = this.opts.lettersAt != null && this.W > 340 ? (this.opts.lettersAt - 0.5) * this.W : 0;
      const baseX = this.q(-off - this.lettersW / 2 + anchor);
      const baseY = this.q(this.ground * 0.13 + this.pY(0.2) + Math.sin(this.t * 0.7) * 1.2);
      this.lettersPos = { x: baseX, y: baseY };
      if (baseX > this.W || baseX + this.lettersW < 0) return;
      if (this.lettersDirty || !this.lettersC) this.paintLetters();
      ctx.drawImage(this.lettersC, baseX, baseY);
      const glow = env.night > 0.3;
      const b = 4;
      for (const bl of this.blocks) {
        if (bl.gone) continue;
        if (bl.falling) {
          bl.vy += 0.16 * dt;
          bl.fall += bl.vy * dt;
          const y = baseY + 24 - bl.y + bl.fall;
          const x = baseX + bl.x;
          if (y > this.ground - 4) {
            bl.gone = true;
            this.landRubble(x, bl.tone);
            continue;
          }
          const col = this.letterCol[bl.tone < 0.45 ? 0 : bl.tone < 0.8 ? 1 : 2];
          ctx.fillStyle = css(col);
          ctx.fillRect(this.q(x), this.q(y), b, b);
          ctx.fillStyle = css(mixc(col, [255, 255, 255], 0.2));
          ctx.fillRect(this.q(x), this.q(y), b, 1);
        } else if (bl.lamp && glow) {
          const s = this.glowSprite('#ffc65e', 8);
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.72 + 0.28 * Math.sin(this.t * 2.2 + bl.x);
          ctx.drawImage(s, baseX + bl.x + 2 - 8, baseY + 24 - bl.y + 2 - 8);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }

    // A leeső betűblokk a földön marad, és kupacba rakódik.
    landRubble(screenX, tone) {
      const L = WORLD_LEN;
      const wx = ((screenX + this.camOffset(1)) % L + L) % L;
      const col = Math.round(wx / 4);
      this.rubbleH[col] = (this.rubbleH[col] || 0) + 1;
      this.rubble.push({ x: col * 4, y: (this.rubbleH[col] - 1) * 4, tone });
      this.burst(screenX + 2, this.ground - 1, ['#c9b98a', '#8a7a5a', '#e8dcc0'], 8, { v: 0.7, up: 0.4, life: 16, g: 0.05 });
      this.emit('land', {});
    }

    drawRubble() {
      if (!this.rubble.length) return;
      const ctx = this.ctx;
      const amb = this.env0.amb;
      for (const r of this.rubble) {
        const sx = this.toScreen(r.x);
        if (sx < -6 || sx > this.W + 6) continue;
        const col = mixc([200, 150, 84], [0, 0, 0], 0);
        const c = [col[0] * amb[0], col[1] * amb[1], col[2] * amb[2]];
        const x = this.q(sx), y = this.ground - r.y - 4;
        ctx.fillStyle = css(c);
        ctx.fillRect(x, y, 4, 4);
        ctx.fillStyle = css(mixc(c, [255, 255, 255], 0.18));
        ctx.fillRect(x, y, 4, 1);
        ctx.fillStyle = css(mixc(c, [0, 0, 0], 0.3));
        ctx.fillRect(x + 3, y + 1, 1, 3);
      }
    }

    drawPortal() {
      if (!this.portal) return;
      const ctx = this.ctx;
      const p = this.portal;
      const sx = this.q(this.toScreen(p.x));
      if (sx <= this.W && sx + p.w >= 0) {
        if (!this.portalTile) {
          const size = 32;
          const t = document.createElement('canvas');
          t.width = t.height = size;
          const x2 = t.getContext('2d');
          const rnd = rng(911);
          const cols = this.mat.portal;
          for (let y = 0; y < size; y += 2) {
            for (let x = 0; x < size; x++) {
              const n = rnd();
              x2.fillStyle = cols[n < 0.5 ? 0 : n < 0.8 ? 1 : n < 0.95 ? 2 : 3];
              x2.fillRect(x, y, 1, 2);
            }
          }
          this.portalTile = t;
          const path = new Path2D();
          for (let i = 0; i < p.w; i++) {
            const dx = i - p.r;
            const top = Math.round(Math.sqrt(Math.max(0, p.r * p.r - dx * dx))) + p.base;
            path.rect(i, -top, 1, top);
          }
          this.portalPath = path;
        }
        ctx.save();
        ctx.translate(sx, this.ground);
        ctx.clip(this.portalPath);
        const a = (this.t * 9) % 32, b = (this.t * 5) % 32;
        for (let x = 0; x < p.w; x += 32) {
          for (let y = -64; y < 32; y += 32) ctx.drawImage(this.portalTile, x, y + a);
        }
        ctx.globalAlpha = 0.4;
        for (let x = -7; x < p.w; x += 32) {
          for (let y = -32; y < 64; y += 32) ctx.drawImage(this.portalTile, x, y - b);
        }
        ctx.restore();
      }
      if (this.portalFlash) {
        ctx.fillStyle = hexAlpha(this.mat.portal[3], this.portalFlash);
        ctx.fillRect(0, 0, this.W, this.H);
        this.portalFlash = Math.max(0, this.portalFlash - 0.12 * (this.lastDt || 0));
      }
    }

    drawFlags() {
      if (!this.flags || !this.flags.length) return;
      const ctx = this.ctx;
      for (const f of this.flags) {
        const sx = this.toScreen(f.x);
        if (sx < -20 || sx > this.W + 20) continue;
        const ox = this.q(sx);
        for (let i = 0; i < f.w; i++) {
          const amp = (i + 1) / f.w * 1.5;
          const oy = this.q(Math.sin(this.t * 3 + f.x * 0.3 - i * 0.7) * amp);
          ctx.fillStyle = i === f.w - 1 || Math.sin(this.t * 3 + f.x * 0.3 - i * 0.7) < -0.5 ? f.d : f.c;
          ctx.fillRect(ox + i, this.ground - f.y - f.h + oy, 1, f.h);
        }
      }
    }

    drawGlow(env) {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'lighter';
      const nightOn = env.night > 0.2;
      for (const g of this.glowAll) {
        if (!g.always && !nightOn) continue;
        const sx = this.toScreen(g.x);
        if (sx < -40 || sx > this.W + 40) continue;
        let a = g.a;
        if (g.tw) a *= 0.72 + 0.28 * Math.sin(this.t * 5 + g.x);
        else a *= 0.92 + 0.08 * Math.sin(this.t * 2.2 + g.x * 3);
        ctx.globalAlpha = clamp(a, 0, 1);
        ctx.drawImage(this.glowSprite(g.c, g.r), this.q(sx - g.r), this.ground - g.y - g.r);
      }
      for (const b of this.placedGlows || []) {
        const sx = this.toScreen(b.x + 2);
        if (sx < -30 || sx > this.W + 30) continue;
        ctx.globalAlpha = 0.8;
        ctx.drawImage(this.glowSprite('#ffc65e', 18), this.q(sx - 18), this.ground - b.y - 2 - 18);
      }
      if (this.ground >= 120) {
        const py = this.pY(0.3);
        for (const g of this.islandGlow) {
          const off = this.camOffset(0.3);
          const L = 1000;
          const sx = (((g.x - off) % L) + L) % L;
          if (sx > this.W + 20) continue;
          ctx.globalAlpha = g.a;
          ctx.drawImage(this.glowSprite(g.c, g.r), this.q(sx - g.r), this.ground - g.y - g.r + py);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawCritters(dt) {
      const ctx = this.ctx;
      const g = this.ground;
      const amb = this.env0.amb;
      const cache = this.shadeCache;
      const shade = (hexc) => {
        let v = cache.get(hexc);
        if (!v) { const c = hx(hexc); v = css([c[0] * amb[0], c[1] * amb[1], c[2] * amb[2]]); cache.set(hexc, v); }
        return v;
      };
      for (const a of this.critters) {
        a.t += dt;
        if (a.kind === 'fish') {
          a.x += a.dir * a.sp * 2 * dt;
          if (Math.abs(a.x - a.home) > 120) a.dir *= -1;
        } else if (a.state === 'walk') {
          a.x += a.dir * a.sp * dt;
          if (Math.abs(a.x - a.home) > 34 || Math.random() < 0.002 * dt) a.dir *= -1;
          if (Math.random() < 0.003 * dt) { a.state = 'idle'; a.idle = 30 + Math.random() * 70; }
        } else {
          a.idle -= dt;
          if (a.idle <= 0) a.state = 'walk';
        }
        if (a.jump > 0) a.jump = Math.max(0, a.jump - 0.7 * dt);
        const raw = this.toScreen(a.x);
        if (raw < -14 || raw > this.W + 14) { a.rect = null; continue; }
        const sx = this.q(raw);
        const jy = this.q(Math.sin((a.jump / 8) * Math.PI) * 5);
        const yw = a.yw ? this.q(a.yw + Math.sin(a.t * 0.08 + a.home) * 2) : 0;
        const leg = a.state === 'walk' ? Math.floor(a.t / 2) % 2 : 0;
        const d = a.dir;
        const R = (x, y, w, h, col) => {
          const px = d > 0 ? sx + x : sx - x - w;
          ctx.fillStyle = shade(col);
          ctx.fillRect(px, g - y - h - jy - yw, w, h);
        };
        switch (a.kind) {
          case 'sheep':
            R(-5, 2, 10, 6, '#efece4'); R(-5, 3, 10, 1, '#d6d2c6'); R(-6, 3, 1, 3, '#d6d2c6');
            R(4, 5, 4, 4, '#4a4238'); R(6, 7, 1, 1, '#fff6e0'); R(3, 7, 1, 2, '#efece4');
            if (leg) { R(-2, 0, 2, 2, '#3a342c'); R(0, 0, 2, 2, '#3a342c'); } else { R(-4, 0, 2, 2, '#3a342c'); R(2, 0, 2, 2, '#3a342c'); }
            break;
          case 'cat':
            R(-5, 2, 9, 3, '#1c1a22'); R(3, 4, 4, 4, '#1c1a22'); R(3, 8, 1, 1, '#1c1a22'); R(6, 8, 1, 1, '#1c1a22');
            R(5, 6, 1, 1, '#d8f07a'); R(-6, 4, 1, 4, '#1c1a22');
            R(leg ? -3 : -4, 0, 1, 2, '#1c1a22'); R(leg ? 1 : 2, 0, 1, 2, '#1c1a22');
            break;
          case 'fox':
            R(-4, 2, 8, 3, '#d9711f'); R(3, 4, 4, 4, '#d9711f'); R(6, 4, 2, 2, '#f4e8d8'); R(3, 8, 1, 1, '#d9711f'); R(6, 8, 1, 1, '#d9711f');
            R(-8, 3, 4, 2, '#d9711f'); R(-9, 3, 2, 2, '#f4e8d8'); R(5, 6, 1, 1, '#1a1208');
            R(leg ? -2 : -3, 0, 1, 2, '#2a1a0c'); R(leg ? 1 : 2, 0, 1, 2, '#2a1a0c');
            break;
          case 'penguin':
            R(-3, 0, 6, 9, '#1c222c'); R(-1, 1, 4, 6, '#f0f4f8'); R(1, 7, 1, 1, '#f0f4f8'); R(3, 6, 2, 1, '#e8a23a');
            R(leg ? -3 : -2, 0, 2, 1, '#e8a23a'); R(leg ? 2 : 1, 0, 2, 1, '#e8a23a');
            break;
          case 'bunny':
            R(-4, 1, 7, 5, '#f4f0e8'); R(2, 4, 4, 4, '#f4f0e8'); R(2, 8, 1, 3, '#f4f0e8'); R(4, 8, 1, 3, '#f4f0e8'); R(3, 9, 1, 1, '#f4b8c8');
            R(4, 6, 1, 1, '#1a1208'); R(-5, 3, 1, 2, '#ffffff'); R(-3, 0, 2, 1, '#d8d4c8'); R(1, 0, 2, 1, '#d8d4c8');
            break;
          case 'crab':
            R(-4, 1, 9, 4, '#e8553a'); R(-6, 3, 2, 3, '#e8553a'); R(5, 3, 2, 3, '#e8553a'); R(-2, 5, 1, 1, '#1a1208'); R(2, 5, 1, 1, '#1a1208');
            R(-5, 0, 1, 1, '#c8452f'); R(5, 0, 1, 1, '#c8452f'); R(-2, 0, 1, 1, '#c8452f'); R(2, 0, 1, 1, '#c8452f');
            break;
          case 'fish': {
            const fc = ['#ffb43a', '#ff7a8a', '#7ae0d0', '#f4f0a8'][a.home & 3];
            R(-3, 1, 7, 3, fc); R(-2, 0, 5, 5, fc); R(-5, 0, 2, 5, fc); R(2, 2, 1, 1, '#14202a');
            break;
          }
          default: break;
        }
        a.rect = { x: raw - 8, y: g - 12 - jy - yw, w: 16, h: 13 };
      }
    }

    drawFire() {
      if (!this.fire) return;
      const ctx = this.ctx;
      const raw = this.toScreen(this.fire.x);
      if (raw < -10 || raw > this.W + 10) return;
      const sx = this.q(raw);
      const g = this.ground - 2;
      for (let i = 0; i < 5; i++) {
        const k = 1 - Math.abs(i - 2) / 3;
        const h = this.q((3 + 5 * k) * (0.72 + 0.28 * Math.sin(this.t * 11 + i * 1.9)));
        const x = sx - 3 + i * 1.5;
        ctx.fillStyle = '#e8501f';
        ctx.fillRect(x, g - h, 1.5, h);
        ctx.fillStyle = '#ff9a2a';
        ctx.fillRect(x, g - h * 0.72, 1.5, h * 0.72);
        ctx.fillStyle = '#ffe07a';
        ctx.fillRect(x, g - h * 0.34, 1.5, h * 0.34);
      }
    }

    drawSmoke() {
      const ctx = this.ctx;
      const amb = this.env0.amb;
      const col = css([180 * amb[0], 180 * amb[1], 186 * amb[2]]);
      ctx.fillStyle = col;
      for (const s of this.smoke) {
        const sx = this.toScreen(s.x);
        if (sx < -10 || sx > this.W + 10) continue;
        for (let i = 0; i < 6; i++) {
          const p = (this.t * 0.22 + i / 6 + s.x * 0.013) % 1;
          const y = this.ground - s.y - p * 26;
          const x = sx + Math.sin(p * 7 + s.x) * (1 + p * 3.4);
          ctx.globalAlpha = (1 - p) * 0.42;
          const sz = p < 0.4 ? 1 : 2;
          ctx.fillRect(this.q(x), this.q(y), sz, sz);
        }
      }
      ctx.globalAlpha = 1;
    }

    drawParticles(dt) {
      const ctx = this.ctx;
      const kind = this.particleKind;
      if (!kind) return;
      const W = this.W, H = this.H, g = this.ground;
      const mx = this.mouse ? this.mouse.x : -999, my = this.mouse ? this.mouse.y : -999;
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        switch (kind) {
          case 'snow': case 'rain':
            p.x += p.vx * dt; p.y += p.vy * dt;
            if (p.y > g + 1) { this.particles[i] = this.newParticle(kind); continue; }
            if (p.x < -4) p.x += W + 8;
            if (p.x > W + 4) p.x -= W + 8;
            break;
          case 'petals': case 'confetti': case 'leaves':
            p.ph += 0.06 * dt; p.x += (p.vx + Math.sin(p.ph) * 0.2) * dt; p.y += p.vy * dt;
            if (p.y > g || p.x < -3 || p.x > W + 3) { this.particles[i] = this.newParticle(kind); continue; }
            break;
          case 'embers':
            p.age += dt; p.x += (p.vx + Math.sin(p.age * 0.1) * 0.1) * dt; p.y += p.vy * dt;
            p.a = clamp(1 - p.age / p.life, 0, 1);
            if (p.age > p.life || p.y < -2) { this.particles[i] = this.newParticle(kind); continue; }
            break;
          case 'fireflies': {
            p.ph += 0.05 * dt;
            const near = this.mouse && Math.hypot(mx - p.x, my - p.y) < 50;
            const tx = near ? mx + Math.sin(p.ph * 2) * 8 : p.x + Math.sin(p.ph * 0.7) * 6;
            const ty = near ? my + Math.cos(p.ph * 2) * 8 : p.y + Math.cos(p.ph) * 4;
            const ease = Math.min(1, 0.02 * dt);
            p.x += (tx - p.x) * ease; p.y += (ty - p.y) * ease;
            p.a = 0.35 + 0.65 * Math.max(0, Math.sin(p.ph));
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = p.a * 0.8;
            ctx.drawImage(this.glowSprite(p.c, 4), this.q(p.x) - 4, this.q(p.y) - 4);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'bubbles':
            p.ph += 0.05 * dt; p.y += p.vy * dt; p.x += Math.sin(p.ph) * 0.1 * dt;
            if (p.y < -6) { this.particles[i] = this.newParticle(kind); continue; }
            break;
          case 'sparkle':
            p.ph += 0.05 * dt; p.a = Math.max(0, Math.sin(p.ph)) ** 3;
            break;
          default: break;
        }
        const x = this.q(p.x), y = this.q(p.y);
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.c;
        if (p.bubble) {
          const s = p.s;
          ctx.fillRect(x + 1, y, s - 1 || 1, 1);
          ctx.fillRect(x + 1, y + s, s - 1 || 1, 1);
          ctx.fillRect(x, y + 1, 1, s - 1 || 1);
          ctx.fillRect(x + s, y + 1, 1, s - 1 || 1);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 1, y + 1, 1, 1);
        } else if (p.len) ctx.fillRect(x, y, 1, p.len);
        else ctx.fillRect(x, y, p.s, p.s);
      }
      ctx.globalAlpha = 1;
    }

    drawFx(dt) {
      const ctx = this.ctx;
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const p = this.fx[i];
        p.age += dt;
        if (p.delay && p.age < p.delay) continue;
        p.vy += (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const life = 1 - p.age / p.life;
        if (life <= 0) { this.fx.splice(i, 1); continue; }
        ctx.globalAlpha = clamp(life * 1.4, 0, 1);
        ctx.fillStyle = p.c;
        ctx.fillRect(this.q(p.x), this.q(p.y), p.s, p.s);
      }
      ctx.globalAlpha = 1;
    }

    burst(x, y, cols, n, opts) {
      const o = opts || {};
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283;
        const v = (o.v || 0.8) * (0.3 + Math.random());
        this.fx.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up || 0), g: o.g == null ? 0.02 : o.g, s: Math.random() < 0.3 ? 2 : 1,
          c: cols[Math.floor(Math.random() * cols.length)], age: 0, life: (o.life || 40) * (0.6 + Math.random() * 0.8)
        });
      }
    }

    firework(x, y) {
      const cols = [['#ffd25a', '#fff0b0'], ['#ff5a6e', '#ffc0c8'], ['#5ad2ff', '#d0f0ff'], ['#7ae07a', '#d8ffd0'], ['#c58bff', '#ecd8ff']][Math.floor(Math.random() * 5)];
      const start = this.ground;
      const steps = Math.max(6, Math.round((start - y) / 4));
      for (let i = 0; i < steps; i++) {
        this.fx.push({ x: x + (Math.random() - 0.5), y: start - ((start - y) * i) / steps, vx: 0, vy: 0, s: 1, c: '#ffe8b0', age: 0, delay: i * 0.5, life: i * 0.5 + 5 });
      }
      setTimeout(() => this.burst(x, y, cols, 46, { v: 1.3, g: 0.012, life: 46 }), steps * 42);
    }

    drawWeatherLayerExtras(env, dt) {
      const c = this.cfg();
      const ctx = this.ctx;
      if (c.underwater) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const x0 = ((i * 83 + this.t * 2) % (this.W + 60)) - 30;
          const w = 8 + (i % 3) * 5;
          const pulse = 0.6 + 0.4 * Math.sin(this.t * 0.7 + i);
          for (let y = 0; y < this.ground; y += 2) {
            ctx.fillStyle = `rgba(180,255,240,${0.1 * (1 - y / this.ground) * pulse})`;
            ctx.fillRect(this.q(x0 + y * 0.18), y, w, 2);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (c.meteors && Math.random() < 0.006 * dt) this.spawnMeteor();
      if (c.fireworks && Math.random() < 0.012 * dt && this.ground > 60) this.firework(Math.random() * this.W, 10 + Math.random() * this.ground * 0.5);
      if (c.birds) this.drawBirds();
      if (env.night > 0.55 && !c.noStars && !c.meteors && Math.random() < 0.0016 * dt) this.spawnMeteor(true);
      if (this.meteor) {
        const m = this.meteor;
        m.x += m.vx * dt; m.y += m.vy * dt; m.age += dt;
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = hexAlpha('#ffffff', (1 - i / 10) * 0.9);
          ctx.fillRect(this.q(m.x - m.vx * i * 0.6), this.q(m.y - m.vy * i * 0.6), 1, 1);
        }
        if (m.age > m.life) this.meteor = null;
      }
      if (this.particleKind === 'rain' && this.thunder && Math.random() < 0.01 * dt) this.flash = 1;
      if (this.flash) {
        ctx.fillStyle = `rgba(230,240,255,${this.flash * 0.6})`;
        ctx.fillRect(0, 0, this.W, this.H);
        this.flash = Math.max(0, this.flash - 0.3 * dt);
      }
    }

    spawnMeteor() {
      if (this.meteor) return;
      this.meteor = {
        x: Math.random() * this.W * 0.7 + this.W * 0.2, y: Math.random() * this.ground * 0.3, vx: -1.8 - Math.random(), vy: 0.8 + Math.random() * 0.5, age: 0, life: 30 + Math.random() * 20, catchable: true
      };
    }

    drawBirds() {
      const ctx = this.ctx;
      const amb = this.env0.amb;
      ctx.fillStyle = css([40 * amb[0], 44 * amb[1], 54 * amb[2]]);
      for (let i = 0; i < 5; i++) {
        const x = this.q(((this.t * (6 + (i % 3)) + i * 67) % (this.W + 40)) - 20);
        const y = this.q(this.ground * 0.2 + ((i * 29) % 30) + Math.sin(this.t + i) * 2);
        const f = Math.floor(this.t * 6 + i) % 2;
        ctx.fillRect(x - 2, y - f, 2, 1);
        ctx.fillRect(x + 1, y - f, 2, 1);
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // --- Figurák
    litDoll(d) {
      const night = this.env0.night;
      const key = this.themeKey + '|' + Math.round(night * 20);
      if (d.litKey === key) return d.lit;
      const mk = (src) => {
        const c = document.createElement('canvas');
        c.width = src.width; c.height = src.height;
        const x = c.getContext('2d');
        x.drawImage(src, 0, 0);
        if (night > 0.15) {
          x.globalCompositeOperation = 'source-atop';
          x.fillStyle = `rgba(8,14,36,${0.46 * night})`;
          x.fillRect(0, 0, c.width, c.height);
        }
        return c;
      };
      d.lit = { head: mk(d.head), body: mk(d.body), armL: mk(d.armL), armR: mk(d.armR), legL: mk(d.legL), legR: mk(d.legR) };
      d.litKey = key;
      return d.lit;
    }

    drawFigure(doll, sx, phase, moving, seed) {
      const ctx = this.ctx;
      const y = this.ground;
      const d = this.litDoll(doll);
      const sw = moving ? Math.sin(phase) : 0;
      const breathe = moving ? Math.abs(sw) * 0.5 : Math.sin(this.t * 1.7 + seed) * 0.3;
      const hL = 12 - Math.max(0, sw) * 2;
      const hR = 12 - Math.max(0, -sw) * 2;
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(sx + 1, y, 14, 1);
      ctx.drawImage(d.legL, sx + 4, this.q(y - hL), 4, this.q(hL));
      ctx.drawImage(d.legR, sx + 8, this.q(y - hR), 4, this.q(hR));
      ctx.drawImage(d.body, sx + 4, y - 24, 8, 12);
      ctx.drawImage(d.armL, sx, this.q(y - 24 + sw * 1.2), 4, 12);
      ctx.drawImage(d.armR, sx + 12, this.q(y - 24 - sw * 1.2), 4, 12);
      ctx.drawImage(d.head, sx + 4, this.q(y - 32 - breathe), 8, 8);
    }

    drawTag(name, sx, topY) {
      if (!this.hd || !name || this.narrow()) return;
      this.tags.push({ name, x: sx + 8, y: topY });
    }

    flushTags() {
      if (!this.tags.length) return;
      const ctx = this.ctx;
      const S = this.S;
      const fs = Math.max(16, Math.round(16 * (this.dpr || 1)));
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = `${fs}px "Solaryn Block", sans-serif`;
      ctx.textBaseline = 'alphabetic';
      for (const t of this.tags) {
        const w = Math.ceil(ctx.measureText(t.name).width);
        const px = Math.round(t.x * S - w / 2);
        const py = Math.round(t.y * S) - fs - 6;
        ctx.fillStyle = 'rgba(7,7,11,.62)';
        ctx.fillRect(px - 5, py, w + 10, fs + 3);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(t.name, px, py + Math.round(fs * 0.84));
      }
      ctx.restore();
      this.tags.length = 0;
    }

    // Keskeny képernyőn a főoldalt a 3D karakter és a szövegek töltik ki.
    narrow() { return this.W * this.scale <= 900; }

    drawDoll(dt) {
      this.dollRect = null;
      if (!this.doll) return;
      const home = this.view === 'home';
      if (home && this.narrow()) { this.dollX = null; return; }
      const target = home ? this.toScreen(DOLL_HOME_X) : this.W - 54 / Math.max(1, this.scale / 3) - 16;
      if (this.dollX == null) this.dollX = target;
      const dist = target - this.dollX;
      const onScreenTarget = target > -40 && target < this.W + 40;
      if (!onScreenTarget) this.dollX = target;
      else this.dollX += dist * (1 - Math.exp(-(dt * 83.3) / 200));
      const moving = Math.abs(dist) > 0.6 || !!this.camAnim;
      if (moving) this.dollWalk += dt * 1.5;
      const x = this.q(this.dollX);
      if (x < -20 || x > this.W + 20) return;
      this.drawFigure(this.doll, x, this.dollWalk, moving, 1);
      if (home) this.drawTag(this.dollName, x, this.ground - 33);
      this.dollRect = { x, y: this.ground - 32, w: 16, h: 32 };
    }

    // A 3D-s karakternek kemény árnyéka van a földön a főoldalon.
    drawSkinShadow() {
      if (this.view !== 'home' || this.skinShadowX == null) return;
      const ctx = this.ctx;
      const cx = this.q(this.skinShadowX);
      const w = this.skinShadowW || 34;
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.fillRect(cx - w / 2, this.ground - 1, w, 2);
      ctx.fillRect(cx - w / 2 + 3, this.ground + 1, w - 6, 1);
      ctx.fillStyle = 'rgba(0,0,0,.18)';
      ctx.fillRect(cx - w / 2 - 3, this.ground, 3, 1);
      ctx.fillRect(cx + w / 2, this.ground, 3, 1);
    }

    setSkin(img, name) {
      this.doll = img && img.naturalWidth ? this.makeDoll(img) : null;
      this.dollName = name || '';
      this.dollX = null;
    }

    // Az online barátok a horizonton állnak; rájuk kattintva a profiljuk nyílik meg.
    setFriends(list) {
      const spots = [52, -96, 76, -122, 100, 124, -150, 148];
      this.friends = (list || []).slice(0, spots.length).map((f, i) => ({ name: f.name, doll: this.makeDoll(f.img), x: spots[i] }));
      if (!this.running && this.layers) this.render(0);
    }

    drawFriends() {
      if (!this.friends || !this.friends.length) return;
      const ctx = this.ctx;
      for (const f of this.friends) {
        f.rect = null;
        const raw = this.toScreen(f.x);
        if (raw < -20 || raw > this.W + 20) continue;
        const sx = this.q(raw);
        this.drawFigure(f.doll, sx, 0, false, f.x);
        ctx.fillStyle = '#3ee08a';
        this.drawTag(f.name, sx, this.ground - 33);
        f.rect = { x: raw - 1, y: this.ground - 34, w: 18, h: 34 };
      }
    }

    makeDoll(img) {
      const k = img.naturalWidth / 64;
      const hasOuter = img.naturalHeight >= img.naturalWidth;
      const part = (sx, sy, w, h, ox, oy) => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.drawImage(img, sx * k, sy * k, w * k, h * k, 0, 0, w, h);
        if (hasOuter && ox != null) x.drawImage(img, ox * k, oy * k, w * k, h * k, 0, 0, w, h);
        return c;
      };
      return {
        head: part(8, 8, 8, 8, 40, 8),
        body: part(20, 20, 8, 12, 20, 36),
        armR: part(44, 20, 4, 12, 44, 36),
        armL: hasOuter ? part(36, 52, 4, 12, 52, 52) : part(44, 20, 4, 12),
        legR: part(4, 20, 4, 12, 4, 36),
        legL: hasOuter ? part(20, 52, 4, 12, 4, 52) : part(4, 20, 4, 12)
      };
    }

    // --- Képkocka
    stepCamera(now) {
      const a = this.camAnim;
      if (!a) return;
      const p = clamp((now - a.start) / a.dur, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      this.camX = a.from + a.delta * e;
      if (p >= 1) this.camAnim = null;
    }

    render(dt) {
      if (!this.layers) this.rebuild();
      const ctx = this.ctx;
      const env = this.env0;
      this.lastDt = dt;
      this.t += dt / 12;
      this.frame++;
      ctx.setTransform(this.S, 0, 0, this.S, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      this.scrollLow = (window.scrollY || 0) / this.scale;
      this.stepCamera(performance.now());
      this.paintSky();
      ctx.drawImage(this.skyCanvas, 0, 0);
      this.drawStars(env);
      if (this.cfg().aurora && env.night > 0.4) this.drawAurora(dt);
      this.drawBody(env);
      if (this.clouds.length) {
        this.clouds.forEach((cl, i) => {
          const off = this.camX * (i ? 0.05 : 0.08) + this.t * (i ? 0.5 : 0.8);
          const y = (i ? Math.round(this.ground * 0.28) : Math.round(this.ground * 0.04)) + this.pY(i ? 0.1 : 0.06);
          this.drawStrip(cl.c, cl.len, off, y);
        });
      }
      this.drawLayer(this.layers.far);
      this.drawLayer(this.layers.far2);
      if (this.cfg().sea) this.drawSea();
      if (this.ground >= 120) this.drawLayer(this.layers.isl);
      this.drawLetters(env, dt);
      this.drawLayer(this.layers.mid);
      this.drawWeatherLayerExtras(env, dt);
      this.drawLayer(this.layers.main);
      if (this.placed.length) this.drawLayer(this.placedLayer);
      this.drawRubble();
      this.drawFlags();
      this.drawPortal();
      this.drawFire();
      this.drawSmoke();
      this.drawCritters(dt);
      this.drawSkinShadow();
      this.drawFriends();
      this.drawDoll(dt);
      this.drawGlow(env);
      this.drawParticles(dt);
      this.drawFx(dt);
      this.drawPlacedPreview();
      this.flushTags();
      if (this.fadeSnap) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = clamp(this.fadeA, 0, 1);
        ctx.drawImage(this.fadeSnap, 0, 0);
        ctx.globalAlpha = 1;
        this.fadeA -= dt / 7;
        if (this.fadeA <= 0) this.fadeSnap = null;
      }
    }

    drawSea() {
      const ctx = this.ctx;
      const y = this.ground - 22;
      const a = this.env0.amb;
      const c1 = css([44 * a[0], 164 * a[1], 200 * a[2]]), c2 = css([84 * a[0], 196 * a[1], 220 * a[2]]), c3 = css([190 * a[0], 236 * a[1], 244 * a[2]]);
      ctx.fillStyle = c1;
      ctx.fillRect(0, y, this.W, 22);
      for (let i = 0; i < 18; i++) {
        const row = y + 1 + (i * 5) % 20;
        const x = ((i * 67 + this.t * (i % 3 === 0 ? 3 : -2)) % (this.W + 20) + this.W + 20) % (this.W + 20) - 10;
        ctx.fillStyle = i % 4 === 0 ? c3 : c2;
        ctx.fillRect(this.q(x), row, 5 + (i % 4) * 3, 1);
      }
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.intervalEma = 16;
      const loop = (now) => {
        if (!this.running) return;
        this.raf = requestAnimationFrame(loop);
        const ms = now - this.last;
        this.last = now;
        if (ms <= 0) return;
        const rect = this.canvas.getBoundingClientRect();
        if (rect.bottom < 0) return;
        const t0 = performance.now();
        this.render(clamp(ms / (1000 / 12), 0, 3));
        const cost = performance.now() - t0;
        this.costMs = this.costMs * 0.95 + cost * 0.05;
        if (ms < 250) this.intervalEma = this.intervalEma * 0.97 + ms * 0.03;
        // Gyenge gépen visszavált alacsony felbontásra, hogy a mozgás sima maradjon.
        if (this.hd && (this.costMs > 12 || this.intervalEma > 30)) {
          if (++this.slow > 150) { this.hd = false; this.slow = 0; this.resize(); }
        } else this.slow = 0;
      };
      this.raf = requestAnimationFrame(loop);
    }
    stop() { this.running = false; cancelAnimationFrame(this.raf); }
    drawOnce() { this.render(0); }

    setTheme(key, lazy) {
      const changed = this.themeKey !== key;
      this.themeKey = THEMES[key] ? key : 'solaryn';
      this.weatherOverride = null;
      this.thunder = false;
      this.skyKey = '';
      if (changed) {
        this.critters = [];
        this.particles = [];
        this.lettersDirty = true;
      }
      if (lazy) { this.layers = null; return; }
      this.rebuild();
    }

    panTo(pos, dur) {
      if (motionOff() || !this.running) { this.camX = pos; this.camTarget = pos; this.camAnim = null; return; }
      let delta = ((pos - this.camX) % WORLD_LEN + WORLD_LEN) % WORLD_LEN;
      if (delta > WORLD_LEN / 2) delta -= WORLD_LEN;
      this.camTarget = pos;
      if (Math.abs(delta) < 0.5) { this.camAnim = null; return; }
      this.camAnim = { from: this.camX, delta, start: performance.now(), dur: dur || clamp(420 + Math.abs(delta) * 1.15, 520, 1250) };
    }

    setView(view, opts) {
      this.view = view;
      const pos = VIEW_POS[view] != null ? VIEW_POS[view] : 1240;
      if (opts && opts.instant) { this.camX = pos; this.camTarget = pos; this.camAnim = null; return; }
      this.panTo(pos);
    }
    setTime(mode) { this.timeOverride = mode; this.rebuild(); this.skyKey = ''; }
    setWeather(kind) { this.weatherOverride = kind; this.particleKind = null; this.seedParticles(false); }

    // --- Építő mód: a blokkok külön rétegen vannak, így a rakás nem építi újra a világot.
    loadPlaced() { try { const v = JSON.parse(localStorage.getItem('solarcenter.world.blocks') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
    savePlaced() {
      clearTimeout(this.saveT);
      this.saveT = setTimeout(() => {
        try { localStorage.setItem('solarcenter.world.blocks', JSON.stringify(this.placed)); } catch {}
      }, 300);
    }
    blockColor(kind) {
      const m = this.mat || this.mats();
      switch (kind) {
        case 'dirt': return m.dirt[0];
        case 'wood': return m.wood[2];
        case 'brick': return '#a0523f';
        case 'leaf': return m.leaf[1];
        case 'gold': return '#e8c14a';
        case 'crystal': return m.portal[1];
        case 'lamp': return '#ffd98a';
        default: return m.stone[0];
      }
    }
    paintBlock(b) {
      const l = this.placedLayer;
      const c = this.blockColor(b.k);
      const B = BLOCK_SIZE;
      l.r(b.x, b.y, B, B, c);
      l.r(b.x, b.y + B - 1, B, 1, mixc(hx(c), [255, 255, 255], 0.24));
      l.r(b.x + B - 1, b.y, 1, B - 1, mixc(hx(c), [0, 0, 0], 0.3));
      l.r(b.x, b.y, B, 1, mixc(hx(c), [0, 0, 0], 0.22));
      if (b.k === 'wood') l.r(b.x + 1, b.y + 1, B - 2, 1, mixc(hx(c), [0, 0, 0], 0.2));
      if (b.k === 'brick') l.r(b.x, b.y + 2, B, 1, mixc(hx(c), [255, 240, 220], 0.3));
      if (b.k === 'crystal') l.r(b.x + 1, b.y + 2, 1, 1, '#ffffff');
    }
    cellAt(m) {
      const L = WORLD_LEN;
      const wx = ((Math.floor(m.x + this.camOffset(1)) % L) + L) % L;
      return { x: Math.floor(wx / BLOCK_SIZE) * BLOCK_SIZE, y: Math.floor((this.ground - m.y) / BLOCK_SIZE) * BLOCK_SIZE };
    }
    blockFx(cell, kind, strong) {
      const sx = this.toScreen(cell.x) + 2;
      const c = this.blockColor(kind);
      const hex = typeof c === 'string' ? c : css(c);
      this.burst(sx, this.ground - cell.y - 2, [hex, '#ffffff'], strong ? 12 : 5, { v: strong ? 0.9 : 0.5, up: 0.25, life: strong ? 18 : 10, g: 0.06 });
    }
    placeAt(cell) {
      if (cell.y < 0 || cell.y > 120 || this.placed.length >= 800) return false;
      if (this.placed.some((b) => b.x === cell.x && b.y === cell.y)) return false;
      const b = { x: cell.x, y: cell.y, k: this.blockKind || 'stone' };
      this.placed.push(b);
      this.paintBlock(b);
      if (b.k === 'lamp') this.placedGlows.push(b);
      this.blockFx(cell, b.k, false);
      this.undoStack.push({ add: b });
      this.savePlaced();
      this.emit('placed', { count: this.placed.length, kind: b.k });
      return true;
    }
    removeAt(cell) {
      const i = this.placed.findIndex((b) => b.x === cell.x && b.y === cell.y);
      if (i < 0) return false;
      const b = this.placed[i];
      this.placed.splice(i, 1);
      this.eraseBlock(b);
      this.blockFx(cell, b.k, true);
      this.undoStack.push({ del: b });
      this.savePlaced();
      this.emit('broken', { kind: b.k });
      return true;
    }
    eraseBlock(b) {
      const l = this.placedLayer;
      const cy = l.base - b.y - BLOCK_SIZE;
      l.ctx.clearRect(b.x, cy, BLOCK_SIZE, BLOCK_SIZE);
      const g = this.placedGlows.indexOf(b);
      if (g >= 0) this.placedGlows.splice(g, 1);
    }
    undoBlock() {
      const u = this.undoStack.pop();
      if (!u) return false;
      if (u.add) {
        const i = this.placed.indexOf(u.add);
        if (i >= 0) { this.placed.splice(i, 1); this.eraseBlock(u.add); }
      } else if (u.del) {
        this.placed.push(u.del);
        this.paintBlock(u.del);
        if (u.del.k === 'lamp') this.placedGlows.push(u.del);
      }
      this.savePlaced();
      return true;
    }
    clearBlocks() {
      this.placed.slice().forEach((b) => this.eraseBlock(b));
      this.placed = [];
      this.undoStack = [];
      this.savePlaced();
    }
    drawPlacedPreview() {
      if (!this.creative || !this.mouse) return;
      const cell = this.cellAt(this.mouse);
      if (cell.y < 0 || cell.y > 120) return;
      const ctx = this.ctx;
      const taken = this.placed.some((b) => b.x === cell.x && b.y === cell.y);
      const x = this.q(this.toScreen(cell.x));
      const y = this.ground - cell.y - BLOCK_SIZE;
      if (!taken) {
        const c = this.blockColor(this.blockKind || 'stone');
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = typeof c === 'string' ? c : css(c);
        ctx.fillRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        ctx.globalAlpha = 1;
      }
      const px = 1 / this.S;
      const bw = Math.max(px, 0.34);
      ctx.fillStyle = taken ? '#ff6a5a' : '#ffffff';
      ctx.fillRect(x - bw, y - bw, BLOCK_SIZE + bw * 2, bw);
      ctx.fillRect(x - bw, y + BLOCK_SIZE, BLOCK_SIZE + bw * 2, bw);
      ctx.fillRect(x - bw, y, bw, BLOCK_SIZE);
      ctx.fillRect(x + BLOCK_SIZE, y, bw, BLOCK_SIZE);
    }

    // --- Egér
    bind() {
      const c = this.canvas;
      const toLow = (e) => {
        const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
      };
      this.handlePointer = (e) => {
        const m = toLow(e);
        if (m.x < 0 || m.y < 0 || m.x > this.W || m.y > this.H) { this.mouse = null; this.setCursor(null); return; }
        this.mouse = m;
        if (this.painting) {
          const cell = this.cellAt(m);
          if (!this.lastCell || this.lastCell.x !== cell.x || this.lastCell.y !== cell.y) {
            this.lastCell = cell;
            if (this.painting === 'remove') this.removeAt(cell); else this.placeAt(cell);
          }
          return;
        }
        this.setCursor(this.creative ? null : this.hitTest(m));
      };
      window.addEventListener('pointermove', this.handlePointer, { passive: true });
      this.handleDown = (e) => {
        if (e.target !== c || !this.creative) return;
        const m = toLow(e);
        const cell = this.cellAt(m);
        this.lastCell = cell;
        const remove = e.button === 2 || e.shiftKey;
        this.painting = remove ? 'remove' : 'place';
        if (remove) this.removeAt(cell); else this.placeAt(cell);
      };
      window.addEventListener('pointerdown', this.handleDown);
      this.handleUp = () => { this.painting = null; this.lastCell = null; };
      window.addEventListener('pointerup', this.handleUp);
      window.addEventListener('pointercancel', this.handleUp);
      this.handleMenu = (e) => { if (e.target === c && this.creative) e.preventDefault(); };
      window.addEventListener('contextmenu', this.handleMenu);
      this.handleClick = (e) => {
        if (e.target !== c || this.creative) return;
        const m = toLow(e);
        const hit = this.hitTest(m);
        if (hit) this.emit('hit', Object.assign({ m, screen: { x: e.clientX, y: e.clientY } }, hit));
        else this.emit('sky', { m, screen: { x: e.clientX, y: e.clientY } });
      };
      window.addEventListener('click', this.handleClick);
    }
    unbind() {
      window.removeEventListener('pointermove', this.handlePointer);
      window.removeEventListener('pointerdown', this.handleDown);
      window.removeEventListener('pointerup', this.handleUp);
      window.removeEventListener('pointercancel', this.handleUp);
      window.removeEventListener('contextmenu', this.handleMenu);
      window.removeEventListener('click', this.handleClick);
    }
    setCursor(hit) {
      const v = this.creative ? 'crosshair' : hit ? 'pointer' : '';
      if (this._cur !== v) {
        this.canvas.style.cursor = v;
        this.canvas.style.touchAction = this.creative ? 'none' : '';
        this._cur = v;
      }
      const tip = hit && hit.id === 'friend' ? hit.name : hit && hit.label ? hit.label : '';
      if (this._tip !== tip) { this.canvas.title = tip; this._tip = tip; }
    }

    hitTest(m) {
      if (this.sunRect && this.inRect(m, this.sunRect)) return { id: 'sun' };
      if (this.moonRect && this.inRect(m, this.moonRect)) return { id: 'moon' };
      if (this.meteor && Math.hypot(m.x - this.meteor.x, m.y - this.meteor.y) < 8) return { id: 'star' };
      if (this.dollRect && this.inRect(m, this.dollRect)) return { id: 'doll' };
      for (const f of this.friends || []) if (f.rect && this.inRect(m, f.rect)) return { id: 'friend', name: f.name };
      for (const a of this.critters) if (a.rect && this.inRect(m, a.rect)) return { id: 'critter', critter: a };
      // lebegő betűk
      if (this.showLetters && this.lettersPos && this.ground >= 96) {
        const lx = m.x - this.lettersPos.x, ly = m.y - this.lettersPos.y;
        if (lx >= 0 && lx <= this.lettersW && ly >= 0 && ly <= 28) {
          for (const b of this.blocks) {
            if (b.gone || b.falling) continue;
            const by = 24 - b.y;
            if (lx >= b.x && lx < b.x + 4 && ly >= by && ly < by + 4) return { id: 'letter', block: b };
          }
        }
      }
      const wx = ((m.x + this.camOffset(1)) % WORLD_LEN + WORLD_LEN) % WORLD_LEN;
      const wy = this.ground - m.y;
      for (const h of this.hits) {
        const rel = ((wx - h.x) % WORLD_LEN + WORLD_LEN) % WORLD_LEN;
        if (rel < h.w && wy >= h.y && wy < h.y + h.h) return h;
      }
      if (this.particleKind === 'fireflies' || this.particleKind === 'bubbles') {
        for (let i = 0; i < this.particles.length; i++) {
          const p = this.particles[i];
          if (Math.hypot(m.x - p.x, m.y - p.y) < 5) return { id: this.particleKind === 'bubbles' ? 'bubble' : 'firefly', index: i };
        }
      }
      return null;
    }
    inRect(m, r) { return m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h; }
    removeParticle(i) { if (this.particles[i]) this.particles[i] = this.newParticle(this.particleKind); }
  }

  // ---- Föld alatti rétegek (CSS háttérként) ----------------------------------------------------
  const STRATA = {
    solaryn: { a: '#1a1410', b: '#14141a', c: '#0e0e14', vein: '#e8b23a', veinB: '#8a6420', name: 'Napkristály', treasure: 'sun' },
    'solaryn-light': { a: '#e4d9c0', b: '#dcd2bc', c: '#d2c8b4', vein: '#c48700', veinB: '#a87410', name: 'Aranyrög', treasure: 'nugget', light: true },
    ice: { a: '#0d1a28', b: '#0a1522', c: '#07101a', vein: '#7fd6ff', veinB: '#2c6a96', name: 'Fagyott csillag', treasure: 'star' },
    crimson: { a: '#170a0d', b: '#120709', c: '#0c0506', vein: '#ff5a1f', veinB: '#a81f12', name: 'Parázskő', treasure: 'ember', magma: true },
    emerald: { a: '#0c1a12', b: '#0a150e', c: '#07100a', vein: '#3ee08a', veinB: '#14703e', name: 'Ősi smaragd', treasure: 'gem', roots: true },
    amethyst: { a: '#150f22', b: '#110c1c', c: '#0c0815', vein: '#b565ff', veinB: '#5a2f9c', name: 'Ametiszt-geóda', treasure: 'geode', geode: true },
    turquoise: { a: '#b8a878', b: '#0c2a30', c: '#082026', vein: '#2dd4bf', veinB: '#117a70', name: 'Tengeri gyöngy', treasure: 'pearl', sandTop: true },
    halloween: { a: '#17100e', b: '#120d14', c: '#0d0910', vein: '#ff8a1f', veinB: '#7a3c10', name: 'Elásott koponya', treasure: 'skull', bones: true },
    christmas: { a: '#0e1a14', b: '#0b1510', c: '#07100c', vein: '#ff4f4f', veinB: '#f2c14e', name: 'Elásott ajándék', treasure: 'gift' },
    newyear: { a: '#0d0f1c', b: '#0a0c18', c: '#070814', vein: '#f5cf5b', veinB: '#7c6420', name: 'Pezsgősdugó', treasure: 'cork' },
    valentine: { a: '#1a0e14', b: '#150b10', c: '#10080c', vein: '#ff5c8a', veinB: '#8c2a4c', name: 'Szívkő', treasure: 'heart' },
    carnival: { a: '#14122a', b: '#100e22', c: '#0c0a1a', vein: '#ffd23f', veinB: '#43d3ff', name: 'Elveszett álarc', treasure: 'mask' },
    easter: { a: '#16201a', b: '#121a15', c: '#0d1410', vein: '#f7b3d4', veinB: '#9be3a8', name: 'Hímes tojás', treasure: 'egg' },
    national: { a: '#161814', b: '#111311', c: '#0c0e0c', vein: '#e8343f', veinB: '#3fae5a', name: 'Kokárda', treasure: 'cockade' },
    summer: { a: '#c4ad78', b: '#0f2a30', c: '#0b2026', vein: '#ffcf3a', veinB: '#c88c1a', name: 'Kalózkincs', treasure: 'chest', sandTop: true }
  };

  function tile(size, base, opts) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const o = opts || {};
    const rand = rng(o.seed || 7);
    const col = hx(base);
    const dark = lum(col) < 0.5;
    const block = 16;
    for (let by = 0; by < size; by += block) {
      const offset = (by / block) % 2 ? block / 2 : 0;
      for (let bx = -block; bx < size; bx += block) {
        const tone = (rand() - 0.5) * (o.toneAmp || 0.05);
        const bc = mixc(col, dark ? [255, 255, 255] : [0, 0, 0], Math.max(0, tone));
        const bc2 = tone < 0 ? mixc(col, dark ? [0, 0, 0] : [255, 255, 255], -tone) : bc;
        x.fillStyle = css(bc2);
        x.fillRect(bx + offset, by, block, block);
        for (let i = 0; i < 18; i++) {
          const px = bx + offset + Math.floor(rand() * 7) * 2, py = by + Math.floor(rand() * 7) * 2;
          x.fillStyle = css(mixc(bc2, dark ? [255, 255, 255] : [0, 0, 0], rand() * 0.03));
          x.fillRect(px, py, 2, 2);
        }
        x.fillStyle = css(mixc(col, dark ? [0, 0, 0] : [90, 70, 40], dark ? 0.32 : 0.1));
        x.fillRect(bx + offset, by, block, 1);
        x.fillRect(bx + offset, by, 1, block);
      }
    }
    if (o.veins) {
      const n = o.veinCount || 7;
      for (let i = 0; i < n; i++) {
        const vx = Math.floor(rand() * size), vy = Math.floor(rand() * size);
        const cells = 2 + Math.floor(rand() * 5);
        let cx = vx, cy = vy;
        for (let j = 0; j < cells; j++) {
          x.fillStyle = css(mixc(hx(o.veins[j % 2]), col, o.veinFade == null ? 0.72 : o.veinFade));
          x.fillRect(cx % size, cy % size, 2, 2);
          cx += Math.floor(rand() * 3) * 2 - 2;
          cy += Math.floor(rand() * 3) * 2 - 2;
          if (cx < 0) cx += size;
          if (cy < 0) cy += size;
        }
      }
    }
    if (o.magma) {
      for (let i = 0; i < 6; i++) {
        let cx = Math.floor(rand() * size), cy = Math.floor(rand() * size);
        const n = 8 + Math.floor(rand() * 14);
        for (let j = 0; j < n; j++) {
          x.fillStyle = css(mixc(j % 3 ? [255, 90, 30] : [255, 170, 60], col, 0.62));
          x.fillRect(cx % size, cy % size, 2, 1);
          cx += 2; if (rand() < 0.4) cy += rand() < 0.5 ? 1 : -1 + size;
        }
      }
    }
    if (o.roots) {
      for (let i = 0; i < 4; i++) {
        let cx = Math.floor(rand() * size), cy = 0;
        while (cy < size) {
          x.fillStyle = css(mixc([70, 50, 30], col, 0.55));
          x.fillRect(cx % size, cy, 1, 2);
          cy += 2; if (rand() < 0.3) cx += rand() < 0.5 ? 1 : size - 1;
        }
      }
    }
    if (o.geode) {
      for (let i = 0; i < 3; i++) {
        const gx = Math.floor(rand() * (size - 16)), gy = Math.floor(rand() * (size - 12));
        for (let k = 0; k < 16; k++) {
          const dx = Math.floor(rand() * 12), dy = Math.floor(rand() * 8);
          x.fillStyle = css(mixc(rand() < 0.5 ? [180, 110, 255] : [230, 190, 255], col, 0.55));
          x.fillRect(gx + dx, gy + dy, 1, 2);
        }
      }
    }
    if (o.bones) {
      for (let i = 0; i < 3; i++) {
        const bxx = Math.floor(rand() * (size - 12)), byy = Math.floor(rand() * (size - 6));
        x.fillStyle = css(mixc([225, 215, 195], col, 0.68));
        x.fillRect(bxx, byy + 1, 10, 1);
        x.fillRect(bxx, byy, 1, 3);
        x.fillRect(bxx + 9, byy, 1, 3);
      }
    }
    return c;
  }

  // Réteghatár: blokkonként keveredik a két anyag, nem egy éles vonal.
  function edge(size, base, seed) {
    const c = document.createElement('canvas');
    c.width = size; c.height = 24;
    const x = c.getContext('2d');
    const rand = rng(seed);
    x.fillStyle = base;
    for (let row = 0; row < 6; row++) {
      const chance = (row + 1) / 7;
      for (let i = 0; i < size; i += 4) {
        if (rand() < chance) x.fillRect(i, row * 4, 4, 4);
      }
    }
    return c;
  }

  // Az akna fala a mellette lévő kőzetbe harap, lépcsős széllel.
  function shaftWall(base, rim, seed, flip) {
    const w = 16, h = 128;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const rand = rng(seed);
    let d = 6;
    for (let y = 0; y < h; y += 4) {
      d = clamp(d + Math.round((rand() - 0.5) * 5), 2, 14);
      const px = flip ? 0 : w - d;
      x.fillStyle = base;
      x.fillRect(px, y, d, 4);
      x.fillStyle = rim;
      x.fillRect(flip ? d - 1 : w - d, y, 1, 4);
    }
    return c;
  }

  function shaftTop(size, soil, seed) {
    const c = document.createElement('canvas');
    c.width = size; c.height = 16;
    const x = c.getContext('2d');
    const rand = rng(seed);
    for (let i = 0; i < size; i += 4) {
      const d = 2 + Math.floor(rand() * 4);
      x.fillStyle = soil;
      x.fillRect(i, 0, 4, d * 2);
      x.fillStyle = 'rgba(0,0,0,.35)';
      x.fillRect(i, d * 2, 4, 2);
    }
    return c;
  }

  function applyStrata(root, themeKey, scale) {
    const st = STRATA[themeKey] || STRATA.solaryn;
    const size = 128;
    // A felület az aknában áll, ezért a kőzetfalak bátran látszhatnak.
    const wall = (hex, k) => (st.light ? hex : css(mixc(mixc(hx(hex), [255, 255, 255], k), hx(st.vein), 0.045)).replace(/rgb\((\d+),(\d+),(\d+)\)/, (m, r, g, bl) => '#' + [r, g, bl].map((n) => Number(n).toString(16).padStart(2, '0')).join('')));
    const colA = wall(st.a, 0.16), colB = wall(st.b, 0.11), colC = wall(st.c, 0.07);
    const veinFade = st.light ? 0.5 : 0.42;
    const a = tile(size, colA, { seed: 11, veins: [st.vein, st.veinB], veinCount: 3, veinFade: 0.62, roots: st.roots, toneAmp: 0.09 });
    const b = tile(size, colB, { seed: 23, veins: [st.vein, st.veinB], veinCount: 7, veinFade, magma: st.magma, geode: st.geode, bones: st.bones, toneAmp: 0.09 });
    const d = tile(size, colC, { seed: 37, veins: [st.vein, st.veinB], veinCount: 11, veinFade: veinFade - 0.1, magma: st.magma, geode: st.geode, bones: st.bones, toneAmp: 0.11 });
    const s = root.style;
    s.setProperty('--tile-a', `url(${a.toDataURL()})`);
    s.setProperty('--tile-b', `url(${b.toDataURL()})`);
    s.setProperty('--tile-c', `url(${d.toDataURL()})`);
    s.setProperty('--edge-b', `url(${edge(size, colB, 3).toDataURL()})`);
    s.setProperty('--edge-c', `url(${edge(size, colC, 5).toDataURL()})`);
    const bedCol = st.light ? '#8b7f68' : '#050507';
    const bed = tile(size, bedCol, { seed: 41, toneAmp: 0.1, veins: ['#26262c', '#1a1a20'], veinCount: 10, veinFade: 0.2 });
    s.setProperty('--tile-bed', `url(${bed.toDataURL()})`);
    s.setProperty('--edge-bed', `url(${edge(size, bedCol, 9).toDataURL()})`);
    const shaftCol = st.light ? '#d8cfba' : css(mixc(hx(st.c), [0, 0, 0], 0.22));
    const rim = st.light ? '#b3a78d' : css(mixc(hx(st.c), [0, 0, 0], 0.7));
    const shaft = tile(size, shaftCol, { seed: 53, toneAmp: st.light ? 0.03 : 0.05 });
    s.setProperty('--shaft-col', shaftCol);
    s.setProperty('--tile-shaft', `url(${shaft.toDataURL()})`);
    s.setProperty('--shaft-l', `url(${shaftWall(shaftCol, rim, 61, false).toDataURL()})`);
    s.setProperty('--shaft-r', `url(${shaftWall(shaftCol, rim, 67, true).toDataURL()})`);
    s.setProperty('--shaft-top', `url(${shaftTop(size, colA, 71).toDataURL()})`);
    s.setProperty('--world-px', String(scale));
    s.setProperty('--strata-a', colA);
    s.setProperty('--strata-b', colB);
    s.setProperty('--strata-c', colC);
  }

  // Kicsi, statikus előnézet a témaválasztóhoz
  function thumb(canvas, themeKey) {
    const w = new World(canvas, { groundRows: 6, fixed: { w: canvas.width, h: canvas.height } });
    w.unbind();
    w.showLetters = false;
    w.themeKey = THEMES[themeKey] ? themeKey : 'solaryn';
    w.camX = 0; w.camTarget = 0;
    w.placed = [];
    w.rebuild();
    w.critters = [];
    w.render(1);
    return w;
  }

  window.SolarWorld = { World, applyStrata, thumb, THEMES, STRATA, VIEW_POS, solar, BLOCK_KINDS };
})();
