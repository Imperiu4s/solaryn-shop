const CENTER_VERSION = '20260925a';

const BACKEND_URL = 'https://api.overclockgame.hu:8908';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

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

(function initParticles() {
  const canvas = $('#particleCanvas');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }
  const ctx = canvas.getContext('2d');
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }
  let resizePending = false;
  window.addEventListener('resize', () => {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => { resizePending = false; resize(); });
  });
  resize();

  // Egy buborék előre megrajzolva (üveges perem + fényfolt), a téma színével.
  // Képkockánként csak drawImage fut, így sok buborék sem terhel.
  const SPRITE = 128;
  const sprites = [];
  function buildSprites() {
    const css = getComputedStyle(document.documentElement);
    const colors = [css.getPropertyValue('--gold').trim() || '#ffc42e', css.getPropertyValue('--orange').trim() || '#ff7a3d', '#ffffff'];
    sprites.length = 0;
    for (const color of colors) {
      const c = document.createElement('canvas');
      c.width = c.height = SPRITE;
      const g = c.getContext('2d');
      const r = SPRITE / 2;
      // áttetsző belső, a perem felé erősödő színnel
      const body = g.createRadialGradient(r, r, 0, r, r, r);
      body.addColorStop(0, 'rgba(255,255,255,0.02)');
      body.addColorStop(0.7, 'rgba(255,255,255,0.04)');
      body.addColorStop(0.92, color);
      body.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 0.45;
      g.fillStyle = body;
      g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
      // vékony, fent világos perem
      const rim = g.createLinearGradient(0, 0, SPRITE, SPRITE);
      rim.addColorStop(0, 'rgba(255,255,255,0.95)');
      rim.addColorStop(0.45, color);
      rim.addColorStop(1, 'rgba(255,255,255,0.05)');
      g.globalAlpha = 0.6;
      g.strokeStyle = rim;
      g.lineWidth = SPRITE * 0.022;
      g.beginPath(); g.arc(r, r, r * 0.95, 0, Math.PI * 2); g.stroke();
      // fényfolt bal fent + halvány tükröződés jobb lent
      const shine = g.createRadialGradient(r * 0.62, r * 0.55, 0, r * 0.62, r * 0.55, r * 0.3);
      shine.addColorStop(0, 'rgba(255,255,255,0.95)');
      shine.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 0.75;
      g.fillStyle = shine;
      g.beginPath(); g.arc(r * 0.62, r * 0.55, r * 0.3, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.35;
      g.strokeStyle = 'rgba(255,255,255,0.9)';
      g.lineWidth = SPRITE * 0.018;
      g.lineCap = 'round';
      g.beginPath(); g.arc(r, r, r * 0.74, Math.PI * 0.15, Math.PI * 0.42); g.stroke();
      sprites.push(c);
    }
  }
  buildSprites();
  new MutationObserver(buildSprites).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  function spawn(initial) {
    const small = Math.random() < 0.72;
    const r = small ? 3 + Math.random() * 7 : 12 + Math.random() * 26;
    return {
      x: Math.random() * window.innerWidth,
      y: initial ? Math.random() * window.innerHeight : window.innerHeight + r + Math.random() * 60,
      r,
      speed: (small ? 0.22 : 0.12) + Math.random() * 0.35,
      wobble: 0.4 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      freq: 0.004 + Math.random() * 0.008,
      alpha: small ? 0.35 + Math.random() * 0.35 : 0.14 + Math.random() * 0.2,
      sprite: Math.random() < 0.55 ? 0 : (Math.random() < 0.6 ? 1 : 2)
    };
  }
  const COUNT = window.innerWidth < 700 ? 16 : 30;
  const bubbles = Array.from({ length: COUNT }, () => spawn(true));

  let frame = 0;
  function tick() {
    frame++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const b of bubbles) {
      b.y -= b.speed;
      const x = b.x + Math.sin(frame * b.freq + b.phase) * b.wobble * 8;
      if (b.y < -b.r * 2) Object.assign(b, spawn(false));
      const fadeTop = Math.min(1, b.y / 160);
      ctx.globalAlpha = b.alpha * Math.max(0, fadeTop);
      ctx.drawImage(sprites[b.sprite] || sprites[0], x - b.r, b.y - b.r, b.r * 2, b.r * 2);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

let accounts = [];
let activeUsername = '';
let session = null;

(function migrateOldSession() {
  if (localStorage.getItem('solarcenter_accounts')) return;
  try {
    const old = JSON.parse(localStorage.getItem('solarcenter_session') || 'null');
    if (old && old.username && old.token) {
      accounts = [{ username: old.username, token: old.token }];
      activeUsername = old.username;
      localStorage.setItem('solarcenter_accounts', JSON.stringify(accounts));
      localStorage.setItem('solarcenter_active_username', activeUsername);
    }
  } catch {  }
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

function saveSession() {
  if (session) {
    const idx = accounts.findIndex((a) => a.username === session.username);
    if (idx >= 0) accounts[idx].token = session.token;
    else {
      accounts.push({ username: session.username, token: session.token });
      if (accounts.length > 5) accounts.shift();
    }
    activeUsername = session.username;
  } else if (activeUsername) {
    accounts = accounts.filter((a) => a.username !== activeUsername);
    activeUsername = accounts[0]?.username || '';
    syncSessionFromAccounts();
  }
  persistAccounts();
}

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
    return await res.json();
  } catch {
    return { ok: false };
  }
}

function setAuthMode(mode) {
  $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === mode));
  $('#loginForm').classList.toggle('hidden', mode !== 'login');
  $('#registerForm').classList.toggle('hidden', mode !== 'register');
  $('#authError').textContent = '';
  $('#registerError').textContent = '';
}
$$('.auth-tab').forEach((tab) => tab.addEventListener('click', () => setAuthMode(tab.dataset.tab)));
$('#switchToLogin').addEventListener('click', () => setAuthMode('login'));

$('#loginForm').addEventListener('submit', (e) => { e.preventDefault(); doLogin(); });

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
  resultEl.textContent = res.message || 'Ha létezik ilyen fiók, hamarosan kapsz egy emailt.';
  resultEl.className = 'redeem-result success';
});

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
  if (!res.ok) {
    if (res.field === 'username') return fail(res.message || 'Ez a felhasználónév nem választható.', ids.user);
    errEl.textContent = res.message || 'Sikertelen regisztráció.';
    return null;
  }
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

$('#registerSubmit').addEventListener('click', doRegister);

async function doRegister() {
  const res = await submitRegistration(REGISTER_FORM_IDS, $('#registerError'));
  if (!res) return;
  session = { username: res.username, token: res.token };
  saveSession();
  enterApp();
}

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
    if (res.deleted) $('#authError').textContent = 'A fiókod törölve lett.';
  }
}

const STAT_ICONS = {
  rank: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l2.4 6.6L21 9l-5 4.6L17.4 21 12 17.3 6.6 21 8 13.6 3 9l6.6-.4z"/></svg>',
  coin: '<img src="assets/pp-coin.png" alt="PP" />',
  time: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5.4l4 2.3-.8 1.3L11 13V7z"/></svg>',
  wallet: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 6H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-1.5 8.5A1.5 1.5 0 1 1 20 13a1.5 1.5 0 0 1-1.5 1.5zM20 9H4V8h16z"/></svg>',
  spin: '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 12a8 8 0 0 1 14.6-4.5M20 12a8 8 0 0 1-14.6 4.5M18.6 7.5V4m0 3.5H15M5.4 16.5V20m0-3.5H9"/></svg>'
};

const RICH_TEXT_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'SPAN', 'DIV', 'FONT', 'BR']);
const RICH_TEXT_COLOR_RE = /^(#[0-9a-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/i;

function sanitizeRichText(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html || '');
  const clean = (parent) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) continue;
      if (node.nodeType !== Node.ELEMENT_NODE || !RICH_TEXT_TAGS.has(node.tagName)) {
        if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT'].includes(node.tagName)) {
          clean(node);
          node.replaceWith(...Array.from(node.childNodes));
        } else {
          node.remove();
        }
        continue;
      }
      const color = node.style ? node.style.color : '';
      const align = node.style ? node.style.textAlign : '';
      const fontSize = node.getAttribute('size');
      const fontColor = node.getAttribute('color');
      for (const attr of Array.from(node.attributes)) node.removeAttribute(attr.name);
      if (node.tagName === 'SPAN' || node.tagName === 'DIV') {
        if (color && RICH_TEXT_COLOR_RE.test(color)) node.style.color = color;
        if (/^(left|center|right)$/.test(align)) node.style.textAlign = align;
      } else if (node.tagName === 'FONT') {
        if (fontSize && /^[1-7]$/.test(fontSize)) node.setAttribute('size', fontSize);
        if (fontColor && /^#[0-9a-f]{3,6}$/i.test(fontColor)) node.setAttribute('color', fontColor);
      }
      clean(node);
    }
  };
  clean(tpl.content);
  return tpl.innerHTML;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderStatBadges(container, values, opts) {
  const showWallet = !!(opts && opts.showWallet);
  const own = !!(opts && opts.own);
  const items = [
    { key: 'rank', icon: 'rank', label: own ? 'Rangod' : 'Rangja', html: escapeHtml(values.rank) },
    { key: 'coin', icon: 'coin', label: own ? 'Prémiumpontjaid' : 'Prémiumpontjai', html: escapeHtml(values.coin) },
    ...(showWallet ? [{ key: 'wallet', icon: 'wallet', label: own ? 'Egyenleged' : 'Egyenlege', html: escapeHtml(values.wallet) }] : []),
    { key: 'time', icon: 'time', label: own ? 'Online töltött időd' : 'Online töltött ideje', html: escapeHtml(values.time) }
  ];
  container.innerHTML = items.map((it) => `
    <div class="stat-badge" data-stat="${it.key}">
      <div class="stat-badge-icon">${STAT_ICONS[it.icon]}</div>
      <div>
        <div class="stat-badge-label">${it.label}</div>
        <div class="stat-badge-value">${it.html}</div>
      </div>
    </div>
  `).join('');
}

function emptyStats() {
  return { rank: '-', coin: '0', wallet: '0 Ft', time: '0 óra' };
}

function formatPlaytime(seconds) {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : 0;
  const hours = Math.floor(s / 3600);
  return `${hours.toLocaleString('hu-HU')} óra`;
}

function capitalizeFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatStats(data) {
  if (!data) return emptyStats();
  return {
    rank: data.rank ? capitalizeFirst(data.rank) : '-',
    coin: typeof data.scBalance === 'number' ? data.scBalance.toLocaleString('hu-HU') : '0',
    wallet: typeof data.walletBalanceHuf === 'number' ? formatHuf(data.walletBalanceHuf) : '0 Ft',
    time: formatPlaytime(data.playtimeSeconds)
  };
}

function renderDiscordLinkBadge(container, data, opts) {
  if (!container) return;
  if (data && data.discordUsername) {
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

const SANCTION_ICONS = {
  mute: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="9" y="3" width="6" height="10.5" rx="3" fill="currentColor"/>
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="17.5" x2="12" y2="20.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="8.5" y1="20.8" x2="15.5" y2="20.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`,
  ban: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <g transform="rotate(-45 12 10)">
      <rect x="5.4" y="4" width="13.2" height="5.6" rx="1.7" fill="currentColor"/>
      <rect x="10.6" y="9.6" width="2.8" height="8.8" rx="1.4" fill="currentColor"/>
    </g>
    <rect x="3.2" y="19.2" width="14.6" height="2.8" rx="1.4" fill="currentColor"/>
  </svg>`,
  cban: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2.6" y="3.8" width="18.8" height="13" rx="2.4" fill="none" stroke="currentColor" stroke-width="2"/>
    <line x1="12" y1="16.8" x2="12" y2="20.2" stroke="currentColor" stroke-width="2"/>
    <line x1="8" y1="20.4" x2="16" y2="20.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <line x1="6.4" y1="13.4" x2="17.6" y2="7.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  lock: `<svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4.2" y="10.2" width="15.6" height="10.6" rx="2.6" fill="none" stroke="currentColor" stroke-width="2"/>
    <path d="M8 10.2V7.8a4 4 0 0 1 8 0v2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="14.5" r="1.6" fill="currentColor"/>
    <line x1="12" y1="15.7" x2="12" y2="17.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`
};

const SANCTION_TYPES = {
  mute: { label: 'Aktív némítás', note: 'A chat használata korlátozva van.' },
  ban: { label: 'Aktív kitiltás', note: 'A szerverre való belépés korlátozva van.' },
  cban: { label: 'Aktív kliens-tiltás', note: 'A Solaryn kliens használata korlátozva van.' },
  lock: { label: 'A fiók zárolva van', note: 'Erre a fiókra jelenleg nem lehet bejelentkezni. A zárolás indoka nem nyilvános.' }
};

function renderSanctionStatus(container, data) {
  if (!container) return;
  closeSanctionPopover(true);

  const items = [];
  if (data?.activeMute) items.push({ type: 'mute', info: data.activeMute });
  if (data?.activeBan) items.push({ type: 'ban', info: data.activeBan });
  if (data?.activeCban) items.push({ type: 'cban', info: data.activeCban });
  if (data?.locked) items.push({ type: 'lock', info: null });

  if (!items.length) {
    container.innerHTML = '';
    container.__sanctions = null;
    return;
  }
  container.__sanctions = Object.fromEntries(items.map((it) => [it.type, it.info]));
  container.innerHTML = `
    <div class="sanction-icon-row" role="group" aria-label="Aktív szankciók">
      ${items.map((it, i) => `
        <button type="button" class="sanction-icon-btn" data-sanction-type="${it.type}"
                style="--i:${i}" aria-haspopup="dialog" aria-expanded="false"
                title="${SANCTION_TYPES[it.type].label} - kattints a részletekért">
          ${SANCTION_ICONS[it.type]}
          <span class="sr-only">${SANCTION_TYPES[it.type].label} - részletek megjelenítése</span>
        </button>`).join('')}
    </div>
  `;
}

function sanctionPopRow(label, value) {
  return `<div class="sanction-pop-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function sanctionPopoverHtml(type, info) {
  const t = SANCTION_TYPES[type] || { label: 'Szankció', note: '' };
  const rows = [];
  if (info) {
    if (info.by) rows.push(sanctionPopRow('Kiadta', escapeHtml(info.by)));
    if (info.since) rows.push(sanctionPopRow('Kiadva', escapeHtml(formatSanctionUntil(info.since))));
    rows.push(sanctionPopRow(
      info.permanent ? 'Időtartam' : 'Hátralévő idő',
      info.permanent ? 'végleges' : escapeHtml(formatRemaining(info.until))
    ));
  }
  return `
    <span class="sanction-pop-arrow" aria-hidden="true"></span>
    <div class="sanction-pop-head">
      <span class="sanction-pop-icon">${SANCTION_ICONS[type] || ''}</span>
      <div class="sanction-pop-title">${t.label}</div>
      <button type="button" class="sanction-pop-close" data-sanction-close aria-label="Bezárás">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    ${rows.length ? `<div class="sanction-pop-rows">${rows.join('')}</div>` : ''}
    ${info && info.reason ? `
      <div class="sanction-pop-reason">
        <span>Indok</span>
        <p>${escapeHtml(info.reason)}</p>
      </div>` : ''}
    <p class="sanction-pop-note">${t.note}</p>
  `;
}

let sanctionPopEl = null;
let openSanctionBtn = null;

function getSanctionPopover() {
  if (sanctionPopEl && document.body.contains(sanctionPopEl)) return sanctionPopEl;
  sanctionPopEl = document.createElement('div');
  sanctionPopEl.className = 'sanction-popover';
  sanctionPopEl.setAttribute('role', 'dialog');
  sanctionPopEl.setAttribute('aria-label', 'Szankció részletei');
  sanctionPopEl.hidden = true;
  document.body.appendChild(sanctionPopEl);
  return sanctionPopEl;
}

function positionSanctionPopover(btn) {
  const pop = getSanctionPopover();
  const r = btn.getBoundingClientRect();
  const w = pop.offsetWidth;
  const h = pop.offsetHeight;
  const margin = 12;
  const centerX = r.left + r.width / 2;
  const left = Math.max(margin, Math.min(centerX - w / 2, window.innerWidth - w - margin));
  const below = r.bottom + 10;
  const above = r.top - h - 10;
  const placeAbove = (below + h > window.innerHeight - margin) && above >= margin;
  pop.classList.toggle('above', placeAbove);
  pop.style.left = Math.round(left) + 'px';
  pop.style.top = Math.round(placeAbove ? above : below) + 'px';
  pop.style.setProperty('--arrow-x', Math.round(Math.max(16, Math.min(centerX - left, w - 16))) + 'px');
}

function openSanctionPopover(container, btn) {
  closeSanctionPopover(true);
  const pop = getSanctionPopover();
  const type = btn.dataset.sanctionType;
  const info = (container.__sanctions || {})[type] || null;

  clearTimeout(pop.__closeTimer);
  pop.dataset.sanctionType = type;
  pop.innerHTML = sanctionPopoverHtml(type, info);
  pop.classList.remove('closing', 'open');
  pop.hidden = false;
  positionSanctionPopover(btn);
  void pop.offsetWidth;
  pop.classList.add('open');
  btn.classList.add('active');
  btn.setAttribute('aria-expanded', 'true');
  openSanctionBtn = btn;
}

function closeSanctionPopover(instant) {
  document.querySelectorAll('.sanction-icon-btn.active, .sanction-icon-btn[aria-expanded="true"]').forEach((b) => {
    b.classList.remove('active');
    b.setAttribute('aria-expanded', 'false');
  });
  openSanctionBtn = null;
  const pop = sanctionPopEl;
  if (!pop || pop.hidden) return;
  clearTimeout(pop.__closeTimer);
  const finish = () => {
    pop.hidden = true;
    pop.innerHTML = '';
    pop.classList.remove('closing');
  };
  pop.classList.remove('open');
  if (instant) { finish(); return; }
  pop.classList.add('closing');
  pop.__closeTimer = setTimeout(finish, 170);
}

document.addEventListener('click', (e) => {
  const target = e.target;
  if (!target || typeof target.closest !== 'function') { closeSanctionPopover(); return; }

  const btn = target.closest('.sanction-icon-btn');
  if (btn) {
    const container = btn.closest('.profile-sanction-status');
    if (btn.getAttribute('aria-expanded') === 'true') closeSanctionPopover();
    else if (container) openSanctionPopover(container, btn);
    return;
  }
  if (target.closest('.sanction-popover')) {
    if (target.closest('[data-sanction-close]')) closeSanctionPopover();
    return;
  }
  closeSanctionPopover();
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !openSanctionBtn) return;
  const btn = openSanctionBtn;
  closeSanctionPopover();
  btn.focus();
});

let sanctionRepositionQueued = false;
function repositionOpenSanctionPopover() {
  if (!openSanctionBtn || sanctionRepositionQueued) return;
  sanctionRepositionQueued = true;
  requestAnimationFrame(() => {
    sanctionRepositionQueued = false;
    if (!openSanctionBtn) return;
    const r = openSanctionBtn.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !openSanctionBtn.isConnected) {
      closeSanctionPopover(true);
      return;
    }
    positionSanctionPopover(openSanctionBtn);
  });
}
document.addEventListener('scroll', repositionOpenSanctionPopover, true);
window.addEventListener('resize', repositionOpenSanctionPopover);

function formatSanctionUntil(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('hu-HU');
}

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
      { icon: 'time', label: 'Bejelentkezési sorozatod', html: `${data.loginStreakDays} nap` },
      { icon: 'spin', label: 'Ingyenes pörgetéseid', html: String(data.freeSpinsAvailable) }
    ];
    if (data.purchasedSpinsAvailable > 0) {
      items.push({ icon: 'spin', label: 'Megvásárolt pörgetéseid', html: String(data.purchasedSpinsAvailable) });
    }
    if (data.purchasesUnlocked) {
      items.push({ icon: 'spin', label: 'Még vásárolható próbálkozásaid', html: `${data.purchasesRemaining}/2 (200 PP/db)` });
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

let currentPpBalance = 0;

let currentWalletBalanceHuf = 0;
let lastRenderedWalletBalance = null;

let isOwner = false;
let permSet = new Set();
function hasPerm(key) { return isOwner || permSet.has(key); }
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
function applyPermVisibility(root = document) {
  root.querySelectorAll('[data-perm]').forEach((el) => {
    const keys = el.dataset.perm.split(',').map((k) => k.trim());
    el.classList.toggle('hidden', !keys.some(hasPerm));
  });
}

let currentSanctionStatus = { activeMute: null, activeBan: null, activeCban: null };

let lastRenderedPpBalance = null;
const numberAnimGen = new WeakMap();
function animateNumberTo(el, from, to, formatFn, duration = 650) {
  if (from === to) { el.textContent = formatFn(to); numberAnimGen.set(el, (numberAnimGen.get(el) || 0) + 1); return; }
  const myGen = (numberAnimGen.get(el) || 0) + 1;
  numberAnimGen.set(el, myGen);
  el.classList.remove('value-bump');
  void el.offsetWidth;
  el.classList.add('value-bump');
  const start = performance.now();
  function tick(now) {
    if (numberAnimGen.get(el) !== myGen) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
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

function renderWalletBadge() {
  const from = lastRenderedWalletBalance === null ? 0 : lastRenderedWalletBalance;
  animateNumberTo($('#topbarWalletValue'), from, currentWalletBalanceHuf, formatHuf);
  const pageEl = $('#walletPageBalance');
  if (pageEl) pageEl.textContent = formatHuf(currentWalletBalanceHuf);
  const walletIcon = $('#homeWalletIcon');
  if (walletIcon && !walletIcon.firstChild) walletIcon.innerHTML = STAT_ICONS.wallet;
  const homeEl = $('#homeWalletBalance');
  if (homeEl) animateNumberTo(homeEl, lastRenderedWalletBalance === null ? 0 : lastRenderedWalletBalance, currentWalletBalanceHuf, formatHuf);
  lastRenderedWalletBalance = currentWalletBalanceHuf;
}

async function enterApp(meData) {
  $('#authScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  $('#topbarUsername').textContent = session.username;
  $('#homeUsername').textContent = session.username;
  $('#profileName').textContent = session.username;

  if (!meData) meData = await apiGetMe(session.token);
  renderStatBadges($('#statBadgeGrid'), formatStats(meData), { own: true });
  renderDiscordLinkBadge($('#profileDiscordLink'), meData, { mode: 'self' });
  renderSanctionStatus($('#profileSanctionStatus'), meData);
  renderNameBadges($('#profileNameBadges'), meData?.badges);
  currentSanctionStatus = {
    activeMute: meData?.activeMute || null,
    activeBan: meData?.activeBan || null,
    activeCban: meData?.activeCban || null
  };
  loadShopCatalog();
  loadRanks();
  currentPpBalance = typeof meData?.scBalance === 'number' ? meData.scBalance : 0;
  renderProfilePpBadge();
  currentWalletBalanceHuf = typeof meData?.walletBalanceHuf === 'number' ? meData.walletBalanceHuf : 0;
  renderWalletBadge();
  isOwner = typeof meData?.rank === 'string' && meData.rank.toLowerCase() === 'tulajdonos';
  permSet = new Set(Array.isArray(meData?.permissions) ? meData.permissions : []);
  $$('.admin-nav-item[data-permission]').forEach((el) => {
    const keys = el.dataset.permission.split(',').map((k) => k.trim());
    el.classList.toggle('hidden', !keys.some(hasPerm));
  });
  $('#navPermissionsBtn')?.classList.toggle('hidden', !isOwner);
  const adminGroup = document.querySelector('.app-nav-group[data-nav-group="admin"]');
  if (adminGroup) {
    const anyVisible = adminGroup.querySelectorAll('.app-nav-sub .app-nav-item:not(.hidden)').length > 0;
    adminGroup.classList.toggle('hidden', !anyVisible);
  }

  loadTopbarAvatar();
  loadHomeSkinPreview();
  loadDiscordWidget();
  renderSideRails();

  tryConsumeDiscordLink();

  checkPendingGifts();

  loadHomeNews();

  loadHomeFriends();

  loadHomeStaffStats();
  loadHomePlaytimeWeek();

  refreshTradeBadge();
}

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

async function switchAccount(username) {
  const acc = accounts.find((a) => a.username === username);
  if (!acc) return;
  const res = await apiGetMe(acc.token);
  if (res.ok) {
    activeUsername = username;
    persistAccounts();
    location.reload();
  } else if (res.locked) {
    closeAccountModal();
    showLockedScreen(res.reason);
  } else {
    accounts = accounts.filter((a) => a.username !== username);
    persistAccounts();
    renderAccountList();
    showToast('Ez a munkamenet lejárt - jelentkezz be újra.', true);
  }
}

function removeAccountEntry(username) {
  const wasActive = username === activeUsername;
  accounts = accounts.filter((a) => a.username !== username);
  if (wasActive) {
    activeUsername = accounts[0]?.username || '';
    syncSessionFromAccounts();
  }
  persistAccounts();
  if (wasActive) {
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
  location.reload();
});

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

let lastGeneratedRecoveryCodes = null;
const securityFactorState = { totp: null, pin: null };

function refreshSecurityWarning() {
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

function showSecurityPinPanel(panelId) {
  ['securityPinSetupPanel', 'securityPinEnabledPanel']
    .forEach((id) => $('#' + id).classList.toggle('hidden', id !== panelId));
}

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

const NAV_GROUPS_KEY = 'solaryn.navGroups';

function readOpenNavGroups() {
  try {
    const raw = JSON.parse(localStorage.getItem(NAV_GROUPS_KEY));
    return new Set(Array.isArray(raw) ? raw : []);
  } catch { return new Set(); }
}

function persistOpenNavGroups() {
  try {
    const open = $$('.app-nav-group.open').map((g) => g.dataset.navGroup).filter(Boolean);
    localStorage.setItem(NAV_GROUPS_KEY, JSON.stringify(open));
  } catch {  }
}

function setNavGroupOpen(group, open) {
  if (open) {
    for (const other of $$('.app-nav-group')) {
      if (other === group) continue;
      other.classList.remove('open');
      other.querySelector('.app-nav-group-head')?.setAttribute('aria-expanded', 'false');
    }
  }
  group.classList.toggle('open', open);
  group.querySelector('.app-nav-group-head')?.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function syncNavGroups(view) {
  $$('.app-nav-group').forEach((group) => {
    const holds = !!group.querySelector(`.app-nav-item[data-view="${view}"]`);
    group.querySelector('.app-nav-group-head')?.classList.toggle('holds-active', holds);
    if (holds) setNavGroupOpen(group, true);
  });
  persistOpenNavGroups();
}

$$('.app-nav-group').forEach((group) => {
  const head = group.querySelector('.app-nav-group-head');
  if (!head) return;
  head.setAttribute('aria-expanded', 'false');
  head.addEventListener('click', () => {
    setNavGroupOpen(group, !group.classList.contains('open'));
    persistOpenNavGroups();
  });
});
readOpenNavGroups().forEach((name) => {
  const group = document.querySelector(`.app-nav-group[data-nav-group="${name}"]`);
  if (group) setNavGroupOpen(group, true);
});

function switchView(view) {
  $$('.app-nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  syncNavGroups(view);
  if (view === 'skin') { endDefaultMediaTry(false); loadSkinPreview3d(); loadDefaultMediaGallery(); loadMySkinSubmissions(); }
  if (view === 'ranks') refreshPpBalance();
  if (view === 'wallet') refreshPpBalance();
  if (view === 'security') { loadSecurityStatus(); loadSecurityPinStatus(); loadClientSettingsState(); }
  if (view === 'ledger') loadLedger();
  if (view === 'purchaseLogs') loadPurchaseLogsGlobal();
  if (view === 'staffActionLogs') loadStaffActionLogsGlobal();
  if (view === 'staffStats') loadStaffStats();
  if (view === 'analytics') loadAnalytics();
  if (view === 'revenue') loadRevenue();
  if (view === 'newsAdmin') { resetNewsForm(); loadNewsAdmin(); }
  if (view === 'badges') { resetBadgeForm(); loadBadgesAdmin(); }
  if (view === 'defaultMediaAdmin') { resetDmAdminForm(); loadDefaultMediaAdmin(); loadSkinSubmissionsAdmin(); }
  if (view === 'nameRules') loadNameRules();
  if (view === 'discounts') { resetDiscountForm(); loadDiscountsAdmin(); }
  if (view === 'coupons') { resetCouponForm(); loadCouponsAdmin(); }
  if (view === 'creatorCodes') { resetCreatorCodeForm(); loadCreatorCodesAdmin(); }
  if (view === 'casino') loadCasino();
  if (view === 'cosmetics') loadMyCosmetics();
  if (view === 'market') loadMarket();
  if (view === 'trades') loadTrades();
  if (view === 'cosmeticsAdmin') { closeCosmeticEditor(); resetCosmeticForm(); loadCosmeticsAdmin(); }
  if (view === 'mobsAdmin') { closeMobEditor(); loadMobsAdmin(); }
}
$$('.app-nav-item[data-view]').forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function drawSkinFace(ctx, img, size) {
  ctx.clearRect(0, 0, size, size);
  const scale = (img.naturalWidth || img.width) / 64;
  ctx.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, size, size);
  if ((img.naturalHeight || img.height) > (img.naturalWidth || img.width) / 2) {
    ctx.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, size, size);
  }
}

async function drawFallbackFace(ctx, size) {
  const steve = await SkinPreview.getSteveImage();
  if (steve) drawSkinFace(ctx, steve, size);
  else drawDefaultFace(ctx, size);
}

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
  if (img) drawSkinFace(ctx, img, size);
  else await drawFallbackFace(ctx, size);
}

function loadSkinImage(username) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = BACKEND_URL + '/api/skin/' + encodeURIComponent(username) + '?t=' + Date.now();
  });
}

let stopHomeSkinPreview = null;
async function loadHomeSkinPreview() {
  const [img, capeImg] = await Promise.all([loadSkinImage(session.username), loadCapeImage(session.username)]);
  const noteEl = $('#profileSkinNote');
  noteEl.textContent = img ? '' : 'Még nincs saját skined, ezért az alap skin látszik - a Skin fülön feltölthetsz egyet, vagy választhatsz a kínálatból.';
  const skin = img || await SkinPreview.getSteveImage();
  if (stopHomeSkinPreview) stopHomeSkinPreview();
  stopHomeSkinPreview = SkinPreview.start($('#homeSkinCanvas'), skin, false, capeImg);
}

let stopSkinPreview = null;
let skinModel = 'classic';

async function loadSkinPreview3d() {
  if (!session) return;
  const [img, capeImg] = await Promise.all([loadSkinImage(session.username), loadCapeImage(session.username)]);
  const skin = img || await SkinPreview.getSteveImage();
  if (stopSkinPreview) stopSkinPreview();
  stopSkinPreview = SkinPreview.start($('#skinPreview3d'), skin, img ? skinModel === 'slim' : false, capeImg);
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
      skinModel = 'classic';
      $$('.skin-model-toggle .pill[data-model]').forEach((p) => p.classList.toggle('active', p.dataset.model === 'classic'));
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
    if (data.rewardType === 'cosmetic') {
      const until = data.expiresAt
        ? ` Érvényes: ${new Date(data.expiresAt.replace(' ', 'T')).toLocaleDateString('hu-HU')}-ig.`
        : ' Örökre a tiéd.';
      resultEl.textContent = `Sikeres beváltás! Megkaptad ezt a kiegészítőt: ${data.cosmeticName}.${until} A Kiegészítők fülön veheted fel.`;
    } else if (data.rewardType === 'rank') {
      const until = data.rankDurationDays ? ` ${data.rankDurationDays} napra` : ' véglegesen';
      resultEl.textContent = `Sikeres beváltás! A(z) ${data.rankLabel} rangot${until} a következő szerverre lépéskor kapod meg.`;
    } else if (data.rewardType === 'wallet') {
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

async function apiSearchPlayers(query) {
  try {
    const res = await fetch(BACKEND_URL + '/api/players/search?q=' + encodeURIComponent(query));
    if (!res.ok) return { ok: false, players: [] };
    return await res.json();
  } catch {
    return { ok: false, players: [] };
  }
}

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

  $$('#playerResult .player-card').forEach((card, i) => {
    const player = data.players[i];
    const canvas = card.querySelector('canvas');
    drawFaceForPlayer(canvas, player);
    card.addEventListener('click', () => openPlayerProfile(player.username));
  });
}

async function drawFaceForPlayer(canvas, player) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const size = canvas.width;
  const img = player.hasSkin ? await loadSkinImage(player.username) : null;
  if (img) drawSkinFace(ctx, img, size);
  else await drawFallbackFace(ctx, size);
}

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
    renderSanctionStatus($('#playerProfileSanctionStatus'), profile.ok ? profile : null);
    renderNameBadges($('#playerProfileNameBadges'), profile.ok ? profile.badges : null);
  });
  loadProfileCosmetics(username);

  lastAdminPlayerUsername = username;
  const canSeeAdminPanel = PLAYER_PANEL_KEYS.some(hasPerm);
  $('#playerProfileAdminPanel').classList.toggle('hidden', !canSeeAdminPanel);
  if (canSeeAdminPanel) loadAdminPlayerPanel(username);

  const noteEl = $('#playerProfileSkinNote');
  const [img, capeImg] = await Promise.all([loadSkinImage(username), loadCapeImage(username)]);
  noteEl.textContent = img ? '' : 'Ez a játékos még nem töltött fel skint - az alap skin látszik.';
  const skin = img || await SkinPreview.getSteveImage();
  if (stopPlayerPreview) stopPlayerPreview();
  stopPlayerPreview = SkinPreview.start($('#playerProfileSkinCanvas'), skin, false, capeImg);
}

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

let currentAdminEmail = '';

function setAdminEmailEditing(editing) {
  $('#adminEmailView').classList.toggle('hidden', editing);
  $('#adminEmailEditRow').classList.toggle('hidden', !editing);
  if (editing) {
    $('#adminPlayerEmailInput').value = currentAdminEmail;
    $('#adminPlayerEmailInput').focus();
  }
}

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

function renderAdminDiscountState(discount) {
  const el = $('#adminDiscountCurrent');
  if (!discount) { el.textContent = 'Jelenleg nincs egyedi kedvezménye.'; return; }
  const parts = [`Jelenlegi egyedi kedvezmény: ${discount.percent}%`];
  if (discount.expires_at) parts.push(`lejár: ${formatLedgerDate(discount.expires_at)}`);
  if (discount.reason) parts.push(`indoklás: ${discount.reason}`);
  el.textContent = parts.join(' - ');
}

function renderAdminMediaState(hasSkin, hasCape) {
  $('#adminSkinState').textContent = hasSkin ? 'van feltöltve' : 'nincs feltöltve';
  $('#adminCapeState').textContent = hasCape ? 'van feltöltve' : 'nincs feltöltve';
  $('#adminSkinDeleteBtn').disabled = !hasSkin;
  $('#adminSkinBanBtn').disabled = !hasSkin;
  $('#adminCapeDeleteBtn').disabled = !hasCape;
  $('#adminCapeBanBtn').disabled = !hasCape;
}

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
    `Biztosan megváltoztatod <b>${escapeHtml(lastAdminPlayerUsername)}</b> email címét erre: <b>${escapeHtml(email)}</b>?`,
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

let shopCatalog = [];

function formatHuf(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft';
}

const GIFTABLE_TYPES = new Set(['sc', 'rank']);

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

function formatPp(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' PP';
}

let shopRanks = [];
let mySubscriptions = [];

function formatSubscriptionDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('hu-HU');
}

// Rangonkénti színek és embléma - az ismeretlen (később felvett) rangok a
// RANK_THEME_FALLBACK-et kapják, így a táblázat új ranggal sem törik el.
const RANK_THEMES = {
  helios: { c1: '#ffb347', c2: '#ff6a1a', ink: '#2b1203', tagline: 'Az első sugarak' },
  chronovoid: { c1: '#b197fc', c2: '#5b4bdb', ink: '#ffffff', tagline: 'Az idő ura' },
  immortal: { c1: '#ff6b86', c2: '#c8163f', ink: '#ffffff', tagline: 'Halhatatlan' },
  young: { c1: '#5ee29a', c2: '#0fa3b8', ink: '#032a22', tagline: 'Friss energia' },
  solaryn: { c1: '#ffe27a', c2: '#ff9d17', ink: '#2e1c02', tagline: 'A csúcs', featured: true }
};
const RANK_THEME_FALLBACK = { c1: '#ffc42e', c2: '#ff9d17', ink: '#1a1206', tagline: '' };

function rankEmblemSvg(rankId) {
  const g = `rkg-${rankId}`;
  const defs = `<defs>
    <linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--rank-c1)"/><stop offset="1" style="stop-color:var(--rank-c2)"/></linearGradient>
    <radialGradient id="${g}-glow" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  </defs>`;
  const shapes = {
    helios: `
      <g class="rank-emblem-spin">${Array.from({ length: 12 }, (_, i) => `<path d="M32 3 L35 13 L29 13 Z" transform="rotate(${i * 30} 32 32)" fill="url(#${g})" opacity="${i % 2 ? 0.55 : 1}"/>`).join('')}</g>
      <circle cx="32" cy="32" r="15" fill="url(#${g})"/>
      <circle cx="32" cy="32" r="15" fill="url(#${g}-glow)"/>
      <circle cx="32" cy="32" r="9.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.6"/>`,
    chronovoid: `
      <circle cx="32" cy="32" r="26" fill="none" stroke="url(#${g})" stroke-width="2.2" stroke-dasharray="4 5" class="rank-emblem-spin"/>
      <ellipse cx="32" cy="32" rx="27" ry="9" fill="none" stroke="url(#${g})" stroke-width="1.6" opacity=".7" transform="rotate(-24 32 32)"/>
      <path d="M22 14h20v4c0 5-5 9-8.5 12 3.5 3 8.5 7 8.5 12v4H22v-4c0-5 5-9 8.5-12C27 27 22 23 22 18z" fill="url(#${g})"/>
      <path d="M22 14h20v4c0 5-5 9-8.5 12 3.5 3 8.5 7 8.5 12v4H22v-4c0-5 5-9 8.5-12C27 27 22 23 22 18z" fill="url(#${g}-glow)"/>
      <path d="M26 45c1.5-4 4.5-6 6-6s4.5 2 6 6z" fill="#fff" opacity=".6"/>
      <rect x="19" y="11" width="26" height="4" rx="2" fill="url(#${g})"/><rect x="19" y="45" width="26" height="4" rx="2" fill="url(#${g})"/>`,
    immortal: `
      <path d="M32 58c-11 0-19-8-19-18 0-8 5-13 8-18 1 5 4 7 6 8-1-9 3-18 10-25 0 8 4 12 8 17 4 5 6 10 6 16 0 12-8 20-19 20z" fill="url(#${g})"/>
      <path d="M32 58c-11 0-19-8-19-18 0-8 5-13 8-18 1 5 4 7 6 8-1-9 3-18 10-25 0 8 4 12 8 17 4 5 6 10 6 16 0 12-8 20-19 20z" fill="url(#${g}-glow)"/>
      <path d="M32 54c-5 0-9-4-9-9 0-4 3-7 5-10 1 3 3 4 4 4 0-4 2-8 5-11 1 5 5 8 5 14 0 7-4 12-10 12z" fill="#fff" opacity=".42"/>`,
    young: `
      <path d="M32 4l24 14v28L32 60 8 46V18z" fill="url(#${g})" opacity=".22"/>
      <path d="M32 4l24 14v28L32 60 8 46V18z" fill="none" stroke="url(#${g})" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M36 11L19 36h11l-4 18 19-27H34z" fill="url(#${g})"/>
      <path d="M36 11L19 36h11l-4 18 19-27H34z" fill="url(#${g}-glow)"/>`,
    solaryn: `
      <g class="rank-emblem-spin rank-emblem-spin-slow">${Array.from({ length: 16 }, (_, i) => `<rect x="31" y="1" width="2" height="${i % 2 ? 6 : 9}" rx="1" transform="rotate(${i * 22.5} 32 32)" fill="url(#${g})" opacity=".85"/>`).join('')}</g>
      <path d="M12 44l-2-22 11 9 11-17 11 17 11-9-2 22z" fill="url(#${g})"/>
      <path d="M12 44l-2-22 11 9 11-17 11 17 11-9-2 22z" fill="url(#${g}-glow)"/>
      <rect x="12" y="45" width="40" height="7" rx="3" fill="url(#${g})"/>
      <circle cx="32" cy="34" r="5" fill="#fff" opacity=".9"/><circle cx="32" cy="34" r="3" style="fill:var(--rank-c2)"/>
      <circle cx="10" cy="21" r="2.6" fill="url(#${g})"/><circle cx="54" cy="21" r="2.6" fill="url(#${g})"/><circle cx="32" cy="12" r="2.8" fill="url(#${g})"/>`
  };
  const body = shapes[rankId] || `
      <path d="M8 24l12 9 12-17 12 17 12-9-4 26H12z" fill="url(#${g})"/>
      <path d="M8 24l12 9 12-17 12 17 12-9-4 26H12z" fill="url(#${g}-glow)"/>`;
  return `<svg class="rank-emblem" viewBox="0 0 64 64" aria-hidden="true">${defs}${body}</svg>`;
}

const RANK_INHERIT_RE = /^el[őo]z[őo] rangok? jogai$/i;

// A backend rangonként egy sima szöveglistát ad (perms). Ebből építünk
// összehasonlító mátrixot: a "<Rangnév> Napi Jutalom"-féle sorokat egy
// közös "Napi Jutalom" sorba vonjuk össze, az "Előző rangok jogai" pedig
// az összes korábbi rang jogát is megadja az adott rangnak.
function buildRankMatrix(ranks) {
  const rows = [];
  const rowByKey = new Map();
  const cells = ranks.map(() => new Map());
  ranks.forEach((rank, i) => {
    const label = String(rank.label || '').trim();
    const prefixRe = label ? new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i') : null;
    const perms = Array.isArray(rank.perms) ? rank.perms : [];
    for (const raw of perms) {
      const text = String(raw || '').trim();
      if (!text || RANK_INHERIT_RE.test(text)) continue;
      const own = prefixRe && prefixRe.test(text);
      const rowLabel = own ? text.replace(prefixRe, '') : text;
      const key = rowLabel.toLowerCase();
      if (!rowByKey.has(key)) {
        const row = { key, label: rowLabel.charAt(0).toUpperCase() + rowLabel.slice(1), perRank: !!own };
        rowByKey.set(key, row);
        rows.push(row);
      } else if (own) {
        rowByKey.get(key).perRank = true;
      }
      cells[i].set(key, text);
    }
    if (i > 0 && perms.some((p) => RANK_INHERIT_RE.test(String(p || '').trim()))) {
      for (const [key, text] of cells[i - 1]) if (!cells[i].has(key)) cells[i].set(key, text);
    }
  });
  return { rows, cells };
}

function rankActionsHtml(rank) {
  const affordable = currentPpBalance >= rank.priceCoins;
  const mySub = mySubscriptions.find((s) => s.rankId === rank.id && s.active);
  let subscription = '';
  if (rank.subscribable) {
    if (mySub) {
      subscription = `
        <div class="rank-sub-info">Előfizetve · következő: ${formatSubscriptionDate(mySub.nextBillingAt)}</div>
        ${mySub.lastChargeStatus === 'failed' ? '<div class="subscription-status-failed">Az utolsó terhelés sikertelen volt - pótold az egyenleged.</div>' : ''}
        <button type="button" class="btn-outline rank-btn-small btn-cancel-subscription" data-cancel-sub-rank-id="${rank.id}">Lemondás</button>`;
    } else {
      subscription = `<button type="button" class="btn-outline rank-btn-small btn-subscribe" data-subscribe-rank-id="${rank.id}"${affordable ? '' : ' disabled'} title="Havonta automatikusan megújul">Előfizetés</button>`;
    }
  }
  const price = rank.discountPercent > 0
    ? `<span class="price-original">${formatPp(rank.originalPriceCoins)}</span><b>${formatPp(rank.priceCoins)}</b>`
    : `<b>${formatPp(rank.priceCoins)}</b>`;
  return `
    <div class="rank-price-tag"><img src="assets/pp-coin.png" alt="" />${price}</div>
    <button type="button" class="btn-buy rank-btn-buy" data-rank-id="${rank.id}"${affordable ? '' : ' disabled'}>${affordable ? 'Vásárlás' : 'Nincs elég PP'}</button>
    <div class="rank-btn-row">
      <button type="button" class="btn-outline rank-btn-small btn-gift" data-gift-rank-id="${rank.id}"${affordable ? '' : ' disabled'}>Ajándék</button>
      ${subscription}
    </div>`;
}

const RANK_CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const RANK_CROSS_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>';

function renderRankGrid() {
  const wrap = $('#rankGrid');
  if (!shopRanks.length) {
    wrap.innerHTML = '<div class="card card-static"><p class="redeem-result">A rangok most nem érhetők el - próbáld újra később.</p></div>';
    return;
  }
  const { rows, cells } = buildRankMatrix(shopRanks);
  const styleOf = (rank) => {
    const t = RANK_THEMES[rank.id] || RANK_THEME_FALLBACK;
    return `--rank-c1:${t.c1};--rank-c2:${t.c2};--rank-ink:${t.ink};`;
  };
  const colClass = (rank) => {
    const t = RANK_THEMES[rank.id] || RANK_THEME_FALLBACK;
    const affordable = currentPpBalance >= rank.priceCoins;
    return `rank-col${t.featured ? ' is-featured' : ''}${affordable ? '' : ' is-insufficient'}`;
  };
  const headCells = (fn, cls) => shopRanks.map((r, i) => `<th scope="col" class="${colClass(r)} ${cls}" style="${styleOf(r)}" data-col="${i}">${fn(r)}</th>`).join('');

  wrap.innerHTML = `
    <div class="rank-table-scroll">
      <table class="rank-table" style="--rank-count:${shopRanks.length}">
        <thead>
          <tr class="rank-row-emblem">
            <th class="rank-corner" rowspan="4">
              <div class="rank-corner-inner">
                <span class="rank-corner-eyebrow">Összehasonlítás</span>
                <span class="rank-corner-title">Válaszd ki a hozzád illő rangot</span>
                <span class="rank-corner-balance">Egyenleged: <b>${formatPp(currentPpBalance)}</b></span>
              </div>
            </th>
            ${headCells((r) => {
              const t = RANK_THEMES[r.id] || RANK_THEME_FALLBACK;
              return `${t.featured ? '<span class="rank-ribbon">Legjobb</span>' : ''}${r.discountPercent > 0 ? `<span class="discount-badge">-${r.discountPercent}%</span>` : ''}<div class="rank-emblem-wrap">${rankEmblemSvg(r.id)}</div>`;
            }, 'rank-cell-emblem')}
          </tr>
          <tr class="rank-row-name">
            ${headCells((r) => {
              const t = RANK_THEMES[r.id] || RANK_THEME_FALLBACK;
              return `<span class="rank-name">${escapeHtml(r.label)}</span>${t.tagline ? `<span class="rank-tagline">${escapeHtml(t.tagline)}</span>` : ''}`;
            }, 'rank-cell-name')}
          </tr>
          <tr class="rank-row-duration">
            ${headCells((r) => {
              const days = Number(r.durationDays) || 0;
              return `<span class="rank-duration"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>${days ? `${days} napig érvényes` : escapeHtml(r.duration || '')}</span>`;
            }, 'rank-cell-duration')}
          </tr>
          <tr class="rank-row-actions">
            ${headCells(rankActionsHtml, 'rank-cell-actions')}
          </tr>
        </thead>
        <tbody>
          <tr class="rank-row-section"><th scope="row" colspan="${shopRanks.length + 1}">Jogosultságok</th></tr>
          ${rows.map((row) => `
            <tr class="rank-row-perm">
              <th scope="row">${escapeHtml(row.label)}</th>
              ${shopRanks.map((r, i) => {
                const has = cells[i].has(row.key);
                const full = cells[i].get(row.key);
                return `<td class="${colClass(r)} ${has ? 'has' : 'no'}" style="${styleOf(r)}" data-col="${i}"${has && full ? ` title="${escapeHtml(full)}"` : ''}>
                  <span class="rank-mark ${has ? 'rank-mark-yes' : 'rank-mark-no'}" aria-label="${has ? 'Elérhető' : 'Nem elérhető'}">${has ? RANK_CHECK_SVG : RANK_CROSS_SVG}</span>
                </td>`;
              }).join('')}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="rank-scroll-hint">Húzd oldalra a táblázatot a többi rang megtekintéséhez.</p>
  `;
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

function textPromptModal(title, message, placeholder, okLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>${title}</h3>
        <p>${message}</p>
        <input type="text" class="gift-modal-input" maxlength="200" placeholder="${escapeHtml(placeholder || '')}" />
        <div class="modal-actions">
          <button type="button" class="btn-outline" data-prompt-cancel>Mégse</button>
          <button type="button" class="btn-glow" data-prompt-ok style="margin-top:0;">${okLabel || 'Rendben'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('input');
    const finish = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('[data-prompt-cancel]').addEventListener('click', () => finish(null));
    overlay.querySelector('[data-prompt-ok]').addEventListener('click', () => finish(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(input.value.trim()); if (e.key === 'Escape') finish(null); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
    setTimeout(() => input.focus(), 30);
  });
}

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
      ? (rank ? `A(z) <b>${escapeHtml(rank.label)}</b> rangot ajándékozod <b>${escapeHtml(giftTo)}</b>-nak <b>${formatPp(rank.priceCoins)}</b>-ért - ez a TE egyenlegedből kerül levonásra.` : `Biztosan ajándékozod ezt a rangot ${escapeHtml(giftTo)}-nak?`)
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

const LEDGER_TYPE_LABELS = {
  transfer_in: 'Átutalás',
  transfer_out: 'Átutalás',
  purchase: 'Vásárlás',
  game_purchase: 'Játékbeli vásárlás',
  gift_sent: 'Ajándékozás (küldött)',
  gift_received: 'Ajándékozás (kapott)',
  admin_adjust: 'Admin módosítás',
  cosmetic_purchase: 'Kiegészítő vásárlás',
  cosmetic_market_buy: 'Kiegészítő (piacról)',
  cosmetic_market_sell: 'Kiegészítő eladás (piac)',
  cosmetic_trade_buy: 'Kiegészítő (csere)',
  cosmetic_trade_sell: 'Kiegészítő eladás (csere)'
};

let ledgerEntries = [];

function formatLedgerDate(sqliteDatetime) {
  const raw = String(sqliteDatetime || '');
  const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return raw;
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
      <td>${entry.counterparty ? escapeHtml(entry.counterparty) : '-'}</td>
      <td>${escapeHtml(typeLabel)}</td>
      <td>${entry.detail ? escapeHtml(entry.detail) : '-'}</td>
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
      <td>${escapeHtml(typeLabel)}</td>
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
      <td>${escapeHtml(entry.actor_username)}</td>
      <td>${entry.target_username ? escapeHtml(entry.target_username) : '-'}</td>
      <td>${escapeHtml(actionLabel)}</td>
      <td>${entry.detail ? escapeHtml(entry.detail) : '-'}</td>
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

const STAFF_STAT_ICON_TICKET = '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a1.5 1.5 0 0 0 0 3v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a1.5 1.5 0 0 0 0-3z"/><path d="M9 7v10" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"/></svg>';

const STAFF_STAT_ICON_STAR = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
let staffStatsMonth = null;
let staffPointsConfigCache = null;

function monthOptionLabel(month) {
  const d = new Date(month + '-01T12:00:00');
  return capitalizeFirst(d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }));
}

function fillStaffMonthSelect(current) {
  const select = $('#staffStatsMonthSelect');
  if (!select || select.options.length) return;
  const [y, m] = current.split('-').map(Number);
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  select.innerHTML = months.map((mo, i) => `<option value="${mo}">${monthOptionLabel(mo)}${i === 0 ? ' (aktuális)' : ''}</option>`).join('');
}

function renderStaffPointsConfig(cfg, currentMonth) {
  if (!cfg) return;
  staffPointsConfigCache = cfg;
  const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el) el.value = String(v); };
  set('#staffPointsPerMute', cfg.perMute);
  set('#staffPointsPerBan', cfg.perBan);
  set('#staffPointsPerTicket', cfg.perTicket);
  $('#staffPointsConfigMeta').textContent = cfg.updatedAt
    ? `Utoljára módosította: ${cfg.updatedBy || 'ismeretlen'}, ${formatSanctionUntil(cfg.updatedAt)}`
    : 'Még senki nem módosította - ezek az alapértékek.';
  const month = staffStatsMonth || currentMonth;
  $('#staffStatsMonthNote').textContent = month === currentMonth
    ? 'A hónap még tart - a pontok a hónap végéig folyamatosan nőnek.'
    : 'Lezárt hónap - ezt a pontszámot kell kiosztani.';
}

$('#staffStatsMonthSelect')?.addEventListener('change', (e) => {
  staffStatsMonth = e.target.value;
  loadStaffStats();
});

$('#staffPointsSaveBtn')?.addEventListener('click', async () => {
  const btn = $('#staffPointsSaveBtn');
  const read = (id) => Number(String($(id).value).replace(',', '.'));
  const body = { perMute: read('#staffPointsPerMute'), perBan: read('#staffPointsPerBan'), perTicket: read('#staffPointsPerTicket') };
  if (Object.values(body).some((v) => !Number.isFinite(v) || v < 0 || v > 1000)) {
    showToast('A pontértékek 0 és 1000 közötti számok lehetnek.', true);
    return;
  }
  if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/staff-points/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült menteni.', true); return; }
    showToast('Pontozás elmentve.');
    loadStaffStats();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  } finally {
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
});

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

  const totalPoints = staff.reduce((acc, s) => acc + (Number(s.points) || 0), 0);
  const tiles = [
    { icon: STAFF_STAT_ICON_STAR, label: 'Összes kiosztandó pont', value: formatPoints(totalPoints) },
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
    const query = staffStatsMonth ? '?month=' + encodeURIComponent(staffStatsMonth) : '';
    const res = await fetch(BACKEND_URL + '/api/admin/staff-stats' + query, {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    staff = data.ok && Array.isArray(data.staff) ? data.staff : [];
    if (data.ok && data.currentMonth) {
      fillStaffMonthSelect(data.currentMonth);
      if (!staffStatsMonth) $('#staffStatsMonthSelect').value = data.month;
      renderStaffPointsConfig(data.config, data.currentMonth);
    }
  } catch {
    staff = [];
  }
  staff.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0) || b.onlineSeconds - a.onlineSeconds);

  renderStaffStatsSummary(staff);

  grid.innerHTML = staff.map((s) => `
    <div class="staff-stat-card">
      <div class="staff-stat-card-head">
        <div class="staff-stat-card-name">${escapeHtml(s.username)}</div>
        <div class="staff-stat-card-rank">${escapeHtml(s.rank)}</div>
      </div>
      <div class="staff-stat-card-points">
        <span>Pontok</span>
        <b>${formatPoints(s.points)}</b>
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

let newsEditingId = null;
let newsAdminItems = [];
let newsSelectedImageFile = null;
let newsRemoveExistingImage = false;

function newsImageUrl(id) {
  return BACKEND_URL + '/api/news/' + id + '/image';
}

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
          <div class="news-admin-item-title">${sanitizeRichText(n.title)}</div>
          <div class="news-admin-item-meta">${escapeHtml(n.created_by)} - ${formatLedgerDate(n.created_at)}${n.updated_at ? ' (szerkesztve: ' + formatLedgerDate(n.updated_at) + ')' : ''}</div>
        </div>
        <div class="news-admin-item-actions">
          <button type="button" class="news-edit-btn" data-news-id="${n.id}">Szerkesztés</button>
          <button type="button" class="news-delete-btn" data-news-id="${n.id}">Törlés</button>
        </div>
      </div>
      <p class="news-admin-item-content">${sanitizeRichText(n.content)}</p>
    </div>
  `).join('') || '<p class="redeem-result">Még nincs egyetlen felhívás sem.</p>';
}

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
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    if (newsSelectedImageFile) formData.append('image', newsSelectedImageFile);
    else if (newsEditingId && newsRemoveExistingImage) formData.append('removeImage', 'true');
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
    $('#newsTitleInput').innerHTML = sanitizeRichText(item.title);
    $('#newsContentInput').innerHTML = sanitizeRichText(item.content);
    $('#newsSaveBtn').textContent = 'Frissítés';
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

let badgeEditingId = null;
let badgesAdminItems = [];
let badgeSelectedIconFile = null;
let badgeRemoveExistingIcon = false;
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

let couponEditingId = null;
let couponsAdminItems = [];

function syncCouponRewardTypeUI() {
  const type = $('#couponRewardTypeSelect').value;
  const isCosmetic = type === 'cosmetic';
  const isRank = type === 'rank';
  $('#couponCosmeticRow').classList.toggle('hidden', !isCosmetic);
  $('#couponRankRow')?.classList.toggle('hidden', !isRank);
  const amount = $('#couponRewardAmountInput');
  const amountLabel = $('#couponRewardAmountLabel');
  amount.classList.toggle('hidden', isRank);
  amountLabel.classList.toggle('hidden', isRank);
  if (isCosmetic) {
    amountLabel.textContent = 'Érvényesség napokban (0 = örökre)';
    amount.min = '0';
    amount.placeholder = 'Pl. 30 vagy 0';
  } else {
    amountLabel.textContent = 'Jutalom mennyisége';
    amount.min = '1';
    amount.placeholder = 'Pl. 500';
  }
}

function populateCouponRewardRankSelect(selectedId) {
  const sel = $('#couponRewardRankSelect');
  if (!sel) return;
  sel.innerHTML = shopRanks.length
    ? shopRanks.map((r) => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.label)}</option>`).join('')
    : '<option value="">- nincs elérhető rang -</option>';
  if (selectedId) sel.value = String(selectedId);
}

let couponCosmeticOptions = [];
async function populateCouponCosmeticSelect(selectedId) {
  const sel = $('#couponCosmeticSelect');
  if (!sel) return;
  if (!couponCosmeticOptions.length) {
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/cosmetics', {
        headers: { Authorization: 'Bearer ' + session.token }
      });
      const data = await res.json();
      couponCosmeticOptions = data.ok && Array.isArray(data.cosmetics) ? data.cosmetics : [];
    } catch {
      couponCosmeticOptions = [];
    }
  }
  sel.innerHTML = couponCosmeticOptions.length
    ? couponCosmeticOptions.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.slot || '')})</option>`).join('')
    : '<option value="">- nincs elérhető kiegészítő -</option>';
  if (selectedId) sel.value = String(selectedId);
}

