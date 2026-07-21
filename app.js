// ── Backend kapcsolat ──
// Ugyanaz a SolarBackend (Node/Express), amit a SolarLauncher is használ - a
// login/register/me/skin végpontok innen valók, nem itt kerültek kitalálásra.
// JAVÍTVA: a SolarCenter mostantól HTTPS alól fut (center.solaryn.hu, GitHub
// Pages), ezért a korábbi sima http:// cím "kevert tartalomként" (mixed
// content) BLOKKOLVA volt a böngészőben - a backendnek időközben lett egy
// HTTPS-listenere is (ld. SolarBackend src/tls.js + data/tls-config.json),
// ezt kell itt is használni. A domain neve ("api.overclockgame.hu") egy másik
// projekthez lett eredetileg bejegyezve, de mivel ugyanaz a HTTPS-szerver
// szolgálja ki most már a TELJES Solaryn-backendet is, működik erre is.
const BACKEND_URL = 'https://api.overclockgame.hu:8908';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── Hulló parázs-szemcse háttéranimáció (ugyanaz, mint a SolarLauncherben) ──
(function initParticles() {
  const canvas = $('#particleCanvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function spawn() {
    return {
      x: Math.random() * canvas.width,
      y: -10,
      r: 1 + Math.random() * 2.2,
      speed: 0.4 + Math.random() * 0.9,
      drift: (Math.random() - 0.5) * 0.4,
      alpha: 0.15 + Math.random() * 0.35,
      hue: Math.random() < 0.5 ? '255,196,46' : '255,157,23'
    };
  }
  const COUNT = 55;
  for (let i = 0; i < COUNT; i++) {
    const p = spawn();
    p.y = Math.random() * (window.innerHeight || 620);
    particles.push(p);
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.y += p.speed;
      p.x += p.drift;
      if (p.y > canvas.height + 10) Object.assign(p, spawn());
      ctx.beginPath();
      ctx.fillStyle = `rgba(${p.hue},${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

let session = null;
try {
  const saved = localStorage.getItem('solarcenter_session');
  if (saved) session = JSON.parse(saved);
} catch { session = null; }

function saveSession() {
  if (session) localStorage.setItem('solarcenter_session', JSON.stringify(session));
  else localStorage.removeItem('solarcenter_session');
}

async function apiPost(path, body) {
  try {
    const res = await fetch(BACKEND_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return await res.json();
  } catch (e) {
    return { ok: false, message: 'Nem sikerült elérni a szervert.' };
  }
}

async function apiGetMe(token) {
  try {
    const res = await fetch(BACKEND_URL + '/api/me', { headers: { Authorization: 'Bearer ' + token } });
    // JAVÍTVA: korábban egy nem-2xx válasz esetén (pl. 403 zárolt fióknál)
    // eldobtuk a válasz törzsét, és csak egy csupasz {ok:false}-t adtunk
    // vissza - emiatt a "locked"/"reason" mezők sosem jutottak el a
    // hívóhoz. Most a törzset MINDIG megpróbáljuk beolvasni, státusztól
    // függetlenül (ugyanaz a minta, mint az apiPost()-nál).
    return await res.json();
  } catch {
    return { ok: false };
  }
}

// ── Auth: fül-váltás ──
function setAuthMode(mode) {
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === mode));
  $('#loginForm').classList.toggle('hidden', mode !== 'login');
  $('#registerForm').classList.toggle('hidden', mode !== 'register');
  $('#authError').textContent = '';
  $('#registerError').textContent = '';
}
$$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setAuthMode(tab.dataset.tab)));
$('#switchToLogin').addEventListener('click', () => setAuthMode('login'));

// ── Bejelentkezés ──
$('#authSubmit').addEventListener('click', doLogin);
$('#authPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const user = $('#authUser').value.trim();
  const pass = $('#authPass').value;
  $('#authError').textContent = '';
  const res = await apiPost('/api/login', { username: user, password: pass });
  if (!res.ok) {
    if (res.locked) { showLockedScreen(res.reason); return; }
    $('#authError').textContent = res.message || 'Sikertelen bejelentkezés.';
    return;
  }
  session = { username: res.username, token: res.token };
  saveSession();
  enterApp();
}

// A zárolt-fiók képernyő bármely belépési ponton (friss login, automatikus
// munkamenet-visszaállítás) megjeleníthető - mindig ugyanazt az élményt adja,
// nem csak egy apró hibaüzenetet.
function showLockedScreen(reason) {
  $('#authScreen').classList.add('hidden');
  $('#appScreen').classList.add('hidden');
  $('#lockedReasonText').textContent = reason || 'nincs megadva';
  $('#lockedScreen').classList.remove('hidden');
}
$('#btnLogoutLocked').addEventListener('click', () => {
  session = null;
  saveSession();
  $('#lockedScreen').classList.add('hidden');
  $('#authScreen').classList.remove('hidden');
});

// ── Regisztráció: születési dátum legördülők feltöltése ──
const HU_MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
(function populateBirthDate() {
  const yearSel = $('#regYear');
  const nowYear = new Date().getFullYear();
  for (let y = nowYear - 14; y >= nowYear - 100; y--) {
    const opt = document.createElement('option');
    opt.value = String(y); opt.textContent = String(y);
    yearSel.appendChild(opt);
  }
  const monthSel = $('#regMonth');
  HU_MONTHS.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i + 1).padStart(2, '0'); opt.textContent = name;
    monthSel.appendChild(opt);
  });
  const daySel = $('#regDay');
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = String(d).padStart(2, '0'); opt.textContent = String(d);
    daySel.appendChild(opt);
  }
})();

// ── Regisztráció: beküldés ──
$('#registerSubmit').addEventListener('click', doRegister);

async function doRegister() {
  const errEl = $('#registerError');
  errEl.textContent = '';

  const username = $('#regUser').value.trim();
  const email = $('#regEmail').value.trim();
  const email2 = $('#regEmail2').value.trim();
  const pass = $('#regPass').value;
  const pass2 = $('#regPass2').value;
  const year = $('#regYear').value, month = $('#regMonth').value, day = $('#regDay').value;
  const creatorCode = $('#regCreatorCode').value.trim();
  const termsOk = $('#regTerms').checked;
  const ageOk = $('#regAge').checked;
  const marketingOk = $('#regMarketing').checked;
  const marketingChannel = $('#regMarketingChannel').value;

  if (!username) { errEl.textContent = 'Adj meg egy játékos nevet.'; return; }
  if (!email || email !== email2) { errEl.textContent = 'A két email cím nem egyezik.'; return; }
  if (!pass || pass !== pass2) { errEl.textContent = 'A két jelszó nem egyezik.'; return; }
  if (pass.length < 6) { errEl.textContent = 'A jelszó min. 6 karakter.'; return; }
  if (!year || !month || !day) { errEl.textContent = 'Add meg a születési dátumodat.'; return; }
  if (!termsOk) { errEl.textContent = 'Az ÁSZF és az Adatvédelmi nyilatkozat elfogadása kötelező.'; return; }
  if (!ageOk) { errEl.textContent = 'Erősítsd meg, hogy betöltötted a 14. életévedet.'; return; }

  const res = await apiPost('/api/register', {
    username,
    email,
    password: pass,
    birthDate: `${year}-${month}-${day}`,
    marketingConsent: marketingOk,
    marketingChannel: marketingOk ? marketingChannel : null,
    creatorCode: creatorCode || null,
    termsAccepted: termsOk
  });
  if (!res.ok) { errEl.textContent = res.message || 'Sikertelen regisztráció.'; return; }
  session = { username: res.username, token: res.token };
  saveSession();
  enterApp();
}

// ── Automatikus bejelentkezés, ha van elmentett (még érvényes) munkamenet ──
async function tryAutoLogin() {
  if (!session || !session.token) return;
  $('#authScreen').classList.add('hidden');
  const res = await apiGetMe(session.token);
  if (res.ok) {
    session = { username: res.username, token: session.token };
    saveSession();
    enterApp(res);
  } else if (res.locked) {
    showLockedScreen(res.reason);
  } else {
    session = null;
    saveSession();
    $('#authScreen').classList.remove('hidden');
    // A törölt fiókokat (ld. requireAuth "deleted: true" válasza) külön
    // üzenettel jelezzük - a zárolással ellentétben ez nem visszavonható,
    // úgyhogy nincs értelme egy külön "zárolt" képernyőnek, csak a login
    // formra dobjuk vissza egy magyarázó szöveggel.
    if (res.deleted) $('#authError').textContent = 'A fiókod törölve lett.';
  }
}

// ── Statisztika-jelvények ──
// JAVÍTVA: a felhasználó KÉTSZER is kifejezetten kérte, hogy a Zseton és a
// Szint NE szerepeljen a főoldalon (ahogy a Guild sem, ld. az eredeti kérést:
// "szint, guild, zseton nem kell") - ez a lista most már tényleg csak azt a
// hármat tartalmazza, amit kért: Rang, PrémiumPont, Online töltött idő. A
// SolarBungee (playtime) és SolarLobby (SC/rang) szerver-oldali pluginok
// töltik fel ezeket a /api/game/report végponton keresztül - innentől valódi
// adatok, nem helykitöltő 0/"-" érték.
// JAVÍTVA: a PrémiumPont-jelvény mostantól a felhasználó saját PP-érme
// képét használja (assets/pp-coin.png) a korábbi generikus érme-SVG helyett.
const STAT_ICONS = {
  rank: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.4z"/></svg>',
  coin: '<img src="assets/pp-coin.png" alt="PP" />',
  time: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5.4l4 2.3-.8 1.3L11 13V7z"/></svg>',
  spin: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 12a8 8 0 0 1 14.6-4.5M20 12a8 8 0 0 1-14.6 4.5M18.6 7.5V4m0 3.5H15M5.4 16.5V20m0-3.5H9"/></svg>'
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// A backend a "rankPrefixColor"/a szakaszok "color" mezőit már szigorúan
// "#RRGGBB" formára ellenőrizve tárolja (ld. SolarBackend server.js
// RANK_PREFIX_COLOR_RE-jét), de mivel ezek közvetlenül egy inline "style"
// attribútumba kerülnek, itt, kliens-oldalon is újra ellenőrizzük - védelmi
// rétegként, nem mert a backendben ne bíznánk.
const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// A rang-jelvény TARTALMÁT adja vissza HTML-ként. Ha van szakaszonkénti
// szín-bontás (ld. SolarBackend "rankPrefixSegments", SolarLobby
// parseColoredSegments()), minden szakaszt saját <span style="color:...">-
// ban jelenít meg - ez kell ahhoz, hogy egy PER-BETŰS színátmenetes
// (gradient) in-game prefix (pl. "[TULAJDONOS]", betűnként más árnyalatú
// piros) a Centeren is pontosan ugyanúgy nézzen ki, ne csak egyetlen
// (a "rankColor" fallback szerinti) egyszínű blokként. Szakaszok hiányában
// visszaesünk a sima, egyszínű szövegre.
function renderRankValueHtml(values) {
  if (Array.isArray(values.rankSegments) && values.rankSegments.length) {
    return values.rankSegments.map((seg) => {
      const text = escapeHtml(seg && typeof seg.text === 'string' ? seg.text : '');
      const color = seg && typeof seg.color === 'string' && HEX_COLOR_RE.test(seg.color) ? seg.color : null;
      return color ? `<span style="color:${color}">${text}</span>` : `<span>${text}</span>`;
    }).join('');
  }
  return escapeHtml(values.rank);
}

function renderStatBadges(container, values) {
  const items = [
    { icon: 'rank', label: 'Rang', html: renderRankValueHtml(values), color: values.rankColor },
    { icon: 'coin', label: 'PrémiumPont', html: escapeHtml(values.coin) },
    { icon: 'time', label: 'Online töltött idő', html: escapeHtml(values.time) }
  ];
  container.innerHTML = items.map((it) => `
    <div class="stat-badge">
      <div class="stat-badge-icon">${STAT_ICONS[it.icon]}</div>
      <div>
        <div class="stat-badge-label">${it.label}</div>
        <div class="stat-badge-value"${it.color ? ` style="color:${it.color}"` : ''}>${it.html}</div>
      </div>
    </div>
  `).join('');
}

// Amíg egy adott statisztikát még sosem jelentett be plugin (pl. a játékos
// sosem lépett még a szerverre), a megfelelő mező null/hiányzik a backendtől -
// ilyenkor esik vissza helykitöltőre ("—"/"0"/"0 óra").
function emptyStats() {
  return { rank: '—', rankColor: null, rankSegments: null, coin: '0', time: '0 óra' };
}

function formatPlaytime(seconds) {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
  const hours = Math.floor(s / 3600);
  return `${hours.toLocaleString('hu-HU')} óra`;
}

function formatStats(data) {
  if (!data) return emptyStats();
  // A jelvényen a LuckPerms chat-PREFIX jelenik meg (pl. "[VIP]"), nem a nyers
  // csoportnév ("vip") - ha a SolarLobby plugin még nem jelentett prefixet
  // (pl. régebbi verzió, vagy a csoportnak nincs beállítva), visszaesünk a
  // csoportnévre, hogy a jelvény sose maradjon üres. Az isOwner-döntés
  // (enterApp) EZZEL SZEMBEN mindig a nyers "data.rank"-ot nézi, sosem ezt.
  return {
    rank: data.rankPrefix ? data.rankPrefix : (data.rank ? data.rank : '—'),
    rankColor: typeof data.rankPrefixColor === 'string' && HEX_COLOR_RE.test(data.rankPrefixColor) ? data.rankPrefixColor : null,
    rankSegments: Array.isArray(data.rankPrefixSegments) ? data.rankPrefixSegments : null,
    coin: typeof data.scBalance === 'number' ? data.scBalance.toLocaleString('hu-HU') : '0',
    time: formatPlaytime(data.playtimeSeconds)
  };
}

// ÚJ: "Összekötve ezzel: ..." jelvény a profil-kártyán (Főoldal SAJÁT profil,
// illetve a tulajdonosi Játékos-profil admin panelje) - ugyanazt a
// data.discordUsername/discordAvatar mezőpárt használja mindkét helyen (ld.
// SolarBackend /api/me, /api/profile/:username, /api/admin/player/:username).
function renderDiscordLinkBadge(container, data) {
  if (!container) return;
  if (data && data.discordUsername) {
    const avatarHtml = data.discordAvatar
      ? `<img class="discord-link-avatar" src="${data.discordAvatar}" alt="" />`
      : '';
    container.innerHTML = `
      <div class="discord-link-badge discord-link-badge-connected">
        ${avatarHtml}
        <span>Összekötve ezzel: <b>${data.discordUsername}</b></span>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="discord-link-badge discord-link-badge-empty">
        <span>Nincs összekötve Discord fiók - írd be a szerveren: <code>/link</code></span>
      </div>
    `;
  }
}

// ÚJ: "van-e aktív némításod/kitiltásod/kliens-tiltásod" jelvény(ek) a
// profil-kártyán - a data.activeMute/activeBan/activeCban mezőket a
// SolarBackend GET /api/me adja (ld. ott activeMuteInfo/activeBanInfoFromUser/
// getActiveCbanForUsername) null-t, ha épp nincs aktív szankció az adott
// típusból. Ha egyik sincs aktív, a konténer üresen marad (nincs "minden
// rendben" jelvény - csak a figyelmeztetés jellegű állapotok jelennek meg).
// JAVÍTVA: korábban csak egy hover-title-ban (csak egérrel rávitelre látszó
// tooltip) volt benne, hogy ki és mikor adta a szankciót - a felhasználó
// kérésére ez mostantól MINDIG látható, kártyaszerűen kiírva (ki adta,
// mikor, mennyi van hátra, indoklás).
function renderSanctionStatus(container, data) {
  if (!container) return;
  const cards = [];
  if (data?.activeMute) cards.push({ label: '🔇 Aktív némítás', info: data.activeMute });
  if (data?.activeBan) cards.push({ label: '⛔ Aktív kitiltás', info: data.activeBan });
  if (data?.activeCban) cards.push({ label: '🖥 Aktív kliens-tiltás', info: data.activeCban });

  if (!cards.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = cards.map((c) => `
    <div class="sanction-status-card">
      <div class="sanction-status-card-title">${c.label}</div>
      ${c.info.by ? `<div class="sanction-status-card-row"><span>Kiadta:</span> ${escapeHtml(c.info.by)}</div>` : ''}
      ${c.info.since ? `<div class="sanction-status-card-row"><span>Kiadva:</span> ${formatSanctionUntil(c.info.since)}</div>` : ''}
      <div class="sanction-status-card-row"><span>${c.info.permanent ? 'Időtartam:' : 'Hátralévő idő:'}</span> ${c.info.permanent ? 'végleges' : formatRemaining(c.info.until)}</div>
      ${c.info.reason ? `<div class="sanction-status-card-reason">Indok: ${escapeHtml(c.info.reason)}</div>` : ''}
    </div>
  `).join('');
}

function formatSanctionUntil(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('hu-HU');
}

// A hátralévő időt "X nap Y óra" / "X óra Y perc" alakban adja vissza,
// zárójelben a pontos dátummal - egy puszta dátum-időbélyeg kevésbé
// szemléletes annál, mint amennyi idő ténylegesen hátravan.
function formatRemaining(untilIso) {
  if (!untilIso) return '—';
  const untilMs = new Date(untilIso).getTime();
  if (Number.isNaN(untilMs)) return '—';
  const diffMs = untilMs - Date.now();
  const exact = formatSanctionUntil(untilIso);
  if (diffMs <= 0) return `lejárt (${exact})`;
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  let human;
  if (days > 0) human = `${days} nap ${hours} óra`;
  else if (hours > 0) human = `${hours} óra ${minutes} perc`;
  else human = `${minutes} perc`;
  return `${human} (${exact}-ig)`;
}

// ── Casino (SolarLucky) - a pörgetés MAGÁN a weboldalon zajlik (a
// felhasználó kifejezett kérésére, NEM egy in-game /casino parancs GUI-
// jában) - ld. SolarBackend src/casino.js POST /api/casino/spin. A
// SolarLucky Minecraft-plugin csak a napi bejelentkezést jelenti (streak-
// számításhoz) és a MÁR itt eldöntött nyeremény LuckPerms-parancsát hajtja
// végre a szerveren. ──
const CASINO_PRIZE_ICONS = {
  glow: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4z"/><path fill="currentColor" opacity=".6" d="M19 15l.9 2.6L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.4z"/></svg>',
  antiqueue: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 5l8 7-8 7zM12 5l8 7-8 7z"/></svg>',
  enderchest: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 13h18" stroke="currentColor" stroke-width="2"/><rect x="10.5" y="12" width="3" height="3" rx=".5" fill="currentColor"/><path d="M7 9V7a5 5 0 0 1 10 0v2" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  autopickup: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v13m0 0l-5-5m5 5l5-5M5 19h14"/></svg>',
  battlepass: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 3h10v6a5 5 0 0 1-10 0z"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M7 4H4a3 3 0 0 0 3 4M17 4h3a3 3 0 0 1-3 4"/><path fill="currentColor" d="M11 13h2v3h-2z"/><path fill="currentColor" d="M8 19a4 4 0 0 1 8 0z"/></svg>',
  afk: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 9h2.4L9 13h2.6M14 9h1.8c1 0 1 1.4 0 1.6c1 .2 1 1.6 0 1.6h-1.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  rank: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>'
};
const CASINO_ICON_KEYS = Object.keys(CASINO_PRIZE_ICONS);
const CASINO_JACKPOT_ICON = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.4z"/></svg>';

function casinoIconHtml(key) {
  return CASINO_PRIZE_ICONS[key] || CASINO_JACKPOT_ICON;
}

let casinoPrizes = [];
let casinoSpinning = false;

function setCasinoReel(index, iconHtml) {
  const el = $('#casinoReel' + index);
  if (el) el.innerHTML = iconHtml;
}

async function loadCasinoPrizes() {
  const grid = $('#casinoPrizeGrid');
  if (!grid) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/casino/prizes', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    casinoPrizes = data.ok && Array.isArray(data.prizes) ? data.prizes : [];
    grid.innerHTML = casinoPrizes.map((p) => `
      <div class="casino-prize-card">
        <div class="casino-prize-icon">${casinoIconHtml(p.icon)}</div>
        <div class="casino-prize-name">${escapeHtml(p.name)}</div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '';
  }
}

let casinoState = null;

function renderCasinoButtons() {
  const spinBtn = $('#casinoSpinBtn');
  const buyBtn = $('#casinoBuySpinBtn');
  if (!spinBtn || !buyBtn || !casinoState) return;

  const canSpin = casinoState.freeSpinsAvailable > 0 || casinoState.purchasedSpinsAvailable > 0;
  spinBtn.disabled = casinoSpinning || !canSpin;
  spinBtn.textContent = canSpin ? 'Pörgetés' : 'Nincs elérhető pörgetésed';

  const canBuy = casinoState.purchasesUnlocked && casinoState.purchasesRemaining > 0;
  buyBtn.hidden = !canBuy;
  buyBtn.disabled = casinoSpinning;
}

async function loadCasinoState() {
  const grid = $('#casinoStatGrid');
  if (!grid || !session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/casino/state', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { grid.innerHTML = ''; return; }
    casinoState = data;

    const items = [
      { icon: 'time', label: 'Bejelentkezési sorozat', html: `${data.loginStreakDays} nap` },
      { icon: 'spin', label: 'Ingyenes pörgetés', html: String(data.freeSpinsAvailable) }
    ];
    if (data.purchasedSpinsAvailable > 0) {
      items.push({ icon: 'spin', label: 'Megvásárolt pörgetés', html: String(data.purchasedSpinsAvailable) });
    }
    if (data.purchasesUnlocked) {
      items.push({ icon: 'spin', label: 'Vásárolható próbálkozás', html: `${data.purchasesRemaining}/2 (200 PP/db)` });
    }
    grid.innerHTML = items.map((it) => `
      <div class="stat-badge">
        <div class="stat-badge-icon">${STAT_ICONS[it.icon]}</div>
        <div>
          <div class="stat-badge-label">${it.label}</div>
          <div class="stat-badge-value">${it.html}</div>
        </div>
      </div>
    `).join('');
    renderCasinoButtons();
  } catch {
    grid.innerHTML = '';
  }
}

function loadCasino() {
  for (let i = 0; i < 3; i++) setCasinoReel(i, casinoIconHtml(CASINO_ICON_KEYS[i % CASINO_ICON_KEYS.length]));
  $('#casinoSpinResult').textContent = '';
  loadCasinoPrizes();
  loadCasinoState();
}

// A pörgetés eredményét (nyert-e, melyik jutalmat) a backend MÁR eldöntötte
// a POST /api/casino/spin válaszában, mire ez a függvény lefut - az
// animáció csak megjelenítés, nem befolyásolja/nem is ismeri előre a
// kimenetelt, amíg a hívás vissza nem tér.
async function spinCasino() {
  if (casinoSpinning || !casinoState) return;
  if (casinoState.freeSpinsAvailable <= 0 && casinoState.purchasedSpinsAvailable <= 0) return;

  casinoSpinning = true;
  renderCasinoButtons();
  const resultEl = $('#casinoSpinResult');
  resultEl.textContent = '';
  resultEl.className = 'redeem-result';
  $$('.slot-reel').forEach((el) => el.classList.add('spinning'));
  $('.slot-machine-lever-track')?.classList.add('pulled');

  const spinPromise = fetch(BACKEND_URL + '/api/casino/spin', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.token }
  }).then((r) => r.json()).catch(() => ({ ok: false }));

  const cycleTimer = setInterval(() => {
    for (let i = 0; i < 3; i++) setCasinoReel(i, casinoIconHtml(CASINO_ICON_KEYS[Math.floor(Math.random() * CASINO_ICON_KEYS.length)]));
  }, 90);

  // A "menő animáció" kedvéért mesterségesen legalább ~1.4 másodpercig pörög
  // a tekercs, még ha a backend-hívás gyorsabban vissza is tér.
  const [data] = await Promise.all([spinPromise, new Promise((r) => setTimeout(r, 1400))]);
  clearInterval(cycleTimer);
  $('.slot-machine-lever-track')?.classList.remove('pulled');

  if (!data || !data.ok) {
    $$('.slot-reel').forEach((el) => el.classList.remove('spinning'));
    resultEl.textContent = (data && data.reason === 'no_spin_available') ? 'Nincs elérhető pörgetésed.' : 'A pörgetés sikertelen volt, próbáld újra.';
    resultEl.className = 'redeem-result error';
    casinoSpinning = false;
    await loadCasinoState();
    return;
  }

  if (data.win) {
    for (let i = 0; i < 3; i++) setCasinoReel(i, casinoIconHtml(data.prizeIcon));
    $$('.slot-reel').forEach((el) => { el.classList.remove('spinning'); el.classList.add('won'); });
    resultEl.textContent = `🎉 JACKPOT! Nyereményed: ${data.prizeName}`;
    resultEl.className = 'redeem-result';
    setTimeout(() => $$('.slot-reel').forEach((el) => el.classList.remove('won')), 3000);
  } else {
    const a = CASINO_ICON_KEYS[Math.floor(Math.random() * CASINO_ICON_KEYS.length)];
    let b = CASINO_ICON_KEYS[Math.floor(Math.random() * CASINO_ICON_KEYS.length)];
    if (b === a) b = CASINO_ICON_KEYS[(CASINO_ICON_KEYS.indexOf(a) + 1) % CASINO_ICON_KEYS.length];
    const c = CASINO_ICON_KEYS[(CASINO_ICON_KEYS.indexOf(b) + 2) % CASINO_ICON_KEYS.length];
    setCasinoReel(0, casinoIconHtml(a));
    setCasinoReel(1, casinoIconHtml(b));
    setCasinoReel(2, casinoIconHtml(c));
    $$('.slot-reel').forEach((el) => el.classList.remove('spinning'));
    resultEl.textContent = 'Sajnos ezúttal nem nyertél - próbáld meg legközelebb!';
    resultEl.className = 'redeem-result';
  }

  casinoState = data;
  casinoSpinning = false;
  renderCasinoButtons();
}

