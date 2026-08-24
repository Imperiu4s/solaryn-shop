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

// ÚJ: gyors fiókváltás (a SolarLauncher accounts/activeUsername mintáját
// követve, ld. SolarLauncher src/config.js+renderer.js) - több elmentett
// fiók (max 5), egy "aktív" közülük. A "session" változó MARAD a fájl
// TÖBBI RÉSZÉBEN mindenhol hivatkozott, származtatott {username, token} pár
// (az aktív fióké) - így nem kellett a fájlban szétszórt session.token/
// session.username hivatkozásokat egyenként átírni, csak a MÖGÖTTES tárolást
// alakítottuk többfiókosra.
let accounts = [];
let activeUsername = '';
let session = null;

// Egyszeri migráció a régi, egyfiókos "solarcenter_session" kulcsról - ha
// már létezik az új "solarcenter_accounts" kulcs, nincs teendő.
(function migrateOldSession() {
  if (localStorage.getItem('solarcenter_accounts')) return;
  try {
    const old = JSON.parse(localStorage.getItem('solarcenter_session') || 'null');
    if (old && old.username && old.token) {
      accounts = [{ username: old.username, token: old.token }];
      activeUsername = old.username;
      // JAVÍTVA: enélkül a lenti blokk localStorage.getItem('solarcenter_accounts')
      // hívása még mindig null-t adott volna vissza (még nem írtuk ki), és
      // felülírta volna az imént migrált "accounts"-ot egy üres tömbre,
      // miközben "activeUsername" tévesen megmaradt volna - a végeredmény egy
      // "van aktív felhasználónév, de nincs hozzá tartozó fiók" hibás állapot
      // lett volna (session=null annak ellenére, hogy volt érvényes régi token).
      localStorage.setItem('solarcenter_accounts', JSON.stringify(accounts));
      localStorage.setItem('solarcenter_active_username', activeUsername);
    }
  } catch { /* nincs (érvényes) régi munkamenet - nincs mit migrálni */ }
  localStorage.removeItem('solarcenter_session');
})();
try {
  const savedAccounts = JSON.parse(localStorage.getItem('solarcenter_accounts') || '[]');
  if (Array.isArray(savedAccounts)) accounts = savedAccounts;
  activeUsername = localStorage.getItem('solarcenter_active_username') || activeUsername;
} catch { accounts = []; }

function syncSessionFromAccounts() {
  const acc = accounts.find((a) => a.username === activeUsername);
  session = acc ? { username: acc.username, token: acc.token } : null;
}
function persistAccounts() {
  localStorage.setItem('solarcenter_accounts', JSON.stringify(accounts));
  localStorage.setItem('solarcenter_active_username', activeUsername);
}
syncSessionFromAccounts();

// A fájlban MINDENHOL meglévő hívási pont (login/register/auto-login/
// zárolt-fiók-kijelentkezés stb. - "session = {...}; saveSession();" VAGY
// "session = null; saveSession();") - a belseje mostantól a többfiókos
// tárolást tartja karban, a hívási pontokat NEM kellett módosítani.
function saveSession() {
  if (session) {
    // Felvesz VAGY frissít + aktívvá tesz - ugyanaz, mint a launcher
    // upsertAccountAndActivate()-je. Max 5 fiók, a legrégebbi esik ki.
    const idx = accounts.findIndex((a) => a.username === session.username);
    if (idx >= 0) accounts[idx].token = session.token;
    else {
      accounts.push({ username: session.username, token: session.token });
      if (accounts.length > 5) accounts.shift();
    }
    activeUsername = session.username;
  } else if (activeUsername) {
    // session=null -> az AKTÍV fiók már nem érvényes (zárolva/törölve/
    // kijelentkezés) - ugyanaz, mint a launcher removeAccount()-ja: csak
    // azt az egy sort vesszük ki, a többi elmentett fiók megmarad, és ha
    // maradt másik, arra váltunk.
    accounts = accounts.filter((a) => a.username !== activeUsername);
    activeUsername = accounts[0]?.username || '';
    syncSessionFromAccounts();
  }
  persistAccounts();
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
// JAVÍTVA: a #loginForm mostantól VALÓDI <form> (ld. index.html megjegyzését
// a jelszókezelő-barátságról) - natív "submit" eseményt figyelünk (Enterrel
// VAGY a gombra kattintva egyaránt kiváltódik), preventDefault()-tal, hogy
// ne töltődjön újra az oldal.
$('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); doLogin(); });

// ÚJ: 2FA-tudatos bejelentkezés - a POST /api/login VAGY egy azonnali
// {ok,username,token} választ ad, VAGY (ha a fióknak be van kapcsolva a
// 2FA-ja) egy {requiresTotp:true, pendingToken}-et, amit a
// promptTotpModal()-lal bekért kóddal kell beváltani a POST /api/login/totp
// végponton. Ugyanezt a függvényt hívja a fő bejelentkezési űrlap ÉS a
// fiókváltó-modál "Fiók hozzáadása" mini-űrlapja is (ld. lentebb) - így a
// 2FA-lépés UI-ja egyetlen helyen él, nem duplikálódik.
async function performLogin(username, password, rememberMe) {
  const res = await apiPost('/api/login', { username, password, rememberMe: rememberMe === true });
  if (!res.ok || !res.requiresTotp) return res;
  const totpInput = await promptTotpModal();
  if (!totpInput) return { ok: false, message: 'Megszakítva.' };
  return apiPost('/api/login/totp', { pendingToken: res.pendingToken, ...totpInput });
}

// Promise-alapú 2FA-kód bekérő modal - a confirmModal() mintáját követi,
// DE statikus (nem futásidőben generált) markup (ld. index.html
// #totpPromptModal), mert a kód/helyreállítási-kód mezőknek stabil id-ra
// van szükségük.
function promptTotpModal() {
  return new Promise((resolve) => {
    const overlay = $('#totpPromptModal');
    const codeInput = $('#totpPromptCodeInput');
    const recoveryInput = $('#totpPromptRecoveryInput');
    const useRecoveryLink = $('#totpPromptUseRecovery');
    const errEl = $('#totpPromptError');
    codeInput.value = '';
    recoveryInput.value = '';
    errEl.textContent = '';
    codeInput.classList.remove('hidden');
    recoveryInput.classList.add('hidden');
    useRecoveryLink.textContent = 'Helyreállítási kód használata';
    let usingRecovery = false;

    overlay.classList.remove('hidden');
    codeInput.focus();

    function cleanup() {
      overlay.classList.add('hidden');
      useRecoveryLink.removeEventListener('click', toggleRecovery);
      cancelBtn.removeEventListener('click', onCancel);
      submitBtn.removeEventListener('click', onSubmit);
      overlay.removeEventListener('click', onOverlayClick);
    }
    function toggleRecovery() {
      usingRecovery = !usingRecovery;
      codeInput.classList.toggle('hidden', usingRecovery);
      recoveryInput.classList.toggle('hidden', !usingRecovery);
      useRecoveryLink.textContent = usingRecovery ? 'Kód használata inkább' : 'Helyreállítási kód használata';
      errEl.textContent = '';
      (usingRecovery ? recoveryInput : codeInput).focus();
    }
    function onSubmit() {
      if (usingRecovery) {
        const recoveryCode = recoveryInput.value.trim();
        if (!recoveryCode) { errEl.textContent = 'Add meg a helyreállítási kódot.'; return; }
        cleanup();
        resolve({ recoveryCode });
      } else {
        const code = codeInput.value.trim();
        if (!/^\d{6}$/.test(code)) { errEl.textContent = 'A kód 6 számjegyből áll.'; return; }
        cleanup();
        resolve({ code });
      }
    }
    function onCancel() { cleanup(); resolve(null); }
    function onOverlayClick(e) { if (e.target === overlay) onCancel(); }

    const cancelBtn = $('#totpPromptCancel');
    const submitBtn = $('#totpPromptSubmit');
    useRecoveryLink.addEventListener('click', toggleRecovery);
    cancelBtn.addEventListener('click', onCancel);
    submitBtn.addEventListener('click', onSubmit);
    overlay.addEventListener('click', onOverlayClick);
  });
}

async function doLogin() {
  const user = $('#authUser').value.trim();
  const pass = $('#authPass').value;
  const rememberMe = $('#authRememberMe').checked;
  $('#authError').textContent = '';
  const res = await performLogin(user, pass, rememberMe);
  if (!res.ok) {
    if (res.locked) { showLockedScreen(res.reason); return; }
    $('#authError').textContent = res.message || 'Sikertelen bejelentkezés.';
    return;
  }
  session = { username: res.username, token: res.token };
  saveSession();
  enterApp();
}

// ── Elfelejtett jelszó (ld. SolarBackend src/passwordReset.js) ──
const forgotPasswordModal = $('#forgotPasswordModal');
function openForgotPasswordModal() {
  $('#forgotPasswordInput').value = $('#authUser').value.trim();
  $('#forgotPasswordResult').textContent = '';
  $('#forgotPasswordResult').className = 'redeem-result';
  forgotPasswordModal.classList.remove('hidden');
}
function closeForgotPasswordModal() { forgotPasswordModal.classList.add('hidden'); }
$('#btnForgotPassword').addEventListener('click', (e) => { e.preventDefault(); openForgotPasswordModal(); });
$('#forgotPasswordCancelBtn').addEventListener('click', closeForgotPasswordModal);
forgotPasswordModal.addEventListener('click', (e) => { if (e.target === forgotPasswordModal) closeForgotPasswordModal(); });

$('#forgotPasswordSubmitBtn').addEventListener('click', async () => {
  const resultEl = $('#forgotPasswordResult');
  const identifier = $('#forgotPasswordInput').value.trim();
  if (!identifier) {
    resultEl.textContent = 'Add meg a felhasználóneved vagy az email címed.';
    resultEl.className = 'redeem-result error';
    return;
  }
  const res = await apiPost('/api/password-reset/request', { usernameOrEmail: identifier });
  // A backend SZÁNDÉKOSAN mindig {ok:true}-val válaszol (ld. ott a
  // user-enumeration elleni megjegyzést) - itt is egyszerűen ezt az
  // üzenetet mutatjuk, nem árulunk el többet.
  resultEl.textContent = res.message || 'Ha létezik ilyen fiók, hamarosan kapsz egy emailt.';
  resultEl.className = 'redeem-result success';
});

// A jelszó-emailben kapott "?resetToken=<token>" linkről nyílik meg -
// ugyanaz a minta, mint a "?discordLink=" olvasása lentebb: oldalbetöltéskor
// azonnal kiolvassuk (bejelentkezés NÉLKÜL is használható, hiszen pont az a
// lényege, hogy egy kijelentkezett állapotú felhasználó is vissza tudjon
// jutni a fiókjába), és a modál bezárásakor/sikeres váltás után töröljük az
// URL-ből, hogy egy frissítés ne nyissa meg újra.
const setNewPasswordModal = $('#setNewPasswordModal');
let pendingPasswordResetToken = (function readPendingPasswordResetToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get('resetToken') || null;
})();

function clearResetTokenParam() {
  const params = new URLSearchParams(window.location.search);
  params.delete('resetToken');
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);
}

function closeSetNewPasswordModal() {
  setNewPasswordModal.classList.add('hidden');
  pendingPasswordResetToken = null;
  clearResetTokenParam();
}
$('#setNewPasswordCancelBtn').addEventListener('click', closeSetNewPasswordModal);

if (pendingPasswordResetToken) {
  $('#setNewPasswordInput').value = '';
  $('#setNewPasswordInput2').value = '';
  $('#setNewPasswordResult').textContent = '';
  $('#setNewPasswordResult').className = 'redeem-result';
  setNewPasswordModal.classList.remove('hidden');
}

$('#setNewPasswordSubmitBtn').addEventListener('click', async () => {
  const resultEl = $('#setNewPasswordResult');
  const pass = $('#setNewPasswordInput').value;
  const pass2 = $('#setNewPasswordInput2').value;
  if (!pendingPasswordResetToken) {
    resultEl.textContent = 'Hiányzó vagy lejárt link - kérj egy újat.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (pass.length < 6) {
    resultEl.textContent = 'A jelszó min. 6 karakter.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (pass !== pass2) {
    resultEl.textContent = 'A két jelszó nem egyezik.';
    resultEl.className = 'redeem-result error';
    return;
  }
  const res = await apiPost('/api/password-reset/confirm', { token: pendingPasswordResetToken, newPassword: pass });
  if (!res.ok) {
    resultEl.textContent = res.message || 'Nem sikerült megváltoztatni a jelszót.';
    resultEl.className = 'redeem-result error';
    return;
  }
  closeSetNewPasswordModal();
  showToast('Jelszavad megváltozott - jelentkezz be az új jelszóval.');
  setAuthMode('login');
});

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

