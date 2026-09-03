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
// A kiadás azonosítója. Az oldalsáv alján jelenik meg - ha ott régi
// számot látsz, a böngésző MÉG A RÉGI app.js-t futtatja (a webtárhely
// cache-e miatt egy feltöltés nem feltétlenül ér ki azonnal). MINDEN
// kiadásnál emelni kell, az index.html ?v= paramétereivel EGYÜTT.
const CENTER_VERSION = '20260903a';

const BACKEND_URL = 'https://api.overclockgame.hu:8908';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// ── Jelszó megjelenítése (szem-ikon) minden jelszómezőn - ld. ugyanez a
// mintázat a SolarLauncher renderer.js-ében (initPasswordToggles). ──
const PW_EYE_SVG = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const PW_EYE_OFF_SVG = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.4 5.3A10.8 10.8 0 0 1 12 5c7 0 10.5 7 10.5 7a13.4 13.4 0 0 1-3.15 4.05M6.5 6.5C3.6 8.3 1.5 12 1.5 12s2.2 4.4 6.1 6.2"/></svg>';
function initPasswordToggles(root) {
  (root || document).querySelectorAll('input[type="password"]').forEach((input) => {
    if (input.dataset.pwInit) return;
    input.dataset.pwInit = '1';
    const wrap = document.createElement('div');
    wrap.className = 'pw-field-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.classList.add('pw-field-input');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle-btn';
    btn.setAttribute('aria-label', 'Jelszó megjelenítése');
    btn.innerHTML = PW_EYE_SVG;
    btn.addEventListener('click', () => {
      const nowShowing = input.type === 'password';
      input.type = nowShowing ? 'text' : 'password';
      btn.innerHTML = nowShowing ? PW_EYE_OFF_SVG : PW_EYE_SVG;
    });
    wrap.appendChild(btn);
  });
}
initPasswordToggles();

// ── Hulló parázs-szemcse háttéranimáció (ugyanaz, mint a SolarLauncherben) ──
(function initParticles() {
  const canvas = $('#particleCanvas');
  // ÚJ: aki a rendszerében kikapcsolta az animációkat (mozgásérzékenység,
  // vestibuláris panasz - WCAG 2.3.3), annál el sem indítjuk a hurkot. Ez
  // egyben a leggyengébb gépeken/akkumulátoron is spórolás: így nincs
  // másodpercenként 60 teljes képernyős újrarajzolás.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  // ÚJ: az átméretezés fojtása (throttle). A canvas.width írása minden
  // alkalommal ÚJRAFOGLALJA a teljes rajzfelületet - egy ablak-húzás alatt
  // ez másodpercenként több tucatszor futott le, ami az egész felületet
  // megakasztotta. Egy képkockányi késleltetés érzékelhetetlen, viszont
  // húzás közben egyetlen újrafoglalásra csökkenti.
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => { resizePending = false; resize(); });
  });
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

// ÚJ: TELJES kijelentkezés - a "Kijelentkezés" gomb (ellentétben a
// saveSession() fenti "session=null" ágával, ami csak az AKTÍV fiókot veszi
// ki, a többi mentett fiókot érintetlenül hagyva) MINDEN mentett fiókot
// töröl egyszerre, ugyanúgy mint a launcher removeAllAccounts()-ja - a
// felhasználó kérése, hogy egy kattintással biztosan egyik mentett fiók se
// maradjon bejelentkezve ezen a böngészőn.
function logoutAllAccounts() {
  accounts = [];
  activeUsername = '';
  session = null;
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

// ÚJ: 2FA/biztonsági-kód-tudatos bejelentkezés - a POST /api/login VAGY egy
// azonnali {ok,username,token} választ ad, VAGY (ha a fióknak be van
// kapcsolva a 2FA-ja és/vagy a biztonsági kódja) egy {requiresTotp,
// requiresPin, pendingToken}-et. A kettő EGYMÁSTÓL FÜGGETLENÜL lehet igaz -
// ha mindkettő az, EGYMÁS UTÁN kérjük be őket (előbb a 2FA-t, utána a
// biztonsági kódot), ugyanazzal a pendingToken-nel - a backend
// (finalizePendingLogin, ld. server.js) csak akkor ad ki valódi tokent, ha
// MINDKETTŐ teljesült. Ugyanezt a függvényt hívja a fő bejelentkezési űrlap
// ÉS a fiókváltó-modál "Fiók hozzáadása" mini-űrlapja is (ld. lentebb) - így
// ez a lépés UI-ja egyetlen helyen él, nem duplikálódik.
async function performLogin(username, password, rememberMe) {
  let res = await apiPost('/api/login', { username, password, rememberMe: rememberMe === true });
  if (!res.ok) return res;
  if (res.requiresTotp) {
    const totpInput = await promptTotpModal();
    if (!totpInput) return { ok: false, message: 'Megszakítva.' };
    res = await apiPost('/api/login/totp', { pendingToken: res.pendingToken, ...totpInput });
    if (!res.ok) return res;
  }
  if (res.requiresPin) {
    const pin = await promptPinModal(res.pinLength || 6);
    if (!pin) return { ok: false, message: 'Megszakítva.' };
    res = await apiPost('/api/login/pin', { pendingToken: res.pendingToken, pin });
  }
  return res;
}

// Promise-alapú biztonsági-kód bekérő modal bejelentkezéskor - ugyanaz a
// minta, mint promptTotpModal(), de egyetlen, dinamikus hosszúságú (4 vagy
// 6 jegyű) mezővel.
function promptPinModal(pinLength) {
  return new Promise((resolve) => {
    const overlay = $('#pinPromptModal');
    const input = $('#pinPromptInput');
    const errEl = $('#pinPromptError');
    input.value = '';
    input.maxLength = pinLength;
    input.placeholder = '0'.repeat(pinLength);
    errEl.textContent = '';

    overlay.classList.remove('hidden');
    input.focus();

    function cleanup() {
      overlay.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      submitBtn.removeEventListener('click', onSubmit);
      overlay.removeEventListener('click', onOverlayClick);
    }
    function onSubmit() {
      const pin = input.value.trim();
      if (!new RegExp(`^\\d{${pinLength}}$`).test(pin)) {
        errEl.textContent = `A kód ${pinLength} számjegyből áll.`;
        return;
      }
      cleanup();
      resolve(pin);
    }
    function onCancel() { cleanup(); resolve(null); }
    function onOverlayClick(e) { if (e.target === overlay) onCancel(); }

    const cancelBtn = $('#pinPromptCancel');
    const submitBtn = $('#pinPromptSubmit');
    cancelBtn.addEventListener('click', onCancel);
    submitBtn.addEventListener('click', onSubmit);
    overlay.addEventListener('click', onOverlayClick);
  });
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
  const userEl = $('#authUser');
  const passEl = $('#authPass');
  const user = userEl.value.trim();
  const pass = passEl.value;
  const rememberMe = $('#authRememberMe').checked;
  $('#authError').textContent = '';

  // ÚJ: kliens-oldali kötelező-mező ellenőrzés. Enélkül egy ÜRES űrlap
  // elküldése is elment a backendig, és onnan a félrevezető "Hibás
  // felhasználónév vagy jelszó" jött vissza - miközben a felhasználó nem
  // rontott el semmit, csak még nem írt be semmit. Ráadásul minden ilyen
  // üres próbálkozás beleszámított a bejelentkezési kísérlet-korlátba.
  // A markFieldInvalid()/setButtonLoading() a ui.js-ben él; ha az valamiért
  // nem töltött be, a ?.-mentes hívás helyett itt egy őrfeltétel áll, hogy
  // a bejelentkezés attól még működjön.
  const invalid = (el, msg) => { if (typeof window.markFieldInvalid === 'function') window.markFieldInvalid(el, msg); };
  if (!user || !pass) {
    if (!user) invalid(userEl, 'Add meg a játékosnevedet.');
    if (!pass) invalid(passEl, 'Add meg a jelszavadat.');
    (user ? passEl : userEl).focus();
    return;
  }

  const btn = $('#authSubmit');
  if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  let res;
  try {
    res = await performLogin(user, pass, rememberMe);
  } finally {
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
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
  logoutAllAccounts();
  $('#lockedScreen').classList.add('hidden');
  $('#authScreen').classList.remove('hidden');
});

// ── Regisztráció: születési dátum legördülők feltöltése ── (ÚJ: kiemelve
// egy újrahasznosítható függvénybe, mert a fiókváltó modál beágyazott
// regisztrációs formja - #accountAddRegisterForm - saját, külön select-eket
// használ ugyanezzel a listával, ld. lentebb - a SolarLauncher renderer.js
// ugyanezt a mintát követi.)
const HU_MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
function populateBirthDateSelects(yearSel, monthSel, daySel) {
  const nowYear = new Date().getFullYear();
  for (let y = nowYear - 14; y >= nowYear - 100; y--) {
    const opt = document.createElement('option');
    opt.value = String(y); opt.textContent = String(y);
    yearSel.appendChild(opt);
  }
  HU_MONTHS.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i + 1).padStart(2, '0'); opt.textContent = name;
    monthSel.appendChild(opt);
  });
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = String(d).padStart(2, '0'); opt.textContent = String(d);
    daySel.appendChild(opt);
  }
}
populateBirthDateSelects($('#regYear'), $('#regMonth'), $('#regDay'));
populateBirthDateSelects($('#modalRegYear'), $('#modalRegMonth'), $('#modalRegDay'));

