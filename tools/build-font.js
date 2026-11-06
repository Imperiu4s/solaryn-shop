// Solaryn Block - a SolarCenter saját címsor-betűtípusa.
// Moduláris rajzolat: a betűk egy durva rácsból épülnek, a külső sarkokat egy egységgel levágjuk.
// Futtatás: node tools/build-font.js  ->  assets/fonts/solaryn-block.woff
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const UNIT = 64;          // 1 rácsegység (UPM 1024 -> 16 egység/em)
const UPM = 1024;
const ASC = 13, DESC = 3; // egységben: 13 fel, 3 le
const CAP = 10, XH = 8;

// Durva minták: [minta sorok "/"-rel, oszlopszélességek, sormagasságok, alapvonal alatti sorok]
const C3 = [2, 3, 2], R5 = [2, 2, 2, 2, 2], L5 = [2, 1, 2, 1, 2];
const C222 = [2, 2, 2], C323 = [3, 2, 3];

function coarse(pat, cols, rows, below) {
  const lines = pat.split('/');
  const out = [];
  lines.forEach((ln, r) => {
    for (let h = 0; h < rows[r]; h++) {
      let s = '';
      [...ln].forEach((ch, c) => { s += (ch === '#' ? '#' : '.').repeat(cols[c]); });
      out.push(s);
    }
  });
  return { px: out, below: below || 0 };
}
const raw = (pat, below) => ({ px: pat.split('/'), below: below || 0 });