async function buyCasinoSpin() {
  const btn = $('#casinoBuySpinBtn');
  const resultEl = $('#casinoSpinResult');
  btn.disabled = true;
  try {
    const res = await fetch(BACKEND_URL + '/api/casino/buy-spin', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = 'Nem sikerült elindítani a vásárlást.';
      resultEl.className = 'redeem-result error';
      btn.disabled = false;
      return;
    }
    resultEl.textContent = data.message || 'A vásárlás elindult.';
    resultEl.className = 'redeem-result';
    casinoState = data;
    renderCasinoButtons();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
    btn.disabled = false;
  }
}

$('#casinoSpinBtn')?.addEventListener('click', spinCasino);
$('#casinoBuySpinBtn')?.addEventListener('click', buyCasinoSpin);

// A rangvásárlás gombjai (ld. renderRankCard/refreshPpBalance) ebből olvassák
// ki, hogy a játékosnak van-e elég fedezete - ez csak kliens-oldali UX-segéd
// (a tényleges, biztonságos ellenőrzést a beváltó plugin végzi élő adaton),
// ezért egy kicsit elavult érték sem okoz problémát, csak rossz gombállapotot
// mutathat egy frissítésig.
let currentPpBalance = 0;

// A "tulajdonos" rangú felhasználóknak jelenik meg a játékos-profilon az
// Admin panel (email, regisztráció, kliens-eszközök, kliens-tiltás) - a
// backend a SAJÁT jogosultság-ellenőrzést is elvégzi minden admin
// végponton (ld. SolarBackend src/client.js requireOwner), ez a kliens-
// oldali flag csak azt dönti el, MEGJELENÍTSÜK-e egyáltalán a panelt.
let isOwner = false;