// ── Regisztráció: validáció + beküldés, KIEMELVE egy megosztott függvénybe
// (ÚJ) - mind a teljes képernyős regisztrációs form, mind a fiókváltó modál
// beágyazott #accountAddRegisterForm-ja ugyanezt hívja, csak a saját mező-
// ID-jaikkal. ──
async function submitRegistration(ids, errEl) {
  errEl.textContent = '';

  const username = $(ids.user).value.trim();
  const email = $(ids.email).value.trim();
  const email2 = $(ids.email2).value.trim();
  const pass = $(ids.pass).value;
  const pass2 = $(ids.pass2).value;
  const year = $(ids.year).value, month = $(ids.month).value, day = $(ids.day).value;
  const creatorCode = $(ids.creatorCode).value.trim();
  const termsOk = $(ids.terms).checked;
  const ageOk = $(ids.age).checked;
  const marketingOk = $(ids.marketing).checked;
  const marketingChannel = $(ids.marketingChannel).value;

  // A hibát mostantól nemcsak az űrlap alján, egyetlen közös sorban írjuk
  // ki, hanem MEGJELÖLJÜK a hibás mezőt is (piros keret + rövid rázás), és
  // oda is ugrunk. Egy 10 mezős regisztrációs űrlapnál a "A két jelszó nem
  // egyezik" önmagában, az űrlap alján gyakran nem is látszott a képernyőn.
  const fail = (msg, fieldSel) => {
    errEl.textContent = msg;
    const el = fieldSel ? $(fieldSel) : null;
    if (el) {
      if (typeof window.markFieldInvalid === 'function') window.markFieldInvalid(el, msg);
      el.focus();
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    return null;
  };

  if (!username) return fail('Adj meg egy játékos nevet.', ids.user);
  if (!email) return fail('Add meg az email címedet.', ids.email);
  // ÚJ: formai ellenőrzés. Eddig csak a KÉT mező egyezését néztük, tehát egy
  // elgépelt cím (pl. hiányzó @) is elment a backendig - és mivel a
  // visszaigazoló levél oda ment volna, a hiba csak sokkal később derült ki.
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return fail('Ez nem tűnik érvényes email címnek.', ids.email);
  if (email !== email2) return fail('A két email cím nem egyezik.', ids.email2);
  if (!pass) return fail('Adj meg egy jelszót.', ids.pass);
  if (pass.length < 6) return fail('A jelszó min. 6 karakter.', ids.pass);
  if (pass !== pass2) return fail('A két jelszó nem egyezik.', ids.pass2);
  if (!year || !month || !day) return fail('Add meg a születési dátumodat.', !year ? ids.year : (!month ? ids.month : ids.day));
  if (!termsOk) return fail('Az ÁSZF és az Adatvédelmi nyilatkozat elfogadása kötelező.', ids.terms);
  if (!ageOk) return fail('Erősítsd meg, hogy betöltötted a 14. életévedet.', ids.age);

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
  if (!res.ok) { errEl.textContent = res.message || 'Sikertelen regisztráció.'; return null; }
  return res;
}

const REGISTER_FORM_IDS = {
  user: '#regUser', email: '#regEmail', email2: '#regEmail2', pass: '#regPass', pass2: '#regPass2',
  year: '#regYear', month: '#regMonth', day: '#regDay', creatorCode: '#regCreatorCode',
  terms: '#regTerms', age: '#regAge', marketing: '#regMarketing', marketingChannel: '#regMarketingChannel'
};
const MODAL_REGISTER_FORM_IDS = {
  user: '#modalRegUser', email: '#modalRegEmail', email2: '#modalRegEmail2', pass: '#modalRegPass', pass2: '#modalRegPass2',
  year: '#modalRegYear', month: '#modalRegMonth', day: '#modalRegDay', creatorCode: '#modalRegCreatorCode',
  terms: '#modalRegTerms', age: '#modalRegAge', marketing: '#modalRegMarketing', marketingChannel: '#modalRegMarketingChannel'
};

// ── Regisztráció: beküldés ──
$('#registerSubmit').addEventListener('click', doRegister);

async function doRegister() {
  const res = await submitRegistration(REGISTER_FORM_IDS, $('#registerError'));
  if (!res) return;
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
// SolarBungee (playtime) és SolarLobby (PP/rang) szerver-oldali pluginok
// töltik fel ezeket a /api/game/report végponton keresztül - innentől valódi
// adatok, nem helykitöltő 0/"-" érték.
// JAVÍTVA: a PrémiumPont-jelvény mostantól a felhasználó saját PP-érme
// képét használja (assets/pp-coin.png) a korábbi generikus érme-SVG helyett.
const STAT_ICONS = {
  rank: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.4z"/></svg>',
  coin: '<img src="assets/pp-coin.png" alt="PP" />',
  time: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5.4l4 2.3-.8 1.3L11 13V7z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-1.5 8.5A1.5 1.5 0 1 1 20 13a1.5 1.5 0 0 1-1.5 1.5zM20 9H4V8h16z"/></svg>',
  spin: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 12a8 8 0 0 1 14.6-4.5M20 12a8 8 0 0 1-14.6 4.5M18.6 7.5V4m0 3.5H15M5.4 16.5V20m0-3.5H9"/></svg>'
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ÚJ: "opts.showWallet" - a más játékos profilját megnyitó hívás (ld.
// openPlayerProfile) ezzel egy 4. "Egyenleg" (valós pénzes, ld.
// GET /api/profile/:username "walletBalanceHuf" mezőjét) jelvényt is
// megjelenít - a felhasználó kifejezett kérésére ez a kereséssel megnyitott
// profilon LÁTHATÓ mindenki számára, a PrémiumPont-tal ("coin") együtt. A
// saját profil (GET /api/me) hívása nem ad opts-ot - ott az egyenleget a már
// meglévő, külön topbar-/főoldal-jelvény (ld. renderWalletBadge) mutatja,
// itt nem duplikáljuk.
function renderStatBadges(container, values, opts) {
  const showWallet = !!(opts && opts.showWallet);
  const items = [
    { icon: 'rank', label: 'Rang', html: escapeHtml(values.rank) },
    { icon: 'coin', label: 'PrémiumPont', html: escapeHtml(values.coin) },
    ...(showWallet ? [{ icon: 'wallet', label: 'Egyenleg', html: escapeHtml(values.wallet) }] : []),
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
// ilyenkor esik vissza helykitöltőre ("-"/"0"/"0 óra").
function emptyStats() {
  return { rank: '-', coin: '0', wallet: '0 Ft', time: '0 óra' };
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
    rank: data.rank ? capitalizeFirst(data.rank) : '-',
    coin: typeof data.scBalance === 'number' ? data.scBalance.toLocaleString('hu-HU') : '0',
    // ÚJ: valós pénzes egyenleg (ld. GET /api/profile/:username
    // "walletBalanceHuf" mezője) - jelenleg csak a más játékos profilját
    // megnyitó renderStatBadges(..., { showWallet: true }) hívás jeleníti
    // meg ténylegesen (ld. openPlayerProfile).
    wallet: typeof data.walletBalanceHuf === 'number' ? formatHuf(data.walletBalanceHuf) : '0 Ft',
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
    // JAVÍTVA (XSS): a Discord-profil megjelenítendő neve/avatar-URL-je a
    // felhasználó OAuth-profiljából jön (Discord oldalán szabadon
    // állítható, NEM esik át a SolarCenter saját USERNAME_RE-jén) - a
    // korábbi, nyers interpolálás egy célzottan összeállított Discord
    // megjelenítési névvel (vagy avatar-URL-lel, ami megszakíthatta volna
    // az src="..." attribútumot) tárolt XSS-t tett volna lehetővé, ami a
    // fiókot linkelő játékosnak ÉS minden adminnak lefutott volna, aki
    // megnyitja a profilját.
    const avatarHtml = data.discordAvatar
      ? `<img class="discord-link-avatar" src="${escapeHtml(data.discordAvatar)}" alt="" />`
      : '';
    const unlinkBtn = opts
      ? `<button type="button" class="link-btn discord-unlink-btn" data-mode="${opts.mode}"${opts.mode === 'admin' ? ' data-perm="player.action.discordUnlink"' : ''}>Leválasztás</button>`
      : '';
    container.innerHTML = `
      <div class="discord-link-badge discord-link-badge-connected">
        ${avatarHtml}
        <span>Összekötve ezzel: <b>${escapeHtml(data.discordUsername)}</b></span>
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
  // ÚJ: a fiók-zárolás ténye (indok NÉLKÜL - az senki másra nem tartozik,
  // ld. GET /api/profile/:username "locked" mezőjét) külön, egyszerű
  // kártyaként jelenik meg, a némítás/kitiltás-kártyák "info" (by/since/
  // until/reason) szerkezete nélkül, mivel a zárolásnak nincs ilyen adata.
  const lockedHtml = data?.locked ? `
    <div class="sanction-status-card">
      <div class="sanction-status-card-title">🔒 A fiók zárolva van</div>
    </div>
  ` : '';

  const cards = [];
  if (data?.activeMute) cards.push({ label: '🔇 Aktív némítás', info: data.activeMute });
  if (data?.activeBan) cards.push({ label: '⛔ Aktív kitiltás', info: data.activeBan });
  if (data?.activeCban) cards.push({ label: '🖥 Aktív kliens-tiltás', info: data.activeCban });

  if (!lockedHtml && !cards.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = lockedHtml + cards.map((c) => `
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
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('hu-HU');
}

// A hátralévő időt "X nap Y óra" / "X óra Y perc" alakban adja vissza,
// zárójelben a pontos dátummal - egy puszta dátum-időbélyeg kevésbé
// szemléletes annál, mint amennyi idő ténylegesen hátravan.
function formatRemaining(untilIso) {
  if (!untilIso) return '-';
  const untilMs = new Date(untilIso).getTime();
  if (Number.isNaN(untilMs)) return '-';
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
  'player.action.discountSet', 'player.action.discountRemove', 'player.action.discordUnlink',
  'player.action.cosmeticGrant', 'player.action.cosmeticRevoke'
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
// JAVÍTVA: a felhasználó gyors nézetváltásainál (pl. Rangok <-> Egyenleg
// pattogtatása) a refreshPpBalance() több, egymást átfedő hívása egymás
// UTÁN, de egymást MEGELŐZVE futhatott le - mindegyik a SAJÁT célértékéhez
// indított egy 650ms-es animációt UGYANAZON az elemen, cancelálás nélkül.
// Két párhuzamos rAF-hurok emiatt felváltva írta a textContent-et két
// KÜLÖNBÖZŐ interpolációból, ami néha a topbaron egészen más (akár
// negatívnak látszó) számot eredményezett, mint amit a főoldal mutatott. A
// WeakMap elemenként tárolja a "legutolsó indított animáció" generációját -
// egy korábbi hurok az első lépésekor észreveszi, hogy felülírták, és
// azonnal leáll, mielőtt bármit írna.
const numberAnimGen = new WeakMap();
function animateNumberTo(el, from, to, formatFn, duration = 650) {
  if (from === to) { el.textContent = formatFn(to); numberAnimGen.set(el, (numberAnimGen.get(el) || 0) + 1); return; }
  const myGen = (numberAnimGen.get(el) || 0) + 1;
  numberAnimGen.set(el, myGen);
  // ÚJ: rövid megvillanás a szám mellett, hogy a változás akkor is
  // észrevehető legyen, ha valaki épp nem a számlálást nézi (ld. ui.css
  // .value-bump).
  el.classList.remove('value-bump');
  void el.offsetWidth;
  el.classList.add('value-bump');
  const start = performance.now();
  function tick(now) {
    if (numberAnimGen.get(el) !== myGen) return; // felülírta egy újabb hívás - ez a hurok leáll
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
  // Vesszővel felsorolt több kulcs esetén VAGY-kapcsolattal (elég BÁRMELYIK
  // jog) - ugyanaz a szemantika, mint az applyPermVisibility() data-perm
  // kezelésénél. Kell pl. a "Kiegészítők" admin nézethez, amit a
  // katalógus-kezelő ÉS a piac-moderátor jog is láthatóvá tesz.
  $$('.admin-nav-item[data-permission]').forEach((el) => {
    const keys = el.dataset.permission.split(',').map((k) => k.trim());
    el.classList.toggle('hidden', !keys.some(hasPerm));
  });
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
  logoutAllAccounts();
  location.reload();
});

// ── Gyors fiókváltás (ld. accounts/activeUsername fent) - a SolarLauncher
// fiókváltó-modáljának 1:1 UX-portja. ──
const accountModal = $('#accountModal');
function openAccountModal() {
  $('#addAccountForm').classList.add('hidden');
  $('#accountAddRegisterForm').classList.add('hidden');
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
  // JAVÍTVA: korábban itt enterApp()-t hívtunk újratöltés nélkül - az oldal
  // az imént elhagyott nézeten/állapoton maradt, csak az adatok mögötte
  // váltottak az újonnan hozzáadott fiókra (a felhasználó szerint "nem
  // frissül az oldal, ott maradok ahol voltam csak a másik fiókon"). Ugyanaz
  // a hiba osztály, amit switchAccount() location.reload()-ja fentebb már
  // elkerül fiókváltáskor - itt is egy teljes újratöltés a legegyszerűbb
  // módja annak, hogy MINDEN nézet/állapot az új, aktív fiókhoz tartozó
  // legyen; tryAutoLogin() a betöltéskor úgyis a most mentett aktív fiókkal
  // jelentkezik be.
  location.reload();
});

// ── ÚJ: regisztráció közvetlenül a fiókváltó modálból - a "Nincs még
// fiókod? Regisztráció!" linkre kattintva a beágyazott bejelentkező-form
// (#addAccountForm) helyett a beágyazott regisztrációs form
// (#accountAddRegisterForm) jelenik meg, ugyanabban a modálban. Sikeres
// regisztráció után PONTOSAN ugyanaz a záró-szekvencia fut, mint egy
// meglévő fiók hozzáadásánál (btnDoAddAccount fent) - ld. renderer.js
// doModalRegister ugyanez a mintázat a launcherben. ──
$('#accountAddSwitchToRegister').addEventListener('click', () => {
  $('#addAccountForm').classList.add('hidden');
  $('#modalRegError').textContent = '';
  $('#accountAddRegisterForm').classList.remove('hidden');
});
$('#modalRegCancel').addEventListener('click', () => {
  $('#accountAddRegisterForm').classList.add('hidden');
  $('#addAccountForm').classList.remove('hidden');
});
$('#modalRegSubmit').addEventListener('click', doModalRegister);

async function doModalRegister() {
  const res = await submitRegistration(MODAL_REGISTER_FORM_IDS, $('#modalRegError'));
  if (!res) return;
  session = { username: res.username, token: res.token };
  saveSession();
  closeAccountModal();
  location.reload();
}

// ── Biztonság (2FA/TOTP + biztonsági kód) - ld. SolarBackend src/totp.js és
// src/securityPin.js. A két funkció EGYMÁSTÓL FÜGGETLEN, de a "biztonságod
// veszélyben van" figyelmeztető sáv (ld. index.html #securityWeakWarning)
// mindkettő állapotát ismernie kell - securityFactorState tárolja mindkét
// betöltés eredményét, refreshSecurityWarning() dönt a sáv láthatóságáról. ──
let lastGeneratedRecoveryCodes = null;
const securityFactorState = { totp: null, pin: null };

function refreshSecurityWarning() {
  // Amíg valamelyik állapot még nem töltődött be (null), nem döntünk - egy
  // BE állapotú tényezőt sose jelentsünk hibásan "nincs védelem"-nek egy
  // lassabban betöltő másik kérés miatt.
  if (securityFactorState.totp === null || securityFactorState.pin === null) return;
  $('#securityWeakWarning').classList.toggle('hidden', securityFactorState.totp || securityFactorState.pin);
}

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
    securityFactorState.totp = data.enabled;
    refreshSecurityWarning();
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

// ── Biztonsági kód (PIN) - ld. SolarBackend src/securityPin.js ──
function showSecurityPinPanel(panelId) {
  ['securityPinSetupPanel', 'securityPinEnabledPanel']
    .forEach((id) => $('#' + id).classList.toggle('hidden', id !== panelId));
}

// A hossz-választó rádiógombok szerint tartja szinkronban a PIN-mezők
// maxlength/placeholder-jét, hogy ne lehessen a választottnál több/kevesebb
// számjegyet beírni.
function currentSecurityPinLength() {
  return $('#securityPinLength4').checked ? 4 : 6;
}
function syncSecurityPinInputLengths() {
  const len = currentSecurityPinLength();
  [$('#securityPinSetupInput'), $('#securityPinSetupConfirmInput')].forEach((input) => {
    input.maxLength = len;
    input.placeholder = '0'.repeat(len);
  });
}
$('#securityPinLength4').addEventListener('change', syncSecurityPinInputLengths);
$('#securityPinLength6').addEventListener('change', syncSecurityPinInputLengths);

// Megnyitja a beállító űrlapot - "isChange" esetén (már bekapcsolt kód
// módosítása) a jelenlegi hosszra állítja a rádiógombot, és megjeleníti a
// "Mégse" gombot (első bekapcsoláskor nincs mihez visszalépni, ld. lentebb).
function openSecurityPinSetup(isChange, currentLength) {
  $('#securityPinLength4').checked = currentLength === 4;
  $('#securityPinLength6').checked = currentLength !== 4;
  syncSecurityPinInputLengths();
  $('#securityPinSetupInput').value = '';
  $('#securityPinSetupConfirmInput').value = '';
  $('#securityPinSetupPasswordInput').value = '';
  $('#securityPinSetupError').textContent = '';
  $('#btnConfirmSecurityPin').textContent = isChange ? 'Mentés' : 'Bekapcsolás';
  $('#btnCancelSecurityPinSetup').classList.toggle('hidden', !isChange);
  showSecurityPinPanel('securityPinSetupPanel');
}

async function loadSecurityPinStatus() {
  if (!session || !session.token) return;
  const statusEl = $('#securityPinStatus');
  statusEl.textContent = 'Betöltés...';
  try {
    const res = await fetch(BACKEND_URL + '/api/security-pin/status', { headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { statusEl.textContent = 'Nem sikerült lekérdezni az állapotot.'; return; }
    securityFactorState.pin = data.enabled;
    refreshSecurityWarning();
    if (data.enabled) {
      statusEl.textContent = `A biztonsági kód BE van kapcsolva a fiókodon (${data.length} jegyű).`;
      $('#securityPinDisablePasswordInput').value = '';
      $('#securityPinActionError').textContent = '';
      showSecurityPinPanel('securityPinEnabledPanel');
      $('#btnChangeSecurityPin').dataset.currentLength = data.length;
    } else {
      statusEl.textContent = 'A biztonsági kód jelenleg NINCS bekapcsolva.';
      openSecurityPinSetup(false, 6);
    }
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
  }
}

$('#btnChangeSecurityPin').addEventListener('click', () => {
  openSecurityPinSetup(true, Number($('#btnChangeSecurityPin').dataset.currentLength) || 6);
});

$('#btnCancelSecurityPinSetup').addEventListener('click', () => showSecurityPinPanel('securityPinEnabledPanel'));

$('#btnConfirmSecurityPin').addEventListener('click', async () => {
  const len = currentSecurityPinLength();
  const pin = $('#securityPinSetupInput').value.trim();
  const confirmPin = $('#securityPinSetupConfirmInput').value.trim();
  const password = $('#securityPinSetupPasswordInput').value;
  const errEl = $('#securityPinSetupError');
  if (!new RegExp(`^\\d{${len}}$`).test(pin)) { errEl.textContent = `A kód ${len} számjegyből álljon.`; return; }
  if (pin !== confirmPin) { errEl.textContent = 'A két kód nem egyezik.'; return; }
  if (!password) { errEl.textContent = 'Add meg a jelszavad.'; return; }
  try {
    const res = await fetch(BACKEND_URL + '/api/security-pin/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ pin, confirmPin, password })
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.message || 'Nem sikerült bekapcsolni.'; return; }
    showToast('Biztonsági kód beállítva.');
    loadSecurityPinStatus();
  } catch {
    errEl.textContent = 'Nem sikerült elérni a szervert.';
  }
});

$('#btnDisableSecurityPin').addEventListener('click', async () => {
  const password = $('#securityPinDisablePasswordInput').value;
  const errEl = $('#securityPinActionError');
  if (!password) { errEl.textContent = 'Add meg a jelszavad.'; return; }
  const confirmed = await confirmModal('Biztonsági kód kikapcsolása', 'Biztosan kikapcsolod a biztonsági kódot? A bejelentkezéshez ezután nem lesz szükség rá.', 'Igen, kikapcsolás');
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/security-pin/disable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!data.ok) { errEl.textContent = data.message || 'Nem sikerült kikapcsolni.'; return; }
    showToast('A biztonsági kód kikapcsolva.');
    loadSecurityPinStatus();
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
  if (view === 'security') { loadSecurityStatus(); loadSecurityPinStatus(); }
  // A Napló fület minden megnyitáskor frissítjük - friss bejegyzéseket kér le
  // (a dátum-szűrők szerint), a keresés viszont kliens-oldalon szűr a már
  // letöltött listán, nem küld újabb kérést minden billentyűleütésre.
  if (view === 'ledger') loadLedger();
  // A Vásárlás napló/Napló (admin) fület minden megnyitáskor a globális
  // (mindenkire kiterjedő) nézetre állítjuk vissza - a korábban beírt
  // játékosnév-szűrés nem marad meg fülváltás után, hogy ne legyen
  // meglepő/régi szűrt nézet a legközelebbi megnyitáskor.
  if (view === 'purchaseLogs') loadPurchaseLogsGlobal();
  if (view === 'staffActionLogs') loadStaffActionLogsGlobal();
  if (view === 'staffStats') loadStaffStats();
  if (view === 'analytics') loadAnalytics();
  if (view === 'revenue') loadRevenue();
  if (view === 'newsAdmin') { resetNewsForm(); loadNewsAdmin(); }
  if (view === 'badges') { resetBadgeForm(); loadBadgesAdmin(); }
  if (view === 'discounts') { resetDiscountForm(); loadDiscountsAdmin(); }
  if (view === 'coupons') { resetCouponForm(); loadCouponsAdmin(); }
  if (view === 'creatorCodes') { resetCreatorCodeForm(); loadCreatorCodesAdmin(); }
  if (view === 'casino') loadCasino();
  // ÚJ: kiegészítők (ld. SolarBackend src/cosmetics.js). A "Kiegészítők" és a
  // "Piac" is minden megnyitáskor frissül - a piaci kínálat más játékosok
  // műveleteitől is változik, egy elavult lista pedig "már nem elérhető"
  // hibába futna vásárláskor.
  if (view === 'cosmetics') loadMyCosmetics();
  if (view === 'market') loadMarket();
  if (view === 'cosmeticsAdmin') { resetCosmeticForm(); loadCosmeticsAdmin(); }
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
    <div class="player-card" data-username="${escapeHtml(p.username)}">
      <canvas class="player-card-canvas" data-idx="${i}" width="40" height="40"></canvas>
      <div class="player-card-info">
        <div class="player-card-label">Név</div>
        <div class="player-card-name">${escapeHtml(p.username)}</div>
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
  renderStatBadges($('#playerProfileStats'), emptyStats(), { showWallet: true });
  renderSanctionStatus($('#playerProfileSanctionStatus'), null);
  renderNameBadges($('#playerProfileNameBadges'), null);
  apiGetProfile(username).then((profile) => {
    renderStatBadges($('#playerProfileStats'), profile.ok ? formatStats(profile) : emptyStats(), { showWallet: true });
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
  // ÚJ: kiegészítők - a jelvényekkel ellentétben ez KÜLÖN végpontról jön
  // (/api/admin/player/:username/cosmetics), mert a saját jogkulcsai
  // (cosmeticGrant/cosmeticRevoke) függetlenek a jelvény-jogoktól.
  $('#adminCosmeticGrantStatus').textContent = '';
  $('#adminPlayerCosmeticsList').innerHTML = '';
  $('#adminCosmeticDurationInput').value = '';
  loadAdminPlayerCosmetics(username);
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
      <tr><td>${formatLedgerDate(l.created_at)}</td><td>${escapeHtml(l.username)}</td></tr>
    `).join('') || '<tr><td colspan="2">Nincs rögzített belépés.</td></tr>';
    $('#deviceUsersBody').innerHTML = data.users.map((u) => `
      <tr><td>${formatLedgerDate(u.last_seen)}</td><td>${escapeHtml(u.username)}</td><td>${u.login_count}</td></tr>
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
// ÚJ: automatikus PP-előfizetéses rangrendszer (a felhasználó kifejezett
// kérésére, ld. SolarBackend src/subscriptions.js) - a bejelentkezett
// felhasználó SAJÁT aktív/lemondott előfizetéseinek listája, hogy minden
// rang-kártyán el tudjuk dönteni: "Előfizetés" gombot mutassunk-e, vagy már
// van rá aktív előfizetés (akkor "Lemondás" + a következő terhelés dátuma).
let mySubscriptions = [];

function formatSubscriptionDate(iso) {
  if (!iso) return '';
  // A backend "YYYY-MM-DD HH:MM:SS" (UTC, SQLite datetime()) formátumban adja
  // vissza - a Date natívan is fel tudja dolgozni "T"-re cserélve a szóközt.
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('hu-HU');
}

function renderRankCard(rank) {
  // A "priceCoins" itt MÁR a kedvezménnyel csökkentett ár (ld. GET /ranks) -
  // az "elég PP van-e" ellenőrzés is helyesen a TÉNYLEGESEN fizetendő,
  // kedvezményes árhoz hasonlít.
  const affordable = currentPpBalance >= rank.priceCoins;
  const discountBadge = rank.discountPercent > 0 ? `<div class="discount-badge">-${rank.discountPercent}%</div>` : '';
  const priceInner = rank.discountPercent > 0
    ? `<span class="price-original">${formatPp(rank.originalPriceCoins)}</span>${formatPp(rank.priceCoins)}`
    : formatPp(rank.priceCoins);

  const mySub = mySubscriptions.find((s) => s.rankId === rank.id && s.active);
  let subscriptionBlock = '';
  if (rank.subscribable) {
    if (mySub) {
      const statusNote = mySub.lastChargeStatus === 'failed'
        ? '<div class="subscription-status subscription-status-failed">Az utolsó terhelés sikertelen volt - pótold az egyenleged, a következő próbálkozás automatikus.</div>'
        : '';
      subscriptionBlock = `
        <div class="subscription-info">Előfizetve - következő terhelés: ${formatSubscriptionDate(mySub.nextBillingAt)}</div>
        ${statusNote}
        <button type="button" class="btn-outline btn-cancel-subscription" data-cancel-sub-rank-id="${rank.id}">Előfizetés lemondása</button>
      `;
    } else {
      subscriptionBlock = `
        <button type="button" class="btn-outline btn-subscribe" data-subscribe-rank-id="${rank.id}"${affordable ? '' : ' disabled'}>Előfizetés (havonta ${formatPp(rank.priceCoins)})</button>
      `;
    }
  }

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
      ${subscriptionBlock}
    </div>
  `;
}

function renderRankGrid() {
  $('#rankGrid').innerHTML = shopRanks.map(renderRankCard).join('');
}

async function loadMySubscriptions() {
  if (!session || !session.token) { mySubscriptions = []; return; }
  try {
    const res = await fetch(BACKEND_URL + '/api/subscriptions/mine', { headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    mySubscriptions = data.ok && Array.isArray(data.subscriptions) ? data.subscriptions : [];
  } catch {
    mySubscriptions = [];
  }
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
  await loadMySubscriptions();
  renderRankGrid();
  $('#rankGrid').dataset.loaded = '1';
}
loadRanks();

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy[data-rank-id]');
  if (btn && !btn.disabled) buyRank(btn.dataset.rankId, btn);
  const subBtn = e.target.closest('.btn-subscribe[data-subscribe-rank-id]');
  if (subBtn && !subBtn.disabled) subscribeRank(subBtn.dataset.subscribeRankId, subBtn);
  const cancelBtn = e.target.closest('.btn-cancel-subscription[data-cancel-sub-rank-id]');
  if (cancelBtn) cancelSubscription(cancelBtn.dataset.cancelSubRankId, cancelBtn);
});

// ÚJ: havonta automatikusan megújuló előfizetés indítása - az ELSŐ terhelés
// azonnal elindul (ugyanaz az async pending/claim mechanizmus, mint egy sima
// rang-vásárlásnál, ld. buyRank), utána a SolarBackend saját maga terheli
// havonta, amíg a játékos le nem mondja.
async function subscribeRank(rankId, buttonEl) {
  if (!session || !session.token) {
    showToast('Az előfizetéshez jelentkezz be.', true);
    return;
  }
  const rank = shopRanks.find((r) => r.id === rankId);
  const confirmed = await confirmModal(
    'Előfizetés indítása',
    rank ? `A(z) <b>${rank.label}</b> rangra fizetsz elő, havonta <b>${formatPp(rank.priceCoins)}</b> kerül levonásra az egyenlegedből automatikusan, amíg le nem mondod.` : 'Biztosan elindítod ezt az előfizetést?',
    'Igen, előfizetek'
  );
  if (!confirmed) return;

  const originalText = buttonEl.textContent;
  buttonEl.disabled = true;
  buttonEl.textContent = 'Előfizetés indítása...';
  try {
    const res = await fetch(BACKEND_URL + '/api/subscriptions/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ rankId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.message || 'Nem sikerült elindítani az előfizetést.', true);
    } else {
      showToast('Előfizetés elindítva - az első terhelés kb. 1 percen belül lezajlik.');
      await loadMySubscriptions();
      renderRankGrid();
    }
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

async function cancelSubscription(rankId, buttonEl) {
  const confirmed = await confirmModal('Előfizetés lemondása', 'Biztosan lemondod ezt az előfizetést? A következő hónaptól már nem terhelünk automatikusan.', 'Igen, lemondom');
  if (!confirmed) return;
  buttonEl.disabled = true;
  try {
    const res = await fetch(BACKEND_URL + '/api/subscriptions/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ rankId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.message || 'Nem sikerült lemondani az előfizetést.', true);
      buttonEl.disabled = false;
    } else {
      showToast('Előfizetés lemondva.');
      await loadMySubscriptions();
      renderRankGrid();
    }
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
    buttonEl.disabled = false;
  }
}

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

// ── Vásárlás napló (admin) - jogosultsági rálátás MINDEN játékos pp_ledger
// bejegyzésére (ld. SolarBackend GET /api/admin/logs[/:username]), szemben a
// fenti (saját) Napló füllel - ugyanazt a "ledger-table" HTML/CSS mintát és
// segédfüggvényeket (formatLedgerDate/LEDGER_TYPE_LABELS/formatPp) használja,
// csak egy plusz "Játékos" oszloppal, mert itt több felhasználó keveredik.
// KORÁBBAN "Napló (admin)" néven futott - a felhasználó kérésére "Vásárlás
// napló"-ra átnevezve, hogy a staff-tevékenységeket mutató, ÚJ nézettől (ld.
// lejjebb) megkülönböztethető legyen; a jogosultsági kulcs (global.logs)
// VÁLTOZATLAN maradt. JAVÍTVA: a betöltő függvények korábban "!isOwner"-t
// ellenőriztek "!hasPerm(...)" helyett - egy "global.logs" jogot kapott
// (de nem tulajdonos) staff a nav-gombot látta, de a nézet üresen maradt
// volna (ugyanez a hiba a többi admin-nézet betöltőjében is megvan, azok
// egyelőre változatlanok). ──
let purchaseLogsEntries = [];

function renderPurchaseLogRow(entry) {
  const typeLabel = LEDGER_TYPE_LABELS[entry.type] || entry.type;
  const amountClass = entry.amount > 0 ? 'ledger-amount-positive' : entry.amount < 0 ? 'ledger-amount-negative' : 'ledger-amount-zero';
  const amountText = (entry.amount > 0 ? '+' : '') + formatPp(entry.amount);
  return `
    <tr>
      <td>${formatLedgerDate(entry.created_at)}</td>
      <td>${escapeHtml(entry.username)}</td>
      <td>${entry.counterparty ? escapeHtml(entry.counterparty) : '-'}</td>
      <td>${typeLabel}</td>
      <td>${entry.detail ? escapeHtml(entry.detail) : '-'}</td>
      <td class="${amountClass}">${amountText}</td>
      <td class="ledger-balance">${formatPp(entry.balance_after)}</td>
    </tr>
  `;
}

function renderPurchaseLogsTable() {
  $('#purchaseLogsTableBody').innerHTML = purchaseLogsEntries.map(renderPurchaseLogRow).join('');
  $('#purchaseLogsEmptyNote').classList.toggle('hidden', purchaseLogsEntries.length > 0);
}

async function loadPurchaseLogsGlobal() {
  if (!session || !session.token || !hasPerm('global.logs')) return;
  $('#purchaseLogsUserSearchInput').value = '';
  $('#purchaseLogsScopeNote').textContent = 'Legutóbbi 100 bejegyzés (globális, minden játékos).';
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/logs', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    purchaseLogsEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    purchaseLogsEntries = [];
  }
  renderPurchaseLogsTable();
}

async function loadPurchaseLogsForUser(username) {
  if (!session || !session.token || !hasPerm('global.logs') || !username) return;
  $('#purchaseLogsScopeNote').textContent = `"${username}" legutóbbi 100 bejegyzése.`;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/logs/' + encodeURIComponent(username), {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    purchaseLogsEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    purchaseLogsEntries = [];
  }
  renderPurchaseLogsTable();
}

$('#purchaseLogsUserSearchBtn').addEventListener('click', () => {
  const username = $('#purchaseLogsUserSearchInput').value.trim();
  if (username) loadPurchaseLogsForUser(username); else loadPurchaseLogsGlobal();
});
$('#purchaseLogsUserSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#purchaseLogsUserSearchBtn').click();
});
$('#purchaseLogsClearBtn').addEventListener('click', loadPurchaseLogsGlobal);

// ── Napló (admin) - staff-tevékenységek (ld. SolarBackend src/adminLog.js
// GET /api/admin/staff-action-logs[/:username]) - ugyanaz a minta, mint a
// fenti Vásárlás napló, csak "Összeg"/"Egyenleg utána" oszlopok nélkül
// (ezek a bejegyzések nem pénzösszeg-alapúak), és egy "Tevékenység"-címke
// térképpel (ADMIN_ACTION_LABELS) az "action" gépi kulcshoz. ──
const ADMIN_ACTION_LABELS = {
  'player.lock': 'Fiók zárolása', 'player.unlock': 'Zárolás feloldása',
  'player.ppAdjust': 'PrémiumPont módosítása', 'player.walletAdjust': 'Egyenleg módosítása',
  'player.casinoAdjust': 'Casino pörgetés módosítása', 'player.delete': 'Fiók törlése',
  'player.skinDelete': 'Skin törlése', 'player.skinBan': 'Skin tiltása',
  'player.capeDelete': 'Köpeny törlése', 'player.capeBan': 'Köpeny tiltása',
  'player.emailChange': 'Email módosítása', 'player.discordUnlink': 'Discord leválasztása',
  'device.ban': 'Eszköz tiltása', 'device.unban': 'Eszköz tiltásának feloldása',
  'badge.create': 'Jelvény létrehozása', 'badge.edit': 'Jelvény szerkesztése', 'badge.delete': 'Jelvény törlése',
  'badge.grant': 'Jelvény kiosztása', 'badge.revoke': 'Jelvény elvétele',
  'discount.create': 'Akció létrehozása', 'discount.edit': 'Akció szerkesztése', 'discount.delete': 'Akció törlése',
  'discount.playerSet': 'Egyedi kedvezmény beállítása', 'discount.playerRemove': 'Egyedi kedvezmény törlése',
  'coupon.create': 'Kupon létrehozása', 'coupon.edit': 'Kupon szerkesztése', 'coupon.delete': 'Kupon törlése',
  'creatorCode.create': 'Creator kód létrehozása', 'creatorCode.edit': 'Creator kód szerkesztése',
  'creatorCode.delete': 'Creator kód törlése', 'creatorCode.activate': 'Creator kód aktiválása',
  'creatorCode.deactivate': 'Creator kód inaktiválása', 'creatorCode.redeem': 'Creator kód beváltva regisztrációkor',
  'creatorCode.rankExpired': 'Creator kód rang-jutalma lejárt',
  'news.create': 'Felhívás létrehozása', 'news.edit': 'Felhívás szerkesztése', 'news.delete': 'Felhívás törlése',
  'discord.boost': 'Discord boost jóváírás'
};

let staffActionLogsEntries = [];

function renderStaffActionLogRow(entry) {
  const actionLabel = ADMIN_ACTION_LABELS[entry.action] || entry.action;
  return `
    <tr>
      <td>${formatLedgerDate(entry.created_at)}</td>
      <td>${entry.actor_username}</td>
      <td>${entry.target_username || '-'}</td>
      <td>${actionLabel}</td>
      <td>${entry.detail || '-'}</td>
    </tr>
  `;
}

function renderStaffActionLogsTable() {
  $('#staffActionLogsTableBody').innerHTML = staffActionLogsEntries.map(renderStaffActionLogRow).join('');
  $('#staffActionLogsEmptyNote').classList.toggle('hidden', staffActionLogsEntries.length > 0);
}

async function loadStaffActionLogsGlobal() {
  if (!session || !session.token || !hasPerm('global.staffActionLogs')) return;
  $('#staffActionLogsUserSearchInput').value = '';
  $('#staffActionLogsScopeNote').textContent = 'Legutóbbi 100 bejegyzés (globális, minden staff-tevékenység).';
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/staff-action-logs', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    staffActionLogsEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    staffActionLogsEntries = [];
  }
  renderStaffActionLogsTable();
}

async function loadStaffActionLogsForUser(username) {
  if (!session || !session.token || !hasPerm('global.staffActionLogs') || !username) return;
  $('#staffActionLogsScopeNote').textContent = `"${username}" legutóbbi 100 bejegyzése.`;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/staff-action-logs/' + encodeURIComponent(username), {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    staffActionLogsEntries = data.ok && Array.isArray(data.entries) ? data.entries : [];
  } catch {
    staffActionLogsEntries = [];
  }
  renderStaffActionLogsTable();
}

$('#staffActionLogsUserSearchBtn').addEventListener('click', () => {
  const username = $('#staffActionLogsUserSearchInput').value.trim();
  if (username) loadStaffActionLogsForUser(username); else loadStaffActionLogsGlobal();
});
$('#staffActionLogsUserSearchInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#staffActionLogsUserSearchBtn').click();
});
$('#staffActionLogsClearBtn').addEventListener('click', loadStaffActionLogsGlobal);
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
          <div class="revenue-month-amount">${hasData ? formatHuf(entry.totalHuf) : (isFuture ? '-' : '0 Ft')}</div>
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

// ── Formázott szöveg eszköztár (Felhívások cím/tartalom) - a felhasználó
// kifejezett kérésére: félkövér/dőlt/aláhúzott/méret/szín/igazítás. A
// document.execCommand ELAVULT API, de Electronban/Chromiumban (a
// SolarCenter itt egyetlen, ismert rendermotoron fut, nincs böngésző-
// kompatibilitási kockázat) még megbízhatóan működik erre az egyszerű,
// belső admin-eszközre - a kimeneti HTML-t a SolarBackend (src/news.js
// sanitize-html) szigorúan tisztítja mentés előtt, függetlenül attól, hogy
// execCommand pontosan milyen jelölést generál.
//
// JAVÍTVA (ismert execCommand+eszköztár csapda): egy eszköztár-gombra
// kattintva a böngésző ALAPÉRTELMEZETTEN elveszi a fókuszt (és vele a
// szövegkijelölést) a contenteditable mezőtől, MIELŐTT a click-handler
// lefutna - ezért a gombokon mousedown-kor preventDefault()-tal
// megakadályozzuk a fókuszváltást, a színválasztó/méret legördülő viszont
// natívan MUSZÁJ hogy fókuszt kapjon (ott nem lehet preventDefault-olni) -
// ezeknél a KIJELÖLÉST magát mentjük el/állítjuk vissza kézzel.
let richTextSavedRange = null;
let richTextSavedEditable = null;

function saveRichTextSelection(editable) {
  const sel = window.getSelection();
  if (sel.rangeCount > 0 && editable.contains(sel.anchorNode)) {
    richTextSavedRange = sel.getRangeAt(0).cloneRange();
    richTextSavedEditable = editable;
  }
}

function restoreRichTextSelection() {
  if (!richTextSavedRange || !richTextSavedEditable) return;
  richTextSavedEditable.focus();
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(richTextSavedRange);
}

function initRichTextToolbar(toolbarEl, editableEl) {
  editableEl.addEventListener('mouseup', () => saveRichTextSelection(editableEl));
  editableEl.addEventListener('keyup', () => saveRichTextSelection(editableEl));
  editableEl.addEventListener('focus', () => saveRichTextSelection(editableEl));

  toolbarEl.querySelectorAll('button[data-rt-cmd]').forEach((btn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      restoreRichTextSelection();
      document.execCommand(btn.dataset.rtCmd, false, null);
      saveRichTextSelection(editableEl);
    });
  });

  const sizeSelect = toolbarEl.querySelector('select[data-rt-cmd="fontSize"]');
  if (sizeSelect) {
    sizeSelect.addEventListener('mousedown', () => saveRichTextSelection(editableEl));
    sizeSelect.addEventListener('change', () => {
      if (!sizeSelect.value) return;
      restoreRichTextSelection();
      document.execCommand('fontSize', false, sizeSelect.value);
      saveRichTextSelection(editableEl);
      sizeSelect.value = '';
    });
  }

  const colorInput = toolbarEl.querySelector('input[type="color"][data-rt-cmd="foreColor"]');
  if (colorInput) {
    colorInput.addEventListener('mousedown', () => saveRichTextSelection(editableEl));
    colorInput.addEventListener('input', () => {
      restoreRichTextSelection();
      document.execCommand('foreColor', false, colorInput.value);
      saveRichTextSelection(editableEl);
    });
  }
}

initRichTextToolbar($('#newsTitleToolbar'), $('#newsTitleInput'));
initRichTextToolbar($('#newsContentToolbar'), $('#newsContentInput'));

function resetNewsForm() {
  newsEditingId = null;
  newsSelectedImageFile = null;
  newsRemoveExistingImage = false;
  $('#newsFormTitle').textContent = 'Új felhívás';
  $('#newsTitleInput').innerHTML = '';
  $('#newsContentInput').innerHTML = '';
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
          <div class="news-admin-item-title">${n.title}</div>
          <div class="news-admin-item-meta">${escapeHtml(n.created_by)} - ${formatLedgerDate(n.created_at)}${n.updated_at ? ' (szerkesztve: ' + formatLedgerDate(n.updated_at) + ')' : ''}</div>
        </div>
        <div class="news-admin-item-actions">
          <button type="button" class="news-edit-btn" data-news-id="${n.id}">Szerkesztés</button>
          <button type="button" class="news-delete-btn" data-news-id="${n.id}">Törlés</button>
        </div>
      </div>
      <p class="news-admin-item-content">${n.content}</p>
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
  // ÚJ: a cím/tartalom mostantól formázott (contenteditable) mező - a
  // MENTETT érték a teljes innerHTML (a formázás is benne marad, a backend
  // sanitize-html-je tisztítja végleg, ld. SolarBackend src/news.js), de az
  // "üres-e" ELLENŐRZÉS a textContent alapján történik, mert egy puszta
  // "<br>"-t (üres sor) NEM szabad érvényes címnek/tartalomnak elfogadni.
  const titleEl = $('#newsTitleInput');
  const contentEl = $('#newsContentInput');
  const title = titleEl.innerHTML.trim();
  const content = contentEl.innerHTML.trim();
  if (!titleEl.textContent.trim() || !contentEl.textContent.trim()) {
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
  const editBtn = e.target.closest('.news-edit-btn[data-news-id]');
  if (editBtn) {
    const item = newsAdminItems.find((n) => String(n.id) === editBtn.dataset.newsId);
    if (!item) return;
    newsEditingId = item.id;
    newsSelectedImageFile = null;
    newsRemoveExistingImage = false;
    $('#newsImageInput').value = '';
    $('#newsFormTitle').textContent = 'Felhívás szerkesztése';
    $('#newsTitleInput').innerHTML = item.title;
    $('#newsContentInput').innerHTML = item.content;
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
  const deleteBtn = e.target.closest('.news-delete-btn[data-news-id]');
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
  sel.innerHTML = `<option value="">- Bárki beválthatja -</option>${rankOptions}`;
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

// ── Creator kódok (admin, ld. SolarBackend src/creatorCodes.js) - ugyanaz a
// CRUD-minta, mint a fenti Kuponok, plusz egy aktivál/inaktivál gyorsgomb
// (a felhasználó kifejezett kérésére: "ha valaki megszűntetné velünk a
// kapcsolatot és később vissza jönne akkor tudjuk újra aktiválni") és egy
// "kik regisztráltak" részletező modál. ──
let creatorCodeEditingId = null;
let creatorCodesAdminItems = [];

function resetCreatorCodeForm() {
  creatorCodeEditingId = null;
  $('#creatorCodeFormTitle').textContent = 'Új creator kód';
  $('#creatorCodeCodeInput').value = '';
  $('#creatorCodeLabelInput').value = '';
  $('#creatorCodeRewardTypeSelect').value = 'none';
  $('#creatorCodeRewardAmountInput').value = '';
  $('#creatorCodeDurationInput').value = '';
  $('#creatorCodeValidFromInput').value = '';
  $('#creatorCodeValidUntilInput').value = '';
  $('#creatorCodeActiveCheckbox').checked = true;
  $('#creatorCodeFormResult').textContent = '';
  $('#creatorCodeFormResult').className = 'redeem-result';
  $('#creatorCodeSaveBtn').textContent = 'Mentés';
  populateCreatorCodeRankSelect();
  updateCreatorCodeRewardRowVisibility();
}

// A "shopRanks" globális tömböt használja (ld. loadRanks - MÁR betöltődik
// oldalbetöltéskor) - ugyanaz a minta, mint populateCouponRequiredRankSelect().
function populateCreatorCodeRankSelect(selectedId) {
  const sel = $('#creatorCodeRewardRankSelect');
  sel.innerHTML = shopRanks.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join('');
  sel.value = selectedId || (shopRanks[0] ? shopRanks[0].id : '');
}

function updateCreatorCodeRewardRowVisibility() {
  const type = $('#creatorCodeRewardTypeSelect').value;
  $('#creatorCodeAmountRow').classList.toggle('hidden', type !== 'pp' && type !== 'wallet');
  $('#creatorCodeRankRow').classList.toggle('hidden', type !== 'rank');
}
$('#creatorCodeRewardTypeSelect').addEventListener('change', updateCreatorCodeRewardRowVisibility);

function creatorCodeRewardLabel(c) {
  if (c.reward_type === 'pp') return `${formatPp(c.reward_amount)} PP`;
  if (c.reward_type === 'wallet') return `${formatHuf(c.reward_amount)} egyenleg`;
  if (c.reward_type === 'rank') {
    const rank = shopRanks.find((r) => r.id === c.reward_rank);
    const rankLabel = rank ? rank.label : c.reward_rank;
    return c.reward_duration_days ? `${rankLabel} rang (${c.reward_duration_days} napig)` : `${rankLabel} rang (végleges)`;
  }
  return 'Nincs jutalom';
}

function renderCreatorCodesAdminList() {
  $('#creatorCodesAdminList').innerHTML = creatorCodesAdminItems.map((c) => {
    const notStarted = c.valid_from && new Date(c.valid_from).getTime() > Date.now();
    const expired = c.valid_until && new Date(c.valid_until).getTime() <= Date.now();
    const statusText = !c.active ? 'Kikapcsolva' : expired ? 'Lejárt' : notStarted ? 'Még nem aktív' : 'Aktív';
    const statusClass = c.active && !expired && !notStarted ? 'discount-status-on' : 'discount-status-off';
    const windowParts = [];
    if (c.valid_from) windowParts.push('érvényes ettől: ' + formatLedgerDate(c.valid_from));
    if (c.valid_until) windowParts.push('érvényes eddig: ' + formatLedgerDate(c.valid_until));
    const metaParts = [creatorCodeRewardLabel(c), `${c.redemptionCount} regisztráció`, ...windowParts];
    return `
    <div class="badges-admin-item">
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">${escapeHtml(c.code)}${c.creator_label ? ' - ' + escapeHtml(c.creator_label) : ''}</div>
        <div class="badges-admin-item-meta">${metaParts.join(' - ')} - <span class="${statusClass}">${statusText}</span></div>
      </div>
      <div class="badges-admin-item-actions">
        <button type="button" class="news-edit-btn" data-cc-redemptions-id="${c.id}">Regisztráltak</button>
        <button type="button" class="news-edit-btn" data-cc-toggle-id="${c.id}">${c.active ? 'Inaktiválás' : 'Aktiválás'}</button>
        <button type="button" class="news-edit-btn" data-cc-edit-id="${c.id}">Szerkesztés</button>
        <button type="button" class="news-delete-btn" data-cc-delete-id="${c.id}">Törlés</button>
      </div>
    </div>
  `;
  }).join('') || '<p class="redeem-result">Még nincs egyetlen creator kód sem.</p>';
}

async function loadCreatorCodesAdmin() {
  if (!session || !session.token || !hasPerm('global.creatorCodesManage')) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/creator-codes', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    creatorCodesAdminItems = data.ok && Array.isArray(data.codes) ? data.codes : [];
  } catch {
    creatorCodesAdminItems = [];
  }
  renderCreatorCodesAdminList();
}

$('#creatorCodeDiscardBtn').addEventListener('click', resetCreatorCodeForm);

$('#creatorCodeSaveBtn').addEventListener('click', async () => {
  const resultEl = $('#creatorCodeFormResult');
  const code = $('#creatorCodeCodeInput').value.trim();
  const creatorLabel = $('#creatorCodeLabelInput').value.trim() || undefined;
  const rewardType = $('#creatorCodeRewardTypeSelect').value;
  const rewardAmount = (rewardType === 'pp' || rewardType === 'wallet') ? Number($('#creatorCodeRewardAmountInput').value) : undefined;
  const rewardRank = rewardType === 'rank' ? $('#creatorCodeRewardRankSelect').value : undefined;
  const durationRaw = $('#creatorCodeDurationInput').value;
  const rewardDurationDays = rewardType === 'rank' && durationRaw ? Number(durationRaw) : undefined;
  const validFrom = $('#creatorCodeValidFromInput').value || undefined;
  const validUntil = $('#creatorCodeValidUntilInput').value || undefined;
  const active = $('#creatorCodeActiveCheckbox').checked;

  if (!code) { resultEl.textContent = 'Adj meg egy kódot.'; resultEl.className = 'redeem-result error'; return; }
  if ((rewardType === 'pp' || rewardType === 'wallet') && (!Number.isInteger(rewardAmount) || rewardAmount < 1)) {
    resultEl.textContent = 'Adj meg egy érvényes jutalom-mennyiséget.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (rewardType === 'rank' && !rewardRank) {
    resultEl.textContent = 'Válassz egy rangot.';
    resultEl.className = 'redeem-result error';
    return;
  }

  try {
    const url = creatorCodeEditingId ? BACKEND_URL + '/api/admin/creator-codes/' + creatorCodeEditingId : BACKEND_URL + '/api/admin/creator-codes';
    const res = await fetch(url, {
      method: creatorCodeEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ code, creatorLabel, rewardType, rewardAmount, rewardRank, rewardDurationDays, validFrom, validUntil, active })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast(creatorCodeEditingId ? 'Creator kód frissítve.' : 'Creator kód létrehozva.');
    resetCreatorCodeForm();
    loadCreatorCodesAdmin();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

function renderCreatorCodeRedemptionsList(redemptions) {
  $('#creatorCodeRedemptionsList').innerHTML = redemptions.map((r) => `
    <div class="badges-admin-item">
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">${escapeHtml(r.username)}</div>
        <div class="badges-admin-item-meta">${formatLedgerDate(r.redeemed_at)}${r.rank_expires_at ? (r.reverted ? ' - rang lejárt' : ' - rang lejár: ' + formatLedgerDate(r.rank_expires_at)) : ''}</div>
      </div>
    </div>
  `).join('') || '<p class="redeem-result">Ezzel a kóddal még senki nem regisztrált.</p>';
}

async function openCreatorCodeRedemptions(id) {
  const item = creatorCodesAdminItems.find((c) => String(c.id) === String(id));
  $('#creatorCodeRedemptionsTitle').textContent = item ? `Regisztráltak - ${item.code}` : 'Regisztráltak';
  $('#creatorCodeRedemptionsList').innerHTML = '<p class="redeem-result">Betöltés...</p>';
  $('#creatorCodeRedemptionsModal').classList.remove('hidden');
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/creator-codes/' + id + '/redemptions', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    renderCreatorCodeRedemptionsList(data.ok && Array.isArray(data.redemptions) ? data.redemptions : []);
  } catch {
    $('#creatorCodeRedemptionsList').innerHTML = '<p class="redeem-result error">Nem sikerült elérni a szervert.</p>';
  }
}
$('#creatorCodeRedemptionsClose').addEventListener('click', () => $('#creatorCodeRedemptionsModal').classList.add('hidden'));

document.addEventListener('click', (e) => {
  const redemptionsBtn = e.target.closest('[data-cc-redemptions-id]');
  if (redemptionsBtn) {
    openCreatorCodeRedemptions(redemptionsBtn.dataset.ccRedemptionsId);
    return;
  }

  const toggleBtn = e.target.closest('[data-cc-toggle-id]');
  if (toggleBtn) {
    const id = toggleBtn.dataset.ccToggleId;
    fetch(BACKEND_URL + '/api/admin/creator-codes/' + id + '/toggle-active', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token }
    }).then((res) => res.json()).then((data) => {
      if (data.ok) {
        showToast(data.code.active ? 'Creator kód aktiválva.' : 'Creator kód inaktiválva.');
        loadCreatorCodesAdmin();
      } else {
        showToast('Nem sikerült módosítani.', true);
      }
    }).catch(() => showToast('Nem sikerült elérni a szervert.', true));
    return;
  }

  const editBtn = e.target.closest('[data-cc-edit-id]');
  if (editBtn) {
    const item = creatorCodesAdminItems.find((c) => String(c.id) === editBtn.dataset.ccEditId);
    if (!item) return;
    creatorCodeEditingId = item.id;
    $('#creatorCodeFormTitle').textContent = 'Creator kód szerkesztése';
    $('#creatorCodeCodeInput').value = item.code;
    $('#creatorCodeLabelInput').value = item.creator_label || '';
    $('#creatorCodeRewardTypeSelect').value = item.reward_type;
    $('#creatorCodeRewardAmountInput').value = item.reward_amount !== null ? item.reward_amount : '';
    $('#creatorCodeDurationInput').value = item.reward_duration_days !== null ? item.reward_duration_days : '';
    populateCreatorCodeRankSelect(item.reward_rank);
    updateCreatorCodeRewardRowVisibility();
    // ÚJ: a dátum-input "ÉÉÉÉ-HH-NN" alakot vár - a backend teljes ISO
    // dátumidőt ad vissza (ld. creatorCodes.js normalizálását), ebből csak a
    // dátumrészt vágjuk ki.
    $('#creatorCodeValidFromInput').value = item.valid_from ? item.valid_from.slice(0, 10) : '';
    $('#creatorCodeValidUntilInput').value = item.valid_until ? item.valid_until.slice(0, 10) : '';
    $('#creatorCodeActiveCheckbox').checked = item.active === 1;
    $('#creatorCodeSaveBtn').textContent = 'Frissítés';
    $('#creatorCodeFormResult').textContent = '';
    return;
  }

  const deleteBtn = e.target.closest('[data-cc-delete-id]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.ccDeleteId;
    confirmModal('Creator kód törlése', 'Biztosan törlöd ezt a creator kódot? Ez nem vonható vissza.', 'Igen, törlés').then((confirmed) => {
      if (!confirmed) return;
      fetch(BACKEND_URL + '/api/admin/creator-codes/' + id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      }).then((res) => res.json()).then((data) => {
        if (data.ok) {
          showToast('Creator kód törölve.');
          if (String(creatorCodeEditingId) === String(id)) resetCreatorCodeForm();
          loadCreatorCodesAdmin();
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
    <div class="player-card" data-username="${escapeHtml(p.username)}">
      <canvas class="player-card-canvas" data-idx="${i}" width="40" height="40"></canvas>
      <div class="player-card-info">
        <div class="player-card-label">Név</div>
        <div class="player-card-name">${escapeHtml(p.username)}</div>
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
      // A felhívás képe TARTALOM, nem dekoráció - ezért leíró alt-ot kap (a
      // hír címéből), nem üres stringet. Az üres alt ott a helyes megoldás,
      // ahol az ikon KÖZVETLENÜL a saját, látszó felirata mellett áll (pl.
      // jelvény-chipek, rang-ikonok): ott egy leíró alt kétszer olvastatná
      // fel ugyanazt a képernyőolvasóval.
      imageEl.alt = 'A(z) „' + String(news.title || 'legfrissebb hír').replace(/<[^>]*>/g, '') + '” felhíváshoz csatolt kép';
      imageEl.classList.remove('hidden');
    } else {
      imageEl.classList.add('hidden');
      imageEl.src = '';
    }
    // ÚJ: a cím/tartalom mostantól formázott (a backend sanitize-html-je
    // által tisztított) HTML lehet - innerHTML-lel jelenítjük meg, hogy a
    // félkövér/dőlt/szín/igazítás stb. ténylegesen látszódjon, nem csak
    // nyers szövegként a tag-ekkel együtt.
    $('#homeNewsTitle').innerHTML = news.title;
    $('#homeNewsMeta').textContent = formatLedgerDate(news.created_at);
    $('#homeNewsContent').innerHTML = news.content;
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
      <div class="player-card" data-username="${escapeHtml(f.username)}">
        <canvas class="player-card-canvas" data-idx="${i}" width="40" height="40"></canvas>
        <div class="player-card-info">
          <div class="player-card-label">Név</div>
          <div class="player-card-name friend-card-name ${f.online ? 'online' : ''}">${escapeHtml(f.username)}</div>
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
      <p><b>${escapeHtml(gift.from)}</b> ajándékozott neked ${giftItemLabel(gift)}.</p>
      ${gift.gift_message ? `<p class="gift-message">„${escapeHtml(gift.gift_message)}”</p>` : ''}
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

// ══════════════════════════════════════════════════════════════════════════
// LÁTOGATOTTSÁG (admin) - ld. SolarBackend src/analytics.js
// ══════════════════════════════════════════════════════════════════════════
// A SAJÁT, névtelen mérésünk összesítője. Nincs benne IP, felhasználónév,
// sem ujjlenyomat: a látogató-azonosító a szerveren naponta forgó kulccsal
// hashelt, ezért NAPOK KÖZÖTT szándékosan nem fűzhető össze. Emiatt az
// "egyedi látogató" csak NAPON BELÜL értelmes szám - az időszakra vetített
// összeg nem egyedi látogatók száma, hanem "látogatónapok" (aki két napon
// járt itt, kétszer számít); a felület is így nevezi meg, hogy ne lehessen
// félreolvasni.
let analyticsDays = 7;

async function loadAnalytics() {
  const chart = $('#analyticsChart');
  const empty = $('#analyticsEmpty');
  if (!session || !session.token) return;

  // Csontváz-betöltés: a lekérés a szerveren összesít, ami néhány száz
  // ezer sornál is gyors, de a hálózat lassú lehet - ne ugráljon az
  // elrendezés, amíg megjön az adat (ld. ui.css .skeleton).
  chart.innerHTML = '<div class="skeleton" style="width:100%;height:100%;border-radius:10px;"></div>';

  let data = null;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/analytics/summary?days=' + analyticsDays, {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    data = await res.json();
  } catch {
    data = null;
  }
  if (!data || !data.ok) {
    chart.innerHTML = '';
    empty.textContent = 'Nem sikerült lekérni a látogatottsági adatokat.';
    empty.classList.remove('hidden');
    return;
  }

  // ── Összesítő csempék ──
  $('#analyticsSummary').innerHTML = [
    ['Oldalmegtekintés', formatHuNumber(data.totals.views)],
    ['Látogatónap', formatHuNumber(data.totals.visitorDays)],
    ['Átlagos időtöltés', formatAnalyticsDuration(data.totals.avgSeconds)]
  ].map(([label, value]) => `
    <div class="stat-badge">
      <div>
        <div class="stat-badge-label">${label}</div>
        <div class="stat-badge-value">${escapeHtml(String(value))}</div>
      </div>
    </div>
  `).join('');

  // ── Napi oszlopdiagram ──
  const daily = Array.isArray(data.daily) ? data.daily : [];
  empty.classList.toggle('hidden', daily.length > 0);
  empty.textContent = 'Erre az időszakra még nincs adat.';
  const max = daily.reduce((m, d) => Math.max(m, d.visitors), 0) || 1;
  // Legfeljebb ~10 dátumfelirat fér ki olvashatóan, akármilyen hosszú az
  // időszak - ezért csak minden n-edik oszlop alá írunk ki dátumot.
  const step = Math.max(1, Math.ceil(daily.length / 10));
  chart.innerHTML = daily.map((d, i) => {
    const pct = Math.max(2, Math.round((d.visitors / max) * 100));
    const label = i % step === 0 ? `<small>${escapeHtml(d.day.slice(5))}</small>` : '';
    // A "title" adja a rátét-buborékot: itt jelenik meg a megtekintés-szám
    // is, amit szándékosan nem külön oszlopsorként rajzolunk ki.
    const tip = `${d.day}: ${d.visitors} látogató, ${d.views} megtekintés`;
    return `<div class="analytics-bar" title="${escapeHtml(tip)}"><i style="height:${pct}%"></i>${label}</div>`;
  }).join('');

  // ── Rangsorolt listák ──
  renderAnalyticsRows('#analyticsPaths', data.topPaths, (r) => r.path === '/egyeb' ? 'egyéb / ismeretlen' : r.path, (r) => r.views, 'megtekintés');
  renderAnalyticsRows('#analyticsDevices', data.devices, (r) => r.device, (r) => r.visitors, '');
  renderAnalyticsRows('#analyticsRefs', data.referrers, (r) => r.ref.replace(/^https?:\/\//, ''), (r) => r.visitors, '');
}

// Egy rangsorolt lista: a sáv szélessége a legnagyobb elemhez viszonyít
// (nem az összeghez) - így a második-harmadik helyezett is látható marad,
// nem lapul észrevehetetlenné egy domináns első mellett.
function renderAnalyticsRows(sel, rows, labelOf, valueOf, unit) {
  const el = $(sel);
  if (!el) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) { el.innerHTML = '<p class="analytics-row-empty">Még nincs adat.</p>'; return; }
  const max = list.reduce((m, r) => Math.max(m, valueOf(r)), 0) || 1;
  el.innerHTML = list.map((r) => {
    const v = valueOf(r);
    return `<div class="analytics-row" style="--pct:${Math.round((v / max) * 100)}%">
      <span title="${escapeHtml(String(labelOf(r)))}">${escapeHtml(String(labelOf(r)))}</span>
      <b>${formatHuNumber(v)}${unit ? ' ' + unit : ''}</b>
    </div>`;
  }).join('');
}

function formatHuNumber(n) {
  return Number(n || 0).toLocaleString('hu-HU');
}
function formatAnalyticsDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 60) return s + ' mp';
  const m = Math.floor(s / 60);
  return m + ' p ' + (s % 60) + ' mp';
}

$$('[data-analytics-days]').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('[data-analytics-days]').forEach((b) => b.classList.toggle('active', b === btn));
    analyticsDays = parseInt(btn.dataset.analyticsDays, 10) || 7;
    loadAnalytics();
  });
});

// ── Süti beállítások ──
// ÁTKÖLTÖZTETVE (2026-09-03): a korábbi, egyetlen "analytics" jelölőnégyzetet
// mentő blokk innen a ui.js initCookies()-ába került. Ok: a süti-kezelés
// mostantól nem egyetlen elmentett érték, hanem teljes hozzájárulás-lánc -
// első látogatáskori sáv, három kategória, verziózott tárolás, és ami a
// lényeg: VALÓDI következmény (a Discord-widget iframe-je be sem töltődik,
// amíg nincs rá engedély, ld. ui.js loadEmbed). Mivel ennek nincs egyetlen
// backend-hívása sem, a megjelenítési réteg (ui.js) a helye. Itt csak ez a
// jelzés maradt, hogy ne induljon fölösleges keresés a régi kód után.

// ══════════════════════════════════════════════════════════════════════════
// KIEGÉSZÍTŐK + PIAC (ld. SolarBackend src/cosmetics.js)
// ══════════════════════════════════════════════════════════════════════════
// Három nézet: a saját kiegészítők (fel/levétel + katalógus-vásárlás), a
// játékosok közti piac, és az admin katalógus-kezelés. A megjelenítés
// in-game teljesen kliens-oldali (a SolarClient a /api/cosmetics/loadout/
// :username végpontról olvas), ezért itt semmilyen Minecraft-szerver felé
// menő szinkronra nincs szükség - amit itt elmentünk, azt a kliens a
// következő gyorsítótár-frissítésekor látja.

const RARITY_LABELS = { common: 'Általános', rare: 'Ritka', epic: 'Epikus', legendary: 'Legendás', mythic: 'Mítikus' };

function cosmeticTextureUrl(id) {
  return BACKEND_URL + '/api/cosmetics/texture/' + id;
}

function cosmeticModelUrl(id) {
  return BACKEND_URL + '/api/cosmetics/model/' + id;
}

// ── 3D bélyegképek ───────────────────────────────────────────────────────
// A kiegészítő bélyegképe a TÉNYLEGES 3D modell, a saját textúrájával
// kirenderelve - nem a nyers textúra-atlasz (abból egy szárny/sapka alakja
// nem olvasható ki). A renderelés egyetlen, megosztott WebGL-kontextusban
// történik (ld. skin3d.js renderCosmeticThumbnail megjegyzését arról, miért
// nem kártyánként élő vászon), és az eredmény ITT is gyorsítótárazódik, hogy
// egy nézet-váltás ne rajzoltassa újra ugyanazt.
const cosmeticThumbCache = new Map();

function cosmeticThumbHtml(c) {
  const cached = cosmeticThumbCache.get(c.id);
  // A bélyegkép nem mindig áll a neve mellett (pl. napló-sorokban önmagában
  // szerepel), ezért leíró alt-ot kap - ld. a loadHomeNews-nál írt indoklást
  // arról, mikor helyes az üres alt és mikor nem.
  if (cached) return `<img class="cosmetic-thumb" src="${cached}" alt="${escapeHtml(c.name || 'Kiegészítő')} előnézeti képe" />`;
  // Amíg elkészül, a helyőrző marad - a hydrateCosmeticThumbs() tölti fel.
  return `<div class="cosmetic-thumb cosmetic-thumb-empty" data-cosmetic-thumb="${c.id}" data-cosmetic-name="${escapeHtml(c.name || '')}"></div>`;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const cosmeticModelCache = new Map();
async function fetchCosmeticModel(id) {
  if (cosmeticModelCache.has(id)) return cosmeticModelCache.get(id);
  try {
    const res = await fetch(cosmeticModelUrl(id));
    if (!res.ok) return null;
    const model = await res.json();
    cosmeticModelCache.set(id, model);
    return model;
  } catch {
    return null;
  }
}

// A még üres bélyegkép-helyőrzők feltöltése. SOROSAN fut (nem párhuzamosan):
// a megosztott WebGL-kontextus egyszerre egy modellt tud rajzolni, és így a
// kártyák szép sorban, felülről lefelé jelennek meg.
async function hydrateCosmeticThumbs(root) {
  const slots = [...(root || document).querySelectorAll('[data-cosmetic-thumb]')];
  for (const el of slots) {
    const id = Number(el.dataset.cosmeticThumb);
    if (!Number.isInteger(id)) continue;
    if (cosmeticThumbCache.has(id)) {
      replaceThumb(el, cosmeticThumbCache.get(id));
      continue;
    }
    const [model, img] = await Promise.all([fetchCosmeticModel(id), loadImage(cosmeticTextureUrl(id))]);
    if (!model || !img) continue;
    const url = SkinPreview.renderCosmeticThumbnail(model, img, 160);
    if (!url) continue;
    cosmeticThumbCache.set(id, url);
    replaceThumb(el, url);
  }
}

function replaceThumb(el, url) {
  if (!el.parentNode) return;
  const img = document.createElement('img');
  img.className = 'cosmetic-thumb';
  img.src = url;
  // A nevet a helyőrző data-attribútuma őrizte meg (ld. cosmeticThumbHtml),
  // így a később kirajzolt kép is ugyanazt a leíró alt szöveget kapja, mint
  // a gyorsítótárból azonnal visszaadott változat.
  img.alt = (el.dataset.cosmeticName || 'Kiegészítő') + ' előnézeti képe';
  el.parentNode.replaceChild(img, el);
}

function cosmeticExpiryHtml(expiresAt) {
  if (!expiresAt) return '<span class="cosmetic-meta-perm">Örökre a tiéd</span>';
  const ms = new Date(expiresAt.replace(' ', 'T') + 'Z').getTime() - Date.now();
  if (Number.isNaN(ms)) return '';
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return `<span class="cosmetic-meta-temp">Még ${days} nap</span>`;
  const hours = Math.max(0, Math.floor(ms / 3600000));
  return `<span class="cosmetic-meta-temp">Még ${hours} óra</span>`;
}

// ── Saját kiegészítők ────────────────────────────────────────────────────
let myCosmetics = { owned: [], loadout: {}, slots: [] };
let cosmeticShopItems = [];

async function loadMyCosmetics() {
  if (!session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/mine', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    myCosmetics = data.ok ? { owned: data.owned || [], loadout: data.loadout || {}, slots: data.slots || [] } : { owned: [], loadout: {}, slots: [] };
  } catch {
    myCosmetics = { owned: [], loadout: {}, slots: [] };
  }
  renderCosmeticSlotBar();
  renderOwnedCosmetics();
  loadCosmeticShop();
  renderCosmeticCharacterPreview();
}

// ── "Így nézel ki" előnézet ──────────────────────────────────────────────
// A ténylegesen VISELT kiegészítők a karakteren, ugyanazzal a
// transzformáció-lánccal, amit a SolarClient is használ (ld. skin3d.js
// buildCosmeticGeometry levezetését). A saját skined jelenik meg rajta, ha
// van feltöltve - ha nincs, egy alapértelmezett "Steve" karakter.
let stopCosmeticCharPreview = null;

async function renderCosmeticCharacterPreview() {
  const canvas = $('#cosmeticCharPreview');
  if (!canvas) return;

  if (stopCosmeticCharPreview) { stopCosmeticCharPreview(); stopCosmeticCharPreview = null; }

  const equippedIds = Object.values(myCosmetics.loadout || {});
  const hint = $('#cosmeticCharPreviewHint');
  if (hint) {
    hint.textContent = equippedIds.length
      ? 'Húzással forgatható'
      : 'Vegyél fel egy kiegészítőt, és itt látod, hogy néz ki rajtad.';
  }

  const skinImg = await loadSkinImage(session.username) || await SkinPreview.getSteveImage();
  if (!skinImg) return;

  const capeImg = await loadCapeImageOrNull();

  const cosmetics = [];
  for (const [slot, id] of Object.entries(myCosmetics.loadout || {})) {
    const [model, img] = await Promise.all([fetchCosmeticModel(id), loadImage(cosmeticTextureUrl(id))]);
    if (model && img) cosmetics.push({ model, slot, img });
  }

  const slim = myCosmeticsSkinSlim();
  stopCosmeticCharPreview = SkinPreview.start(canvas, skinImg, slim, capeImg, cosmetics);
}

// A köpeny (ha van) - a 3D előnézet ezt is kirajzolja, hogy a kiegészítő és a
// köpeny együttes hatása is látszódjon.
function loadCapeImageOrNull() {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = BACKEND_URL + '/api/cape/' + encodeURIComponent(session.username) + '?t=' + Date.now();
  });
}

function myCosmeticsSkinSlim() {
  // A skin-nézet már ismeri a modell-választást; ha még nem töltött be,
  // a klasszikus (széles kar) az alapértelmezés - ugyanaz, mint a szerveren.
  const activePill = document.querySelector('.skin-model-toggle .pill.active');
  return !!(activePill && activePill.dataset.model === 'slim');
}

// A felső sáv slotonként mutatja, mit viselsz éppen - ez adja meg gyorsan a
// választ arra, amit a nézet elsődlegesen megválaszol ("mi van rajtam most").
function renderCosmeticSlotBar() {
  const bar = $('#cosmeticSlotBar');
  if (!bar) return;
  bar.innerHTML = myCosmetics.slots.map((slot) => {
    const equippedId = myCosmetics.loadout[slot.id];
    const c = myCosmetics.owned.find((o) => o.id === equippedId);
    return `
      <div class="cosmetic-slot ${c ? 'filled' : ''}">
        <div class="cosmetic-slot-label">${escapeHtml(slot.label)}</div>
        ${c ? `
          ${cosmeticThumbHtml(c)}
          <div class="cosmetic-slot-name">${escapeHtml(c.name)}</div>
          <button type="button" class="link-btn" data-cosmetic-unequip="${escapeHtml(slot.id)}">Levétel</button>
        ` : `
          <div class="cosmetic-thumb cosmetic-thumb-empty"></div>
          <div class="cosmetic-slot-name cosmetic-slot-empty">Nincs kiegészítő</div>
        `}
      </div>
    `;
  }).join('');
  hydrateCosmeticThumbs(bar);
}

function renderOwnedCosmetics() {
  const wrap = $('#cosmeticsOwnedWrap');
  if (!wrap) return;
  if (!myCosmetics.owned.length) {
    wrap.innerHTML = '<div class="card"><p class="redeem-result">Még nincs egyetlen kiegészítőd sem. Vásárolj a lenti kínálatból, vagy nézd meg a Piacot.</p></div>';
    return;
  }
  wrap.innerHTML = `<div class="cosmetic-grid">${myCosmetics.owned.map((c) => `
    <div class="cosmetic-card ${c.equipped ? 'equipped' : ''} rarity-${escapeHtml(c.rarity)}">
      ${cosmeticThumbHtml(c)}
      <div class="cosmetic-card-name">${escapeHtml(c.name)}</div>
      <div class="cosmetic-card-tags">
        <span class="cosmetic-tag">${escapeHtml(c.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}</span>
      </div>
      <div class="cosmetic-card-meta">${cosmeticExpiryHtml(c.expiresAt)}</div>
      ${c.equipped
        ? `<button type="button" class="btn-outline cosmetic-action" data-cosmetic-unequip="${escapeHtml(c.slot)}">Levétel</button>`
        : `<button type="button" class="btn-glow cosmetic-action" data-cosmetic-equip="${c.id}">Felvétel</button>`}
    </div>
  `).join('')}</div>`;
  hydrateCosmeticThumbs(wrap);
}

// A megvásárolható kínálat: a publikus katalógus mínusz amink már megvan.
async function loadCosmeticShop() {
  const wrap = $('#cosmeticsShopWrap');
  if (!wrap) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/catalog');
    const data = await res.json();
    cosmeticShopItems = data.ok ? (data.cosmetics || []) : [];
  } catch {
    cosmeticShopItems = [];
  }
  const ownedIds = new Set(myCosmetics.owned.map((c) => c.id));
  const buyable = cosmeticShopItems.filter((c) => c.priceSc !== null && c.priceSc !== undefined && !ownedIds.has(c.id) && c.hasModel);
  if (!buyable.length) {
    wrap.innerHTML = '<div class="card"><p class="redeem-result">Jelenleg nincs megvásárolható kiegészítő - nézd meg a Piacot, ott a játékosoktól is vehetsz.</p></div>';
    return;
  }
  wrap.innerHTML = `<div class="cosmetic-grid">${buyable.map((c) => `
    <div class="cosmetic-card rarity-${escapeHtml(c.rarity)}">
      ${cosmeticThumbHtml(c)}
      <div class="cosmetic-card-name">${escapeHtml(c.name)}</div>
      <div class="cosmetic-card-tags">
        <span class="cosmetic-tag">${escapeHtml(c.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}</span>
      </div>
      ${c.description ? `<div class="cosmetic-card-desc">${escapeHtml(c.description)}</div>` : ''}
      <div class="cosmetic-card-meta">${c.defaultDurationDays ? `<span class="cosmetic-meta-temp">${c.defaultDurationDays} napig</span>` : '<span class="cosmetic-meta-perm">Örökre</span>'}</div>
      <div class="cosmetic-card-price">${c.priceSc.toLocaleString('hu-HU')} PP</div>
      <button type="button" class="btn-glow cosmetic-action" data-cosmetic-buy="${c.id}">Megvásárlás</button>
    </div>
  `).join('')}</div>`;
  hydrateCosmeticThumbs(wrap);
}

document.addEventListener('click', async (e) => {
  const equipBtn = e.target.closest('[data-cosmetic-equip]');
  if (equipBtn) {
    equipBtn.disabled = true;
    try {
      const res = await fetch(BACKEND_URL + '/api/cosmetics/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ cosmeticId: Number(equipBtn.dataset.cosmeticEquip) })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült felvenni.', true); equipBtn.disabled = false; return; }
      showToast('Kiegészítő felvéve.');
      myCosmetics = { owned: data.owned || [], loadout: data.loadout || {}, slots: data.slots || [] };
      renderCosmeticSlotBar();
      renderOwnedCosmetics();
      loadCosmeticShop();
      renderCosmeticCharacterPreview();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
      equipBtn.disabled = false;
    }
    return;
  }

  const unequipBtn = e.target.closest('[data-cosmetic-unequip]');
  if (unequipBtn) {
    unequipBtn.disabled = true;
    try {
      const res = await fetch(BACKEND_URL + '/api/cosmetics/unequip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ slot: unequipBtn.dataset.cosmeticUnequip })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült levenni.', true); unequipBtn.disabled = false; return; }
      showToast('Kiegészítő levéve.');
      myCosmetics = { owned: data.owned || [], loadout: data.loadout || {}, slots: data.slots || [] };
      renderCosmeticSlotBar();
      renderOwnedCosmetics();
      renderCosmeticCharacterPreview();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
      unequipBtn.disabled = false;
    }
    return;
  }

  const buyBtn = e.target.closest('[data-cosmetic-buy]');
  if (buyBtn) {
    const item = cosmeticShopItems.find((c) => String(c.id) === buyBtn.dataset.cosmeticBuy);
    if (!item) return;
    // A tényleges PP-levonás a Minecraft-szerveren történik (ld. SolarBackend
    // src/cosmetics.js fejlécét) - ezt a késleltetést a megerősítő szövegben
    // is kimondjuk, hogy ne tűnjön hibának, ha nem jelenik meg azonnal.
    const confirmed = await confirmModal(
      'Kiegészítő megvásárlása',
      `Megveszed a(z) "${item.name}" kiegészítőt ${item.priceSc.toLocaleString('hu-HU')} PrémiumPontért? A levonás a következő szerverre lépésedkor történik meg, utána jelenik meg a kiegészítőid között.`,
      'Igen, megveszem'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/cosmetics/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ cosmeticId: item.id })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült megvásárolni.', true); return; }
      showToast(data.message || 'A vásárlás rögzítve.');
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  }
});

// ── Piac ─────────────────────────────────────────────────────────────────
let marketTaxPercent = 10;

async function loadMarket() {
  if (!session || !session.token) return;
  // A hirdetés-feladó legördülőhöz kell a saját, ELADHATÓ készletünk - ezért
  // a piac megnyitásakor a saját kiegészítőket is frissítjük.
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/mine', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) myCosmetics = { owned: data.owned || [], loadout: data.loadout || {}, slots: data.slots || [] };
  } catch {}

  renderMarketListForm();
  await Promise.all([loadMarketListings(), loadMyMarketListings()]);
}

function renderMarketListForm() {
  const select = $('#marketListCosmeticSelect');
  if (!select) return;
  const sellable = myCosmetics.owned.filter((c) => c.tradable);
  if (!sellable.length) {
    select.innerHTML = '<option value="">Nincs eladható kiegészítőd</option>';
    $('#marketListBtn').disabled = true;
  } else {
    select.innerHTML = sellable.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.slotLabel)})</option>`).join('');
    $('#marketListBtn').disabled = false;
  }
  updateMarketPayoutPreview();
}

// A 10% adó élő kiírása: az eladó pontosan lássa, mennyi jön be neki, MIELŐTT
// felteszi - ez a leggyakoribb félreértés-forrás egy jutalékos piacon.
function updateMarketPayoutPreview() {
  const el = $('#marketPayoutPreview');
  if (!el) return;
  const price = Number($('#marketListPriceInput').value);
  if (!Number.isInteger(price) || price < 1) { el.innerHTML = ''; return; }
  const payout = Math.floor(price * (100 - marketTaxPercent) / 100);
  el.innerHTML = `
    <div class="market-payout-row"><span>A vevő fizet</span><strong>${price.toLocaleString('hu-HU')} PP</strong></div>
    <div class="market-payout-row market-payout-tax"><span>Adó (${marketTaxPercent}%)</span><strong>-${(price - payout).toLocaleString('hu-HU')} PP</strong></div>
    <div class="market-payout-row market-payout-total"><span>Te kapsz</span><strong>${payout.toLocaleString('hu-HU')} PP</strong></div>
  `;
}
$('#marketListPriceInput')?.addEventListener('input', updateMarketPayoutPreview);

async function loadMarketListings() {
  const wrap = $('#marketListingsWrap');
  if (!wrap) return;
  let listings = [];
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/market', {
      headers: session?.token ? { Authorization: 'Bearer ' + session.token } : {}
    });
    const data = await res.json();
    if (data.ok) {
      listings = data.listings || [];
      if (typeof data.taxPercent === 'number') {
        marketTaxPercent = data.taxPercent;
        const note = $('#marketTaxNote');
        if (note) note.textContent = marketTaxPercent + '%';
      }
    }
  } catch {}

  // A saját hirdetéseink a fenti külön szekcióban vannak - itt csak a
  // ténylegesen megvehető kínálat látszik, hogy ne kelljen köztük keresgélni.
  const buyable = listings.filter((l) => !l.isMine);
  if (!buyable.length) {
    wrap.innerHTML = '<div class="card"><p class="redeem-result">Jelenleg nincs eladó kiegészítő a piacon.</p></div>';
    return;
  }
  const ownedIds = new Set(myCosmetics.owned.map((c) => c.id));
  wrap.innerHTML = `<div class="cosmetic-grid">${buyable.map((l) => {
    const alreadyOwned = ownedIds.has(l.cosmetic.id);
    return `
    <div class="cosmetic-card rarity-${escapeHtml(l.cosmetic.rarity)}">
      ${cosmeticThumbHtml(l.cosmetic)}
      <div class="cosmetic-card-name">${escapeHtml(l.cosmetic.name)}</div>
      <div class="cosmetic-card-tags">
        <span class="cosmetic-tag">${escapeHtml(l.cosmetic.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[l.cosmetic.rarity] || l.cosmetic.rarity)}</span>
      </div>
      <div class="cosmetic-card-seller">Eladó: ${escapeHtml(l.seller)}</div>
      <div class="cosmetic-card-meta">${cosmeticExpiryHtml(l.expiresAt)}</div>
      <div class="cosmetic-card-price">${l.priceSc.toLocaleString('hu-HU')} PP</div>
      ${alreadyOwned
        ? '<button type="button" class="btn-outline cosmetic-action" disabled>Már megvan</button>'
        : `<button type="button" class="btn-glow cosmetic-action" data-market-buy="${l.id}">Megvásárlás</button>`}
    </div>`;
  }).join('')}</div>`;
  hydrateCosmeticThumbs(wrap);
}

async function loadMyMarketListings() {
  const wrap = $('#marketMineWrap');
  if (!wrap) return;
  let listings = [];
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/market/mine', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) listings = data.listings || [];
  } catch {}

  if (!listings.length) {
    wrap.innerHTML = '<div class="card"><p class="redeem-result">Jelenleg nincs aktív hirdetésed.</p></div>';
    return;
  }
  wrap.innerHTML = listings.map((l) => `
    <div class="badges-admin-item">
      ${l.cosmetic ? cosmeticThumbHtml(l.cosmetic) : '<div class="cosmetic-thumb cosmetic-thumb-empty"></div>'}
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">${escapeHtml(l.cosmetic?.name || '-')}</div>
        <div class="badges-admin-item-meta">
          ${l.priceSc.toLocaleString('hu-HU')} PP · neked ${l.payoutSc.toLocaleString('hu-HU')} PP
          ${l.status === 'reserved' ? ' · <span class="market-status-reserved">vásárlás folyamatban</span>' : ''}
        </div>
      </div>
      <div class="badges-admin-item-actions">
        ${l.status === 'reserved'
          ? '<span class="redeem-result">Foglalt</span>'
          : `<button type="button" class="news-delete-btn" data-market-cancel="${l.id}">Visszavonás</button>`}
      </div>
    </div>
  `).join('');
  hydrateCosmeticThumbs(wrap);
}

$('#marketListBtn')?.addEventListener('click', async () => {
  const resultEl = $('#marketListResult');
  const cosmeticId = Number($('#marketListCosmeticSelect').value);
  const priceSc = Number($('#marketListPriceInput').value);
  if (!Number.isInteger(cosmeticId)) {
    resultEl.textContent = 'Válassz egy kiegészítőt.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (!Number.isInteger(priceSc) || priceSc < 1) {
    resultEl.textContent = 'Adj meg egy érvényes árat (legalább 1 PP).';
    resultEl.className = 'redeem-result error';
    return;
  }
  // A hirdetés feladása LETÉTBE teszi a kiegészítőt (lekerül róla, és amíg
  // kint van, nem viselhető) - ezt előre kimondjuk, hogy ne érje meglepetés.
  const confirmed = await confirmModal(
    'Hirdetés feladása',
    `Felteszed a piacra ${priceSc.toLocaleString('hu-HU')} PP-ért? Amíg kint van a hirdetés, nem tudod viselni a kiegészítőt. Eladáskor ${marketTaxPercent}% adó vonódik le, tehát ${Math.floor(priceSc * (100 - marketTaxPercent) / 100).toLocaleString('hu-HU')} PP lesz a tiéd.`,
    'Igen, feladom'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/market/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ cosmeticId, priceSc })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült feladni a hirdetést.';
      resultEl.className = 'redeem-result error';
      return;
    }
    resultEl.textContent = '';
    $('#marketListPriceInput').value = '';
    showToast('Hirdetés feladva.');
    loadMarket();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', async (e) => {
  const buyBtn = e.target.closest('[data-market-buy]');
  if (buyBtn) {
    const confirmed = await confirmModal(
      'Vásárlás a piacról',
      'Megveszed ezt a kiegészítőt? A PrémiumPont levonása a következő szerverre lépésedkor történik meg - utána kerül át hozzád a kiegészítő. Ha nincs elég PrémiumPontod, a vásárlás visszavonódik.',
      'Igen, megveszem'
    );
    if (!confirmed) return;
    buyBtn.disabled = true;
    try {
      const res = await fetch(BACKEND_URL + '/api/cosmetics/market/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ listingId: Number(buyBtn.dataset.marketBuy) })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült megvásárolni.', true); buyBtn.disabled = false; return; }
      showToast(data.message || 'A vásárlás rögzítve.');
      loadMarket();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
      buyBtn.disabled = false;
    }
    return;
  }

  const cancelBtn = e.target.closest('[data-market-cancel]');
  if (cancelBtn) {
    const confirmed = await confirmModal('Hirdetés visszavonása', 'Leveszed a hirdetést a piacról? A kiegészítő visszakerül hozzád.', 'Igen, visszavonom');
    if (!confirmed) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/cosmetics/market/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ listingId: Number(cancelBtn.dataset.marketCancel) })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült visszavonni.', true); return; }
      showToast('Hirdetés visszavonva.');
      loadMarket();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  }
});