const G = {
  // Nagybetűk
  A: coarse('###/#.#/###/#.#/#.#', C3, R5),
  B: coarse('##./#.#/##./#.#/##.', C3, R5),
  C: coarse('###/#../#../#../###', C3, R5),
  D: coarse('##./#.#/#.#/#.#/##.', C3, R5),
  E: coarse('###/#../##./#../###', [2, 3, 1], R5),
  F: coarse('###/#../##./#../#..', [2, 3, 1], R5),
  G: coarse('###/#../#.#/#.#/###', C3, R5),
  H: coarse('#.#/#.#/###/#.#/#.#', C3, R5),
  I: coarse('###/.#./.#./.#./###', C222, R5),
  J: coarse('..#/..#/..#/#.#/###', C3, R5),
  K: raw('##...##/##..##./##.##../####.../####.../##.##../##.##../##..##./##..##./##...##'),
  L: coarse('#../#../#../#../###', C3, R5),
  M: raw('##.....##/###...###/###...###/####.####/##.###.##/##.###.##/##..#..##/##.....##/##.....##/##.....##'),
  N: raw('##....##/###...##/###...##/####..##/##.##.##/##.##.##/##..####/##...###/##...###/##....##'),
  O: coarse('###/#.#/#.#/#.#/###', C3, R5),
  P: coarse('###/#.#/###/#../#..', C3, R5),
  Q: raw('#######/##...##/##...##/##...##/##...##/##...##/##.#.##/##.####/#######/.....##', 0),
  R: coarse('###/#.#/##./#.#/#.#', C3, R5),
  S: coarse('###/#../###/..#/###', C3, R5),
  T: coarse('###/.#./.#./.#./.#.', C323, R5),
  U: coarse('#.#/#.#/#.#/#.#/###', C3, R5),
  V: raw('##...##/##...##/##...##/##...##/##...##/##...##/.##.##./.##.##./..###../..###..'),
  W: raw('##.....##/##.....##/##.....##/##..#..##/##.###.##/##.###.##/####.####/###...###/###...###/##.....##'),
  X: raw('##...##/##...##/.##.##./.##.##./..###../..###../.##.##./.##.##./##...##/##...##'),
  Y: coarse('#.#/#.#/###/.#./.#.', C323, R5),
  Z: raw('#######/#######/....##./...##../...##../..##.../..##.../.##..../#######/#######'),
  // Kisbetűk
  a: coarse('###/..#/###/#.#/###', C3, L5),
  b: coarse('#../###/#.#/###', C3, [2, 2, 4, 2]),
  c: coarse('###/#../###', C3, [2, 4, 2]),
  d: coarse('..#/###/#.#/###', C3, [2, 2, 4, 2]),
  e: coarse('###/#.#/###/#../###', C3, L5),
  f: coarse('.##/#../##./#../#..', [2, 1, 2], [2, 1, 2, 2, 3]),
  g: coarse('###/#.#/###/..#/###', C3, [2, 4, 2, 1, 2], 3),
  h: coarse('#../###/#.#', C3, [2, 2, 6]),
  i: coarse('#/./#', [2], [2, 1, 7]),
  j: coarse('.#/../.#/.#/##', [1, 2], [2, 1, 6, 2, 2], 3),
  k: raw('##...../##...../##..##./##..##./##.##../####.../##.##../##.##../##..##./##..##.'),
  l: coarse('#.', [2, 1], [10]),
  m: coarse('#####/#.#.#', [2, 1, 2, 1, 2], [2, 6]),
  n: coarse('###/#.#', C3, [2, 6]),
  o: coarse('###/#.#/###', C3, [2, 4, 2]),
  p: coarse('###/#.#/###/#..', C3, [2, 4, 2, 3], 3),
  q: coarse('###/#.#/###/..#', C3, [2, 4, 2, 3], 3),
  r: coarse('###/#../#..', [2, 2, 2], [2, 2, 4]),
  s: coarse('###/#../###/..#/###', C3, L5),
  t: coarse('#./##/#./##', [2, 2], [2, 2, 4, 2]),
  u: coarse('#.#/###', C3, [6, 2]),
  v: raw('##...##/##...##/##...##/##...##/.##.##./.##.##./..###../..###..'),
  w: coarse('#.#.#/#####', [2, 1, 2, 1, 2], [6, 2]),
  x: raw('##...##/##...##/.##.##./..###../..###../.##.##./##...##/##...##'),
  y: coarse('#.#/###/..#/###', C3, [6, 2, 1, 2], 3),
  z: coarse('###/..#/.#./#../###', C3, L5),
  // Számok
  0: coarse('###/#.#/#.#/#.#/###', C3, R5),
  1: coarse('.#./##./.#./.#./###', C222, R5),
  2: coarse('###/..#/###/#../###', C3, R5),
  3: coarse('###/..#/.##/..#/###', C3, R5),
  4: coarse('#.#/#.#/###/..#/..#', C3, R5),
  5: coarse('###/#../###/..#/###', C3, R5),
  6: coarse('###/#../###/#.#/###', C3, R5),
  7: coarse('###/..#/..#/..#/..#', C3, R5),
  8: coarse('###/#.#/###/#.#/###', C3, R5),
  9: coarse('###/#.#/###/..#/###', C3, R5),
  // Írásjelek
  '.': coarse('#', [2], [2]),
  ',': raw('##/##/.#/#.', 2),
  ':': coarse('#/./#', [2], [2, 3, 2]),
  ';': raw('##/##/../../../##/##/.#/#.', 2),
  '!': coarse('#/./#', [2], [7, 1, 2]),
  '?': coarse('###/..#/.##/.../.#.', C3, [2, 2, 2, 2, 2]),
  '-': coarse('#', [5], [2]),
  '–': coarse('#', [7], [2]),
  '—': coarse('#', [9], [2]),
  '+': coarse('.#./###/.#.', C222, [2, 2, 2]),
  '=': coarse('#/./#', [6], [2, 1, 2]),
  '/': raw('.....##/....##./....##./...##../...##../..##.../..##.../.##..../.##..../##.....'),
  '\\': raw('##...../.##..../.##..../..##.../..##.../...##../...##../....##./....##./.....##'),
  '(': coarse('.#/#./#./#./.#', [2, 2], [1, 1, 6, 1, 1]),
  ')': coarse('#./.#/.#/.#/#.', [2, 2], [1, 1, 6, 1, 1]),
  '[': coarse('##/#./##', [2, 2], [2, 6, 2]),
  ']': coarse('##/.#/##', [2, 2], [2, 6, 2]),
  "'": raw('##/##/##'),
  '"': raw('##.##/##.##/##.##'),
  '%': raw('##...##/##...##/.....##/....##./...##../..##.../.##..../##...../##...##/##...##'),
  '#': raw('..#..#./..#..#./#######/.#..#../.#..#../.#..#../#######/#..#.../#..#...'),
  '_': coarse('#', [7], [2]),
  '&': raw('..###.../.##.##../.##.##../..###.../.####.##/##..###./##...##./##...##./.###.###'),
  '@': raw('.#######./##.....##/##.####.#/##.#.##.#/##.#.##.#/##.#.##.#/##.#####./##......./.#######.'),
  '<': raw('...##/..##./.##../##.../.##../..##./...##'),
  '>': raw('##.../.##../..##./...##/..##./.##../##...'),
  '*': raw('.#.#./..#../#####/..#../.#.#.'),
  '|': coarse('#', [2], [12]),
  '~': raw('.##...#/#..#.#./#...##.'),
  '·': coarse('#', [2], [2]),
  '€': raw('...####/..##.../.##..../#####../.##..../#####../.##..../..##.../...####'),
  ' ': { px: [], below: 0, width: 4 }
};