// ÚJ: a legutóbb lekért /api/me aktív szankció-állapota (ld.
// renderSanctionStatus fentebb) - a "sanction" (kitiltáscsökkentés) nézet
// ebből dönti el, mely csomagok gombja legyen kattintható (ld.
// loadShopCatalog) - csak akkor lehet megvenni egy csökkentést, ha tényleg
// van mit csökkenteni.
let currentSanctionStatus = { activeMute: null, activeBan: null, activeCban: null };

function renderProfilePpBadge() {
  $('#topbarPpValue').textContent = formatPp(currentPpBalance);
}

// meData: opcionálisan előre lekért /api/me válasz (pl. tryAutoLogin()-ból,
// hogy ne kelljen kétszer lekérdezni) - ha nincs átadva, itt kérjük le.
async function enterApp(meData) {
  $('#authScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  $('#topbarUsername').textContent = session.username;
  $('#homeUsername').textContent = session.username;
  $('#profileName').textContent = session.username;

  if (!meData) meData = await apiGetMe(session.token);
  renderStatBadges($('#statBadgeGrid'), formatStats(meData));
  renderDiscordLinkBadge($('#profileDiscordLink'), meData);
  renderSanctionStatus($('#profileSanctionStatus'), meData);
  currentSanctionStatus = {
    activeMute: meData?.activeMute || null,
    activeBan: meData?.activeBan || null,
    activeCban: meData?.activeCban || null
  };
  // A bejelentkezés ELŐTT (szkript-betöltéskor) lefutott loadShopCatalog()
  // még a fenti alapértelmezett (mind-null, azaz mind-zárolt) állapottal
  // rendereli a kitiltáscsökkentés kártyákat - most, hogy tudjuk a valódi
  // szankció-állapotot, újra kell generálni a gomb-állapotokat.
  loadShopCatalog();
  currentPpBalance = typeof meData?.scBalance === 'number' ? meData.scBalance : 0;
  renderProfilePpBadge();
  isOwner = typeof meData?.rank === 'string' && meData.rank.toLowerCase() === 'tulajdonos';
  $$('.admin-nav-item').forEach((el) => el.classList.toggle('hidden', !isOwner));

  loadTopbarAvatar();
  loadHomeSkinPreview();
  loadDiscordWidget();
  renderSideRails();

  // A Wolfy Discord bot /link (vagy /update) parancsa ide (?discordLink=<token>)
  // irányítja a felhasználót - ha épp most jelentkezett be/regisztrált emiatt,
  // vagy már eleve bejelentkezve volt egy ilyen linken keresztül érkezve, itt
  // fejezzük be az összekötést (ld. tryConsumeDiscordLink lejjebb).
  tryConsumeDiscordLink();

  // Minden bejelentkezéskor megnézzük, kapott-e a felhasználó időközben
  // (MÁR teljesített) ajándékot valakitől - ld. checkPendingGifts lejjebb.
  checkPendingGifts();

  // A legfrissebb hír/felhívás a főoldalon, a "Profilod" kártya alatt.
  loadHomeNews();
}

// A Rangok fül megnyitásakor (ld. switchView) hívjuk - friss egyenleget kér
// le, majd újrarajzolja a profil-jelvényt ÉS a rangkártyákat (hogy a "Nincs
// elég PP" gombállapot is naprakész legyen).
async function refreshPpBalance() {
  if (!session || !session.token) return;
  const res = await apiGetMe(session.token);
  if (res.ok) {
    currentPpBalance = typeof res.scBalance === 'number' ? res.scBalance : 0;
    renderProfilePpBadge();
    if ($('#rankGrid').dataset.loaded === '1') renderRankGrid();
  }
}

// ── Oldalsó "side rail" - minden alfülön (PrémiumPont/Rangok/Kódbeváltás/Skin/
// Kitiltáscsökkentés) egy support/Discord kártya jelenik meg jobb oldalt, hogy
// a tartalomterület sose maradjon kihasználatlanul üresen. JAVÍTVA: a korábbi
// "Gyors elérés" gyorslink-kártyát a felhasználó kérésére eltávolítottuk.
function sideRailHtml() {
  return `
    <div class="card side-card">
      <div class="side-card-icon">
        <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M20 5.5A17 17 0 0 0 15.7 4l-.3.6a13 13 0 0 1 3.6 1.3A15 15 0 0 0 12 4a15 15 0 0 0-7 1.9A13 13 0 0 1 8.6 4.6L8.3 4A17 17 0 0 0 4 5.5C1.8 9 1.2 12.4 1.4 15.8a17 17 0 0 0 4.9 2.4l.8-1.3a10 10 0 0 1-1.6-.7l.4-.3a12 12 0 0 0 10.2 0l.4.3a10 10 0 0 1-1.6.7l.8 1.3a17 17 0 0 0 4.9-2.4c.3-4.2-.6-7.6-2.6-10.3zM8.9 14.3c-.8 0-1.5-.8-1.5-1.7s.6-1.7 1.5-1.7 1.5.8 1.5 1.7-.6 1.7-1.5 1.7zm6.2 0c-.8 0-1.5-.8-1.5-1.7s.6-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7z"/></svg>
      </div>
      <div class="side-card-title">Elakadtál?</div>
      <p class="side-card-desc">A csapatunk szívesen segít bármilyen kérdésben a Discord szerverünkön.</p>
      <a href="https://dc.solaryn.hu" target="_blank" rel="noopener" class="btn-discord" style="border-radius:11px; margin-top:14px;">Csatlakozás a Discordhoz</a>
    </div>
  `;
}

function renderSideRails() {
  $$('.side-rail[data-side-rail]').forEach((el) => {
    el.innerHTML = sideRailHtml();
  });
}

// ── Felhasználói menü (topbar avatár/név -> lenyíló "Kijelentkezés") ──
const topbarUserBtn = $('#topbarUserBtn');
const topbarDropdown = $('#topbarDropdown');
topbarUserBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = !topbarDropdown.classList.contains('hidden');
  topbarDropdown.classList.toggle('hidden', open);
  topbarUserBtn.classList.toggle('open', !open);
});
document.addEventListener('click', () => {
  topbarDropdown.classList.add('hidden');
  topbarUserBtn.classList.remove('open');
});
$('#btnLogout').addEventListener('click', (e) => {
  e.stopPropagation();
  session = null;
  saveSession();
  location.reload();
});

// ── Oldalsáv / nézetváltás ──
function switchView(view) {
  $$('.app-nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  if (view === 'skin') loadSkinPreview3d();
  // A PP-egyenleg (rangvásárlás fedezet-ellenőrzéséhez) minden alkalommal
  // frissül, amikor a felhasználó megnyitja a Rangok fület - nem élő/valós
  // idejű szinkron, de elég friss ahhoz, hogy a gombok állapota (elég PP
  // van-e) ne legyen régi adaton alapuló.
  if (view === 'ranks') refreshPpBalance();
  // A Napló fület minden megnyitáskor frissítjük - friss bejegyzéseket kér le
  // (a dátum-szűrők szerint), a keresés viszont kliens-oldalon szűr a már
  // letöltött listán, nem küld újabb kérést minden billentyűleütésre.
  if (view === 'ledger') loadLedger();
  // A tulajdonosi Napló (admin) fület minden megnyitáskor a globális
  // (mindenkire kiterjedő) nézetre állítjuk vissza - a korábban beírt
  // játékosnév-szűrés nem marad meg fülváltás után, hogy ne legyen
  // meglepő/régi szűrt nézet a legközelebbi megnyitáskor.
  if (view === 'adminLogs') loadAdminLogsGlobal();
  if (view === 'staffStats') loadStaffStats();
  if (view === 'revenue') loadRevenue();
  if (view === 'newsAdmin') { resetNewsForm(); loadNewsAdmin(); }
  if (view === 'casino') loadCasino();
}
$$('.app-nav-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ── Profilkép (kis avatár a felső sávban) ──
function drawDefaultFace(ctx, size) {
  const px = size / 8;
  const skin = '#cf9e76', hair = '#4a3323', eye = '#3b2a1e', mouth = '#a9744f';
  ctx.fillStyle = skin; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = hair; ctx.fillRect(0, 0, size, px * 2);
  ctx.fillStyle = eye;
  ctx.fillRect(px * 2, px * 3, px, px);
  ctx.fillRect(px * 5, px * 3, px, px);
  ctx.fillStyle = mouth;
  ctx.fillRect(px * 2.5, px * 5.5, px * 3, px * 0.8);
}

async function loadTopbarAvatar() {
  const canvas = $('#topbarAvatar');
  await drawFaceFromSkin(canvas, session.username, 32);
}

async function drawFaceFromSkin(canvas, username, size) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const img = await loadSkinImage(username);
  if (img) {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
    if (img.naturalHeight >= 64) ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
  } else {
    drawDefaultFace(ctx, size);
  }
}

// Betölti a nyilvános /api/skin/:username képet Image objektumként (vagy nullt, ha nincs).
function loadSkinImage(username) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = BACKEND_URL + '/api/skin/' + encodeURIComponent(username) + '?t=' + Date.now();
  });
}

// ── Főoldal: saját skin 3D előnézet ──
let stopHomeSkinPreview = null;
async function loadHomeSkinPreview() {
  const img = await loadSkinImage(session.username);
  const noteEl = $('#profileSkinNote');
  if (!img) {
    // Nincs (már) feltöltött skin - pl. épp most lett visszaállítva
    // alapértelmezettre. A korábban elindított forgó előnézetet le kell
    // állítani, különben a régi skin tovább forogna a törlés után is.
    if (stopHomeSkinPreview) { stopHomeSkinPreview(); stopHomeSkinPreview = null; }
    const canvas = $('#homeSkinCanvas');
    canvas.width = canvas.width;
    noteEl.textContent = 'Még nincs feltöltött skinred - tölts fel egyet a Skin fülön!';
    return;
  }
  noteEl.textContent = '';
  if (stopHomeSkinPreview) stopHomeSkinPreview();
  stopHomeSkinPreview = SkinPreview.start($('#homeSkinCanvas'), img, false);
}

// ── Skin nézet: 3D előnézet + feltöltés ──
let stopSkinPreview = null;
let skinModel = 'classic';

async function loadSkinPreview3d() {
  if (!session) return;
  const img = await loadSkinImage(session.username);
  if (!img) {
    if (stopSkinPreview) { stopSkinPreview(); stopSkinPreview = null; }
    const canvas = $('#skinPreview3d');
    canvas.width = canvas.width;
    return;
  }
  if (stopSkinPreview) stopSkinPreview();
  stopSkinPreview = SkinPreview.start($('#skinPreview3d'), img, skinModel === 'slim');
}