function renderStatBadges(container, values) {
  const items = [
    { icon: 'rank', label: 'Rang', html: escapeHtml(values.rank) },
    { icon: 'coin', label: 'PrémiumPont', html: escapeHtml(values.coin) },
    { icon: 'time', label: 'Online töltött idő', html: escapeHtml(values.time) }
  ];
  container.innerHTML = items.map((it) => `
    <div class="stat-badge">
      <div class="stat-badge-icon">${STAT_ICONS[it.icon]}</div>
      <div>
        <div class="stat-badge-label">${it.label}</div>
        <div class="stat-badge-value">${it.html}</div>
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

// Nagy kezdőbetűs csoportnév ("tulajdonos" -> "Tulajdonos") - csak az ELSŐ
// betűt nagybetűsítjük, a többit érintetlenül hagyjuk (a LuckPerms
// csoportnevek eleve kisbetűsek, nem szónként címkeszerűek).
function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatStats(data) {
  if (!data) return emptyStats();
  // JAVÍTVA (a felhasználó kérésére): a jelvényen mostantól a NYERS LuckPerms
  // csoportnév jelenik meg nagy kezdőbetűvel, egyszínű (fehér) szövegként -
  // NEM a színes/szakaszos in-game chat-prefix ("[TULAJDONOS]" stb.). Az
  // isOwner-döntés (enterApp) EZZEL SZEMBEN továbbra is mindig a nyers
  // "data.rank"-ot nézi, sosem ezt a formázott változatot.
  return {
    rank: data.rank ? capitalizeFirst(data.rank) : '—',
    coin: typeof data.scBalance === 'number' ? data.scBalance.toLocaleString('hu-HU') : '0',
    time: formatPlaytime(data.playtimeSeconds)
  };
}

// ÚJ: "Összekötve ezzel: ..." jelvény a profil-kártyán (Főoldal SAJÁT profil,
// illetve a tulajdonosi Játékos-profil admin panelje) - ugyanazt a
// data.discordUsername/discordAvatar mezőpárt használja mindkét helyen (ld.
// SolarBackend /api/me, /api/profile/:username, /api/admin/player/:username).
// ÚJ: "opts.mode" dönti el, a leválasztás-gomb (ha "data" össze van kötve)
// a SAJÁT fiókot (mode:'self', ld. #profileDiscordLink - nincs jogosultsághoz
// kötve, mindenki leválaszthatja a sajátját) vagy egy MÁSIK, admin panelen
// megnyitott játékos fiókját válassza-e le (mode:'admin' - "data-perm"
// attribútumot kap, ld. applyPermVisibility()). opts hiányában (pl. régebbi
// hívási pont) nincs leválasztás-gomb - ugyanaz a viselkedés, mint korábban.
function renderDiscordLinkBadge(container, data, opts) {
  if (!container) return;
  if (data && data.discordUsername) {
    const avatarHtml = data.discordAvatar
      ? `<img class="discord-link-avatar" src="${data.discordAvatar}" alt="" />`
      : '';
    const unlinkBtn = opts
      ? `<button type="button" class="link-btn discord-unlink-btn" data-mode="${opts.mode}"${opts.mode === 'admin' ? ' data-perm="player.action.discordUnlink"' : ''}>Leválasztás</button>`
      : '';
    container.innerHTML = `
      <div class="discord-link-badge discord-link-badge-connected">
        ${avatarHtml}
        <span>Összekötve ezzel: <b>${data.discordUsername}</b></span>
        ${unlinkBtn}
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

// ── Discord leválasztás (saját fiók VAGY - jogosultsággal - egy másik
// játékos fiókja az admin panelről, ld. renderDiscordLinkBadge fenti
// megjegyzését) - ld. SolarBackend src/discord.js POST /api/discord/unlink
// és POST /api/admin/player/:username/discord/unlink. ──
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.discord-unlink-btn');
  if (!btn) return;
  const mode = btn.dataset.mode;
  confirmModal(
    'Discord leválasztása',
    'Biztosan leválasztod ezt a Discord-fiókot? A leválasztás után a szerveren a /link paranccsal köthető össze újra.',
    'Igen, leválasztás'
  ).then((confirmed) => {
    if (!confirmed) return;
    const url = mode === 'admin'
      ? BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/discord/unlink'
      : BACKEND_URL + '/api/discord/unlink';
    fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + session.token } })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) { showToast(data.message || 'Nem sikerült leválasztani.', true); return; }
        showToast('Discord-fiók leválasztva.');
        if (mode === 'admin') {
          renderDiscordLinkBadge($('#adminPlayerDiscordLink'), null, { mode: 'admin' });
          applyPermVisibility($('#adminPlayerDiscordLink'));
        } else {
          renderDiscordLinkBadge($('#profileDiscordLink'), null, { mode: 'self' });
        }
      })
      .catch(() => showToast('Nem sikerült elérni a szervert.', true));
  });
});

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
        ${p.server ? `<div class="casino-prize-server">${escapeHtml(p.server)}</div>` : ''}
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

  // ÚJ: csak akkor vehető próbálkozás, ha az ingyenes keret TÉNYLEGESEN
  // elfogyott (0) - ld. SolarBackend src/casino.js POST /buy-spin
  // "free_spin_available" elutasítás-okát ugyanerről.
  const canBuy = casinoState.purchasesUnlocked && casinoState.purchasesRemaining > 0 && casinoState.freeSpinsAvailable === 0;
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

// ÚJ: valós pénzes "egyenleg" (wallet, ld. SolarBackend src/shop.js POST
// /wallet/topup + /checkout-with-wallet) - ugyanaz a "csak UX-segéd, a
// szerver úgyis ellenőriz" elv, mint a fenti currentPpBalance-nál.
let currentWalletBalanceHuf = 0;
let lastRenderedWalletBalance = null;

// A "tulajdonos" rangú felhasználóknak MINDIG megjelenik a teljes admin
// felület - a backend a SAJÁT jogosultság-ellenőrzést is elvégzi minden
// admin végponton (ld. SolarBackend src/permissions.js requirePermission()),
// ez a kliens-oldali flag/halmaz csak azt dönti el, MEGJELENÍTSÜK-e
// egyáltalán az egyes elemeket.
let isOwner = false;
// ÚJ: egyedi, játékosonkénti admin-jogosultságok (ld. SolarBackend
// src/permissions.js PERMISSION_CATALOG) - a /api/me "permissions" mezőjéből
// töltődik fel (ld. enterApp). hasPerm() a tulajdonosi bypass-t és a
// ténylegesen megkapott jogokat EGYSÉGESEN kezeli, ezt kell hívni minden
// admin nav-elem/mező/gomb láthatóságának eldöntésekor a régi, blanket
// "isOwner" ellenőrzés helyett.
let permSet = new Set();
function hasPerm(key) { return isOwner || permSet.has(key); }
// A player-profil admin panel (ld. openPlayerProfile) EGÉSZE akkor jelenjen
// meg, ha a hívónak van BÁRMILYEN "player.*" jogköre - a panelen belüli
// EGYES mezők/gombok láthatóságát külön, a data-perm attribútumuk szerint
// dönti el applyPermVisibility() (ld. loadAdminPlayerPanel).
const PLAYER_PANEL_KEYS = [
  'player.view.email', 'player.view.createdAt', 'player.view.lockStatus', 'player.view.logins',
  'player.view.devices', 'player.view.discord', 'player.view.media', 'player.view.badges', 'player.view.discount',
  'player.action.skinDelete', 'player.action.skinBan', 'player.action.capeDelete', 'player.action.capeBan',
  'player.action.emailChange', 'player.action.lock', 'player.action.unlock', 'player.action.ppAdjust',
  'player.action.walletAdjust',
  'player.action.casinoAdjust', 'player.action.delete', 'player.action.badgeGrant', 'player.action.badgeRevoke',
  'player.action.discountSet', 'player.action.discountRemove', 'player.action.discordUnlink'
];
// Bármely elemet, aminek van "data-perm" attribútuma, a megfelelő jog
// szerint mutat/rejt - egyetlen közös helyen, hogy a player-admin-panel és
// az eszköz-részletek nézet is ugyanazt a logikát használja. Vesszővel
// felsorolt több kulcs esetén VAGY-kapcsolattal (elég BÁRMELYIK jog), ez
// kell pl. egy "Fiók zárolása" alcímhez, amit lock VAGY unlock jog is
// láthatóvá tehet.
function applyPermVisibility(root = document) {
  root.querySelectorAll('[data-perm]').forEach((el) => {
    const keys = el.dataset.perm.split(',').map((k) => k.trim());
    el.classList.toggle('hidden', !keys.some(hasPerm));
  });
}

// ÚJ: a legutóbb lekért /api/me aktív szankció-állapota (ld.
// renderSanctionStatus fentebb) - a "sanction" (kitiltáscsökkentés) nézet
// ebből dönti el, mely csomagok gombja legyen kattintható (ld.
// loadShopCatalog) - csak akkor lehet megvenni egy csökkentést, ha tényleg
// van mit csökkenteni.
let currentSanctionStatus = { activeMute: null, activeBan: null, activeCban: null };

// ÚJ: a felhasználó kérésére ("sokkal több animáció... modernebb") - a
// PrémiumPont-egyenleg most a régi (vagy első betöltéskor 0) értékről az
// újra SZÁMOLVA fut fel, nem csak egyszerűen kicserélődik a szöveg - a mai
// dashboard-alkalmazásoknál megszokott "count-up" hatás. Csak EZT a
// konkrét számot animáljuk (nem minden statisztikát site-szerte), mert ez a
// leggyakrabban, legszembetűnőbben frissülő érték (minden vásárlás/
// átutalás/rangvásárlás után), a többi statisztika-doboz ritkábban változik.
let lastRenderedPpBalance = null;
function animateNumberTo(el, from, to, formatFn, duration = 650) {
  if (from === to) { el.textContent = formatFn(to); return; }
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out kockás görbe - gyors indulás, lágy megállás
    el.textContent = formatFn(Math.round(from + (to - from) * eased));
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function renderProfilePpBadge() {
  const from = lastRenderedPpBalance === null ? 0 : lastRenderedPpBalance;
  animateNumberTo($('#topbarPpValue'), from, currentPpBalance, formatPp);
  lastRenderedPpBalance = currentPpBalance;
}

// ÚJ: valós pénzes "egyenleg" jelvény (ld. currentWalletBalanceHuf) - a
// topbar-badge mellett az "Egyenleg" oldal saját összeg-kijelzőjét is
// frissíti, ha az épp a DOM-ban van.
function renderWalletBadge() {
  const from = lastRenderedWalletBalance === null ? 0 : lastRenderedWalletBalance;
  animateNumberTo($('#topbarWalletValue'), from, currentWalletBalanceHuf, formatHuf);
  const pageEl = $('#walletPageBalance');
  if (pageEl) pageEl.textContent = formatHuf(currentWalletBalanceHuf);
  // ÚJ: nagyban kiírt egyenleg a főoldalon (ld. index.html #homeWalletBalance).
  const homeEl = $('#homeWalletBalance');
  if (homeEl) animateNumberTo(homeEl, lastRenderedWalletBalance === null ? 0 : lastRenderedWalletBalance, currentWalletBalanceHuf, formatHuf);
  lastRenderedWalletBalance = currentWalletBalanceHuf;
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
  renderDiscordLinkBadge($('#profileDiscordLink'), meData, { mode: 'self' });
  renderSanctionStatus($('#profileSanctionStatus'), meData);
  renderNameBadges($('#profileNameBadges'), meData?.badges);
  currentSanctionStatus = {
    activeMute: meData?.activeMute || null,
    activeBan: meData?.activeBan || null,
    activeCban: meData?.activeCban || null
  };
  // A bejelentkezés ELŐTT (szkript-betöltéskor) lefutott loadShopCatalog()
  // még a fenti alapértelmezett (mind-null, azaz mind-zárolt) állapottal
  // rendereli a kitiltáscsökkentés kártyákat - most, hogy tudjuk a valódi
  // szankció-állapotot, újra kell generálni a gomb-állapotokat. Ugyanígy
  // most már ismert a bejelentkezési token is, tehát az esetleges EGYEDI
  // kedvezmény is bekerülhet mindkét listába (ld. loadShopCatalog/loadRanks).
  loadShopCatalog();
  loadRanks();
  currentPpBalance = typeof meData?.scBalance === 'number' ? meData.scBalance : 0;
  renderProfilePpBadge();
  currentWalletBalanceHuf = typeof meData?.walletBalanceHuf === 'number' ? meData.walletBalanceHuf : 0;
  renderWalletBadge();
  isOwner = typeof meData?.rank === 'string' && meData.rank.toLowerCase() === 'tulajdonos';
  permSet = new Set(Array.isArray(meData?.permissions) ? meData.permissions : []);
  // Minden admin nav-elem a SAJÁT "data-permission" kulcsa szerint jelenik
  // meg (nem egy blanket "isOwner" kapcsolóval) - a "Jogok" nézet (nincs
  // data-permission attribútuma) kivétel, az kizárólag tulajdonosnak
  // látszik, mert a jog-adás maga nem delegálható (ld. #navPermissionsBtn
  // markup indoklását index.html-ben).
  $$('.admin-nav-item[data-permission]').forEach((el) => el.classList.toggle('hidden', !hasPerm(el.dataset.permission)));
  $('#navPermissionsBtn')?.classList.toggle('hidden', !isOwner);
  $('.app-nav-divider.admin-nav-item')?.classList.toggle('hidden', !(isOwner || permSet.size > 0));

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

  // A "Barátok" kártya (ld. loadHomeFriends lentebb).
  loadHomeFriends();
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
    currentWalletBalanceHuf = typeof res.walletBalanceHuf === 'number' ? res.walletBalanceHuf : 0;
    renderWalletBadge();
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

// ── Gyors fiókváltás (ld. accounts/activeUsername fent) - a SolarLauncher
// fiókváltó-modáljának 1:1 UX-portja. ──
const accountModal = $('#accountModal');
function openAccountModal() {
  $('#addAccountForm').classList.add('hidden');
  $('#addAcctUser').value = '';
  $('#addAcctPass').value = '';
  $('#addAcctError').textContent = '';
  renderAccountList();
  accountModal.classList.remove('hidden');
}
function closeAccountModal() { accountModal.classList.add('hidden'); }
$('#btnManageAccounts').addEventListener('click', (e) => {
  e.stopPropagation();
  topbarDropdown.classList.add('hidden');
  topbarUserBtn.classList.remove('open');
  openAccountModal();
});
$('#accountModalClose').addEventListener('click', closeAccountModal);
accountModal.addEventListener('click', (e) => { if (e.target === accountModal) closeAccountModal(); });

function renderAccountList() {
  const listEl = $('#accountList');
  listEl.innerHTML = accounts.map((a, i) => `
    <div class="account-row${a.username === activeUsername ? ' active' : ''}" data-idx="${i}">
      <canvas class="account-row-avatar" data-idx="${i}" width="32" height="32"></canvas>
      <span class="account-row-name">${escapeHtml(a.username)}</span>
      ${a.username === activeUsername ? '<span class="account-row-badge">Aktív</span>' : ''}
      <button type="button" class="account-row-remove" data-remove-username="${escapeHtml(a.username)}" title="Eltávolítás">×</button>
    </div>
  `).join('') || '<p class="player-result-note">Nincs elmentett fiók.</p>';
  $$('#accountList .account-row-avatar').forEach((canvas, i) => {
    drawFaceForPlayer(canvas, { username: accounts[i].username, hasSkin: true });
  });
  $$('#accountList .account-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.account-row-remove')) return;
      const idx = Number(row.dataset.idx);
      const acc = accounts[idx];
      if (acc && acc.username !== activeUsername) switchAccount(acc.username);
    });
  });
  $$('#accountList .account-row-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAccountEntry(btn.dataset.removeUsername);
    });
  });
}