// Hol áll a jel az alapvonalhoz képest: a legtöbb az alapvonalon ül, ezek középen.
const LIFT = { '-': 4, '–': 4, '—': 4, '+': 2, '=': 2, '<': 1, '>': 1, '*': 5, '~': 4, '·': 4, "'": 7, '"': 7 };
const FLOAT_TOP = { "'": true, '"': true };

// Nem levágható jelek: ezek apró, tömör formák
const NO_CHAMFER = new Set(['.', ',', ':', ';', '!', "'", '"', '-', '–', '—', '_', '|', '=', '·', ' ']);

// Ékezetek: sorok a betű teteje fölött, jobbra tolással a betű közepéhez viszonyítva
const ACUTE = ['..##', '.##.'];
const DOUBLE = ['.##.##', '##.##.'];
const DIAER = ['##.##', '##.##'];
const ACCENTED = {
  'Á': ['A', ACUTE], 'É': ['E', ACUTE], 'Í': ['I', ACUTE], 'Ó': ['O', ACUTE], 'Ö': ['O', DIAER], 'Ő': ['O', DOUBLE], 'Ú': ['U', ACUTE], 'Ü': ['U', DIAER], 'Ű': ['U', DOUBLE],
  'á': ['a', ACUTE], 'é': ['e', ACUTE], 'í': ['ı', ACUTE], 'ó': ['o', ACUTE], 'ö': ['o', DIAER], 'ő': ['o', DOUBLE], 'ú': ['u', ACUTE], 'ü': ['u', DIAER], 'ű': ['u', DOUBLE]
};
G['ı'] = coarse('#', [2], [8]);

// ---- Bitképből pixeltömb, alapvonal-koordinátákkal -----------------------------------------
function normalize(g) {
  const rows = g.px;
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const grid = rows.map((r) => [...r.padEnd(w, '.')].map((c) => c === '#'));
  return { grid, w, h: rows.length, below: g.below || 0, width: g.width };
}

// A külső domború sarkokat levágjuk, ha a sarok hosszú vízszintes és függőleges szakasz találkozása.
function chamfer(grid) {
  const h = grid.length, w = h ? grid[0].length : 0;
  const at = (x, y) => y >= 0 && y < h && x >= 0 && x < w && grid[y][x];
  const hrun = (x, y) => { let a = x, b = x; while (at(a - 1, y)) a--; while (at(b + 1, y)) b++; return b - a + 1; };
  const vrun = (x, y) => { let a = y, b = y; while (at(x, a - 1)) a--; while (at(x, b + 1)) b++; return b - a + 1; };
  const cut = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!at(x, y)) continue;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      if (at(x + dx, y) || at(x, y + dy)) continue;
      if (hrun(x, y) >= 4 && vrun(x, y) >= 4) cut.push([x, y]);
    }
  }
  const out = grid.map((r) => r.slice());
  cut.forEach(([x, y]) => { out[y][x] = false; });
  return out;
}