$$('.skin-model-toggle .pill').forEach((p) => {
  p.addEventListener('click', () => {
    $$('.skin-model-toggle .pill').forEach((x) => x.classList.remove('active'));
    p.classList.add('active');
    skinModel = p.dataset.model === 'slim' ? 'slim' : 'classic';
    loadSkinPreview3d();
  });
});

const skinFileInput = $('#skinFileInput');
$('#skinDrop').addEventListener('click', () => skinFileInput.click());
$('#skinDrop').addEventListener('dragover', (e) => e.preventDefault());
$('#skinDrop').addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) uploadSkinFile(file);
});
skinFileInput.addEventListener('change', () => {
  const file = skinFileInput.files && skinFileInput.files[0];
  if (file) uploadSkinFile(file);
  skinFileInput.value = '';
});

// ── Skin visszaállítása alapértelmezettre ──
$('#skinResetBtn').addEventListener('click', async () => {
  const statusEl = $('#skinStatus');
  const confirmed = await confirmModal('Alapértelmezett skin visszaállítása', 'Biztosan törlöd a jelenlegi skinedet, és visszaállsz az alapértelmezett megjelenésre?', 'Igen, visszaállítás');
  if (!confirmed) return;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Visszaállítás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/skin/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) {
      statusEl.textContent = 'Alapértelmezett skin visszaállítva.';
      loadSkinPreview3d();
      loadHomeSkinPreview();
      loadTopbarAvatar();
    } else {
      statusEl.classList.add('error');
      statusEl.textContent = data.message || 'A visszaállítás sikertelen.';
    }
  } catch {
    statusEl.classList.add('error');
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
});

async function uploadSkinFile(file) {
  const statusEl = $('#skinStatus');
  statusEl.classList.remove('error');
  statusEl.textContent = 'Feltöltés...';
  try {
    const form = new FormData();
    form.append('variant', skinModel === 'slim' ? 'slim' : 'classic');
    form.append('skin', file, 'skin.png');
    const res = await fetch(BACKEND_URL + '/api/skin', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: form
    });
    const data = await res.json();
    if (data.ok) {
      statusEl.textContent = 'Skin sikeresen feltöltve!';
      loadSkinPreview3d();
      loadHomeSkinPreview();
      loadTopbarAvatar();
    } else {
      statusEl.classList.add('error');
      statusEl.textContent = data.message || 'A feltöltés sikertelen.';
    }
  } catch {
    statusEl.classList.add('error');
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
}

// ── Kódbeváltás (stub - nincs valódi kód-adatbázis egyenlőre) ──
$('#redeemSubmit').addEventListener('click', () => {
  const val = $('#redeemInput').value.trim();
  const resultEl = $('#redeemResult');
  resultEl.classList.remove('error');
  if (!val) { resultEl.textContent = ''; return; }
  resultEl.classList.add('error');
  resultEl.textContent = 'Ismeretlen kód.';
});
$('#redeemInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#redeemSubmit').click(); });

// ── Játékosok: keresés ──
// JAVÍTVA: korábban a kereső a /api/profile/:username-re épült, ami csak PONTOS
// egyezést adott vissza (egyetlen találatot, vagy semmit) - a felhasználó
// referenciájában viszont RÉSZLEGES egyezésre több találat is megjelenik
// (pl. "Kisskorboy" beírására "Kisskorboy1", "Kisskorboyfiam" is). Ehhez a
// SolarBackend kapott egy új, dedikált /api/players/search?q=... végpontot.
async function apiSearchPlayers(query) {
  try {
    const res = await fetch(BACKEND_URL + '/api/players/search?q=' + encodeURIComponent(query));
    if (!res.ok) return { ok: false, players: [] };
    return await res.json();
  } catch {
    return { ok: false, players: [] };
  }
}

// A találatra kattintva a profil-nézet ezt hívja, hogy a keresett játékos
// TÉNYLEGES statisztikáit (playtimeSeconds/scBalance/rank) is megjelenítse,
// nem csak a skinjét.
async function apiGetProfile(username) {
  try {
    const res = await fetch(BACKEND_URL + '/api/profile/' + encodeURIComponent(username));
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}

$('#playerSearchBtn').addEventListener('click', doPlayerSearch);
$('#playerSearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doPlayerSearch(); });

let stopPlayerPreview = null;
async function doPlayerSearch() {
  const name = $('#playerSearchInput').value.trim();
  const resultEl = $('#playerResult');
  const headingEl = $('#playerResultHeading');
  if (!name) { resultEl.innerHTML = ''; headingEl.classList.add('hidden'); return; }

  headingEl.classList.remove('hidden');
  resultEl.innerHTML = '<p class="player-result-note">Keresés...</p>';
  const data = await apiSearchPlayers(name);
  if (!data.ok || !data.players.length) {
    resultEl.innerHTML = '<p class="player-result-note">Nincs található játékos ezzel a névvel.</p>';
    return;
  }

  resultEl.innerHTML = data.players.map((p, i) => `
    <div class="player-card" data-username="${p.username}">
      <canvas class="player-card-canvas" data-idx="${i}" width="40" height="40"></canvas>
      <div class="player-card-info">
        <div class="player-card-label">Név</div>
        <div class="player-card-name">${p.username}</div>
      </div>
    </div>
  `).join('');

  $$('.player-card').forEach((card, i) => {
    const player = data.players[i];
    const canvas = card.querySelector('canvas');
    drawFaceForPlayer(canvas, player);
    card.addEventListener('click', () => openPlayerProfile(player.username));
  });
}

async function drawFaceForPlayer(canvas, player) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const img = player.hasSkin ? await loadSkinImage(player.username) : null;
  if (img) {
    ctx.clearRect(0, 0, 40, 40);
    ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 40, 40);
    if (img.naturalHeight >= 64) ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 40, 40);
  } else {
    drawDefaultFace(ctx, 40);
  }
}

// A "Vissza" gomb az eszköz-részletekről mindig ide (a legutóbb megnyitott
// játékos-profilra) tér vissza, ld. openDeviceDetail/btnBackFromDevice.
let lastAdminPlayerUsername = null;

async function openPlayerProfile(username) {
  switchView('playerProfile');
  $('#playerProfileTitle').textContent = username;
  $('#playerProfileName').textContent = username;
  renderStatBadges($('#playerProfileStats'), emptyStats());
  renderSanctionStatus($('#playerProfileSanctionStatus'), null);
  apiGetProfile(username).then((profile) => {
    renderStatBadges($('#playerProfileStats'), profile.ok ? formatStats(profile) : emptyStats());
    // ÚJ: a felhasználó kérésére a némítás-/kitiltás-állapot a játékos-
    // keresőben (bárki profilját megnézve) is megjelenik, nem csak a saját
    // fooldalon - ld. SolarBackend GET /api/profile/:username kiterjesztését.
    renderSanctionStatus($('#playerProfileSanctionStatus'), profile.ok ? profile : null);
  });

  lastAdminPlayerUsername = username;
  $('#playerProfileAdminPanel').classList.toggle('hidden', !isOwner);
  if (isOwner) loadAdminPlayerPanel(username);

  const noteEl = $('#playerProfileSkinNote');
  const img = await loadSkinImage(username);
  if (!img) {
    // JAVÍTVA: korábban itt csak a szöveg állt be, a canvas-t/előnézetet NEM
    // állítottuk le/töröltük - ha korábban (akár a saját profilodon, akár egy
    // másik keresésnél) már megjelent VALAMILYEN skin ezen a canvason, az
    // tovább forgott/látszott, még egy skin NÉLKÜLI játékos profiljánál is
    // (ld. loadHomeSkinPreview ugyanezen mintáját a Főoldalon).
    if (stopPlayerPreview) { stopPlayerPreview(); stopPlayerPreview = null; }
    const canvas = $('#playerProfileSkinCanvas');
    canvas.width = canvas.width;
    noteEl.textContent = 'Ez a játékos még nem töltött fel skint.';
    return;
  }
  noteEl.textContent = '';
  if (stopPlayerPreview) stopPlayerPreview();
  stopPlayerPreview = SkinPreview.start($('#playerProfileSkinCanvas'), img, false);
}

// ── Admin panel (csak "tulajdonos" rangnak) - email/regisztráció + kliens-
// eszközök (ld. SolarBackend src/client.js /api/admin/*). ──
function renderAdminLockStatus(locked) {
  const statusEl = $('#adminLockStatus');
  if (locked) {
    statusEl.textContent = `Ez a fiók ZÁROLVA van. Indok: ${locked.reason}. Zárolta: ${locked.by}, ekkor: ${formatLedgerDate(locked.at)}.`;
    statusEl.className = 'redeem-result error';
  } else {
    statusEl.textContent = 'Ez a fiók jelenleg nincs zárolva.';
    statusEl.className = 'redeem-result';
  }
}

// A "Változtatás" gomb kattintásakor felfedett szerkesztő mezőnek kell
// tudnia, mi a JELENLEG mentett email, hogy "Mégse"-nél pontosan erre
// tudjon visszaállni (ne a régi, esetleg félbehagyott beírt szöveget mutassa).
let currentAdminEmail = '';

function setAdminEmailEditing(editing) {
  $('#adminEmailView').classList.toggle('hidden', editing);
  $('#adminEmailEditRow').classList.toggle('hidden', !editing);
  if (editing) {
    $('#adminPlayerEmailInput').value = currentAdminEmail;
    $('#adminPlayerEmailInput').focus();
  }
}

async function loadAdminPlayerPanel(username) {
  currentAdminEmail = '';
  $('#adminPlayerEmailText').textContent = '…';
  $('#adminPlayerCreatedAt').textContent = '…';
  $('#adminPlayerDiscordLink').textContent = '…';
  $('#adminEmailResult').textContent = '';
  $('#adminLockStatus').textContent = '';
  $('#adminLockReasonInput').value = '';
  $('#adminPlayerLoginsBody').innerHTML = '';
  $('#adminPlayerDevicesBody').innerHTML = '';
  $('#adminDeleteUsernameHint').textContent = username;
  $('#adminDeleteConfirmInput').value = '';
  $('#adminDeleteResult').textContent = '';
  $('#adminDeleteBtn').disabled = true;
  setAdminEmailEditing(false);
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(username), {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      $('#adminPlayerCreatedAt').textContent = '-';
      return;
    }
    currentAdminEmail = data.email || '';
    $('#adminPlayerEmailText').textContent = currentAdminEmail || '-';
    $('#adminPlayerCreatedAt').textContent = formatLedgerDate(data.createdAt);
    renderDiscordLinkBadge($('#adminPlayerDiscordLink'), data);
    renderAdminLockStatus(data.locked);
    $('#adminPlayerLoginsBody').innerHTML = data.logins.map((l) => `
      <tr>
        <td>${formatLedgerDate(l.created_at)}</td>
        <td><button type="button" class="device-link" data-device-id="${l.device_id}">#${l.device_id}</button></td>
      </tr>
    `).join('') || '<tr><td colspan="2">Nincs rögzített belépés.</td></tr>';
    $('#adminPlayerDevicesBody').innerHTML = data.devices.map((d) => `
      <tr>
        <td>${formatLedgerDate(d.last_seen)}</td>
        <td><button type="button" class="device-link" data-device-id="${d.device_id}">#${d.device_id}</button></td>
        <td>${d.login_count}</td>
      </tr>
    `).join('') || '<tr><td colspan="3">Nincs rögzített eszköz.</td></tr>';
  } catch {
    $('#adminPlayerCreatedAt').textContent = '-';
  }
}

$('#adminEmailChangeBtn').addEventListener('click', () => setAdminEmailEditing(true));
$('#adminEmailCancelBtn').addEventListener('click', () => setAdminEmailEditing(false));