// ── Admin: katalógus ─────────────────────────────────────────────────────
let cosmeticsAdminItems = [];
let cosmeticEditingId = null;
let cosmeticSelectedModelFile = null;
let cosmeticSelectedTextureFile = null;
// A játékos-profil admin paneljének kiegészítő-választója ebből olvas -
// ugyanaz a minta, mint az allBadgesCache-nél (ld. ott a megjegyzést).
let allCosmeticsCache = [];

function resetCosmeticForm() {
  cosmeticEditingId = null;
  cosmeticSelectedModelFile = null;
  cosmeticSelectedTextureFile = null;
  const t = $('#cosmeticFormTitle');
  if (!t) return;
  t.textContent = 'Új kiegészítő';
  $('#cosmeticNameInput').value = '';
  $('#cosmeticSlugInput').value = '';
  $('#cosmeticSlugInput').disabled = false;
  $('#cosmeticDescInput').value = '';
  $('#cosmeticPriceInput').value = '';
  $('#cosmeticDurationInput').value = '';
  $('#cosmeticTradableCheckbox').checked = true;
  $('#cosmeticEnabledCheckbox').checked = true;
  $('#cosmeticOffsetXInput').value = '0';
  $('#cosmeticOffsetYInput').value = '0';
  $('#cosmeticOffsetZInput').value = '0';
  $('#cosmeticRotXInput').value = '0';
  $('#cosmeticRotYInput').value = '0';
  $('#cosmeticRotZInput').value = '0';
  $('#cosmeticScaleInput').value = '1';
  $('#cosmeticItemSpaceCheckbox').checked = true;
  $('#cosmeticModelInput').value = '';
  $('#cosmeticTextureInput').value = '';
  $('#cosmeticModelNote').textContent = '';
  $('#cosmeticTexturePreviewWrap').hidden = true;
  $('#cosmeticTexturePreview').src = '';
  $('#cosmeticFormResult').textContent = '';
  $('#cosmeticFormResult').className = 'redeem-result';
  $('#cosmeticSaveBtn').textContent = 'Mentés';
  cosmeticEditorModel = null;
  cosmeticEditorTexture = null;
  queueEditorRefresh();
}