// Váltás egy MÁR elmentett fiókra - a launcher mintáját követve friss
// apiGetMe()-vel újra-ellenőrizve (a token időközben lejárhatott/a fiók
// zárolásra kerülhetett), mielőtt ténylegesen aktívvá tennénk.
async function switchAccount(username) {
  const acc = accounts.find((a) => a.username === username);
  if (!acc) return;
  const res = await apiGetMe(acc.token);
  if (res.ok) {
    activeUsername = username;
    persistAccounts();
    // JAVÍTVA: korábban itt egyszerűen enterApp(res)-t hívtuk újratöltés
    // nélkül - ha admin fiókról egy sima játékos-fiókra (vagy fordítva)
    // váltottunk, az admin-only nézetek/állapotok (pl. épp nyitva volt egy
    // admin nézet) NEM ürültek ki, a régi fiók admin-jogaival lehetett volna
    // tovább műveleteket végezni az újonnan aktív, jogosulatlan fiókkal is -
    // ugyanaz a hiba osztály, amit a removeAccountEntry() lejjebbi
    // location.reload()-ja már elkerül a "×" gombos eltávolításnál. Egy
    // teljes újratöltés a legegyszerűbb módja annak, hogy MINDEN nézet/
    // állapot friss, a most aktív fiókhoz tartozó legyen - tryAutoLogin()
    // a betöltéskor úgyis a most elmentett aktív fiókkal jelentkezik be.
    location.reload();
  } else if (res.locked) {
    closeAccountModal();
    showLockedScreen(res.reason);
  } else {
    // Lejárt/érvénytelen - a launcher mintáját követve kivesszük a listából.
    accounts = accounts.filter((a) => a.username !== username);
    persistAccounts();
    renderAccountList();
    showToast('Ez a munkamenet lejárt - jelentkezz be újra.', true);
  }
}

// "×" gombbal explicit eltávolítás a modálban - ELLENTÉTBEN a saveSession()
// session=null ágával (ami az AKTÍV fiók érvénytelenné válásakor fut le),
// ez bármelyik (akár nem-aktív) fiókot eltávolíthatja.
function removeAccountEntry(username) {
  const wasActive = username === activeUsername;
  accounts = accounts.filter((a) => a.username !== username);
  if (wasActive) {
    activeUsername = accounts[0]?.username || '';
    syncSessionFromAccounts();
  }
  persistAccounts();
  if (wasActive) {
    // Ugyanaz, mint a "Kijelentkezés" gomb - egy reload újraindítja a
    // tryAutoLogin()-t a (esetleg) megmaradt fiókkal.
    location.reload();
  } else {
    renderAccountList();
  }
}

$('#btnShowAddAccount').addEventListener('click', () => {
  $('#addAccountForm').classList.toggle('hidden');
  $('#addAcctUser').focus();
});
$('#btnDoAddAccount').addEventListener('click', async () => {
  const username = $('#addAcctUser').value.trim();
  const password = $('#addAcctPass').value;
  const errEl = $('#addAcctError');
  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Add meg a felhasználóneved és a jelszavad.'; return; }
  const res = await performLogin(username, password, false);
  if (!res.ok) {
    if (res.locked) { closeAccountModal(); showLockedScreen(res.reason); return; }
    errEl.textContent = res.message || 'Sikertelen bejelentkezés.';
    return;
  }
  session = { username: res.username, token: res.token };
  saveSession();
  closeAccountModal();
  enterApp();
});

// ── Biztonság (2FA/TOTP) - ld. SolarBackend src/totp.js ──
let lastGeneratedRecoveryCodes = null;

function showSecurityPanel(panelId) {
  ['securityTotpDisabledPanel', 'securityTotpSetupPanel', 'securityRecoveryCodesPanel', 'securityTotpEnabledPanel']
    .forEach((id) => $('#' + id).classList.toggle('hidden', id !== panelId));
}

async function loadSecurityStatus() {
  if (!session || !session.token) return;
  const statusEl = $('#securityTotpStatus');
  statusEl.textContent = 'Betöltés...';
  try {
    const res = await fetch(BACKEND_URL + '/api/2fa/status', { headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { statusEl.textContent = 'Nem sikerült lekérdezni az állapotot.'; return; }
    if (data.enabled) {
      statusEl.textContent = 'A kétlépcsős azonosítás BE van kapcsolva a fiókodon.';
      $('#securityTotpPasswordInput').value = '';
      $('#securityTotpActionError').textContent = '';
      showSecurityPanel('securityTotpEnabledPanel');
    } else {
      statusEl.textContent = 'A kétlépcsős azonosítás jelenleg NINCS bekapcsolva.';
      showSecurityPanel('securityTotpDisabledPanel');
    }
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
}

$('#btnStart2faSetup').addEventListener('click', async () => {
  try {
    const res = await fetch(BACKEND_URL + '/api/2fa/setup', { method: 'POST', headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült elindítani a beállítást.', true); return; }
    $('#securityTotpQr').src = data.qrCodeDataUrl;
    $('#securityTotpSecretText').textContent = 'Kézi megadáshoz: ' + data.secret;
    $('#securityTotpConfirmInput').value = '';
    $('#securityTotpSetupError').textContent = '';
    showSecurityPanel('securityTotpSetupPanel');
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

$('#btnCancel2faSetup').addEventListener('click', () => showSecurityPanel('securityTotpDisabledPanel'));

$('#btnConfirm2faSetup').addEventListener('click', async () => {
  const code = $('#securityTotpConfirmInput').value.trim();
  const errEl = $('#securityTotpSetupError');
  if (!/^\d{6}$/.test(code)) { errEl.textContent = 'A kód 6 számjegyből áll.'; return; }
  try {
    const res = await fetch(BACKEND_URL + '/api/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.message || 'Érvénytelen kód.'; return; }
    showRecoveryCodes(data.recoveryCodes);
  } catch {
    errEl.textContent = 'Nem sikerült elérni a szervert.';
  }
});

function showRecoveryCodes(codes) {
  lastGeneratedRecoveryCodes = codes;
  $('#securityRecoveryCodesList').innerHTML = codes.map((c) => `<div class="account-row" style="cursor:default;"><span class="account-row-name" style="text-align:center; font-family:monospace; letter-spacing:.05em;">${escapeHtml(c)}</span></div>`).join('');
  showSecurityPanel('securityRecoveryCodesPanel');
}

$('#btnDownloadRecoveryCodes').addEventListener('click', () => {
  if (!lastGeneratedRecoveryCodes) return;
  const text = 'Solaryn - 2FA helyreállítási kódok\n\nEzeket a kódokat csak EGYSZER tudod felhasználni, ha elveszíted a hitelesítő eszközödet.\nTárold biztonságos helyen!\n\n' + lastGeneratedRecoveryCodes.join('\n') + '\n';
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'solaryn-2fa-helyreallitasi-kodok.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

$('#btnDoneRecoveryCodes').addEventListener('click', () => {
  lastGeneratedRecoveryCodes = null;
  loadSecurityStatus();
});

$('#btnDisable2fa').addEventListener('click', async () => {
  const password = $('#securityTotpPasswordInput').value;
  const errEl = $('#securityTotpActionError');
  if (!password) { errEl.textContent = 'Add meg a jelszavad.'; return; }
  const confirmed = await confirmModal('2FA kikapcsolása', 'Biztosan kikapcsolod a kétlépcsős azonosítást? A bejelentkezéshez ezután újra elég lesz csak a jelszavad.', 'Igen, kikapcsolás');
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/2fa/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.message || 'Nem sikerült kikapcsolni.'; return; }
    showToast('A kétlépcsős azonosítás kikapcsolva.');
    loadSecurityStatus();
  } catch {
    errEl.textContent = 'Nem sikerült elérni a szervert.';
  }
});

$('#btnRegenerateRecoveryCodes').addEventListener('click', async () => {
  const password = $('#securityTotpPasswordInput').value;
  const errEl = $('#securityTotpActionError');
  if (!password) { errEl.textContent = 'Add meg a jelszavad az új kódok generálásához.'; return; }
  const confirmed = await confirmModal('Új helyreállítási kódok', 'A régi helyreállítási kódjaid ÉRVÉNYÜKET VESZTIK, csak az újak fognak működni. Folytatod?', 'Igen, új kódok');
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/2fa/regenerate-recovery-codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.message || 'Nem sikerült generálni.'; return; }
    showRecoveryCodes(data.recoveryCodes);
  } catch {
    errEl.textContent = 'Nem sikerült elérni a szervert.';
  }
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
  // Az Egyenleg fület minden megnyitáskor frissítjük - ugyanaz az elv, mint a
  // Rangoknál: friss egyenleget mutasson, ne egy esetleg elavult értéket.
  if (view === 'wallet') refreshPpBalance();
  // A Biztonság fület minden megnyitáskor frissítjük - friss 2FA-állapotot
  // mutasson (ld. loadSecurityStatus).
  if (view === 'security') loadSecurityStatus();
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
  if (view === 'badges') { resetBadgeForm(); loadBadgesAdmin(); }
  if (view === 'discounts') { resetDiscountForm(); loadDiscountsAdmin(); }
  if (view === 'coupons') { resetCouponForm(); loadCouponsAdmin(); }
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
    // JAVÍTVA: a fej UV-régiója (8,8)-(16,16) csak sztenderd, 64 széles
    // skinnél helyes pixelben - HD (pl. 128/256 széles) skinnél ugyanez a
    // régió arányosan nagyobb helyen van, a kép TÉNYLEGES szélessége/64
    // arányában (ld. skin3d.js azonos hibájának javítását ugyanezzel a
    // logikával).
    const scale = (img.naturalWidth || img.width) / 64;
    ctx.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, size, size);
    if ((img.naturalHeight || img.height) > (img.naturalWidth || img.width) / 2) {
      ctx.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, size, size);
    }
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
// ÚJ: a köpenyet (ld. loadCapeImage lentebb) MINDIG együtt kérdezzük le a
// skinnel - ha a felhasználónak van feltöltött köpenye, az a skin 3D-
// modelljén jelenik meg, nincs többé külön köpeny-előnézet.
let stopHomeSkinPreview = null;
async function loadHomeSkinPreview() {
  const [img, capeImg] = await Promise.all([loadSkinImage(session.username), loadCapeImage(session.username)]);
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
  stopHomeSkinPreview = SkinPreview.start($('#homeSkinCanvas'), img, false, capeImg);
}

// ── Skin nézet: 3D előnézet + feltöltés ──
let stopSkinPreview = null;
let skinModel = 'classic';

async function loadSkinPreview3d() {
  if (!session) return;
  const [img, capeImg] = await Promise.all([loadSkinImage(session.username), loadCapeImage(session.username)]);
  if (!img) {
    if (stopSkinPreview) { stopSkinPreview(); stopSkinPreview = null; }
    const canvas = $('#skinPreview3d');
    canvas.width = canvas.width;
    return;
  }
  if (stopSkinPreview) stopSkinPreview();
  stopSkinPreview = SkinPreview.start($('#skinPreview3d'), img, skinModel === 'slim', capeImg);
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

// ── Köpeny: NINCS külön előnézete - a feltöltött köpeny a skin 3D-
// modelljén jelenik meg (ld. loadHomeSkinPreview/loadSkinPreview3d/
// openPlayerProfile, amik MINDIG lekérdezik ezt is a skinnel együtt), ezért
// itt csak a lekérdező függvény + a feltöltés/törlés logika maradt.
function loadCapeImage(username) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = BACKEND_URL + '/api/cape/' + encodeURIComponent(username) + '?t=' + Date.now();
  });
}

const capeFileInput = $('#capeFileInput');
$('#capeDrop').addEventListener('click', () => capeFileInput.click());
$('#capeDrop').addEventListener('dragover', (e) => e.preventDefault());
$('#capeDrop').addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) uploadCapeFile(file);
});
capeFileInput.addEventListener('change', () => {
  const file = capeFileInput.files && capeFileInput.files[0];
  if (file) uploadCapeFile(file);
  capeFileInput.value = '';
});

$('#capeResetBtn').addEventListener('click', async () => {
  const statusEl = $('#capeStatus');
  const confirmed = await confirmModal('Köpeny eltávolítása', 'Biztosan törlöd a jelenlegi köpenyedet?', 'Igen, eltávolítás');
  if (!confirmed) return;
  statusEl.classList.remove('error');
  statusEl.textContent = 'Eltávolítás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/cape/reset', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) {
      statusEl.textContent = 'Köpeny eltávolítva.';
      loadSkinPreview3d();
      loadHomeSkinPreview();
    } else {
      statusEl.classList.add('error');
      statusEl.textContent = data.message || 'A törlés sikertelen.';
    }
  } catch {
    statusEl.classList.add('error');
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
});

async function uploadCapeFile(file) {
  const statusEl = $('#capeStatus');
  statusEl.classList.remove('error');
  statusEl.textContent = 'Feltöltés...';
  try {
    const form = new FormData();
    form.append('cape', file, 'cape.png');
    const res = await fetch(BACKEND_URL + '/api/cape', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: form
    });
    const data = await res.json();
    if (data.ok) {
      statusEl.textContent = 'Köpeny sikeresen feltöltve!';
      loadSkinPreview3d();
      loadHomeSkinPreview();
    } else {
      statusEl.classList.add('error');
      statusEl.textContent = data.message || 'A feltöltés sikertelen.';
    }
  } catch {
    statusEl.classList.add('error');
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
}

// ── Kódbeváltás (ld. SolarBackend src/coupons.js POST /api/coupons/redeem) ──
$('#redeemSubmit').addEventListener('click', async () => {
  const val = $('#redeemInput').value.trim();
  const resultEl = $('#redeemResult');
  resultEl.classList.remove('error');
  if (!val) { resultEl.textContent = ''; return; }
  if (!session || !session.token) { resultEl.classList.add('error'); resultEl.textContent = 'Jelentkezz be a beváltáshoz.'; return; }

  $('#redeemSubmit').disabled = true;
  try {
    const res = await fetch(BACKEND_URL + '/api/coupons/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ code: val })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.classList.add('error');
      resultEl.textContent = data.message || 'Ismeretlen kód.';
      return;
    }
    if (data.rewardType === 'wallet') {
      resultEl.textContent = `Sikeres beváltás! +${formatHuf(data.rewardAmount)} jóváírva az egyenlegeden.`;
      refreshPpBalance();
    } else {
      resultEl.textContent = `Sikeres beváltás! +${formatPp(data.rewardAmount)} PP a következő szerverre lépéskor íródik jóvá.`;
    }
    $('#redeemInput').value = '';
  } catch {
    resultEl.classList.add('error');
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
  } finally {
    $('#redeemSubmit').disabled = false;
  }
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

  // JAVÍTVA: korábban ez a lekérdezés ("$$('.player-card')") NEM volt az
  // eredmény-listára szűkítve - mivel a "Barátok" kártya (ld. loadHomeFriends)
  // a főoldalon UGYANEZT a ".player-card" osztályt használja (és a főoldal
  // DOM-eleme akkor is a lapon marad, ha épp nem az aktív nézet), a globális
  // lekérdezés a barát-kártyákat IS visszaadta, elcsúsztatva az index szerinti
  // "data.players[i]" párosítást - ha volt legalább egy barátod, egy adott
  // ponton "player" undefined lett, ami megszakította a forEach-et, mielőtt a
  // tényleges keresési találatokra rákerülhetett volna a canvas-rajzolás/
  // kattintás-figyelő.
  $$('#playerResult .player-card').forEach((card, i) => {
    const player = data.players[i];
    const canvas = card.querySelector('canvas');
    drawFaceForPlayer(canvas, player);
    card.addEventListener('click', () => openPlayerProfile(player.username));
  });
}

// JAVÍTVA: korábban a méret mindenhol be volt égetve 40-re, ami a
// player-card-canvas (mindig 40x40) hívásoknál nem számított, de a
// fiókváltó-modál KOMPAKTABB, 32x32-es account-row-avatar canvasán (ld.
// renderAccountList) elcsúszott/kilógott képet eredményezett, mert a
// rajzolás egy nála nagyobb (40x40) területet feltételezett. Most a canvas
// SAJÁT width attribútumából olvassuk ki a tényleges méretet, így bármilyen
// négyzet alakú canvasra helyesen rajzol.
async function drawFaceForPlayer(canvas, player) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const size = canvas.width;
  const img = player.hasSkin ? await loadSkinImage(player.username) : null;
  if (img) {
    ctx.clearRect(0, 0, size, size);
    // JAVÍTVA: ld. drawFaceFromSkin ugyanezen HD-skálázási javítását.
    const scale = (img.naturalWidth || img.width) / 64;
    ctx.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, size, size);
    if ((img.naturalHeight || img.height) > (img.naturalWidth || img.width) / 2) {
      ctx.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, size, size);
    }
  } else {
    drawDefaultFace(ctx, size);
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
  renderNameBadges($('#playerProfileNameBadges'), null);
  apiGetProfile(username).then((profile) => {
    renderStatBadges($('#playerProfileStats'), profile.ok ? formatStats(profile) : emptyStats());
    // ÚJ: a felhasználó kérésére a némítás-/kitiltás-állapot a játékos-
    // keresőben (bárki profilját megnézve) is megjelenik, nem csak a saját
    // fooldalon - ld. SolarBackend GET /api/profile/:username kiterjesztését.
    renderSanctionStatus($('#playerProfileSanctionStatus'), profile.ok ? profile : null);
    // ÚJ: jelvények (ld. SolarBackend src/badges.js) - mindenki látja bárki
    // más neve mellett is, nem csak a sajátjánál.
    renderNameBadges($('#playerProfileNameBadges'), profile.ok ? profile.badges : null);
  });

  lastAdminPlayerUsername = username;
  const canSeeAdminPanel = PLAYER_PANEL_KEYS.some(hasPerm);
  $('#playerProfileAdminPanel').classList.toggle('hidden', !canSeeAdminPanel);
  if (canSeeAdminPanel) loadAdminPlayerPanel(username);

  const noteEl = $('#playerProfileSkinNote');
  // ÚJ: a köpenyt is lekérdezzük ehhez a MÁSIK játékoshoz - ha van neki
  // feltöltve, ugyanúgy megjelenik a 3D előnézetén, mint a sajátodén.
  const [img, capeImg] = await Promise.all([loadSkinImage(username), loadCapeImage(username)]);
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
  stopPlayerPreview = SkinPreview.start($('#playerProfileSkinCanvas'), img, false, capeImg);
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

// ÚJ: a játékos-profil admin paneljének "Jelvények" szekciója - a
// jelenleg birtokolt jelvényeket tárolja, hogy a grant/revoke gombok
// mindig friss listára hivatkozzanak (ld. loadAdminPlayerPanel/
// renderAdminPlayerBadgesList).
let currentAdminPlayerBadges = [];

async function ensureAllBadgesLoaded() {
  if (allBadgesCache.length) return allBadgesCache;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/badges', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    allBadgesCache = data.ok && Array.isArray(data.badges) ? data.badges : [];
  } catch {
    allBadgesCache = [];
  }
  return allBadgesCache;
}