$('#adminPlayerEmailSave').addEventListener('click', async () => {
  const resultEl = $('#adminEmailResult');
  resultEl.textContent = '';
  resultEl.className = 'redeem-result';
  if (!lastAdminPlayerUsername) return;
  const email = $('#adminPlayerEmailInput').value.trim();
  if (!email) {
    resultEl.textContent = 'Adj meg egy email címet.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (email === currentAdminEmail) { setAdminEmailEditing(false); return; }

  const confirmed = await confirmModal(
    'Email cím módosítása',
    `Biztosan megváltoztatod <b>${lastAdminPlayerUsername}</b> email címét erre: <b>${email}</b>?`,
    'Igen, mentés'
  );
  if (!confirmed) return;

  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni az email címet.';
      resultEl.className = 'redeem-result error';
      return;
    }
    currentAdminEmail = email;
    $('#adminPlayerEmailText').textContent = email;
    setAdminEmailEditing(false);
    showToast('Email cím frissítve.');
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

$('#adminLockBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const reason = $('#adminLockReasonInput').value.trim();
  const statusEl = $('#adminLockStatus');
  if (!reason) {
    statusEl.textContent = 'Adj meg indoklást a zároláshoz.';
    statusEl.className = 'redeem-result error';
    return;
  }
  const confirmed = await confirmModal(
    'Fiók zárolása',
    `Biztosan zárolod <b>${lastAdminPlayerUsername}</b> fiókját? A zárolás alatt sem a SolarCentert, sem a SolarLaunchert nem tudja használni.`,
    'Igen, zárolás'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült zárolni a fiókot.';
      statusEl.className = 'redeem-result error';
      return;
    }
    showToast('Fiók zárolva.');
    loadAdminPlayerPanel(lastAdminPlayerUsername);
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

$('#adminUnlockBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const confirmed = await confirmModal('Zárolás feloldása', `Biztosan feloldod <b>${lastAdminPlayerUsername}</b> fiókjának zárolását?`, 'Igen, feloldás');
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Zárolás feloldva.');
      loadAdminPlayerPanel(lastAdminPlayerUsername);
    } else {
      showToast(data.message || 'Nem sikerült feloldani a zárolást.', true);
    }
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

// A PP-módosítás SZÁNDÉKOSAN NEM közvetlenül a users.sc_balance oszlopot
// írja (ld. SolarBackend src/client.js /api/admin/player/:username/pp-adjust
// megjegyzését) - ezért a válasz itt csak azt jelzi, hogy a kérés
// ELINDULT, a tényleges jóváírás/levonás a SolarShop pluginon keresztül,
// aszinkron (kb. 1 percen belül) történik meg.
$('#adminPpAdjustBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminPpAdjustStatus');
  const amount = parseInt($('#adminPpAdjustAmountInput').value, 10);
  const reason = $('#adminPpAdjustReasonInput').value.trim();
  if (!Number.isInteger(amount) || amount === 0) {
    statusEl.textContent = 'Adj meg egy nullától eltérő, egész összeget.';
    statusEl.className = 'redeem-result error';
    return;
  }
  const confirmed = await confirmModal(
    'PrémiumPont módosítása',
    `Biztosan ${amount > 0 ? 'jóváírsz' : 'levonsz'} <b>${formatPp(Math.abs(amount))}</b>-t <b>${lastAdminPlayerUsername}</b> egyenlegén?`,
    'Igen, végrehajtás'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/pp-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ amount, reason: reason || undefined })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült elindítani a módosítást.';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = 'Módosítás elindítva - kb. 1 percen belül megtörténik.';
    statusEl.className = 'redeem-result';
    $('#adminPpAdjustAmountInput').value = '';
    $('#adminPpAdjustReasonInput').value = '';
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

// A SolarLucky pörgetés adása/elvétele - ELLENTÉTBEN a fenti PP-módosítással,
// ez KÖZVETLENÜL, szinkron módon történik (ld. SolarBackend src/client.js
// /api/admin/player/:username/casino-adjust megjegyzését) - nincs szükség
// a beváltó plugin aszinkron körére, mert a SolarLucky plugin a backendtől
// magától kérdezi le élőben a pörgetés-számot.
$('#adminCasinoAdjustBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminCasinoAdjustStatus');
  const amount = parseInt($('#adminCasinoAdjustAmountInput').value, 10);
  if (!Number.isInteger(amount) || amount === 0) {
    statusEl.textContent = 'Adj meg egy nullától eltérő, egész mennyiséget.';
    statusEl.className = 'redeem-result error';
    return;
  }
  const confirmed = await confirmModal(
    'Casino pörgetés módosítása',
    `Biztosan ${amount > 0 ? 'adsz' : 'elveszel'} <b>${Math.abs(amount)}</b> pörgetést <b>${lastAdminPlayerUsername}</b> SolarLucky-egyenlegéből?`,
    'Igen, végrehajtás'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/casino-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ amount })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült végrehajtani a módosítást.';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = `Módosítva - jelenlegi ingyenes pörgetések: ${data.freeSpinsAvailable}.`;
    statusEl.className = 'redeem-result';
    $('#adminCasinoAdjustAmountInput').value = '';
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

// A törlés gomb CSAK akkor engedélyezett, ha a beírt szöveg PONTOSAN egyezik
// a felhasználónévvel - ez a szándékos "beírásos" plusz megerősítés (a
// szokásos Igen/Mégse ablakon felül) egy VISSZAVONHATATLAN művelethez.
$('#adminDeleteConfirmInput').addEventListener('input', (e) => {
  $('#adminDeleteBtn').disabled = e.target.value !== lastAdminPlayerUsername;
});

$('#adminDeleteBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername || $('#adminDeleteConfirmInput').value !== lastAdminPlayerUsername) return;
  const resultEl = $('#adminDeleteResult');
  resultEl.textContent = '';
  resultEl.className = 'redeem-result';

  const confirmed = await confirmModal(
    'Fiók végleges törlése',
    `Ez <b>VÉGLEGES</b> - biztosan törlöd <b>${lastAdminPlayerUsername}</b> fiókját, a skinjét, vásárlási előzményét és PrémiumPont-egyenlegét? Ez NEM vonható vissza.`,
    'Igen, törlöm véglegesen'
  );
  if (!confirmed) return;

  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült törölni a fiókot.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast('Fiók véglegesen törölve.');
    switchView('players');
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.device-link[data-device-id]');
  if (btn) openDeviceDetail(Number(btn.dataset.deviceId));
});

let currentDeviceId = null;
let currentDeviceBan = null;

async function openDeviceDetail(deviceId) {
  currentDeviceId = deviceId;
  switchView('deviceDetail');
  $('#deviceDetailId').textContent = '#' + deviceId;
  $('#deviceDetailBanStatus').textContent = '';
  $('#deviceLoginsBody').innerHTML = '';
  $('#deviceUsersBody').innerHTML = '';
  $('#banResult').textContent = '';
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/device/' + deviceId, {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      $('#deviceDetailBanStatus').textContent = data.message || 'Nem sikerült betölteni az eszköz adatait.';
      return;
    }
    currentDeviceBan = data.ban;
    renderDeviceBanStatus();
    $('#deviceLoginsBody').innerHTML = data.logins.map((l) => `
      <tr><td>${formatLedgerDate(l.created_at)}</td><td>${l.username}</td></tr>
    `).join('') || '<tr><td colspan="2">Nincs rögzített belépés.</td></tr>';
    $('#deviceUsersBody').innerHTML = data.users.map((u) => `
      <tr><td>${formatLedgerDate(u.last_seen)}</td><td>${u.username}</td><td>${u.login_count}</td></tr>
    `).join('') || '<tr><td colspan="3">Nincs rögzített felhasználó.</td></tr>';
  } catch {
    $('#deviceDetailBanStatus').textContent = 'Nem sikerült elérni a szervert.';
  }
}

function renderDeviceBanStatus() {
  if (!currentDeviceBan) {
    $('#deviceDetailBanStatus').textContent = 'Ez az eszköz jelenleg nincs kliens-tiltás alatt.';
    $('#deviceBanCurrentNote').textContent = '';
    return;
  }
  // A "until" ISO-formában jön (a backend Date.toISOString()-jével generálva,
  // ld. src/client.js /ban), ezért itt közvetlenül new Date()-tel olvassuk,
  // NEM a formatLedgerDate()-tel (az a "YYYY-MM-DD HH:MM:SS" SQLite-formát vár).
  const untilText = currentDeviceBan.permanent ? 'Végleges tiltás.' : `Lejár: ${new Date(currentDeviceBan.until).toLocaleString('hu-HU')}.`;
  $('#deviceDetailBanStatus').textContent = `Ez az eszköz jelenleg TILTVA van. Indok: ${currentDeviceBan.reason}. ${untilText}`;
  $('#deviceBanCurrentNote').textContent = `Jelenlegi tiltás - tiltotta: ${currentDeviceBan.bannedBy}, ekkor: ${formatLedgerDate(currentDeviceBan.bannedAt)}.`;
}

$('#btnBackFromDevice').addEventListener('click', () => switchView('playerProfile'));

$('#banPermanentCheck').addEventListener('change', (e) => {
  $('#banDurationValue').disabled = e.target.checked;
  $('#banDurationUnit').disabled = e.target.checked;
});