$('#cosmeticModelPickBtn')?.addEventListener('click', () => $('#cosmeticModelInput').click());
$('#cosmeticTexturePickBtn')?.addEventListener('click', () => $('#cosmeticTextureInput').click());

// A kockaszám azonnali kiírása: a backend max. 48-at fogad el, és sokkal
// jobb ezt a fájl kiválasztásakor látni, mint mentéskor hibaüzenetként.
$('#cosmeticModelInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  cosmeticSelectedModelFile = file || null;
  const note = $('#cosmeticModelNote');
  if (!file) { note.textContent = ''; return; }
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const count = Array.isArray(parsed.elements) ? parsed.elements.length : 0;
      note.textContent = count
        ? `${escapeHtml(file.name)} - ${count} kocka`
        : `${escapeHtml(file.name)} - FIGYELEM: nem találtam "elements" tömböt benne.`;
      // A frissen kiválasztott modell azonnal megjelenik a szerkesztőben,
      // még mentés előtt - így a beillesztés a feltöltéssel EGY menetben
      // elvégezhető. Új kiegészítőnél rögtön a helyére is igazítjuk (ld.
      // autoFitCosmetic indoklását) - szerkesztésnél NEM, mert ott a meglévő,
      // már bevált értékeket nem szabad felülírni.
      cosmeticEditorModel = count ? parsed : null;
      if (cosmeticEditorModel && !cosmeticEditingId) autoFitCosmetic();
      restartCosmeticEditor();
    } catch {
      note.textContent = `${escapeHtml(file.name)} - FIGYELEM: nem érvényes JSON.`;
      cosmeticEditorModel = null;
      restartCosmeticEditor();
    }
  };
  reader.readAsText(file);
});