function renderAdminPlayerBadgesList(badgeList) {
  currentAdminPlayerBadges = Array.isArray(badgeList) ? badgeList : [];
  const canRevoke = hasPerm('player.action.badgeRevoke');
  $('#adminPlayerBadgesList').innerHTML = currentAdminPlayerBadges.map((b) => `
    <span class="admin-player-badge-chip" style="color:${escapeHtml(b.color)}">
      <img src="${badgeIconUrl(b.id)}" alt="" />
      ${escapeHtml(b.name)}
      ${canRevoke ? `<button type="button" data-revoke-badge-id="${b.id}" title="Elvétel">×</button>` : ''}
    </span>
  `).join('') || '<p class="redeem-result">Ennek a játékosnak még nincs egyetlen jelvénye sem.</p>';
}

async function renderAdminBadgeSelectOptions() {
  const all = await ensureAllBadgesLoaded();
  const select = $('#adminBadgeSelect');
  if (!all.length) {
    select.innerHTML = '<option value="">Nincs létrehozott jelvény</option>';
    return;
  }
  select.innerHTML = all.map((b) => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
}

async function loadAdminPlayerPanel(username) {
  applyPermVisibility($('#playerProfileAdminPanel'));
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
  $('#adminBadgeGrantStatus').textContent = '';
  $('#adminPlayerBadgesList').innerHTML = '';
  $('#adminMediaStatus').textContent = '';
  renderAdminMediaState(false, false);
  setAdminEmailEditing(false);
  renderAdminBadgeSelectOptions();
  $('#adminDiscountStatus').textContent = '';
  $('#adminDiscountPercentInput').value = '';
  $('#adminDiscountReasonInput').value = '';
  $('#adminDiscountExpiresInput').value = '';
  renderAdminDiscountState(null);
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
    renderDiscordLinkBadge($('#adminPlayerDiscordLink'), data, { mode: 'admin' });
    applyPermVisibility($('#adminPlayerDiscordLink'));
    renderAdminLockStatus(data.locked);
    renderAdminPlayerBadgesList(data.badges);
    renderAdminMediaState(data.hasSkin, data.hasCape);
    renderAdminDiscountState(data.discount);
    $('#adminPlayerLoginsBody').innerHTML = (data.logins || []).map((l) => `
      <tr>
        <td>${formatLedgerDate(l.created_at)}</td>
        <td><button type="button" class="device-link" data-device-id="${l.device_id}">#${l.device_id}</button></td>
      </tr>
    `).join('') || '<tr><td colspan="2">Nincs rögzített belépés.</td></tr>';
    $('#adminPlayerDevicesBody').innerHTML = (data.devices || []).map((d) => `
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

// ÚJ: a "Kedvezmény beállítása" admin-alszekció összefoglaló szövege (ld.
// SolarBackend src/discounts.js GET /api/admin/player/:username "discount"
// mezője - "null", ha nincs, vagy már lejárt egyedi kedvezmény).
function renderAdminDiscountState(discount) {
  const el = $('#adminDiscountCurrent');
  if (!discount) { el.textContent = 'Jelenleg nincs egyedi kedvezménye.'; return; }
  const parts = [`Jelenlegi egyedi kedvezmény: ${discount.percent}%`];
  if (discount.expires_at) parts.push(`lejár: ${formatLedgerDate(discount.expires_at)}`);
  if (discount.reason) parts.push(`indoklás: ${discount.reason}`);
  el.textContent = parts.join(' - ');
}

// ÚJ: a "Skin / Köpeny" admin-alszekció állapot-kijelzése + gombok
// engedélyezése/tiltása - ld. index.html #adminSkinState/#adminCapeState.
// A gombok csak akkor aktívak, ha ténylegesen VAN mit törölni/tiltani.
function renderAdminMediaState(hasSkin, hasCape) {
  $('#adminSkinState').textContent = hasSkin ? 'van feltöltve' : 'nincs feltöltve';
  $('#adminCapeState').textContent = hasCape ? 'van feltöltve' : 'nincs feltöltve';
  $('#adminSkinDeleteBtn').disabled = !hasSkin;
  $('#adminSkinBanBtn').disabled = !hasSkin;
  $('#adminCapeDeleteBtn').disabled = !hasCape;
  $('#adminCapeBanBtn').disabled = !hasCape;
}

// A négy gomb (skin/köpeny × törlés/tiltás) ugyanazt a mintát követi -
// egyetlen segédfüggvény hívja mindegyiket, csak a végpont/szöveg különbözik.
async function adminMediaAction(kind, action, confirmTitle, confirmBody, confirmLabel) {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminMediaStatus');
  statusEl.className = 'redeem-result';
  const confirmed = await confirmModal(confirmTitle, confirmBody, confirmLabel);
  if (!confirmed) return;
  statusEl.textContent = 'Végrehajtás...';
  try {
    const path = '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/' + kind + (action === 'ban' ? '/ban' : '');
    const res = await fetch(BACKEND_URL + path, {
      method: action === 'ban' ? 'POST' : 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.classList.add('error');
      statusEl.textContent = data.message || 'A művelet sikertelen.';
      return;
    }
    statusEl.textContent = 'Kész.';
    loadAdminPlayerPanel(lastAdminPlayerUsername);
  } catch {
    statusEl.classList.add('error');
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
}

$('#adminSkinDeleteBtn').addEventListener('click', () => adminMediaAction(
  'skin', 'delete', 'Skin törlése',
  `Biztosan törlöd <b>${lastAdminPlayerUsername}</b> jelenlegi skinjét? Ezt utána bármikor feltöltheti újra (akár ugyanazt is).`,
  'Igen, törlöm'
));
$('#adminSkinBanBtn').addEventListener('click', () => adminMediaAction(
  'skin', 'ban', 'Skin végleges tiltása',
  `Biztosan <b>véglegesen letiltod</b> <b>${lastAdminPlayerUsername}</b> jelenlegi skinjét? Ezt a KONKRÉT képet ezután SENKI sem tudja többé feltölteni, se skinként, se köpenyként.`,
  'Igen, letiltom'
));
$('#adminCapeDeleteBtn').addEventListener('click', () => adminMediaAction(
  'cape', 'delete', 'Köpeny törlése',
  `Biztosan törlöd <b>${lastAdminPlayerUsername}</b> jelenlegi köpenyét? Ezt utána bármikor feltöltheti újra (akár ugyanazt is).`,
  'Igen, törlöm'
));
$('#adminCapeBanBtn').addEventListener('click', () => adminMediaAction(
  'cape', 'ban', 'Köpeny végleges tiltása',
  `Biztosan <b>véglegesen letiltod</b> <b>${lastAdminPlayerUsername}</b> jelenlegi köpenyét? Ezt a KONKRÉT képet ezután SENKI sem tudja többé feltölteni, se skinként, se köpenyként.`,
  'Igen, letiltom'
));

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

// ÚJ: tulajdonosi valós pénzes "egyenleg" (wallet) módosítás - ELLENTÉTBEN a
// fenti PP-módosítással, ez KÖZVETLENÜL, szinkron módon történik (nincs
// beváltó-plugin-kör, ld. SolarBackend src/client.js POST
// /api/admin/player/:username/wallet-adjust megjegyzését) - a válasz azonnal
// a friss egyenleget adja vissza, nincs "kb. 1 percen belül" várakozás.
$('#adminWalletAdjustBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminWalletAdjustStatus');
  const amount = parseInt($('#adminWalletAdjustAmountInput').value, 10);
  const reason = $('#adminWalletAdjustReasonInput').value.trim();
  if (!Number.isInteger(amount) || amount === 0) {
    statusEl.textContent = 'Adj meg egy nullától eltérő, egész összeget.';
    statusEl.className = 'redeem-result error';
    return;
  }
  const confirmed = await confirmModal(
    'Egyenleg módosítása',
    `Biztosan ${amount > 0 ? 'jóváírsz' : 'levonsz'} <b>${formatHuf(Math.abs(amount))}</b>-ot <b>${lastAdminPlayerUsername}</b> egyenlegén?`,
    'Igen, végrehajtás'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/wallet-adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ amount, reason: reason || undefined })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült végrehajtani a módosítást.';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = `Sikeres módosítás - új egyenleg: ${formatHuf(data.walletBalanceHuf)}.`;
    statusEl.className = 'redeem-result';
    $('#adminWalletAdjustAmountInput').value = '';
    $('#adminWalletAdjustReasonInput').value = '';
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

// ÚJ: egyedi, játékosonkénti kedvezmény beállítása/törlése (ld.
// SolarBackend src/discounts.js POST/DELETE /api/admin/player/:username/discount) -
// ELLENTÉTBEN a fenti PP-/casino-módosítással, ez KÖZVETLENÜL, szinkron
// módon történik (nincs beváltó-plugin-kör, a "discounts"/"player_discounts"
// tábla a backend SAJÁT, azonnal-friss adata - ld. computeDiscountPercent()).
$('#adminDiscountSetBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminDiscountStatus');
  const percent = parseInt($('#adminDiscountPercentInput').value, 10);
  const reason = $('#adminDiscountReasonInput').value.trim();
  const expiresAt = $('#adminDiscountExpiresInput').value || undefined;
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    statusEl.textContent = 'A kedvezmény 1 és 100% között lehet.';
    statusEl.className = 'redeem-result error';
    return;
  }
  const confirmed = await confirmModal(
    'Kedvezmény beállítása',
    `Biztosan beállítasz <b>${percent}%</b> egyedi kedvezményt <b>${lastAdminPlayerUsername}</b> részére? Ez felülírja a korábbi egyedi kedvezményét, ha volt.`,
    'Igen, beállítás'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ percent, reason: reason || undefined, expiresAt })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült beállítani a kedvezményt.';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = 'Kedvezmény beállítva.';
    statusEl.className = 'redeem-result';
    renderAdminDiscountState(data.discount);
    $('#adminDiscountPercentInput').value = '';
    $('#adminDiscountReasonInput').value = '';
    $('#adminDiscountExpiresInput').value = '';
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

$('#adminDiscountRevokeBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminDiscountStatus');
  const confirmed = await confirmModal(
    'Kedvezmény törlése',
    `Biztosan törlöd <b>${lastAdminPlayerUsername}</b> egyedi kedvezményét?`,
    'Igen, törlés'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/discount', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = 'Nem sikerült törölni (talán már nem is volt egyedi kedvezménye).';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = 'Kedvezmény törölve.';
    statusEl.className = 'redeem-result';
    renderAdminDiscountState(null);
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

$('#adminBadgeGrantBtn').addEventListener('click', async () => {
  if (!lastAdminPlayerUsername) return;
  const statusEl = $('#adminBadgeGrantStatus');
  const badgeId = $('#adminBadgeSelect').value;
  if (!badgeId) {
    statusEl.textContent = 'Nincs kiválasztott jelvény.';
    statusEl.className = 'redeem-result error';
    return;
  }
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ badgeId: Number(badgeId) })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült kiosztani a jelvényt.';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = '';
    renderAdminPlayerBadgesList(data.badges);
    showToast('Jelvény kiosztva.');
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

// Delegált kattintás-figyelő (a jelvény-chipek dinamikusan újragenerálódnak,
// ld. renderAdminPlayerBadgesList) - ugyanaz a minta, mint a news-edit-btn/
// news-delete-btn-nél fentebb.
document.addEventListener('click', (e) => {
  const revokeBtn = e.target.closest('[data-revoke-badge-id]');
  if (!revokeBtn || !lastAdminPlayerUsername) return;
  const badgeId = revokeBtn.dataset.revokeBadgeId;
  fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/badges/' + badgeId, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + session.token }
  }).then((res) => res.json()).then((data) => {
    if (data.ok) {
      renderAdminPlayerBadgesList(data.badges);
      showToast('Jelvény elvéve.');
    } else {
      showToast('Nem sikerült elvenni a jelvényt.', true);
    }
  }).catch(() => showToast('Nem sikerült elérni a szervert.', true));
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
  applyPermVisibility($('[data-view="deviceDetail"]'));
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
//
// JAVÍTVA: a felhasználó kérésére a szankció-csökkentés egyik fajtája sem
// ajándékozható többé - ajándékozni csak PrémiumPontot vagy rangot lehet.
// (Ez egyben egy korábban felfedezett, de sosem javított hibát is
// megszüntet: a beváltó plugin fulfillSanctionReduction()-je sosem vette
// figyelembe a gift_to mezőt, tehát egy "ajándék" csökkentés valójában a
// VÁSÁRLÓ saját szankcióját csökkentette volna - mivel ez az útvonal most
// egyáltalán elérhetetlenné válik, a hiba is okafogyottá válik.)
const GIFTABLE_TYPES = new Set(['sc', 'rank']);

// ÚJ: ha a kártya konkrét tételére aktív akció (globális vagy egyedi,
// játékosonkénti) érvényes, a backend (ld. SolarBackend src/shop.js
// GET /catalog) "discountPercent"/"originalPriceHuf" mezőket is küld - ekkor
// egy "-X%" jelvényt és az áthúzott eredeti ár mellett a kedvezményes árat
// jelenítjük meg, hogy ez a kártyán is látszódjon, ne csak fizetéskor derüljön ki.
function renderPkgCard(item, locked) {
  const lockedNote = locked
    ? `<div class="pkg-locked-note">Nincs aktív szankciód - nincs mit csökkenteni</div>`
    : '';
  const giftBtn = GIFTABLE_TYPES.has(item.type)
    ? `<button type="button" class="btn-outline btn-gift" data-gift-item-id="${item.id}">🎁 Ajándékozás</button>`
    : '';
  const discountBadge = item.discountPercent > 0 ? `<div class="discount-badge">-${item.discountPercent}%</div>` : '';
  const priceHtml = item.discountPercent > 0
    ? `<span class="price-original">${formatHuf(item.originalPriceHuf)}</span>${formatHuf(item.priceHuf)}`
    : formatHuf(item.priceHuf);
  // ÚJ: fizetés a feltöltött egyenlegből (ld. buyItemWithWallet lentebb), a
  // kártyás "Vásárlás" gomb mellett - MINDKÉT gomb mindig látszik (a
  // felhasználó kérésére, popup-os megerősítés nélkül), az egyenlegből-gomb
  // csak akkor aktív, ha van rá elég fedezet (és, szankció-csökkentésnél,
  // ha egyáltalán van mit csökkenteni).
  const walletAffordable = currentWalletBalanceHuf >= item.priceHuf;
  const walletDisabled = locked || !walletAffordable;
  const walletLabel = !locked && !walletAffordable ? 'Nincs elég egyenleged' : 'Fizetés egyenlegből';
  const walletBtn = `<button type="button" class="btn-outline btn-buy-wallet" data-item-id="${item.id}"${walletDisabled ? ' disabled' : ''}>${walletLabel}</button>`;
  return `
    <div class="pkg-card${item.featured ? ' featured' : ''}${locked ? ' pkg-card-locked' : ''}">
      ${discountBadge}
      <div class="pkg-icon">${ICONS[item.icon] || ICONS.coin}</div>
      <div class="pkg-name">${item.short}</div>
      <div class="pkg-price">${priceHtml}</div>
      <button type="button" class="btn-buy" data-item-id="${item.id}"${locked ? ' disabled' : ''}>Vásárlás</button>
      ${walletBtn}
      ${giftBtn}
      ${lockedNote}
    </div>
  `;
}

async function loadShopCatalog() {
  try {
    // ÚJ: ha már be van jelentkezve (session ismert), a tokent is elküldjük -
    // az esetleges EGYEDI, játékosonkénti kedvezmény csak így számítható be
    // (a globális akciók bejelentkezés nélkül is látszanak).
    const res = await fetch(BACKEND_URL + '/api/shop/catalog', session
      ? { headers: { Authorization: 'Bearer ' + session.token } }
      : undefined);
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
  // A "priceCoins" itt MÁR a kedvezménnyel csökkentett ár (ld. GET /ranks) -
  // az "elég PP van-e" ellenőrzés is helyesen a TÉNYLEGESEN fizetendő,
  // kedvezményes árhoz hasonlít.
  const affordable = currentPpBalance >= rank.priceCoins;
  const discountBadge = rank.discountPercent > 0 ? `<div class="discount-badge">-${rank.discountPercent}%</div>` : '';
  const priceInner = rank.discountPercent > 0
    ? `<span class="price-original">${formatPp(rank.originalPriceCoins)}</span>${formatPp(rank.priceCoins)}`
    : formatPp(rank.priceCoins);
  return `
    <div class="rank-card${rank.id === 'solaryn' ? ' featured' : ''}${affordable ? '' : ' insufficient'}">
      ${discountBadge}
      <div class="rank-card-head">
        <div class="pkg-icon">${ICONS.crown}</div>
        <div class="rank-card-name">${rank.label}</div>
      </div>
      <div class="rank-card-duration">${rank.duration}</div>
      <div class="pkg-price rank-price"><img src="assets/pp-coin.png" alt="PP" class="rank-price-icon" /><span>${priceInner}</span></div>
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
    const res = await fetch(BACKEND_URL + '/api/shop/ranks', session
      ? { headers: { Authorization: 'Bearer ' + session.token } }
      : undefined);
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

// ── Egyenleg feltöltése - szabadon megadott Ft-összeg, nincsenek előre
// megadott gyors-összeg gombok (a felhasználó kifejezett kérésére). A
// tényleges jóváírás a Stripe webhookban történik (ld. SolarBackend
// src/shop.js) - itt csak a fizetési munkamenetet indítjuk el, ugyanúgy,
// mint egy katalógus-tétel vásárlásánál (ld. buyItem lentebb). ──
const WALLET_TOPUP_MIN_HUF = 500;
const WALLET_TOPUP_MAX_HUF = 500000;

$('#walletTopupInput').addEventListener('input', () => {
  const amount = parseInt($('#walletTopupInput').value, 10);
  const preview = $('#walletTopupPreview');
  preview.innerHTML = Number.isInteger(amount) && amount > 0
    ? `<b>${formatHuf(amount)}</b> kerül feltöltésre az egyenlegedre.`
    : 'Add meg a feltöltendő összeget.';
});

$('#btnWalletTopup').addEventListener('click', async () => {
  const resultEl = $('#walletTopupResult');
  resultEl.textContent = '';
  resultEl.className = 'redeem-result';

  if (!session || !session.token) {
    showToast('A feltöltéshez jelentkezz be.', true);
    return;
  }
  const amountHuf = parseInt($('#walletTopupInput').value, 10);
  if (!Number.isInteger(amountHuf) || amountHuf < WALLET_TOPUP_MIN_HUF || amountHuf > WALLET_TOPUP_MAX_HUF) {
    resultEl.textContent = `Az összeg ${formatHuf(WALLET_TOPUP_MIN_HUF)} és ${formatHuf(WALLET_TOPUP_MAX_HUF)} között lehet.`;
    resultEl.className = 'redeem-result error';
    return;
  }

  const btn = $('#btnWalletTopup');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Átirányítás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/wallet/topup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ amountHuf, returnUrl: window.location.origin + window.location.pathname })
    });
    const data = await res.json();
    if (!data.ok || !data.url) {
      resultEl.textContent = data.message || 'Nem sikerült elindítani a fizetést.';
      resultEl.className = 'redeem-result error';
      btn.disabled = false;
      btn.textContent = originalText;
      return;
    }
    window.location.href = data.url;
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
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
// JAVÍTVA: a felhasználó kérésére a korábbi sima táblázat helyett kártya-
// rácsos megjelenítés - a kártyák a havi online idő szerint csökkenő
// sorrendben jelennek meg, hogy a legaktívabb staff-tagok legyenek elöl.
const STAFF_STAT_ICON_TICKET = '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a1.5 1.5 0 0 0 0 3v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1.5 1.5 0 0 0 0-3z"/><path d="M9 7v10" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"/></svg>';

// A csapat-szintű összesítő sáv (ld. staff-stats-summary) - a per-staff
// kártyák FÖLÖTT, az összes staff-tag adatait összeadva mutatja, hogy ne
// kelljen fejben összeadni 10+ kártyát a "mennyi ban/mute/ticket volt
// összesen ebben a hónapban" kérdés megválaszolásához. Tisztán a már
// letöltött staff-tömbből számol, nincs hozzá külön backend-végpont.
function renderStaffStatsSummary(staff) {
  const container = $('#staffStatsSummary');
  if (!staff.length) {
    container.innerHTML = '';
    return;
  }
  const totals = staff.reduce((acc, s) => {
    acc.onlineSeconds += Number(s.onlineSeconds) || 0;
    acc.mutesIssued += Number(s.mutesIssued) || 0;
    acc.bansIssued += Number(s.bansIssued) || 0;
    acc.ticketsClosed += Number(s.ticketsClosed) || 0;
    return acc;
  }, { onlineSeconds: 0, mutesIssued: 0, bansIssued: 0, ticketsClosed: 0 });

  const tiles = [
    { icon: STAT_ICONS.time, label: 'Összes online idő', value: formatPlaytime(totals.onlineSeconds) },
    { icon: ICONS.micMute, label: 'Összes kiadott mute', value: totals.mutesIssued.toLocaleString('hu-HU') },
    { icon: ICONS.ban, label: 'Összes kiadott ban', value: totals.bansIssued.toLocaleString('hu-HU') },
    { icon: STAFF_STAT_ICON_TICKET, label: 'Összes lezárt ticket', value: totals.ticketsClosed.toLocaleString('hu-HU') }
  ];

  container.innerHTML = tiles.map((t) => `
    <div class="staff-stat-summary-tile">
      <div class="staff-stat-row-icon">${t.icon}</div>
      <div><div class="staff-stat-row-label">${t.label}</div><div class="staff-stat-summary-value">${t.value}</div></div>
    </div>
  `).join('');
}

async function loadStaffStats() {
  if (!session || !session.token || !isOwner) return;
  const grid = $('#staffStatsGrid');
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
  staff.sort((a, b) => b.onlineSeconds - a.onlineSeconds);

  renderStaffStatsSummary(staff);

  grid.innerHTML = staff.map((s) => `
    <div class="staff-stat-card">
      <div class="staff-stat-card-head">
        <div class="staff-stat-card-name">${escapeHtml(s.username)}</div>
        <div class="staff-stat-card-rank">${escapeHtml(s.rank)}</div>
      </div>
      <div class="staff-stat-rows">
        <div class="staff-stat-row">
          <div class="staff-stat-row-icon">${STAT_ICONS.time}</div>
          <div><div class="staff-stat-row-label">Online idő</div><div class="staff-stat-row-value">${formatPlaytime(s.onlineSeconds)}</div></div>
        </div>
        <div class="staff-stat-row">
          <div class="staff-stat-row-icon">${ICONS.micMute}</div>
          <div><div class="staff-stat-row-label">Kiadott mute</div><div class="staff-stat-row-value">${s.mutesIssued}</div></div>
        </div>
        <div class="staff-stat-row">
          <div class="staff-stat-row-icon">${ICONS.ban}</div>
          <div><div class="staff-stat-row-label">Kiadott ban</div><div class="staff-stat-row-value">${s.bansIssued}</div></div>
        </div>
        <div class="staff-stat-row">
          <div class="staff-stat-row-icon">${STAFF_STAT_ICON_TICKET}</div>
          <div><div class="staff-stat-row-label">Lezárt ticket</div><div class="staff-stat-row-value">${s.ticketsClosed}</div></div>
        </div>
      </div>
    </div>
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
// ÚJ: a kiválasztott (de még fel nem töltött) kép fájl, illetve a "meglévő
// kép eltávolítása" jelző szerkesztéskor - ld. newsSaveBtn handlerét, ahol
// ezekből épül fel a multipart FormData.
let newsSelectedImageFile = null;
let newsRemoveExistingImage = false;

function newsImageUrl(id) {
  return BACKEND_URL + '/api/news/' + id + '/image';
}

function resetNewsForm() {
  newsEditingId = null;
  newsSelectedImageFile = null;
  newsRemoveExistingImage = false;
  $('#newsFormTitle').textContent = 'Új felhívás';
  $('#newsTitleInput').value = '';
  $('#newsContentInput').value = '';
  $('#newsImageInput').value = '';
  $('#newsImagePreviewWrap').hidden = true;
  $('#newsImagePreview').src = '';
  $('#newsSendEmailCheckbox').checked = false;
  // Szerkesztéskor a backend úgyis figyelmen kívül hagyja ezt a mezőt (ld.
  // SolarBackend src/news.js megjegyzését - csak létrehozáskor küldhető ki),
  // ezért új felhívásnál látszik, szerkesztésnél elrejtjük, hogy ne
  // keltsen hamis benyomást.
  $('#newsSendEmailCheckbox').closest('label').hidden = false;
  $('#newsFormResult').textContent = '';
  $('#newsFormResult').className = 'redeem-result';
  $('#newsSaveBtn').textContent = 'Mentés';
}

function renderNewsAdminList() {
  $('#newsAdminList').innerHTML = newsAdminItems.map((n) => `
    <div class="news-admin-item">
      ${n.image_ext ? `<img class="news-admin-item-image" src="${newsImageUrl(n.id)}" alt="" />` : ''}
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

// JAVÍTVA: a felhasználó kérésére a natív "Fájl kiválasztása" gomb (a
// böngésző saját, stílusozatlan megjelenítése) helyett most egy a site
// designjához illő gomb váltja ki a rejtett file-inputot - ugyanaz a minta,
// mint a skin/köpeny feltöltésénél (ld. #skinDrop/#capeDrop kattintás-
// továbbítása app.js-ben), csak itt egy kompakt gombbal, nem egy nagy
// drag&drop dobozzal, mert ez a form szűkebb, egysoros mezőkből áll.
$('#newsImagePickBtn').addEventListener('click', () => $('#newsImageInput').click());

$('#newsImageInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  newsSelectedImageFile = file || null;
  newsRemoveExistingImage = false;
  if (!file) { $('#newsImagePreviewWrap').hidden = true; return; }
  const reader = new FileReader();
  reader.onload = () => {
    $('#newsImagePreview').src = reader.result;
    $('#newsImagePreviewWrap').hidden = false;
  };
  reader.readAsDataURL(file);
});

$('#newsImageRemoveBtn').addEventListener('click', () => {
  newsSelectedImageFile = null;
  newsRemoveExistingImage = true;
  $('#newsImageInput').value = '';
  $('#newsImagePreviewWrap').hidden = true;
  $('#newsImagePreview').src = '';
});

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
    // FormData (multipart), NEM JSON - a kép-csatolmány miatt (ld. SolarBackend
    // src/news.js upload.single('image')). A "Content-Type" fejlécet
    // SZÁNDÉKOSAN nem adjuk meg kézzel - a böngésző maga állítja be, a
    // helyes multipart boundary-vel, ha kézzel írnánk felül, a szerver nem
    // tudná feldolgozni a törzset.
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (newsSelectedImageFile) formData.append('image', newsSelectedImageFile);
    else if (newsEditingId && newsRemoveExistingImage) formData.append('removeImage', 'true');
    // Csak ÚJ felhívásnál küldjük el ezt a mezőt - szerkesztésnél a backend
    // úgyis figyelmen kívül hagyja (ld. news.js megjegyzését), a checkbox is
    // el van rejtve ilyenkor.
    if (!newsEditingId && $('#newsSendEmailCheckbox').checked) formData.append('sendEmail', 'true');
    const res = await fetch(url, {
      method: newsEditingId ? 'PUT' : 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: formData
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    if (newsEditingId) {
      showToast('Felhívás frissítve.');
    } else if (data.emailQueued > 0) {
      showToast(`Felhívás mentve - ${data.emailQueued} feliratkozónak email is kiküldve.`);
    } else {
      showToast('Felhívás mentve - mostantól ez a legfrissebb hír.');
    }
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
    newsSelectedImageFile = null;
    newsRemoveExistingImage = false;
    $('#newsImageInput').value = '';
    $('#newsFormTitle').textContent = 'Felhívás szerkesztése';
    $('#newsTitleInput').value = item.title;
    $('#newsContentInput').value = item.content;
    $('#newsSaveBtn').textContent = 'Frissítés';
    // Szerkesztésnél a backend úgyis figyelmen kívül hagyja a "sendEmail"
    // mezőt (ld. resetNewsForm megjegyzését) - elrejtjük, ne tűnjön úgy,
    // mintha egy elgépelés-javítás újra kiküldené a hírlevelet.
    $('#newsSendEmailCheckbox').checked = false;
    $('#newsSendEmailCheckbox').closest('label').hidden = true;
    $('#newsFormResult').textContent = '';
    if (item.image_ext) {
      $('#newsImagePreview').src = newsImageUrl(item.id);
      $('#newsImagePreviewWrap').hidden = false;
    } else {
      $('#newsImagePreview').src = '';
      $('#newsImagePreviewWrap').hidden = true;
    }
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

// ── Jelvények (admin, ld. SolarBackend src/badges.js) - ugyanaz a minta,
// mint a fenti "Felhívások" (news) CRUD, csak név+szín+ikon mezőkkel a
// szöveges cím+tartalom helyett. ──
let badgeEditingId = null;
let badgesAdminItems = [];
let badgeSelectedIconFile = null;
let badgeRemoveExistingIcon = false;
// ÚJ: az ÖSSZES jelvény gyorsítótárazott listája - a fenti admin CRUD
// (badgesAdminItems) TÖLTI FEL (ld. loadBadgesAdmin), a játékos-profil
// admin paneljének jelvény-választója (ld. loadAdminPlayerPanel) pedig
// EBBŐL olvas, hogy ne kelljen külön lekérdezést indítania minden egyes
// játékos-profil megnyitásakor.
let allBadgesCache = [];

function badgeIconUrl(id) {
  return BACKEND_URL + '/api/badges/' + id + '/icon';
}

function resetBadgeForm() {
  badgeEditingId = null;
  badgeSelectedIconFile = null;
  badgeRemoveExistingIcon = false;
  $('#badgeFormTitle').textContent = 'Új jelvény';
  $('#badgeNameInput').value = '';
  $('#badgeColorInput').value = '#ffc42e';
  $('#badgeIconInput').value = '';
  $('#badgeIconPreviewWrap').hidden = true;
  $('#badgeIconPreview').src = '';
  $('#badgeFormResult').textContent = '';
  $('#badgeFormResult').className = 'redeem-result';
  $('#badgeSaveBtn').textContent = 'Mentés';
}

function renderBadgesAdminList() {
  $('#badgesAdminList').innerHTML = badgesAdminItems.map((b) => `
    <div class="badges-admin-item">
      ${b.icon_ext ? `<img class="badges-admin-item-icon" src="${badgeIconUrl(b.id)}" alt="" />` : '<div class="badges-admin-item-icon"></div>'}
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name" style="color:${escapeHtml(b.color)}">${escapeHtml(b.name)}</div>
        <div class="badges-admin-item-meta">${formatLedgerDate(b.created_at)}</div>
      </div>
      <div class="badges-admin-item-actions">
        <button type="button" class="news-edit-btn" data-badge-id="${b.id}">Szerkesztés</button>
        <button type="button" class="news-delete-btn" data-badge-id="${b.id}">Törlés</button>
      </div>
    </div>
  `).join('') || '<p class="redeem-result">Még nincs egyetlen jelvény sem.</p>';
}

// JAVÍTVA: ugyanaz a stílusozott-gombos kiváltás, mint a felhívások
// kép-feltöltésénél (ld. #newsImagePickBtn fenti megjegyzését).
$('#badgeIconPickBtn').addEventListener('click', () => $('#badgeIconInput').click());

$('#badgeIconInput').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  badgeSelectedIconFile = file || null;
  badgeRemoveExistingIcon = false;
  if (!file) { $('#badgeIconPreviewWrap').hidden = true; return; }
  const reader = new FileReader();
  reader.onload = () => {
    $('#badgeIconPreview').src = reader.result;
    $('#badgeIconPreviewWrap').hidden = false;
  };
  reader.readAsDataURL(file);
});

$('#badgeIconRemoveBtn').addEventListener('click', () => {
  badgeSelectedIconFile = null;
  badgeRemoveExistingIcon = true;
  $('#badgeIconInput').value = '';
  $('#badgeIconPreviewWrap').hidden = true;
  $('#badgeIconPreview').src = '';
});

async function loadBadgesAdmin() {
  if (!session || !session.token || !isOwner) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/badges', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    badgesAdminItems = data.ok && Array.isArray(data.badges) ? data.badges : [];
  } catch {
    badgesAdminItems = [];
  }
  renderBadgesAdminList();
  // ÚJ: a játékos-profil admin paneljén lévő jelvény-választó (ld.
  // loadAdminPlayerPanel) ugyanezt a listát használja - itt is frissítjük,
  // hogy egy most létrehozott/törölt jelvény azonnal megjelenjen ott is,
  // anélkül hogy külön kellene újratölteni.
  allBadgesCache = badgesAdminItems;
}

$('#badgeDiscardBtn').addEventListener('click', resetBadgeForm);

$('#badgeSaveBtn').addEventListener('click', async () => {
  const resultEl = $('#badgeFormResult');
  const name = $('#badgeNameInput').value.trim();
  const color = $('#badgeColorInput').value;
  if (!name) {
    resultEl.textContent = 'Adj meg egy nevet.';
    resultEl.className = 'redeem-result error';
    return;
  }
  try {
    const url = badgeEditingId ? BACKEND_URL + '/api/admin/badges/' + badgeEditingId : BACKEND_URL + '/api/admin/badges';
    // FormData (multipart), NEM JSON - az ikon-csatolmány miatt, ld. news.js
    // hasonló megjegyzését ugyanerről.
    const formData = new FormData();
    formData.append('name', name);
    formData.append('color', color);
    if (badgeSelectedIconFile) formData.append('icon', badgeSelectedIconFile);
    const res = await fetch(url, {
      method: badgeEditingId ? 'PUT' : 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: formData
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast(badgeEditingId ? 'Jelvény frissítve.' : 'Jelvény létrehozva.');
    resetBadgeForm();
    loadBadgesAdmin();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.news-edit-btn[data-badge-id]');
  if (editBtn) {
    const item = badgesAdminItems.find((b) => String(b.id) === editBtn.dataset.badgeId);
    if (!item) return;
    badgeEditingId = item.id;
    badgeSelectedIconFile = null;
    badgeRemoveExistingIcon = false;
    $('#badgeIconInput').value = '';
    $('#badgeFormTitle').textContent = 'Jelvény szerkesztése';
    $('#badgeNameInput').value = item.name;
    $('#badgeColorInput').value = item.color;
    $('#badgeSaveBtn').textContent = 'Frissítés';
    $('#badgeFormResult').textContent = '';
    if (item.icon_ext) {
      $('#badgeIconPreview').src = badgeIconUrl(item.id);
      $('#badgeIconPreviewWrap').hidden = false;
    } else {
      $('#badgeIconPreview').src = '';
      $('#badgeIconPreviewWrap').hidden = true;
    }
    return;
  }
  const deleteBtn = e.target.closest('.news-delete-btn[data-badge-id]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.badgeId;
    confirmModal('Jelvény törlése', 'Biztosan törlöd ezt a jelvényt? Minden játékostól levonja, akinek meg lett adva. Ez nem vonható vissza.', 'Igen, törlés').then((confirmed) => {
      if (!confirmed) return;
      fetch(BACKEND_URL + '/api/admin/badges/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      }).then((res) => res.json()).then((data) => {
        if (data.ok) {
          showToast('Jelvény törölve.');
          if (String(badgeEditingId) === String(id)) resetBadgeForm();
          loadBadgesAdmin();
        } else {
          showToast('Nem sikerült törölni.', true);
        }
      }).catch(() => showToast('Nem sikerült elérni a szervert.', true));
    });
  }
});

// ── Akciók (admin, ld. SolarBackend src/discounts.js) - ugyanaz a CRUD-
// minta, mint a fenti Jelvények, csak a "Kedvezmény" mezőkkel (érvényességi
// kör + opcionális egy-csomagos szűkítés + aktív/lejárat) a szín+ikon
// helyett - nincs fájlfeltöltés, ezért egyszerű JSON POST/PUT, nem FormData. ──
let discountEditingId = null;
let discountsAdminItems = [];

function resetDiscountForm() {
  discountEditingId = null;
  $('#discountFormTitle').textContent = 'Új akció';
  $('#discountNameInput').value = '';
  $('#discountPercentInput').value = '';
  $('#discountScopeSelect').value = 'all';
  $('#discountScopeItemWrap').hidden = true;
  $('#discountExpiresInput').value = '';
  $('#discountActiveCheckbox').checked = true;
  $('#discountFormResult').textContent = '';
  $('#discountFormResult').className = 'redeem-result';
  $('#discountSaveBtn').textContent = 'Mentés';
  populateDiscountScopeItemSelect();
}

// A "shopCatalog"/"shopRanks" globális tömböket használja (ld. loadShopCatalog/
// loadRanks fentebb - mindkettő MÁR betöltődik oldalbetöltéskor, nincs szükség
// külön lekérdezésre) - a legördülő értéke MINDIG a CATALOG-/RANKS-kulcs (pl.
// "sc_1300"/"helios"), ugyanaz, amit a backend "scope_item_id"-ként vár.
function populateDiscountScopeItemSelect(selectedId) {
  const sel = $('#discountScopeItemSelect');
  const catalogOptions = shopCatalog.map((i) => `<option value="${i.id}">${escapeHtml(i.short || i.label)} (${formatHuf(i.priceHuf)})</option>`).join('');
  const rankOptions = shopRanks.map((r) => `<option value="${r.id}">${escapeHtml(r.label)} (${formatPp(r.priceCoins)})</option>`).join('');
  sel.innerHTML = `<optgroup label="Csomagok">${catalogOptions}</optgroup><optgroup label="Rangok">${rankOptions}</optgroup>`;
  if (selectedId) sel.value = selectedId;
}

$('#discountScopeSelect').addEventListener('change', () => {
  $('#discountScopeItemWrap').hidden = $('#discountScopeSelect').value !== 'item';
});

function discountScopeLabel(d) {
  if (d.scope === 'all') return 'Minden csomag';
  if (d.scope === 'pp') return 'PrémiumPont csomagok';
  if (d.scope === 'rank') return 'Rangok';
  // "item" - a katalógusban/rangoknál megkeressük a megjeleníthető nevet,
  // ha az akció létrehozása óta törölték a tételt a CATALOG-ból/RANKS-ból,
  // egyszerűen a nyers azonosítót mutatjuk (nem hibázik el).
  const catalogItem = shopCatalog.find((i) => i.id === d.scope_item_id);
  if (catalogItem) return `Csomag: ${catalogItem.short || catalogItem.label}`;
  const rank = shopRanks.find((r) => r.id === d.scope_item_id);
  if (rank) return `Rang: ${rank.label}`;
  return `Csomag: ${d.scope_item_id}`;
}

function renderDiscountsAdminList() {
  $('#discountsAdminList').innerHTML = discountsAdminItems.map((d) => {
    const expired = d.expires_at && new Date(d.expires_at).getTime() <= Date.now();
    const statusText = !d.active ? 'Kikapcsolva' : expired ? 'Lejárt' : 'Aktív';
    const statusClass = !d.active ? 'discount-status-off' : expired ? 'discount-status-off' : 'discount-status-on';
    return `
    <div class="badges-admin-item">
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">${escapeHtml(d.name)} - ${d.percent}%</div>
        <div class="badges-admin-item-meta">${discountScopeLabel(d)}${d.expires_at ? ' - lejár: ' + formatLedgerDate(d.expires_at) : ''} - <span class="${statusClass}">${statusText}</span></div>
      </div>
      <div class="badges-admin-item-actions">
        <button type="button" class="news-edit-btn" data-discount-id="${d.id}">Szerkesztés</button>
        <button type="button" class="news-delete-btn" data-discount-id="${d.id}">Törlés</button>
      </div>
    </div>
  `;
  }).join('') || '<p class="redeem-result">Még nincs egyetlen akció sem.</p>';
}

async function loadDiscountsAdmin() {
  if (!session || !session.token || !isOwner) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/discounts', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    discountsAdminItems = data.ok && Array.isArray(data.discounts) ? data.discounts : [];
  } catch {
    discountsAdminItems = [];
  }
  renderDiscountsAdminList();
}

$('#discountDiscardBtn').addEventListener('click', resetDiscountForm);

$('#discountSaveBtn').addEventListener('click', async () => {
  const resultEl = $('#discountFormResult');
  const name = $('#discountNameInput').value.trim();
  const percent = Number($('#discountPercentInput').value);
  const scope = $('#discountScopeSelect').value;
  const scopeItemId = scope === 'item' ? $('#discountScopeItemSelect').value : undefined;
  const active = $('#discountActiveCheckbox').checked;
  const expiresAt = $('#discountExpiresInput').value || undefined;

  if (!name) { resultEl.textContent = 'Adj meg egy nevet.'; resultEl.className = 'redeem-result error'; return; }
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
    resultEl.textContent = 'A kedvezmény 1 és 100% között lehet.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (scope === 'item' && !scopeItemId) {
    resultEl.textContent = 'Válassz egy konkrét csomagot.';
    resultEl.className = 'redeem-result error';
    return;
  }

  try {
    const url = discountEditingId ? BACKEND_URL + '/api/admin/discounts/' + discountEditingId : BACKEND_URL + '/api/admin/discounts';
    const res = await fetch(url, {
      method: discountEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ name, percent, scope, scopeItemId, active, expiresAt })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast(discountEditingId ? 'Akció frissítve.' : 'Akció létrehozva.');
    resetDiscountForm();
    loadDiscountsAdmin();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.news-edit-btn[data-discount-id]');
  if (editBtn) {
    const item = discountsAdminItems.find((d) => String(d.id) === editBtn.dataset.discountId);
    if (!item) return;
    discountEditingId = item.id;
    $('#discountFormTitle').textContent = 'Akció szerkesztése';
    $('#discountNameInput').value = item.name;
    $('#discountPercentInput').value = item.percent;
    $('#discountScopeSelect').value = item.scope;
    $('#discountScopeItemWrap').hidden = item.scope !== 'item';
    populateDiscountScopeItemSelect(item.scope_item_id);
    // ÚJ: a dátum-input "ÉÉÉÉ-HH-NN" alakot vár - a backend teljes ISO
    // dátumidőt ad vissza (ld. discounts.js normalizálását a nap VÉGÉRE),
    // ebből csak a dátumrészt vágjuk ki.
    $('#discountExpiresInput').value = item.expires_at ? item.expires_at.slice(0, 10) : '';
    $('#discountActiveCheckbox').checked = item.active === 1;
    $('#discountSaveBtn').textContent = 'Frissítés';
    $('#discountFormResult').textContent = '';
    return;
  }
  const deleteBtn = e.target.closest('.news-delete-btn[data-discount-id]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.discountId;
    confirmModal('Akció törlése', 'Biztosan törlöd ezt az akciót? Ez nem vonható vissza.', 'Igen, törlés').then((confirmed) => {
      if (!confirmed) return;
      fetch(BACKEND_URL + '/api/admin/discounts/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      }).then((res) => res.json()).then((data) => {
        if (data.ok) {
          showToast('Akció törölve.');
          if (String(discountEditingId) === String(id)) resetDiscountForm();
          loadDiscountsAdmin();
        } else {
          showToast('Nem sikerült törölni.', true);
        }
      }).catch(() => showToast('Nem sikerült elérni a szervert.', true));
    });
  }
});

// ── Kuponok (admin, ld. SolarBackend src/coupons.js) - ugyanaz a CRUD-minta,
// mint a fenti Akciók, csak a "Jutalom" mezőkkel (típus + mennyiség +
// felhasználhatóság + kezdet/lejárat) az érvényességi kör helyett - nincs
// fájlfeltöltés, ezért egyszerű JSON POST/PUT, nem FormData. ──
let couponEditingId = null;
let couponsAdminItems = [];

function resetCouponForm() {
  couponEditingId = null;
  $('#couponFormTitle').textContent = 'Új kupon';
  $('#couponCodeInput').value = '';
  $('#couponRewardTypeSelect').value = 'pp';
  $('#couponRewardAmountInput').value = '';
  $('#couponMaxUsesInput').value = '';
  $('#couponStartsInput').value = '';
  $('#couponExpiresInput').value = '';
  $('#couponActiveCheckbox').checked = true;
  $('#couponFormResult').textContent = '';
  $('#couponFormResult').className = 'redeem-result';
  $('#couponSaveBtn').textContent = 'Mentés';
  populateCouponRequiredRankSelect();
}

// A "shopRanks" globális tömböt használja (ld. loadRanks fentebb - MÁR
// betöltődik oldalbetöltéskor) - ugyanaz a minta, mint
// populateDiscountScopeItemSelect() a fenti Akciók admin formnál.
function populateCouponRequiredRankSelect(selectedId) {
  const sel = $('#couponRequiredRankSelect');
  const rankOptions = shopRanks.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join('');
  sel.innerHTML = `<option value="">— Bárki beválthatja —</option>${rankOptions}`;
  sel.value = selectedId || '';
}

function couponRewardLabel(c) {
  return c.reward_type === 'wallet' ? `${formatHuf(c.reward_amount)} egyenleg` : `${formatPp(c.reward_amount)} PP`;
}

// A required_rank a users.rank_name-mel egyezik (LuckPerms-csoportnév) -
// ha a shopRanks katalógusban megtalálható, a szebb címkéjét mutatjuk,
// egyébként a nyers rangnevet (pl. egy staff-rang, ami nem vásárolható,
// de attól még beállítható szükséges rangnak).
function couponRequiredRankLabel(requiredRank) {
  const rank = shopRanks.find((r) => r.id === requiredRank);
  return rank ? rank.label : requiredRank;
}

function renderCouponsAdminList() {
  $('#couponsAdminList').innerHTML = couponsAdminItems.map((c) => {
    const notStarted = c.starts_at && new Date(c.starts_at).getTime() > Date.now();
    const expired = c.expires_at && new Date(c.expires_at).getTime() <= Date.now();
    const exhausted = c.max_uses !== null && c.used_count >= c.max_uses;
    const statusText = !c.active ? 'Kikapcsolva' : exhausted ? 'Elfogyott' : expired ? 'Lejárt' : notStarted ? 'Még nem aktív' : 'Aktív';
    const statusClass = c.active && !exhausted && !expired && !notStarted ? 'discount-status-on' : 'discount-status-off';
    const usesText = c.max_uses !== null ? `${c.used_count}/${c.max_uses} felhasználva` : `${c.used_count}x felhasználva (korlátlan)`;
    const windowParts = [];
    if (c.starts_at) windowParts.push('kezdet: ' + formatLedgerDate(c.starts_at));
    if (c.expires_at) windowParts.push('lejár: ' + formatLedgerDate(c.expires_at));
    if (c.required_rank) windowParts.push('csak: ' + couponRequiredRankLabel(c.required_rank));
    return `
    <div class="badges-admin-item">
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">${escapeHtml(c.code)} - ${couponRewardLabel(c)}</div>
        <div class="badges-admin-item-meta">${usesText}${windowParts.length ? ' - ' + windowParts.join(', ') : ''} - <span class="${statusClass}">${statusText}</span></div>
      </div>
      <div class="badges-admin-item-actions">
        <button type="button" class="news-edit-btn" data-coupon-id="${c.id}">Szerkesztés</button>
        <button type="button" class="news-delete-btn" data-coupon-id="${c.id}">Törlés</button>
      </div>
    </div>
  `;
  }).join('') || '<p class="redeem-result">Még nincs egyetlen kupon sem.</p>';
}

async function loadCouponsAdmin() {
  if (!session || !session.token || !isOwner) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/coupons', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    couponsAdminItems = data.ok && Array.isArray(data.coupons) ? data.coupons : [];
  } catch {
    couponsAdminItems = [];
  }
  renderCouponsAdminList();
}