$('#banSubmitBtn').addEventListener('click', async () => {
  const resultEl = $('#banResult');
  resultEl.textContent = '';
  resultEl.className = 'redeem-result';
  if (!currentDeviceId) return;

  const permanent = $('#banPermanentCheck').checked;
  const reason = $('#banReasonInput').value.trim();
  if (!reason) {
    resultEl.textContent = 'Adj meg indoklást.';
    resultEl.className = 'redeem-result error';
    return;
  }
  const durationValue = Number($('#banDurationValue').value);
  const durationUnit = $('#banDurationUnit').value;
  const unitLabel = { perc: 'perc', ora: 'óra', nap: 'nap', het: 'hét' }[durationUnit] || durationUnit;
  const confirmMsg = permanent
    ? `Biztosan <b>véglegesen</b> tiltod ezt az eszközt (#${currentDeviceId})?`
    : `Biztosan tiltod ezt az eszközt (#${currentDeviceId}) <b>${durationValue} ${unitLabel}</b>-ra?`;
  const confirmed = await confirmModal('Kliens-tiltás megerősítése', confirmMsg, 'Igen, tiltás');
  if (!confirmed) return;

  try {
    const res = await fetch(BACKEND_URL + '/api/admin/device/' + currentDeviceId + '/ban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify(permanent ? { permanent: true, reason } : { durationValue, durationUnit, reason })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült végrehajtani a tiltást.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast('Kliens-tiltás alkalmazva.');
    openDeviceDetail(currentDeviceId);
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

$('#unbanSubmitBtn').addEventListener('click', async () => {
  if (!currentDeviceId) return;
  const confirmed = await confirmModal('Tiltás feloldása', `Biztosan feloldod ennek az eszköznek (#${currentDeviceId}) a kliens-tiltását?`, 'Igen, feloldás');
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/device/' + currentDeviceId + '/unban', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) {
      showToast('Tiltás feloldva.');
      openDeviceDetail(currentDeviceId);
    } else {
      showToast(data.message || 'Nem sikerült feloldani a tiltást.', true);
    }
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

$('#btnBackToPlayers').addEventListener('click', () => switchView('players'));

// ── Csomag-ikonok (PrémiumPont, kitiltáscsökkentés, rangok mind ezt
// használják). ──
// JAVÍTVA: a "ban"/"micMute" ikonok korábban kézzel rajzolt, bonyolult bezier-
// útvonalak voltak, amik torzan/elcsúszva jelentek meg - most egyszerű,
// garantáltan szimmetrikus SVG alapformákból (kör, vonal, téglalap) épülnek fel.
const ICONS = {
  coin: '<img src="assets/pp-coin.png" alt="PP" />',
  gem: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h12l4 6-10 12L2 9z"/></svg>',
  crown: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 8l4 3 5-6 5 6 4-3-2 11H5z"/></svg>',
  micMute: `<svg viewBox="0 0 24 24">
    <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/>
    <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`,
  ban: `<svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/>
    <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`
};

// ── Bolt (PrémiumPont + kitiltáscsökkentés) - Stripe Checkout ──
// A katalógus (nevek/árak) a backendtől jön (GET /api/shop/catalog) - a
// SolarBackend src/shop.js az EGYETLEN hiteles forrás, itt csak
// megjelenítjük, hogy a két hely (backend/frontend) sose kerülhessen
// szinkronon kívülre. A korábbi, közvetlenül a CraftingStore-ra mutató
// linkeket a "Vásárlás" gomb egy backend-hívása váltja fel (ld. buyItem),
// ami egy Stripe Checkout Session URL-jére irányít át.
let shopCatalog = [];

// A beépített toLocaleString('hu-HU') NBSP-t tesz ezres elválasztónak, a
// csomagkártyák eredeti kialakítása viszont pontot használt (pl. "1.500 Ft") -
// ezt a formázást tartjuk meg itt kézzel, hogy a megjelenés ne változzon.
function formatHuf(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft';
}

// A "locked" (true, ha nincs mit csökkenteni) csak a némítás-/kitiltás-/
// kliens-tiltás-csökkentés kártyáknál kap értéket (ld. loadShopCatalog) - a
// PrémiumPont-csomagoknál mindig undefined marad, ott nincs ilyen feltétel.
function renderPkgCard(item, locked) {
  const lockedNote = locked
    ? `<div class="pkg-locked-note">Nincs aktív szankciód - nincs mit csökkenteni</div>`
    : '';
  return `
    <div class="pkg-card${item.featured ? ' featured' : ''}${locked ? ' pkg-card-locked' : ''}">
      <div class="pkg-icon">${ICONS[item.icon] || ICONS.coin}</div>
      <div class="pkg-name">${item.short}</div>
      <div class="pkg-price">${formatHuf(item.priceHuf)}</div>
      <button type="button" class="btn-buy" data-item-id="${item.id}"${locked ? ' disabled' : ''}>Vásárlás</button>
      <button type="button" class="btn-outline btn-gift" data-gift-item-id="${item.id}">🎁 Ajándékozás</button>
      ${lockedNote}
    </div>
  `;
}

async function loadShopCatalog() {
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/catalog');
    const data = await res.json();
    shopCatalog = data.ok && Array.isArray(data.items) ? data.items : [];
  } catch {
    shopCatalog = [];
  }

  const coinItems = shopCatalog.filter((i) => i.type === 'sc');
  const muteItems = shopCatalog.filter((i) => i.type === 'mute_reduction');
  const banItems = shopCatalog.filter((i) => i.type === 'ban_reduction');
  const cbanItems = shopCatalog.filter((i) => i.type === 'cban_reduction');

  // ÚJ: a "Vásárlás" gomb (nem az ajándékozás - azt más játékos szankciójára
  // vesszük, ld. buyItem/giftModal) csak akkor kattintható, ha a
  // bejelentkezett játékosnak TÉNYLEG van aktív szankciója az adott
  // típusból (ld. currentSanctionStatus, enterApp() tölti a legutóbbi
  // /api/me válaszból) - a szerver a /checkout végponton ÚGYIS elutasítaná,
  // ez csak megelőzi, hogy valaki feleslegesen próbálkozzon.
  const muteLocked = !currentSanctionStatus.activeMute;
  const banLocked = !currentSanctionStatus.activeBan;
  const cbanLocked = !currentSanctionStatus.activeCban;

  $('#coinPkgGrid').innerHTML = coinItems.map((i) => renderPkgCard(i)).join('');
  $('#sanctionPkgWrap').innerHTML = `
    <div class="pkg-category">Némítás feloldás</div>
    <div class="pkg-grid">${muteItems.map((i) => renderPkgCard(i, muteLocked)).join('')}</div>
    <div class="pkg-category">Kitiltás feloldás</div>
    <div class="pkg-grid">${banItems.map((i) => renderPkgCard(i, banLocked)).join('')}</div>
    <div class="pkg-category">Kliens-tiltás csökkentése</div>
    <div class="pkg-grid">${cbanItems.map((i) => renderPkgCard(i, cbanLocked)).join('')}</div>
  `;
}
loadShopCatalog();

// ── Rangok - NEM Stripe-fizetés, a játékos MÁR meglévő PrémiumPont-
// egyenlegéből vonja le a beváltó plugin (ld. POST /api/shop/purchase-rank) -
// ezért itt nincs redirect, csak egy visszajelzés, hogy a kérés elindult
// (a tényleges fedezet-ellenőrzés a pluginban, aszinkron történik). A gombok
// állapotát (elég PP van-e) itt, kliens-oldalon is ellenőrizzük - ez csak UX-
// segéd, a valódi, biztonságos ellenőrzést mindig a plugin végzi élő adaton. ──
function formatPp(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' PP';
}

let shopRanks = [];

function renderRankCard(rank) {
  const affordable = currentPpBalance >= rank.priceCoins;
  return `
    <div class="rank-card${rank.id === 'solaryn' ? ' featured' : ''}${affordable ? '' : ' insufficient'}">
      <div class="rank-card-head">
        <div class="pkg-icon">${ICONS.crown}</div>
        <div class="rank-card-name">${rank.label}</div>
      </div>
      <div class="rank-card-duration">${rank.duration}</div>
      <div class="pkg-price rank-price"><img src="assets/pp-coin.png" alt="PP" class="rank-price-icon" />${formatPp(rank.priceCoins)}</div>
      <ul class="info-list rank-perm-list">${rank.perms.map((p) => `<li>${p}</li>`).join('')}</ul>
      <button type="button" class="btn-buy" data-rank-id="${rank.id}"${affordable ? '' : ' disabled'}>${affordable ? 'Vásárlás' : 'Nincs elég PP'}</button>
      <button type="button" class="btn-outline btn-gift" data-gift-rank-id="${rank.id}"${affordable ? '' : ' disabled'}>🎁 Ajándékozás</button>
    </div>
  `;
}

function renderRankGrid() {
  $('#rankGrid').innerHTML = shopRanks.map(renderRankCard).join('');
}

async function loadRanks() {
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/ranks');
    const data = await res.json();
    shopRanks = data.ok && Array.isArray(data.ranks) ? data.ranks : [];
  } catch {
    shopRanks = [];
  }
  renderRankGrid();
  $('#rankGrid').dataset.loaded = '1';
}
loadRanks();

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy[data-rank-id]');
  if (btn && !btn.disabled) buyRank(btn.dataset.rankId, btn);
});

// Egyszerű, a site stílusát követő Igen/Mégse megerősítő modál (a natív
// confirm() helyett) - Promise<boolean>-t ad vissza.
function confirmModal(title, message, okLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn-outline" id="confirmModalCancel">Mégse</button>
          <button type="button" class="btn-glow" id="confirmModalOk" style="margin-top:0;">${okLabel || 'Igen'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const finish = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#confirmModalCancel').addEventListener('click', () => finish(false));
    overlay.querySelector('#confirmModalOk').addEventListener('click', () => finish(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
  });
}

async function buyRank(rankId, buttonEl, giftTo, giftMessage) {
  if (!session || !session.token) {
    showToast('A vásárláshoz jelentkezz be.', true);
    return;
  }
  const rank = shopRanks.find((r) => r.id === rankId);
  if (rank && currentPpBalance < rank.priceCoins) {
    showToast('Nincs elég PrémiumPontod ehhez a ranghoz.', true);
    return;
  }
  const confirmed = await confirmModal(
    'Biztosan megveszed?',
    giftTo
      ? (rank ? `A(z) <b>${rank.label}</b> rangot ajándékozod <b>${giftTo}</b>-nak <b>${formatPp(rank.priceCoins)}</b>-ért - ez a TE egyenlegedből kerül levonásra.` : `Biztosan ajándékozod ezt a rangot ${giftTo}-nak?`)
      : (rank ? `A(z) <b>${rank.label}</b> rangot vásárolod meg <b>${formatPp(rank.priceCoins)}</b>-ért. Ez levonásra kerül az egyenlegedből.` : 'Biztosan megveszed ezt a rangot?'),
    giftTo ? 'Igen, ajándékozás' : 'Igen, vásárlás'
  );
  if (!confirmed) return;

  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = giftTo ? 'Ajándékozás...' : 'Vásárlás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/purchase-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify(giftTo ? { rankId, giftTo, giftMessage } : { rankId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.message || 'Nem sikerült elindítani a vásárlást.', true);
    } else {
      showToast(giftTo ? `Ajándékozás elindítva - ${giftTo} kb. 1 percen belül megkapja a rangot.` : 'Vásárlás elindítva - ha elég PrémiumPontod van, kb. 1 percen belül megkapod a rangot.');
    }
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

// Az ajándékozás címzettjét/opcionális üzenetét kérdező modál - a
// confirmModal()-hoz hasonló Promise-alapú minta, de saját input mezőkkel. A
// visszaadott {giftTo, giftMessage} objektumot a buyItem()/buyRank() a
// checkout/purchase-rank kérés testébe fűzi bele (ld. SolarBackend src/shop.js
// validateGiftTarget() végzi a tényleges, biztonságos ellenőrzést).
function giftModal(itemLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Ajándékozás</h3>
        <p>Kinek ajándékozod ezt: <b>${itemLabel}</b>?</p>
        <label class="gift-modal-label" for="giftModalRecipient">Címzett felhasználóneve</label>
        <input type="text" id="giftModalRecipient" class="gift-modal-input" placeholder="Játékosnév" />
        <label class="gift-modal-label" for="giftModalMessage">Üzenet a címzettnek (nem kötelező)</label>
        <textarea id="giftModalMessage" class="gift-modal-input" placeholder="Pl. Boldog szülinapot!" maxlength="256" rows="2"></textarea>
        <div class="modal-actions" style="margin-top:18px;">
          <button type="button" class="btn-outline" id="giftModalCancel">Mégse</button>
          <button type="button" class="btn-glow" id="giftModalOk" style="margin-top:0;">Ajándékozás</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const finish = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#giftModalCancel').addEventListener('click', () => finish(null));
    overlay.querySelector('#giftModalOk').addEventListener('click', () => {
      const recipient = overlay.querySelector('#giftModalRecipient').value.trim();
      const message = overlay.querySelector('#giftModalMessage').value.trim();
      if (!recipient) {
        showToast('Add meg a címzett felhasználónevét.', true);
        return;
      }
      finish({ giftTo: recipient, giftMessage: message || undefined });
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
  });
}

async function giftItem(itemId, buttonEl) {
  if (!session || !session.token) {
    showToast('A vásárláshoz jelentkezz be.', true);
    return;
  }
  const item = shopCatalog.find((i) => i.id === itemId);
  const result = await giftModal(item ? item.short : 'a csomagot');
  if (!result) return;
  buyItem(itemId, buttonEl, result.giftTo, result.giftMessage);
}

async function giftRank(rankId, buttonEl) {
  if (!session || !session.token) {
    showToast('A vásárláshoz jelentkezz be.', true);
    return;
  }
  const rank = shopRanks.find((r) => r.id === rankId);
  if (rank && currentPpBalance < rank.priceCoins) {
    showToast('Nincs elég PrémiumPontod ehhez a ranghoz.', true);
    return;
  }
  const result = await giftModal(rank ? rank.label : 'a rangot');
  if (!result) return;
  buyRank(rankId, buttonEl, result.giftTo, result.giftMessage);
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-gift[data-gift-item-id]');
  if (btn) giftItem(btn.dataset.giftItemId, btn);
});
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-gift[data-gift-rank-id]');
  if (btn && !btn.disabled) giftRank(btn.dataset.giftRankId, btn);
});

// ── Átutalás - a tényleges levonást/jóváírást is a beváltó plugin végzi
// (aszinkron, ld. SolarShop fulfillTransfer), itt csak elindítjuk a kérést. A
// 10%-os díj kliens-oldali kiszámítása csak megjelenítési célú előzetes
// becslés - a backend/plugin újraszámolja, ez a tényleges forrás. ──
const TRANSFER_FEE_PERCENT = 10;

function updateTransferFeeNote() {
  const amount = parseInt($('#transferAmountInput').value, 10);
  const note = $('#transferFeeNote');
  if (!Number.isInteger(amount) || amount <= 0) {
    note.innerHTML = 'Add meg az összeget a díj kiszámításához.';
    return;
  }
  const total = Math.ceil(amount * (1 + TRANSFER_FEE_PERCENT / 100));
  note.innerHTML = `10% díjjal együtt <b>${formatPp(total)}</b> kerül levonásra az egyenlegedből.`;
}
$('#transferAmountInput').addEventListener('input', updateTransferFeeNote);

$('#transferSubmitBtn').addEventListener('click', async () => {
  const resultEl = $('#transferResult');
  resultEl.textContent = '';
  resultEl.className = 'redeem-result';

  if (!session || !session.token) {
    showToast('Az átutaláshoz jelentkezz be.', true);
    return;
  }
  const recipient = $('#transferRecipientInput').value.trim();
  const amount = parseInt($('#transferAmountInput').value, 10);
  if (!recipient) {
    resultEl.textContent = 'Add meg a címzett felhasználónevét.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    resultEl.textContent = 'Adj meg egy érvényes összeget.';
    resultEl.className = 'redeem-result error';
    return;
  }
  const total = Math.ceil(amount * (1 + TRANSFER_FEE_PERCENT / 100));
  if (currentPpBalance < total) {
    resultEl.textContent = `Nincs elég PrémiumPontod (${formatPp(currentPpBalance)} van, ${formatPp(total)} kellene).`;
    resultEl.className = 'redeem-result error';
    return;
  }
  const confirmed = await confirmModal(
    'Biztosan átutalod?',
    `<b>${formatPp(amount)}</b>-t küldesz <b>${recipient}</b>-nak. A 10% díjjal együtt <b>${formatPp(total)}</b> kerül levonásra az egyenlegedből.`,
    'Igen, utalás'
  );
  if (!confirmed) return;

  const btn = $('#transferSubmitBtn');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Átutalás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ recipient, amount })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült elindítani az átutalást.';
      resultEl.className = 'redeem-result error';
    } else {
      showToast('Átutalás elindítva - kb. 1 percen belül megtörténik.');
      $('#transferRecipientInput').value = '';
      $('#transferAmountInput').value = '';
      updateTransferFeeNote();
    }
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
});

