/* Felfedezések, parancssor, játék a világgal. Minden helyben marad a böngészőben. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ico = (n) => (window.pxIcon ? window.pxIcon(n) : '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const KEY = 'solarcenter.discoveries';
  const themeKey = () => document.documentElement.getAttribute('data-theme') || 'solaryn';
  const world = () => window.solarWorld;

  const THEME_NAMES = {
    solaryn: 'Solaryn sötét', 'solaryn-light': 'Solaryn világos', ice: 'Jégkék', crimson: 'Bíbor', emerald: 'Smaragd', amethyst: 'Ametiszt', turquoise: 'Türkiz',
    halloween: 'Halloween', christmas: 'Karácsony', newyear: 'Újév', valentine: 'Valentin-nap', carnival: 'Farsang', easter: 'Húsvét', national: 'Nemzeti ünnep', summer: 'Nyár'
  };

  // Hol van elásva az adott világ kincse
  const TREASURE_VIEW = {
    solaryn: 'faq', 'solaryn-light': 'security', ice: 'ranks', crimson: 'sanction', emerald: 'players', amethyst: 'cosmetics', turquoise: 'market',
    halloween: 'casino', christmas: 'coin', newyear: 'wallet', valentine: 'transfer', carnival: 'trades', easter: 'skin', national: 'ledger', summer: 'redeem'
  };
  const TREASURE_ICON = { sun: 'gem', nugget: 'gem', star: 'gem', ember: 'gem', gem: 'gem', geode: 'gem', pearl: 'gem', skull: 'skull', gift: 'gift', cork: 'coin', heart: 'heart', mask: 'mask', egg: 'egg', cockade: 'shield', chest: 'chest' };

  const SECRETS = {
    'solaryn-light': { hit: 'sun', n: 3, id: 's:light', t: 'Naptej', d: 'Háromszor belenéztél a Napba a világos világban.', h: 'A Napos dombokon.' },
    ice: { hit: 'prop:snowman', n: 3, id: 's:ice', t: 'Olvadáspont', d: 'Addig bökdösted a hóembert, amíg megunta.', h: 'Valaki áll a hóban.' },
    crimson: { hit: 'moon', n: 3, id: 's:crimson', t: 'Vérhold', d: 'Megbámultad a vörös Holdat. Ő is téged.', h: 'Nézz fel a parázsföldön.' },
    emerald: { hit: 'firefly', n: 5, id: 's:emerald', t: 'Befőttesüveg', d: 'Elkaptál öt szentjánosbogarat.', h: 'Az erdőben valami világít.' },
    amethyst: { hit: 'prop:crystal', n: 4, id: 's:amethyst', t: 'Kristályhárfa', d: 'Négy kristályt szólaltattál meg.', h: 'A völgyben minden csendül.' },
    turquoise: { hit: 'bubble', n: 20, id: 's:turquoise', t: 'Buborékpukkasztó', d: 'Húsz buborék. Remek délután volt.', h: 'A víz alatt mindig van mit pukkasztani.' },
    halloween: { hit: 'prop:pumpkin', n: 3, id: 's:halloween', t: 'Tökfej', d: 'Három tököt zörgettél meg.', h: 'Ki faragta ezeket?' },
    christmas: { hit: 'prop:present', n: 3, id: 's:christmas', t: 'Korai kibontás', d: 'Még nincs is karácsony este.', h: 'Valami a fa alatt vár.' },
    newyear: { hit: 'sky', n: 10, id: 's:newyear', t: 'Tűzszerész', d: 'Tíz rakétát lőttél fel kézzel.', h: 'Az ég a határ. Szó szerint.' },
    valentine: { hit: 'prop:heart', n: 3, id: 's:valentine', t: 'Szívtipró', d: 'Három szívbokrot simogattál meg.', h: 'A rózsakertben.' },
    carnival: { hit: 'prop:mask', n: 2, id: 's:carnival', t: 'Álarcosbál', d: 'Felpróbáltad az álarcokat.', h: 'Ki van mögötte?' },
    easter: { hit: 'prop:egg', n: 3, id: 's:easter', t: 'Tojásvadász', d: 'Három hímes tojást találtál a réten.', h: 'A fűben keresd.' },
    national: { hit: 'prop:flag', n: 1, id: 's:national', t: 'Zászlófelvonás', d: 'Tisztelegtél a zászló előtt.', h: 'Az ünnepi téren leng valami.' },
    summer: { hit: 'prop:sandcastle', n: 3, id: 's:summer', t: 'Homokvár-építész', d: 'Háromszor javítottad ki a vár bástyáját.', h: 'A parton.' }
  };

  const GLOBAL = [
    { id: 'console', t: 'Parancssor', d: 'Kiadtad az első parancsodat.', h: 'Nyomd meg a / gombot.', i: 'terminal' },
    { id: 'sun', t: 'Ne nézz bele', d: 'Ötször megböktéd a Napot.', h: 'Valami fényes van az égen.', i: 'sun' },
    { id: 'moon', t: 'Holdkóros', d: 'Ötször megböktéd a Holdat.', h: 'Éjszaka keresd.', i: 'moon' },
    { id: 'star', t: 'Kívánság', d: 'Elkaptál egy hullócsillagot.', h: 'Ritka, és gyors.', i: 'sun' },
    { id: 'portal', t: 'Átjáró', d: 'Átléptél a portálon.', h: 'A főkapu nem csak dísz.', i: 'key' },
    { id: 'critter', t: 'Állatbarát', d: 'Tízszer megsimogattad a jószágokat.', h: 'Ők is itt élnek.', i: 'heart' },
    { id: 'letters', t: 'Bontási engedély', d: 'Lebontottad a feliratot az égről. Reméljük, örülsz.', h: 'A betűk csak lazán állnak.', i: 'hammer' },
    { id: 'doll', t: 'Ez te vagy', d: 'Megtaláltad magad a horizonton.', h: 'Az aloldalakon valaki áll a jobb szélen.', i: 'skin' },
    { id: 'konami', t: 'Régi iskola', d: 'Ismered a klasszikus kódot.', h: 'Fel, fel, le, le...', i: 'wrench' },
    { id: 'builder', t: 'Építőmester', d: 'Tíz blokkot raktál a világba.', h: 'Először kreatív mód kell.', i: 'menu' },
    { id: 'f3', t: 'Hibakereső', d: 'Belenéztél a világ számaiba.', h: 'Egy régi billentyű.', i: 'list' },
    { id: 'kill', t: 'Újjászületés', d: 'Parancsba adtad a saját halálodat.', h: 'Van rá parancs.', i: 'skull' },
    { id: 'bedrock', t: 'Törhetetlen', d: 'Ötször csákányoztad az alapkőzetet.', h: 'Görgess le a legaljára.', i: 'hammer' },
    { id: 'photo', t: 'Fotómód', d: 'Eltüntetted a felületet, hogy lásd a tájat.', h: 'Néző módba is kapcsolhatsz.', i: 'search' },
    { id: 'word', t: 'Varázsszó', d: 'Kimondtad a szerver nevét.', h: 'Gépeld be, hogy hová tartozol.', i: 'pen' },
    { id: 'midnight', t: 'Éjszakai műszak', d: 'Éjfél után is itt vagy.', h: 'Gyere el nagyon későn.', i: 'moon' },
    { id: 'dawn', t: 'Korán kelő', d: 'Hajnalban néztél be.', h: 'Gyere el nagyon korán.', i: 'sun' },
    { id: 'fullmoon', t: 'Telihold', d: 'Teliholdkor jártál erre.', h: 'A valódi Holdat figyeld.', i: 'moon' },
    { id: 'tourist', t: 'Világjáró', d: 'Végignézted az összes alap világot.', h: 'Válts világot többször.', i: 'sun' },
    { id: 'miner', t: 'Bányász', d: 'Tizenhat blokkot bontottál ki a kőzetből.', h: 'Az akna fala mögött nem csak dísz a kő.', i: 'hammer' }
  ];

  function catalog() {
    const items = GLOBAL.map((g) => Object.assign({ group: 'Világszerte' }, g));
    const S = window.SolarWorld.STRATA;
    Object.keys(THEME_NAMES).forEach((k) => {
      const st = S[k];
      if (st) items.push({ id: 't:' + k, group: THEME_NAMES[k], t: st.name, d: 'Kiástad a föld alól.', h: 'Valahol a föld alatt, egy oldal szélén, ebben a világban.', i: TREASURE_ICON[st.treasure] || 'gem' });
      const sc = SECRETS[k];
      if (sc) items.push({ id: sc.id, group: THEME_NAMES[k], t: sc.t, d: sc.d, h: sc.h, i: 'trophy' });
    });
    return items;
  }

  const found = store.get(KEY, {});
  const has = (id) => !!found[id];
  function countFor(k) {
    const list = catalog().filter((c) => c.group === THEME_NAMES[k]);
    return [list.filter((c) => has(c.id)).length, list.length];
  }

  // ---- Hang: rövid négyszögjel-dallamok, nincs hangfájl -------------------------------------------
  let audio = null;
  const soundOn = () => store.get('solarcenter.sound', false);
  function blip(notes, type, vol) {
    if (!soundOn()) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      let t = audio.currentTime;
      notes.forEach(([f, d]) => {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = type || 'square';
        o.frequency.value = f;
        g.gain.setValueAtTime(vol || 0.04, t);
        g.gain.linearRampToValueAtTime(0, t + d);
        o.connect(g).connect(audio.destination);
        o.start(t);
        o.stop(t + d);
        t += d * 0.9;
      });
    } catch {}
  }
  const CHIME = [[523, 0.08], [659, 0.08], [784, 0.08], [1047, 0.16]];

  // ---- Felfedezés -------------------------------------------------------------------------------
  function discover(id) {
    if (has(id)) return false;
    const item = catalog().find((c) => c.id === id);
    if (!item) return false;
    found[id] = Date.now();
    store.set(KEY, found);
    const el = document.createElement('div');
    el.className = 'discover-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `${ico(item.i)}<div><small>Felfedezés</small><b>${esc(item.t)}</b><p>${esc(item.d)}</p></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5200);
    blip(CHIME);
    return true;
  }

  // ---- Lista --------------------------------------------------------------------------------------
  function openList() {
    closeList();
    const items = catalog();
    const groups = [];
    items.forEach((c) => { if (!groups.includes(c.group)) groups.push(c.group); });
    const done = items.filter((c) => has(c.id)).length;
    const wrap = document.createElement('div');
    wrap.className = 'quest-overlay';
    wrap.id = 'questOverlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Felfedezések');
    const bars = 40;
    const on = Math.round((done / items.length) * bars);
    wrap.innerHTML = `<div class="quest-card">
      <button type="button" class="btn-outline quest-close" id="questClose">Bezárás</button>
      <h2>Felfedezések</h2>
      <p>${done} / ${items.length}. Ebben a böngészőben tartjuk nyilván.</p>
      <div class="quest-bar" aria-hidden="true">${Array.from({ length: bars }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</div>
      ${groups.map((g) => `<div class="quest-group">${esc(g)}</div><div class="quest-grid">${items.filter((c) => c.group === g).map((c) => `
        <div class="quest-item${has(c.id) ? ' found' : ''}">${ico(has(c.id) ? c.i : 'menu')}<div><b>${esc(has(c.id) ? c.t : '???')}</b><span>${esc(has(c.id) ? c.d : c.h)}</span></div></div>`).join('')}</div>`).join('')}
    </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) closeList(); });
    $('#questClose', wrap).addEventListener('click', closeList);
    $('#questClose', wrap).focus();
  }
  function closeList() { const o = $('#questOverlay'); if (o) o.remove(); }

  // ---- Játék a világgal ---------------------------------------------------------------------------
  const counters = {};
  function bump(key) { counters[key] = (counters[key] || 0) + 1; return counters[key]; }

  const CLICK_FX = {
    solaryn: ['#ffd25a', '#ffb732', '#fff0b0'], 'solaryn-light': ['#ffd25a', '#ffffff'], ice: ['#ffffff', '#bfe8ff'], crimson: ['#ff7a2a', '#ffc14a', '#ff3b1f'],
    emerald: ['#7fd070', '#e6f58a'], amethyst: ['#e6d0ff', '#b565ff', '#ffffff'], turquoise: ['#bff4f4', '#ffffff'], halloween: ['#ff8a1f', '#b46cff'],
    christmas: ['#ffffff', '#ff4f4f', '#7ae07a'], newyear: ['#f5cf5b', '#ffffff'], valentine: ['#ff5c8a', '#ffc0d4'], carnival: ['#ffd23f', '#43d3ff', '#ff5a6e', '#7ae07a'],
    easter: ['#f7b3d4', '#9be3a8', '#ffe28a'], national: ['#e8343f', '#ffffff', '#3fae5a'], summer: ['#ffcf3a', '#2fd0e3']
  };

  function bindWorld(w) {
    w.on('placed', (d) => { if (d.count >= 10) discover('builder'); blip([[320, 0.03]], 'square', 0.02); });
    w.on('broken', () => blip([[160, 0.05]], 'square', 0.03));
    w.on('land', () => blip([[120, 0.06]], 'square', 0.03));
    w.on('sky', (d) => {
      const key = themeKey();
      const cfg = window.SolarWorld.THEMES[key] || {};
      if (cfg.fireworks) w.firework(d.m.x, d.m.y);
      else w.burst(d.m.x, d.m.y, CLICK_FX[key] || CLICK_FX.solaryn, 12, { v: 0.7, life: 26, g: key === 'crimson' ? -0.01 : 0.02 });
      blip([[880, 0.03]], 'square', 0.015);
      const sc = SECRETS[key];
      if (sc && sc.hit === 'sky' && bump('sky') >= sc.n) discover(sc.id);
    });
    w.on('hit', (h) => {
      const key = themeKey();
      const sc = SECRETS[key];
      const colors = CLICK_FX[key] || CLICK_FX.solaryn;
      switch (h.id) {
        case 'sun':
          w.sunWobble = 3;
          w.burst(h.m.x, h.m.y, ['#ffd25a', '#fff6d0'], 18, { v: 1, life: 28 });
          blip([[660, 0.05], [880, 0.05]]);
          if (bump('sun') >= 5) discover('sun');
          break;
        case 'moon':
          w.burst(h.m.x, h.m.y, ['#e9edf6', '#a8c8ff'], 14, { v: 0.7, life: 30, g: 0 });
          blip([[330, 0.1], [262, 0.14]], 'triangle', 0.05);
          if (bump('moon') >= 5) discover('moon');
          break;
        case 'star':
          w.meteor = null;
          w.burst(h.m.x, h.m.y, ['#ffffff', '#ffe8b0'], 30, { v: 1.2, life: 40 });
          discover('star');
          break;
        case 'portal':
          w.portalFlash = 0.9;
          blip([[220, 0.08], [330, 0.08], [494, 0.08], [740, 0.12]], 'sawtooth', 0.03);
          if ($('#appScreen').classList.contains('hidden')) break;
          discover('portal');
          setTimeout(() => {
            const views = ['ranks', 'coin', 'skin', 'cosmetics', 'market', 'players', 'casino', 'faq', 'security'];
            window.switchView(views[Math.floor(Math.random() * views.length)]);
          }, 320);
          break;
        case 'critter':
          h.critter.jump = 8;
          h.critter.pets = (h.critter.pets || 0) + 1;
          w.burst(h.m.x, h.m.y - 6, ['#ff7a9a', '#ffc0d4'], 6, { v: 0.4, up: 0.5, g: 0.01, life: 24 });
          blip([[587, 0.06], [784, 0.08]], 'square', 0.03);
          if (bump('critter') >= 10) discover('critter');
          break;
        case 'letter':
          w.dropBlock(h.block);
          blip([[196, 0.05]], 'square', 0.03);
          if (bump('letter') >= 12) discover('letters');
          break;
        case 'friend':
          if (typeof window.openPlayerProfile === 'function') window.openPlayerProfile(h.name);
          break;
        case 'doll':
          w.dollWalk += 1;
          w.burst(h.m.x, h.m.y, colors, 8, { v: 0.5, life: 20 });
          if (bump('doll') >= 3) discover('doll');
          break;
        case 'bubble':
          w.removeParticle(h.index);
          w.burst(h.m.x, h.m.y, ['#ffffff', '#bff4f4'], 5, { v: 0.5, life: 12, g: 0 });
          blip([[1200, 0.02]], 'square', 0.02);
          break;
        case 'firefly':
          w.removeParticle(h.index);
          w.burst(h.m.x, h.m.y, ['#e6f58a'], 4, { v: 0.3, life: 14, g: 0 });
          blip([[1047, 0.04]], 'triangle', 0.04);
          break;
        default:
          if (h.id && h.id.startsWith('prop:')) {
            w.burst(h.m.x, h.m.y, colors, 14, { v: 0.8, life: 26 });
            if (h.id === 'prop:crystal') {
              const scale = [523, 587, 659, 784, 880];
              blip([[scale[h.tone || 0], 0.25]], 'triangle', 0.06);
            } else blip([[660, 0.04], [523, 0.05]], 'square', 0.03);
          }
      }
      if (sc && sc.hit === h.id) {
        if (sc.hit === 'prop:egg') {
          counters.eggs = counters.eggs || new Set();
          counters.eggs.add(h.uid);
          if (counters.eggs.size >= sc.n) discover(sc.id);
        } else if (bump('secret:' + key) >= sc.n) discover(sc.id);
      }
    });
  }

  // ---- Elásott kincs ------------------------------------------------------------------------------
  function placeTreasure(view) {
    const old = $('.treasure');
    if (old) old.remove();
    const key = themeKey();
    const st = window.SolarWorld.STRATA[key];
    if (!st || TREASURE_VIEW[key] !== view || has('t:' + key)) return;
    const under = $('.world-under');
    if (!under) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'treasure';
    b.setAttribute('aria-label', 'Valami csillog a földben');
    b.style.setProperty('--vein', st.vein);
    b.innerHTML = ico(TREASURE_ICON[st.treasure] || 'gem');
    const place = () => {
      const content = $('.app-content');
      const rect = content.getBoundingClientRect();
      const gutter = Math.max(0, rect.left);
      const h = under.getBoundingClientRect().height;
      if (gutter > 72) {
        b.style.left = `${Math.round((gutter - 48) / 2 - 16)}px`;
        b.style.top = `${Math.round(clampN(h * 0.42, 120, Math.max(160, h - 260)))}px`;
      } else {
        b.style.left = `${Math.round(window.innerWidth * 0.82)}px`;
        b.style.bottom = '26px';
        b.style.top = 'auto';
      }
    };
    under.appendChild(b);
    setTimeout(place, 400);
    b.addEventListener('click', () => {
      discover('t:' + key);
      blip([[392, 0.08], [523, 0.08], [659, 0.12]]);
      b.remove();
    });
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---- Konzol -------------------------------------------------------------------------------------
  let con, input, sug, log, sel = -1, history = store.get('solarcenter.console', []), histPos = -1;

  const VIEWS = () => $$('.app-nav-item[data-view]').filter((b) => !b.classList.contains('hidden')).map((b) => ({ view: b.dataset.view, label: ($('span', b) || b).textContent.trim() }));
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '');
  const findView = (q) => {
    const n = norm(q);
    return VIEWS().find((v) => norm(v.label) === n || norm(v.view) === n) || VIEWS().find((v) => norm(v.label).startsWith(n) || norm(v.view).startsWith(n)) || VIEWS().find((v) => norm(v.label).includes(n));
  };

  const name = () => { const e = $('#topbarUsername'); return e ? e.textContent.trim() : 'Te'; };

  const COMMANDS = {
    help: { d: 'Parancsok listája', run() { say('Parancsok: ' + Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hide).map((k) => '/' + k).join(' ')); } },
    tp: { d: 'Ugrás oldalra: /tp rangok', args: () => VIEWS().map((v) => norm(v.label)), run(a) {
      if (!a[0]) return say('Hová? Például: /tp rangok', 'err');
      const v = findView(a.join(' '));
      if (!v) return say('Nincs ilyen hely: ' + a.join(' '), 'err');
      window.switchView(v.view);
      say('Teleportálva: ' + v.label, 'ok');
    } },
    time: { d: 'Napszak: /time set night', args: () => ['set day', 'set night', 'set dawn', 'set dusk', 'set real'], run(a) {
      const m = a[0] === 'set' ? a[1] : a[0];
      const map = { day: 'day', nappal: 'day', night: 'night', ejszaka: 'night', dawn: 'dawn', hajnal: 'dawn', dusk: 'dusk', alkony: 'dusk', real: null, valos: null };
      if (!(m in map)) return say('Lehet: day, night, dawn, dusk, real', 'err');
      world().setTime(map[m]);
      say(map[m] ? 'Az idő átállítva: ' + m : 'Vissza a valós napszakhoz.', 'ok');
    } },
    weather: { d: 'Időjárás: /weather rain', args: () => ['clear', 'rain', 'snow', 'thunder', 'embers', 'bubbles', 'petals', 'real'], run(a) {
      const k = a[0];
      if (!k) return say('Lehet: clear, rain, snow, thunder, embers, bubbles, petals, real', 'err');
      if (k === 'real') world().setWeather(null);
      else if (k === 'thunder') { world().setWeather('rain'); world().weatherOverride = 'rain'; world().flash = 1; world().thunder = true; }
      else world().setWeather(k);
      say('Időjárás: ' + k, 'ok');
    } },
    theme: { d: 'Világváltás: /theme ice', args: () => ['solaryn', 'solaryn-light', 'ice', 'crimson', 'emerald', 'amethyst', 'turquoise'], run(a) {
      const k = a[0];
      if (!k) return say('Melyik világ?', 'err');
      const opt = $(`.topbar-theme-option[data-theme="${CSS.escape(k)}"]`);
      if (!opt) return say('Ez a világ most nem érhető el.', 'err');
      opt.click();
      say('Áttelepültél: ' + (THEME_NAMES[k] || k), 'ok');
    } },
    gamemode: { d: 'creative, survival, spectator', args: () => ['creative', 'survival', 'spectator'], run(a) {
      const m = a[0];
      if (m === 'creative' || m === '1') setCreative(true);
      else if (m === 'survival' || m === '0') { setCreative(false); setPhoto(false); say('Vissza túlélő módba.', 'ok'); }
      else if (m === 'spectator' || m === '3') setPhoto(true);
      else say('Lehet: creative, survival, spectator', 'err');
    } },
    setblock: { d: 'Blokk választása építő módhoz', args: () => window.SolarWorld.BLOCK_KINDS.map((b) => b.k), run(a) {
      const kinds = window.SolarWorld.BLOCK_KINDS.map((b) => b.k);
      if (!kinds.includes(a[0])) return say('Lehet: ' + kinds.join(', '), 'err');
      world().blockKind = a[0];
      renderBuildBar();
      say('Blokk kiválasztva: ' + a[0], 'ok');
    } },
    felfedezesek: { d: 'Mit találtál eddig', run() { openList(); } },
    hang: { d: 'Hangok be vagy ki', run() { const v = !soundOn(); store.set('solarcenter.sound', v); say(v ? 'Hang bekapcsolva.' : 'Hang kikapcsolva.', 'ok'); if (v) blip(CHIME); renderPanelHead(); } },
    ip: { d: 'Szerver IP másolása', run() {
      try { navigator.clipboard.writeText('play.solaryn.hu'); } catch {}
      say('play.solaryn.hu kimásolva. Találkozunk odabent.', 'ok');
    } },
    discord: { d: 'Discord megnyitása', run() { window.open('https://dc.solaryn.hu', '_blank', 'noopener'); } },
    seed: { hide: true, run() { say('Seed: ' + themeKey() + '-' + new Date().getFullYear()); } },
    kill: { d: 'Ne.', run() { die(); } },
    give: { hide: true, run(a) { say(`Szép próbálkozás, ${name()}. Az adminok látták.`, 'err'); } },
    op: { hide: true, run() { say('A szerver megfontolta a kérést, és nevetett.', 'err'); } },
    ban: { hide: true, run(a) { say(a[0] ? `${a[0]} megúszta. Egyelőre.` : 'Kit?', 'err'); } },
    stop: { hide: true, run() { say('Leállítás... csak vicceltünk.', 'err'); } },
    me: { hide: true, run(a) { say(`* ${name()} ${a.join(' ')}`, 'me'); } },
    say: { hide: true, run(a) { say(`[${name()}] ${a.join(' ')}`, 'me'); } },
    summon: { hide: true, run() {
      const w = world();
      const c = w.critters[0];
      if (!c) return say('Itt senki nem jön elő.', 'err');
      c.jump = 8;
      c.x = w.camX + 40;
      c.home = c.x;
      say('Megjött.', 'ok');
    } },
    buborek: { hide: true, run() { world().setWeather('bubbles'); say('Buborékok a levegőben.', 'ok'); } },
    clear: { d: 'Üzenetek törlése', run() { log.innerHTML = ''; } }
  };

  function say(text, cls) {
    if (!log) return;
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    log.appendChild(p);
    while (log.children.length > 8) log.firstChild.remove();
    setTimeout(() => { if (p.isConnected && !con.classList.contains('open')) p.remove(); }, 9500);
  }

  function buildConsole() {
    con = document.createElement('div');
    con.className = 'console';
    con.innerHTML = '<div class="console-log" aria-live="polite"></div><div class="console-sug" role="listbox"></div><div class="console-box"><b>/</b><input type="text" spellcheck="false" autocomplete="off" aria-label="Parancs" maxlength="120" /></div>';
    $('#appScreen').appendChild(con);
    input = $('input', con); sug = $('.console-sug', con); log = $('.console-log', con);
    input.addEventListener('input', () => { sel = -1; histPos = -1; suggest(); });
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { closeConsole(); return; }
      if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
      const items = $$('button', sug);
      if (e.key === 'Tab') {
        e.preventDefault();
        const it = items[sel >= 0 ? sel : 0];
        if (it) { input.value = it.dataset.fill + (it.dataset.more ? ' ' : ''); sel = -1; suggest(); }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        if (items.length && input.value) {
          sel = (sel + dir + items.length) % items.length;
          items.forEach((b, i) => b.classList.toggle('sel', i === sel));
          items[sel].scrollIntoView({ block: 'nearest' });
        } else if (history.length) {
          histPos = clampN(histPos + (dir < 0 ? 1 : -1), -1, history.length - 1);
          input.value = histPos >= 0 ? history[history.length - 1 - histPos] : '';
        }
      }
    });
    sug.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      input.value = b.dataset.fill;
      if (b.dataset.more) { input.value += ' '; input.focus(); suggest(); } else submit();
    });
  }

  function suggest() {
    const v = input.value;
    const parts = v.split(/\s+/);
    let html = '';
    if (parts.length <= 1) {
      const q = norm(parts[0] || '');
      const cmds = Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hide && k.startsWith(q));
      html += cmds.map((k) => `<button type="button" data-fill="${k}" ${COMMANDS[k].args ? 'data-more="1"' : ''}>${k}<span>${esc(COMMANDS[k].d)}</span></button>`).join('');
      if (q) {
        html += VIEWS().filter((p) => norm(p.label).includes(q)).slice(0, 6).map((p) => `<button type="button" data-fill="tp ${norm(p.label)}">${esc(p.label)}<span>Ugrás</span></button>`).join('');
      }
    } else {
      const c = COMMANDS[norm(parts[0])];
      if (c && c.args) {
        const rest = parts.slice(1).join(' ').toLowerCase();
        html = c.args().filter((x) => x.startsWith(rest)).slice(0, 8).map((x) => `<button type="button" data-fill="${parts[0]} ${esc(x)}">${esc(x)}</button>`).join('');
      }
    }
    sug.innerHTML = html;
    sug.classList.toggle('has', !!html);
  }

  function submit() {
    const items = $$('button', sug);
    let raw = input.value.trim();
    if (sel >= 0 && items[sel]) raw = items[sel].dataset.fill;
    if (!raw) { closeConsole(); return; }
    raw = raw.replace(/^\//, '');
    history.push(raw);
    history = history.slice(-30);
    store.set('solarcenter.console', history);
    const [cmd, ...args] = raw.split(/\s+/);
    const c = COMMANDS[norm(cmd)];
    closeConsole();
    if (c) { discover('console'); c.run(args); return; }
    const v = findView(raw);
    if (v) { discover('console'); window.switchView(v.view); return; }
    say(`Ismeretlen parancs: /${cmd}. Próbáld: /help`, 'err');
  }

  function openConsole(prefill) {
    if ($('#appScreen').classList.contains('hidden') || !con) return;
    con.classList.add('open');
    input.value = prefill || '';
    sel = -1; histPos = -1;
    suggest();
    input.focus();
  }
  function closeConsole() {
    if (!con) return;
    con.classList.remove('open');
    sug.classList.remove('has');
    input.blur();
    $$('p', log).forEach((p) => { p.style.animation = 'none'; void p.offsetWidth; p.style.animation = ''; setTimeout(() => p.isConnected && p.remove(), 9500); });
  }

  // ---- Módok --------------------------------------------------------------------------------------
  let buildBar = null;
  let clearArm = false;
  function renderBuildBar() {
    if (!buildBar) return;
    const w = world();
    const kinds = window.SolarWorld.BLOCK_KINDS;
    const cur = w.blockKind || 'stone';
    buildBar.innerHTML = '<div class="build-swatches">' + kinds.map((b, i) => `<button type="button" class="build-swatch${b.k === cur ? ' active' : ''}" data-kind="${b.k}" title="${esc(b.label)}" aria-label="${esc(b.label)}"><i style="background:${b.c}"></i><kbd>${i + 1}</kbd></button>`).join('') + '</div>'
      + `<div class="build-tools"><span>Bal: rakás. Jobb: bontás. Húzással több is. A/D: kamera.</span><button type="button" data-tool="undo">Vissza</button><button type="button" data-tool="clear">${clearArm ? 'Biztos?' : 'Mind törlése'}</button><button type="button" data-tool="done" class="build-done">Kész</button></div>`;
  }
  function setCreative(on) {
    const w = world();
    w.creative = on;
    w.setCursor(null);
    document.documentElement.classList.toggle('building', on);
    if (on) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (!buildBar) {
        buildBar = document.createElement('div');
        buildBar.className = 'build-bar';
        $('#appScreen').appendChild(buildBar);
        buildBar.addEventListener('click', (e) => {
          const sw = e.target.closest('[data-kind]');
          if (sw) { world().blockKind = sw.dataset.kind; renderBuildBar(); return; }
          const tool = e.target.closest('[data-tool]');
          if (!tool) return;
          if (tool.dataset.tool === 'undo') world().undoBlock();
          if (tool.dataset.tool === 'done') setCreative(false);
          if (tool.dataset.tool === 'clear') {
            if (clearArm) { world().clearBlocks(); clearArm = false; } else { clearArm = true; setTimeout(() => { clearArm = false; renderBuildBar(); }, 2500); }
            renderBuildBar();
          }
        });
      }
      buildBar.classList.remove('hidden');
      renderBuildBar();
    } else if (buildBar) buildBar.classList.add('hidden');
  }
  function setPhoto(on) {
    document.documentElement.classList.toggle('photo-mode', on);
    if (on) { discover('photo'); window.scrollTo(0, 0); say('Néző mód. Esc: vissza.', 'ok'); }
  }

  function die() {
    if ($('.death-screen')) return;
    const el = document.createElement('div');
    el.className = 'death-screen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Meghaltál');
    const scoreEl = $('.stat-badge[data-stat="coin"] .stat-badge-value');
    const reasons = ['túl közel ment a Naphoz', 'parancsba adta a saját halálát', 'nem olvasta el az ÁSZF-et', 'rálépett egy legóra'];
    el.innerHTML = `<h2>Meghaltál!</h2><p>${esc(name())} ${reasons[Math.floor(Math.random() * reasons.length)]}.</p><p>PP-t nem veszítettél${scoreEl ? ': ' + esc(scoreEl.textContent) : ''}.</p><button type="button" class="btn-glow">Újjászületés</button>`;
    document.body.appendChild(el);
    blip([[196, 0.2], [147, 0.3]], 'sawtooth', 0.05);
    const btn = $('button', el);
    btn.focus();
    btn.addEventListener('click', () => {
      el.remove();
      discover('kill');
      window.switchView('home');
    });
  }

  // ---- Hibakereső (F3) -----------------------------------------------------------------------------
  let hud = null, hudTimer = null, frames = 0, fps = 0, lastFps = performance.now();
  function countFrame() {
    frames++;
    const now = performance.now();
    if (now - lastFps > 1000) { fps = Math.round((frames * 1000) / (now - lastFps)); frames = 0; lastFps = now; }
    if (hud) requestAnimationFrame(countFrame);
  }
  function renderHud() {
    const w = world();
    if (!hud || !w) return;
    const st = w.solarNow();
    const cfg = window.SolarWorld.THEMES[themeKey()] || {};
    const scrollY = window.scrollY || 0;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.round(64 - (scrollY / max) * 128);
    const phaseN = ['Újhold', 'Növő sarló', 'Első negyed', 'Növő Hold', 'Telihold', 'Fogyó Hold', 'Utolsó negyed', 'Fogyó sarló'][Math.floor(((st.phase + 1 / 16) % 1) * 8)];
    const done = Object.keys(found).length;
    const lines = [
      `SolarCenter ${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      `${fps} fps, ${w.costMs.toFixed(1)} ms, ${w.W}x${w.H} @ ${w.S}x${w.hd ? '' : ' (kímélő)'}`,
      `X: ${Math.round(w.camX)}  Y: ${y}  Z: 0`,
      `Világ: ${cfg.biome || ''}`,
      `Nézet: ${document.documentElement.getAttribute('data-view') || ''}`,
      `Óra: ${new Date().toTimeString().slice(0, 5)}  Hold: ${phaseN}`,
      `Sötétség: ${Math.round(w.env0.night * 100)}%  Fények: ${w.glowAll.length}`,
      `Időjárás: ${w.particleKind || 'tiszta'} (${w.particles.length})`,
      `Felfedezések: ${done}/${catalog().length}`
    ];
    hud.innerHTML = lines.map((l) => `<span>${esc(l)}</span>`).join('');
  }
  function toggleHud() {
    if (hud) { hud.remove(); hud = null; clearInterval(hudTimer); return; }
    hud = document.createElement('div');
    hud.className = 'debug-hud';
    document.body.appendChild(hud);
    discover('f3');
    renderHud();
    hudTimer = setInterval(renderHud, 250);
    requestAnimationFrame(countFrame);
  }

  // ---- Billentyűk ---------------------------------------------------------------------------------
  const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let konami = 0;
  let typed = '';
  function keys() {
    document.addEventListener('keydown', (e) => {
      if ($('#appScreen').classList.contains('hidden')) return;
      if (e.key === 'F3') { e.preventDefault(); toggleHud(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && world().creative) { e.preventDefault(); world().undoBlock(); return; }
      const t = e.target;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === 'Escape') {
        if (document.documentElement.classList.contains('photo-mode')) setPhoto(false);
        if (world().creative) setCreative(false);
        closeList();
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if ($('.modal-overlay:not(.hidden)')) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (world().creative) {
        const kinds = window.SolarWorld.BLOCK_KINDS;
        if (/^[1-9]$/.test(k) && kinds[Number(k) - 1]) { world().blockKind = kinds[Number(k) - 1].k; renderBuildBar(); return; }
        if (k === 'a' || k === 'd') { const w = world(); w.panTo(w.camTarget + (k === 'd' ? 56 : -56), 240); }
      }
      konami = k === KONAMI[konami] ? konami + 1 : (k === KONAMI[0] ? 1 : 0);
      if (konami === KONAMI.length) { konami = 0; discover('konami'); setCreative(!world().creative); }
      if (e.key.length === 1) {
        typed = (typed + k).slice(-12);
        if (typed.endsWith('solaryn')) {
          discover('word');
          const w = world();
          w.buildLetters(w.env0, w.cfg(), true);
          w.burst(w.W / 2, w.ground * 0.25, ['#ffd25a', '#fff0b0'], 50, { v: 1.4, life: 44 });
        }
      }
      if (e.key === '/') { e.preventDefault(); openConsole(); }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); openConsole(); }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest) return;
      if (e.target.closest('.s-bed')) {
        blip([[110, 0.05]], 'square', 0.04);
        if (bump('bedrock') >= 5) discover('bedrock');
      } else if (e.target.closest('.stratum') || e.target.classList.contains('mined')) mine(e);
    });
    window.addEventListener('solar:view', clearMined);
  }

  // ---- Bányászat az akna mellett ------------------------------------------------------------------
  const mined = new Map();
  let ores = 0;
  function clearMined() {
    mined.forEach((m) => m.el.remove());
    mined.clear();
  }
  function sparks(under, x, y) {
    for (let i = 0; i < 6; i++) {
      const s = document.createElement('i');
      s.className = 'mine-spark';
      const a = Math.random() * 6.283;
      const d = 14 + Math.random() * 22;
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px');
      s.style.setProperty('--dy', Math.round(Math.sin(a) * d - 8) + 'px');
      under.appendChild(s);
      setTimeout(() => s.remove(), 460);
    }
  }
  function mine(e) {
    const under = $('.world-under');
    const w = world();
    if (!under || !w) return;
    const size = 16 * w.scale;
    const r = under.getBoundingClientRect();
    const row = Math.floor((e.clientY - r.top) / size);
    const shift = row % 2 ? size / 2 : 0;
    const col = Math.floor((e.clientX - r.left - shift) / size);
    const key = col + ',' + row;
    let m = mined.get(key);
    if (m && m.broken) return;
    if (!m) {
      const el = document.createElement('i');
      el.className = 'mined';
      el.style.left = col * size + shift + 'px';
      el.style.top = row * size + 'px';
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      under.insertBefore(el, $('.shaft', under));
      m = { el, hits: 0 };
      mined.set(key, m);
    }
    m.hits++;
    m.el.dataset.stage = String(Math.min(3, m.hits));
    sparks(under, e.clientX - r.left, e.clientY - r.top);
    blip([[190 + m.hits * 30, 0.04]], 'square', 0.025);
    if (m.hits >= 3) {
      m.broken = true;
      if (Math.random() < 0.14) {
        const st = window.SolarWorld.STRATA[themeKey()] || {};
        m.el.style.setProperty('--vein', st.vein || 'var(--gold)');
        m.el.innerHTML = ico('gem');
        ores++;
        say(ores === 1 ? 'Érctalálat! Jól gondoltad, itt van még.' : 'Érc: ' + ores, 'ok');
      }
      if (bump('mined') >= 16) discover('miner');
    }
  }

  // ---- Mélységjelző ----------------------------------------------------------------------------------
  function bindDepth() {
    const el = document.createElement('div');
    el.className = 'depth-meter';
    el.setAttribute('aria-hidden', 'true');
    $('#appScreen').appendChild(el);
    let hideT = null;
    window.addEventListener('scroll', () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const sy = window.scrollY || 0;
      if (sy < 40) { el.classList.remove('visible'); return; }
      const under = $('.world-under');
      const top = under ? under.offsetTop : 300;
      const cell = 16 * (world() ? world().scale : 3);
      const depth = sy + window.innerHeight * 0.5 - top;
      let name = 'Felszín';
      if (depth > 0) name = 'Föld';
      if (depth > cell * 4) name = 'Kő';
      if (depth > cell * 28) name = 'Mélység';
      if (sy >= max - 30) name = 'Alapkőzet';
      const y = Math.round(64 - (sy / max) * 128);
      el.innerHTML = `<b>Y ${y}</b><span>${name}</span>`;
      el.classList.add('visible');
      clearTimeout(hideT);
      hideT = setTimeout(() => el.classList.remove('visible'), 1300);
    }, { passive: true });
  }

  // ---- Világválasztó ------------------------------------------------------------------------------
  const thumbs = {};
  const queue = [];
  let thumbBusy = false;
  function thumbFor(key, img) {
    if (thumbs[key]) { img.src = thumbs[key]; return; }
    queue.push({ key, img });
    if (!thumbBusy) pumpThumbs();
  }
  function pumpThumbs() {
    const job = queue.shift();
    if (!job) { thumbBusy = false; return; }
    thumbBusy = true;
    setTimeout(() => {
      if (!thumbs[job.key]) {
        const c = document.createElement('canvas');
        c.width = 192; c.height = 96;
        window.SolarWorld.thumb(c, job.key);
        thumbs[job.key] = c.toDataURL();
      }
      if (job.img.isConnected) job.img.src = thumbs[job.key];
      pumpThumbs();
    }, 16);
  }
  function renderPanelHead() {
    const dd = $('#topbarThemeDropdown');
    if (!dd) return;
    const head = $('.theme-panel-head', dd);
    if (!head) return;
    const items = catalog();
    const done = items.filter((c) => has(c.id)).length;
    head.innerHTML = `<div><b>Világok</b> <span>Minden világnak saját tája, időjárása és elásott kincse van.</span></div>
      <div class="theme-panel-tools"><button type="button" data-tool="build">Építés</button><button type="button" data-tool="sound" aria-pressed="${soundOn()}">Hang</button><button type="button" data-tool="list">Felfedezések ${done}/${items.length}</button></div>`;
  }
  function decoratePanel() {
    const dd = $('#topbarThemeDropdown');
    if (!dd) return;
    if ($('.theme-panel-head', dd)) return;
    const head = document.createElement('div');
    head.className = 'theme-panel-head';
    dd.insertBefore(head, dd.firstChild);
    renderPanelHead();
    const biome = (k) => (window.SolarWorld.THEMES[k] || {}).biome || '';
    $$('.topbar-theme-option', dd).forEach((opt) => {
      const key = opt.dataset.theme;
      const label = $('span', opt);
      const badge = $('.topbar-theme-badge', opt);
      const [a, b] = countFor(key);
      opt.innerHTML = `<img alt="" width="192" height="96" /><span class="t-name">${esc(label ? label.textContent : key)}<i class="t-count" style="font-style:normal">${a}/${b}</i></span><span class="t-biome">${esc(biome(key))}</span>`;
      if (badge) opt.appendChild(badge);
      thumbFor(key, $('img', opt));
    });
  }
  function setThemeChip() {
    const icoEl = $('#topbarThemeIco');
    const nameEl = $('#topbarThemeName');
    const cfg = window.SolarWorld.THEMES[themeKey()] || {};
    if (icoEl) icoEl.innerHTML = ico(cfg.time === 'night' ? 'moon' : 'sun');
    if (nameEl) nameEl.textContent = cfg.biome || '';
  }

  function bindPanel() {
    const dd = $('#topbarThemeDropdown');
    if (!dd) return;
    new MutationObserver(decoratePanel).observe(dd, { childList: true });
    decoratePanel();
    dd.addEventListener('click', (e) => {
      const tool = e.target.closest && e.target.closest('[data-tool]');
      if (tool) {
        if (tool.dataset.tool === 'sound') {
          store.set('solarcenter.sound', !soundOn());
          if (soundOn()) blip(CHIME);
          renderPanelHead();
        }
        if (tool.dataset.tool === 'list') openList();
        if (tool.dataset.tool === 'build') {
          dd.classList.add('hidden');
          $('#topbarThemeBtn').classList.remove('open');
          if (!world().creative) setCreative(true);
        }
      }
      if (!e.target.closest('[data-theme]')) e.stopPropagation();
    });
    const btn = $('#topbarThemeBtn');
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
    });
    const seen = store.get('solarcenter.worlds', []);
    const onTheme = () => {
      setThemeChip();
      const k = themeKey();
      if (!seen.includes(k)) { seen.push(k); store.set('solarcenter.worlds', seen); }
      if (['solaryn', 'solaryn-light', 'ice', 'crimson', 'emerald', 'amethyst', 'turquoise'].every((x) => seen.includes(x))) discover('tourist');
      placeTreasure(document.documentElement.getAttribute('data-view') || 'home');
    };
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    onTheme();
  }

  function timeEggs() {
    const h = new Date().getHours();
    if (h === 0) discover('midnight');
    if (h >= 4 && h < 6) discover('dawn');
    const ph = window.SolarWorld.solar().phase;
    if (ph > 0.47 && ph < 0.53) discover('fullmoon');
  }

  function boot() {
    if (!window.SolarWorld || !window.solarWorld) return;
    buildConsole();
    bindDepth();
    bindWorld(window.solarWorld);
    if (window.solarAuthWorld) bindWorld(window.solarAuthWorld);
    keys();
    bindPanel();
    window.addEventListener('solar:view', (e) => placeTreasure(e.detail.view));
    const shell = $('#appScreen');
    const once = () => { if (!shell.classList.contains('hidden')) timeEggs(); };
    new MutationObserver(once).observe(shell, { attributes: true, attributeFilter: ['class'] });
    once();
    window.SolarQuest = { openConsole, openList, discover, say };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