$('#couponDiscardBtn').addEventListener('click', resetCouponForm);

$('#couponSaveBtn').addEventListener('click', async () => {
  const resultEl = $('#couponFormResult');
  const code = $('#couponCodeInput').value.trim();
  const rewardType = $('#couponRewardTypeSelect').value;
  const rewardAmount = Number($('#couponRewardAmountInput').value);
  const maxUsesRaw = $('#couponMaxUsesInput').value;
  const maxUses = maxUsesRaw ? Number(maxUsesRaw) : undefined;
  const requiredRank = $('#couponRequiredRankSelect').value || undefined;
  const startsAt = $('#couponStartsInput').value || undefined;
  const expiresAt = $('#couponExpiresInput').value || undefined;
  const active = $('#couponActiveCheckbox').checked;

  if (!code) { resultEl.textContent = 'Adj meg egy kódot.'; resultEl.className = 'redeem-result error'; return; }
  if (!Number.isInteger(rewardAmount) || rewardAmount < 1) {
    resultEl.textContent = 'Adj meg egy érvényes jutalom-mennyiséget.';
    resultEl.className = 'redeem-result error';
    return;
  }

  try {
    const url = couponEditingId ? BACKEND_URL + '/api/admin/coupons/' + couponEditingId : BACKEND_URL + '/api/admin/coupons';
    const res = await fetch(url, {
      method: couponEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ code, rewardType, rewardAmount, maxUses, requiredRank, startsAt, expiresAt, active })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast(couponEditingId ? 'Kupon frissítve.' : 'Kupon létrehozva.');
    resetCouponForm();
    loadCouponsAdmin();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.news-edit-btn[data-coupon-id]');
  if (editBtn) {
    const item = couponsAdminItems.find((c) => String(c.id) === editBtn.dataset.couponId);
    if (!item) return;
    couponEditingId = item.id;
    $('#couponFormTitle').textContent = 'Kupon szerkesztése';
    $('#couponCodeInput').value = item.code;
    $('#couponRewardTypeSelect').value = item.reward_type;
    $('#couponRewardAmountInput').value = item.reward_amount;
    $('#couponMaxUsesInput').value = item.max_uses !== null ? item.max_uses : '';
    populateCouponRequiredRankSelect(item.required_rank);
    // ÚJ: a dátum-input "ÉÉÉÉ-HH-NN" alakot vár - a backend teljes ISO
    // dátumidőt ad vissza (ld. coupons.js normalizálását), ebből csak a
    // dátumrészt vágjuk ki.
    $('#couponStartsInput').value = item.starts_at ? item.starts_at.slice(0, 10) : '';
    $('#couponExpiresInput').value = item.expires_at ? item.expires_at.slice(0, 10) : '';
    $('#couponActiveCheckbox').checked = item.active === 1;
    $('#couponSaveBtn').textContent = 'Frissítés';
    $('#couponFormResult').textContent = '';
    return;
  }
  const deleteBtn = e.target.closest('.news-delete-btn[data-coupon-id]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.couponId;
    confirmModal('Kupon törlése', 'Biztosan törlöd ezt a kupont? Ez nem vonható vissza.', 'Igen, törlés').then((confirmed) => {
      if (!confirmed) return;
      fetch(BACKEND_URL + '/api/admin/coupons/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      }).then((res) => res.json()).then((data) => {
        if (data.ok) {
          showToast('Kupon törölve.');
          if (String(couponEditingId) === String(id)) resetCouponForm();
          loadCouponsAdmin();
        } else {
          showToast('Nem sikerült törölni.', true);
        }
      }).catch(() => showToast('Nem sikerült elérni a szervert.', true));
    });
  }
});