// ── Napló - a dátum-tartományt a backend szűri (ld. GET /api/shop/ledger),
// a szöveges keresést (érintett/művelet/részletek) kliens-oldalon, a már
// letöltött listán, hogy ne kelljen minden billentyűleütésre új kérést
// küldeni. ──
const LEDGER_TYPE_LABELS = {
  transfer_in: 'Átutalás',
  transfer_out: 'Átutalás',
  purchase: 'Vásárlás',
  game_purchase: 'Játékbeli vásárlás',
  gift_sent: 'Ajándékozás (küldött)',
  gift_received: 'Ajándékozás (kapott)',
  admin_adjust: 'Admin módosítás'
};

let ledgerEntries = [];

function formatLedgerDate(sqliteDatetime) {
  // A backend "YYYY-MM-DD HH:MM:SS" (UTC, datetime('now')) alakot ad vissza -
  // ISO-formára alakítva adjuk át a Date-nek, hogy megbízhatóan parse-olja.
  const d = new Date(sqliteDatetime.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return sqliteDatetime;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderLedgerRow(entry) {
  const typeLabel = LEDGER_TYPE_LABELS[entry.type] || entry.type;
  const amountClass = entry.amount > 0 ? 'ledger-amount-positive' : entry.amount < 0 ? 'ledger-amount-negative' : 'ledger-amount-zero';
  const amountText = (entry.amount > 0 ? '+' : '') + formatPp(entry.amount);
  return `
    <tr>
      <td>${formatLedgerDate(entry.created_at)}</td>
      <td>${entry.counterparty || '-'}</td>
      <td>${typeLabel}</td>
      <td>${entry.detail || '-'}</td>
      <td class="${amountClass}">${amountText}</td>
      <td class="ledger-balance">${formatPp(entry.balance_after)}</td>
    </tr>
  `;
}

function renderLedgerTable() {
  const search = $('#ledgerSearchInput').value.trim().toLowerCase();
  const filtered = !search ? ledgerEntries : ledgerEntries.filter((e) => {
    const haystack = [(e.counterparty || ''), (LEDGER_TYPE_LABELS[e.type] || e.type), (e.detail || '')].join(' ').toLowerCase();
    return haystack.includes(search);
  });
  $('#ledgerTableBody').innerHTML = filtered.map(renderLedgerRow).join('');
  $('#ledgerEmptyNote').classList.toggle('hidden', filtered.length > 0);
}

async function loadLedger() {
  if (!session || !session.token) return;
  const from = $('#ledgerFromInput').value;
  const to = $('#ledgerToInput').value;
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/ledger?' + params.toString(), {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    ledgerEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    ledgerEntries = [];
  }
  renderLedgerTable();
}

$('#ledgerSearchInput').addEventListener('input', renderLedgerTable);

// ── Napló (admin) - tulajdonosi rálátás MINDEN játékos pp_ledger
// bejegyzésére (ld. SolarBackend GET /api/admin/logs[/:username]), szemben a
// fenti (saját) Napló füllel - ugyanazt a "ledger-table" HTML/CSS mintát és
// segédfüggvényeket (formatLedgerDate/LEDGER_TYPE_LABELS/formatPp) használja,
// csak egy plusz "Játékos" oszloppal, mert itt több felhasználó keveredik. ──
let adminLogsEntries = [];

function renderAdminLogRow(entry) {
  const typeLabel = LEDGER_TYPE_LABELS[entry.type] || entry.type;
  const amountClass = entry.amount > 0 ? 'ledger-amount-positive' : entry.amount < 0 ? 'ledger-amount-negative' : 'ledger-amount-zero';
  const amountText = (entry.amount > 0 ? '+' : '') + formatPp(entry.amount);
  return `
    <tr>
      <td>${formatLedgerDate(entry.created_at)}</td>
      <td>${entry.username}</td>
      <td>${entry.counterparty || '-'}</td>
      <td>${typeLabel}</td>
      <td>${entry.detail || '-'}</td>
      <td class="${amountClass}">${amountText}</td>
      <td class="ledger-balance">${formatPp(entry.balance_after)}</td>
    </tr>
  `;
}

function renderAdminLogsTable() {
  $('#adminLogsTableBody').innerHTML = adminLogsEntries.map(renderAdminLogRow).join('');
  $('#adminLogsEmptyNote').classList.toggle('hidden', adminLogsEntries.length > 0);
}

async function loadAdminLogsGlobal() {
  if (!session || !session.token || !isOwner) return;
  $('#adminLogsUserSearchInput').value = '';
  $('#adminLogsScopeNote').textContent = 'Legutóbbi 100 bejegyzés (globális, minden játékos).';
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/logs', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    adminLogsEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    adminLogsEntries = [];
  }
  renderAdminLogsTable();
}

async function loadAdminLogsForUser(username) {
  if (!session || !session.token || !isOwner || !username) return;
  $('#adminLogsScopeNote').textContent = `"${username}" legutóbbi 100 bejegyzése.`;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/logs/' + encodeURIComponent(username), {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    adminLogsEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    adminLogsEntries = [];
  }
  renderAdminLogsTable();
}

$('#adminLogsUserSearchBtn').addEventListener('click', () => {
  const username = $('#adminLogsUserSearchInput').value.trim();
  if (username) loadAdminLogsForUser(username); else loadAdminLogsGlobal();
});
$('#adminLogsUserSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#adminLogsUserSearchBtn').click();
});
$('#adminLogsClearBtn').addEventListener('click', loadAdminLogsGlobal);
$('#ledgerFromInput').addEventListener('change', loadLedger);
$('#ledgerToInput').addEventListener('change', loadLedger);

// ── Csapat statisztika (admin, ld. SolarBackend GET /api/admin/staff-stats) ──
async function loadStaffStats() {
  if (!session || !session.token || !isOwner) return;
  let staff = [];
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/staff-stats', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    staff = data.ok && Array.isArray(data.staff) ? data.staff : [];
  } catch {
    staff = [];
  }
  $('#staffStatsTableBody').innerHTML = staff.map((s) => `
    <tr>
      <td>${escapeHtml(s.username)}</td>
      <td>${escapeHtml(s.rank)}</td>
      <td>${formatPlaytime(s.onlineSeconds)}</td>
      <td>${s.mutesIssued}</td>
      <td>${s.bansIssued}</td>
    </tr>
  `).join('');
  $('#staffStatsEmptyNote').classList.toggle('hidden', staff.length > 0);
}

// ── Havi bevétel (admin) - naptár nézet: minden évhez mind a 12 hónap
// kártyaként megjelenik (akkor is, ha egy hónapban nem volt vásárlás), a
// LEGFRISSEBB év felül. Az évek listáját a ténylegesen létező adatokból ÉS a
// jelen évből építjük - így egy vadonatúj, még adat nélküli évben is
// azonnal látszik a folyó hónap kártyája, nem csak ott, ahol már van adat.
const REVENUE_MONTH_NAMES = ['Jan', 'Feb', 'Márc', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szept', 'Okt', 'Nov', 'Dec'];

function buildRevenueCalendarHtml(months) {
  const dataByMonth = Object.fromEntries(months.map((m) => [m.month, m]));
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1;

  const years = new Set([currentYear]);
  months.forEach((m) => years.add(Number(m.month.slice(0, 4))));
  const sortedYears = [...years].sort((a, b) => b - a);

  return sortedYears.map((year) => {
    const yearTotal = months
      .filter((m) => m.month.startsWith(year + '-'))
      .reduce((sum, m) => sum + m.totalHuf, 0);

    const cards = REVENUE_MONTH_NAMES.map((name, i) => {
      const monthNum = i + 1;
      const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
      const isFuture = year > currentYear || (year === currentYear && monthNum > currentMonthNum);
      const entry = dataByMonth[monthKey];
      const hasData = entry && entry.purchaseCount > 0;
      const stateClass = isFuture ? 'future' : hasData ? 'has-data' : 'no-data';
      return `
        <div class="revenue-month-card ${stateClass}" data-revenue-month="${monthKey}">
          <div class="revenue-month-name">${name}</div>
          <div class="revenue-month-amount">${hasData ? formatHuf(entry.totalHuf) : (isFuture ? '—' : '0 Ft')}</div>
          <div class="revenue-month-count">${hasData ? entry.purchaseCount + ' vásárlás' : (isFuture ? '' : 'Nincs adat')}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="revenue-calendar-year">
        <div class="revenue-calendar-year-title">${year}<span class="revenue-calendar-year-total">Éves összesen: ${formatHuf(yearTotal)}</span></div>
        <div class="revenue-month-grid">${cards}</div>
      </div>
    `;
  }).join('');
}

async function loadRevenue() {
  if (!session || !session.token || !isOwner) return;
  let months = [];
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/revenue', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    months = data.ok && Array.isArray(data.months) ? data.months : [];
  } catch {
    months = [];
  }
  $('#revenueCalendar').innerHTML = buildRevenueCalendarHtml(months);
}

document.addEventListener('click', (e) => {
  const card = e.target.closest('.revenue-month-card[data-revenue-month]');
  if (card) loadRevenueDetail(card.dataset.revenueMonth);
});

async function loadRevenueDetail(month) {
  $('#revenueDetailTitle').textContent = 'Havi bevétel - ' + month;
  $('#revenueDetailTotal').textContent = '…';
  $('#revenueDetailCount').textContent = '';
  $('#revenueDetailTableBody').innerHTML = '';
  switchView('revenueDetail');
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/revenue/' + month, {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) return;
    $('#revenueDetailTotal').textContent = formatHuf(data.totalHuf);
    $('#revenueDetailCount').textContent = `${data.purchaseCount} sikeres vásárlás`;
    $('#revenueDetailTableBody').innerHTML = data.purchases.map((p) => `
      <tr>
        <td>${formatLedgerDate(p.createdAt)}</td>
        <td>${escapeHtml(p.username)}</td>
        <td>${escapeHtml(p.label)}</td>
        <td>${formatHuf(p.priceHuf)}</td>
      </tr>
    `).join('');
    $('#revenueDetailEmptyNote').classList.toggle('hidden', data.purchases.length > 0);
  } catch {
    $('#revenueDetailTotal').textContent = '-';
  }
}

$('#btnBackToRevenue').addEventListener('click', () => switchView('revenue'));

// ── Felhívások/hírek (admin, ld. SolarBackend src/news.js) ──
let newsEditingId = null;
let newsAdminItems = [];

function resetNewsForm() {
  newsEditingId = null;
  $('#newsFormTitle').textContent = 'Új felhívás';
  $('#newsTitleInput').value = '';
  $('#newsContentInput').value = '';
  $('#newsFormResult').textContent = '';
  $('#newsFormResult').className = 'redeem-result';
  $('#newsSaveBtn').textContent = 'Mentés';
}

function renderNewsAdminList() {
  $('#newsAdminList').innerHTML = newsAdminItems.map((n) => `
    <div class="news-admin-item">
      <div class="news-admin-item-head">
        <div>
          <div class="news-admin-item-title">${escapeHtml(n.title)}</div>
          <div class="news-admin-item-meta">${escapeHtml(n.created_by)} - ${formatLedgerDate(n.created_at)}${n.updated_at ? ' (szerkesztve: ' + formatLedgerDate(n.updated_at) + ')' : ''}</div>
        </div>
        <div class="news-admin-item-actions">
          <button type="button" class="news-edit-btn" data-news-id="${n.id}">Szerkesztés</button>
          <button type="button" class="news-delete-btn" data-news-id="${n.id}">Törlés</button>
        </div>
      </div>
      <p class="news-admin-item-content">${escapeHtml(n.content)}</p>
    </div>
  `).join('') || '<p class="redeem-result">Még nincs egyetlen felhívás sem.</p>';
}

async function loadNewsAdmin() {
  if (!session || !session.token || !isOwner) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/news', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    newsAdminItems = data.ok && Array.isArray(data.news) ? data.news : [];
  } catch {
    newsAdminItems = [];
  }
  renderNewsAdminList();
}

$('#newsDiscardBtn').addEventListener('click', resetNewsForm);