function resetCouponForm() {
  couponEditingId = null;
  $('#couponFormTitle').textContent = 'Új kupon';
  $('#couponCodeInput').value = '';
  $('#couponRewardTypeSelect').value = 'pp';
  syncCouponRewardTypeUI();
  populateCouponCosmeticSelect();
  $('#couponRewardAmountInput').value = '';
  populateCouponRewardRankSelect();
  $('#couponRankDurationInput').value = '';
  $('#couponMaxUsesInput').value = '';
  $('#couponStartsInput').value = '';
  $('#couponExpiresInput').value = '';
  $('#couponActiveCheckbox').checked = true;
  $('#couponFormResult').textContent = '';
  $('#couponFormResult').className = 'redeem-result';
  $('#couponSaveBtn').textContent = 'Mentés';
  populateCouponRequiredRankSelect();
}

function populateCouponRequiredRankSelect(selectedId) {
  const sel = $('#couponRequiredRankSelect');
  const rankOptions = shopRanks.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join('');
  sel.innerHTML = `<option value="">- Bárki beválthatja -</option>${rankOptions}`;
  sel.value = selectedId || '';
}

function couponRewardLabel(c) {
  if (c.reward_type === 'cosmetic') {
    const name = c.rewardCosmetic ? c.rewardCosmetic.name : 'törölt kiegészítő';
    const days = Number(c.reward_amount) || 0;
    return `${escapeHtml(name)} (${days > 0 ? days + ' nap' : 'örökre'})`;
  }
  if (c.reward_type === 'rank') {
    const days = Number(c.reward_duration_days) || 0;
    return `${escapeHtml(c.rewardRankLabel || c.reward_rank)} rang (${days > 0 ? days + ' nap' : 'végleges'})`;
  }
  return c.reward_type === 'wallet' ? `${formatHuf(c.reward_amount)} egyenleg` : `${formatPp(c.reward_amount)} PP`;
}

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
    if (c.required_rank) windowParts.push('csak: ' + escapeHtml(couponRequiredRankLabel(c.required_rank)));
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
$('#couponRewardTypeSelect')?.addEventListener('change', () => {
  syncCouponRewardTypeUI();
  if ($('#couponRewardTypeSelect').value === 'cosmetic') populateCouponCosmeticSelect();
  if ($('#couponRewardTypeSelect').value === 'rank') populateCouponRewardRankSelect();
});

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
  if (rewardType !== 'rank') {
    const minAmount = rewardType === 'cosmetic' ? 0 : 1;
    if (!Number.isInteger(rewardAmount) || rewardAmount < minAmount) {
      resultEl.textContent = rewardType === 'cosmetic'
        ? 'Az érvényesség csak nemnegatív egész nap lehet (0 = örökre).'
        : 'Adj meg egy érvényes jutalom-mennyiséget.';
      resultEl.className = 'redeem-result error';
      return;
    }
  }
  const rewardCosmeticId = rewardType === 'cosmetic' ? Number($('#couponCosmeticSelect').value) : undefined;
  if (rewardType === 'cosmetic' && !Number.isInteger(rewardCosmeticId)) {
    resultEl.textContent = 'Válassz ki egy kiegészítőt.';
    resultEl.className = 'redeem-result error';
    return;
  }

  const rewardRank = rewardType === 'rank' ? $('#couponRewardRankSelect').value : undefined;
  if (rewardType === 'rank' && !rewardRank) {
    resultEl.textContent = 'Válassz ki egy rangot.';
    resultEl.className = 'redeem-result error';
    return;
  }
  const rankDurationRaw = $('#couponRankDurationInput').value.trim();
  const rewardDurationDays = rewardType === 'rank' && rankDurationRaw ? Number(rankDurationRaw) : undefined;
  if (rewardType === 'rank' && rankDurationRaw && (!Number.isInteger(rewardDurationDays) || rewardDurationDays < 1)) {
    resultEl.textContent = 'A rang időtartama csak pozitív egész nap lehet (vagy hagyd üresen a véglegeshez).';
    resultEl.className = 'redeem-result error';
    return;
  }

  try {
    const url = couponEditingId ? BACKEND_URL + '/api/admin/coupons/' + couponEditingId : BACKEND_URL + '/api/admin/coupons';
    const res = await fetch(url, {
      method: couponEditingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ code, rewardType, rewardAmount, rewardCosmeticId, rewardRank, rewardDurationDays, maxUses, requiredRank, startsAt, expiresAt, active })
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
    syncCouponRewardTypeUI();
    if (item.reward_type === 'cosmetic') populateCouponCosmeticSelect(item.reward_cosmetic_id);
    populateCouponRewardRankSelect(item.reward_rank);
    $('#couponRankDurationInput').value = item.reward_duration_days || '';
    $('#couponRewardAmountInput').value = item.reward_amount;
    $('#couponMaxUsesInput').value = item.max_uses !== null ? item.max_uses : '';
    populateCouponRequiredRankSelect(item.required_rank);
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
    return c.reward_duration_days ? `${escapeHtml(rankLabel)} rang (${c.reward_duration_days} napig)` : `${escapeHtml(rankLabel)} rang (végleges)`;
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

let permCatalogCache = null;
let permRankListCache = null;
let permsMode = 'player';
let permsEditorTarget = null;

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
      imageEl.alt = 'A(z) „' + String(news.title || 'legfrissebb hír').replace(/<[^>]*>/g, '') + '” felhíváshoz csatolt kép';
      imageEl.classList.remove('hidden');
    } else {
      imageEl.classList.add('hidden');
      imageEl.src = '';
    }
    $('#homeNewsTitle').innerHTML = sanitizeRichText(news.title);
    $('#homeNewsMeta').textContent = formatLedgerDate(news.created_at);
    $('#homeNewsContent').innerHTML = sanitizeRichText(news.content);
    card.classList.remove('hidden');
  } catch {
  }
}

async function loadHomeFriends() {
  if (!session || !session.username) return;
  const grid = $('#homeFriendsGrid');
  const emptyNote = $('#homeFriendsEmpty');
  try {
    const res = await fetch(BACKEND_URL + '/api/friends/' + encodeURIComponent(session.username), { headers: { Authorization: 'Bearer ' + session.token } });
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
          <div class="player-card-name friend-card-name ${f.online ? 'online' : ''}">${f.online ? '<span class="online-dot" aria-hidden="true"></span><span class="sr-only">Online: </span>' : ''}<span class="friend-card-name-text">${escapeHtml(f.username)}</span></div>
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
  }
}

async function loadHomeStaffStats() {
  const card = $('#homeStaffStatsCard');
  if (!card || !session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/staff/my-stats', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok || !data.staff) { card.classList.add('hidden'); return; }

    const hours = Math.floor((data.onlineSeconds || 0) / 3600);
    const minutes = Math.floor(((data.onlineSeconds || 0) % 3600) / 60);
    $('#homeStaffStatPlaytime').textContent = hours > 0 ? `${hours}ó ${minutes}p` : `${minutes}p`;
    $('#homeStaffStatMutes').textContent = String(data.mutesIssued || 0);
    $('#homeStaffStatBans').textContent = String(data.bansIssued || 0);
    $('#homeStaffStatTickets').textContent = String(data.ticketsClosed || 0);
    $('#homeStaffStatsRank').textContent = data.rank || '';
    renderHomeStaffPoints(data);
    $('#homeStaffStatsMonth').textContent =
      new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }) + ' - a hónap elejétől';
    card.classList.remove('hidden');
  } catch {
    card.classList.add('hidden');
  }
}

function formatPoints(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
}

function renderHomeStaffPoints(data) {
  const strip = $('#homeStaffPoints');
  if (!strip) return;
  const cfg = data.config || {};
  $('#homeStaffPointsValue').textContent = formatPoints(data.points);
  const prevLabel = data.previousMonth
    ? new Date(data.previousMonth + '-01T12:00:00').toLocaleDateString('hu-HU', { month: 'long' })
    : 'előző hónap';
  $('#homeStaffPointsPrev').textContent = `${capitalizeFirst(prevLabel)}: ${formatPoints(data.previousPoints)} pont`;
  $('#homeStaffPointsRates').textContent =
    `Némítás ${formatPoints(cfg.perMute)} · Kitiltás ${formatPoints(cfg.perBan)} · Ticket ${formatPoints(cfg.perTicket)} pont`;
}

const WEEKDAY_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
const WEEKDAY_LONG = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h} óra ${m} perc`;
  if (h) return `${h} óra`;
  return `${m} perc`;
}

function niceHourStep(maxHours) {
  if (maxHours <= 1) return 0.25;
  if (maxHours <= 2) return 0.5;
  if (maxHours <= 5) return 1;
  if (maxHours <= 10) return 2;
  if (maxHours <= 20) return 4;
  return 6;
}

function renderPlaytimeChart(payload) {
  const chart = $('#homePlaytimeChart');
  if (!chart) return;
  const days = Array.isArray(payload && payload.days) ? payload.days : [];
  const total = days.reduce((acc, d) => acc + (Number(d.seconds) || 0), 0);
  $('#homePlaytimeTotal').textContent = formatDuration(total);
  $('#homePlaytimeEmpty').classList.toggle('hidden', total > 0);

  const maxHours = Math.max(...days.map((d) => (Number(d.seconds) || 0) / 3600), 0);
  const step = niceHourStep(maxHours);
  const top = Math.max(step, Math.ceil(maxHours / step) * step);
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  const tickLabel = (v) => (v === 0 ? '0' : (Number.isInteger(v) ? `${v}ó` : `${Math.round(v * 60)}p`));

  const parsed = days.map((d) => {
    const date = new Date(d.day + 'T12:00:00');
    return { ...d, date, isToday: d.day === payload.today };
  });
  if (parsed.length) {
    const first = parsed[0].date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
    const last = parsed[parsed.length - 1].date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
    $('#homePlaytimeRange').textContent = `${first} - ${last}`;
  }

  chart.innerHTML = `
    <div class="pt-grid" aria-hidden="true">
      ${ticks.slice().reverse().map((v) => `<div class="pt-gridline"><span>${tickLabel(v)}</span></div>`).join('')}
    </div>
    <div class="pt-bars">
      ${parsed.map((d, i) => {
        const pct = top > 0 ? Math.min(100, ((Number(d.seconds) || 0) / 3600 / top) * 100) : 0;
        const long = `${capitalizeFirst(WEEKDAY_LONG[d.date.getDay()])}, ${d.date.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric' })}`;
        return `
        <div class="pt-col${d.isToday ? ' is-today' : ''}" style="--i:${i}" tabindex="0"
             data-tip="${escapeHtml(long)}" data-value="${escapeHtml(formatDuration(d.seconds))}"
             aria-label="${escapeHtml(long)}: ${escapeHtml(formatDuration(d.seconds))}">
          <div class="pt-track"><div class="pt-bar${d.seconds > 0 ? '' : ' is-zero'}" style="--h:${pct.toFixed(2)}%"></div></div>
          <span class="pt-day">${d.isToday ? 'Ma' : WEEKDAY_SHORT[d.date.getDay()]}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="pt-tooltip" hidden></div>
  `;

  const tbody = $('#homePlaytimeTable tbody');
  if (tbody) {
    tbody.innerHTML = parsed.map((d) =>
      `<tr><td>${escapeHtml(d.date.toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' }))}</td><td>${escapeHtml(formatDuration(d.seconds))}</td></tr>`
    ).join('');
  }
}

function bindPlaytimeTooltip() {
  const chart = $('#homePlaytimeChart');
  if (!chart || chart.__tipBound) return;
  chart.__tipBound = true;
  const show = (col) => {
    const tip = $('.pt-tooltip', chart);
    if (!tip || !col) return;
    tip.innerHTML = `<span>${col.dataset.tip}</span><b>${col.dataset.value}</b>`;
    tip.hidden = false;
    const cr = chart.getBoundingClientRect();
    const r = col.getBoundingClientRect();
    const bar = $('.pt-bar', col);
    const br = bar ? bar.getBoundingClientRect() : r;
    const x = r.left + r.width / 2 - cr.left;
    const half = tip.offsetWidth / 2;
    tip.style.left = Math.max(half, Math.min(cr.width - half, x)) + 'px';
    tip.style.top = Math.max(0, (br.top - cr.top) - 10) + 'px';
    $$('.pt-col', chart).forEach((c) => c.classList.toggle('is-hover', c === col));
  };
  const hide = () => {
    const tip = $('.pt-tooltip', chart);
    if (tip) tip.hidden = true;
    $$('.pt-col', chart).forEach((c) => c.classList.remove('is-hover'));
  };
  chart.addEventListener('pointerover', (e) => show(e.target.closest('.pt-col')));
  chart.addEventListener('pointerleave', hide);
  chart.addEventListener('focusin', (e) => show(e.target.closest('.pt-col')));
  chart.addEventListener('focusout', hide);
}

async function loadHomePlaytimeWeek() {
  const card = $('#homePlaytimeCard');
  if (!card || !session || !session.token) return;
  bindPlaytimeTooltip();
  try {
    const res = await fetch(BACKEND_URL + '/api/me/playtime/week', { headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) throw new Error('bad');
    $('#homePlaytimeEmpty').textContent = 'Ezen a héten még nem játszottál - amint felcsatlakozol a szerverre, itt látod majd a napi bontást.';
    renderPlaytimeChart(data);
  } catch {
    renderPlaytimeChart({ days: [], today: '' });
    $('#homePlaytimeEmpty').textContent = 'A heti bontás most nem tölthető be - próbáld újra később.';
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

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-buy[data-item-id]');
  if (btn) buyItem(btn.dataset.itemId, btn);
});

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
    loadShopCatalog();
    showPurchaseSuccessModal();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
  }
}

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
  pendingDiscordLinkToken = null;
  clearDiscordLinkParam();

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

function giftItemLabel(gift) {
  if (gift.item_type === 'rank') return gift.label ? `a(z) ${escapeHtml(gift.label)} rangot` : 'egy rangot';
  if (typeof gift.amount === 'number' && gift.amount > 0) return formatPp(gift.amount);
  return gift.label ? escapeHtml(gift.label) : 'egy terméket';
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
  }
}

function loadDiscordWidget() {}

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

let analyticsDays = 7;

