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
    if (!res.ok) return { ok: false };
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
  if (!res.ok) { $('#authError').textContent = res.message || 'Sikertelen bejelentkezés.'; return; }
  session = { username: res.username, token: res.token };
  saveSession();
  enterApp();
}

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
  } else {
    session = null;
    saveSession();
    $('#authScreen').classList.remove('hidden');
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
const STAT_ICONS = {
  rank: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.4z"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15.9v1.1h-2v-1.1a3.6 3.6 0 0 1-2.8-2.4l1.8-.7a1.8 1.8 0 0 0 1.8 1.3c.8 0 1.4-.4 1.4-1s-.5-.9-1.7-1.2c-1.8-.5-3-1.2-3-2.9a2.8 2.8 0 0 1 2.5-2.6V7.3h2v1.1a3.2 3.2 0 0 1 2.3 2l-1.8.7a1.5 1.5 0 0 0-1.5-1.1c-.7 0-1.2.3-1.2.9s.6.8 1.8 1.2c1.9.5 2.9 1.3 2.9 2.9a2.9 2.9 0 0 1-2.5 2.9z"/></svg>',
  time: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5.4l4 2.3-.8 1.3L11 13V7z"/></svg>'
};

function renderStatBadges(container, values) {
  const items = [
    { icon: 'rank', label: 'Rang', value: values.rank },
    { icon: 'coin', label: 'PrémiumPont', value: values.coin },
    { icon: 'time', label: 'Online töltött idő', value: values.time }
  ];
  container.innerHTML = items.map((it) => `
    <div class="stat-badge">
      <div class="stat-badge-icon">${STAT_ICONS[it.icon]}</div>
      <div>
        <div class="stat-badge-label">${it.label}</div>
        <div class="stat-badge-value">${it.value}</div>
      </div>
    </div>
  `).join('');
}

// Amíg egy adott statisztikát még sosem jelentett be plugin (pl. a játékos
// sosem lépett még a szerverre), a megfelelő mező null/hiányzik a backendtől -
// ilyenkor esik vissza helykitöltőre ("—"/"0"/"0 óra").
function emptyStats() {
  return { rank: '—', coin: '0', time: '0 óra' };
}

function formatPlaytime(seconds) {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
  const hours = Math.floor(s / 3600);
  return `${hours.toLocaleString('hu-HU')} óra`;
}

function formatStats(data) {
  if (!data) return emptyStats();
  return {
    rank: data.rank ? data.rank : '—',
    coin: typeof data.scBalance === 'number' ? data.scBalance.toLocaleString('hu-HU') : '0',
    time: formatPlaytime(data.playtimeSeconds)
  };
}

// A rangvásárlás gombjai (ld. renderRankCard/refreshPpBalance) ebből olvassák
// ki, hogy a játékosnak van-e elég fedezete - ez csak kliens-oldali UX-segéd
// (a tényleges, biztonságos ellenőrzést a beváltó plugin végzi élő adaton),
// ezért egy kicsit elavult érték sem okoz problémát, csak rossz gombállapotot
// mutathat egy frissítésig.
let currentPpBalance = 0;

function renderProfilePpBadge() {
  $('#profilePpValue').textContent = formatPp(currentPpBalance);
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
  currentPpBalance = typeof meData?.scBalance === 'number' ? meData.scBalance : 0;
  renderProfilePpBadge();

  loadTopbarAvatar();
  loadHomeSkinPreview();
  loadDiscordWidget();
  renderSideRails();
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
  if (!img) return;
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

async function openPlayerProfile(username) {
  switchView('playerProfile');
  $('#playerProfileTitle').textContent = username;
  $('#playerProfileName').textContent = username;
  renderStatBadges($('#playerProfileStats'), emptyStats());
  apiGetProfile(username).then((profile) => {
    renderStatBadges($('#playerProfileStats'), profile.ok ? formatStats(profile) : emptyStats());
  });

  const noteEl = $('#playerProfileSkinNote');
  const img = await loadSkinImage(username);
  if (!img) {
    noteEl.textContent = 'Ez a játékos még nem töltött fel skint.';
    return;
  }
  noteEl.textContent = '';
  if (stopPlayerPreview) stopPlayerPreview();
  stopPlayerPreview = SkinPreview.start($('#playerProfileSkinCanvas'), img, false);
}

$('#btnBackToPlayers').addEventListener('click', () => switchView('players'));

// ── Csomag-ikonok (PrémiumPont, kitiltáscsökkentés, rangok mind ezt
// használják). ──
// JAVÍTVA: a "ban"/"micMute" ikonok korábban kézzel rajzolt, bonyolult bezier-
// útvonalak voltak, amik torzan/elcsúszva jelentek meg - most egyszerű,
// garantáltan szimmetrikus SVG alapformákból (kör, vonal, téglalap) épülnek fel.
const ICONS = {
  coin: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 15.9v1.1h-2v-1.1a3.6 3.6 0 0 1-2.8-2.4l1.8-.7a1.8 1.8 0 0 0 1.8 1.3c.8 0 1.4-.4 1.4-1s-.5-.9-1.7-1.2c-1.8-.5-3-1.2-3-2.9a2.8 2.8 0 0 1 2.5-2.6V7.3h2v1.1a3.2 3.2 0 0 1 2.3 2l-1.8.7a1.5 1.5 0 0 0-1.5-1.1c-.7 0-1.2.3-1.2.9s.6.8 1.8 1.2c1.9.5 2.9 1.3 2.9 2.9a2.9 2.9 0 0 1-2.5 2.9z"/></svg>',
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

function renderPkgCard(item) {
  return `
    <div class="pkg-card${item.featured ? ' featured' : ''}">
      <div class="pkg-icon">${ICONS[item.icon] || ICONS.coin}</div>
      <div class="pkg-name">${item.short}</div>
      <div class="pkg-price">${formatHuf(item.priceHuf)}</div>
      <button type="button" class="btn-buy" data-item-id="${item.id}">Vásárlás</button>
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

  $('#coinPkgGrid').innerHTML = coinItems.map(renderPkgCard).join('');
  $('#sanctionPkgWrap').innerHTML = `
    <div class="pkg-category">Némítás feloldás</div>
    <div class="pkg-grid">${muteItems.map(renderPkgCard).join('')}</div>
    <div class="pkg-category">Kitiltás feloldás</div>
    <div class="pkg-grid">${banItems.map(renderPkgCard).join('')}</div>
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
      <div class="pkg-price">${formatPp(rank.priceCoins)}</div>
      <ul class="info-list rank-perm-list">${rank.perms.map((p) => `<li>${p}</li>`).join('')}</ul>
      <button type="button" class="btn-buy" data-rank-id="${rank.id}"${affordable ? '' : ' disabled'}>${affordable ? 'Vásárlás' : 'Nincs elég PP'}</button>
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
function confirmModal(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button type="button" class="btn-outline" id="confirmModalCancel">Mégse</button>
          <button type="button" class="btn-glow" id="confirmModalOk" style="margin-top:0;">Igen, vásárlás</button>
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

async function buyRank(rankId, buttonEl) {
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
    rank ? `A(z) <b>${rank.label}</b> rangot vásárolod meg <b>${formatPp(rank.priceCoins)}</b>-ért. Ez levonásra kerül az egyenlegedből.` : 'Biztosan megveszed ezt a rangot?'
  );
  if (!confirmed) return;

  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Vásárlás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/purchase-rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ rankId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.message || 'Nem sikerült elindítani a vásárlást.', true);
    } else {
      showToast('Vásárlás elindítva - ha elég PrémiumPontod van, kb. 1 percen belül megkapod a rangot.');
    }
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
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

async function buyItem(itemId, buttonEl) {
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
      // page-et) mutatta a fizetés után a checkmark helyett.
      body: JSON.stringify({ itemId, returnUrl: window.location.origin + window.location.pathname })
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