$('#cosmeticTextureInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  cosmeticSelectedTextureFile = file || null;
  if (!file) { $('#cosmeticTexturePreviewWrap').hidden = true; return; }
  const reader = new FileReader();
  reader.onload = () => {
    $('#cosmeticTexturePreview').src = reader.result;
    $('#cosmeticTexturePreviewWrap').hidden = false;
    loadImage(reader.result).then((img) => {
      cosmeticEditorTexture = img;
      restartCosmeticEditor();
    });
  };
  reader.readAsDataURL(file);
});

async function loadCosmeticsAdmin() {
  if (!session || !session.token) return;
  if (hasPerm('global.cosmeticsManage')) {
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/cosmetics', {
        headers: { Authorization: 'Bearer ' + session.token }
      });
      const data = await res.json();
      cosmeticsAdminItems = data.ok ? (data.cosmetics || []) : [];
      if (data.ok && Array.isArray(data.slots)) {
        const sel = $('#cosmeticSlotSelect');
        if (sel && !sel.options.length) {
          sel.innerHTML = data.slots.map((s) => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.label)}</option>`).join('');
        }
      }
    } catch {
      cosmeticsAdminItems = [];
    }
    allCosmeticsCache = cosmeticsAdminItems;
    renderCosmeticsAdminList();
  }
  if (hasPerm('global.cosmeticsMarketManage')) loadCosmeticsMarketAdmin();
}

function renderCosmeticsAdminList() {
  const wrap = $('#cosmeticsAdminList');
  if (!wrap) return;
  wrap.innerHTML = cosmeticsAdminItems.map((c) => `
    <div class="badges-admin-item">
      ${cosmeticThumbHtml(c)}
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">
          ${escapeHtml(c.name)}
          ${c.enabled ? '' : '<span class="cosmetic-badge-off">kikapcsolva</span>'}
          ${c.hasModel ? '' : '<span class="cosmetic-badge-warn">nincs modell</span>'}
        </div>
        <div class="badges-admin-item-meta">
          ${escapeHtml(c.slug)} · ${escapeHtml(c.slotLabel)} · ${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}
          · ${c.priceSc !== null && c.priceSc !== undefined ? c.priceSc.toLocaleString('hu-HU') + ' PP' : 'nem vásárolható'}
          · ${c.defaultDurationDays ? c.defaultDurationDays + ' nap' : 'örök'}
          · ${c.tradable ? 'piacozható' : 'nem piacozható'}
          · ${c.ownerCount} tulajdonos${c.listingCount ? `, ${c.listingCount} hirdetés` : ''}
        </div>
      </div>
      <div class="badges-admin-item-actions">
        <button type="button" class="news-edit-btn" data-cosmetic-edit="${c.id}">Szerkesztés</button>
        <button type="button" class="news-delete-btn" data-cosmetic-delete="${c.id}">Törlés</button>
      </div>
    </div>
  `).join('') || '<p class="redeem-result">Még nincs egyetlen kiegészítő sem.</p>';
  hydrateCosmeticThumbs(wrap);
}

// ── Admin illesztő-szerkesztő ────────────────────────────────────────────
// A húzás a TÉNYLEGES eltolás-mezőket állítja, és a karakteren azonnal
// látszik az eredmény - ugyanazzal a transzformáció-lánccal, amit a
// SolarClient is használ (ld. skin3d.js buildCosmeticGeometry levezetését).
// Ez a funkció LÉNYEGE: ha az előnézet és az in-game render eltérne, a
// húzogatással beállított értékek használhatatlanok lennének.
let stopCosmeticEditor = null;
let cosmeticEditorModel = null;    // a szerkesztett modell (elements + texture_size)
let cosmeticEditorTexture = null;  // Image objektum
let cosmeticEditorRefreshQueued = false;

function currentEditorTransform() {
  return {
    offset: [
      Number($('#cosmeticOffsetXInput').value) || 0,
      Number($('#cosmeticOffsetYInput').value) || 0,
      Number($('#cosmeticOffsetZInput').value) || 0
    ],
    // Fokban, X-Y-Z sorrendben - ld. skin3d.js buildCosmeticGeometry.
    rotation: [
      Number($('#cosmeticRotXInput').value) || 0,
      Number($('#cosmeticRotYInput').value) || 0,
      Number($('#cosmeticRotZInput').value) || 0
    ],
    scale: Number($('#cosmeticScaleInput').value) || 1,
    itemModelSpace: $('#cosmeticItemSpaceCheckbox').checked
  };
}

// Ennyi világ-egység esik egy képpontra a megadott kamera-távolságnál
// (PI/5 látószög). Enélkül a húzás sebessége a vászon méretétől ÉS a
// nagyítástól függetlenül fix lenne, ami ránagyítva használhatatlanul
// durva lépéseket adna.
function editorUnitsPerPixel(canvas, camDistance) {
  const dist = typeof camDistance === 'number' && camDistance > 0 ? camDistance : 46;
  const visibleHeight = 2 * dist * Math.tan(Math.PI / 10);
  return visibleHeight / (canvas.height || 320);
}

function round2(n) { return Math.round(n * 100) / 100; }

// A forgatás-mezők -180..180 közé csavarva. MIÉRT KELL: a húzás
// mozdulatonként ad hozzá, tehát korlátozás nélkül percek alatt ezres
// értékek jönnének ki - amiket a backend (-360..360) már el sem fogadna,
// és a mezőben sem lehetne értelmezni.
function wrapDegrees(n) {
  let d = ((Number(n) || 0) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return round2(d);
}

// ── Automatikus beillesztés ──────────────────────────────────────────────
// MIÉRT KELL: egy Blockbench ITEM-modell (minden vásárolt csomag ilyen) a
// (8,8,8) blokk-középpont körül van megrajzolva, nem a (0,0,0) csont-pivot
// körül. Nulla eltolással ezért a modell jellemzően a fej fölé és oldalra
// csúszik - mérve: a példacsomagok szárnyai x-ben 8 egységgel, y-ban 6-13
// egységgel el voltak tolva. Ez nem hiba, hanem a két konvenció különbsége.
//
// Ahelyett, hogy ezt az adminra hagynánk, feltöltéskor kiszámoljuk azt az
// eltolást, amitől a modell a csontra KÖZÉPRE kerül - onnan már csak
// finomhangolás a húzogatás. A Z-t SZÁNDÉKOSAN nem nyúljuk: a mélység
// (szárny hátul, sapka fölül) a modell szerzői szándéka.
function autoFitCosmetic() {
  if (!cosmeticEditorModel) return false;
  const slot = $('#cosmeticSlotSelect').value || 'head';
  const pivot = SkinPreview.COSMETIC_PIVOTS[slot] || [0, 0, 0];

  // Nulla eltolással felépítjük a geometriát, és megnézzük, hol landol.
  // A szonda az AKTUÁLIS forgatással készül (csak az eltolás nulla): egy
  // elforgatott modell befoglaló doboza más, tehát forgatás után újra
  // beillesztve mást kell kapni - különben a gomb egy elfordított kardot
  // a forgatás ELŐTTI helyzete szerint középre igazítana.
  const probe = {
    ...cosmeticEditorModel,
    transform: { ...currentEditorTransform(), offset: [0, 0, 0] }
  };
  let g;
  try { g = SkinPreview.buildCosmeticGeometry(probe, slot); } catch { return false; }
  if (!g.positions.length) return false;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < g.positions.length; i += 3) {
    minX = Math.min(minX, g.positions[i]); maxX = Math.max(maxX, g.positions[i]);
    minY = Math.min(minY, g.positions[i + 1]); maxY = Math.max(maxY, g.positions[i + 1]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  // A csont horgonypontja az előnézeti térben (ld. skin3d.js levezetését):
  //   (pivotX, 6 - pivotY, -pivotZ)
  // Az eltolás előjelei ugyanonnan jönnek.
  $('#cosmeticOffsetXInput').value = round2(cx - pivot[0]);
  $('#cosmeticOffsetYInput').value = round2((6 - pivot[1]) - cy);
  return true;
}

// Az újraindítás EGYSZERRE csak egyszer futhat: két aszinkron betöltés
// (modell FileReader + textúra Image) versenyezhet érte, és ha közben egy
// második hívás is elindulna, a régi példány leállítása után a másik
// beragadhatna egy félkész állapotban. Az "újra kell futni" jelzést itt is
// elraktározzuk, nem eldobjuk.
let cosmeticEditorStarting = false;
let cosmeticEditorRestartAgain = false;

async function restartCosmeticEditor() {
  if (cosmeticEditorStarting) { cosmeticEditorRestartAgain = true; return; }
  cosmeticEditorStarting = true;
  try {
    await doRestartCosmeticEditor();
  } finally {
    cosmeticEditorStarting = false;
    if (cosmeticEditorRestartAgain) {
      cosmeticEditorRestartAgain = false;
      await restartCosmeticEditor();
    }
  }
}

async function doRestartCosmeticEditor() {
  const canvas = $('#cosmeticEditorPreview');
  const empty = $('#cosmeticEditorEmpty');
  if (!canvas) return;

  if (stopCosmeticEditor) { stopCosmeticEditor(); stopCosmeticEditor = null; }

  if (!cosmeticEditorModel || !cosmeticEditorTexture) {
    if (empty) empty.hidden = false;
    canvas.style.visibility = 'hidden';
    return;
  }
  if (empty) empty.hidden = true;
  canvas.style.visibility = '';

  // A SAJÁT skined jelenik meg a szerkesztőben, nem egy általános alak - így
  // rögtön a valódi karaktereden látod az illesztést. Ha nincs feltöltött
  // skined, a generált alapkarakter a tartalék.
  const skinImg = await loadSkinImage(session.username) || await SkinPreview.getSteveImage();
  if (!skinImg) return;

  const slot = $('#cosmeticSlotSelect').value || 'head';
  const model = { ...cosmeticEditorModel, transform: currentEditorTransform() };

  stopCosmeticEditor = SkinPreview.start(
    canvas, skinImg, myCosmeticsSkinSlim(), null,
    [{ model, slot, img: cosmeticEditorTexture }],
    (dx, dy, angle, camDistance, dragMode) => {
      if (dragMode === 'rotate') {
        // A KIEGÉSZÍTŐ forgatása (Ctrl + húzás) - nem a kameráé.
        // Vízszintes mozdulat = Y (függőleges) tengely, függőleges = X.
        //
        // AZ ELŐJELEK LEVEZETVE, nem próbálgatva (a skin3d.js
        // transzformáció-láncából, alap-kameraállásnál):
        //  - a kiegészítő kamera felé néző pontja szerzői (0,0,-1); Y körül
        //    theta-val forgatva az előnézeti x-e sin(theta) lesz, tehát a
        //    JOBBRA húzás (dx>0) NÖVELI az Y-szöget;
        //  - a teteje szerzői (0,1,0); X körül forgatva az előnézeti z-je
        //    -sin(theta), és a LEFELÉ húzás (dy>0) a tetejét a néző felé
        //    (pozitív előnézeti z) dönti, ami CSÖKKENTI az X-szöget.
        const inRX = $('#cosmeticRotXInput');
        const inRY = $('#cosmeticRotYInput');
        inRY.value = wrapDegrees(Number(inRY.value || 0) + dx * 0.5);
        inRX.value = wrapDegrees(Number(inRX.value || 0) - dy * 0.5);
        queueEditorRefresh();
        return;
      }
      // A húzás sebességét a KAMERA AKTUÁLIS TÁVOLSÁGÁHOZ igazítjuk -
      // nagyításkor finomabb, kizoomolva durvább lépés. Enélkül a
      // ránagyított nézetben egyetlen pixelnyi mozdulat is átdobná a
      // modellt a karakter másik oldalára.
      const upp = editorUnitsPerPixel(canvas, camDistance);

      // A képernyőn látott vízszintes irány a modell terében a kamera
      // Y-forgásától függ - ezért bontjuk X és Z komponensre, hogy a
      // kiegészítő akkor is a húzás irányába menjen, ha a karaktert
      // közben eloldalaztuk.
      const c = Math.cos(angle), s = Math.sin(angle);
      const worldDX = dx * upp * c;
      const worldDZ = dx * upp * s;

      // Az előjelek a transzformáció-láncból következnek (ld. skin3d.js):
      //   preview_x = pivotX - offX + ...   -> jobbra húzás = offX csökken
      //   preview_y = 6 - (pivotY - offY)   -> felfelé      = offY nő
      //   preview_z = -(pivotZ + offZ)      -> előrébb      = offZ csökken
      const inX = $('#cosmeticOffsetXInput');
      const inY = $('#cosmeticOffsetYInput');
      const inZ = $('#cosmeticOffsetZInput');
      inX.value = round2(Number(inX.value || 0) - worldDX);
      inY.value = round2(Number(inY.value || 0) - dy * upp);
      inZ.value = round2(Number(inZ.value || 0) - worldDZ);

      queueEditorRefresh();
    }
  );
}

// A geometriát minden mozdulatnál újra kell építeni (az eltolás bele van
// sütve a csúcsokba) - de CSAK a geometriát: a teljes előnézet újraindítása
// elvágná a folyamatban lévő húzást (ld. skin3d.js updateCosmetics
// megjegyzését). Ezért ha már fut a szerkesztő, csak a puffereket cseréljük.
// A "dirty" jelző NEM elhagyható: a modell és a textúra KÜLÖN, aszinkron
// úton töltődik be (FileReader + Image). Ha a második közülük épp akkor
// készül el, amikor már ütemezve van egy frissítés, egy sima
// "ha ütemezve van, lépj ki" őrfeltétel ELDOBNÁ a kérést - és a szerkesztő
// örökre az "előbb válassz modellt" állapotban ragadna, holott minden
// betöltődött. Élesben pontosan ez történt.
let cosmeticEditorRefreshDirty = false;

function queueEditorRefresh() {
  if (cosmeticEditorRefreshQueued) { cosmeticEditorRefreshDirty = true; return; }
  cosmeticEditorRefreshQueued = true;
  requestAnimationFrame(async () => {
    cosmeticEditorRefreshQueued = false;
    if (stopCosmeticEditor && stopCosmeticEditor.updateCosmetics
        && cosmeticEditorModel && cosmeticEditorTexture) {
      stopCosmeticEditor.updateCosmetics([{
        model: { ...cosmeticEditorModel, transform: currentEditorTransform() },
        slot: $('#cosmeticSlotSelect').value || 'head',
        img: cosmeticEditorTexture
      }]);
    } else {
      await restartCosmeticEditor();
    }
    if (cosmeticEditorRefreshDirty) {
      cosmeticEditorRefreshDirty = false;
      queueEditorRefresh();
    }
  });
}

['#cosmeticOffsetXInput', '#cosmeticOffsetYInput', '#cosmeticOffsetZInput',
 '#cosmeticRotXInput', '#cosmeticRotYInput', '#cosmeticRotZInput',
 '#cosmeticScaleInput', '#cosmeticItemSpaceCheckbox', '#cosmeticSlotSelect'].forEach((sel) => {
  $(sel)?.addEventListener('input', queueEditorRefresh);
  $(sel)?.addEventListener('change', queueEditorRefresh);
});

// SHIFT + görgő: a Z-tengely (előre/hátra). Húzással ezt nem lehetne
// egyértelműen megadni, mert a képernyőn a mélység nem különböztethető meg a
// vízszintes mozgástól. A CSUPASZ görgő SZÁNDÉKOSAN nem ide tartozik: azt a
// nagyítás kapja (ld. skin3d.js), mert egy 3D szerkesztőben a görgőtől azt
// várja az ember.
$('#cosmeticEditorPreview')?.addEventListener('wheel', (e) => {
  if (!cosmeticEditorModel) return;
  if (e.ctrlKey || e.metaKey) {
    // CTRL + görgő: a Z tengely körüli forgatás ("roll"). Húzással ezt sem
    // lehetne megadni: a képernyőn a két húzás-irány már a másik két
    // tengelyt vezérli.
    e.preventDefault();
    e.stopImmediatePropagation();
    const inRZ = $('#cosmeticRotZInput');
    inRZ.value = wrapDegrees(Number(inRZ.value || 0) + (e.deltaY > 0 ? 5 : -5));
    queueEditorRefresh();
    return;
  }
  if (!e.shiftKey) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const inZ = $('#cosmeticOffsetZInput');
  inZ.value = round2(Number(inZ.value || 0) + (e.deltaY > 0 ? 0.5 : -0.5));
  queueEditorRefresh();
}, { passive: false, capture: true });

$('#cosmeticAutoFitBtn')?.addEventListener('click', () => {
  if (!autoFitCosmetic()) {
    showToast('Előbb válassz egy modellt.', true);
    return;
  }
  queueEditorRefresh();
});

$('#cosmeticEditorResetBtn')?.addEventListener('click', () => {
  $('#cosmeticOffsetXInput').value = '0';
  $('#cosmeticOffsetYInput').value = '0';
  $('#cosmeticOffsetZInput').value = '0';
  $('#cosmeticRotXInput').value = '0';
  $('#cosmeticRotYInput').value = '0';
  $('#cosmeticRotZInput').value = '0';
  $('#cosmeticScaleInput').value = '1';
  queueEditorRefresh();
});

$('#cosmeticDiscardBtn')?.addEventListener('click', resetCosmeticForm);

$('#cosmeticSaveBtn')?.addEventListener('click', async () => {
  const resultEl = $('#cosmeticFormResult');
  const name = $('#cosmeticNameInput').value.trim();
  const slug = $('#cosmeticSlugInput').value.trim().toLowerCase();
  if (!name) {
    resultEl.textContent = 'Adj meg egy nevet.';
    resultEl.className = 'redeem-result error';
    return;
  }
  if (!cosmeticEditingId && !/^[a-z0-9_]{3,48}$/.test(slug)) {
    resultEl.textContent = 'Az azonosító csak kisbetűt, számot és alulvonást tartalmazhat (3-48 karakter).';
    resultEl.className = 'redeem-result error';
    return;
  }
  // Modell nélkül a kiegészítő nem tud megjelenni in-game - létrehozáskor
  // ezért itt is figyelmeztetünk, nem csak a listában jelezzük utólag.
  if (!cosmeticEditingId && !cosmeticSelectedModelFile) {
    resultEl.textContent = 'Modell nélkül a kiegészítő nem jelenik meg a játékban - tölts fel egy Blockbench .json fájlt.';
    resultEl.className = 'redeem-result error';
    return;
  }

  const formData = new FormData();
  formData.append('name', name);
  if (!cosmeticEditingId) formData.append('slug', slug);
  formData.append('slot', $('#cosmeticSlotSelect').value);
  formData.append('rarity', $('#cosmeticRaritySelect').value);
  formData.append('description', $('#cosmeticDescInput').value.trim());
  formData.append('priceSc', $('#cosmeticPriceInput').value.trim());
  formData.append('defaultDurationDays', $('#cosmeticDurationInput').value.trim());
  formData.append('tradable', $('#cosmeticTradableCheckbox').checked ? 'true' : 'false');
  formData.append('enabled', $('#cosmeticEnabledCheckbox').checked ? 'true' : 'false');
  formData.append('offsetX', $('#cosmeticOffsetXInput').value.trim());
  formData.append('offsetY', $('#cosmeticOffsetYInput').value.trim());
  formData.append('offsetZ', $('#cosmeticOffsetZInput').value.trim());
  formData.append('rotationX', $('#cosmeticRotXInput').value.trim());
  formData.append('rotationY', $('#cosmeticRotYInput').value.trim());
  formData.append('rotationZ', $('#cosmeticRotZInput').value.trim());
  formData.append('scale', $('#cosmeticScaleInput').value.trim());
  formData.append('itemModelSpace', $('#cosmeticItemSpaceCheckbox').checked ? 'true' : 'false');
  if (cosmeticSelectedModelFile) formData.append('model', cosmeticSelectedModelFile);
  if (cosmeticSelectedTextureFile) formData.append('texture', cosmeticSelectedTextureFile);

  try {
    const url = cosmeticEditingId
      ? BACKEND_URL + '/api/admin/cosmetics/' + cosmeticEditingId
      : BACKEND_URL + '/api/admin/cosmetics';
    const res = await fetch(url, {
      method: cosmeticEditingId ? 'PUT' : 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: formData
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.textContent = data.message || 'Nem sikerült menteni.';
      resultEl.className = 'redeem-result error';
      return;
    }
    showToast(cosmeticEditingId ? 'Kiegészítő frissítve.' : 'Kiegészítő létrehozva.');
    resetCosmeticForm();
    loadCosmeticsAdmin();
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-cosmetic-edit]');
  if (editBtn) {
    const item = cosmeticsAdminItems.find((c) => String(c.id) === editBtn.dataset.cosmeticEdit);
    if (!item) return;
    cosmeticEditingId = item.id;
    cosmeticSelectedModelFile = null;
    cosmeticSelectedTextureFile = null;
    $('#cosmeticFormTitle').textContent = 'Kiegészítő szerkesztése';
    $('#cosmeticNameInput').value = item.name;
    // Az azonosítót a kliens gyorsítótárazza, ezért nem módosítható (ld.
    // SolarBackend src/cosmetics.js PUT végpontjának megjegyzését).
    $('#cosmeticSlugInput').value = item.slug;
    $('#cosmeticSlugInput').disabled = true;
    $('#cosmeticSlotSelect').value = item.slot;
    $('#cosmeticRaritySelect').value = item.rarity;
    $('#cosmeticDescInput').value = item.description || '';
    $('#cosmeticPriceInput').value = item.priceSc !== null && item.priceSc !== undefined ? item.priceSc : '';
    $('#cosmeticDurationInput').value = item.defaultDurationDays || '';
    $('#cosmeticTradableCheckbox').checked = !!item.tradable;
    $('#cosmeticEnabledCheckbox').checked = !!item.enabled;
    $('#cosmeticOffsetXInput').value = item.offsetX ?? 0;
    $('#cosmeticOffsetYInput').value = item.offsetY ?? 0;
    $('#cosmeticOffsetZInput').value = item.offsetZ ?? 0;
    $('#cosmeticRotXInput').value = item.rotationX ?? 0;
    $('#cosmeticRotYInput').value = item.rotationY ?? 0;
    $('#cosmeticRotZInput').value = item.rotationZ ?? 0;
    $('#cosmeticScaleInput').value = item.scale ?? 1;
    $('#cosmeticItemSpaceCheckbox').checked = item.itemModelSpace !== false;
    $('#cosmeticModelInput').value = '';
    $('#cosmeticTextureInput').value = '';
    $('#cosmeticModelNote').textContent = item.hasModel
      ? 'Van feltöltött modell - csak akkor válassz újat, ha cserélni akarod.'
      : 'Nincs feltöltött modell.';
    if (item.hasTexture) {
      $('#cosmeticTexturePreview').src = cosmeticTextureUrl(item.id);
      $('#cosmeticTexturePreviewWrap').hidden = false;
    } else {
      $('#cosmeticTexturePreview').src = '';
      $('#cosmeticTexturePreviewWrap').hidden = true;
    }
    $('#cosmeticFormResult').textContent = '';
    $('#cosmeticSaveBtn').textContent = 'Frissítés';

    // A MÁR FELTÖLTÖTT modellt/textúrát is betöltjük a szerkesztőbe, hogy egy
    // meglévő kiegészítő illesztése is húzogatással hangolható legyen - nem
    // csak létrehozáskor.
    cosmeticEditorModel = null;
    cosmeticEditorTexture = null;
    queueEditorRefresh();
    if (item.hasModel && item.hasTexture) {
      Promise.all([fetchCosmeticModel(item.id), loadImage(cosmeticTextureUrl(item.id))])
        .then(([model, img]) => {
          cosmeticEditorModel = model;
          cosmeticEditorTexture = img;
          restartCosmeticEditor();
        });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const deleteBtn = e.target.closest('[data-cosmetic-delete]');
  if (deleteBtn) {
    const item = cosmeticsAdminItems.find((c) => String(c.id) === deleteBtn.dataset.cosmeticDelete);
    if (!item) return;
    const confirmed = await confirmModal(
      'Kiegészítő végleges törlése',
      `Biztosan törlöd a(z) "${item.name}" kiegészítőt? Elvonja mind a ${item.ownerCount} tulajdonosától, és törli a hozzá tartozó piaci hirdetéseket is. Ez nem vonható vissza.`,
      'Igen, törlés'
    );
    if (!confirmed) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/cosmetics/' + item.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
      showToast('Kiegészítő törölve.');
      if (String(cosmeticEditingId) === String(item.id)) resetCosmeticForm();
      loadCosmeticsAdmin();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  }
});

// ── Admin: piac moderálása ───────────────────────────────────────────────
let cosmeticsMarketAdminItems = [];

async function loadCosmeticsMarketAdmin() {
  const wrap = $('#cosmeticsMarketAdminList');
  if (!wrap) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/cosmetics/market', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    cosmeticsMarketAdminItems = data.ok ? (data.listings || []) : [];
  } catch {
    cosmeticsMarketAdminItems = [];
  }
  const STATUS_LABELS = { active: 'aktív', reserved: 'foglalt', sold: 'eladva', cancelled: 'visszavonva' };
  wrap.innerHTML = cosmeticsMarketAdminItems.map((l) => `
    <div class="badges-admin-item">
      ${l.cosmetic ? cosmeticThumbHtml(l.cosmetic) : '<div class="cosmetic-thumb cosmetic-thumb-empty"></div>'}
      <div class="badges-admin-item-info">
        <div class="badges-admin-item-name">${escapeHtml(l.cosmetic?.name || '(törölt kiegészítő)')}</div>
        <div class="badges-admin-item-meta">
          #${l.id} · ${escapeHtml(l.seller)} · ${l.priceSc.toLocaleString('hu-HU')} PP
          (eladónak ${l.payoutSc.toLocaleString('hu-HU')} PP) · ${escapeHtml(STATUS_LABELS[l.status] || l.status)}
          · ${formatLedgerDate(l.createdAt)}
        </div>
      </div>
      <div class="badges-admin-item-actions">
        ${l.status === 'active'
          ? `<button type="button" class="news-delete-btn" data-market-admin-remove="${l.id}">Levétel</button>`
          : ''}
      </div>
    </div>
  `).join('') || '<p class="redeem-result">Nincs egyetlen piaci hirdetés sem.</p>';
  hydrateCosmeticThumbs(wrap);
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-market-admin-remove]');
  if (!btn) return;
  const confirmed = await confirmModal(
    'Hirdetés levétele',
    'Leveszed ezt a hirdetést a piacról? A kiegészítő visszakerül az eladóhoz - ez nem elkobzás.',
    'Igen, leveszem'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/cosmetics/market/' + btn.dataset.marketAdminRemove, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült levenni.', true); return; }
    showToast('Hirdetés levéve.');
    loadCosmeticsMarketAdmin();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

// ── Admin: kiegészítő adása/elvétele egy játékostól ──────────────────────
let currentAdminPlayerCosmetics = [];

// A választó a katalógus TELJES listájából épül (a kikapcsoltakat is
// beleértve - egy admin adhat olyat is, ami épp nincs élesítve), ezért kell
// hozzá a cosmeticsManage/cosmeticGrant bármelyikével elérhető admin
// katalógus-végpont, nem a publikus /catalog.
async function ensureAllCosmeticsLoaded() {
  if (allCosmeticsCache.length) return allCosmeticsCache;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/cosmetics', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    allCosmeticsCache = data.ok ? (data.cosmetics || []) : [];
  } catch {
    allCosmeticsCache = [];
  }
  return allCosmeticsCache;
}

async function loadAdminPlayerCosmetics(username) {
  if (!hasPerm('player.action.cosmeticGrant') && !hasPerm('player.action.cosmeticRevoke')) return;

  const all = await ensureAllCosmeticsLoaded();
  const select = $('#adminCosmeticSelect');
  if (select) {
    select.innerHTML = all.length
      ? all.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.slotLabel)})</option>`).join('')
      : '<option value="">Nincs létrehozott kiegészítő</option>';
  }

  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(username) + '/cosmetics', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    renderAdminPlayerCosmeticsList(data.ok ? data.owned : []);
  } catch {
    renderAdminPlayerCosmeticsList([]);
  }
}