function buildGlyph(ch) {
  let accent = null, base = ch;
  if (ACCENTED[ch]) { base = ACCENTED[ch][0]; accent = ACCENTED[ch][1]; }
  const src = G[base];
  if (!src) throw new Error('Hiányzó jel: ' + ch);
  const n = normalize(src);
  let grid = NO_CHAMFER.has(base) ? n.grid : chamfer(n.grid);
  const pixels = [];
  const lift = LIFT[base] || 0;
  grid.forEach((row, r) => row.forEach((on, x) => {
    if (!on) return;
    const yFromBaseline = (n.h - 1 - r) - n.below + lift; // a sor alja az alapvonaltól
    pixels.push([x, yFromBaseline]);
  }));
  let w = n.width != null ? n.width : n.w;
  if (accent) {
    const aw = accent[0].length;
    const ox = Math.floor((n.w - aw) / 2) + (aw === 4 ? 1 : 0);
    const topY = n.h - n.below + lift + 1; // egy egység hézag
    accent.forEach((row, r) => {
      [...row].forEach((c, x) => {
        if (c !== '#') return;
        pixels.push([ox + x, topY + (accent.length - 1 - r)]);
      });
    });
  }
  return { pixels, adv: w + 1 };
}

// ---- Körvonal-követés: a pixelhalmaz egybeolvasztva, hogy ne legyenek hajszálrepedések --------
function trace(pixels) {
  const on = new Set(pixels.map(([x, y]) => x + ',' + y));
  const has = (x, y) => on.has(x + ',' + y);
  const edges = new Map();
  const add = (x1, y1, x2, y2) => {
    const k = x1 + ',' + y1;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k).push([x2, y2]);
  };
  // óramutató járása szerint a külső kontúr (a kitöltés jobbra esik), y felfelé nő
  for (const [x, y] of pixels) {
    if (!has(x, y + 1)) add(x, y + 1, x + 1, y + 1);
    if (!has(x + 1, y)) add(x + 1, y + 1, x + 1, y);
    if (!has(x, y - 1)) add(x + 1, y, x, y);
    if (!has(x - 1, y)) add(x, y, x, y + 1);
  }
  const contours = [];
  while (edges.size) {
    const startKey = edges.keys().next().value;
    const [sx, sy] = startKey.split(',').map(Number);
    let cx = sx, cy = sy, dir = null;
    const pts = [];
    do {
      const key = cx + ',' + cy;
      const opts = edges.get(key);
      let pick = 0;
      if (opts.length > 1 && dir) {
        // átlós érintkezésnél jobbra kanyarodunk, hogy a kontúrok ne keresztezzék egymást
        const right = [dir[1], -dir[0]];
        const i = opts.findIndex(([nx, ny]) => nx - cx === right[0] && ny - cy === right[1]);
        if (i >= 0) pick = i;
      }
      const [nx, ny] = opts.splice(pick, 1)[0];
      if (!opts.length) edges.delete(key);
      pts.push([cx, cy]);
      dir = [nx - cx, ny - cy];
      cx = nx; cy = ny;
    } while (cx !== sx || cy !== sy);
    // egyenes szakaszok összevonása
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[(i + pts.length - 1) % pts.length], c = pts[i], n = pts[(i + 1) % pts.length];
      if ((c[0] - p[0]) * (n[1] - c[1]) - (c[1] - p[1]) * (n[0] - c[0]) !== 0) out.push(c);
    }
    contours.push(out);
  }
  return contours;
}

// ---- TrueType író ----------------------------------------------------------------------------
class W {
  constructor() { this.b = []; }
  u8(v) { this.b.push(v & 255); return this; }
  u16(v) { this.b.push((v >> 8) & 255, v & 255); return this; }
  i16(v) { return this.u16(v < 0 ? v + 65536 : v); }
  u32(v) { this.b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); return this; }
  bytes(a) { for (const x of a) this.b.push(x); return this; }
  buf() { return Buffer.from(this.b); }
}
function checksum(buf) {
  let s = 0;
  const pad = Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4)]);
  for (let i = 0; i < pad.length; i += 4) s = (s + pad.readUInt32BE(i)) >>> 0;
  return s;
}

const chars = [...new Set([...Object.keys(G).filter((c) => c !== 'ı'), ...Object.keys(ACCENTED)])].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
const glyphs = [{ pixels: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [3, 1], [0, 2], [3, 2], [0, 3], [3, 3], [0, 4], [1, 4], [2, 4], [3, 4]], adv: 5, ch: null }];
chars.forEach((ch) => { const g = buildGlyph(ch); g.ch = ch; glyphs.push(g); });