// ── Jogok (admin) - admin-jogosultságok, ld. SolarBackend src/permissions.js.
// Kizárólag a valódi tulajdonos éri el (ld. index.html #navPermissionsBtn -
// nincs data-permission attribútuma), mert a jog-adás maga nem delegálható.
// KÉT fül: "Játékos szerint" (egy konkrét felhasználónak) és "Rang szerint"
// (egy egész rangnak, ld. users.rank_name) - a két forrás a backenden
// EGYMÁSTÓL FÜGGETLENÜL tárolódik és összeadódik (ld. permissions.js
// getEffectivePermissionKeys()), itt is külön-külön szerkeszthetők. ──
let permCatalogCache = null;
let permRankListCache = null;
let permsMode = 'player'; // 'player' | 'rank'
let permsEditorTarget = null; // username (player módban) vagy rank_name (rang módban)

// A katalógus (kulcs+címke+kategória) ritkán változik, kliens-oldalon
// egyszer betöltve gyorsítótárazzuk - minden váltásnál újra lekérdezni
// felesleges kör lenne.
async function loadPermCatalog() {
  if (permCatalogCache) return permCatalogCache;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/permissions/catalog', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    permCatalogCache = data.ok && Array.isArray(data.catalog) ? data.catalog : [];
  } catch {
    permCatalogCache = [];
  }
  return permCatalogCache;
}