async function loadAnalytics() {
  const chart = $('#analyticsChart');
  const empty = $('#analyticsEmpty');
  if (!session || !session.token) return;

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

  const daily = Array.isArray(data.daily) ? data.daily : [];
  empty.classList.toggle('hidden', daily.length > 0);
  empty.textContent = 'Erre az időszakra még nincs adat.';
  const max = daily.reduce((m, d) => Math.max(m, d.visitors), 0) || 1;
  const step = Math.max(1, Math.ceil(daily.length / 10));
  chart.innerHTML = daily.map((d, i) => {
    const pct = Math.max(2, Math.round((d.visitors / max) * 100));
    const label = i % step === 0 ? `<small>${escapeHtml(d.day.slice(5))}</small>` : '';
    const tip = `${d.day}: ${d.visitors} látogató, ${d.views} megtekintés`;
    return `<div class="analytics-bar" title="${escapeHtml(tip)}"><i style="height:${pct}%"></i>${label}</div>`;
  }).join('');

  renderAnalyticsRows('#analyticsPaths', data.topPaths, (r) => r.path === '/egyeb' ? 'egyéb / ismeretlen' : r.path, (r) => r.views, 'megtekintés');
  renderAnalyticsRows('#analyticsDevices', data.devices, (r) => r.device, (r) => r.visitors, '');
  renderAnalyticsRows('#analyticsRefs', data.referrers, (r) => r.ref.replace(/^https?:\/\//, ''), (r) => r.visitors, '');
}

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

const RARITY_LABELS = { common: 'Általános', rare: 'Ritka', epic: 'Epikus', legendary: 'Legendás', mythic: 'Mítikus' };

let cosmeticAssetBust = 0;

function cosmeticAssetSuffix() {
  return cosmeticAssetBust ? '?b=' + cosmeticAssetBust : '';
}

function cosmeticTextureUrl(id) {
  return BACKEND_URL + '/api/cosmetics/texture/' + id + cosmeticAssetSuffix();
}

function cosmeticModelUrl(id) {
  return BACKEND_URL + '/api/cosmetics/model/' + id + cosmeticAssetSuffix();
}

const cosmeticThumbCache = new Map();

function cosmeticThumbHtml(c) {
  const cached = cosmeticThumbCache.get(c.id);
  if (cached) return `<img class="cosmetic-thumb" src="${cached}" alt="${escapeHtml(c.name || 'Kiegészítő')} előnézeti képe" />`;
  return `<div class="cosmetic-thumb cosmetic-thumb-empty" data-cosmetic-thumb="${c.id}" data-cosmetic-name="${escapeHtml(c.name || '')}"></div>`;
}

function cosmeticCardThumbHtml(c) {
  return `<div class="cosmetic-thumb-ring">${cosmeticThumbHtml(c)}</div>`;
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
async function fetchCosmeticModel(id, opts) {
  const fresh = !!(opts && opts.fresh);
  const flat = !!(opts && opts.flat);
  if (!fresh && !flat && cosmeticModelCache.has(id)) return cosmeticModelCache.get(id);
  try {
    const url = flat
      ? BACKEND_URL + '/api/admin/cosmetics/' + id + '/model' + cosmeticAssetSuffix()
      : cosmeticModelUrl(id);
    const res = await fetch(url, flat
      ? { cache: 'no-store', headers: { Authorization: 'Bearer ' + session.token } }
      : (fresh ? { cache: 'no-store' } : undefined));
    if (!res.ok) return null;
    const model = await res.json();
    if (!flat) cosmeticModelCache.set(id, model);
    return model;
  } catch {
    return null;
  }
}

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

let myCosmetics = { owned: [], loadout: {}, slots: [] };

const cosmeticFilter = { search: '', slot: '', rarity: '', animatedOnly: false };

function cosmeticMatchesFilter(c) {
  if (!c) return false;
  if (cosmeticFilter.slot && c.slot !== cosmeticFilter.slot) return false;
  if (cosmeticFilter.rarity && c.rarity !== cosmeticFilter.rarity) return false;
  if (cosmeticFilter.animatedOnly && !c.animated) return false;
  if (cosmeticFilter.search) {
    const hay = ((c.name || '') + ' ' + (c.description || '')).toLowerCase();
    if (!hay.includes(cosmeticFilter.search)) return false;
  }
  return true;
}

function cosmeticAnimatedTag(c) {
  return c && c.animated ? '<span class="cosmetic-tag cosmetic-tag-animated" title="Ez a kiegészítő mozog a játékban">Animált</span>' : '';
}

function bindCosmeticFilterControls() {
  const search = $('#cosmeticFilterSearch');
  if (!search || search.dataset.bound) return;
  search.dataset.bound = '1';
  const apply = () => {
    cosmeticFilter.search = ($('#cosmeticFilterSearch').value || '').trim().toLowerCase();
    cosmeticFilter.slot = $('#cosmeticFilterSlot').value || '';
    cosmeticFilter.rarity = $('#cosmeticFilterRarity').value || '';
    cosmeticFilter.animatedOnly = $('#cosmeticFilterAnimated').checked;
    renderOwnedCosmetics();
    renderCosmeticShopGrid();
  };
  ['#cosmeticFilterSearch', '#cosmeticFilterSlot', '#cosmeticFilterRarity', '#cosmeticFilterAnimated']
    .forEach((sel) => {
      $(sel)?.addEventListener('input', apply);
      $(sel)?.addEventListener('change', apply);
    });
}
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
  bindCosmeticFilterControls();
  const slotFilter = $('#cosmeticFilterSlot');
  if (slotFilter && slotFilter.options.length <= 1 && myCosmetics.slots.length) {
    slotFilter.insertAdjacentHTML('beforeend', myCosmetics.slots
      .map((sl) => `<option value="${escapeHtml(sl.id)}">${escapeHtml(sl.label)}</option>`).join(''));
  }
  renderCosmeticSlotBar();
  renderOwnedCosmetics();
  renderCosmeticSummary();
  loadCosmeticShop();
  renderCosmeticCharacterPreview();
}

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
  stopCosmeticCharPreview = SkinPreview.start(canvas, skinImg, slim, capeImg, cosmetics, null, { wheelZoom: true, spin: cosmeticPreviewSpin });
  syncCosmeticZoomRange();
  syncCosmeticSpinButton();
}

let cosmeticPreviewSpin = (() => {
  try { return localStorage.getItem('solaryn.cosmeticSpin') !== 'off'; } catch { return true; }
})();

function syncCosmeticSpinButton() {
  const btn = $('#cosmeticSpinBtn');
  if (!btn) return;
  btn.classList.toggle('is-paused', !cosmeticPreviewSpin);
  btn.setAttribute('aria-pressed', cosmeticPreviewSpin ? 'true' : 'false');
  const label = cosmeticPreviewSpin ? 'Forgás megállítása' : 'Forgás indítása';
  btn.setAttribute('aria-label', label);
  btn.title = label;
}

$('#cosmeticSpinBtn')?.addEventListener('click', () => {
  cosmeticPreviewSpin = !cosmeticPreviewSpin;
  try { localStorage.setItem('solaryn.cosmeticSpin', cosmeticPreviewSpin ? 'on' : 'off'); } catch {}
  stopCosmeticCharPreview?.setSpin?.(cosmeticPreviewSpin);
  syncCosmeticSpinButton();
});

function syncCosmeticZoomRange() {
  const range = $('#cosmeticZoomRange');
  if (!range || !stopCosmeticCharPreview?.getZoomLevel) return;
  range.value = String(Math.round(stopCosmeticCharPreview.getZoomLevel() * 100));
}

$('#cosmeticZoomInBtn')?.addEventListener('click', () => {
  stopCosmeticCharPreview?.zoomBy?.(1.25);
  syncCosmeticZoomRange();
});
$('#cosmeticZoomOutBtn')?.addEventListener('click', () => {
  stopCosmeticCharPreview?.zoomBy?.(1 / 1.25);
  syncCosmeticZoomRange();
});
$('#cosmeticZoomResetBtn')?.addEventListener('click', () => {
  stopCosmeticCharPreview?.resetView?.();
  syncCosmeticZoomRange();
});
$('#cosmeticZoomRange')?.addEventListener('input', (e) => {
  stopCosmeticCharPreview?.setZoomLevel?.(Number(e.target.value) / 100);
});
$('#cosmeticCharPreview')?.addEventListener('wheel', () => setTimeout(syncCosmeticZoomRange, 0), { passive: true });
$('#cosmeticCharPreview')?.addEventListener('touchend', syncCosmeticZoomRange);

function renderCosmeticSummary() {
  const owned = myCosmetics.owned || [];
  const equipped = Object.keys(myCosmetics.loadout || {}).length;
  const animated = owned.filter((c) => c.animated).length;

  const set = (id, value) => { const el = $(id); if (el) el.textContent = String(value); };
  set('#cosmeticSummaryOwned', owned.length);
  set('#cosmeticSummaryEquipped', equipped);
  set('#cosmeticSummaryAnimated', animated);

  const bars = $('#cosmeticSummaryBars');
  if (bars) {
    const order = ['mythic', 'legendary', 'epic', 'rare', 'common'];
    const counts = new Map();
    for (const c of owned) counts.set(c.rarity, (counts.get(c.rarity) || 0) + 1);
    const max = Math.max(1, ...counts.values());
    bars.innerHTML = order.filter((r) => counts.has(r)).map((r) => `
      <div class="cosmetic-summary-bar-row rarity-${escapeHtml(r)}">
        <div class="cosmetic-summary-bar-head">
          <span>${escapeHtml(RARITY_LABELS[r] || r)}</span><strong>${counts.get(r)}</strong>
        </div>
        <div class="cosmetic-summary-bar-track">
          <div class="cosmetic-summary-bar-fill" style="width:${Math.round(counts.get(r) / max * 100)}%"></div>
        </div>
      </div>
    `).join('');
  }

  const note = $('#cosmeticSummaryNote');
  if (note) {
    const freeSlots = (myCosmetics.slots || []).length - equipped;
    note.textContent = !owned.length
      ? 'Még nincs kiegészítőd - a lenti kínálatból vásárolhatsz, vagy nézd meg a Piacot.'
      : freeSlots > 0
        ? `Még ${freeSlots} helyre vehetsz fel kiegészítőt.`
        : 'Minden helyed foglalt - egy újabb felvételéhez előbb vegyél le egyet.';
  }
}

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
  const activePill = document.querySelector('.skin-model-toggle .pill.active');
  return !!(activePill && activePill.dataset.model === 'slim');
}

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
  const visible = myCosmetics.owned.filter(cosmeticMatchesFilter);
  if (!wrap) return;
  if (myCosmetics.owned.length && !visible.length) {
    wrap.innerHTML = '<div class="card"><p class="page-note" style="margin:0;">Nincs a szűrésnek megfelelő kiegészítőd.</p></div>';
    return;
  }
  if (!myCosmetics.owned.length) {
    wrap.innerHTML = '<div class="card"><p class="redeem-result">Még nincs egyetlen kiegészítőd sem. Vásárolj a lenti kínálatból, vagy nézd meg a Piacot.</p></div>';
    return;
  }
  wrap.innerHTML = `<div class="cosmetic-grid">${visible.map((c) => `
    <div class="cosmetic-card ${c.equipped ? 'equipped' : ''} rarity-${escapeHtml(c.rarity)}">
      ${cosmeticCardThumbHtml(c)}
      <div class="cosmetic-card-name">${escapeHtml(c.name)}</div>
      <div class="cosmetic-card-tags">
        <span class="cosmetic-tag">${escapeHtml(c.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}</span>
        ${cosmeticAnimatedTag(c)}
      </div>
      <div class="cosmetic-card-meta">${cosmeticExpiryHtml(c.expiresAt)}</div>
      ${c.equipped
        ? `<button type="button" class="btn-outline cosmetic-action" data-cosmetic-unequip="${escapeHtml(c.slot)}">Levétel</button>`
        : `<button type="button" class="btn-glow cosmetic-action" data-cosmetic-equip="${c.id}">Felvétel</button>`}
    </div>
  `).join('')}</div>`;
  hydrateCosmeticThumbs(wrap);
}

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
  renderCosmeticShopGrid();
}

function renderCosmeticShopGrid() {
  const wrap = $('#cosmeticsShopWrap');
  if (!wrap) return;
  const ownedIds = new Set(myCosmetics.owned.map((c) => c.id));
  const all = cosmeticShopItems.filter((c) => c.priceSc !== null && c.priceSc !== undefined && !ownedIds.has(c.id) && c.hasModel);
  const buyable = all.filter(cosmeticMatchesFilter);
  if (!buyable.length) {
    wrap.innerHTML = all.length
      ? '<div class="card"><p class="page-note" style="margin:0;">Nincs a szűrésnek megfelelő megvásárolható kiegészítő.</p></div>'
      : '<div class="card"><p class="redeem-result">Jelenleg nincs megvásárolható kiegészítő - nézd meg a Piacot, ott a játékosoktól is vehetsz.</p></div>';
    return;
  }
  wrap.innerHTML = `<div class="cosmetic-grid">${buyable.map((c) => `
    <div class="cosmetic-card rarity-${escapeHtml(c.rarity)}">
      ${cosmeticCardThumbHtml(c)}
      <div class="cosmetic-card-name">${escapeHtml(c.name)}</div>
      <div class="cosmetic-card-tags">
        <span class="cosmetic-tag">${escapeHtml(c.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}</span>
        ${cosmeticAnimatedTag(c)}
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
    const confirmed = await confirmModal(
      'Kiegészítő megvásárlása',
      `Megveszed a(z) "${escapeHtml(item.name)}" kiegészítőt ${item.priceSc.toLocaleString('hu-HU')} PrémiumPontért? A levonás a következő szerverre lépésedkor történik meg, utána jelenik meg a kiegészítőid között.`,
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

let marketTaxPercent = 10;

async function loadMarket() {
  if (!session || !session.token) return;
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
      ${cosmeticCardThumbHtml(l.cosmetic)}
      <div class="cosmetic-card-name">${escapeHtml(l.cosmetic.name)}</div>
      <div class="cosmetic-card-tags">
        <span class="cosmetic-tag">${escapeHtml(l.cosmetic.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[l.cosmetic.rarity] || l.cosmetic.rarity)}</span>
        ${cosmeticAnimatedTag(l.cosmetic)}
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

let tradeTaxPercent = 10;

async function loadTrades() {
  if (!session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/mine', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) myCosmetics = { owned: data.owned || [], loadout: data.loadout || {}, slots: data.slots || [] };
  } catch {  }

  renderTradeSendForm();

  let payload = null;
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/trades', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) payload = data;
  } catch {  }

  if (!payload) {
    const msg = '<div class="card"><p class="redeem-result error">Nem sikerült lekérni a csere ajánlatokat.</p></div>';
    $('#tradesIncomingWrap').innerHTML = msg;
    $('#tradesOutgoingWrap').innerHTML = '';
    $('#tradesHistoryWrap').innerHTML = '';
    return;
  }

  if (typeof payload.taxPercent === 'number') {
    tradeTaxPercent = payload.taxPercent;
    const note = $('#tradeTaxNote');
    if (note) note.textContent = tradeTaxPercent + '%';
    updateTradePayoutPreview();
  }
  const ttlNote = $('#tradeTtlNote');
  if (ttlNote && typeof payload.ttlDays === 'number') ttlNote.textContent = String(payload.ttlDays);

  renderTradeList($('#tradesIncomingWrap'), payload.incoming, 'incoming');
  renderTradeList($('#tradesOutgoingWrap'), payload.outgoing, 'outgoing');
  renderTradeList($('#tradesHistoryWrap'), payload.history, 'history');
  setTradeBadge(payload.incoming.filter((o) => o.status === 'pending').length);
}

const TRADE_STATUS_LABELS = {
  accepted: 'Elfogadva',
  declined: 'Elutasítva',
  cancelled: 'Visszavonva',
  expired: 'Lejárt',
  reserved: 'Folyamatban'
};

function tradePriceHtml(offer) {
  if (offer.priceSc === 0) return '<div class="trade-row-price">Ajándék</div>';
  return `<div class="trade-row-price">${offer.priceSc.toLocaleString('hu-HU')} PP<small>neki ${offer.payoutSc.toLocaleString('hu-HU')} PP</small></div>`;
}

function renderTradeList(wrap, offers, kind) {
  if (!wrap) return;
  const list = Array.isArray(offers) ? offers : [];
  if (!list.length) {
    const empty = {
      incoming: 'Nincs beérkezett csere ajánlatod.',
      outgoing: 'Nincs elküldött csere ajánlatod.',
      history: 'Még nincs lezárult csere ajánlatod.'
    }[kind];
    wrap.innerHTML = `<div class="card"><p class="redeem-result">${empty}</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="trade-list">${list.map((offer) => {
    const who = kind === 'incoming' || (kind === 'history' && !offer.isSender)
      ? `tőle: ${escapeHtml(offer.sender)}`
      : `neki: ${escapeHtml(offer.recipient)}`;

    let actions = '';
    if (offer.status === 'pending' && kind === 'incoming') {
      actions = `
        <div class="trade-row-actions">
          <button type="button" class="btn-glow" data-trade-accept="${offer.id}">Elfogadás</button>
          <button type="button" class="btn-outline" data-trade-decline="${offer.id}">Elutasítás</button>
        </div>`;
    } else if (offer.status === 'pending' && kind === 'outgoing') {
      actions = `<div class="trade-row-actions"><button type="button" class="btn-outline" data-trade-cancel="${offer.id}">Visszavonás</button></div>`;
    } else {
      const label = TRADE_STATUS_LABELS[offer.status] || offer.status;
      actions = `<span class="trade-status ${escapeHtml(offer.status)}">${escapeHtml(label)}</span>`;
    }

    const when = offer.resolvedAt || offer.createdAt;
    return `
      <div class="trade-row">
        ${offer.cosmetic ? cosmeticThumbHtml(offer.cosmetic) : '<div class="cosmetic-thumb cosmetic-thumb-empty"></div>'}
        <div class="trade-row-main">
          <div class="trade-row-name">${escapeHtml(offer.cosmetic?.name || 'Ismeretlen kiegészítő')}</div>
          <div class="trade-row-meta">${who}${when ? ' · ' + escapeHtml(formatLedgerDate(when)) : ''}</div>
          ${offer.message ? `<div class="trade-row-message">${escapeHtml(offer.message)}</div>` : ''}
        </div>
        ${tradePriceHtml(offer)}
        ${actions}
      </div>`;
  }).join('')}</div>`;
  hydrateCosmeticThumbs(wrap);
}

function renderTradeSendForm() {
  const select = $('#tradeCosmeticSelect');
  if (!select) return;
  const offerable = myCosmetics.owned.filter((c) => c.tradable);
  if (!offerable.length) {
    select.innerHTML = '<option value="">Nincs továbbadható kiegészítőd</option>';
    $('#tradeSendBtn').disabled = true;
  } else {
    select.innerHTML = offerable
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(c.slotLabel)})</option>`).join('');
    $('#tradeSendBtn').disabled = false;
  }
  updateTradePayoutPreview();
}

function updateTradePayoutPreview() {
  const el = $('#tradePayoutPreview');
  if (!el) return;
  const raw = $('#tradePriceInput')?.value;
  const price = Number(raw);
  if (raw === '' || !Number.isInteger(price) || price < 0) { el.innerHTML = ''; return; }
  if (price === 0) {
    el.innerHTML = '<div class="market-payout-row market-payout-total"><span>Ajándék</span><strong>0 PP</strong></div>';
    return;
  }
  const payout = Math.floor(price * (100 - tradeTaxPercent) / 100);
  el.innerHTML = `
    <div class="market-payout-row"><span>Ő fizet</span><strong>${price.toLocaleString('hu-HU')} PP</strong></div>
    <div class="market-payout-row market-payout-tax"><span>Adó (${tradeTaxPercent}%)</span><strong>-${(price - payout).toLocaleString('hu-HU')} PP</strong></div>
    <div class="market-payout-row market-payout-total"><span>Te kapsz</span><strong>${payout.toLocaleString('hu-HU')} PP</strong></div>
  `;
}
$('#tradePriceInput')?.addEventListener('input', updateTradePayoutPreview);

function setTradeBadge(count) {
  const badge = $('#navTradeBadge');
  if (!badge) return;
  badge.textContent = String(count);
  badge.classList.toggle('hidden', !count);
}

async function refreshTradeBadge() {
  if (!session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/trades/count', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (data.ok) setTradeBadge(data.incoming || 0);
  } catch {  }
}

$('#tradeSendBtn')?.addEventListener('click', async () => {
  const resultEl = $('#tradeSendResult');
  const setError = (msg) => { resultEl.textContent = msg; resultEl.className = 'redeem-result error'; };

  const recipient = ($('#tradeRecipientInput').value || '').trim();
  const cosmeticId = Number($('#tradeCosmeticSelect').value);
  const rawPrice = $('#tradePriceInput').value;
  const priceSc = Number(rawPrice);
  const message = ($('#tradeMessageInput').value || '').trim();

  if (!/^[A-Za-z0-9_]{3,16}$/.test(recipient)) return setError('Adj meg egy érvényes játékosnevet.');
  if (!Number.isInteger(cosmeticId)) return setError('Válassz egy kiegészítőt.');
  if (rawPrice === '' || !Number.isInteger(priceSc) || priceSc < 0) return setError('Adj meg egy érvényes árat (0 = ajándék).');

  const payout = Math.floor(priceSc * (100 - tradeTaxPercent) / 100);
  const confirmed = await confirmModal(
    'Csere ajánlat küldése',
    priceSc === 0
      ? `Odaadod ezt a kiegészítőt ${recipient} játékosnak ingyen? Amíg nem dönt, nem tudod viselni.`
      : `Felajánlod ${recipient} játékosnak ${priceSc.toLocaleString('hu-HU')} PP-ért? Amíg nem dönt, nem tudod viselni a kiegészítőt. Elfogadáskor ${tradeTaxPercent}% adó vonódik le, tehát ${payout.toLocaleString('hu-HU')} PP lesz a tiéd.`,
    'Igen, elküldöm'
  );
  if (!confirmed) return;

  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/trades/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ recipient, cosmeticId, priceSc, message })
    });
    const data = await res.json();
    if (!data.ok) return setError(data.message || 'Nem sikerült elküldeni az ajánlatot.');
    resultEl.textContent = '';
    $('#tradeRecipientInput').value = '';
    $('#tradePriceInput').value = '';
    $('#tradeMessageInput').value = '';
    updateTradePayoutPreview();
    showToast('Csere ajánlat elküldve.');
    loadTrades();
  } catch {
    setError('Nem sikerült elérni a szervert.');
  }
});

document.addEventListener('click', async (e) => {
  const acceptBtn = e.target.closest('[data-trade-accept]');
  if (acceptBtn) {
    const confirmed = await confirmModal(
      'Ajánlat elfogadása',
      'Elfogadod ezt az ajánlatot? A PrémiumPont levonása a következő szerverre lépésedkor történik meg - utána kerül át hozzád a kiegészítő. Ha nincs elég PrémiumPontod, az elfogadás visszavonódik.',
      'Igen, elfogadom'
    );
    if (!confirmed) return;
    acceptBtn.disabled = true;
    await tradeAction('/api/cosmetics/trades/accept', Number(acceptBtn.dataset.tradeAccept), null, () => { acceptBtn.disabled = false; });
    return;
  }

  const declineBtn = e.target.closest('[data-trade-decline]');
  if (declineBtn) {
    const confirmed = await confirmModal('Ajánlat elutasítása', 'Elutasítod ezt az ajánlatot? A kiegészítő visszakerül a küldőhöz.', 'Igen, elutasítom');
    if (!confirmed) return;
    await tradeAction('/api/cosmetics/trades/decline', Number(declineBtn.dataset.tradeDecline), 'Ajánlat elutasítva.');
    return;
  }

  const cancelTradeBtn = e.target.closest('[data-trade-cancel]');
  if (cancelTradeBtn) {
    const confirmed = await confirmModal('Ajánlat visszavonása', 'Visszavonod az ajánlatot? A kiegészítő visszakerül hozzád.', 'Igen, visszavonom');
    if (!confirmed) return;
    await tradeAction('/api/cosmetics/trades/cancel', Number(cancelTradeBtn.dataset.tradeCancel), 'Ajánlat visszavonva.');
  }
});

async function tradeAction(path, offerId, successToast, onError) {
  try {
    const res = await fetch(BACKEND_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ offerId })
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.message || 'A művelet nem sikerült.', true);
      if (onError) onError();
      return;
    }
    showToast(successToast || data.message || 'Kész.');
    loadTrades();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
    if (onError) onError();
  }
}

let cosmeticsAdminItems = [];
let cosmeticEditingId = null;
let cosmeticSelectedTextureFile = null;

let cosmeticParts = [];
let cosmeticTarget = -1;
let cosmeticAssembly = null;

function emptyAssembly() {
  return {
    offsetX: 0, offsetY: 0, offsetZ: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    scale: 1, itemModelSpace: true, anim: null
  };
}

function emptyPart(idx) {
  return {
    id: null, idx, name: null,
    offsetX: 0, offsetY: 0, offsetZ: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    scale: 1, anim: null,
    hasModel: false,
    elements: null, textureSize: null,
    file: null,
    dirty: false
  };
}

function currentTargetRecord() {
  if (cosmeticTarget < 0) return cosmeticAssembly;
  return cosmeticParts[cosmeticTarget] || cosmeticAssembly;
}
let allCosmeticsCache = [];

function resetCosmeticForm() {
  cosmeticEditingId = null;
  cosmeticSelectedTextureFile = null;
  cosmeticPetMeta = null;
  petSkinFile = null;
  petSkinIsLegacy = false;
  cosmeticAura = null;
  cosmeticGameEffects = [];
  cosmeticEffectServers = [];
  cosmeticAssembly = emptyAssembly();
  cosmeticParts = [emptyPart(0)];
  $('#cosmeticRigBox')?.classList.add('hidden');
  $('#cosmeticBbmodelNote') && ($('#cosmeticBbmodelNote').textContent = '');
  $('#cosmeticBbmodelWarnings') && ($('#cosmeticBbmodelWarnings').innerHTML = '');
  cosmeticTarget = -1;
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
  cosmeticEditorTexture = null;
  renderCosmeticPartsBar();
  renderCosmeticAnimEditor();
  renderCosmeticAuraEditor();
  renderCosmeticEffectEditor();
  queueEditorRefresh();
}

$('#cosmeticModelPickBtn')?.addEventListener('click', () => $('#cosmeticModelInput').click());
$('#cosmeticTexturePickBtn')?.addEventListener('click', () => $('#cosmeticTextureInput').click());

let cosmeticModelTargetPart = 0;

$('#cosmeticModelInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  const note = $('#cosmeticModelNote');
  const isNewPart = cosmeticModelTargetPart >= cosmeticParts.length;
  if (!file) {
    if (!isNewPart) note.textContent = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    let parsed = null;
    let count = 0;
    try {
      parsed = JSON.parse(reader.result);
      count = Array.isArray(parsed.elements) ? parsed.elements.length : 0;
    } catch {
      parsed = null;
    }
    if (!parsed || !count) {
      const msg = parsed
        ? `${file.name} - FIGYELEM: nem találtam "elements" tömböt benne.`
        : `${file.name} - FIGYELEM: nem érvényes JSON.`;
      if (isNewPart) { showToast(msg, true); return; }
      note.textContent = msg;
      cosmeticParts[cosmeticModelTargetPart].elements = null;
      cosmeticParts[cosmeticModelTargetPart].file = null;
      renderCosmeticPartsBar();
      restartCosmeticEditor();
      return;
    }

    if (isNewPart) {
      await createCosmeticPart(file, parsed);
      return;
    }

    const part = cosmeticParts[cosmeticModelTargetPart];
    part.file = file;
    part.elements = parsed.elements;
    part.textureSize = Array.isArray(parsed.texture_size) ? parsed.texture_size : null;
    part.hasModel = true;
    part.dirty = true;
    if (cosmeticModelTargetPart === 0) note.textContent = `${file.name} - ${count} kocka`;

    if (!cosmeticEditingId) autoFitCosmetic();
    renderCosmeticPartsBar();
    restartCosmeticEditor();
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

const PET_LOCAL_ORIGIN = [0, 0, 0];

function petFaceUvs(u, v, w, h, d, su, sv) {
  const rect = (x, y, rw, rh) => [x * su, y * sv, (x + rw) * su, (y + rh) * sv];
  const flip = (r) => [r[2], r[3], r[0], r[1]];
  return {
    north: { uv: rect(u + d, v + d, w, h) },
    south: { uv: rect(u + d + w + d, v + d, w, h) },
    east:  { uv: rect(u, v + d, d, h) },
    west:  { uv: rect(u + d + w, v + d, d, h) },
    up:    { uv: flip(rect(u + d, v, w, d)) },
    down:  { uv: rect(u + d + w, v, w, d) }
  };
}

function buildShoulderPetModel(opts) {
  const slim = !!opts.slim;
  const legacy = !!opts.legacy;
  const armW = slim ? 3 : 4;
  const S = opts.scale;
  const legAngle = opts.legAngle;

  const su = 16 / 64;
  const sv = legacy ? 16 / 32 : 16 / 64;

  const shoulderX = 4 + 4 / 2;
  const tx = opts.side === 'right' ? shoulderX : -shoulderX;

  const elements = [];
  const place = (p) => [
    Math.round((p[0] * S + tx) * 1000) / 1000,
    Math.round((p[1] * S) * 1000) / 1000,
    Math.round((p[2] * S) * 1000) / 1000
  ];

  function box(from, to, uvOrigin, w, h, d, extra) {
    const el = {
      from: place(from),
      to: place(to),
      faces: petFaceUvs(uvOrigin[0], uvOrigin[1], w, h, d, su, sv)
    };
    if (extra && extra.inflate) el.inflate = Math.round(extra.inflate * S * 1000) / 1000;
    if (extra && typeof extra.legRotation === 'number' && extra.legRotation !== 0) {
      el.rotation = { angle: extra.legRotation, axis: 'x', origin: place(PET_LOCAL_ORIGIN) };
    }
    elements.push(el);
  }

  box([-4, 12, -4], [4, 20, 4], [0, 0], 8, 8, 8);
  box([-4, 0, -2], [4, 12, 2], [16, 16], 8, 12, 4);
  box([4, 0, -2], [4 + armW, 12, 2], [40, 16], armW, 12, 4);
  box([-4 - armW, 0, -2], [-4, 12, 2], legacy ? [40, 16] : [32, 48], armW, 12, 4);
  box([0, -12, -2], [4, 0, 2], [0, 16], 4, 12, 4, { legRotation: legAngle });
  box([-4, -12, -2], [0, 0, 2], legacy ? [0, 16] : [16, 48], 4, 12, 4, { legRotation: legAngle });

  const INFLATE = 0.3;
  box([-4, 12, -4], [4, 20, 4], [32, 0], 8, 8, 8, { inflate: INFLATE });
  if (!legacy) {
    box([-4, 0, -2], [4, 12, 2], [16, 32], 8, 12, 4, { inflate: INFLATE });
    box([4, 0, -2], [4 + armW, 12, 2], [40, 32], armW, 12, 4, { inflate: INFLATE });
    box([-4 - armW, 0, -2], [-4, 12, 2], [48, 48], armW, 12, 4, { inflate: INFLATE });
    box([0, -12, -2], [4, 0, 2], [0, 32], 4, 12, 4, { inflate: INFLATE, legRotation: legAngle });
    box([-4, -12, -2], [0, 0, 2], [0, 48], 4, 12, 4, { inflate: INFLATE, legRotation: legAngle });
  }

  return {
    model: { texture_size: [64, legacy ? 32 : 64], elements },
    seatPivot: place(PET_LOCAL_ORIGIN)
  };
}

function shoulderPetAnim(seatPivot) {
  return {
    pivot: seatPivot,
    tracks: [
      { type: 'translate', axis: 'y', amp: 0.45, speed: 0.45, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'rotate', axis: 'z', amp: 2.5, speed: 0.22, phase: 90, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ]
  };
}

let petSkinFile = null;
let petSkinIsLegacy = false;
let cosmeticPetMeta = null;

$('#petSkinPickBtn')?.addEventListener('click', () => $('#petSkinInput').click());

$('#petSkinInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  const note = $('#petSkinNote');
  const btn = $('#petGenerateBtn');
  petSkinFile = null;
  if (btn) btn.disabled = true;
  if (!file) { if (note) note.textContent = ''; return; }

  const reader = new FileReader();
  reader.onload = () => {
    loadImage(reader.result).then((img) => {
      const w = img?.naturalWidth || 0;
      const h = img?.naturalHeight || 0;
      if (!w || !h || w < 64 || (h !== w && h * 2 !== w)) {
        if (note) note.textContent = `${file.name} - FIGYELEM: ez nem szabványos skin (${w}x${h}). 64x64 (vagy nagyobb, azonos arányú) illetve 64x32 kell.`;
        return;
      }
      petSkinIsLegacy = h * 2 === w;
      petSkinFile = file;
      if (note) note.textContent = `${file.name} - ${w}x${h}${petSkinIsLegacy ? ' (régi formátum)' : ''}`;
      if (btn) btn.disabled = false;
    });
  };
  reader.readAsDataURL(file);
});

function readPetMeta() {
  return {
    side: $('#petSideSelect').value === 'right' ? 'right' : 'left',
    scale: Number($('#petScaleInput').value),
    legAngle: Number($('#petLegAngleInput').value),
    slim: !!$('#petSlimCheckbox').checked,
    anim: !!$('#petAnimCheckbox').checked
  };
}

function writePetMeta(meta) {
  if (!meta || !$('#petSideSelect')) return;
  $('#petSideSelect').value = meta.side === 'right' ? 'right' : 'left';
  if (Number.isFinite(Number(meta.scale))) $('#petScaleInput').value = meta.scale;
  if (Number.isFinite(Number(meta.legAngle))) $('#petLegAngleInput').value = meta.legAngle;
  $('#petSlimCheckbox').checked = !!meta.slim;
  $('#petAnimCheckbox').checked = meta.anim !== false;
}

async function loadPetSkinFromCosmetic(item) {
  const note = $('#petSkinNote');
  const btn = $('#petGenerateBtn');
  petSkinFile = null;
  if (btn) btn.disabled = true;
  if (!item.hasTexture) {
    if (note) note.textContent = 'Ehhez a figurához nincs textúra - válassz egy skint az újrageneráláshoz.';
    return;
  }
  if (note) note.textContent = 'A jelenlegi skin betöltése...';
  try {
    const res = await fetch(cosmeticTextureUrl(item.id), { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const file = new File([blob], item.slug + '.png', { type: 'image/png' });
    const img = await loadImage(URL.createObjectURL(blob));
    const w = img?.naturalWidth || 0;
    const h = img?.naturalHeight || 0;
    if (!w || !h || w < 64 || (h !== w && h * 2 !== w)) {
      if (note) note.textContent = 'A jelenlegi textúra nem szabványos skin (' + w + 'x' + h + ') - válassz egy skint az újrageneráláshoz.';
      return;
    }
    if (String(cosmeticEditingId) !== String(item.id)) return;
    petSkinIsLegacy = h * 2 === w;
    petSkinFile = file;
    if (note) note.textContent = 'A figura jelenlegi skinje (' + w + 'x' + h
      + (petSkinIsLegacy ? ', régi formátum' : '') + ') - más fájlt is választhatsz.';
    if (btn) btn.disabled = false;
  } catch {
    if (note) note.textContent = 'A jelenlegi skint nem sikerült betölteni - válassz egyet kézzel.';
  }
}

$('#petGenerateBtn')?.addEventListener('click', async () => {
  if (!petSkinFile) { showToast('Előbb válassz egy skint.', true); return; }

  const scale = Number($('#petScaleInput').value);
  const legAngle = Number($('#petLegAngleInput').value);
  if (!(scale > 0.05 && scale <= 1)) { showToast('A méret 0,05 és 1 között lehet.', true); return; }
  if (!Number.isFinite(legAngle)) { showToast('Az ülés szöge nem szám.', true); return; }

  const built = buildShoulderPetModel({
    slim: $('#petSlimCheckbox').checked,
    legacy: petSkinIsLegacy,
    scale,
    legAngle,
    side: $('#petSideSelect').value === 'right' ? 'right' : 'left'
  });

  cosmeticPetMeta = readPetMeta();
  cosmeticAssembly.itemModelSpace = true;
  $('#cosmeticItemSpaceCheckbox').checked = true;
  if (!cosmeticEditingId) {
    $('#cosmeticSlotSelect').value = 'body';
    cosmeticAssembly.offsetX = 0;
    cosmeticAssembly.offsetY = 0;
    cosmeticAssembly.offsetZ = 0;
    cosmeticAssembly.rotationX = 0;
    cosmeticAssembly.rotationY = 0;
    cosmeticAssembly.rotationZ = 0;
    cosmeticAssembly.scale = 1;
  }
  if ($('#petAnimCheckbox').checked) cosmeticAssembly.anim = shoulderPetAnim(built.seatPivot);

  if (!cosmeticParts.length) cosmeticParts.push(emptyPart(0));
  const part = cosmeticParts[0];
  const json = JSON.stringify(built.model);
  part.file = new File([json], 'vallon_ulo_figura.json', { type: 'application/json' });
  part.elements = built.model.elements;
  part.textureSize = built.model.texture_size;
  part.hasModel = true;
  part.dirty = true;

  cosmeticSelectedTextureFile = petSkinFile;
  const dataUrl = await new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(petSkinFile);
  });
  $('#cosmeticTexturePreview').src = dataUrl;
  $('#cosmeticTexturePreviewWrap').hidden = false;
  cosmeticEditorTexture = await loadImage(dataUrl);

  $('#cosmeticModelNote').textContent = `Generált figura - ${built.model.elements.length} kocka`;
  setCosmeticTarget(-1);
  renderCosmeticPartsBar();
  renderCosmeticAnimEditor();
  restartCosmeticEditor();
  showToast(cosmeticEditingId
    ? 'A figura újragenerálva - a mentéssel válik élessé.'
    : 'A figura elkészült - nézd meg az előnézetben, és állíts rajta, ha kell.');
});

let cosmeticAuraTypes = [];
let cosmeticEffectTypes = [];
let cosmeticServers = [];

let cosmeticAura = null;
let cosmeticGameEffects = [];
let cosmeticEffectServers = [];

function renderCosmeticAuraEditor() {
  const sel = $('#cosmeticAuraTypeSelect');
  if (!sel) return;
  const current = cosmeticAura && cosmeticAura.type ? cosmeticAura.type : 'none';
  sel.innerHTML = '<option value="none">- nincs aura -</option>'
    + cosmeticAuraTypes.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label)}</option>`).join('');
  sel.value = current;

  const fields = $('#cosmeticAuraFields');
  if (fields) fields.classList.toggle('hidden', current === 'none');
  if (current === 'none') return;

  const a = cosmeticAura || {};
  $('#cosmeticAuraRateInput').value = Number.isFinite(a.rate) ? a.rate : '';
  $('#cosmeticAuraSizeInput').value = Number.isFinite(a.size) ? a.size : '';
  $('#cosmeticAuraLifeInput').value = Number.isFinite(a.life) ? a.life : '';
  $('#cosmeticAuraSpeedInput').value = Number.isFinite(a.speed) ? a.speed : '';
  $('#cosmeticAuraColorAInput').value = a.colorA || '#ffffff';
  $('#cosmeticAuraColorBInput').value = a.colorB || '#ffffff';
  $('#cosmeticAuraColorAInput').dataset.set = a.colorA ? '1' : '';
  $('#cosmeticAuraColorBInput').dataset.set = a.colorB ? '1' : '';
  $('#cosmeticAuraReactSelect').value = a.react || 'none';
  $('#cosmeticAuraOffsetXInput').value = Number.isFinite(a.offsetX) ? a.offsetX : '';
  $('#cosmeticAuraOffsetYInput').value = Number.isFinite(a.offsetY) ? a.offsetY : '';
  $('#cosmeticAuraOffsetZInput').value = Number.isFinite(a.offsetZ) ? a.offsetZ : '';
  $('#cosmeticAuraExtentInput').value = Number.isFinite(a.extent) ? a.extent : '';
}

function readCosmeticAura() {
  const type = $('#cosmeticAuraTypeSelect')?.value || 'none';
  if (type === 'none') return null;
  const out = { type };
  const num = (id, key) => {
    const raw = $(id)?.value.trim();
    if (raw === '' || raw === undefined) return;
    const n = Number(raw);
    if (Number.isFinite(n)) out[key] = n;
  };
  num('#cosmeticAuraRateInput', 'rate');
  num('#cosmeticAuraSizeInput', 'size');
  num('#cosmeticAuraLifeInput', 'life');
  num('#cosmeticAuraSpeedInput', 'speed');
  num('#cosmeticAuraOffsetXInput', 'offsetX');
  num('#cosmeticAuraOffsetYInput', 'offsetY');
  num('#cosmeticAuraOffsetZInput', 'offsetZ');
  num('#cosmeticAuraExtentInput', 'extent');
  const ca = $('#cosmeticAuraColorAInput');
  const cb = $('#cosmeticAuraColorBInput');
  if (ca && ca.dataset.set) out.colorA = ca.value;
  if (cb && cb.dataset.set) out.colorB = cb.value;
  const react = $('#cosmeticAuraReactSelect')?.value;
  if (react && react !== 'none') out.react = react;
  return out;
}

$('#cosmeticBbmodelPickBtn')?.addEventListener('click', () => {
  if (!cosmeticEditingId) {
    showToast('Előbb mentsd el a kiegészítőt - a .bbmodel egy MEGLÉVŐ kiegészítőhöz tartozik.', true);
    return;
  }
  $('#cosmeticBbmodelInput')?.click();
});

$('#cosmeticBbmodelInput')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) await uploadCosmeticBbmodel(file);
});

async function uploadCosmeticBbmodel(file) {
  if (!cosmeticEditingId) return;
  const note = $('#cosmeticBbmodelNote');
  const warnBox = $('#cosmeticBbmodelWarnings');
  if (note) note.textContent = `Feldolgozás: ${file.name} ...`;
  if (warnBox) warnBox.innerHTML = '';

  const fd = new FormData();
  fd.append('bbmodel', file);

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/cosmetics/${cosmeticEditingId}/bbmodel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: fd
    });
    const data = await res.json();
    if (!data.ok) {
      if (note) note.textContent = '';
      if (warnBox) warnBox.innerHTML = `<p class="redeem-result error">${escapeHtml(data.message || 'Nem sikerült feldolgozni a .bbmodel fájlt.')}</p>`;
      showToast(data.message || 'Nem sikerült feldolgozni a .bbmodel fájlt.', true);
      return;
    }

    const info = data.info || {};
    if (note) {
      note.textContent = `${file.name} - ${info.elementCount} kocka`
        + (info.format ? `, ${info.format} formátum` : '')
        + (info.groupRotations ? `, ${info.groupRotations} forgatott csont` : '')
        + (Array.isArray(info.resolution) ? `, textúra-tér ${info.resolution[0]}x${info.resolution[1]}` : '');
    }
    if (warnBox) {
      warnBox.innerHTML = (data.warnings || [])
        .map((w) => `<p class="cosmetic-file-note mob-bbmodel-warning">${escapeHtml(w)}</p>`).join('');
    }

    await refreshCosmeticAfterBbmodel(data.cosmetic);
    showToast('A Blockbench modell betöltve.');
  } catch {
    if (note) note.textContent = '';
    showToast('Hálózati hiba a .bbmodel feltöltésekor.', true);
  }
}