function renderAdminPlayerCosmeticsList(owned) {
  currentAdminPlayerCosmetics = Array.isArray(owned) ? owned : [];
  const canRevoke = hasPerm('player.action.cosmeticRevoke');
  const el = $('#adminPlayerCosmeticsList');
  if (!el) return;
  el.innerHTML = currentAdminPlayerCosmetics.map((c) => `
    <span class="admin-player-badge-chip">
      ${escapeHtml(c.name)}
      <span class="admin-cosmetic-chip-meta">${c.expiresAt ? formatLedgerDate(c.expiresAt) + '-ig' : 'örök'}</span>
      ${canRevoke ? `<button type="button" data-revoke-cosmetic-id="${c.id}" title="Elvétel">×</button>` : ''}
    </span>
  `).join('') || '<p class="redeem-result">Ennek a játékosnak még nincs egyetlen kiegészítője sem.</p>';
}

$('#adminCosmeticGrantBtn')?.addEventListener('click', async () => {
  const statusEl = $('#adminCosmeticGrantStatus');
  const cosmeticId = Number($('#adminCosmeticSelect').value);
  if (!Number.isInteger(cosmeticId)) {
    statusEl.textContent = 'Nincs kiválasztható kiegészítő.';
    statusEl.className = 'redeem-result error';
    return;
  }
  const durationRaw = $('#adminCosmeticDurationInput').value.trim();
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/cosmetics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ cosmeticId, durationDays: durationRaw === '' ? undefined : Number(durationRaw) })
    });
    const data = await res.json();
    if (!data.ok) {
      statusEl.textContent = data.message || 'Nem sikerült kiosztani.';
      statusEl.className = 'redeem-result error';
      return;
    }
    statusEl.textContent = 'Kiegészítő kiosztva.';
    statusEl.className = 'redeem-result success';
    $('#adminCosmeticDurationInput').value = '';
    renderAdminPlayerCosmeticsList(data.owned);
  } catch {
    statusEl.textContent = 'Nem sikerült elérni a szervert.';
    statusEl.className = 'redeem-result error';
  }
});

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-revoke-cosmetic-id]');
  if (!btn) return;
  const confirmed = await confirmModal(
    'Kiegészítő elvétele',
    'Biztosan elveszed ezt a kiegészítőt a játékostól? Ha épp viseli, azonnal lekerül róla.',
    'Igen, elveszem'
  );
  if (!confirmed) return;
  try {
    const res = await fetch(
      BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/cosmetics/' + btn.dataset.revokeCosmeticId,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } }
    );
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült elvenni.', true); return; }
    showToast('Kiegészítő elvéve.');
    renderAdminPlayerCosmeticsList(data.owned);
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
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

const versionEl = document.querySelector('#centerVersion');
if (versionEl) versionEl.textContent = 'v' + CENTER_VERSION;

tryAutoLogin();