$('#newsSaveBtn').addEventListener('click', async () => {
  const resultEl = $('#newsFormResult');
  const title = $('#newsTitleInput').value.trim();
  const content = $('#newsContentInput').value.trim();
  if (!title || !content) {
    resultEl.textContent = 'Adj meg címet és tartalmat.';
    resultEl.className = 'redeem-result error';
    return;
  }
  try {
    const url = newsEditingId ? BACKEND_URL + '/api/admin/news/' + newsEditingId : BACKEND_URL + '/api/admin/news';
    const res = await fetch(url, {
      method: newsEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ title, content })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast(newsEditingId ? 'Felhívás frissítve.' : 'Felhívás mentve - mostantól ez a legfrissebb hír.');
    resetNewsForm();
    loadNewsAdmin();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.news-edit-btn');
  if (editBtn) {
    const item = newsAdminItems.find((n) => String(n.id) === editBtn.dataset.newsId);
    if (!item) return;
    newsEditingId = item.id;
    $('#newsFormTitle').textContent = 'Felhívás szerkesztése';
    $('#newsTitleInput').value = item.title;
    $('#newsContentInput').value = item.content;
    $('#newsSaveBtn').textContent = 'Frissítés';
    $('#newsFormResult').textContent = '';
    return;
  }
  const deleteBtn = e.target.closest('.news-delete-btn');
  if (deleteBtn) {
    const id = deleteBtn.dataset.newsId;
    confirmModal('Felhívás törlése', 'Biztosan törlöd ezt a felhívást? Ez nem vonható vissza.', 'Igen, törlés').then((confirmed) => {
      if (!confirmed) return;
      fetch(BACKEND_URL + '/api/admin/news/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      }).then((res) => res.json()).then((data) => {
        if (data.ok) {
          showToast('Felhívás törölve.');
          if (String(newsEditingId) === String(id)) resetNewsForm();
          loadNewsAdmin();
        } else {
          showToast('Nem sikerült törölni.', true);
        }
      }).catch(() => showToast('Nem sikerült elérni a szervert.', true));
    });
  }
});

// A főoldal "Profilod" szekció alatti kártya - MINDENKI látja (nem csak
// tulajdonos), csak a legfrissebb (egyetlen) hírt jeleníti meg. Ha még
// sosem mentettek hírt, a kártya rejtve marad.
async function loadHomeNews() {
  if (!session || !session.token) return;
  const card = $('#homeNewsCard');
  try {
    const res = await fetch(BACKEND_URL + '/api/news/latest', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    const news = data.ok ? data.news : null;
    if (!news) { card.classList.add('hidden'); return; }
    $('#homeNewsTitle').textContent = news.title;
    $('#homeNewsMeta').textContent = formatLedgerDate(news.created_at);
    $('#homeNewsContent').textContent = news.content;
    card.classList.remove('hidden');
  } catch {
    // Csendben kihagyjuk - a kártya rejtve marad, a következő belépéskor újra próbálkozunk.
  }
}

function showToast(message, isError) {
  const el = document.createElement('div');
  el.className = 'shop-toast' + (isError ? ' shop-toast-error' : '');
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

// A csomagrácsok minden betöltéskor újragenerálódnak (loadShopCatalog), ezért
// eseménydelegálással figyeljük a "Vásárlás" gombokat, nem közvetlen
// bekötéssel - így egy újrarenderelés után sincs szükség újrakötésre.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy[data-item-id]');
  if (btn) buyItem(btn.dataset.itemId, btn);
});

async function buyItem(itemId, buttonEl, giftTo, giftMessage) {
  if (!session || !session.token) {
    showToast('A vásárláshoz jelentkezz be.', true);
    return;
  }
  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Átirányítás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      // A returnUrl (origin + PATH, query nélkül) mondja meg a backendnek,
      // hova irányítson vissza a Stripe checkout után - a puszta origin nem
      // volt elég, mert ha a SolarCenter nem a domain gyökerén fut, a
      // gyökérre visszadobás egy másik oldalt (pl. a "hamarosan" landing
      // page-et) mutatta a fizetés után a checkmark helyett. A giftTo/
      // giftMessage csak akkor kerül bele, ha ajándékozásról van szó (ld.
      // giftItem() lejjebb) - a backend a Stripe session "metadata" mezőjén
      // keresztül viszi át a webhookig.
      body: JSON.stringify(giftTo
        ? { itemId, returnUrl: window.location.origin + window.location.pathname, giftTo, giftMessage }
        : { itemId, returnUrl: window.location.origin + window.location.pathname })
    });
    const data = await res.json();
    if (!data.ok || !data.url) {
      showToast(data.message || 'Nem sikerült elindítani a fizetést.', true);
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
      return;
    }
    window.location.href = data.url;
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

// A "modal-overlay"/"modal-card" osztályokat a süti-beállítások modál is
// használja (ld. index.html #cookieModal + style.css) - ugyanazt a vizuális
// stílust kapja a vásárlás-visszaigazolás is, nem egy egyedi megjelenést.
function showPurchaseSuccessModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card purchase-success-card">
      <div class="purchase-success-icon">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.6"/>
          <path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3>Sikeres vásárlás!</h3>
      <p>A jóváírás/aktiválás automatikusan, néhány percen belül megtörténik - legyél elérhető a szerveren.</p>
      <div class="modal-actions">
        <button type="button" class="btn-outline" id="purchaseSuccessClose">Rendben</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#purchaseSuccessClose').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

// A Stripe checkout sikeres/megszakított visszatérésének jelzése (ld.
// SolarBackend src/shop.js success_url/cancel_url: "/?checkout=success|cancel").
// A query paramétert megjelenítés után eltávolítjuk az URL-ből, hogy egy
// oldalfrissítés ne mutassa újra ugyanazt az üzenetet.
(function handleCheckoutReturn() {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get('checkout');
  if (!checkout) return;
  if (checkout === 'success') {
    showPurchaseSuccessModal();
  } else if (checkout === 'cancel') {
    showToast('A vásárlás megszakadt.', true);
  }
  params.delete('checkout');
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
})();

// ── Discord fiók összekötés (ld. SolarBackend src/discord.js) ──
// A Wolfy Discord bot /link (vagy /update) parancsa egy "?discordLink=<token>"
// linket ad a felhasználónak - a tokent itt, oldalbetöltéskor olvassuk ki
// (de MÉG NEM töröljük az URL-ből, mert a felhasználó lehet, hogy még nincs
// bejelentkezve). A tényleges "elfogyasztás" (a token beváltása a MÁR
// bejelentkezett munkamenettel) az enterApp() VÉGÉN történik (ld. ott a
// tryConsumeDiscordLink() hívást) - ez az egyetlen hely, amit MINDEN
// bejelentkezési út (automata/kézi/regisztráció) lefut, tehát a token attól
// függetlenül beváltódik, hogy a felhasználó a linkre kattintáskor már be
// volt-e jelentkezve, vagy csak utána jelentkezett be.
let pendingDiscordLinkToken = (function readPendingDiscordLinkToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('discordLink') || null;
})();

function clearDiscordLinkParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete('discordLink');
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

async function tryConsumeDiscordLink() {
  if (!pendingDiscordLinkToken || !session || !session.token) return;
  const token = pendingDiscordLinkToken;
  pendingDiscordLinkToken = null; // azonnal töröljük, hogy egy hibás válasz se próbálkozzon újra a helyén
  clearDiscordLinkParam();

  // apiPost() nem küld Authorization fejlécet, ez a végpont viszont
  // requireAuth-os - ezért itt közvetlenül fetch-elünk, a session tokenjével.
  try {
    const res = await fetch(BACKEND_URL + '/api/discord/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ token })
    });
    const result = await res.json();
    if (result.ok) {
      showToast(`Discord fiók összekötve: ${result.discordUsername}`);
      renderDiscordLinkBadge($('#profileDiscordLink'), { discordUsername: result.discordUsername, discordAvatar: result.discordAvatar });
    } else {
      showToast(result.message || 'A Discord-összekötés sikertelen.', true);
    }
  } catch {
    showToast('Nem sikerült elérni a szervert a Discord-összekötéshez.', true);
  }
}

// ── Ajándék-értesítés (ld. SolarBackend src/shop.js GET /api/shop/gifts/pending) ──
// Csak a MÁR TELJESÍTETT (a SolarShop plugin által ténylegesen jóváírt)
// ajándékokat kérdezzük le - enterApp() végén, minden bejelentkezéskor, hogy
// a következő belépéskor is megjelenjen, ha valaki épp akkor kapott
// ajándékot, amikor nem volt bejelentkezve.
function giftItemLabel(gift) {
  if (gift.item_type === 'rank') return gift.label ? `a(z) ${gift.label} rangot` : 'egy rangot';
  if (typeof gift.amount === 'number' && gift.amount > 0) return formatPp(gift.amount);
  return gift.label || 'egy terméket';
}

function showNextGiftModal(queue) {
  if (!queue.length) return;
  const gift = queue.shift();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card purchase-success-card">
      <div class="purchase-success-icon" style="font-size:28px;border-color:var(--gold);color:var(--gold);box-shadow:0 0 24px var(--gold-glow);">🎁</div>
      <h3>Ajándékot kaptál!</h3>
      <p><b>${gift.from}</b> ajándékozott neked ${giftItemLabel(gift)}.</p>
      ${gift.gift_message ? `<p class="gift-message">„${gift.gift_message}”</p>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn-outline" id="giftAckBtn" style="flex:0 1 160px;margin:0 auto;">Rendben</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const finish = async () => {
    overlay.remove();
    try {
      await fetch(BACKEND_URL + '/api/shop/gifts/' + gift.id + '/ack', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.token }
      });
    } catch {
      // Csendben kihagyjuk - ha nem sikerült nyugtázni, a következő
      // bejelentkezéskor egyszerűen újra megjelenik ugyanez az ajándék.
    }
    showNextGiftModal(queue);
  };
  overlay.querySelector('#giftAckBtn').addEventListener('click', finish);
}

async function checkPendingGifts() {
  if (!session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/gifts/pending', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok && Array.isArray(data.gifts) && data.gifts.length) {
      showNextGiftModal(data.gifts.slice());
    }
  } catch {
    // Csendben kihagyjuk - a következő bejelentkezéskor úgyis újra lekérdezzük.
  }
}

// ── Discord widget ──
// JAVÍTVA: a korábbi saját widget.json-fetch megoldás helyett most a Discord
// SAJÁT hivatalos iframe-widgetje van beágyazva közvetlenül az index.html-be
// (a felhasználó által adott guild ID-val) - ez pontosan azt az "élő tagok"
// nézetet adja, amit a referencia-képernyőn mutatott, és nem igényel semmilyen
// saját JS-logikát a betöltéséhez.
function loadDiscordWidget() {}

// ── Jogi dokumentumok nézet (a lábléc Impresszum/ÁSZF/Adatvédelem linkjeiről
// nyílik - korábban ezek "#"-re mutattak, sehová sem vezettek). ──
let lastViewBeforeLegal = 'home';

function openLegal(tab) {
  const activeEl = document.querySelector('.view.active');
  if (activeEl && activeEl.dataset.view !== 'legal') lastViewBeforeLegal = activeEl.dataset.view;
  switchView('legal');
  setLegalTab(tab || 'aszf');
}

function setLegalTab(tab) {
  $$('.legal-tab').forEach((t) => t.classList.toggle('active', t.dataset.legal === tab));
  $$('.legal-panel').forEach((p) => p.classList.toggle('active', p.dataset.legalPanel === tab));
}

$$('.legal-tab').forEach((t) => t.addEventListener('click', () => setLegalTab(t.dataset.legal)));
$$('[data-legal-link]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    openLegal(a.dataset.legalLink);
  });
});
$('#linkTerms').addEventListener('click', () => openLegal('aszf'));
$('#btnBackFromLegal').addEventListener('click', () => switchView(lastViewBeforeLegal));

// ── Süti beállítások modál ──
const cookieModal = $('#cookieModal');
function openCookieModal() {
  try {
    const saved = JSON.parse(localStorage.getItem('solarcenter_cookies') || '{}');
    $('#cookieAnalytics').checked = !!saved.analytics;
  } catch { /* nincs elmentett beállítás */ }
  cookieModal.classList.remove('hidden');
}
function closeCookieModal() { cookieModal.classList.add('hidden'); }
$('#btnCookieSettings').addEventListener('click', (e) => { e.preventDefault(); openCookieModal(); });
cookieModal.addEventListener('click', (e) => { if (e.target === cookieModal) closeCookieModal(); });
$('#cookieSaveBtn').addEventListener('click', () => {
  localStorage.setItem('solarcenter_cookies', JSON.stringify({ analytics: $('#cookieAnalytics').checked }));
  closeCookieModal();
});
$('#cookieRejectAll').addEventListener('click', () => {
  $('#cookieAnalytics').checked = false;
  localStorage.setItem('solarcenter_cookies', JSON.stringify({ analytics: false }));
  closeCookieModal();
});

// ── Vizsgálat elleni alapvédelem ──
// FONTOS: ez KIZÁRÓLAG visszatartó jellegű - a jobb klikk és a leggyakoribb
// DevTools-gyorsbillentyűk letiltása bárkit, aki tényleg meg akarja nézni az
// oldal kódját vagy hálózati forgalmát (pl. a böngésző saját menüjéből nyitva
// meg a DevTools-t, vagy JS-t letiltva), pár másodperc alatt megkerül - ez NEM
// valódi biztonsági határ, ne bízz rá tényleg érzékeny adatot.
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const key = e.key;
  const blocked =
    key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(key)) ||
    (e.ctrlKey && ['U', 'u'].includes(key));
  if (blocked) e.preventDefault();
});

tryAutoLogin();