async function reloadCosmeticEditorAssets() {
  if (!cosmeticEditingId) return;
  cosmeticAssetBust++;
  cosmeticThumbCache.delete(cosmeticEditingId);
  cosmeticModelCache.delete(cosmeticEditingId);

  const item = cosmeticsAdminItems.find((c) => c.id === cosmeticEditingId);
  try {
    const [model, img] = await Promise.all([
      fetchCosmeticModel(cosmeticEditingId, { fresh: true, flat: true }),
      loadImage(cosmeticTextureUrl(cosmeticEditingId))
    ]);
    if (!model) return;
    cosmeticEditorTexture = img;

    if (item && Array.isArray(item.parts) && item.parts.length) {
      const known = new Map(cosmeticParts.map((pp) => [pp.id, pp]));
      cosmeticParts = item.parts.map((raw, i) => {
        const existing = known.get(raw.id);
        if (existing) { existing.hasModel = !!raw.hasModel; return existing; }
        const part = emptyPart(i);
        part.id = raw.id ?? null;
        part.hasModel = !!raw.hasModel;
        return part;
      });
    }

    const rawParts = (Array.isArray(model.parts) && model.parts.length)
      ? model.parts
      : [{ elements: model.elements, texture_size: model.texture_size }];
    const withModel = cosmeticParts.filter((pp) => pp.hasModel);
    rawParts.forEach((raw, i) => {
      const target = withModel[i];
      if (!target) return;
      target.elements = raw.elements || null;
      target.textureSize = Array.isArray(raw.texture_size) ? raw.texture_size : null;
    });
    renderCosmeticPartsBar();
    restartCosmeticEditor();
  } catch {
  }
}

async function refreshCosmeticAfterBbmodel(fresh) {
  if (fresh) {
    const idx = cosmeticsAdminItems.findIndex((c) => c.id === fresh.id);
    if (idx >= 0) cosmeticsAdminItems[idx] = fresh;
  }
  renderCosmeticRigBox();
  await reloadCosmeticEditorAssets();
}

function renderCosmeticRigBox() {
  const box = $('#cosmeticRigBox');
  if (!box) return;
  const item = cosmeticsAdminItems.find((c) => c.id === cosmeticEditingId);
  const hasRig = !!(item && item.hasRig);
  box.classList.toggle('hidden', !hasRig);
  if (!hasRig) return;

  const toggle = $('#cosmeticRigEnabledCheckbox');
  if (toggle) toggle.checked = item.rigEnabled !== false;

  const wrap = $('#cosmeticRigAnimations');
  if (!wrap) return;
  const anims = Array.isArray(item.animations) ? item.animations : [];
  if (!anims.length) {
    wrap.innerHTML = '<p class="cosmetic-file-note">A feltöltött modellnek van csontváza, de '
      + '<strong>nincs benne animáció</strong>. A Blockbench &bdquo;Animate&rdquo; fülén készíts '
      + 'egyet, mentsd újra a .bbmodel fájlt, és töltsd fel ismét.</p>';
    return;
  }
  const HINTS = [
    { label: 'nyugalom', words: ['idle', 'stand', 'nyugalom'] },
    { label: 'járás', words: ['walk', 'move', 'jaras'] },
    { label: 'futás / repülés', words: ['run', 'sprint', 'fly', 'flap', 'futas'] }
  ];
  const roleOf = (name) => {
    const low = String(name || '').toLowerCase();
    for (const h of HINTS) if (h.words.some((w) => low.includes(w))) return h.label;
    return null;
  };
  wrap.innerHTML = anims.map((a, i) => {
    const role = roleOf(a);
    return `<div class="cosmetic-effect-row">
      <span><strong>${escapeHtml(a)}</strong>${role ? ` <span class="cosmetic-tag">${role}</span>` : ''}</span>
      <button type="button" class="cosmetic-effect-remove" data-cosmetic-anim-remove="${i}" title="Animáció törlése">&times;</button>
    </div>`;
  }).join('');
}

$('#cosmeticRigAnimations')?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-cosmetic-anim-remove]');
  if (!btn || !cosmeticEditingId) return;
  const index = Number(btn.dataset.cosmeticAnimRemove);
  if (!confirm('Biztosan törlöd ezt az animációt? A modell és a többi animáció megmarad.')) return;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/admin/cosmetics/${cosmeticEditingId}/animations/${index}`,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
    await refreshCosmeticAfterBbmodel(data.cosmetic);
    showToast(`Animáció törölve: ${data.removed}`);
  } catch {
    showToast('Hálózati hiba az animáció törlésekor.', true);
  }
});

$('#cosmeticRigDeleteBtn')?.addEventListener('click', async () => {
  if (!cosmeticEditingId) return;
  if (!confirm('Biztosan eldobod a csontvázat? A kiegészítő ezután a LAPOS modelljét és a '
    + 'sáv-animációt használja. A geometria és a textúra megmarad.')) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/cosmetics/${cosmeticEditingId}/rig`,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült eldobni.', true); return; }
    await refreshCosmeticAfterBbmodel(data.cosmetic);
    showToast('A csontváz eldobva.');
  } catch {
    showToast('Hálózati hiba.', true);
  }
});

function renderCosmeticEffectEditor() {
  const wrap = $('#cosmeticEffectRows');
  if (!wrap) return;
  if (!cosmeticGameEffects.length) {
    wrap.innerHTML = '<p class="cosmetic-file-note">Ehhez a kiegészítőhöz nincs játékbeli effekt.</p>';
  } else {
    wrap.innerHTML = cosmeticGameEffects.map((e, i) => `
      <div class="cosmetic-effect-row" data-effect-index="${i}">
        <label>Effekt
          <select data-effect-field="effect">${cosmeticEffectTypes.map((t) =>
            `<option value="${escapeHtml(t.id)}"${t.id === e.effect ? ' selected' : ''}>${escapeHtml(t.label)}</option>`).join('')}</select>
        </label>
        <label>Erősség
          <input type="number" data-effect-field="amplifier" min="0" max="4" step="1" value="${Number(e.amplifier) || 0}" />
        </label>
        <button type="button" class="cosmetic-effect-remove" data-effect-remove="${i}" title="Effekt törlése">&times;</button>
      </div>`).join('');
  }

  const servers = $('#cosmeticEffectServers');
  if (servers) {
    servers.innerHTML = cosmeticServers.length
      ? cosmeticServers.map((s) => `
        <label><input type="checkbox" data-effect-server="${escapeHtml(s.id)}"${
          cosmeticEffectServers.includes(s.id) ? ' checked' : ''} /> ${escapeHtml(s.label)}</label>`).join('')
      : '<p class="cosmetic-file-note">Még nincs felvett szerver &ndash; a lenti listában tudsz hozzáadni. Szerver nélkül az effekt mindenhol hat.</p>';
  }
}

$('#cosmeticAuraTypeSelect')?.addEventListener('change', () => {
  const type = $('#cosmeticAuraTypeSelect').value;
  cosmeticAura = type === 'none' ? null : { type };
  renderCosmeticAuraEditor();
  queueEditorRefresh();
});

$('#cosmeticAuraResetBtn')?.addEventListener('click', () => {
  if (!cosmeticAura || !cosmeticAura.type) return;
  cosmeticAura = { type: cosmeticAura.type };
  renderCosmeticAuraEditor();
  queueEditorRefresh();
  showToast('A finomhangolás törölve - a típus alapértékei érvényesek.');
});

['#cosmeticAuraRateInput', '#cosmeticAuraSizeInput', '#cosmeticAuraLifeInput',
 '#cosmeticAuraSpeedInput', '#cosmeticAuraReactSelect',
 '#cosmeticAuraOffsetXInput', '#cosmeticAuraOffsetYInput', '#cosmeticAuraOffsetZInput',
 '#cosmeticAuraExtentInput'].forEach((id) => {
  $(id)?.addEventListener('change', () => { cosmeticAura = readCosmeticAura(); queueEditorRefresh(); });
});
['#cosmeticAuraColorAInput', '#cosmeticAuraColorBInput'].forEach((id) => {
  $(id)?.addEventListener('input', (e) => {
    e.target.dataset.set = '1';
    cosmeticAura = readCosmeticAura();
    queueEditorRefresh();
  });
});

$('#cosmeticEffectAddBtn')?.addEventListener('click', () => {
  if (!cosmeticEffectTypes.length) { showToast('A backend nem adott effekt-listát.', true); return; }
  if (cosmeticGameEffects.length >= 4) { showToast('Egy kiegészítő legfeljebb 4 effektet adhat.', true); return; }
  const used = new Set(cosmeticGameEffects.map((e) => e.effect));
  const next = cosmeticEffectTypes.find((t) => !used.has(t.id));
  if (!next) { showToast('Minden effekt szerepel már a listában.', true); return; }
  cosmeticGameEffects.push({ effect: next.id, amplifier: 0 });
  renderCosmeticEffectEditor();
});

document.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-effect-remove]');
  if (rm) {
    cosmeticGameEffects.splice(Number(rm.dataset.effectRemove), 1);
    renderCosmeticEffectEditor();
  }
});

document.addEventListener('change', (e) => {
  const field = e.target.closest('[data-effect-field]');
  if (field) {
    const row = field.closest('[data-effect-index]');
    const idx = Number(row.dataset.effectIndex);
    const entry = cosmeticGameEffects[idx];
    if (!entry) return;
    if (field.dataset.effectField === 'effect') entry.effect = field.value;
    else entry.amplifier = Math.max(0, Math.min(4, Number(field.value) || 0));
    return;
  }
  const server = e.target.closest('[data-effect-server]');
  if (server) {
    const id = server.dataset.effectServer;
    if (server.checked) { if (!cosmeticEffectServers.includes(id)) cosmeticEffectServers.push(id); }
    else cosmeticEffectServers = cosmeticEffectServers.filter((x) => x !== id);
  }
});

function renderCosmeticServerList() {
  const wrap = $('#cosmeticServerList');
  if (!wrap) return;
  wrap.innerHTML = cosmeticServers.length
    ? cosmeticServers.map((s) => `
      <div class="cosmetic-server-row">
        <span class="cosmetic-server-row-label">${escapeHtml(s.label)}</span>
        <span class="cosmetic-server-row-id">${escapeHtml(s.id)}</span>
        <button type="button" class="cosmetic-effect-remove" data-server-remove="${escapeHtml(s.id)}" title="Szerver törlése">&times;</button>
      </div>`).join('')
    : '<p class="cosmetic-file-note">Még nincs felvett szerver.</p>';
}

$('#cosmeticServerAddBtn')?.addEventListener('click', async () => {
  const resultEl = $('#cosmeticServerResult');
  const id = $('#cosmeticServerIdInput').value.trim().toLowerCase();
  const label = $('#cosmeticServerLabelInput').value.trim();
  resultEl.className = 'redeem-result';
  if (!id || !label) { resultEl.textContent = 'Az azonosító és a név is kell.'; resultEl.classList.add('error'); return; }
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/cosmetic-servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify({ id, label })
    });
    const data = await res.json();
    if (!data.ok) { resultEl.textContent = data.message || 'Nem sikerült.'; resultEl.classList.add('error'); return; }
    cosmeticServers.push(data.server);
    cosmeticServers.sort((a, b) => a.label.localeCompare(b.label, 'hu'));
    $('#cosmeticServerIdInput').value = '';
    $('#cosmeticServerLabelInput').value = '';
    renderCosmeticServerList();
    renderCosmeticEffectEditor();
    showToast('Szerver hozzáadva.');
  } catch {
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
    resultEl.classList.add('error');
  }
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-server-remove]');
  if (!btn) return;
  const id = btn.dataset.serverRemove;
  confirmModal('Szerver törlése',
    `Biztosan törlöd a(z) "${id}" szervert? A kiegészítők hatóköréből is kikerül, tehát ahol EDDIG csak ezen a szerveren hatott az effekt, ott ezután MINDEN szerveren hatni fog.`,
    'Igen, törlés').then(async (confirmed) => {
    if (!confirmed) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/cosmetic-servers/' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      });
      const data = await res.json();
      if (!data.ok) { showToast('Nem sikerült törölni.', true); return; }
      cosmeticServers = cosmeticServers.filter((s) => s.id !== id);
      cosmeticEffectServers = cosmeticEffectServers.filter((s) => s !== id);
      renderCosmeticServerList();
      renderCosmeticEffectEditor();
      showToast('Szerver törölve.');
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  });
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
      if (data.ok) {
        cosmeticAuraTypes = data.limits?.auraTypes || [];
        cosmeticEffectTypes = data.limits?.gameEffects || [];
        SkinPreview.setAuraPresets(cosmeticAuraTypes);
        cosmeticServers = data.servers || [];
        renderCosmeticServerList();
      }
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

function cosmeticAdminSection() {
  return document.querySelector('.view[data-view="cosmeticsAdmin"]');
}

function openCosmeticEditor(mode) {
  const section = cosmeticAdminSection();
  if (!section) return;
  if (mode === 'new' || mode === 'pet') resetCosmeticForm();
  section.classList.add('editing');
  $('#cosmeticPetBox')?.classList.toggle('hidden', mode !== 'pet');
  const petTitle = $('#cosmeticPetTitle');
  if (petTitle) petTitle.textContent = 'Figura készítése skinből';
  if (mode === 'pet') {
    $('#cosmeticFormTitle').textContent = 'Új vállon ülő figura';
    const slotSel = $('#cosmeticSlotSelect');
    if (slotSel) slotSel.value = 'body';
  }
  setCosmeticTab('basics');
  section.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function closeCosmeticEditor() {
  cosmeticAdminSection()?.classList.remove('editing');
}

function setCosmeticTab(name) {
  $$('.cosmetic-tab').forEach((b) => b.classList.toggle('active', b.dataset.cosmeticTab === name));
  $$('.cosmetic-tab-pane').forEach((p) => p.classList.toggle('active', p.dataset.cosmeticPane === name));
}

$$('.cosmetic-tab').forEach((btn) => {
  btn.addEventListener('click', () => setCosmeticTab(btn.dataset.cosmeticTab));
});

$('#cosmeticNewBtn')?.addEventListener('click', () => openCosmeticEditor('new'));
$('#cosmeticNewPetBtn')?.addEventListener('click', () => openCosmeticEditor('pet'));
$('#cosmeticBackBtn')?.addEventListener('click', closeCosmeticEditor);

let cosmeticAdminSearch = '';
$('#cosmeticAdminSearch')?.addEventListener('input', (e) => {
  cosmeticAdminSearch = e.target.value.trim().toLowerCase();
  renderCosmeticsAdminList();
});

function renderCosmeticsAdminList() {
  const wrap = $('#cosmeticsAdminList');
  if (!wrap) return;

  const visible = cosmeticAdminSearch
    ? cosmeticsAdminItems.filter((c) =>
        c.name.toLowerCase().includes(cosmeticAdminSearch) || c.slug.toLowerCase().includes(cosmeticAdminSearch))
    : cosmeticsAdminItems;

  if (!visible.length) {
    wrap.innerHTML = `<div class="card"><p class="redeem-result">${cosmeticsAdminItems.length
      ? 'Nincs a keresésnek megfelelő kiegészítő.'
      : 'Még nincs egyetlen kiegészítő sem - vegyél fel egyet a fenti gombbal.'}</p></div>`;
    return;
  }

  wrap.innerHTML = `<div class="cosmetic-admin-grid">${visible.map((c) => `
    <div class="cosmetic-admin-card rarity-${escapeHtml(c.rarity)}${c.enabled ? '' : ' is-off'}">
      ${cosmeticCardThumbHtml(c)}
      <div class="cosmetic-admin-card-name">${escapeHtml(c.name)}</div>
      <div class="cosmetic-admin-card-slug">${escapeHtml(c.slug)}</div>
      <div class="cosmetic-admin-card-tags">
        <span class="cosmetic-tag">${escapeHtml(c.slotLabel)}</span>
        <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}</span>
        ${cosmeticAnimatedTag(c)}
        ${c.petMeta ? '<span class="cosmetic-tag">figura</span>' : ''}
        ${c.aura ? '<span class="cosmetic-tag">aura</span>' : ''}
        ${(c.gameEffects && c.gameEffects.length) ? '<span class="cosmetic-tag">effekt</span>' : ''}
        ${c.enabled ? '' : '<span class="cosmetic-badge-off">kikapcsolva</span>'}
        ${c.hasModel ? '' : '<span class="cosmetic-badge-warn">nincs modell</span>'}
      </div>
      <div class="cosmetic-admin-card-meta">
        ${c.priceSc !== null && c.priceSc !== undefined ? c.priceSc.toLocaleString('hu-HU') + ' PP' : 'nem vásárolható'}
        · ${c.defaultDurationDays ? c.defaultDurationDays + ' nap' : 'örök'}
        · ${c.tradable ? 'továbbadható' : 'kötött'}<br />
        ${c.ownerCount} tulajdonos${c.listingCount ? `, ${c.listingCount} hirdetés` : ''}
      </div>
      <div class="cosmetic-admin-card-actions">
        <button type="button" data-cosmetic-edit="${c.id}">Szerkesztés</button>
        <button type="button" data-cosmetic-anim="${c.id}" title="Egyből az animáció fülre nyitja">Animáció</button>
        <button type="button" class="is-danger" data-cosmetic-delete="${c.id}">Törlés</button>
      </div>
    </div>
  `).join('')}</div>`;
  hydrateCosmeticThumbs(wrap);
}

let stopCosmeticEditor = null;
let cosmeticEditorTexture = null;
let cosmeticEditorRefreshQueued = false;

function readTargetFromInputs() {
  const rec = currentTargetRecord();
  if (!rec || !$('#cosmeticOffsetXInput')) return;
  rec.offsetX = Number($('#cosmeticOffsetXInput').value) || 0;
  rec.offsetY = Number($('#cosmeticOffsetYInput').value) || 0;
  rec.offsetZ = Number($('#cosmeticOffsetZInput').value) || 0;
  rec.rotationX = Number($('#cosmeticRotXInput').value) || 0;
  rec.rotationY = Number($('#cosmeticRotYInput').value) || 0;
  rec.rotationZ = Number($('#cosmeticRotZInput').value) || 0;
  rec.scale = Number($('#cosmeticScaleInput').value) || 1;
  if (cosmeticTarget >= 0) rec.dirty = true;
  cosmeticAssembly.itemModelSpace = $('#cosmeticItemSpaceCheckbox').checked;
}

function writeTargetToInputs() {
  const rec = currentTargetRecord();
  if (!rec || !$('#cosmeticOffsetXInput')) return;
  $('#cosmeticOffsetXInput').value = rec.offsetX;
  $('#cosmeticOffsetYInput').value = rec.offsetY;
  $('#cosmeticOffsetZInput').value = rec.offsetZ;
  $('#cosmeticRotXInput').value = rec.rotationX;
  $('#cosmeticRotYInput').value = rec.rotationY;
  $('#cosmeticRotZInput').value = rec.rotationZ;
  $('#cosmeticScaleInput').value = rec.scale;
  $('#cosmeticItemSpaceCheckbox').checked = cosmeticAssembly.itemModelSpace !== false;

  const label = cosmeticTarget < 0 ? 'teljes kiegészítő' : cosmeticPartLabel(cosmeticTarget);
  const t1 = $('#cosmeticTargetLabel');
  const t2 = $('#cosmeticAnimTargetLabel');
  if (t1) t1.textContent = label;
  if (t2) t2.textContent = label;
}

function cosmeticPartLabel(index) {
  const part = cosmeticParts[index];
  if (!part) return (index + 1) + '. rész';
  return part.name ? `${index + 1}. rész - ${part.name}` : `${index + 1}. rész`;
}

function setCosmeticTarget(target) {
  readTargetFromInputs();
  cosmeticTarget = target;
  writeTargetToInputs();
  renderCosmeticPartsBar();
  renderCosmeticAnimEditor();
  queueEditorRefresh();
}

function renderCosmeticPartsBar() {
  const bar = $('#cosmeticPartsBar');
  if (!bar) return;
  const chips = [`<button type="button" class="cosmetic-part-chip${cosmeticTarget < 0 ? ' active' : ''}" data-cosmetic-target="-1">Teljes kiegészítő</button>`];
  cosmeticParts.forEach((part, i) => {
    const warn = part.hasModel || part.elements ? '' : ' <span class="cosmetic-part-chip-warn">nincs modell</span>';
    const anim = (part.anim && part.anim.tracks && part.anim.tracks.length) ? ' <span class="cosmetic-part-chip-anim" title="Van animációja">~</span>' : '';
    chips.push(`<button type="button" class="cosmetic-part-chip${cosmeticTarget === i ? ' active' : ''}" data-cosmetic-target="${i}">${escapeHtml(cosmeticPartLabel(i))}${anim}${warn}</button>`);
  });
  bar.innerHTML = chips.join('');
  renderCosmeticPartPanel();
}

function renderCosmeticPartPanel() {
  const panel = $('#cosmeticPartPanel');
  if (!panel) return;
  if (cosmeticTarget < 0) {
    panel.innerHTML = '<p class="cosmetic-file-note">A <strong>teljes kiegészítő</strong> van kiválasztva: az itt beállított illesztés és animáció MINDEN részre együtt hat. Egy rész külön mozgatásához válaszd ki a részt fent.<br />A <strong>Hullám</strong> (Hajlás/Késés) itt is teljes értékű: a kiegészítő egyetlen, összefüggő testként hajlik, a forgásponttól mért távolság az EGÉSZ kiegészítőn át számít. Egy jobb+bal szárnypárnál ezért a két szárny együtt, szimmetrikusan csap - ehhez a forgáspontot a test közepére (a szárnyak tövére) tedd.</p>';
    return;
  }
  const part = cosmeticParts[cosmeticTarget];
  if (!part) { panel.innerHTML = ''; return; }
  const cubes = part.elements ? part.elements.length : (part.hasModel ? null : 0);
  const modelText = part.elements
    ? `${cubes} kocka${part.file ? ' (új fájl, mentésre vár)' : ''}`
    : (part.hasModel ? 'feltöltve (a geometria a mentett modellből jön)' : 'nincs modell');
  panel.innerHTML = `
    <div class="cosmetic-part-panel-row">
      <label class="cosmetic-part-name">A rész neve
        <input type="text" id="cosmeticPartNameInput" maxlength="48" placeholder="pl. Bal szárny" value="${escapeHtml(part.name || '')}" />
      </label>
      <div class="cosmetic-part-model">
        <div class="cosmetic-part-model-label">Modell: <strong>${escapeHtml(modelText)}</strong></div>
        <button type="button" class="btn-outline" data-cosmetic-replace-part-model>${part.hasModel ? 'Modell cseréje' : 'Modell kiválasztása'}</button>
      </div>
      ${cosmeticParts.length > 1
        ? '<button type="button" class="news-delete-btn" data-cosmetic-delete-part>Rész törlése</button>'
        : '<span class="cosmetic-file-note">Az utolsó rész nem törölhető.</span>'}
    </div>`;
}

const ANIM_TYPE_LABELS = { rotate: 'Forgatás', translate: 'Eltolás', scale: 'Méret' };
const ANIM_WAVE_LABELS = {
  sine: 'Lágy (szinusz)',
  flap: 'Csapás (gyors le, lassú vissza)',
  tri: 'Egyenletes (háromszög)',
  saw: 'Körbe (fűrész)',
  pulse: 'Kapcsolgatás'
};
const ANIM_REACT_LABELS = {
  none: 'Mindig', move: 'Mozgás közben', air: 'Levegőben', sneak: 'Lopakodva', ground: 'Földön'
};
const ANIM_ALONG_LABELS = { auto: 'Automatikus', x: 'X', y: 'Y', z: 'Z' };

const ANIM_PRESET_DEFS = [
  {
    label: 'Szárnycsapás',
    mirror: true,
    replace: true,
    tracks: [
      { type: 'rotate', axis: 'z', amp: 30, speed: 0.6, phase: 0, wave: 'flap', react: 'none', falloff: 0.9, spread: 55, along: 'auto' },
      { type: 'rotate', axis: 'x', amp: 11, speed: 0.6, phase: 30, wave: 'sine', react: 'none', falloff: 1, spread: 55, along: 'auto' },
      { type: 'rotate', axis: 'y', amp: 5, speed: 1.2, phase: 35, wave: 'sine', react: 'none', falloff: 0.7, spread: 40, along: 'auto' },
      { type: 'translate', axis: 'y', amp: 0.35, speed: 0.6, phase: 180, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ]
  },
  {
    label: 'Repülés közben csapkod',
    mirror: true,
    replace: true,
    tracks: [
      { type: 'rotate', axis: 'z', amp: 42, speed: 1.35, phase: 0, wave: 'flap', react: 'air', falloff: 0.9, spread: 60, along: 'auto' },
      { type: 'rotate', axis: 'x', amp: 15, speed: 1.35, phase: 30, wave: 'sine', react: 'air', falloff: 1, spread: 60, along: 'auto' },
      { type: 'rotate', axis: 'y', amp: 7, speed: 2.7, phase: 35, wave: 'sine', react: 'air', falloff: 0.7, spread: 45, along: 'auto' }
    ]
  },
  {
    label: 'Futásra felgyorsul',
    mirror: true,
    replace: true,
    tracks: [
      { type: 'rotate', axis: 'z', amp: 22, speed: 0.95, phase: 0, wave: 'flap', react: 'move', falloff: 0.9, spread: 55, along: 'auto' },
      { type: 'rotate', axis: 'x', amp: 9, speed: 0.95, phase: 30, wave: 'sine', react: 'move', falloff: 1, spread: 55, along: 'auto' }
    ]
  },
  {
    label: 'Lassú suhogás',
    mirror: true,
    replace: true,
    tracks: [
      { type: 'rotate', axis: 'z', amp: 11, speed: 0.28, phase: 0, wave: 'sine', react: 'none', falloff: 0.95, spread: 70, along: 'auto' },
      { type: 'rotate', axis: 'x', amp: 6, speed: 0.28, phase: 95, wave: 'sine', react: 'none', falloff: 1, spread: 70, along: 'auto' }
    ]
  },
  {
    label: 'Köpeny-hullám',
    replace: true,
    tracks: [
      { type: 'rotate', axis: 'x', amp: 9, speed: 0.5, phase: 0, wave: 'sine', react: 'none', falloff: 1, spread: 150, along: 'auto' },
      { type: 'rotate', axis: 'z', amp: 4, speed: 0.5, phase: 90, wave: 'sine', react: 'none', falloff: 1, spread: 150, along: 'auto' }
    ]
  },
  {
    label: 'Szárnynyitás (nyit-zár)',
    mirror: true,
    tracks: [
      { type: 'rotate', axis: 'y', amp: 16, speed: 0.5, phase: 0, wave: 'sine', react: 'none', falloff: 0.7, spread: 45, along: 'auto' }
    ]
  },
  { label: 'Lebegés', tracks: [{ type: 'translate', axis: 'y', amp: 0.8, speed: 0.35, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }] },
  { label: 'Ringás', tracks: [{ type: 'rotate', axis: 'z', amp: 6, speed: 0.4, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }] },
  { label: 'Folyamatos pörgés', tracks: [{ type: 'rotate', axis: 'y', amp: 180, speed: 0.35, phase: 0, wave: 'saw', react: 'none', falloff: 0, spread: 0, along: 'auto' }] },
  { label: 'Lüktetés', tracks: [{ type: 'scale', axis: 'x', amp: 0.06, speed: 0.8, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }] }
];

function mirrorAnimTracks(tracks) {
  return tracks.map((t) => {
    const m = Object.assign({}, t);
    const amp = Number(t.amp) || 0;
    if (t.type === 'rotate' && (t.axis === 'y' || t.axis === 'z')) m.amp = -amp;
    else if (t.type === 'translate' && t.axis === 'x') m.amp = -amp;
    return m;
  });
}

const ANIM_PRESETS = ANIM_PRESET_DEFS.flatMap((def) => {
  const base = { label: def.label, replace: !!def.replace, tracks: def.tracks };
  if (!def.mirror) return [base];
  return [base, {
    label: def.label + ' (ellentétes ütem)',
    replace: !!def.replace,
    tracks: mirrorAnimTracks(def.tracks)
  }];
});

function animSelect(field, labels, value) {
  return `<select data-anim-field="${field}">${Object.entries(labels)
    .map(([v, l]) => `<option value="${v}"${value === v ? ' selected' : ''}>${escapeHtml(l)}</option>`)
    .join('')}</select>`;
}

function animField(label, inner, title) {
  return `<label class="cosmetic-anim-field"${title ? ` title="${escapeHtml(title)}"` : ''}><span>${escapeHtml(label)}</span>${inner}</label>`;
}

function rootPivotCoord(min, max, reference) {
  const span = max - min;
  const overhang = Math.min(reference - min, max - reference);
  if (span > 0 && overhang > span * 0.25) return (min + max) / 2;
  return Math.abs(min - reference) <= Math.abs(max - reference) ? min : max;
}
function suggestRootPivot(partIndex) {
  const model = buildEditorModel();
  if (!model) return null;

  if (partIndex < 0) {
    const withModelAll = cosmeticParts.filter((p) => Array.isArray(p.elements) && p.elements.length);
    if (!withModelAll.length) return null;
    const all = [];
    for (const p of withModelAll) for (const el of p.elements) all.push(el);
    const axis = SkinPreview.animAlongAxis(cosmeticAssembly.anim, all);
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const el of all) {
      if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
      for (let k = 0; k < 3; k++) {
        mn[k] = Math.min(mn[k], el.from[k], el.to[k]);
        mx[k] = Math.max(mx[k], el.from[k], el.to[k]);
      }
    }
    if (!Number.isFinite(mn[0])) return null;
    const ref = cosmeticAssembly.itemModelSpace !== false ? 8 : 0;
    const piv = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    piv[axis] = rootPivotCoord(mn[axis], mx[axis], ref);
    return piv.map((v) => Math.round(v * 100) / 100);
  }

  const part = cosmeticParts[partIndex];
  if (!part || !Array.isArray(part.elements) || !part.elements.length) return null;

  let built;
  try { built = SkinPreview.buildCosmeticParts(model, $('#cosmeticSlotSelect').value || 'head'); } catch { return null; }
  const withModel = cosmeticParts.filter((p) => Array.isArray(p.elements) && p.elements.length);
  const builtIndex = withModel.indexOf(part);
  const builtPart = built.parts[builtIndex];
  if (!builtPart) return null;

  const axis = SkinPreview.animAlongAxis(builtPart.anim, part.elements);
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const el of part.elements) {
    if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], el.from[k], el.to[k]);
      max[k] = Math.max(max[k], el.from[k], el.to[k]);
    }
  }
  if (!Number.isFinite(min[0])) return null;

  const reference = cosmeticAssembly.itemModelSpace !== false ? 8 : 0;
  const pivot = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  pivot[axis] = rootPivotCoord(min[axis], max[axis], reference);
  return pivot.map((n) => Math.round(n * 100) / 100);
}

function applyRootPivot() {
  const pivot = suggestRootPivot(cosmeticTarget);
  if (!pivot) { showToast('Előbb tölts fel modellt.', true); return false; }
  const anim = ensureAnim();
  anim.pivot = pivot;
  if (cosmeticTarget >= 0 && cosmeticParts[cosmeticTarget]) cosmeticParts[cosmeticTarget].dirty = true;
  renderCosmeticAnimEditor();
  queueEditorRefresh();
  return true;
}

function currentAnim() {
  const rec = currentTargetRecord();
  if (!rec) return null;
  return rec.anim;
}

function setCurrentAnim(anim) {
  const rec = currentTargetRecord();
  if (!rec) return;
  rec.anim = anim;
  if (cosmeticTarget >= 0) rec.dirty = true;
}

function ensureAnim() {
  let anim = currentAnim();
  if (!anim) {
    anim = { tracks: [], pivot: null };
    setCurrentAnim(anim);
  }
  if (!Array.isArray(anim.tracks)) anim.tracks = [];
  return anim;
}

function renderCosmeticAnimEditor() {
  const presetsWrap = $('#cosmeticAnimPresets');
  const tracksWrap = $('#cosmeticAnimTracks');
  if (!presetsWrap || !tracksWrap) return;

  presetsWrap.innerHTML = ANIM_PRESETS
    .map((preset, i) => `<button type="button" class="cosmetic-anim-preset" data-anim-preset="${i}">${escapeHtml(preset.label)}</button>`)
    .join('');

  const anim = currentAnim();
  const tracks = anim && Array.isArray(anim.tracks) ? anim.tracks : [];
  if (!tracks.length) {
    tracksWrap.innerHTML = '<p class="cosmetic-file-note">Ehhez még nincs mozgás beállítva. Válassz egy kész mozgást fent, vagy vegyél fel egyet kézzel.</p>';
  } else {
    tracksWrap.innerHTML = tracks.map((t, i) => {
      const isScale = t.type === 'scale';
      const step = isScale ? '0.02' : (t.type === 'translate' ? '0.2' : '1');
      return `
      <div class="cosmetic-anim-track" data-anim-index="${i}">
        <div class="cosmetic-anim-row">
          ${animField('Mit', animSelect('type', ANIM_TYPE_LABELS, t.type))}
          ${animField('Tengely', `<select data-anim-field="axis"${isScale ? ' disabled' : ''}>${['x', 'y', 'z'].map((v) => `<option value="${v}"${t.axis === v ? ' selected' : ''}>${v.toUpperCase()}</option>`).join('')}</select>`)}
          ${animField('Kitérés', `<input type="number" data-anim-field="amp" step="${step}" value="${Number(t.amp) || 0}" />`, 'Forgatásnál fok, eltolásnál modell-egység, méretnél arány. A NEGATÍV érték az ellenkező irányba mozgat - a forgáspont két oldalát NEM kell kézzel tükrözni, azt a kliens magától megteszi.')}
          ${animField('Sebesség', `<input type="number" data-anim-field="speed" step="0.05" min="0" max="8" value="${Number(t.speed) || 0}" />`, 'Teljes ciklus másodpercenként.')}
          ${animField('Fázis°', `<input type="number" data-anim-field="phase" step="15" min="-360" max="360" value="${Number(t.phase) || 0}" />`, 'Eltolja a mozgás kezdetét. Két azonos szárnyfélnél 0 és 180 ellentétes ütemet ad.')}
          ${animField('Jelleg', animSelect('wave', ANIM_WAVE_LABELS, t.wave))}
          ${animField('Mikor', animSelect('react', ANIM_REACT_LABELS, t.react))}
          <button type="button" class="cosmetic-anim-remove" data-anim-remove="${i}" title="Sáv törlése">&times;</button>
        </div>
        ${isScale ? '' : `
        <div class="cosmetic-anim-row cosmetic-anim-wave-row">
          <span class="cosmetic-anim-rowlabel">Hullám</span>
          ${animField('Hajlás', `<input type="range" data-anim-field="falloff" min="0" max="1" step="0.05" value="${Number(t.falloff) || 0}" /><output>${(Number(t.falloff) || 0).toFixed(2)}</output>`, '0 = az egész rész merev testként fordul (billegő lap). 1 = a forgáspontnál nem mozdul, a hegyénél teljes a kitérés - EZ hajlítja meg a szárnyat.')}
          ${animField('Késés°', `<input type="number" data-anim-field="spread" step="10" min="-720" max="720" value="${Number(t.spread) || 0}" />`, 'Mennyivel késik a legtávolabbi kocka a forgáspontnál lévőhöz képest. Ettől FUT VÉGIG a mozgás a szárnyon (suhogás). 100-150 fok a jellemző.')}
          ${animField('Mentén', animSelect('along', ANIM_ALONG_LABELS, t.along || 'auto'), 'Melyik tengely mentén fut a hullám. Automatikusan a rész leghosszabb kiterjedése - szárnynál ez általában helyes.')}
        </div>`}
      </div>`;
    }).join('');
  }

  const pivot = anim && Array.isArray(anim.pivot) ? anim.pivot : null;
  $('#cosmeticAnimPivotXInput').value = pivot ? pivot[0] : '';
  $('#cosmeticAnimPivotYInput').value = pivot ? pivot[1] : '';
  $('#cosmeticAnimPivotZInput').value = pivot ? pivot[2] : '';
}

function readAnimPivotFromInputs() {
  const xs = $('#cosmeticAnimPivotXInput').value.trim();
  const ys = $('#cosmeticAnimPivotYInput').value.trim();
  const zs = $('#cosmeticAnimPivotZInput').value.trim();
  if (!xs || !ys || !zs) return null;
  const v = [Number(xs), Number(ys), Number(zs)];
  return v.every(Number.isFinite) ? v : null;
}

async function createCosmeticPart(file, parsed) {
  if (!cosmeticEditingId) {
    showToast('Előbb mentsd el a kiegészítőt, utána adhatsz hozzá további részeket.', true);
    return;
  }
  const fd = new FormData();
  fd.append('name', '');
  fd.append('scale', '1');
  fd.append('model', file);
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/cosmetics/' + cosmeticEditingId + '/parts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: fd
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült hozzáadni a részt.', true); return; }

    const part = emptyPart(data.part.idx);
    part.id = data.part.id;
    part.hasModel = true;
    part.elements = parsed.elements;
    part.textureSize = Array.isArray(parsed.texture_size) ? parsed.texture_size : null;
    cosmeticParts.push(part);
    cosmeticAssetBust++;
    cosmeticThumbCache.delete(cosmeticEditingId);
    cosmeticModelCache.delete(cosmeticEditingId);
    setCosmeticTarget(cosmeticParts.length - 1);
    showToast('Rész hozzáadva. Állítsd be az illesztését és a mozgását, majd mentsd el.');
  } catch {
    showToast('Hálózati hiba a rész hozzáadásakor.', true);
  }
}

async function deleteCosmeticPart(index) {
  const part = cosmeticParts[index];
  if (!part) return;
  if (!confirm(`Biztosan törlöd ezt: ${cosmeticPartLabel(index)}? A geometriája véglegesen elvész.`)) return;

  if (part.id && cosmeticEditingId) {
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/cosmetics/' + cosmeticEditingId + '/parts/' + part.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + session.token }
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült törölni a részt.', true); return; }
    } catch {
      showToast('Hálózati hiba a rész törlésekor.', true);
      return;
    }
  }
  cosmeticParts.splice(index, 1);
  cosmeticParts.forEach((p, i) => { p.idx = i; });
  cosmeticAssetBust++;
  if (cosmeticEditingId) {
    cosmeticThumbCache.delete(cosmeticEditingId);
    cosmeticModelCache.delete(cosmeticEditingId);
  }
  setCosmeticTarget(-1);
  showToast('Rész törölve.');
}

function buildEditorModel() {
  readTargetFromInputs();
  const parts = cosmeticParts
    .filter((p) => Array.isArray(p.elements) && p.elements.length)
    .map((p) => ({
      texture_size: p.textureSize || [64, 64],
      elements: p.elements,
      transform: {
        offset: [p.offsetX, p.offsetY, p.offsetZ],
        rotation: [p.rotationX, p.rotationY, p.rotationZ],
        scale: p.scale
      },
      anim: p.anim
    }));
  if (!parts.length) return null;
  return {
    assembly: {
      offset: [cosmeticAssembly.offsetX, cosmeticAssembly.offsetY, cosmeticAssembly.offsetZ],
      rotation: [cosmeticAssembly.rotationX, cosmeticAssembly.rotationY, cosmeticAssembly.rotationZ],
      scale: cosmeticAssembly.scale,
      itemModelSpace: cosmeticAssembly.itemModelSpace !== false,
      anim: cosmeticAssembly.anim,
      aura: readCosmeticAura()
    },
    parts
  };
}