function setPermsMode(mode) {
  permsMode = mode;
  permsEditorTarget = null;
  $('#permsModePlayerBtn').classList.toggle('active', mode === 'player');
  $('#permsModeRankBtn').classList.toggle('active', mode === 'rank');
  $('#permsPlayerSearchPanel').classList.toggle('hidden', mode !== 'player');
  $('#permsResult').classList.toggle('hidden', mode !== 'player');
  $('#permsRankSelectPanel').classList.toggle('hidden', mode !== 'rank');
  $('#permsEditorCard').classList.add('hidden');
  if (mode === 'rank') loadRankSelect();
}
$('#permsModePlayerBtn').addEventListener('click', () => setPermsMode('player'));
$('#permsModeRankBtn').addEventListener('click', () => setPermsMode('rank'));

// A ténylegesen élő rangnevek listája (ld. GET /api/admin/permissions/ranks) -
// egyszer betöltve gyorsítótárazzuk, ugyanúgy, mint a katalógust.
async function loadRankSelect() {
  const select = $('#permsRankSelect');
  select.innerHTML = '<option>Betöltés...</option>';
  $('#permsRankNote').textContent = '';
  if (!permRankListCache) {
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/permissions/ranks', {
        headers: { Authorization: 'Bearer ' + session.token }
      });
      const data = await res.json();
      permRankListCache = data.ok && Array.isArray(data.ranks) ? data.ranks : [];
    } catch {
      permRankListCache = [];
    }
  }
  if (!permRankListCache.length) {
    select.innerHTML = '<option value="">Nincs elérhető rang</option>';
    $('#permsRankNote').textContent = 'Jelenleg nincs a tulajdonoson kívüli rangja egyetlen szinkronizált játékosnak sem.';
    return;
  }
  select.innerHTML = permRankListCache.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
  loadPermsEditor(select.value);
}
$('#permsRankSelect').addEventListener('change', () => loadPermsEditor($('#permsRankSelect').value));