const glyfParts = [], loca = [0], hmtx = new W();
let xMinAll = 32767, yMinAll = 32767, xMaxAll = -32768, yMaxAll = -32768, maxPts = 0, maxCont = 0;
for (const g of glyphs) {
  hmtx.u16(g.adv * UNIT);
  if (!g.pixels.length) { hmtx.i16(0); loca.push(loca[loca.length - 1]); continue; }
  const contours = trace(g.pixels);
  const pts = [].concat(...contours);
  const xs = pts.map((p) => p[0] * UNIT), ys = pts.map((p) => p[1] * UNIT);
  const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
  xMinAll = Math.min(xMinAll, xMin); yMinAll = Math.min(yMinAll, yMin); xMaxAll = Math.max(xMaxAll, xMax); yMaxAll = Math.max(yMaxAll, yMax);
  maxPts = Math.max(maxPts, pts.length); maxCont = Math.max(maxCont, contours.length);
  hmtx.i16(xMin);
  const w = new W();
  w.i16(contours.length).i16(xMin).i16(yMin).i16(xMax).i16(yMax);
  let end = -1;
  contours.forEach((c) => { end += c.length; w.u16(end); });
  w.u16(0); // nincs hint
  pts.forEach(() => w.u8(1)); // minden pont görbén van
  let px = 0; xs.forEach((x) => { w.i16(x - px); px = x; });
  let py = 0; ys.forEach((y) => { w.i16(y - py); py = y; });
  if (w.b.length % 2) w.u8(0);
  glyfParts.push(w.buf());
  loca.push(loca[loca.length - 1] + w.b.length);
}
const glyf = Buffer.concat(glyfParts);
const locaW = new W(); loca.forEach((v) => locaW.u32(v));

const head = new W();
head.u32(0x00010000).u32(0x00010000).u32(0).u32(0x5F0F3CF5).u16(0x000B).u16(UPM)
  .u32(0).u32(0xE0000000).u32(0).u32(0xE0000000)
  .i16(xMinAll).i16(yMinAll).i16(xMaxAll).i16(yMaxAll).u16(0).u16(8).i16(2).i16(1).i16(0);

const hhea = new W();
hhea.u32(0x00010000).i16(ASC * UNIT).i16(-DESC * UNIT).i16(0).u16(Math.max(...glyphs.map((g) => g.adv)) * UNIT)
  .i16(0).i16(0).i16(xMaxAll).i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(glyphs.length);

const maxp = new W();
maxp.u32(0x00010000).u16(glyphs.length).u16(maxPts).u16(maxCont).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0);