function hasEditorModel() {
  return cosmeticParts.some((p) => Array.isArray(p.elements) && p.elements.length);
}

function editorUnitsPerPixel(canvas, camDistance) {
  const dist = typeof camDistance === 'number' && camDistance > 0 ? camDistance : 46;
  const visibleHeight = 2 * dist * Math.tan(Math.PI / 10);
  return visibleHeight / (canvas.height || 320);
}

function round2(n) { return Math.round(n * 100) / 100; }

function wrapDegrees(n) {
  let d = ((Number(n) || 0) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return round2(d);
}

function autoFitCosmetic() {
  const model = buildEditorModel();
  if (!model) return false;
  const slot = $('#cosmeticSlotSelect').value || 'head';
  const pivot = SkinPreview.COSMETIC_PIVOTS[slot] || [0, 0, 0];

  const probe = { ...model, assembly: { ...model.assembly, offset: [0, 0, 0] } };
  let g;
  try { g = SkinPreview.buildCosmeticGeometry(probe, slot); } catch { return false; }
  if (!g.positions.length) return false;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < g.positions.length; i += 3) {
    minX = Math.min(minX, g.positions[i]); maxX = Math.max(maxX, g.positions[i]);
    minY = Math.min(minY, g.positions[i + 1]); maxY = Math.max(maxY, g.positions[i + 1]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

  cosmeticAssembly.offsetX = round2(cx - pivot[0]);
  cosmeticAssembly.offsetY = round2((6 - pivot[1]) - cy);
  if (cosmeticTarget < 0) writeTargetToInputs();
  return true;
}

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

  const model = cosmeticEditorTexture ? buildEditorModel() : null;
  if (!model) {
    if (empty) empty.hidden = false;
    canvas.style.visibility = 'hidden';
    return;
  }
  if (empty) empty.hidden = true;
  canvas.style.visibility = '';

  const skinImg = await loadSkinImage(session.username) || await SkinPreview.getSteveImage();
  if (!skinImg) return;

  const slot = $('#cosmeticSlotSelect').value || 'head';

  stopCosmeticEditor = SkinPreview.start(
    canvas, skinImg, myCosmeticsSkinSlim(), null,
    [{ model, slot, img: cosmeticEditorTexture }],
    (dx, dy, angle, camDistance, dragMode) => {
      if (dragMode === 'rotate') {
        const inRX = $('#cosmeticRotXInput');
        const inRY = $('#cosmeticRotYInput');
        inRY.value = wrapDegrees(Number(inRY.value || 0) + dx * 0.5);
        inRX.value = wrapDegrees(Number(inRX.value || 0) - dy * 0.5);
        queueEditorRefresh();
        return;
      }
      const upp = editorUnitsPerPixel(canvas, camDistance);

      const c = Math.cos(angle), s = Math.sin(angle);
      const worldDX = dx * upp * c;
      const worldDZ = dx * upp * s;

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

let cosmeticEditorRefreshDirty = false;

function queueEditorRefresh() {
  if (cosmeticEditorRefreshQueued) { cosmeticEditorRefreshDirty = true; return; }
  cosmeticEditorRefreshQueued = true;
  requestAnimationFrame(async () => {
    cosmeticEditorRefreshQueued = false;
    const model = cosmeticEditorTexture ? buildEditorModel() : null;
    if (stopCosmeticEditor && stopCosmeticEditor.updateCosmetics && model) {
      stopCosmeticEditor.updateCosmetics([{
        model,
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

$('#cosmeticPartsBar')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-cosmetic-target]');
  if (chip) { setCosmeticTarget(Number(chip.dataset.cosmeticTarget)); return; }
  if (e.target.closest('[data-cosmetic-add-part]')) {
    if (!cosmeticEditingId) {
      showToast('Előbb mentsd el a kiegészítőt, utána adhatsz hozzá további részeket.', true);
      return;
    }
    cosmeticModelTargetPart = cosmeticParts.length;
    $('#cosmeticModelInput').value = '';
    $('#cosmeticModelInput').click();
  }
});

$('#cosmeticPartPanel')?.addEventListener('click', (e) => {
  if (e.target.closest('[data-cosmetic-replace-part-model]')) {
    cosmeticModelTargetPart = cosmeticTarget;
    $('#cosmeticModelInput').value = '';
    $('#cosmeticModelInput').click();
    return;
  }
  if (e.target.closest('[data-cosmetic-delete-part]')) deleteCosmeticPart(cosmeticTarget);
});

$('#cosmeticPartPanel')?.addEventListener('input', (e) => {
  if (e.target.id !== 'cosmeticPartNameInput') return;
  const part = cosmeticParts[cosmeticTarget];
  if (!part) return;
  part.name = e.target.value.trim() || null;
  part.dirty = true;
  const chip = $('#cosmeticPartsBar')?.querySelector(`[data-cosmetic-target="${cosmeticTarget}"]`);
  if (chip) chip.firstChild && (chip.firstChild.textContent = cosmeticPartLabel(cosmeticTarget));
  const t1 = $('#cosmeticTargetLabel');
  const t2 = $('#cosmeticAnimTargetLabel');
  if (t1) t1.textContent = cosmeticPartLabel(cosmeticTarget);
  if (t2) t2.textContent = cosmeticPartLabel(cosmeticTarget);
});

$('#cosmeticAnimPresets')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-anim-preset]');
  if (!btn) return;
  const preset = ANIM_PRESETS[Number(btn.dataset.animPreset)];
  if (!preset) return;
  const wavy = preset.tracks.some((t) => (Number(t.falloff) || 0) !== 0 || (Number(t.spread) || 0) !== 0);

  if (wavy && cosmeticTarget < 0) {
    const hasAnyModel = cosmeticParts.some((p) => Array.isArray(p.elements) && p.elements.length);
    if (!hasAnyModel) {
      showToast('Előbb tölts fel modellt, utána állítható be a mozgás.', true);
      return;
    }
    const existing = currentAnim();
    if (!existing || !Array.isArray(existing.pivot)) {
      const pivot = suggestRootPivot(-1);
      if (pivot) {
        ensureAnim().pivot = pivot;
        showToast('A forgáspont a kiegészítő tövére került - a hullám innen indul.');
      }
    }
  }

  const anim = ensureAnim();

  const hadTracks = anim.tracks.length > 0;
  if (preset.replace) anim.tracks = [];

  if (anim.tracks.length + preset.tracks.length > 6) {
    showToast('Legfeljebb 6 mozgás lehet egy célon - előbb törölj néhányat.', true);
    return;
  }
  for (const t of preset.tracks) anim.tracks.push(Object.assign({}, t));

  if (wavy && cosmeticTarget >= 0 && !Array.isArray(anim.pivot)) {
    const pivot = suggestRootPivot(cosmeticTarget);
    if (pivot) anim.pivot = pivot;
  }

  if (cosmeticTarget >= 0 && cosmeticParts[cosmeticTarget]) cosmeticParts[cosmeticTarget].dirty = true;
  if (preset.replace && hadTracks) showToast('A kész mozgás lecserélte a korábbi sávokat.');

  renderCosmeticAnimEditor();
  renderCosmeticPartsBar();
  queueEditorRefresh();
});

$('#cosmeticAnimRootPivotBtn')?.addEventListener('click', applyRootPivot);

$('#cosmeticAnimAddBtn')?.addEventListener('click', () => {
  const anim = ensureAnim();
  if (anim.tracks.length >= 6) { showToast('Legfeljebb 6 mozgás lehet egy célon.', true); return; }
  anim.tracks.push({ type: 'rotate', axis: 'z', amp: 20, speed: 1, phase: 0, wave: 'flap',
                     react: 'none', falloff: 0.8, spread: 110, along: 'auto' });
  renderCosmeticAnimEditor();
  renderCosmeticPartsBar();
  queueEditorRefresh();
});

$('#cosmeticAnimClearBtn')?.addEventListener('click', () => {
  setCurrentAnim(null);
  renderCosmeticAnimEditor();
  renderCosmeticPartsBar();
  queueEditorRefresh();
});

$('#cosmeticAnimTracks')?.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-anim-remove]');
  if (!rm) return;
  const anim = currentAnim();
  if (!anim) return;
  anim.tracks.splice(Number(rm.dataset.animRemove), 1);
  if (!anim.tracks.length && !anim.pivot) setCurrentAnim(null);
  if (cosmeticTarget >= 0 && cosmeticParts[cosmeticTarget]) cosmeticParts[cosmeticTarget].dirty = true;
  renderCosmeticAnimEditor();
  renderCosmeticPartsBar();
  queueEditorRefresh();
});

const ANIM_NUMBER_FIELDS = ['amp', 'speed', 'phase', 'falloff', 'spread'];

function onAnimTrackFieldChange(e) {
  const field = e.target.dataset.animField;
  if (!field) return;
  const row = e.target.closest('[data-anim-index]');
  const anim = currentAnim();
  if (!row || !anim) return;
  const track = anim.tracks[Number(row.dataset.animIndex)];
  if (!track) return;
  track[field] = ANIM_NUMBER_FIELDS.includes(field) ? (Number(e.target.value) || 0) : e.target.value;
  if (field === 'falloff') {
    const out = e.target.parentElement && e.target.parentElement.querySelector('output');
    if (out) out.textContent = (Number(e.target.value) || 0).toFixed(2);
  }
  if (cosmeticTarget >= 0 && cosmeticParts[cosmeticTarget]) cosmeticParts[cosmeticTarget].dirty = true;
  if (field === 'type') renderCosmeticAnimEditor();
  queueEditorRefresh();
}
$('#cosmeticAnimTracks')?.addEventListener('input', onAnimTrackFieldChange);
$('#cosmeticAnimTracks')?.addEventListener('change', onAnimTrackFieldChange);

['#cosmeticAnimPivotXInput', '#cosmeticAnimPivotYInput', '#cosmeticAnimPivotZInput'].forEach((sel) => {
  $(sel)?.addEventListener('input', () => {
    const pivot = readAnimPivotFromInputs();
    if (!pivot && !currentAnim()) return;
    const anim = ensureAnim();
    anim.pivot = pivot;
    if (!anim.tracks.length && !pivot) setCurrentAnim(null);
    if (cosmeticTarget >= 0 && cosmeticParts[cosmeticTarget]) cosmeticParts[cosmeticTarget].dirty = true;
    queueEditorRefresh();
  });
});

$('#cosmeticEditorPreview')?.addEventListener('wheel', (e) => {
  if (!hasEditorModel()) return;
  if (e.ctrlKey || e.metaKey) {
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

$('#cosmeticDiscardBtn')?.addEventListener('click', () => { resetCosmeticForm(); closeCosmeticEditor(); });

$('#cosmeticSaveBtn')?.addEventListener('click', async () => {
  const resultEl = $('#cosmeticFormResult');
  const btn = $('#cosmeticSaveBtn');
  const name = $('#cosmeticNameInput').value.trim();
  const slug = $('#cosmeticSlugInput').value.trim().toLowerCase();

  readTargetFromInputs();

  resultEl.className = 'redeem-result';
  if (!name) { resultEl.textContent = 'Adj meg egy nevet.'; resultEl.classList.add('error'); return; }
  if (!cosmeticEditingId && !/^[a-z0-9_]{3,48}$/.test(slug)) {
    resultEl.textContent = 'Az azonosító csak kisbetűt, számot és alulvonást tartalmazhat (3-48 karakter).';
    resultEl.classList.add('error');
    return;
  }
  const firstPart = cosmeticParts[0];
  if (!cosmeticEditingId && !(firstPart && firstPart.file)) {
    resultEl.textContent = 'Új kiegészítőhöz modellt is fel kell tölteni.';
    resultEl.classList.add('error');
    return;
  }

  function animField(anim) {
    if (!anim || !Array.isArray(anim.tracks) || (!anim.tracks.length && !anim.pivot)) return '';
    return JSON.stringify({ tracks: anim.tracks, pivot: anim.pivot || null });
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
  formData.append('offsetX', String(cosmeticAssembly.offsetX));
  formData.append('offsetY', String(cosmeticAssembly.offsetY));
  formData.append('offsetZ', String(cosmeticAssembly.offsetZ));
  formData.append('rotationX', String(cosmeticAssembly.rotationX));
  formData.append('rotationY', String(cosmeticAssembly.rotationY));
  formData.append('rotationZ', String(cosmeticAssembly.rotationZ));
  formData.append('scale', String(cosmeticAssembly.scale));
  formData.append('itemModelSpace', cosmeticAssembly.itemModelSpace !== false ? 'true' : 'false');
  formData.append('anim', animField(cosmeticAssembly.anim));
  formData.append('petMeta', cosmeticPetMeta ? JSON.stringify(cosmeticPetMeta) : '');
  const auraToSave = readCosmeticAura();
  formData.append('aura', auraToSave ? JSON.stringify(auraToSave) : '');
  formData.append('gameEffects', cosmeticGameEffects.length ? JSON.stringify(cosmeticGameEffects) : '');
  formData.append('effectServers', cosmeticEffectServers.length ? JSON.stringify(cosmeticEffectServers) : '');
  const rigBox = $('#cosmeticRigBox');
  if (rigBox && !rigBox.classList.contains('hidden')) {
    formData.append('rigEnabled', $('#cosmeticRigEnabledCheckbox')?.checked ? '1' : '0');
  }
  if (firstPart && firstPart.file) formData.append('model', firstPart.file);
  if (cosmeticSelectedTextureFile) formData.append('texture', cosmeticSelectedTextureFile);

  btn.disabled = true;
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
      resultEl.classList.add('error');
      return;
    }

    const savedId = cosmeticEditingId || data.cosmetic?.id;
    const wasCreate = !cosmeticEditingId;

    if (wasCreate && data.cosmetic?.parts?.length && cosmeticParts[0]) {
      cosmeticParts[0].id = data.cosmetic.parts[0].id;
      cosmeticParts[0].hasModel = true;
    }
    let partError = null;
    for (const part of cosmeticParts) {
      if (!part.id || !savedId) continue;
      const pf = new FormData();
      pf.append('name', part.name || '');
      pf.append('offsetX', String(part.offsetX));
      pf.append('offsetY', String(part.offsetY));
      pf.append('offsetZ', String(part.offsetZ));
      pf.append('rotationX', String(part.rotationX));
      pf.append('rotationY', String(part.rotationY));
      pf.append('rotationZ', String(part.rotationZ));
      pf.append('scale', String(part.scale));
      pf.append('anim', animField(part.anim));
      if (part.file && part !== cosmeticParts[0]) pf.append('model', part.file);
      try {
        const pres = await fetch(BACKEND_URL + '/api/admin/cosmetics/' + savedId + '/parts/' + part.id, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + session.token },
          body: pf
        });
        const pdata = await pres.json();
        if (!pdata.ok) partError = pdata.message || 'Egy rész mentése nem sikerült.';
        else { part.file = null; part.dirty = false; }
      } catch {
        partError = 'Hálózati hiba egy rész mentésekor.';
      }
    }
    if (partError) {
      resultEl.textContent = partError;
      resultEl.classList.add('error');
      return;
    }

    cosmeticAssetBust++;
    if (savedId) cosmeticThumbCache.delete(savedId);
    if (savedId) cosmeticModelCache.delete(savedId);

    showToast(wasCreate ? 'Kiegészítő létrehozva.' : 'Kiegészítő frissítve.');
    await loadCosmeticsAdmin();
    if (wasCreate && savedId) {
      openCosmeticForEdit(savedId);
    } else {
      renderCosmeticPartsBar();
    }
  } catch {
    resultEl.textContent = 'Hálózati hiba.';
    resultEl.classList.add('error');
  } finally {
    btn.disabled = false;
  }
});

async function openCosmeticForEdit(id) {
  const item = cosmeticsAdminItems.find((c) => String(c.id) === String(id));
  if (!item) return;

  cosmeticEditingId = item.id;
  cosmeticSelectedTextureFile = null;
  openCosmeticEditor('edit');
  $('#cosmeticFormTitle').textContent = 'Kiegészítő szerkesztése';
  $('#cosmeticNameInput').value = item.name;
  $('#cosmeticSlugInput').value = item.slug;
  $('#cosmeticSlugInput').disabled = true;
  $('#cosmeticSlotSelect').value = item.slot;
  $('#cosmeticRaritySelect').value = item.rarity;
  $('#cosmeticDescInput').value = item.description || '';
  $('#cosmeticPriceInput').value = item.priceSc !== null && item.priceSc !== undefined ? item.priceSc : '';
  $('#cosmeticDurationInput').value = item.defaultDurationDays || '';
  $('#cosmeticTradableCheckbox').checked = !!item.tradable;
  $('#cosmeticEnabledCheckbox').checked = !!item.enabled;
  $('#cosmeticModelInput').value = '';
  $('#cosmeticTextureInput').value = '';
  $('#cosmeticModelNote').textContent = item.hasModel
    ? 'Van feltöltött modell. Új fájl kiválasztása felülírja az 1. rész geometriáját.'
    : 'Ehhez a kiegészítőhöz még nincs modell feltöltve.';
  if (item.hasTexture) {
    $('#cosmeticTexturePreview').src = cosmeticTextureUrl(item.id);
    $('#cosmeticTexturePreviewWrap').hidden = false;
  } else {
    $('#cosmeticTexturePreview').src = '';
    $('#cosmeticTexturePreviewWrap').hidden = true;
  }
  $('#cosmeticFormResult').textContent = '';
  $('#cosmeticFormResult').className = 'redeem-result';
  $('#cosmeticSaveBtn').textContent = 'Frissítés';

  cosmeticAura = (item.aura && typeof item.aura === 'object') ? { ...item.aura } : null;
  cosmeticGameEffects = Array.isArray(item.gameEffects) ? item.gameEffects.map((e) => ({ ...e })) : [];
  cosmeticEffectServers = Array.isArray(item.effectServers) ? item.effectServers.slice() : [];
  renderCosmeticAuraEditor();
  renderCosmeticEffectEditor();

  cosmeticPetMeta = (item.petMeta && typeof item.petMeta === 'object') ? item.petMeta : null;
  if (cosmeticPetMeta) {
    $('#cosmeticPetBox')?.classList.remove('hidden');
    $('#cosmeticPetTitle') && ($('#cosmeticPetTitle').textContent = 'Figura újragenerálása');
    writePetMeta(cosmeticPetMeta);
    loadPetSkinFromCosmetic(item);
  }

  cosmeticAssembly = {
    offsetX: item.offsetX ?? 0,
    offsetY: item.offsetY ?? 0,
    offsetZ: item.offsetZ ?? 0,
    rotationX: item.rotationX ?? 0,
    rotationY: item.rotationY ?? 0,
    rotationZ: item.rotationZ ?? 0,
    scale: item.scale ?? 1,
    itemModelSpace: item.itemModelSpace !== false,
    anim: item.anim || null
  };
  cosmeticParts = (item.parts && item.parts.length ? item.parts : [{ id: null, idx: 0 }]).map((raw, i) => {
    const part = emptyPart(i);
    part.id = raw.id ?? null;
    part.name = raw.name || null;
    part.offsetX = raw.offsetX ?? 0;
    part.offsetY = raw.offsetY ?? 0;
    part.offsetZ = raw.offsetZ ?? 0;
    part.rotationX = raw.rotationX ?? 0;
    part.rotationY = raw.rotationY ?? 0;
    part.rotationZ = raw.rotationZ ?? 0;
    part.scale = raw.scale ?? 1;
    part.anim = raw.anim || null;
    part.hasModel = !!raw.hasModel;
    return part;
  });
  cosmeticTarget = -1;
  cosmeticEditorTexture = null;
  writeTargetToInputs();
  renderCosmeticPartsBar();
  renderCosmeticAnimEditor();
  renderCosmeticRigBox();
  queueEditorRefresh();

  $('#cosmeticFormTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!item.hasModel || !item.hasTexture) return;
  try {
    const [model, img] = await Promise.all([
      fetchCosmeticModel(item.id, { fresh: true, flat: true }),
      loadImage(cosmeticTextureUrl(item.id))
    ]);
    if (String(cosmeticEditingId) !== String(item.id)) return;
    cosmeticEditorTexture = img;
    const rawParts = (model && Array.isArray(model.parts) && model.parts.length)
      ? model.parts
      : (model ? [{ elements: model.elements, texture_size: model.texture_size }] : []);
    const withModel = cosmeticParts.filter((pp) => pp.hasModel);
    rawParts.forEach((raw, i) => {
      const target = withModel[i];
      if (!target) return;
      target.elements = raw.elements || null;
      target.textureSize = Array.isArray(raw.texture_size) ? raw.texture_size : null;
    });
    renderCosmeticPartsBar();
    restartCosmeticEditor();
  } catch {
  }
}

document.addEventListener('click', async (e) => {
  const editBtn = e.target.closest('[data-cosmetic-edit]');
  if (editBtn) {
    openCosmeticForEdit(editBtn.dataset.cosmeticEdit);
    return;
  }

  const animBtn = e.target.closest('[data-cosmetic-anim]');
  if (animBtn) {
    await openCosmeticForEdit(animBtn.dataset.cosmeticAnim);
    setCosmeticTab('anim');
    return;
  }

  const deleteBtn = e.target.closest('[data-cosmetic-delete]');
  if (deleteBtn) {
    const item = cosmeticsAdminItems.find((c) => String(c.id) === deleteBtn.dataset.cosmeticDelete);
    if (!item) return;
    const confirmed = await confirmModal(
      'Kiegészítő végleges törlése',
      `Biztosan törlöd a(z) "${escapeHtml(item.name)}" kiegészítőt? Elvonja mind a ${item.ownerCount} tulajdonosától, és törli a hozzá tartozó piaci hirdetéseket is. Ez nem vonható vissza.`,
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

let currentAdminPlayerCosmetics = [];
let adminCosmeticSearch = '';
let adminCosmeticFilter = 'all';

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
  await ensureAllCosmeticsLoaded();
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
  const el = $('#adminPlayerCosmeticsList');
  if (!el) return;

  const canGrant = hasPerm('player.action.cosmeticGrant');
  const canRevoke = hasPerm('player.action.cosmeticRevoke');
  const ownedById = new Map(currentAdminPlayerCosmetics.map((c) => [String(c.id), c]));

  const q = adminCosmeticSearch;
  const visible = allCosmeticsCache.filter((c) => {
    const isOwned = ownedById.has(String(c.id));
    if (adminCosmeticFilter === 'owned' && !isOwned) return false;
    if (adminCosmeticFilter === 'missing' && isOwned) return false;
    if (!q) return true;
    return (c.name || '').toLowerCase().includes(q)
      || (c.slotLabel || '').toLowerCase().includes(q)
      || (c.slug || '').toLowerCase().includes(q);
  });

  const count = $('#adminCosmeticCount');
  if (count) {
    count.textContent = allCosmeticsCache.length
      ? `${ownedById.size} / ${allCosmeticsCache.length} megvan`
      : '';
  }

  if (!allCosmeticsCache.length) {
    el.innerHTML = '<p class="redeem-result">Még nincs egyetlen kiegészítő sem a katalógusban.</p>';
    return;
  }
  if (!visible.length) {
    el.innerHTML = '<p class="redeem-result">Nincs a szűrésnek megfelelő kiegészítő.</p>';
    return;
  }

  el.innerHTML = visible.map((c) => {
    const own = ownedById.get(String(c.id));
    const isOwned = !!own;
    const disabled = isOwned ? !canRevoke : !canGrant;
    const meta = isOwned
      ? (own.expiresAt ? formatLedgerDate(own.expiresAt) + '-ig' : 'örök')
      : (c.slotLabel || '');
    const title = isOwned
      ? (canRevoke ? 'Kattints az elvételhez' : 'Nincs jogod elvenni')
      : (canGrant ? 'Kattints az odaadáshoz' : 'Nincs jogod odaadni');
    return `
      <button type="button" class="admin-cosmetic-item${isOwned ? ' is-owned' : ''}"
              data-admin-cosmetic-id="${c.id}" data-owned="${isOwned ? '1' : ''}"
              title="${escapeHtml(title)}"${disabled ? ' disabled' : ''}>
        ${c.hasTexture
          ? `<img class="admin-cosmetic-item-thumb" src="${cosmeticTextureUrl(c.id)}" alt="" loading="lazy" />`
          : '<span class="admin-cosmetic-item-thumb"></span>'}
        <span class="admin-cosmetic-item-main">
          <span class="admin-cosmetic-item-name">${escapeHtml(c.name)}</span>
          <span class="admin-cosmetic-item-meta">${escapeHtml(meta)}</span>
        </span>
        <span class="admin-cosmetic-item-action">${isOwned ? '&times;' : '+'}</span>
      </button>`;
  }).join('');
}

$('#adminCosmeticSearch')?.addEventListener('input', (e) => {
  adminCosmeticSearch = e.target.value.trim().toLowerCase();
  renderAdminPlayerCosmeticsList(currentAdminPlayerCosmetics);
});
$('#adminCosmeticFilter')?.addEventListener('change', (e) => {
  adminCosmeticFilter = e.target.value;
  renderAdminPlayerCosmeticsList(currentAdminPlayerCosmetics);
});

function adminCosmeticResult(data, okText) {
  const statusEl = $('#adminCosmeticGrantStatus');
  if (!data || !data.ok) {
    if (statusEl) {
      statusEl.textContent = (data && data.message) || 'Nem sikerült.';
      statusEl.className = 'redeem-result error';
    }
    return false;
  }
  if (statusEl) {
    statusEl.textContent = okText;
    statusEl.className = 'redeem-result success';
  }
  renderAdminPlayerCosmeticsList(data.owned);
  return true;
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-admin-cosmetic-id]');
  if (!btn || btn.disabled) return;
  const id = btn.dataset.adminCosmeticId;
  const isOwned = !!btn.dataset.owned;
  btn.disabled = true;
  try {
    let data;
    if (isOwned) {
      const res = await fetch(
        BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/cosmetics/' + id,
        { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } });
      data = await res.json();
      adminCosmeticResult(data, 'Kiegészítő elvéve.');
    } else {
      const durationRaw = $('#adminCosmeticDurationInput').value.trim();
      const res = await fetch(
        BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/cosmetics',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
          body: JSON.stringify({ cosmeticId: Number(id), durationDays: durationRaw === '' ? undefined : Number(durationRaw) })
        });
      data = await res.json();
      adminCosmeticResult(data, 'Kiegészítő kiosztva.');
    }
  } catch {
    const statusEl = $('#adminCosmeticGrantStatus');
    if (statusEl) {
      statusEl.textContent = 'Nem sikerült elérni a szervert.';
      statusEl.className = 'redeem-result error';
    }
    btn.disabled = false;
  }
});

$('#adminCosmeticGrantAllBtn')?.addEventListener('click', async () => {
  const durationRaw = $('#adminCosmeticDurationInput').value.trim();
  const confirmed = await confirmModal(
    'Az összes kiegészítő odaadása',
    `Biztosan odaadod ${lastAdminPlayerUsername} játékosnak a katalógus ÖSSZES bekapcsolt kiegészítőjét${
      durationRaw === '' ? '' : durationRaw === '0' ? ' (örökre)' : ` (${durationRaw} napra)`}? A már meglévőknél az érvényesség is erre frissül.`,
    'Igen, mindet odaadom');
  if (!confirmed) return;
  try {
    const res = await fetch(
      BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/cosmetics/all',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
        body: JSON.stringify({ durationDays: durationRaw === '' ? undefined : Number(durationRaw) })
      });
    const data = await res.json();
    if (adminCosmeticResult(data, `${data.granted} kiegészítő kiosztva.`)) showToast('Mind kiosztva.');
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

$('#adminCosmeticRevokeAllBtn')?.addEventListener('click', async () => {
  const confirmed = await confirmModal(
    'Az összes kiegészítő elvétele',
    `Biztosan elveszed ${lastAdminPlayerUsername} játékos ÖSSZES kiegészítőjét? Amit épp visel, az azonnal lekerül róla. Ez nem vonható vissza - a megvásárolt tételek is elvesznek.`,
    'Igen, mindet elveszem');
  if (!confirmed) return;
  try {
    const res = await fetch(
      BACKEND_URL + '/api/admin/player/' + encodeURIComponent(lastAdminPlayerUsername) + '/cosmetics',
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (adminCosmeticResult(data, `${data.revoked} kiegészítő elvéve.`)) showToast('Mind elvéve.');
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

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

let mobsAdminItems = [];
let mobAuraTypes = [];
let mobLimits = { maxElements: 256, maxParts: 8 };

let mobEditingId = null;
let mobAssembly = null;
let mobParts = [];
let mobTarget = -1;
let mobTextureFile = null;
let mobTextureImg = null;
let mobPreviewStop = null;
let mobRigData = null;
let mobRigPlaying = -1;
let mobPreviewQueued = false;
let mobPreviewDirty = false;
let mobAssetBust = 0;
const mobThumbCache = new Map();
const mobModelCache = new Map();

const MOB_ANIM_PRESETS = [
  { label: 'Légzés', pivot: 'base',
    hint: 'Alig látható, lassú mozgás - ettől nem néz ki élettelen szobornak egy álló boss.',
    tracks: [
      { type: 'scale', axis: 'y', amp: 0.025, speed: 0.3, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'translate', axis: 'y', amp: 0.35, speed: 0.3, phase: 90, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Fenyegető ringás', pivot: 'base',
    hint: 'Súlyos, lassú oldalirányú dőlés a talp körül. Nagy, humanoid bossokra.',
    tracks: [
      { type: 'rotate', axis: 'z', amp: 4.5, speed: 0.18, phase: 0, wave: 'sine', react: 'none', falloff: 0.35, spread: 15, along: 'y' },
      { type: 'rotate', axis: 'x', amp: 2.5, speed: 0.36, phase: 60, wave: 'sine', react: 'none', falloff: 0.35, spread: 0, along: 'y' }
    ] },

  { label: 'Lebegés', pivot: 'center',
    hint: 'Levegőben álló mobokra (szellem, kristály, koponya): fel-le úszás enyhe billegéssel.',
    tracks: [
      { type: 'translate', axis: 'y', amp: 1.6, speed: 0.22, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'rotate', axis: 'z', amp: 3, speed: 0.11, phase: 90, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'rotate', axis: 'x', amp: 2, speed: 0.22, phase: 45, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Nehéz léptek (járás közben)', pivot: 'base',
    hint: 'Csak mozgás közben: minden lépésnél megdől és lehuppan. A dőlés fele olyan gyors, mint a huppanás - egy lépésre egy dőlés jut.',
    tracks: [
      { type: 'translate', axis: 'y', amp: 0.7, speed: 1.2, phase: 0, wave: 'sine', react: 'move', falloff: 0, spread: 0, along: 'auto' },
      { type: 'rotate', axis: 'z', amp: 3.5, speed: 0.6, phase: 0, wave: 'sine', react: 'move', falloff: 0.3, spread: 10, along: 'y' }
    ] },

  { label: 'Támadó előredőlés (járás közben)', pivot: 'base',
    hint: 'Rohamozó mobokra: a test előrebillen, mintha nekifeszülne.',
    tracks: [
      { type: 'rotate', axis: 'x', amp: 9, speed: 0.5, phase: 0, wave: 'flap', react: 'move', falloff: 0.5, spread: 25, along: 'y' },
      { type: 'translate', axis: 'y', amp: 0.4, speed: 1.0, phase: 30, wave: 'sine', react: 'move', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Dühroham', pivot: 'base',
    hint: 'Gyors, apró rázkódás - fázisváltáshoz, megidézéshez, "felébred a boss" pillanathoz.',
    tracks: [
      { type: 'translate', axis: 'x', amp: 0.45, speed: 6, phase: 0, wave: 'tri', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'translate', axis: 'z', amp: 0.45, speed: 6, phase: 90, wave: 'tri', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'rotate', axis: 'y', amp: 2, speed: 12, phase: 0, wave: 'tri', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Forgó támadás', pivot: 'base',
    hint: 'Folyamatos körbeforgás a függőleges tengely körül (fűrész-hullám = egyenletes pörgés, nem oda-vissza).',
    tracks: [
      { type: 'rotate', axis: 'y', amp: 180, speed: 1.1, phase: 0, wave: 'saw', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'translate', axis: 'y', amp: 0.5, speed: 2.2, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Lassú lebegő pörgés', pivot: 'center',
    hint: 'Kristályokra, koponyákra, lebegő gépezetekre: méltóságteljes körbefordulás.',
    tracks: [
      { type: 'rotate', axis: 'y', amp: 180, speed: 0.12, phase: 0, wave: 'saw', react: 'none', falloff: 0, spread: 0, along: 'auto' },
      { type: 'translate', axis: 'y', amp: 1.0, speed: 0.24, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Pulzálás', pivot: 'center',
    hint: 'Energia-lüktetés: a modell ritmusra kicsit nagyobb és kisebb lesz.',
    tracks: [
      { type: 'scale', axis: 'y', amp: 0.07, speed: 0.9, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Szárnycsapás (nagy test)', pivot: 'root',
    hint: 'Sárkány-léptékű szárnyra: lassabb és kisebb kitérésű, mint a kiegészítő-szárnyaké. A rész TÖVÉRE teszi a forgáspontot.',
    tracks: [
      { type: 'rotate', axis: 'z', amp: 26, speed: 0.4, phase: 0, wave: 'flap', react: 'none', falloff: 0.85, spread: 45, along: 'auto' },
      { type: 'rotate', axis: 'x', amp: 7, speed: 0.4, phase: 30, wave: 'sine', react: 'none', falloff: 0.7, spread: 30, along: 'auto' },
      { type: 'translate', axis: 'y', amp: 0.5, speed: 0.4, phase: 180, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Farok-söprés', pivot: 'root',
    hint: 'Farokra, csápra: a mozgás VÉGIGFUT a részen (a hegy késve követi a tövet).',
    tracks: [
      { type: 'rotate', axis: 'y', amp: 20, speed: 0.35, phase: 0, wave: 'sine', react: 'none', falloff: 0.95, spread: 80, along: 'auto' }
    ] },

  { label: 'Tekergő csáp', pivot: 'root',
    hint: 'Hosszú, lógó részekre (csáp, lánc, láng): két tengelyen futó hullám.',
    tracks: [
      { type: 'rotate', axis: 'x', amp: 12, speed: 0.55, phase: 0, wave: 'sine', react: 'none', falloff: 1, spread: 130, along: 'auto' },
      { type: 'rotate', axis: 'z', amp: 12, speed: 0.55, phase: 90, wave: 'sine', react: 'none', falloff: 1, spread: 130, along: 'auto' }
    ] },

  { label: 'Roskadás', pivot: 'base',
    hint: 'Sérült/haldokló állapothoz: lassú, egyenetlen előredőlés és visszaemelkedés.',
    tracks: [
      { type: 'rotate', axis: 'x', amp: 7, speed: 0.16, phase: 0, wave: 'flap', react: 'none', falloff: 0.6, spread: 20, along: 'y' },
      { type: 'translate', axis: 'y', amp: -0.6, speed: 0.16, phase: 0, wave: 'flap', react: 'none', falloff: 0, spread: 0, along: 'auto' }
    ] },

  { label: 'Nincs mozgás', pivot: 'center', clear: true,
    hint: 'Törli a kijelölt cél összes sávját.', tracks: [] }
];

function mobsAdminSection() {
  return document.querySelector('.view[data-view="mobsAdmin"]');
}

function mobModelUrl(id) {
  return BACKEND_URL + '/api/admin/mobs/' + id + '/model' + (mobAssetBust ? ('?v=' + mobAssetBust) : '');
}

function mobTextureUrl(id) {
  return BACKEND_URL + '/api/mobs/texture/' + id + (mobAssetBust ? ('?v=' + mobAssetBust) : '');
}

async function loadMobsAdmin() {
  const wrap = $('#mobsAdminList');
  if (!wrap) return;
  wrap.innerHTML = '<div class="card"><p class="redeem-result">Betöltés...</p></div>';
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/mobs', {
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) {
      wrap.innerHTML = `<div class="card"><p class="redeem-result error">${escapeHtml(data.message || 'Nem sikerült betölteni a mobokat.')}</p></div>`;
      return;
    }
    mobsAdminItems = data.mobs || [];
    mobAuraTypes = data.auraTypes || [];
    mobLimits = data.limits || mobLimits;
    if (window.SkinPreview && SkinPreview.setAuraPresets) SkinPreview.setAuraPresets(mobAuraTypes);
    renderMobsAdmin();
  } catch {
    wrap.innerHTML = '<div class="card"><p class="redeem-result error">Hálózati hiba a mobok betöltésekor.</p></div>';
  }
}

function renderMobsAdmin() {
  const wrap = $('#mobsAdminList');
  if (!wrap) return;
  const query = ($('#mobAdminSearch')?.value || '').trim().toLowerCase();
  const showHidden = !!$('#mobShowHiddenCheckbox')?.checked;

  let list = mobsAdminItems.filter((m) => showHidden || m.centerVisible || m.orphan);
  if (query) {
    list = list.filter((m) => (m.name || '').toLowerCase().includes(query)
      || (m.slug || '').toLowerCase().includes(query));
  }

  if (!list.length) {
    const why = mobsAdminItems.length === 0
      ? 'Még egyetlen mob sem szinkronizált ide. Indítsd el a szerveren a <strong>SolarMobs</strong> plugint, majd kapcsold láthatóra a mobot: <code>/solarmob center &lt;azonosító&gt; on</code>.'
      : (query
        ? 'Nincs a keresésnek megfelelő mob.'
        : 'Egyetlen mob sincs láthatóra kapcsolva a szerveren. Kapcsold be ingame: <code>/solarmob center &lt;azonosító&gt; on</code> &ndash; vagy pipáld be fent a rejtettek mutatását.');
    wrap.innerHTML = `<div class="card"><p class="redeem-result">${why}</p></div>`;
    return;
  }

  const orphans = mobsAdminItems.filter((m) => m.orphan).length;
  const pruneBtn = $('#mobPruneBtn');
  if (pruneBtn) {
    pruneBtn.classList.toggle('hidden', orphans === 0);
    pruneBtn.textContent = `Nem létező mobok törlése (${orphans})`;
  }

  wrap.innerHTML = `<div class="mob-admin-grid">${list.map((m) => {
    const hb = m.effectiveHitbox || {};
    const hbText = hb.mode === 'vanilla' || !hb.width
      ? 'vanilla méret'
      : `${hb.width} &times; ${hb.height} blokk`;
    return `
    <div class="mob-admin-card${m.enabled ? '' : ' is-off'}${m.centerVisible && !m.orphan ? '' : ' is-hidden-server'}${m.orphan ? ' is-orphan' : ''}">
      ${mobThumbHtml(m)}
      <div class="mob-admin-card-name">${escapeHtml(m.name || m.slug)}</div>
      <div class="mob-admin-card-slug">${escapeHtml(m.slug)}</div>
      <div class="mob-admin-card-tags">
        ${m.baseType ? `<span class="cosmetic-tag">${escapeHtml(m.baseType.toLowerCase())}</span>` : ''}
        ${m.animated ? '<span class="cosmetic-tag">animált</span>' : ''}
        ${m.aura ? '<span class="cosmetic-tag">aura</span>' : ''}
        ${m.orphan ? '<span class="mob-badge-warn">a szerveren már nincs</span>' : ''}
        ${m.centerVisible || m.orphan ? '' : '<span class="mob-badge-warn">a szerveren rejtett</span>'}
        ${m.enabled ? '' : '<span class="mob-badge-warn">kikapcsolva</span>'}
        ${m.hasModel ? '' : '<span class="mob-badge-warn">nincs modell</span>'}
        ${m.hasModel && !m.hasTexture ? '<span class="mob-badge-warn">nincs textúra</span>' : ''}
      </div>
      <div class="mob-admin-card-meta">
        Hitbox: ${hbText}<br />
        ${m.stats && Number.isFinite(m.stats.health) ? `Élet: ${m.stats.health}` : ''}
        ${m.servers && m.servers.length ? `<br />Szerver: ${escapeHtml(m.servers.join(', '))}` : ''}
      </div>
      <div class="mob-admin-card-actions">
        <button type="button" class="btn-glow" data-mob-edit="${m.id}">Szerkesztés</button>
        <button type="button" class="btn-outline" data-mob-remove="${m.id}" title="A megjelenés (modell, textúra, beállítások) törlése. A mob a szerveren megmarad, ha a plugin még ismeri.">Törlés</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  hydrateMobThumbs(wrap);
}

function mobThumbHtml(m) {
  if (!m.hasModel || !m.hasTexture) {
    return '<div class="mob-thumb mob-thumb-empty"></div>';
  }
  const cached = mobThumbCache.get(m.id);
  if (cached) return `<img class="mob-thumb" src="${cached}" alt="${escapeHtml(m.name || m.slug)} előnézeti képe" />`;
  return `<div class="mob-thumb mob-thumb-empty" data-mob-thumb="${m.id}" data-mob-name="${escapeHtml(m.name || m.slug)}"></div>`;
}

async function hydrateMobThumbs(root) {
  const slots = [...(root || document).querySelectorAll('[data-mob-thumb]')];
  for (const el of slots) {
    const id = Number(el.dataset.mobThumb);
    if (!Number.isInteger(id)) continue;
    if (mobThumbCache.has(id)) { replaceMobThumb(el, mobThumbCache.get(id)); continue; }
    const [model, img] = await Promise.all([fetchMobModel(id), loadImage(mobTextureUrl(id))]);
    if (!model || !img) continue;
    const url = SkinPreview.renderCosmeticThumbnail(model, img, 170);
    if (!url) continue;
    mobThumbCache.set(id, url);
    replaceMobThumb(el, url);
  }
}

function replaceMobThumb(el, url) {
  if (!el.parentNode) return;
  const img = document.createElement('img');
  img.className = 'mob-thumb';
  img.src = url;
  img.alt = (el.dataset.mobName || 'Mob') + ' előnézeti képe';
  el.parentNode.replaceChild(img, el);
}

async function fetchMobRig(id) {
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/mobs/' + id + '/rig', {
      headers: { Authorization: 'Bearer ' + session.token },
      cache: 'no-store'
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchMobModel(id, opts) {
  const fresh = !!(opts && opts.fresh);
  if (!fresh && mobModelCache.has(id)) return mobModelCache.get(id);
  try {
    const res = await fetch(mobModelUrl(id), {
      headers: { Authorization: 'Bearer ' + session.token },
      cache: fresh ? 'no-store' : 'default'
    });
    if (!res.ok) return null;
    const model = await res.json();
    mobModelCache.set(id, model);
    return model;
  } catch {
    return null;
  }
}

function emptyMobPart(idx) {
  return {
    id: null, idx, name: null,
    offsetX: 0, offsetY: 0, offsetZ: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    scale: 1, anim: null,
    hasModel: false,
    elements: null, textureSize: null,
    dirty: false
  };
}

function mobCurrentRecord() {
  if (mobTarget < 0) return mobAssembly;
  return mobParts[mobTarget] || mobAssembly;
}

async function openMobEditor(id) {
  const mob = mobsAdminItems.find((m) => String(m.id) === String(id));
  if (!mob) return;

  mobEditingId = mob.id;
  mobTextureFile = null;
  mobTextureImg = null;
  mobTarget = -1;

  mobAssembly = {
    offsetX: mob.offsetX, offsetY: mob.offsetY, offsetZ: mob.offsetZ,
    rotationX: mob.rotationX, rotationY: mob.rotationY, rotationZ: mob.rotationZ,
    scale: mob.scale,
    itemModelSpace: mob.itemModelSpace !== false,
    anim: mob.anim ? JSON.parse(JSON.stringify(mob.anim)) : null,
    aura: mob.aura ? JSON.parse(JSON.stringify(mob.aura)) : null,
    hideVanilla: mob.hideVanilla !== false,
    enabled: mob.enabled !== false,
    hitboxMode: mob.hitboxMode || 'auto',
    hitboxWidth: mob.hitboxWidth,
    hitboxHeight: mob.hitboxHeight,
    nameOffset: mob.nameOffset || 0
  };

  mobParts = (mob.parts || []).map((p) => ({
    id: p.id, idx: p.idx, name: p.name,
    offsetX: p.offsetX, offsetY: p.offsetY, offsetZ: p.offsetZ,
    rotationX: p.rotationX, rotationY: p.rotationY, rotationZ: p.rotationZ,
    scale: p.scale, anim: p.anim ? JSON.parse(JSON.stringify(p.anim)) : null,
    hasModel: p.hasModel, elements: null, textureSize: null, dirty: false
  }));
  if (!mobParts.length) mobParts = [emptyMobPart(0)];

  $('#mobEditorTitle').textContent = (mob.name || mob.slug) + '  (' + mob.slug + ')';
  $('#mobFormResult').textContent = '';
  $('#mobTextureNote').textContent = mob.hasTexture ? 'Jelenleg van feltöltött textúra.' : 'Még nincs textúra.';
  renderMobStats(mob);
  renderMobAuraSelect();
  writeMobAuraToInputs();
  writeMobDisplayFields();
  setMobTab('model');
  mobsAdminSection()?.classList.add('editing');

  if (mob.hasModel) {
    const model = await fetchMobModel(mob.id, { fresh: true });
    if (model && Array.isArray(model.parts)) {
      model.parts.forEach((raw, i) => {
        if (!mobParts[i]) return;
        mobParts[i].elements = raw.elements;
        mobParts[i].textureSize = Array.isArray(raw.texture_size) ? raw.texture_size : null;
      });
    }
  }
  if (mob.hasTexture) {
    mobTextureImg = await loadImage(mobTextureUrl(mob.id) + (mobAssetBust ? '' : '?t=' + Date.now()));
    const wrapEl = $('#mobTexturePreviewWrap');
    if (mobTextureImg && wrapEl) {
      $('#mobTexturePreview').src = mobTextureImg.src;
      wrapEl.hidden = false;
    }
  } else {
    $('#mobTexturePreviewWrap').hidden = true;
  }

  mobRigPlaying = -1;
  mobRigData = mob.hasRig ? await fetchMobRig(mob.id) : null;

  setMobTarget(-1, true);
  restartMobPreview();
  renderMobRigAnimations();
}

function closeMobEditor() {
  mobsAdminSection()?.classList.remove('editing');
  if (mobPreviewStop) { mobPreviewStop(); mobPreviewStop = null; }
  mobEditingId = null;
  mobTextureFile = null;
  mobTextureImg = null;
  mobParts = [];
  mobAssembly = null;
  mobRigData = null;
  mobRigPlaying = -1;
}

function renderMobStats(mob) {
  const card = $('#mobStatsCard');
  if (!card) return;
  const st = mob.stats || {};
  const rows = [];
  if (mob.baseType) rows.push(['Alap entitás', mob.baseType.toLowerCase()]);
  if (Number.isFinite(st.health)) rows.push(['Élet', String(st.health)]);
  if (Number.isFinite(st.damage)) rows.push(['Sebzés', String(st.damage)]);
  if (Number.isFinite(st.armor)) rows.push(['Páncél', String(st.armor)]);
  if (Number.isFinite(st.drops)) rows.push(['Zsákmány-sorok', String(st.drops)]);
  if (st.bossBar) rows.push(['Boss sáv', 'van']);
  const vh = mob.vanillaHitbox || {};
  if (vh.width) rows.push(['Vanilla hitbox', vh.width + ' × ' + vh.height]);
  rows.push(['Utolsó szinkron', mobSyncAgo(mob.lastSyncAt)]);

  const abilities = Array.isArray(st.abilities) ? st.abilities : [];
  card.innerHTML = `
    <div class="card-title">A szerverről</div>
    ${rows.map(([k, v]) => `<div class="mob-stats-row"><span>${escapeHtml(k)}</span><strong>${escapeHtml(v)}</strong></div>`).join('')}
    ${abilities.length ? `<ul class="mob-stats-abilities">${abilities.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>` : ''}
    <p class="cosmetic-file-note" style="margin-top:8px;">Ezek a mob VISELKEDÉSÉNEK adatai, és csak tájékoztatásul látszanak &ndash; a szerveren, a <code>/solarmob</code> paranccsal állíthatók.</p>`;
}

function renderMobPartsBar() {
  const bar = $('#mobPartsBar');
  if (!bar) return;
  const chips = [`<button type="button" class="cosmetic-part-chip${mobTarget < 0 ? ' active' : ''}" data-mob-target="-1">Teljes mob</button>`];
  mobParts.forEach((p, i) => {
    chips.push(`<button type="button" class="cosmetic-part-chip${mobTarget === i ? ' active' : ''}" data-mob-target="${i}">${i + 1}. rész${p.hasModel ? '' : ' ⚠'}</button>`);
  });
  bar.innerHTML = chips.join('');

  const panel = $('#mobPartPanel');
  if (!panel) return;
  if (mobTarget < 0) {
    panel.innerHTML = '<p class="cosmetic-file-note">A teljes mob illesztése és animációja. A részek beállításai EZEN BELÜL értendők.</p>';
    return;
  }
  const part = mobParts[mobTarget];
  panel.innerHTML = `
    <p class="cosmetic-file-note">${part.hasModel ? 'Ehhez a részhez van feltöltött modell.' : 'Ehhez a részhez MÉG NINCS modell &ndash; tölts fel egyet.'}</p>
    <div class="cosmetic-editor-controls">
      <button type="button" class="btn-outline" id="mobPartBbmodelBtn">${part.hasModel ? '.bbmodel cseréje' : '.bbmodel feltöltése'}</button>
      ${mobParts.length > 1 ? '<button type="button" class="btn-outline" id="mobPartDeleteBtn">Rész törlése</button>' : ''}
    </div>`;
  $('#mobPartBbmodelBtn')?.addEventListener('click', () => $('#mobPartBbmodelInput')?.click());
  $('#mobPartDeleteBtn')?.addEventListener('click', () => deleteMobPart(mobTarget));
}

function setMobTarget(index, skipRead) {
  if (!skipRead) readMobTargetFromInputs();
  mobTarget = index;
  const label = index < 0 ? 'teljes mob' : (index + 1) + '. rész';
  $('#mobTargetLabel').textContent = label;
  $('#mobAnimTargetLabel').textContent = label;
  const itemRow = $('#mobItemSpaceRow');
  if (itemRow) itemRow.style.display = index < 0 ? '' : 'none';
  writeMobTargetToInputs();
  renderMobPartsBar();
  renderMobAnimEditor();
  queueMobPreview();
}

function writeMobTargetToInputs() {
  const rec = mobCurrentRecord();
  if (!rec) return;
  $('#mobOffsetXInput').value = rec.offsetX;
  $('#mobOffsetYInput').value = rec.offsetY;
  $('#mobOffsetZInput').value = rec.offsetZ;
  $('#mobRotXInput').value = rec.rotationX;
  $('#mobRotYInput').value = rec.rotationY;
  $('#mobRotZInput').value = rec.rotationZ;
  $('#mobScaleInput').value = rec.scale;
  $('#mobItemSpaceCheckbox').checked = mobAssembly.itemModelSpace !== false;
}

function readMobTargetFromInputs() {
  const rec = mobCurrentRecord();
  if (!rec) return;
  const num = (sel, def) => {
    const v = Number($(sel)?.value);
    return Number.isFinite(v) ? v : def;
  };
  rec.offsetX = num('#mobOffsetXInput', 0);
  rec.offsetY = num('#mobOffsetYInput', 0);
  rec.offsetZ = num('#mobOffsetZInput', 0);
  rec.rotationX = num('#mobRotXInput', 0);
  rec.rotationY = num('#mobRotYInput', 0);
  rec.rotationZ = num('#mobRotZInput', 0);
  rec.scale = num('#mobScaleInput', 1);
  if (mobTarget >= 0) rec.dirty = true;
  mobAssembly.itemModelSpace = !!$('#mobItemSpaceCheckbox')?.checked;
}

function writeMobDisplayFields() {
  $('#mobHideVanillaCheckbox').checked = mobAssembly.hideVanilla !== false;
  $('#mobEnabledCheckbox').checked = mobAssembly.enabled !== false;
  $('#mobNameOffsetInput').value = mobAssembly.nameOffset || 0;
  $('#mobHitboxModeSelect').value = mobAssembly.hitboxMode || 'auto';
  $('#mobHitboxWidthInput').value = mobAssembly.hitboxWidth ?? '';
  $('#mobHitboxHeightInput').value = mobAssembly.hitboxHeight ?? '';
  updateMobHitboxUi();
}

function mobRotatePoint(p, deg) {
  const rx = deg[0] * Math.PI / 180, ry = deg[1] * Math.PI / 180, rz = deg[2] * Math.PI / 180;
  let x = p[0], y = p[1], z = p[2];
  let y1 = y * Math.cos(rx) - z * Math.sin(rx);
  let z1 = y * Math.sin(rx) + z * Math.cos(rx);
  y = y1; z = z1;
  let x1 = x * Math.cos(ry) + z * Math.sin(ry);
  z1 = -x * Math.sin(ry) + z * Math.cos(ry);
  x = x1; z = z1;
  x1 = x * Math.cos(rz) - y * Math.sin(rz);
  y1 = x * Math.sin(rz) + y * Math.cos(rz);
  return [x1, y1, z];
}

function mobElementRotations(el) {
  if (Array.isArray(el.rotations) && el.rotations.length) {
    return el.rotations.filter((r) => r && Array.isArray(r.angles) && Array.isArray(r.origin));
  }
  if (el.rotation && Number.isFinite(el.rotation.angle) && Array.isArray(el.rotation.origin)) {
    const a = el.rotation.angle;
    return [{
      angles: el.rotation.axis === 'x' ? [a, 0, 0] : el.rotation.axis === 'y' ? [0, a, 0] : [0, 0, a],
      origin: el.rotation.origin
    }];
  }
  return [];
}

function mobPartPoints(part) {
  const out = [];
  if (!Array.isArray(part.elements)) return out;
  for (const el of part.elements) {
    if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
    const corners = [];
    for (const x of [el.from[0], el.to[0]]) {
      for (const y of [el.from[1], el.to[1]]) {
        for (const z of [el.from[2], el.to[2]]) corners.push([x, y, z]);
      }
    }
    const chain = mobElementRotations(el);
    if (chain.length) {
      for (const c of corners) {
        let p = c;
        for (const r of chain) {
          const o = r.origin;
          const v = mobRotatePoint([p[0] - o[0], p[1] - o[1], p[2] - o[2]], r.angles);
          p = [v[0] + o[0], v[1] + o[1], v[2] + o[2]];
        }
        out.push(p);
      }
    } else {
      for (const c of corners) out.push(c);
    }
  }
  return out;
}

function computeMobBounds() {
  const perPart = [];
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const add = (b, p) => {
    for (let i = 0; i < 3; i++) {
      if (p[i] < b.min[i]) b.min[i] = p[i];
      if (p[i] > b.max[i]) b.max[i] = p[i];
    }
  };
  const whole = { min, max };

  for (const part of mobParts) {
    const pts = mobPartPoints(part);
    if (!pts.length) continue;
    const pb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const p of pts) add(pb, p);
    const pc = [(pb.min[0] + pb.max[0]) / 2, (pb.min[1] + pb.max[1]) / 2, (pb.min[2] + pb.max[2]) / 2];
    const deg = [part.rotationX, part.rotationY, part.rotationZ];
    const moved = [];
    for (const p of pts) {
      const rel = [(p[0] - pc[0]) * part.scale, (p[1] - pc[1]) * part.scale, (p[2] - pc[2]) * part.scale];
      const r = mobRotatePoint(rel, deg);
      moved.push([r[0] + pc[0] + part.offsetX, r[1] + pc[1] + part.offsetY, r[2] + pc[2] + part.offsetZ]);
    }
    perPart.push(moved);
    for (const p of moved) add(whole, p);
  }
  if (!perPart.length || !Number.isFinite(whole.min[0])) return null;

  const wc = [(whole.min[0] + whole.max[0]) / 2, (whole.min[1] + whole.max[1]) / 2, (whole.min[2] + whole.max[2]) / 2];
  const deg = [mobAssembly.rotationX, mobAssembly.rotationY, mobAssembly.rotationZ];
  const fin = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const pts of perPart) {
    for (const p of pts) {
      const rel = [(p[0] - wc[0]) * mobAssembly.scale, (p[1] - wc[1]) * mobAssembly.scale, (p[2] - wc[2]) * mobAssembly.scale];
      const r = mobRotatePoint(rel, deg);
      add(fin, [r[0] + wc[0] + mobAssembly.offsetX, r[1] + wc[1] + mobAssembly.offsetY, r[2] + wc[2] + mobAssembly.offsetZ]);
    }
  }
  return fin;
}

function currentMobHitbox() {
  const mode = mobAssembly ? mobAssembly.hitboxMode : 'auto';
  if (mode === 'vanilla') return null;
  if (mode === 'manual') {
    const w = Number(mobAssembly.hitboxWidth);
    const h = Number(mobAssembly.hitboxHeight);
    return (w > 0 && h > 0) ? { width: w, height: h } : null;
  }
  const b = computeMobBounds();
  if (!b) return null;
  const width = Math.round(Math.max(b.max[0] - b.min[0], b.max[2] - b.min[2]) / 16 * 100) / 100;
  const height = Math.round((b.max[1] - b.min[1]) / 16 * 100) / 100;
  return (width > 0 && height > 0) ? { width, height } : null;
}

function updateMobHitboxUi() {
  const mode = $('#mobHitboxModeSelect')?.value || 'auto';
  const manual = $('#mobHitboxManualFields');
  if (manual) manual.style.display = mode === 'manual' ? '' : 'none';
  const info = $('#mobHitboxInfo');
  if (!info) return;
  if (mode === 'vanilla') {
    info.textContent = 'A mob a vanilla entitás méretét tartja meg.';
    return;
  }
  const hb = currentMobHitbox();
  if (!hb) {
    info.textContent = mode === 'manual'
      ? 'Add meg a szélességet és a magasságot.'
      : 'Modell nélkül nincs mit kiszámolni - a hitbox vanilla méretű marad.';
    return;
  }
  const mob = mobsAdminItems.find((m) => m.id === mobEditingId);
  const vh = mob && mob.vanillaHitbox ? mob.vanillaHitbox : null;
  const ratio = vh && vh.height > 0 ? (hb.height / vh.height) : null;
  info.innerHTML = `Eredmény: <strong>${hb.width} &times; ${hb.height} blokk</strong>`
    + (ratio ? ` &ndash; a vanilla ${vh.width} &times; ${vh.height} méret <strong>${Math.round(ratio * 100)}%</strong>-a.` : '')
    + (ratio && (ratio < 0.0625 || ratio > 16) ? ' <span style="color:var(--danger)">A szorzó a megengedett tartományon kívül esik, a szerver levágja.</span>' : '');
}

function mobCurrentAnim() {
  const rec = mobCurrentRecord();
  return rec ? rec.anim : null;
}

function ensureMobAnim() {
  const rec = mobCurrentRecord();
  if (!rec) return null;
  if (!rec.anim) rec.anim = { tracks: [], pivot: null };
  if (!Array.isArray(rec.anim.tracks)) rec.anim.tracks = [];
  if (mobTarget >= 0) rec.dirty = true;
  return rec.anim;
}

function mobRigLooksStale(rig) {
  if (!rig || !Array.isArray(rig.bones) || rig.bones.length < 2) return false;
  if (!Array.isArray(rig.animations) || !rig.animations.length) return false;
  return rig.bones.every((b) => {
    const p = Array.isArray(b.pivot) ? b.pivot : [0, 0, 0];
    return !p[0] && !p[1] && !p[2];
  });
}

function renderMobRigAnimations() {
  const wrap = $('#mobRigAnimList');
  if (!wrap) return;
  const mob = mobsAdminItems.find((m) => m.id === mobEditingId);
  const anims = mob && Array.isArray(mob.animations) ? mob.animations : [];

  if (!mob || !mob.hasRig) {
    wrap.innerHTML = '<p class="cosmetic-file-note">Ehhez a mobhoz még nincs csontvázas modell. '
      + 'Tölts fel egy <strong>.bbmodel</strong> fájlt a &bdquo;Modell&rdquo; fülön &ndash; '
      + 'az abban lévő animációk automatikusan idekerülnek.</p>';
    return;
  }
  if (!anims.length) {
    wrap.innerHTML = '<p class="cosmetic-file-note">A feltöltött modellnek van csontváza, de '
      + '<strong>nincs benne animáció</strong>. A Blockbench &bdquo;Animate&rdquo; fülén készíts '
      + 'egyet, mentsd újra a .bbmodel fájlt, és töltsd fel ismét.</p>';
    return;
  }

  const STATE_HINTS = [
    { label: 'nyugalom', words: ['idle', 'stand', 'nyugalom'] },
    { label: 'járás', words: ['walk', 'move', 'jaras'] },
    { label: 'futás', words: ['run', 'sprint', 'charge', 'futas'] },
    { label: 'támadás', words: ['attack', 'swing', 'slam', 'strike', 'hit', 'tamadas'] },
    { label: 'halál', words: ['death', 'die', 'halal'] }
  ];
  const used = new Set();
  const roleOf = (name) => {
    const lower = String(name).toLowerCase();
    for (const s of STATE_HINTS) {
      if (used.has(s.label)) continue;
      if (s.words.some((w) => lower.includes(w))) { used.add(s.label); return s.label; }
    }
    return null;
  };

  const stale = mobRigLooksStale(mobRigData)
    ? '<p class="redeem-result error mob-rig-stale">A modell csontjainak <strong>nincs '
      + 'forgáspontjuk</strong> &ndash; ez a régi, hibás feldolgozás nyoma, és emiatt az '
      + 'animációk nem a csuklóknál forognak. <strong>Töltsd fel újra ugyanazt a .bbmodel '
      + 'fájlt</strong>, és rendbe jön.</p>'
    : '';

  wrap.innerHTML = stale + '<ul class="mob-rig-anim-list">'
    + anims.map((name, i) => {
      const role = roleOf(name);
      const playing = mobRigPlaying === i;
      return '<li class="' + (playing ? 'is-playing' : '') + '">'
        + '<button type="button" class="mob-rig-anim-play" data-mob-anim-play="' + i + '" '
        + 'title="' + (playing ? 'Vissza a szerkesztői nézethez' : 'Lejátszás az előnézetben') + '">'
        + (playing ? '&#9632;' : '&#9654;') + '</button>'
        + '<code>' + escapeHtml(name) + '</code>'
        + (role ? '<span class="mob-rig-anim-role">' + role + ' &ndash; magától indul</span>' : '')
        + '<button type="button" class="mob-rig-anim-del" data-mob-anim-del="' + i + '" '
        + 'title="Az animáció törlése a modellből">&times;</button>'
        + '</li>';
    }).join('')
    + '</ul>'
    + (mobRigPlaying >= 0
      ? '<p class="cosmetic-file-note mob-rig-anim-hint">Az előnézet a <strong>mentett</strong> '
        + 'modellt játssza le &ndash; pontosan azt a mozgást, amit a játékban látsz. '
        + 'A leállításhoz nyomd meg újra a gombot.</p>'
      : '')
    + '<p class="cosmetic-file-note">Kiváltás a pluginból: <code>'
    + escapeHtml('animation name=' + anims[0] + ' duration=40')
    + '</code> &ndash; vagy próbaként ingame: <code>'
    + escapeHtml('/solarmob anim play ' + (mob.slug || '<id>') + ' ' + anims[0])
    + '</code></p>';
}

function toggleMobAnimation(index) {
  if (!mobPreviewStop || !mobPreviewStop.playAnimation) return;
  if (mobRigPlaying === index) {
    mobRigPlaying = -1;
    mobPreviewStop.stopAnimation();
  } else if (mobPreviewStop.playAnimation(index)) {
    mobRigPlaying = index;
  } else {
    showToast('Ehhez a mobhoz nincs lejátszható csontváz - tölts fel .bbmodel fájlt.', true);
    return;
  }
  renderMobRigAnimations();
}

async function deleteMobAnimation(index) {
  const mob = mobsAdminItems.find((m) => m.id === mobEditingId);
  if (!mob || !Array.isArray(mob.animations) || !mob.animations[index]) return;
  const name = mob.animations[index];
  if (!confirm('Biztosan törlöd ezt az animációt a modellből?\n\n  ' + name
    + '\n\nA geometria és a többi animáció megmarad. Ha később mégis kell, '
    + 'töltsd fel újra a .bbmodel fájlt.')) return;

  try {
    const res = await fetch(BACKEND_URL + '/api/admin/mobs/' + mobEditingId + '/animations/' + index, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült törölni az animációt.', true); return; }

    if (mobRigPlaying >= 0) {
      mobRigPlaying = -1;
      if (mobPreviewStop && mobPreviewStop.stopAnimation) mobPreviewStop.stopAnimation();
    }

    const idx = mobsAdminItems.findIndex((m) => m.id === data.mob.id);
    if (idx >= 0) mobsAdminItems[idx] = data.mob;
    mobAssetBust++;
    mobRigData = await fetchMobRig(mobEditingId);
    if (mobPreviewStop && mobPreviewStop.update) mobPreviewStop.update({ rig: mobRigData });
    renderMobRigAnimations();
    showToast('Törölve: ' + data.removed);
  } catch {
    showToast('Hálózati hiba az animáció törlésekor.', true);
  }
}

function renderMobAnimEditor() {
  const presetsWrap = $('#mobAnimPresets');
  const tracksWrap = $('#mobAnimTracks');
  if (!presetsWrap || !tracksWrap) return;

  renderMobRigAnimations();

  presetsWrap.innerHTML = MOB_ANIM_PRESETS
    .map((preset, i) => `<button type="button" class="cosmetic-anim-preset" data-mob-anim-preset="${i}" title="${escapeHtml(preset.hint || '')}">${escapeHtml(preset.label)}</button>`)
    .join('');

  const anim = mobCurrentAnim();
  const tracks = anim && Array.isArray(anim.tracks) ? anim.tracks : [];
  if (!tracks.length) {
    tracksWrap.innerHTML = '<p class="cosmetic-file-note">Ehhez még nincs mozgás beállítva. Válassz egy kész mozgást fent, vagy vegyél fel egyet kézzel.</p>';
  } else {
    tracksWrap.innerHTML = tracks.map((t, i) => {
      const isScale = t.type === 'scale';
      const step = isScale ? '0.02' : (t.type === 'translate' ? '0.2' : '1');
      return `
      <div class="cosmetic-anim-track" data-mob-anim-index="${i}">
        <div class="cosmetic-anim-row">
          ${animField('Mit', animSelect('type', ANIM_TYPE_LABELS, t.type))}
          ${animField('Tengely', `<select data-anim-field="axis"${isScale ? ' disabled' : ''}>${['x', 'y', 'z'].map((v) => `<option value="${v}"${t.axis === v ? ' selected' : ''}>${v.toUpperCase()}</option>`).join('')}</select>`)}
          ${animField('Kitérés', `<input type="number" data-anim-field="amp" step="${step}" value="${Number(t.amp) || 0}" />`)}
          ${animField('Sebesség', `<input type="number" data-anim-field="speed" step="0.05" min="0" max="8" value="${Number(t.speed) || 0}" />`, 'Teljes ciklus másodpercenként.')}
          ${animField('Fázis°', `<input type="number" data-anim-field="phase" step="15" min="-360" max="360" value="${Number(t.phase) || 0}" />`)}
          ${animField('Jelleg', animSelect('wave', ANIM_WAVE_LABELS, t.wave))}
          <button type="button" class="cosmetic-anim-remove" data-mob-anim-remove="${i}" title="Sáv törlése">&times;</button>
        </div>
        ${isScale ? '' : `
        <div class="cosmetic-anim-row cosmetic-anim-wave-row">
          <span class="cosmetic-anim-rowlabel">Hullám</span>
          ${animField('Hajlás', `<input type="range" data-anim-field="falloff" min="0" max="1" step="0.05" value="${Number(t.falloff) || 0}" /><output>${(Number(t.falloff) || 0).toFixed(2)}</output>`, '0 = merev test. 1 = a forgáspontnál nem mozdul, a hegyénél teljes a kitérés.')}
          ${animField('Késés°', `<input type="number" data-anim-field="spread" step="10" min="-720" max="720" value="${Number(t.spread) || 0}" />`, 'Ettől fut végig a mozgás a részen.')}
          ${animField('Mentén', animSelect('along', ANIM_ALONG_LABELS, t.along || 'auto'))}
        </div>`}
      </div>`;
    }).join('');
  }

  const pivot = anim && Array.isArray(anim.pivot) ? anim.pivot : null;
  $('#mobAnimPivotXInput').value = pivot ? pivot[0] : '';
  $('#mobAnimPivotYInput').value = pivot ? pivot[1] : '';
  $('#mobAnimPivotZInput').value = pivot ? pivot[2] : '';
}

function readMobAnimPivot() {
  const xs = $('#mobAnimPivotXInput').value.trim();
  const ys = $('#mobAnimPivotYInput').value.trim();
  const zs = $('#mobAnimPivotZInput').value.trim();
  if (!xs || !ys || !zs) return null;
  const v = [Number(xs), Number(ys), Number(zs)];
  return v.every(Number.isFinite) ? v : null;
}

function renderMobAuraSelect() {
  const sel = $('#mobAuraTypeSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">Nincs aura</option>'
    + mobAuraTypes.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.label || a.id)}</option>`).join('');
}

function writeMobAuraToInputs() {
  const aura = mobAssembly ? mobAssembly.aura : null;
  const sel = $('#mobAuraTypeSelect');
  if (sel) sel.value = aura && aura.type ? aura.type : '';
  $('#mobAuraRateInput').value = aura && Number.isFinite(aura.rate) ? aura.rate : '';
  $('#mobAuraSizeInput').value = aura && Number.isFinite(aura.size) ? aura.size : '';
  $('#mobAuraLifeInput').value = aura && Number.isFinite(aura.life) ? aura.life : '';
  $('#mobAuraSpeedInput').value = aura && Number.isFinite(aura.speed) ? aura.speed : '';
  if (aura && typeof aura.colorA === 'string') $('#mobAuraColorAInput').value = aura.colorA;
  if (aura && typeof aura.colorB === 'string') $('#mobAuraColorBInput').value = aura.colorB;
  $('#mobAuraOffsetXInput').value = aura && Number.isFinite(aura.offsetX) ? aura.offsetX : '';
  $('#mobAuraOffsetYInput').value = aura && Number.isFinite(aura.offsetY) ? aura.offsetY : '';
  $('#mobAuraOffsetZInput').value = aura && Number.isFinite(aura.offsetZ) ? aura.offsetZ : '';
  $('#mobAuraExtentInput').value = aura && Number.isFinite(aura.extent) ? aura.extent : '';
  const fields = $('#mobAuraFields');
  if (fields) fields.classList.toggle('hidden', !(aura && aura.type));
}

function readMobAura() {
  const type = $('#mobAuraTypeSelect')?.value || '';
  if (!type) return null;
  const out = { type };
  const num = (sel, key) => {
    const raw = $(sel)?.value.trim();
    if (raw === '' || raw === undefined) return;
    const v = Number(raw);
    if (Number.isFinite(v)) out[key] = v;
  };
  num('#mobAuraRateInput', 'rate');
  num('#mobAuraSizeInput', 'size');
  num('#mobAuraLifeInput', 'life');
  num('#mobAuraSpeedInput', 'speed');
  num('#mobAuraOffsetXInput', 'offsetX');
  num('#mobAuraOffsetYInput', 'offsetY');
  num('#mobAuraOffsetZInput', 'offsetZ');
  num('#mobAuraExtentInput', 'extent');
  const ca = $('#mobAuraColorAInput')?.value;
  const cb = $('#mobAuraColorBInput')?.value;
  if (ca) out.colorA = ca;
  if (cb) out.colorB = cb;
  return out;
}

function buildMobEditorModel() {
  readMobTargetFromInputs();
  const parts = mobParts
    .filter((p) => Array.isArray(p.elements) && p.elements.length)
    .map((p) => ({
      texture_size: p.textureSize || [64, 64],
      elements: p.elements,
      transform: {
        offset: [p.offsetX, p.offsetY, p.offsetZ],
        rotation: [p.rotationX, p.rotationY, p.rotationZ],
        scale: p.scale
      },
      anim: p.anim
    }));
  if (!parts.length) return null;
  return {
    assembly: {
      offset: [mobAssembly.offsetX, mobAssembly.offsetY, mobAssembly.offsetZ],
      rotation: [mobAssembly.rotationX, mobAssembly.rotationY, mobAssembly.rotationZ],
      scale: mobAssembly.scale,
      itemModelSpace: mobAssembly.itemModelSpace !== false,
      anim: mobAssembly.anim,
      aura: readMobAura()
    },
    parts
  };
}

function restartMobPreview() {
  const canvas = $('#mobEditorPreview');
  if (!canvas) return;
  if (mobPreviewStop) { mobPreviewStop(); mobPreviewStop = null; }
  const model = mobTextureImg ? buildMobEditorModel() : null;
  const empty = $('#mobEditorEmpty');
  if (!model || !mobTextureImg) {
    canvas.style.display = 'none';
    if (empty) empty.style.display = '';
    return;
  }
  canvas.style.display = '';
  if (empty) empty.style.display = 'none';
  mobPreviewStop = SkinPreview.startMob(canvas, {
    model, img: mobTextureImg, hitbox: currentMobHitbox(), rig: mobRigData
  });
  if (mobRigPlaying >= 0) mobPreviewStop.playAnimation(mobRigPlaying);
}

function queueMobPreview() {
  if (mobPreviewQueued) { mobPreviewDirty = true; return; }
  mobPreviewQueued = true;
  requestAnimationFrame(() => {
    mobPreviewQueued = false;
    readMobTargetFromInputs();
    updateMobHitboxUi();
    const model = mobTextureImg ? buildMobEditorModel() : null;
    if (mobPreviewStop && mobPreviewStop.update && model) {
      mobPreviewStop.update({ model, img: mobTextureImg, hitbox: currentMobHitbox() });
    } else {
      restartMobPreview();
    }
    if (mobPreviewDirty) { mobPreviewDirty = false; queueMobPreview(); }
  });
}

function mobAnimField(anim) {
  if (!anim || !Array.isArray(anim.tracks) || (!anim.tracks.length && !anim.pivot)) return '';
  return JSON.stringify({ tracks: anim.tracks, pivot: anim.pivot || null });
}

async function saveMob() {
  if (!mobEditingId || !mobAssembly) return;
  readMobTargetFromInputs();
  if (mobTarget < 0) {
    const pivot = readMobAnimPivot();
    if (mobAssembly.anim) mobAssembly.anim.pivot = pivot;
  } else if (mobParts[mobTarget] && mobParts[mobTarget].anim) {
    mobParts[mobTarget].anim.pivot = readMobAnimPivot();
  }

  mobAssembly.hideVanilla = !!$('#mobHideVanillaCheckbox')?.checked;
  mobAssembly.enabled = !!$('#mobEnabledCheckbox')?.checked;
  mobAssembly.nameOffset = Number($('#mobNameOffsetInput')?.value) || 0;
  mobAssembly.hitboxMode = $('#mobHitboxModeSelect')?.value || 'auto';
  mobAssembly.hitboxWidth = $('#mobHitboxWidthInput')?.value;
  mobAssembly.hitboxHeight = $('#mobHitboxHeightInput')?.value;
  mobAssembly.aura = readMobAura();

  const result = $('#mobFormResult');
  const btn = $('#mobSaveBtn');
  if (btn) btn.disabled = true;
  if (result) { result.className = 'redeem-result'; result.textContent = 'Mentés...'; }

  try {
    const fd = new FormData();
    fd.append('enabled', mobAssembly.enabled ? 'true' : 'false');
    fd.append('offsetX', mobAssembly.offsetX);
    fd.append('offsetY', mobAssembly.offsetY);
    fd.append('offsetZ', mobAssembly.offsetZ);
    fd.append('scale', mobAssembly.scale);
    fd.append('rotationX', mobAssembly.rotationX);
    fd.append('rotationY', mobAssembly.rotationY);
    fd.append('rotationZ', mobAssembly.rotationZ);
    fd.append('itemModelSpace', mobAssembly.itemModelSpace ? 'true' : 'false');
    fd.append('hideVanilla', mobAssembly.hideVanilla ? 'true' : 'false');
    fd.append('hitboxMode', mobAssembly.hitboxMode);
    if (mobAssembly.hitboxMode === 'manual') {
      fd.append('hitboxWidth', mobAssembly.hitboxWidth);
      fd.append('hitboxHeight', mobAssembly.hitboxHeight);
    }
    fd.append('nameOffset', mobAssembly.nameOffset);
    fd.append('anim', mobAnimField(mobAssembly.anim));
    fd.append('aura', mobAssembly.aura ? JSON.stringify(mobAssembly.aura) : '');
    if (mobTextureFile) fd.append('texture', mobTextureFile);

    const res = await fetch(BACKEND_URL + '/api/admin/mobs/' + mobEditingId, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + session.token },
      body: fd
    });
    const data = await res.json();
    if (!data.ok) {
      if (result) { result.className = 'redeem-result error'; result.textContent = data.message || 'Nem sikerült menteni.'; }
      return;
    }

    for (const part of mobParts) {
      if (!part.id) continue;
      const pf = new FormData();
      pf.append('name', part.name || '');
      pf.append('offsetX', part.offsetX);
      pf.append('offsetY', part.offsetY);
      pf.append('offsetZ', part.offsetZ);
      pf.append('rotationX', part.rotationX);
      pf.append('rotationY', part.rotationY);
      pf.append('rotationZ', part.rotationZ);
      pf.append('scale', part.scale);
      pf.append('anim', mobAnimField(part.anim));
      const pres = await fetch(`${BACKEND_URL}/api/admin/mobs/${mobEditingId}/parts/${part.id}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + session.token },
        body: pf
      });
      const pdata = await pres.json();
      if (!pdata.ok) {
        if (result) { result.className = 'redeem-result error'; result.textContent = pdata.message || 'A rész mentése nem sikerült.'; }
        return;
      }
      part.dirty = false;
    }

    mobAssetBust++;
    mobThumbCache.delete(mobEditingId);
    mobModelCache.delete(mobEditingId);
    mobTextureFile = null;

    if (result) { result.className = 'redeem-result success'; result.textContent = 'Mentve.'; }
    showToast('A mob megjelenése mentve.');
    await loadMobsAdmin();
    const fresh = mobsAdminItems.find((m) => m.id === mobEditingId);
    if (fresh) {
      mobAssembly.hitboxWidth = fresh.hitboxWidth;
      mobAssembly.hitboxHeight = fresh.hitboxHeight;
      renderMobStats(fresh);
      updateMobHitboxUi();
    }
  } catch {
    if (result) { result.className = 'redeem-result error'; result.textContent = 'Hálózati hiba mentés közben.'; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function parseMobModelFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !Array.isArray(parsed.elements) || !parsed.elements.length) {
          resolve({ error: 'A fájlban nincs "elements" tömb - Blockbench JSON exportot várunk.' });
          return;
        }
        resolve({ model: parsed });
      } catch (e) {
        resolve({ error: 'A fájl nem érvényes JSON: ' + e.message });
      }
    };
    reader.onerror = () => resolve({ error: 'A fájlt nem sikerült beolvasni.' });
    reader.readAsText(file);
  });
}

async function uploadMobBbmodel(file, target) {
  if (!mobEditingId) return;
  const note = $('#mobBbmodelNote');
  const warnBox = $('#mobBbmodelWarnings');
  if (note) note.textContent = `Feldolgozás: ${file.name} ...`;
  if (warnBox) warnBox.innerHTML = '';

  const fd = new FormData();
  fd.append('bbmodel', file);
  if (target) fd.append('partId', String(target));

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/mobs/${mobEditingId}/bbmodel`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: fd
    });
    const data = await res.json();
    if (!data.ok) {
      if (note) note.textContent = '';
      if (warnBox) warnBox.innerHTML = `<p class="redeem-result error">${escapeHtml(data.message || 'Nem sikerült feldolgozni a .bbmodel fájlt.')}</p>`;
      showToast(data.message || 'Nem sikerült feldolgozni a .bbmodel fájlt.', true);
      return;
    }

    mobAssetBust++;
    mobThumbCache.delete(mobEditingId);
    mobModelCache.delete(mobEditingId);

    const info = data.info || {};
    if (note) {
      note.textContent = `${file.name} - ${info.elementCount} kocka`
        + (info.format ? `, ${info.format} formátum` : '')
        + (info.groupRotations ? `, ${info.groupRotations} forgatott csont beleégetve` : '')
        + (Array.isArray(info.resolution) ? `, textúra-tér ${info.resolution[0]}x${info.resolution[1]}` : '');
    }
    if (warnBox) {
      warnBox.innerHTML = (data.warnings || [])
        .map((w) => `<p class="cosmetic-file-note mob-bbmodel-warning">${escapeHtml(w)}</p>`).join('');
    }

    await reloadMobEditorAssets(data.mob);
    showToast('A Blockbench modell betöltve.');
  } catch {
    if (note) note.textContent = '';
    showToast('Hálózati hiba a .bbmodel feltöltésekor.', true);
  }
}

async function reloadMobEditorAssets(freshMob) {
  const mob = freshMob || mobsAdminItems.find((m) => m.id === mobEditingId);
  if (!mob) return;

  const idx = mobsAdminItems.findIndex((m) => m.id === mob.id);
  if (idx >= 0) mobsAdminItems[idx] = mob;

  const known = new Map(mobParts.filter((pp) => pp.id).map((pp) => [pp.id, pp]));
  mobParts = (mob.parts || []).map((pp) => {
    const existing = known.get(pp.id);
    if (existing) { existing.hasModel = pp.hasModel; existing.idx = pp.idx; return existing; }
    return {
      id: pp.id, idx: pp.idx, name: pp.name,
      offsetX: pp.offsetX, offsetY: pp.offsetY, offsetZ: pp.offsetZ,
      rotationX: pp.rotationX, rotationY: pp.rotationY, rotationZ: pp.rotationZ,
      scale: pp.scale, anim: pp.anim ? JSON.parse(JSON.stringify(pp.anim)) : null,
      hasModel: pp.hasModel, elements: null, textureSize: null, dirty: false
    };
  });
  if (!mobParts.length) mobParts = [emptyMobPart(0)];

  const model = await fetchMobModel(mob.id, { fresh: true });
  if (model && Array.isArray(model.parts)) {
    const withModel = mobParts.filter((pp) => pp.hasModel);
    model.parts.forEach((raw, i) => {
      const slot = withModel[i];
      if (!slot) return;
      slot.elements = raw.elements;
      slot.textureSize = Array.isArray(raw.texture_size) ? raw.texture_size : null;
    });
  }

  if (mob.hasTexture) {
    mobTextureFile = null;
    mobTextureImg = await loadImage(mobTextureUrl(mob.id));
    const wrapEl = $('#mobTexturePreviewWrap');
    if (mobTextureImg && wrapEl) {
      $('#mobTexturePreview').src = mobTextureImg.src;
      wrapEl.hidden = false;
      $('#mobTextureNote').textContent = `A modellből kicsomagolt textúra (${mobTextureImg.naturalWidth}x${mobTextureImg.naturalHeight}).`;
    }
  }

  if (mobTarget >= mobParts.length) mobTarget = -1;
  renderMobPartsBar();
  mobRigPlaying = -1;
  mobRigData = mob.hasRig ? await fetchMobRig(mob.id) : null;
  renderMobRigAnimations();
  restartMobPreview();
  updateMobHitboxUi();
}

async function uploadMobPartModel(file) {
  if (mobTarget < 0 || !mobParts[mobTarget]) {
    showToast('Előbb válaszd ki, melyik részhez tartozik a modell.', true);
    return;
  }
  const parsed = await parseMobModelFile(file);
  if (parsed.error) { showToast(parsed.error, true); return; }

  const part = mobParts[mobTarget];
  const fd = new FormData();
  fd.append('name', part.name || '');
  fd.append('offsetX', part.offsetX);
  fd.append('offsetY', part.offsetY);
  fd.append('offsetZ', part.offsetZ);
  fd.append('rotationX', part.rotationX);
  fd.append('rotationY', part.rotationY);
  fd.append('rotationZ', part.rotationZ);
  fd.append('scale', part.scale);
  fd.append('anim', mobAnimField(part.anim));
  fd.append('model', file);

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/mobs/${mobEditingId}/parts/${part.id}`, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + session.token },
      body: fd
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült feltölteni a modellt.', true); return; }
    part.hasModel = true;
    part.elements = parsed.model.elements;
    part.textureSize = Array.isArray(parsed.model.texture_size) ? parsed.model.texture_size : null;
    mobAssetBust++;
    mobThumbCache.delete(mobEditingId);
    mobModelCache.delete(mobEditingId);
    renderMobPartsBar();
    queueMobPreview();
    showToast('Modell feltöltve.');
  } catch {
    showToast('Hálózati hiba a modell feltöltésekor.', true);
  }
}

async function addMobPart(file) {
  const parsed = await parseMobModelFile(file);
  if (parsed.error) { showToast(parsed.error, true); return; }
  const fd = new FormData();
  fd.append('name', '');
  fd.append('scale', '1');
  fd.append('model', file);
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/mobs/${mobEditingId}/parts`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: fd
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült hozzáadni a részt.', true); return; }
    const part = emptyMobPart(data.part.idx);
    part.id = data.part.id;
    part.hasModel = true;
    part.elements = parsed.model.elements;
    part.textureSize = Array.isArray(parsed.model.texture_size) ? parsed.model.texture_size : null;
    mobParts.push(part);
    mobAssetBust++;
    mobThumbCache.delete(mobEditingId);
    mobModelCache.delete(mobEditingId);
    setMobTarget(mobParts.length - 1);
    showToast('Rész hozzáadva.');
  } catch {
    showToast('Hálózati hiba a rész hozzáadásakor.', true);
  }
}

async function deleteMobPart(index) {
  const part = mobParts[index];
  if (!part || !part.id) return;
  if (!confirm('Biztosan törlöd ezt a részt? A geometriája elvész.')) return;
  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/mobs/${mobEditingId}/parts/${part.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült törölni a részt.', true); return; }
    mobParts.splice(index, 1);
    mobParts.forEach((p, i) => { p.idx = i; });
    mobAssetBust++;
    mobThumbCache.delete(mobEditingId);
    mobModelCache.delete(mobEditingId);
    setMobTarget(-1);
    showToast('Rész törölve.');
  } catch {
    showToast('Hálózati hiba a rész törlésekor.', true);
  }
}

async function deleteMobAppearance() {
  if (!mobEditingId) return;
  const mob = mobsAdminItems.find((m) => m.id === mobEditingId);
  if (!confirm('Biztosan törlöd a MEGJELENÉST (modell, textúra, beállítások)?\n\n'
    + 'A mob a szerveren megmarad, és a következő szinkronnál újra megjelenik itt - üresen.')) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/mobs/' + mobEditingId, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
    mobThumbCache.delete(mobEditingId);
    mobModelCache.delete(mobEditingId);
    showToast('A megjelenés törölve' + (mob ? (': ' + mob.slug) : '') + '.');
    closeMobEditor();
    loadMobsAdmin();
  } catch {
    showToast('Hálózati hiba törlés közben.', true);
  }
}

function setMobTab(name) {
  $$('[data-mob-tab]').forEach((b) => b.classList.toggle('active', b.dataset.mobTab === name));
  $$('[data-mob-pane]').forEach((p) => p.classList.toggle('active', p.dataset.mobPane === name));
}

$$('[data-mob-tab]').forEach((btn) => {
  btn.addEventListener('click', () => setMobTab(btn.dataset.mobTab));
});

$('#mobAdminSearch')?.addEventListener('input', renderMobsAdmin);
$('#mobShowHiddenCheckbox')?.addEventListener('change', renderMobsAdmin);
$('#mobRefreshBtn')?.addEventListener('click', loadMobsAdmin);
$('#mobBackBtn')?.addEventListener('click', () => { closeMobEditor(); loadMobsAdmin(); });
$('#mobSaveBtn')?.addEventListener('click', saveMob);
$('#mobDeleteBtn')?.addEventListener('click', deleteMobAppearance);

$('#mobsAdminList')?.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-mob-edit]');
  if (edit) { openMobEditor(edit.dataset.mobEdit); return; }
  const remove = e.target.closest('[data-mob-remove]');
  if (remove) deleteMobById(Number(remove.dataset.mobRemove));
});

$('#mobPruneBtn')?.addEventListener('click', deleteMobOrphans);

$('#mobRigAnimList')?.addEventListener('click', (e) => {
  const play = e.target.closest('[data-mob-anim-play]');
  if (play) { toggleMobAnimation(Number(play.dataset.mobAnimPlay)); return; }
  const del = e.target.closest('[data-mob-anim-del]');
  if (del) deleteMobAnimation(Number(del.dataset.mobAnimDel));
});

async function deleteMobById(id) {
  const mob = mobsAdminItems.find((m) => m.id === id);
  if (!mob) return;
  const extra = mob.orphan
    ? 'Ezt a mobot egyetlen szerver sem jelenti már, tehát véglegesen eltűnik.'
    : 'A mob a SZERVEREN megmarad, és a következő szinkronnál újra megjelenik itt - üresen.';
  if (!confirm(`Törlöd a(z) "${mob.name}" (${mob.slug}) megjelenését?\n\n${extra}`)) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/mobs/' + id, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
    mobThumbCache.delete(id);
    mobModelCache.delete(id);
    showToast('Törölve: ' + mob.slug);
    loadMobsAdmin();
  } catch {
    showToast('Hálózati hiba törlés közben.', true);
  }
}

async function deleteMobOrphans() {
  const orphans = mobsAdminItems.filter((m) => m.orphan);
  if (!orphans.length) return;
  if (!confirm(`${orphans.length} olyan mob van, amit egyetlen szerver sem jelent már:\n\n`
    + orphans.map((m) => '  - ' + m.slug).join('\n')
    + '\n\nTörlöd mindet a modelljükkel együtt? Ez nem vonható vissza.')) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/mobs/orphans', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token }
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
    for (const m of orphans) { mobThumbCache.delete(m.id); mobModelCache.delete(m.id); }
    showToast((data.removed || []).length + ' mob törölve.');
    loadMobsAdmin();
  } catch {
    showToast('Hálózati hiba a takarítás közben.', true);
  }
}

$('#mobPartsBar')?.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-mob-target]');
  if (chip) { setMobTarget(Number(chip.dataset.mobTarget)); return; }
  if (e.target.closest('[data-mob-add-part]')) $('#mobNewPartBbmodelInput')?.click();
});

$('#mobBbmodelPickBtn')?.addEventListener('click', () => $('#mobBbmodelInput')?.click());
$('#mobBbmodelInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) uploadMobBbmodel(file, mobTarget >= 0 && mobParts[mobTarget] ? mobParts[mobTarget].id : null);
});

$('#mobPartBbmodelInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) uploadMobBbmodel(file, mobTarget >= 0 && mobParts[mobTarget] ? mobParts[mobTarget].id : null);
});

$('#mobNewPartBbmodelInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) uploadMobBbmodel(file, 'new');
});

$('#mobJsonPickBtn')?.addEventListener('click', () => $('#mobModelInput')?.click());

$('#mobModelInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) uploadMobPartModel(file);
});

$('#mobNewPartInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (file) addMobPart(file);
});

$('#mobTexturePickBtn')?.addEventListener('click', () => $('#mobTextureInput')?.click());
$('#mobTextureInput')?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { showToast('A textúra túl nagy (max 8 MB).', true); return; }
  mobTextureFile = file;
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  if (!img) { showToast('A képet nem sikerült beolvasni.', true); return; }
  mobTextureImg = img;
  $('#mobTexturePreview').src = url;
  $('#mobTexturePreviewWrap').hidden = false;
  $('#mobTextureNote').textContent = `Kiválasztva: ${file.name} (${img.naturalWidth}×${img.naturalHeight}) - mentésre vár.`;
  restartMobPreview();
});

['#mobOffsetXInput', '#mobOffsetYInput', '#mobOffsetZInput',
 '#mobRotXInput', '#mobRotYInput', '#mobRotZInput',
 '#mobScaleInput', '#mobItemSpaceCheckbox'].forEach((sel) => {
  $(sel)?.addEventListener('input', queueMobPreview);
  $(sel)?.addEventListener('change', queueMobPreview);
});

$('#mobHitboxModeSelect')?.addEventListener('change', () => {
  if (mobAssembly) mobAssembly.hitboxMode = $('#mobHitboxModeSelect').value;
  updateMobHitboxUi();
  queueMobPreview();
});
['#mobHitboxWidthInput', '#mobHitboxHeightInput'].forEach((sel) => {
  $(sel)?.addEventListener('input', () => {
    if (!mobAssembly) return;
    mobAssembly.hitboxWidth = $('#mobHitboxWidthInput').value;
    mobAssembly.hitboxHeight = $('#mobHitboxHeightInput').value;
    updateMobHitboxUi();
    queueMobPreview();
  });
});

$('#mobAuraTypeSelect')?.addEventListener('change', () => {
  if (mobAssembly) mobAssembly.aura = readMobAura();
  writeMobAuraToInputs();
  queueMobPreview();
});
['#mobAuraRateInput', '#mobAuraSizeInput', '#mobAuraLifeInput', '#mobAuraSpeedInput',
 '#mobAuraColorAInput', '#mobAuraColorBInput',
 '#mobAuraOffsetXInput', '#mobAuraOffsetYInput', '#mobAuraOffsetZInput',
 '#mobAuraExtentInput'].forEach((sel) => {
  $(sel)?.addEventListener('change', () => {
    if (mobAssembly) mobAssembly.aura = readMobAura();
    queueMobPreview();
  });
});
$('#mobAuraResetBtn')?.addEventListener('click', () => {
  if (!mobAssembly || !mobAssembly.aura) return;
  mobAssembly.aura = { type: mobAssembly.aura.type };
  writeMobAuraToInputs();
  queueMobPreview();
});

$('#mobAnimPresets')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mob-anim-preset]');
  if (!btn) return;
  const preset = MOB_ANIM_PRESETS[Number(btn.dataset.mobAnimPreset)];
  if (!preset) return;
  const rec = mobCurrentRecord();
  if (!rec) return;
  if (preset.clear) {
    rec.anim = null;
    if (mobTarget >= 0) rec.dirty = true;
    renderMobAnimEditor();
    queueMobPreview();
    return;
  }
  const anim = ensureMobAnim();
  if (!anim) return;
  anim.tracks = JSON.parse(JSON.stringify(preset.tracks));
  const pivot = preset.pivot === 'root'
    ? suggestMobRootPivot(mobTarget)
    : mobPresetPivot(preset.pivot, mobTarget);
  anim.pivot = pivot || null;
  renderMobAnimEditor();
  queueMobPreview();
});

$('#mobAnimTracks')?.addEventListener('input', (e) => {
  const track = e.target.closest('[data-mob-anim-index]');
  const field = e.target.dataset.animField;
  if (!track || !field) return;
  const anim = ensureMobAnim();
  const t = anim.tracks[Number(track.dataset.mobAnimIndex)];
  if (!t) return;
  const value = e.target.type === 'number' || e.target.type === 'range' ? Number(e.target.value) : e.target.value;
  t[field] = value;
  if (field === 'falloff') {
    const out = e.target.parentElement.querySelector('output');
    if (out) out.textContent = Number(value).toFixed(2);
  }
  if (field === 'type') renderMobAnimEditor();
  queueMobPreview();
});
$('#mobAnimTracks')?.addEventListener('change', (e) => {
  if (e.target.dataset.animField === 'type' || e.target.dataset.animField === 'wave'
    || e.target.dataset.animField === 'axis' || e.target.dataset.animField === 'along') {
    const track = e.target.closest('[data-mob-anim-index]');
    if (!track) return;
    const anim = ensureMobAnim();
    const t = anim.tracks[Number(track.dataset.mobAnimIndex)];
    if (t) t[e.target.dataset.animField] = e.target.value;
    renderMobAnimEditor();
    queueMobPreview();
  }
});
$('#mobAnimTracks')?.addEventListener('click', (e) => {
  const rm = e.target.closest('[data-mob-anim-remove]');
  if (!rm) return;
  const anim = ensureMobAnim();
  anim.tracks.splice(Number(rm.dataset.mobAnimRemove), 1);
  renderMobAnimEditor();
  queueMobPreview();
});
$('#mobAnimAddBtn')?.addEventListener('click', () => {
  const anim = ensureMobAnim();
  anim.tracks.push({ type: 'rotate', axis: 'z', amp: 15, speed: 0.6, phase: 0, wave: 'sine', react: 'none', falloff: 0, spread: 0, along: 'auto' });
  renderMobAnimEditor();
  queueMobPreview();
});
$('#mobAnimClearBtn')?.addEventListener('click', () => {
  const rec = mobCurrentRecord();
  if (!rec) return;
  rec.anim = null;
  if (mobTarget >= 0) rec.dirty = true;
  renderMobAnimEditor();
  queueMobPreview();
});
['#mobAnimPivotXInput', '#mobAnimPivotYInput', '#mobAnimPivotZInput'].forEach((sel) => {
  $(sel)?.addEventListener('input', () => {
    const anim = ensureMobAnim();
    if (anim) anim.pivot = readMobAnimPivot();
    queueMobPreview();
  });
});

$('#mobAutoFitBtn')?.addEventListener('click', () => {
  if (!mobAssembly) return;
  readMobTargetFromInputs();
  const savedX = mobAssembly.offsetX, savedY = mobAssembly.offsetY, savedZ = mobAssembly.offsetZ;
  mobAssembly.offsetX = 0; mobAssembly.offsetY = 0; mobAssembly.offsetZ = 0;
  const b = computeMobBounds();
  if (!b) {
    mobAssembly.offsetX = savedX; mobAssembly.offsetY = savedY; mobAssembly.offsetZ = savedZ;
    showToast('Előbb tölts fel modellt.', true);
    return;
  }
  mobAssembly.offsetX = round2(-(b.min[0] + b.max[0]) / 2);
  mobAssembly.offsetY = round2(-b.min[1]);
  mobAssembly.offsetZ = round2(-(b.min[2] + b.max[2]) / 2);
  writeMobTargetToInputs();
  queueMobPreview();
  showToast('A modell a talpára állítva.');
});

$('#mobFitResetBtn')?.addEventListener('click', () => {
  const rec = mobCurrentRecord();
  if (!rec) return;
  readMobTargetFromInputs();
  rec.offsetX = 0; rec.offsetY = 0; rec.offsetZ = 0;
  rec.rotationX = 0; rec.rotationY = 0; rec.rotationZ = 0;
  rec.scale = 1;
  if (mobTarget >= 0) rec.dirty = true;
  writeMobTargetToInputs();
  queueMobPreview();
});

function mobSyncAgo(raw) {
  if (!raw) return 'ismeretlen';
  const ms = Date.parse(String(raw).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(ms)) return 'ismeretlen';
  const diff = Math.max(0, Date.now() - ms) / 1000;
  if (diff < 90) return Math.round(diff) + ' mp-e';
  if (diff < 5400) return Math.round(diff / 60) + ' perce';
  if (diff < 172800) return Math.round(diff / 3600) + ' órája';
  return Math.round(diff / 86400) + ' napja';
}

function mobTargetBounds(partIndex) {
  const source = partIndex < 0
    ? mobParts.filter((p) => Array.isArray(p.elements) && p.elements.length)
    : [mobParts[partIndex]].filter((p) => p && Array.isArray(p.elements) && p.elements.length);
  if (!source.length) return null;
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const part of source) {
    for (const pt of mobPartPoints(part)) {
      for (let k = 0; k < 3; k++) {
        if (pt[k] < mn[k]) mn[k] = pt[k];
        if (pt[k] > mx[k]) mx[k] = pt[k];
      }
    }
  }
  return Number.isFinite(mn[0]) ? { min: mn, max: mx } : null;
}

function mobPresetPivot(kind, partIndex) {
  if (kind !== 'base') return null;
  const b = mobTargetBounds(partIndex);
  if (!b) return null;
  return [
    round2((b.min[0] + b.max[0]) / 2),
    round2(b.min[1]),
    round2((b.min[2] + b.max[2]) / 2)
  ];
}

function suggestMobRootPivot(partIndex) {
  const source = partIndex < 0
    ? mobParts.filter((p) => Array.isArray(p.elements) && p.elements.length)
    : [mobParts[partIndex]].filter((p) => p && Array.isArray(p.elements) && p.elements.length);
  if (!source.length) return null;

  const all = [];
  for (const p of source) for (const el of p.elements) all.push(el);
  const rec = partIndex < 0 ? mobAssembly : mobParts[partIndex];
  const axis = SkinPreview.animAlongAxis(rec ? rec.anim : null, all);

  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const el of all) {
    if (!Array.isArray(el.from) || !Array.isArray(el.to)) continue;
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], el.from[k], el.to[k]);
      mx[k] = Math.max(mx[k], el.from[k], el.to[k]);
    }
  }
  if (!Number.isFinite(mn[0])) return null;

  const ref = mobAssembly && mobAssembly.itemModelSpace !== false ? 8 : 0;
  const pivot = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  pivot[axis] = rootPivotCoord(mn[axis], mx[axis], ref);
  return pivot.map((n) => Math.round(n * 100) / 100);
}

// ---------------------------------------------------------------------------
// Alap skinek és köpenyek (játékos oldal + admin)
// ---------------------------------------------------------------------------

const DM_CATEGORY_LABELS = { skin: 'Skin', skin_hd: 'HD skin', cape: 'Köpeny', cape_hd: 'HD köpeny' };

function defaultMediaImageUrl(id) {
  return BACKEND_URL + '/api/default-media/' + id + '/image';
}

// Egy skin elölnézete 2D-ben (fej, test, karok, lábak + a második réteg),
// 16x32 "skin-pixel" rácsra rajzolva. HD és régi 64x32 skint is kezel.
function drawSkinFront(canvas, img, slim) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const tw = img.naturalWidth || img.width;
  const th = img.naturalHeight || img.height;
  const s = tw / 64;
  const legacy = th * 2 === tw;
  const unit = Math.min(canvas.width / 16, canvas.height / 32);
  const ox = (canvas.width - unit * 16) / 2;
  const oy = (canvas.height - unit * 32) / 2;
  const armW = slim ? 3 : 4;
  function part(sx, sy, sw, sh, dx, dy, mirror) {
    const x = ox + dx * unit, y = oy + dy * unit, w = sw * unit, h = sh * unit;
    if (mirror) {
      ctx.save();
      ctx.translate(x + w, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx * s, sy * s, sw * s, sh * s, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx * s, sy * s, sw * s, sh * s, x, y, w, h);
    }
  }
  const rArmX = 4 - armW;
  part(8, 8, 8, 8, 4, 0);
  part(20, 20, 8, 12, 4, 8);
  part(44, 20, armW, 12, rArmX, 8);
  part(4, 20, 4, 12, 4, 20);
  if (legacy) {
    part(44, 20, armW, 12, 12, 8, true);
    part(4, 20, 4, 12, 8, 20, true);
    part(40, 8, 8, 8, 4, 0);
    return;
  }
  part(36, 52, armW, 12, 12, 8);
  part(20, 52, 4, 12, 8, 20);
  part(40, 8, 8, 8, 4, 0);
  part(20, 36, 8, 12, 4, 8);
  part(44, 36, armW, 12, rArmX, 8);
  part(52, 52, armW, 12, 12, 8);
  part(4, 36, 4, 12, 4, 20);
  part(4, 52, 4, 12, 8, 20);
}

// A köpeny hátulról látszó oldala (a textúra 1,1-es 10x16-os mezője).
function drawCapeFront(canvas, img) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = (img.naturalWidth || img.width) / 64;
  const unit = Math.min(canvas.width / 10, canvas.height / 16);
  const w = 10 * unit, h = 16 * unit;
  ctx.drawImage(img, 1 * s, 1 * s, 10 * s, 16 * s, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

async function drawDefaultMediaThumb(canvas, item) {
  const img = await loadImage(defaultMediaImageUrl(item.id));
  if (!img || !canvas.isConnected) return;
  if (item.kind === 'cape') drawCapeFront(canvas, img);
  else drawSkinFront(canvas, img, item.variant === 'slim');
  canvas.classList.add('is-ready');
}

function defaultMediaMetaHtml(item) {
  const chips = [];
  if (item.submittedBy) chips.push(`<span class="dm-chip dm-chip-author" title="Beküldte: ${escapeHtml(item.submittedBy)}">${escapeHtml(item.submittedBy)}</span>`);
  if (item.hd) chips.push(`<span class="dm-chip dm-chip-hd">HD · ${item.width}x${item.height}</span>`);
  else chips.push(`<span class="dm-chip">${item.width}x${item.height}</span>`);
  if (item.kind === 'skin') chips.push(`<span class="dm-chip">${item.variant === 'slim' ? 'Vékony kar' : 'Klasszikus'}</span>`);
  return chips.join('');
}

let defaultMediaItems = [];
let defaultMediaCategory = 'skin';
let dmTrying = null;

async function loadDefaultMediaGallery() {
  const card = $('#defaultMediaCard');
  if (!card) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/default-media', { cache: 'no-cache' });
    const data = await res.json();
    defaultMediaItems = data.ok && Array.isArray(data.items) ? data.items : [];
  } catch {
    defaultMediaItems = [];
  }
  card.classList.toggle('hidden', !defaultMediaItems.length);
  if (!defaultMediaItems.length) return;
  const counts = {};
  for (const it of defaultMediaItems) counts[it.category] = (counts[it.category] || 0) + 1;
  $$('[data-dm-count]').forEach((el) => {
    el.textContent = counts[el.dataset.dmCount] || 0;
    el.closest('.dm-tab').classList.toggle('is-empty', !counts[el.dataset.dmCount]);
  });
  if (!counts[defaultMediaCategory]) {
    defaultMediaCategory = ['skin', 'skin_hd', 'cape', 'cape_hd'].find((c) => counts[c]) || 'skin';
  }
  renderDefaultMediaGallery();
}

function renderDefaultMediaGallery() {
  $$('[data-dm-cat]').forEach((b) => {
    const on = b.dataset.dmCat === defaultMediaCategory;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const grid = $('#defaultMediaGrid');
  const items = defaultMediaItems.filter((it) => it.category === defaultMediaCategory);
  if (!items.length) {
    grid.innerHTML = '<p class="dm-empty">Ebben a kategóriában még nincs elérhető elem.</p>';
    return;
  }
  const isCape = defaultMediaCategory.startsWith('cape');
  grid.innerHTML = items.map((it, i) => `
    <div class="dm-item${dmTrying && dmTrying.id === it.id ? ' is-trying' : ''}" data-dm-id="${it.id}" style="--i:${i}">
      <div class="dm-item-stage${isCape ? ' is-cape' : ''}">
        <canvas class="dm-item-canvas" width="${isCape ? 80 : 96}" height="${isCape ? 128 : 192}" data-dm-thumb="${it.id}"></canvas>
      </div>
      <div class="dm-item-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
      <div class="dm-item-meta">${defaultMediaMetaHtml(it)}</div>
      <div class="dm-item-actions">
        <button type="button" class="btn-outline dm-btn" data-dm-try="${it.id}">Kipróbálom</button>
        <button type="button" class="btn-glow dm-btn" data-dm-apply="${it.id}">Beállítom</button>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-dm-thumb]').forEach((c) => {
    const item = items.find((it) => it.id === Number(c.dataset.dmThumb));
    if (item) drawDefaultMediaThumb(c, item);
  });
}

async function tryDefaultMedia(item) {
  const [ownSkin, ownCape, candidate] = await Promise.all([
    loadSkinImage(session.username),
    loadCapeImage(session.username),
    loadImage(defaultMediaImageUrl(item.id))
  ]);
  if (!candidate) { showToast('Nem sikerült betölteni az előnézetet.', true); return; }
  let skinImg = ownSkin;
  let capeImg = ownCape;
  let slim = skinModel === 'slim';
  if (item.kind === 'skin') { skinImg = candidate; slim = item.variant === 'slim'; }
  else capeImg = candidate;
  if (!skinImg) skinImg = await SkinPreview.getSteveImage();
  if (stopSkinPreview) stopSkinPreview();
  stopSkinPreview = SkinPreview.start($('#skinPreview3d'), skinImg, slim, capeImg);
  dmTrying = item;
  $('#dmTryName').textContent = `${item.name} (${DM_CATEGORY_LABELS[item.category] || ''})`;
  $('#dmTryBar').classList.remove('hidden');
  $$('.dm-item').forEach((el) => el.classList.toggle('is-trying', Number(el.dataset.dmId) === item.id));
  $('#skinPreview3d').scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function endDefaultMediaTry(reload) {
  dmTrying = null;
  $('#dmTryBar').classList.add('hidden');
  $$('.dm-item.is-trying').forEach((el) => el.classList.remove('is-trying'));
  if (reload) loadSkinPreview3d();
}

async function applyDefaultMedia(item, btn) {
  const what = item.kind === 'skin' ? 'skinedet' : 'köpenyedet';
  const ok = await confirmModal(
    item.kind === 'skin' ? 'Skin beállítása' : 'Köpeny beállítása',
    `A(z) <b>${escapeHtml(item.name)}</b> lecseréli a jelenlegi ${what}. Folytatod?`,
    'Igen, beállítom'
  );
  if (!ok) return;
  if (btn && typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  try {
    const res = await fetch(BACKEND_URL + '/api/default-media/' + item.id + '/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: '{}'
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült beállítani.', true); return; }
    showToast(data.message || 'Beállítva!');
    if (data.kind === 'skin') {
      skinModel = data.variant === 'slim' ? 'slim' : 'classic';
      $$('.skin-model-toggle .pill[data-model]').forEach((p) => p.classList.toggle('active', p.dataset.model === skinModel));
    }
    endDefaultMediaTry(false);
    loadSkinPreview3d();
    loadHomeSkinPreview();
    loadTopbarAvatar();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  } finally {
    if (btn && typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
}

$$('[data-dm-cat]').forEach((b) => b.addEventListener('click', () => {
  defaultMediaCategory = b.dataset.dmCat;
  renderDefaultMediaGallery();
}));
$('#defaultMediaGrid').addEventListener('click', (e) => {
  const tryBtn = e.target.closest('[data-dm-try]');
  const applyBtn = e.target.closest('[data-dm-apply]');
  const id = Number((tryBtn || applyBtn)?.dataset.dmTry || (tryBtn || applyBtn)?.dataset.dmApply);
  const item = defaultMediaItems.find((it) => it.id === id);
  if (!item) return;
  if (tryBtn) tryDefaultMedia(item);
  else applyDefaultMedia(item, applyBtn);
});
$('#dmTryCancel').addEventListener('click', () => endDefaultMediaTry(true));
$('#dmTryApply').addEventListener('click', (e) => { if (dmTrying) applyDefaultMedia(dmTrying, e.currentTarget); });

// --- admin ---

let dmAdminItems = [];
let dmAdminCategory = 'skin';
let dmAdminFilter = 'skin';
let dmAdminVariant = 'classic';
let dmAdminFile = null;

function dmAdminAuth() {
  return { Authorization: 'Bearer ' + session.token };
}

function syncDmAdminForm() {
  $$('[data-dm-admin-cat]').forEach((b) => {
    const on = b.dataset.dmAdminCat === dmAdminCategory;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  $$('[data-dm-admin-variant]').forEach((b) => b.classList.toggle('active', b.dataset.dmAdminVariant === dmAdminVariant));
  $('#dmAdminVariantWrap').classList.toggle('hidden', dmAdminCategory.startsWith('cape'));
  renderDmAdminPreview();
}

async function renderDmAdminPreview() {
  const canvas = $('#dmAdminPreview');
  const text = $('#dmAdminDropText');
  if (!dmAdminFile) {
    canvas.classList.add('hidden');
    text.textContent = 'Húzd ide a .png fájlt, vagy kattints a tallózáshoz';
    return;
  }
  const url = URL.createObjectURL(dmAdminFile);
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  if (!img) {
    canvas.classList.add('hidden');
    text.textContent = 'Ez a fájl nem olvasható PNG kép.';
    return;
  }
  const isCape = dmAdminCategory.startsWith('cape');
  canvas.width = isCape ? 80 : 96;
  canvas.height = isCape ? 128 : 192;
  if (isCape) drawCapeFront(canvas, img);
  else drawSkinFront(canvas, img, dmAdminVariant === 'slim');
  canvas.classList.remove('hidden');
  text.textContent = `${dmAdminFile.name} · ${img.naturalWidth}x${img.naturalHeight}`;
}

function resetDmAdminForm() {
  dmAdminFile = null;
  $('#dmAdminName').value = '';
  $('#dmAdminResult').textContent = '';
  $('#dmAdminResult').classList.remove('error');
  syncDmAdminForm();
}

async function loadDefaultMediaAdmin() {
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/default-media', { headers: dmAdminAuth() });
    const data = await res.json();
    dmAdminItems = data.ok && Array.isArray(data.items) ? data.items : [];
  } catch {
    dmAdminItems = [];
  }
  renderDefaultMediaAdmin();
}

function renderDefaultMediaAdmin() {
  const counts = {};
  for (const it of dmAdminItems) counts[it.category] = (counts[it.category] || 0) + 1;
  $$('[data-dm-admin-count]').forEach((el) => { el.textContent = counts[el.dataset.dmAdminCount] || 0; });
  $$('[data-dm-admin-filter]').forEach((b) => {
    const on = b.dataset.dmAdminFilter === dmAdminFilter;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const list = $('#dmAdminList');
  const items = dmAdminItems.filter((it) => it.category === dmAdminFilter);
  if (!items.length) {
    list.innerHTML = `<p class="dm-empty">Még nincs feltöltött elem ebben a kategóriában (${escapeHtml(DM_CATEGORY_LABELS[dmAdminFilter])}).</p>`;
    return;
  }
  const isCape = dmAdminFilter.startsWith('cape');
  list.innerHTML = items.map((it, i) => `
    <div class="dm-item dm-admin-item${it.enabled ? '' : ' is-hidden-item'}" data-dm-admin-id="${it.id}" style="--i:${i}">
      ${it.enabled ? '' : '<span class="dm-hidden-flag">Rejtett</span>'}
      <div class="dm-item-stage${isCape ? ' is-cape' : ''}">
        <canvas class="dm-item-canvas" width="${isCape ? 80 : 96}" height="${isCape ? 128 : 192}" data-dm-admin-thumb="${it.id}"></canvas>
      </div>
      <input class="dm-rename" value="${escapeHtml(it.name)}" maxlength="40" aria-label="Megnevezés" data-dm-rename="${it.id}" />
      <div class="dm-item-meta">${defaultMediaMetaHtml(it)}</div>
      <div class="dm-item-actions dm-admin-actions">
        ${it.kind === 'skin' ? `<button type="button" class="btn-outline dm-btn" data-dm-variant="${it.id}" title="Kar-modell váltása">${it.variant === 'slim' ? 'Slim → Klasszikus' : 'Klasszikus → Slim'}</button>` : ''}
        <button type="button" class="btn-outline dm-btn" data-dm-toggle="${it.id}">${it.enabled ? 'Elrejtés' : 'Megjelenítés'}</button>
        <button type="button" class="btn-outline dm-btn dm-btn-danger" data-dm-delete="${it.id}">Törlés</button>
      </div>
    </div>`).join('');
  list.querySelectorAll('[data-dm-admin-thumb]').forEach((c) => {
    const item = items.find((it) => it.id === Number(c.dataset.dmAdminThumb));
    if (item) drawDefaultMediaThumb(c, item);
  });
}

async function updateDefaultMediaItem(id, patch) {
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/default-media/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...dmAdminAuth() },
      body: JSON.stringify(patch)
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült menteni.', true); return; }
    dmAdminItems = dmAdminItems.map((it) => (it.id === id ? data.item : it));
    renderDefaultMediaAdmin();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
}

$$('[data-dm-admin-cat]').forEach((b) => b.addEventListener('click', () => {
  dmAdminCategory = b.dataset.dmAdminCat;
  syncDmAdminForm();
}));
$$('[data-dm-admin-variant]').forEach((b) => b.addEventListener('click', () => {
  dmAdminVariant = b.dataset.dmAdminVariant;
  syncDmAdminForm();
}));
$$('[data-dm-admin-filter]').forEach((b) => b.addEventListener('click', () => {
  dmAdminFilter = b.dataset.dmAdminFilter;
  renderDefaultMediaAdmin();
}));
$('#dmAdminDrop').addEventListener('click', () => $('#dmAdminFile').click());
$('#dmAdminDrop').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#dmAdminFile').click(); }
});
$('#dmAdminDrop').addEventListener('dragover', (e) => { e.preventDefault(); $('#dmAdminDrop').classList.add('is-drag'); });
$('#dmAdminDrop').addEventListener('dragleave', () => $('#dmAdminDrop').classList.remove('is-drag'));
$('#dmAdminDrop').addEventListener('drop', (e) => {
  e.preventDefault();
  $('#dmAdminDrop').classList.remove('is-drag');
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) { dmAdminFile = file; renderDmAdminPreview(); }
});
$('#dmAdminFile').addEventListener('change', () => {
  const file = $('#dmAdminFile').files && $('#dmAdminFile').files[0];
  if (file) {
    dmAdminFile = file;
    if (!$('#dmAdminName').value.trim()) $('#dmAdminName').value = file.name.replace(/\.png$/i, '').slice(0, 40);
    renderDmAdminPreview();
  }
  $('#dmAdminFile').value = '';
});
$('#dmAdminSave').addEventListener('click', async () => {
  const resultEl = $('#dmAdminResult');
  resultEl.classList.remove('error');
  const name = $('#dmAdminName').value.trim();
  if (!name) {
    resultEl.classList.add('error');
    resultEl.textContent = 'Adj nevet a képnek.';
    if (typeof window.markFieldInvalid === 'function') window.markFieldInvalid($('#dmAdminName'), 'Adj nevet a képnek.');
    return;
  }
  if (!dmAdminFile) {
    resultEl.classList.add('error');
    resultEl.textContent = 'Válassz ki egy PNG fájlt.';
    return;
  }
  const btn = $('#dmAdminSave');
  if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  try {
    const form = new FormData();
    form.append('category', dmAdminCategory);
    form.append('name', name);
    form.append('variant', dmAdminVariant);
    form.append('file', dmAdminFile, 'media.png');
    const res = await fetch(BACKEND_URL + '/api/admin/default-media', { method: 'POST', headers: dmAdminAuth(), body: form });
    const data = await res.json();
    if (!data.ok) {
      resultEl.classList.add('error');
      resultEl.textContent = data.message || 'A feltöltés sikertelen.';
      return;
    }
    showToast(`„${data.item.name}” feltöltve - a játékosok már választhatják.`);
    dmAdminItems.unshift(data.item);
    dmAdminFilter = data.item.category;
    resetDmAdminForm();
    renderDefaultMediaAdmin();
  } catch {
    resultEl.classList.add('error');
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
  } finally {
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
});
$('#dmAdminList').addEventListener('click', async (e) => {
  const toggle = e.target.closest('[data-dm-toggle]');
  const variant = e.target.closest('[data-dm-variant]');
  const del = e.target.closest('[data-dm-delete]');
  if (toggle) {
    const it = dmAdminItems.find((x) => x.id === Number(toggle.dataset.dmToggle));
    if (it) updateDefaultMediaItem(it.id, { enabled: !it.enabled });
  } else if (variant) {
    const it = dmAdminItems.find((x) => x.id === Number(variant.dataset.dmVariant));
    if (it) updateDefaultMediaItem(it.id, { variant: it.variant === 'slim' ? 'classic' : 'slim' });
  } else if (del) {
    const it = dmAdminItems.find((x) => x.id === Number(del.dataset.dmDelete));
    if (!it) return;
    const ok = await confirmModal('Törlés', `Biztosan törlöd: <b>${escapeHtml(it.name)}</b>? Akik már beállították, azoknál megmarad, de többé nem lehet kiválasztani.`, 'Igen, törlés');
    if (!ok) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/default-media/' + it.id, { method: 'DELETE', headers: dmAdminAuth() });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
      dmAdminItems = dmAdminItems.filter((x) => x.id !== it.id);
      renderDefaultMediaAdmin();
      showToast('Törölve.');
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  }
});
$('#dmAdminList').addEventListener('change', (e) => {
  const input = e.target.closest('[data-dm-rename]');
  if (!input) return;
  const it = dmAdminItems.find((x) => x.id === Number(input.dataset.dmRename));
  const name = input.value.trim();
  if (!it || !name || name === it.name) { if (it) input.value = it.name; return; }
  updateDefaultMediaItem(it.id, { name }).then(() => showToast('Átnevezve.'));
});
$('#dmAdminList').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-dm-rename]')) e.target.blur();
});

async function loadAuthImage(url) {
  try {
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + session.token } });
    if (!res.ok) return null;
    const objectUrl = URL.createObjectURL(await res.blob());
    const img = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);
    return img;
  } catch {
    return null;
  }
}

function submissionImageUrl(id) {
  return BACKEND_URL + '/api/default-media/submissions/' + id + '/image';
}

const SUBMISSION_STATUS = {
  pending: { label: 'Elbírálásra vár', cls: 'is-pending' },
  approved: { label: 'Elfogadva', cls: 'is-approved' },
  rejected: { label: 'Elutasítva', cls: 'is-rejected' }
};

let skinSubmitVariant = 'classic';
let skinSubmitFile = null;
let mySkinSubmissions = [];

async function renderSkinSubmitPreview() {
  const canvas = $('#skinSubmitPreview');
  const text = $('#skinSubmitDropText');
  if (!skinSubmitFile) {
    canvas.classList.add('hidden');
    text.textContent = 'Húzd ide a .png skint, vagy kattints a tallózáshoz';
    return;
  }
  const url = URL.createObjectURL(skinSubmitFile);
  const img = await loadImage(url);
  URL.revokeObjectURL(url);
  if (!img) {
    canvas.classList.add('hidden');
    text.textContent = 'Ez a fájl nem olvasható PNG kép.';
    return;
  }
  drawSkinFront(canvas, img, skinSubmitVariant === 'slim');
  canvas.classList.remove('hidden');
  text.textContent = `${skinSubmitFile.name} · ${img.naturalWidth}x${img.naturalHeight}`;
}

function pickSkinSubmitFile(file) {
  if (!file) return;
  skinSubmitFile = file;
  const nameInput = $('#skinSubmitName');
  if (!nameInput.value.trim()) nameInput.value = file.name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').slice(0, 40);
  $('#skinSubmitResult').textContent = '';
  renderSkinSubmitPreview();
}

async function loadMySkinSubmissions() {
  if (!session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/default-media/submissions/mine', { headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    mySkinSubmissions = data.ok && Array.isArray(data.items) ? data.items : [];
  } catch {
    mySkinSubmissions = [];
  }
  renderMySkinSubmissions();
}

function renderMySkinSubmissions() {
  const list = $('#skinSubmitList');
  if (!list) return;
  if (!mySkinSubmissions.length) {
    list.innerHTML = '<p class="dm-empty">Még nem küldtél be skint.</p>';
    return;
  }
  list.innerHTML = mySkinSubmissions.map((it) => {
    const st = SUBMISSION_STATUS[it.status] || SUBMISSION_STATUS.pending;
    const when = formatSanctionUntil(it.reviewedAt || it.createdAt);
    return `
      <div class="skin-submit-row" data-submission-id="${it.id}">
        <canvas class="skin-submit-thumb" width="36" height="72" data-submission-thumb="${it.id}"></canvas>
        <div class="skin-submit-row-text">
          <div class="skin-submit-row-name">${escapeHtml(it.name)}</div>
          <div class="skin-submit-row-meta">${it.hd ? 'HD · ' : ''}${it.width}x${it.height} · ${escapeHtml(when)}</div>
          ${it.status === 'rejected' && it.rejectReason ? `<div class="skin-submit-row-reason">Indok: ${escapeHtml(it.rejectReason)}</div>` : ''}
        </div>
        <div class="skin-submit-row-side">
          <span class="submission-status ${st.cls}">${st.label}</span>
          ${it.status === 'pending' ? `<button type="button" class="link-btn" data-submission-withdraw="${it.id}">Visszavonás</button>` : ''}
        </div>
      </div>`;
  }).join('');
  list.querySelectorAll('[data-submission-thumb]').forEach(async (c) => {
    const item = mySkinSubmissions.find((x) => x.id === Number(c.dataset.submissionThumb));
    if (!item || item.status === 'rejected') { c.classList.add('is-empty'); return; }
    const img = item.status === 'approved'
      ? (item.mediaId ? await loadImage(defaultMediaImageUrl(item.mediaId)) : null)
      : await loadAuthImage(submissionImageUrl(item.id));
    if (img && c.isConnected) drawSkinFront(c, img, item.variant === 'slim');
    else c.classList.add('is-empty');
  });
}

$$('[data-submit-variant]').forEach((b) => b.addEventListener('click', () => {
  skinSubmitVariant = b.dataset.submitVariant === 'slim' ? 'slim' : 'classic';
  $$('[data-submit-variant]').forEach((x) => x.classList.toggle('active', x === b));
  renderSkinSubmitPreview();
}));
$('#skinSubmitDrop').addEventListener('click', () => $('#skinSubmitFile').click());
$('#skinSubmitDrop').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#skinSubmitFile').click(); }
});
$('#skinSubmitDrop').addEventListener('dragover', (e) => { e.preventDefault(); $('#skinSubmitDrop').classList.add('is-drag'); });
$('#skinSubmitDrop').addEventListener('dragleave', () => $('#skinSubmitDrop').classList.remove('is-drag'));
$('#skinSubmitDrop').addEventListener('drop', (e) => {
  e.preventDefault();
  $('#skinSubmitDrop').classList.remove('is-drag');
  pickSkinSubmitFile(e.dataTransfer.files && e.dataTransfer.files[0]);
});
$('#skinSubmitFile').addEventListener('change', () => {
  pickSkinSubmitFile($('#skinSubmitFile').files && $('#skinSubmitFile').files[0]);
  $('#skinSubmitFile').value = '';
});
$('#skinSubmitBtn').addEventListener('click', async () => {
  const resultEl = $('#skinSubmitResult');
  resultEl.classList.remove('error');
  const name = $('#skinSubmitName').value.trim();
  if (name.length < 2) {
    resultEl.classList.add('error');
    resultEl.textContent = 'Adj legalább 2 karakteres nevet a skinnek.';
    if (typeof window.markFieldInvalid === 'function') window.markFieldInvalid($('#skinSubmitName'), 'Adj nevet a skinnek.');
    return;
  }
  if (!skinSubmitFile) {
    resultEl.classList.add('error');
    resultEl.textContent = 'Válaszd ki a beküldendő PNG fájlt.';
    return;
  }
  const btn = $('#skinSubmitBtn');
  if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  try {
    const form = new FormData();
    form.append('name', name);
    form.append('variant', skinSubmitVariant);
    form.append('file', skinSubmitFile, 'skin.png');
    const res = await fetch(BACKEND_URL + '/api/default-media/submissions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + session.token },
      body: form
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.classList.add('error');
      resultEl.textContent = data.message || 'A beküldés sikertelen.';
      return;
    }
    skinSubmitFile = null;
    $('#skinSubmitName').value = '';
    renderSkinSubmitPreview();
    resultEl.textContent = 'Beküldve! Amint a csapat elbírálja, itt látod az eredményt.';
    loadMySkinSubmissions();
  } catch {
    resultEl.classList.add('error');
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
  } finally {
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
});
$('#skinSubmitList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-submission-withdraw]');
  if (!btn) return;
  const it = mySkinSubmissions.find((x) => x.id === Number(btn.dataset.submissionWithdraw));
  if (!it) return;
  const ok = await confirmModal('Beküldés visszavonása', `Visszavonod a(z) <b>${escapeHtml(it.name)}</b> beküldését?`, 'Igen, visszavonom');
  if (!ok) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/default-media/submissions/' + it.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült visszavonni.', true); return; }
    loadMySkinSubmissions();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});

let dmReviewPending = [];
let dmReviewHistory = [];

async function loadSkinSubmissionsAdmin() {
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/default-media/submissions', { headers: dmAdminAuth() });
    const data = await res.json();
    dmReviewPending = data.ok && Array.isArray(data.pending) ? data.pending : [];
    dmReviewHistory = data.ok && Array.isArray(data.reviewed) ? data.reviewed : [];
  } catch {
    dmReviewPending = [];
    dmReviewHistory = [];
  }
  renderSkinSubmissionsAdmin();
}

function renderSkinSubmissionsAdmin() {
  $('#dmReviewCount').textContent = dmReviewPending.length;
  const list = $('#dmReviewList');
  if (!dmReviewPending.length) {
    list.innerHTML = '<p class="dm-empty">Nincs elbírálásra váró beküldés.</p>';
  } else {
    list.innerHTML = dmReviewPending.map((it, i) => `
      <div class="dm-item dm-admin-item dm-review-item" data-review-id="${it.id}" style="--i:${i}">
        <div class="dm-item-stage">
          <canvas class="dm-item-canvas" width="96" height="192" data-review-thumb="${it.id}"></canvas>
        </div>
        <input class="dm-rename" value="${escapeHtml(it.name)}" maxlength="40" aria-label="Megnevezés" data-review-name="${it.id}" />
        <div class="dm-item-meta">
          <span class="dm-chip dm-chip-author">${escapeHtml(it.username)}</span>
          <span class="dm-chip${it.hd ? ' dm-chip-hd' : ''}">${it.hd ? 'HD · ' : ''}${it.width}x${it.height}</span>
          <button type="button" class="dm-chip dm-chip-btn" data-review-variant="${it.id}" title="Kar-modell váltása">${it.variant === 'slim' ? 'Vékony kar' : 'Klasszikus'}</button>
        </div>
        <div class="dm-item-actions">
          <button type="button" class="btn-outline dm-btn dm-btn-danger" data-review-reject="${it.id}">Elutasítás</button>
          <button type="button" class="btn-glow dm-btn" data-review-approve="${it.id}">Elfogadás</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('[data-review-thumb]').forEach(async (c) => {
      const item = dmReviewPending.find((x) => x.id === Number(c.dataset.reviewThumb));
      if (!item) return;
      const img = await loadAuthImage(submissionImageUrl(item.id));
      if (!img || !c.isConnected) return;
      c.__img = img;
      drawSkinFront(c, img, item.variant === 'slim');
      c.classList.add('is-ready');
    });
  }
  const hist = $('#dmReviewHistory');
  hist.innerHTML = dmReviewHistory.length
    ? dmReviewHistory.map((it) => {
      const st = SUBMISSION_STATUS[it.status] || SUBMISSION_STATUS.pending;
      return `<div class="dm-review-history-row">
        <span class="submission-status ${st.cls}">${st.label}</span>
        <b>${escapeHtml(it.name)}</b>
        <span>${escapeHtml(it.username)} · ${escapeHtml(it.reviewedBy || '-')} · ${escapeHtml(formatSanctionUntil(it.reviewedAt))}</span>
        ${it.rejectReason ? `<em>${escapeHtml(it.rejectReason)}</em>` : ''}
      </div>`;
    }).join('')
    : '<p class="dm-empty">Még nincs elbírált beküldés.</p>';
}

$('#dmReviewList').addEventListener('click', async (e) => {
  const variantBtn = e.target.closest('[data-review-variant]');
  const approveBtn = e.target.closest('[data-review-approve]');
  const rejectBtn = e.target.closest('[data-review-reject]');
  if (variantBtn) {
    const it = dmReviewPending.find((x) => x.id === Number(variantBtn.dataset.reviewVariant));
    if (!it) return;
    it.variant = it.variant === 'slim' ? 'classic' : 'slim';
    variantBtn.textContent = it.variant === 'slim' ? 'Vékony kar' : 'Klasszikus';
    const c = $(`[data-review-thumb="${it.id}"]`);
    if (c && c.__img) drawSkinFront(c, c.__img, it.variant === 'slim');
    return;
  }
  if (approveBtn) {
    const it = dmReviewPending.find((x) => x.id === Number(approveBtn.dataset.reviewApprove));
    if (!it) return;
    const nameInput = $(`[data-review-name="${it.id}"]`);
    const name = (nameInput && nameInput.value.trim()) || it.name;
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(approveBtn, true);
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/default-media/submissions/' + it.id + '/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...dmAdminAuth() },
        body: JSON.stringify({ name, variant: it.variant })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült elfogadni.', true); return; }
      showToast(`„${data.item.name}” elfogadva - már választható az alap skinek között.`);
      dmAdminItems.unshift(data.item);
      renderDefaultMediaAdmin();
      loadSkinSubmissionsAdmin();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    } finally {
      if (typeof window.setButtonLoading === 'function') window.setButtonLoading(approveBtn, false);
    }
    return;
  }
  if (rejectBtn) {
    const it = dmReviewPending.find((x) => x.id === Number(rejectBtn.dataset.reviewReject));
    if (!it) return;
    const reason = await textPromptModal(
      'Beküldés elutasítása',
      `Elutasítod <b>${escapeHtml(it.username)}</b> „${escapeHtml(it.name)}” skinjét. Az indokot a játékos is látja (nem kötelező).`,
      'Pl. túl hasonlít egy meglévőre',
      'Elutasítás'
    );
    if (reason === null) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/default-media/submissions/' + it.id + '/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...dmAdminAuth() },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült elutasítani.', true); return; }
      showToast('Beküldés elutasítva.');
      loadSkinSubmissionsAdmin();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  }
});

// ---------------------------------------------------------------------------
// Tiltott felhasználónevek (admin)
// ---------------------------------------------------------------------------

let nameRules = [];
let nameRulesFilter = 'all';
let nrMatchType = 'exact';
let nrAction = 'block';
let nrFilterWordCount = 0;

const NR_HINTS = {
  'exact:block': 'A <b>Pontos név</b> csak ezt az egy nevet tiltja le (kis- és nagybetűtől függetlenül).',
  'contains:block': 'A <b>Tartalmazza</b> minden olyan nevet tilt, amiben ez a részlet szerepel - a leet-írást (0→o, 1→i...) és az alávonást is figyelembe veszi.',
  'exact:allow': 'A <b>Kivétel</b> ezt a pontos nevet akkor is átengedi, ha az automata szűrő vagy egy "Tartalmazza" szabály fennakadna rajta.'
};

function syncNameRuleForm() {
  if (nrAction === 'allow') nrMatchType = 'exact';
  $$('[data-nr-match]').forEach((b) => {
    const on = b.dataset.nrMatch === nrMatchType;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.disabled = nrAction === 'allow' && b.dataset.nrMatch === 'contains';
  });
  $$('[data-nr-action]').forEach((b) => {
    const on = b.dataset.nrAction === nrAction;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
  $('#nrHint').innerHTML = NR_HINTS[`${nrMatchType}:${nrAction}`] || '';
  $('#nrAddBtn').textContent = nrAction === 'allow' ? 'Kivétel hozzáadása' : 'Tiltás hozzáadása';
}

function nrAuthHeaders(json) {
  return json
    ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token }
    : { Authorization: 'Bearer ' + session.token };
}

async function loadNameRules() {
  $('#nameRulesList').innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/name-rules', { headers: nrAuthHeaders() });
    const data = await res.json();
    nameRules = data.ok && Array.isArray(data.rules) ? data.rules : [];
    nrFilterWordCount = data.ok ? data.filterWordCount || 0 : 0;
  } catch {
    nameRules = [];
  }
  renderNameRules();
}

function renderNameRuleStats() {
  const blocks = nameRules.filter((r) => r.action === 'block');
  const active = blocks.filter((r) => r.enabled).length;
  const allows = nameRules.filter((r) => r.action === 'allow').length;
  const affected = blocks.reduce((n, r) => n + (r.enabled ? r.matchCount : 0), 0);
  const tile = (value, label, tone) => `<div class="nr-stat nr-stat-${tone}"><b>${value}</b><span>${label}</span></div>`;
  $('#nameRulesStats').innerHTML =
    tile(nrFilterWordCount, 'kifejezés az automata szűrőben', 'gold') +
    tile(active + (blocks.length > active ? ` <small>/ ${blocks.length}</small>` : ''), 'aktív tiltás', 'danger') +
    tile(allows, 'kivétel', 'success') +
    tile(affected, 'meglévő fiók érintett', 'orange');
}

function renderNameRules() {
  renderNameRuleStats();
  $$('[data-nr-filter]').forEach((b) => b.classList.toggle('active', b.dataset.nrFilter === nameRulesFilter));
  const q = ($('#nrSearch').value || '').trim().toLowerCase();
  const rows = nameRules.filter((r) =>
    (nameRulesFilter === 'all' || r.action === nameRulesFilter) &&
    (!q || r.pattern.toLowerCase().includes(q) || (r.note || '').toLowerCase().includes(q)));
  const list = $('#nameRulesList');
  if (!nameRules.length) {
    list.innerHTML = '<div class="nr-empty"><b>Még nincs egyedi szabály.</b><span>Az automata szűrő ettől függetlenül már most is véd a csúnya nevek ellen.</span></div>';
    return;
  }
  if (!rows.length) {
    list.innerHTML = '<div class="nr-empty"><span>Nincs a szűrésnek megfelelő szabály.</span></div>';
    return;
  }
  list.innerHTML = rows.map((r, i) => `
    <div class="nr-row${r.enabled ? '' : ' is-off'} nr-row-${r.action}" style="--i:${i}">
      <div class="nr-row-main">
        <div class="nr-row-pattern"><code>${escapeHtml(r.pattern)}</code>
          <span class="nr-chip nr-chip-${r.action}">${r.action === 'allow' ? 'Kivétel' : 'Tiltás'}</span>
          <span class="nr-chip">${r.matchType === 'contains' ? 'Tartalmazza' : 'Pontos név'}</span>
        </div>
        <div class="nr-row-meta">
          ${r.note ? `<span class="nr-row-note">${escapeHtml(r.note)}</span> · ` : ''}${escapeHtml(r.createdBy)} · ${escapeHtml(formatLedgerDate(r.createdAt))}
        </div>
        ${r.action === 'block' && r.matchCount ? `
          <div class="nr-row-matches">
            <span>${r.matchCount} meglévő fiók egyezik:</span>
            ${r.matches.map((u) => `<button type="button" class="nr-user-link" data-nr-open="${escapeHtml(u)}">${escapeHtml(u)}</button>`).join('')}
            ${r.matchCount > r.matches.length ? `<span class="nr-more">+${r.matchCount - r.matches.length}</span>` : ''}
          </div>` : ''}
      </div>
      <div class="nr-row-actions">
        <label class="nr-toggle" title="${r.enabled ? 'Aktív' : 'Kikapcsolva'}">
          <span class="switch"><input type="checkbox" data-nr-toggle="${r.id}"${r.enabled ? ' checked' : ''} /><span class="switch-track"></span><span class="switch-thumb"></span></span>
          <span class="nr-toggle-label">${r.enabled ? (r.action === 'allow' ? 'Engedélyezve' : 'Tiltva') : 'Kikapcsolva'}</span>
        </label>
        <button type="button" class="nr-delete" data-nr-delete="${r.id}" aria-label="Szabály törlése" title="Törlés">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`).join('');
}

async function addNameRule() {
  const resultEl = $('#nrResult');
  resultEl.classList.remove('error');
  resultEl.textContent = '';
  const input = $('#nrPattern');
  const pattern = input.value.trim();
  if (!/^[A-Za-z0-9_]{2,32}$/.test(pattern)) {
    const msg = 'A minta 2-32 karakter lehet: betű, szám, alávonás.';
    resultEl.classList.add('error');
    resultEl.textContent = msg;
    if (typeof window.markFieldInvalid === 'function') window.markFieldInvalid(input, msg);
    return;
  }
  const btn = $('#nrAddBtn');
  if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/name-rules', {
      method: 'POST',
      headers: nrAuthHeaders(true),
      body: JSON.stringify({ pattern, matchType: nrMatchType, action: nrAction, note: $('#nrNote').value.trim() })
    });
    const data = await res.json();
    if (!data.ok) {
      resultEl.classList.add('error');
      resultEl.textContent = data.message || 'Nem sikerült hozzáadni.';
      return;
    }
    nameRules.unshift(data.rule);
    input.value = '';
    $('#nrNote').value = '';
    renderNameRules();
    showToast(data.rule.action === 'allow'
      ? `„${data.rule.pattern}” felvéve a kivételek közé.`
      : `„${data.rule.pattern}” letiltva${data.rule.matchCount ? ` - ${data.rule.matchCount} meglévő fiók egyezik vele` : ''}.`);
  } catch {
    resultEl.classList.add('error');
    resultEl.textContent = 'Nem sikerült elérni a szervert.';
  } finally {
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
}

async function testUsernameAgainstRules() {
  const name = $('#nrTestInput').value.trim();
  const out = $('#nrTestResult');
  if (!name) { $('#nrTestInput').focus(); return; }
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/name-rules/test', {
      method: 'POST', headers: nrAuthHeaders(true), body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!data.ok) { showToast(data.message || 'Nem sikerült ellenőrizni.', true); return; }
    let detail;
    if (data.allowed) {
      detail = data.source === 'allow'
        ? `Engedélyezve - kivétel: <code>${escapeHtml(data.rule.pattern)}</code>`
        : 'Egyik szabályon és a szűrőn sem akad fenn.';
    } else if (data.source === 'rule') {
      detail = `Tiltva a(z) <code>${escapeHtml(data.rule.pattern)}</code> szabály miatt (${data.rule.matchType === 'contains' ? 'tartalmazza' : 'pontos név'}).`;
    } else {
      detail = `Az automata szűrő fogta meg${data.word ? `: <code>${escapeHtml(data.word)}</code>` : ''}.`;
    }
    out.className = 'nr-test-result ' + (data.allowed ? 'is-ok' : 'is-bad');
    out.innerHTML = `
      <span class="nr-test-icon">${data.allowed ? RANK_CHECK_SVG : RANK_CROSS_SVG}</span>
      <div><b>${escapeHtml(name)}</b> - ${data.allowed ? 'regisztrálható' : 'nem regisztrálható'}<small>${detail}</small></div>
      ${!data.allowed && data.source === 'filter' ? `<button type="button" class="link-btn" data-nr-allow-name="${escapeHtml(name)}">Kivétel felvétele</button>` : ''}`;
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
}

async function scanExistingUsernames() {
  const btn = $('#nrScanBtn');
  const out = $('#nameRulesScan');
  if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/name-rules/scan', { headers: nrAuthHeaders() });
    const data = await res.json();
    const hits = data.ok && Array.isArray(data.hits) ? data.hits : [];
    if (!hits.length) {
      out.innerHTML = '<div class="nr-empty nr-empty-ok"><b>Minden rendben.</b><span>Egyetlen meglévő fiók neve sem sérti a jelenlegi szabályokat.</span></div>';
      return;
    }
    out.innerHTML = `<p class="nr-scan-summary"><b>${hits.length}</b> fiók neve sértené a szabályokat:</p>
      <div class="nr-scan-grid">${hits.map((h, i) => `
        <button type="button" class="nr-scan-item" data-nr-open="${escapeHtml(h.username)}" style="--i:${i}">
          <canvas width="28" height="28" data-nr-face="${escapeHtml(h.username)}"></canvas>
          <span class="nr-scan-name">${escapeHtml(h.username)}</span>
          <span class="nr-scan-why">${h.source === 'rule' ? `szabály: ${escapeHtml(h.pattern)}` : `szűrő: ${escapeHtml(h.word || '')}`}</span>
        </button>`).join('')}</div>`;
    out.querySelectorAll('[data-nr-face]').forEach((c) => drawFaceFromSkin(c, c.dataset.nrFace, 28));
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  } finally {
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
  }
}

$$('[data-nr-match]').forEach((b) => b.addEventListener('click', () => { nrMatchType = b.dataset.nrMatch; syncNameRuleForm(); }));
$$('[data-nr-action]').forEach((b) => b.addEventListener('click', () => { nrAction = b.dataset.nrAction; syncNameRuleForm(); }));
$$('[data-nr-filter]').forEach((b) => b.addEventListener('click', () => { nameRulesFilter = b.dataset.nrFilter; renderNameRules(); }));
$('#nrSearch').addEventListener('input', renderNameRules);
$('#nrAddBtn').addEventListener('click', addNameRule);
$('#nrPattern').addEventListener('keydown', (e) => { if (e.key === 'Enter') addNameRule(); });
$('#nrTestBtn').addEventListener('click', testUsernameAgainstRules);
$('#nrTestInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') testUsernameAgainstRules(); });
$('#nrScanBtn').addEventListener('click', scanExistingUsernames);

document.querySelector('.view[data-view="nameRules"]').addEventListener('click', async (e) => {
  const open = e.target.closest('[data-nr-open]');
  if (open) { openPlayerProfile(open.dataset.nrOpen); return; }
  const allowName = e.target.closest('[data-nr-allow-name]');
  if (allowName) {
    nrAction = 'allow';
    nrMatchType = 'exact';
    $('#nrPattern').value = allowName.dataset.nrAllowName;
    syncNameRuleForm();
    $('#nrPattern').scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('#nrPattern').focus();
    return;
  }
  const del = e.target.closest('[data-nr-delete]');
  if (del) {
    const rule = nameRules.find((r) => r.id === Number(del.dataset.nrDelete));
    if (!rule) return;
    const ok = await confirmModal('Szabály törlése', `Biztosan törlöd ezt a szabályt: <b>${escapeHtml(rule.pattern)}</b>?`, 'Igen, törlés');
    if (!ok) return;
    try {
      const res = await fetch(BACKEND_URL + '/api/admin/name-rules/' + rule.id, { method: 'DELETE', headers: nrAuthHeaders() });
      const data = await res.json();
      if (!data.ok) { showToast(data.message || 'Nem sikerült törölni.', true); return; }
      nameRules = nameRules.filter((r) => r.id !== rule.id);
      renderNameRules();
    } catch {
      showToast('Nem sikerült elérni a szervert.', true);
    }
  }
});
document.querySelector('.view[data-view="nameRules"]').addEventListener('change', async (e) => {
  const toggle = e.target.closest('[data-nr-toggle]');
  if (!toggle) return;
  const id = Number(toggle.dataset.nrToggle);
  try {
    const res = await fetch(BACKEND_URL + '/api/admin/name-rules/' + id, {
      method: 'PUT', headers: nrAuthHeaders(true), body: JSON.stringify({ enabled: toggle.checked })
    });
    const data = await res.json();
    if (!data.ok) { toggle.checked = !toggle.checked; showToast(data.message || 'Nem sikerült menteni.', true); return; }
    nameRules = nameRules.map((r) => (r.id === id ? data.rule : r));
    renderNameRules();
  } catch {
    toggle.checked = !toggle.checked;
    showToast('Nem sikerült elérni a szervert.', true);
  }
});
syncNameRuleForm();

// ---------------------------------------------------------------------------
// Játékosprofil: kiegészítők panel (mindenki láthatja)
// ---------------------------------------------------------------------------

let profileCosmeticsToken = 0;

async function loadProfileCosmetics(username) {
  const grid = $('#playerProfileCosmetics');
  const countEl = $('#playerProfileCosmeticsCount');
  const myToken = ++profileCosmeticsToken;
  countEl.textContent = '';
  grid.innerHTML = '<div class="skeleton skeleton-card"></div>';
  let items = [];
  try {
    const res = await fetch(BACKEND_URL + '/api/cosmetics/owned/' + encodeURIComponent(username));
    const data = await res.json();
    items = data.ok && Array.isArray(data.items) ? data.items : [];
  } catch {
    items = null;
  }
  if (myToken !== profileCosmeticsToken) return;
  if (items === null) {
    grid.innerHTML = '<p class="redeem-result">Nem sikerült betölteni a kiegészítőket.</p>';
    return;
  }
  const active = items.filter((c) => c.equipped).length;
  countEl.innerHTML = items.length
    ? `<span>${items.length} db</span><span class="pc-count-active">${active} aktív</span>`
    : '';
  if (!items.length) {
    grid.innerHTML = '<div class="pc-empty"><span class="pc-empty-icon" aria-hidden="true">✦</span>Ennek a játékosnak még nincs egyetlen kiegészítője sem.</div>';
    return;
  }
  grid.innerHTML = items.map((c, i) => `
    <div class="pc-item rarity-${escapeHtml(c.rarity)}${c.equipped ? ' is-active' : ''}" style="--i:${i}">
      <div class="pc-thumb">${c.hasModel ? cosmeticThumbHtml(c) : '<div class="cosmetic-thumb cosmetic-thumb-empty"></div>'}</div>
      <div class="pc-info">
        <div class="pc-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
        <div class="pc-tags">
          <span class="cosmetic-tag">${escapeHtml(c.slotLabel)}</span>
          <span class="cosmetic-tag rarity">${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}</span>
        </div>
        <div class="pc-status ${c.equipped ? 'on' : 'off'}">
          <span class="pc-dot" aria-hidden="true"></span>${c.equipped ? 'Aktiválva' : 'Nincs aktiválva'}
          ${c.expiresAt ? `<span class="pc-expiry">· ${cosmeticExpiryHtml(c.expiresAt)}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
  hydrateCosmeticThumbs(grid);
}


tryAutoLogin();

let nameSuggestSeq = 0;
const suggestFaceCache = new Map();

async function drawSuggestFace(canvas, player) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const key = player.username.toLowerCase();
  if (!suggestFaceCache.has(key)) {
    suggestFaceCache.set(key, player.hasSkin ? loadSkinImage(player.username) : Promise.resolve(null));
    if (suggestFaceCache.size > 200) suggestFaceCache.delete(suggestFaceCache.keys().next().value);
  }
  const img = await suggestFaceCache.get(key);
  if (!canvas.isConnected) return;
  if (img) drawSkinFace(ctx, img, canvas.width);
  else await drawFallbackFace(ctx, canvas.width);
}

function attachNameSuggest(input, onPick) {
  if (!input || input.__nameSuggest) return;
  input.__nameSuggest = true;
  const listId = 'nameSuggest' + (++nameSuggestSeq);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);

  const box = document.createElement('div');
  box.className = 'name-suggest';
  box.id = listId;
  box.setAttribute('role', 'listbox');
  box.hidden = true;
  document.body.appendChild(box);

  let items = [];
  let active = -1;
  let requestSeq = 0;
  let timer = null;

  const place = () => {
    const r = input.getBoundingClientRect();
    box.style.left = Math.round(r.left) + 'px';
    box.style.top = Math.round(r.bottom + 6) + 'px';
    box.style.width = Math.round(Math.max(r.width, 200)) + 'px';
  };
  const hide = () => {
    box.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };
  const highlight = (name, q) => {
    const i = name.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return escapeHtml(name);
    return escapeHtml(name.slice(0, i)) + '<b>' + escapeHtml(name.slice(i, i + q.length)) + '</b>' + escapeHtml(name.slice(i + q.length));
  };
  const setActive = (i) => {
    active = i;
    $$('.name-suggest-item', box).forEach((el, idx) => {
      el.classList.toggle('is-active', idx === i);
      el.setAttribute('aria-selected', idx === i ? 'true' : 'false');
    });
    if (i >= 0) {
      input.setAttribute('aria-activedescendant', `${listId}-${i}`);
      const el = $(`#${listId}-${i}`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };
  const pick = (i) => {
    const p = items[i];
    if (!p) return;
    input.value = p.username;
    hide();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    hide();
    if (onPick) onPick(p.username);
  };
  const render = (q) => {
    if (!items.length || document.activeElement !== input) { hide(); return; }
    if (items.length === 1 && items[0].username.toLowerCase() === q.toLowerCase()) { hide(); return; }
    box.innerHTML = items.map((p, i) => `
      <div class="name-suggest-item" id="${listId}-${i}" role="option" aria-selected="false" data-index="${i}">
        <canvas class="name-suggest-face" width="20" height="20" data-suggest-face="${i}"></canvas>
        <span>${highlight(p.username, q)}</span>
      </div>`).join('');
    $$('[data-suggest-face]', box).forEach((c) => drawSuggestFace(c, items[Number(c.dataset.suggestFace)]));
    place();
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(-1);
  };
  const query = async (q) => {
    const my = ++requestSeq;
    try {
      const res = await fetch(BACKEND_URL + '/api/players/search?limit=8&q=' + encodeURIComponent(q));
      const data = await res.json();
      if (my !== requestSeq) return;
      items = data.ok && Array.isArray(data.players) ? data.players : [];
      render(q);
    } catch {
      if (my === requestSeq) hide();
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2 || !/^[A-Za-z0-9_]+$/.test(q)) { requestSeq++; hide(); return; }
    timer = setTimeout(() => query(q), 140);
  });
  input.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(items.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(-1, active - 1)); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hide(); }
    else if ((e.key === 'Enter' || e.key === 'Tab') && active >= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      pick(active);
    }
  }, { capture: true });
  input.addEventListener('blur', () => setTimeout(hide, 120));
  box.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.name-suggest-item');
    if (!item) return;
    e.preventDefault();
    pick(Number(item.dataset.index));
  });
  box.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.name-suggest-item');
    if (item && Number(item.dataset.index) !== active) setActive(Number(item.dataset.index));
  });
  window.addEventListener('resize', () => { if (!box.hidden) place(); });
  window.addEventListener('scroll', () => { if (!box.hidden) place(); }, true);
}