async function doPermsSearch() {
  const name = $('#permsPlayerSearchInput').value.trim();
  const resultEl = $('#permsResult');
  if (!name) { resultEl.innerHTML = ''; return; }
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
  $$('#permsResult .player-card').forEach((card, i) => {
    const player = data.players[i];
    drawFaceForPlayer(card.querySelector('canvas'), player);
    card.addEventListener('click', () => loadPermsEditor(player.username));
  });
}
$('#permsPlayerSearchBtn').addEventListener('click', doPermsSearch);
$('#permsPlayerSearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') doPermsSearch(); });

// A jelenlegi permsMode dönti el, melyik végpontot kérdezzük/írjuk - a
// checkbox-lista renderelése és a mentés-logika egyébként azonos.
function permsTargetUrl(target) {
  return permsMode === 'rank'
    ? '/api/admin/permissions/rank/' + encodeURIComponent(target)
    : '/api/admin/permissions/' + encodeURIComponent(target);
}

async function loadPermsEditor(target) {
  if (!target) return;
  permsEditorTarget = target;
  $('#permsEditorCard').classList.remove('hidden');
  $('#permsEditorTypeLabel').textContent = permsMode === 'rank' ? 'Rang' : 'Játékos';
  $('#permsEditorUsername').textContent = target;
  $('#permsSaveResult').textContent = '';
  const container = $('#permsCategoriesContainer');
  container.innerHTML = '<p class="player-result-note">Betöltés...</p>';

  const [catalog, granted] = await Promise.all([
    loadPermCatalog(),
    (async () => {
      try {
        const res = await fetch(BACKEND_URL + permsTargetUrl(target), {
          headers: { Authorization: 'Bearer ' + session.token }
        });
        const data = await res.json();
        return data.ok && Array.isArray(data.permissions) ? data.permissions : [];
      } catch {
        return [];
      }
    })()
  ]);

  const grantedSet = new Set(granted);
  const categories = [...new Set(catalog.map((p) => p.category))];
  container.innerHTML = categories.map((cat) => `
    <div class="admin-subsection-title">${escapeHtml(cat)}</div>
    <div class="perms-checkbox-grid">
      ${catalog.filter((p) => p.category === cat).map((p) => `
        <label class="check-row">
          <input type="checkbox" data-perm-key="${p.key}" ${grantedSet.has(p.key) ? 'checked' : ''} />
          <span>${escapeHtml(p.label)}</span>
        </label>
      `).join('')}
    </div>
  `).join('') || '<p class="player-result-note">Nincs elérhető jogosultság.</p>';
}

$('#permsSaveBtn').addEventListener('click', async () => {
  if (!permsEditorTarget) return;
  const resultEl = $('#permsSaveResult');
  const keys = $$('#permsCategoriesContainer [data-perm-key]:checked').map((el) => el.dataset.permKey);
  resultEl.textContent = 'Mentés...';
  resultEl.className = 'redeem-result';
  try {
    const res = await fetch(BACKEND_URL + permsTargetUrl(permsEditorTarget), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ permissions: keys })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    resultEl.textContent = '';
    showToast(permsMode === 'rank' ? 'Rang jogosultságai mentve.' : 'Jogosultságok mentve.');
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

// ÚJ: mindenhol, ahol egy felhasználó neve megjelenik, a megkapott
// jelvényei is odakerülnek melléje (ld. index.html #profileNameBadges/
// #playerProfileNameBadges) - a jelvény neve MINDIG látszik az ikon mellett
// (nem csak rávitelkor/hoverre, ahogy korábban egy tooltip csinálta), a
// jelvény saját névszínével.
function renderNameBadges(container, badgeList) {
  if (!container) return;
  if (!Array.isArray(badgeList) || !badgeList.length) { container.innerHTML = ''; return; }
  container.innerHTML = badgeList.map((b) => `
    <span class="name-badge">
      <img class="name-badge-icon" src="${badgeIconUrl(b.id)}" alt="" />
      <span class="name-badge-label" style="color:${escapeHtml(b.color)}">${escapeHtml(b.name)}</span>
    </span>
  `).join('');
}

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
    const imageEl = $('#homeNewsImage');
    if (news.image_ext) {
      imageEl.src = newsImageUrl(news.id);
      imageEl.classList.remove('hidden');
    } else {
      imageEl.classList.add('hidden');
      imageEl.src = '';
    }
    $('#homeNewsTitle').textContent = news.title;
    $('#homeNewsMeta').textContent = formatLedgerDate(news.created_at);
    $('#homeNewsContent').textContent = news.content;
    card.classList.remove('hidden');
  } catch {
    // Csendben kihagyjuk - a kártya rejtve marad, a következő belépéskor újra próbálkozunk.
  }
}

// A főoldal "Barátok" kártyája - a bejelentkezett felhasználó ELFOGADOTT
// barátait listázza (ld. SolarBackend GET /api/friends/:username), zölden az
// éppen elérhetőket (proxy-oldali élő állapot, ld. SolarBungee
// FriendCommand.handleList megjegyzését, itt viszont a backend heartbeat-
// alapú "online" mezőjéből jön, mert a weboldalnak nincs élő kapcsolata a
// proxyval). A barátkérelmek kezelése (küldés/elfogadás/eltávolítás)
// SZÁNDÉKOSAN csak in-game (/fr add|accept|remove) lehetséges, itt csak a
// már meglévő barátság jelenik meg. Egy kártyára kattintva ugyanaz a
// profil-nézet nyílik meg, mint a Játékosok fülön (ld. openPlayerProfile).
async function loadHomeFriends() {
  if (!session || !session.username) return;
  const grid = $('#homeFriendsGrid');
  const emptyNote = $('#homeFriendsEmpty');
  try {
    const res = await fetch(BACKEND_URL + '/api/friends/' + encodeURIComponent(session.username));
    const data = await res.json();
    const friendsList = data.ok ? data.friends : [];
    if (!friendsList.length) {
      grid.innerHTML = '';
      emptyNote.classList.remove('hidden');
      return;
    }
    emptyNote.classList.add('hidden');
    grid.innerHTML = friendsList.map((f, i) => `
      <div class="player-card" data-username="${f.username}">
        <canvas class="player-card-canvas" data-idx="${i}" width="40" height="40"></canvas>
        <div class="player-card-info">
          <div class="player-card-label">Név</div>
          <div class="player-card-name friend-card-name ${f.online ? 'online' : ''}">${f.username}</div>
        </div>
      </div>
    `).join('');
    $$('#homeFriendsGrid .player-card').forEach((card, i) => {
      const friend = friendsList[i];
      const canvas = card.querySelector('canvas');
      drawFaceForPlayer(canvas, { username: friend.username, hasSkin: true });
      card.addEventListener('click', () => openPlayerProfile(friend.username));
    });
  } catch {
    // Csendben kihagyjuk - a kártya üresen marad, a következő belépéskor újra próbálkozunk.
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

// ÚJ: fizetés a feltöltött egyenlegből (ld. renderPkgCard fenti
// walletBtn-jét) - ELLENTÉTBEN buyItem()-mel, ez NEM irányít át Stripe-ra,
// szinkron, azonnali választ ad (ld. SolarBackend src/shop.js
// POST /checkout-with-wallet).
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy-wallet[data-item-id]');
  if (btn && !btn.disabled) buyItemWithWallet(btn.dataset.itemId, btn);
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

async function buyItemWithWallet(itemId, buttonEl) {
  if (!session || !session.token) {
    showToast('A vásárláshoz jelentkezz be.', true);
    return;
  }
  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Vásárlás...';
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/checkout-with-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ itemId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.message || 'Nem sikerült elindítani a vásárlást.', true);
      buttonEl.disabled = false;
      buttonEl.textContent = originalText;
      return;
    }
    currentWalletBalanceHuf = typeof data.walletBalanceHuf === 'number' ? data.walletBalanceHuf : currentWalletBalanceHuf;
    renderWalletBadge();
    // Újratöltjük a teljes katalógust, hogy a MARADÉK kártyák "Fizetés
    // egyenlegből" gombjainak fedezet-állapota is naprakész legyen (ld.
    // renderPkgCard walletAffordable-je) - ugyanaz az elv, mint
    // refreshPpBalance() a Rangoknál.
    loadShopCatalog();
    showPurchaseSuccessModal();
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
      renderDiscordLinkBadge($('#profileDiscordLink'), { discordUsername: result.discordUsername, discordAvatar: result.discordAvatar }, { mode: 'self' });
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