const os2 = new W();
os2.u16(3).i16(Math.round(glyphs.reduce((s, g) => s + g.adv, 0) / glyphs.length) * UNIT).u16(700).u16(5).u16(0)
  .i16(UNIT * 10).i16(UNIT * 10).i16(0).i16(UNIT * 2).i16(UNIT * 10).i16(UNIT * 10).i16(0).i16(UNIT * 6).i16(UNIT).i16(UNIT * 5).i16(0)
  .bytes([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).u32(1).u32(0).u32(0).u32(0).bytes([83, 79, 76, 82]).u16(0x0020 | 0x0040)
  .u16(chars[0].codePointAt(0)).u16(chars[chars.length - 1].codePointAt(0)).i16(ASC * UNIT).i16(-DESC * UNIT).i16(0).u16(ASC * UNIT).u16(DESC * UNIT).u32(1).u32(0).i16(XH * UNIT).i16(CAP * UNIT).u16(0).u16(32).u16(0);

const post = new W();
post.u32(0x00030000).u32(0).i16(-UNIT).i16(UNIT).u32(0).u32(0).u32(0).u32(0).u32(0);

const strs = [[0, 'Solaryn'], [1, 'Solaryn Block'], [2, 'Regular'], [3, 'SolarynBlock-1.0'], [4, 'Solaryn Block'], [5, 'Version 1.0'], [6, 'SolarynBlock-Regular']];
const nameW = new W(), strBuf = new W();
nameW.u16(0).u16(strs.length).u16(6 + strs.length * 12);
strs.forEach(([id, s]) => {
  const off = strBuf.b.length;
  [...s].forEach((c) => strBuf.u16(c.charCodeAt(0)));
  nameW.u16(3).u16(1).u16(0x0409).u16(id).u16(s.length * 2).u16(off);
});
nameW.bytes(strBuf.b);

// cmap, 4-es formátum: minden jel külön szakasz
const segs = [];
glyphs.forEach((g, i) => { if (g.ch) segs.push({ c: g.ch.codePointAt(0), i }); });
segs.push({ c: 0xFFFF, i: 0 });
const segCount = segs.length;
const entrySel = Math.floor(Math.log2(segCount));
const cmapSub = new W();
cmapSub.u16(4).u16(16 + segCount * 8).u16(0).u16(segCount * 2).u16(2 ** (entrySel + 1)).u16(entrySel).u16(segCount * 2 - 2 ** (entrySel + 1));
segs.forEach((s) => cmapSub.u16(s.c));
cmapSub.u16(0);
segs.forEach((s) => cmapSub.u16(s.c));
segs.forEach((s) => cmapSub.u16(s.c === 0xFFFF ? 1 : (s.i - s.c + 65536) % 65536));
segs.forEach(() => cmapSub.u16(0));
const cmap = new W();
cmap.u16(0).u16(1).u16(3).u16(1).u32(12).bytes(cmapSub.b);

const tables = {
  'OS/2': os2.buf(), cmap: cmap.buf(), glyf, head: head.buf(), hhea: hhea.buf(), hmtx: hmtx.buf(), loca: locaW.buf(), maxp: maxp.buf(), name: nameW.buf(), post: post.buf()
};
const tags = Object.keys(tables).sort();

// head.checkSumAdjustment a teljes sfnt-ből
const numT = tags.length, es = Math.floor(Math.log2(numT));
const dir = new W();
dir.u32(0x00010000).u16(numT).u16(16 * 2 ** es).u16(es).u16(numT * 16 - 16 * 2 ** es);
let offset = 12 + numT * 16;
const sfntBody = [];
tags.forEach((t) => {
  const b = tables[t];
  [...t.padEnd(4)].forEach((c) => dir.u8(c.charCodeAt(0)));
  dir.u32(checksum(b)).u32(offset).u32(b.length);
  const pad = Buffer.alloc((4 - b.length % 4) % 4);
  sfntBody.push(b, pad);
  offset += b.length + pad.length;
});
const sfnt = Buffer.concat([dir.buf(), ...sfntBody]);
const adjust = (0xB1B0AFBA - checksum(sfnt)) >>> 0;
tables.head.writeUInt32BE(adjust, 8);

// WOFF 1.0 csomagolás
const parts = [];
let woffOff = 44 + numT * 20;
const woffDir = new W();
tags.forEach((t) => {
  const orig = tables[t];
  const comp = zlib.deflateSync(orig, { level: 9 });
  const use = comp.length < orig.length ? comp : orig;
  [...t.padEnd(4)].forEach((c) => woffDir.u8(c.charCodeAt(0)));
  woffDir.u32(woffOff).u32(use.length).u32(orig.length).u32(checksum(t === 'head' ? (() => { const c = Buffer.from(orig); c.writeUInt32BE(0, 8); return c; })() : orig));
  const pad = Buffer.alloc((4 - use.length % 4) % 4);
  parts.push(use, pad);
  woffOff += use.length + pad.length;
});
const hdr = new W();
hdr.u32(0x774F4646).u32(0x00010000).u32(woffOff).u16(numT).u16(0)
  .u32(sfnt.length).u16(1).u16(0).u32(0).u32(0).u32(0).u32(0).u32(0);
const woff = Buffer.concat([hdr.buf(), woffDir.buf(), ...parts]);

const out = path.join(__dirname, '..', 'assets', 'fonts', 'solaryn-block.woff');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, woff);
console.log(`Solaryn Block: ${glyphs.length} jel, ${woff.length} bájt -> ${out}`);