attachNameSuggest($('#transferRecipientInput'));
attachNameSuggest($('#tradeRecipientInput'));
attachNameSuggest($('#giftModalRecipient'));
attachNameSuggest($('#playerSearchInput'), () => $('#playerSearchBtn')?.click());
attachNameSuggest($('#purchaseLogsUserSearchInput'), () => $('#purchaseLogsUserSearchBtn')?.click());
attachNameSuggest($('#staffActionLogsUserSearchInput'), () => $('#staffActionLogsUserSearchBtn')?.click());
attachNameSuggest($('#permsPlayerSearchInput'), () => $('#permsPlayerSearchBtn')?.click());

async function loadClientSettingsState() {
  const state = $('#clientSettingsState');
  const btn = $('#btnResetClientSettings');
  if (!state || !session || !session.token) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/me/client-settings', { headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) throw new Error('bad');
    if (!data.exists) {
      state.textContent = 'Még nincs mentett beállításod - a SolarClient első indításakor automatikusan létrejön.';
      btn.classList.add('hidden');
      return;
    }
    const when = new Date(Number(data.updatedAt)).toLocaleString('hu-HU');
    state.innerHTML = `Utoljára mentve: <b>${escapeHtml(when)}</b> <span class="client-settings-rev">(${escapeHtml(String(data.revision))}. változat)</span>`;
    btn.classList.remove('hidden');
  } catch {
    state.textContent = 'Az állapot most nem tölthető be.';
    btn.classList.add('hidden');
  }
}

$('#btnResetClientSettings')?.addEventListener('click', async () => {
  const ok = await confirmModal(
    'Mentett kliens-beállítások törlése',
    'A fiókodhoz mentett beállítások törlődnek. A gépeden lévő beállításokat ez nem érinti: a következő indításkor az aktuális gép beállításai kerülnek fel újra a fiókodra.',
    'Igen, törlöm'
  );
  if (!ok) return;
  try {
    const res = await fetch(BACKEND_URL + '/api/me/client-settings', { method: 'DELETE', headers: { Authorization: 'Bearer ' + session.token } });
    const data = await res.json();
    if (!data.ok) { showToast('Nem sikerült törölni.', true); return; }
    showToast('A mentett beállítások törölve.');
    loadClientSettingsState();
  } catch {
    showToast('Nem sikerült elérni a szervert.', true);
  }
});
