(function () {
  const STORAGE_KEY = 'solarcenter.theme';
  // A szezonális téma bekapcsolása előtti téma: ide váltunk vissza, ha a szezon véget ér.
  const PREV_KEY = 'solarcenter.theme.beforeSeason';
  // Az utolsó lekért szezonális lista: induláskor ebből dolgozunk, így nem villan.
  const SEASON_CACHE_KEY = 'solarcenter.seasonal';
  // Melyik élesítésnél kapcsoltuk már be automatikusan (kulcs + élesítés ideje).
  const AUTO_KEY_PREFIX = 'solarcenter.seasonAuto.';
  const BACKEND = 'https://api.solaryn.hu:25572';
  const NEW_BADGE_DAYS = 14;

  const THEMES = [
    { key: 'solaryn', label: 'Solaryn sötét' },
    { key: 'solaryn-light', label: 'Solaryn világos' },
    { key: 'ice', label: 'Jégkék' },
    { key: 'crimson', label: 'Bíbor' },
    { key: 'emerald', label: 'Smaragd' },
    { key: 'amethyst', label: 'Ametiszt' },
    { key: 'turquoise', label: 'Türkiz' }
  ];
  // A szezonális témák kinézete a seasonal.css-ben van; hogy melyik él, azt a backend mondja meg.
  const SEASONAL_KEYS = ['halloween', 'christmas', 'newyear', 'valentine', 'carnival', 'easter', 'national', 'summer'];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };

  function readCache() {
    try {
      const list = JSON.parse(store.get(SEASON_CACHE_KEY) || '[]');
      return Array.isArray(list) ? list.filter((t) => t && SEASONAL_KEYS.includes(t.key)) : [];
    } catch {
      return [];
    }
  }

  let seasonal = readCache();
  let previewKey = null;
  let previewLabel = null;

  const isSeasonal = (key) => SEASONAL_KEYS.includes(key);
  const isAvailable = (key) => THEMES.some((t) => t.key === key) || seasonal.some((t) => t.key === key) || key === previewKey;

  function getSavedTheme() {
    const v = store.get(STORAGE_KEY);
    return v && isAvailable(v) ? v : 'solaryn';
  }

  function applyTheme(key) {
    document.documentElement.setAttribute('data-theme', key);
  }

  function setTheme(key) {
    const current = getSavedTheme();
    if (isSeasonal(key) && !isSeasonal(current)) store.set(PREV_KEY, current);
    applyTheme(key);
    store.set(STORAGE_KEY, key);
    renderDropdown();
  }

  applyTheme(getSavedTheme());

  function isNew(t) {
    if (t.mode !== 'live' || !t.activatedAt) return false;
    const at = new Date(t.activatedAt).getTime();
    return Number.isFinite(at) && Date.now() - at < NEW_BADGE_DAYS * 86400000;
  }

  function activeToken() {
    try {
      const accounts = JSON.parse(store.get('solarcenter_accounts') || '[]');
      const active = store.get('solarcenter_active_username');
      const acc = Array.isArray(accounts) ? accounts.find((a) => a.username === active) : null;
      return acc && acc.token ? acc.token : null;
    } catch {
      return null;
    }
  }

  // A friss szezonális lista alapján: automatikus bekapcsolás (élesítésenként
  // egyszer), illetve visszaváltás, ha a használt ünnepi téma már nem él.
  function reconcile() {
    for (const t of seasonal) {
      if (!t.autoApply || !t.activatedAt) continue;
      const flag = AUTO_KEY_PREFIX + t.key + '.' + t.activatedAt;
      if (store.get(flag)) continue;
      store.set(flag, '1');
      setTheme(t.key);
    }
    const saved = store.get(STORAGE_KEY);
    if (saved && isSeasonal(saved) && !isAvailable(saved)) {
      const prev = store.get(PREV_KEY);
      const fallback = prev && THEMES.some((t) => t.key === prev) ? prev : 'solaryn';
      store.del(PREV_KEY);
      applyTheme(fallback);
      store.set(STORAGE_KEY, fallback);
    }
  }

  async function refresh() {
    try {
      const token = activeToken();
      const res = await fetch(BACKEND + '/api/themes/seasonal', token ? { headers: { Authorization: 'Bearer ' + token } } : undefined);
      const data = await res.json();
      if (!data || !data.ok || !Array.isArray(data.themes)) return;
      seasonal = data.themes.filter((t) => t && isSeasonal(t.key));
      store.set(SEASON_CACHE_KEY, JSON.stringify(seasonal));
    } catch {
      return;
    }
    reconcile();
    applyTheme(getSavedTheme());
    renderDropdown();
  }

  function optionHtml(key, label, badge) {
    const current = getSavedTheme();
    return `<button type="button" class="topbar-theme-option${key === current ? ' active' : ''}" data-theme="${key}">`
      + `<span>${label}</span>${badge ? `<span class="topbar-theme-badge topbar-theme-badge-${badge.cls}">${badge.text}</span>` : ''}</button>`;
  }

  function renderDropdown() {
    const dropdown = document.getElementById('topbarThemeDropdown');
    if (!dropdown) return;
    const seasonalItems = seasonal.map((t) => optionHtml(t.key, t.label,
      t.mode === 'test' ? { cls: 'test', text: 'Teszt' } : (isNew(t) ? { cls: 'new', text: 'Új' } : null)));
    if (previewKey && !seasonal.some((t) => t.key === previewKey)) {
      seasonalItems.push(optionHtml(previewKey, previewLabel || previewKey, { cls: 'test', text: 'Előnézet' }));
    }
    dropdown.innerHTML = seasonalItems.join('')
      + (seasonalItems.length ? '<div class="topbar-theme-sep" role="separator"></div>' : '')
      + THEMES.map((t) => optionHtml(t.key, t.label, null)).join('');
  }

  // Admin előnézet: csak ebben a böngészőlapban, mentés nélkül.
  function preview(key, label) {
    if (!isSeasonal(key)) return;
    previewKey = key;
    previewLabel = label || key;
    applyTheme(key);
    renderDropdown();
  }
  function endPreview() {
    previewKey = null;
    previewLabel = null;
    applyTheme(getSavedTheme());
    renderDropdown();
  }

  window.SolarTheme = { refresh, preview, endPreview, current: () => document.documentElement.getAttribute('data-theme') };

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('topbarThemeBtn');
    const dropdown = document.getElementById('topbarThemeDropdown');
    if (!btn || !dropdown) return;

    renderDropdown();

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('hidden');
      btn.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      btn.classList.remove('open');
    });
    dropdown.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-theme]');
      if (!opt) return;
      e.stopPropagation();
      const key = opt.dataset.theme;
      if (key === previewKey && !seasonal.some((t) => t.key === key)) {
        applyTheme(key);
      } else {
        previewKey = null;
        setTheme(key);
      }
      dropdown.classList.add('hidden');
      btn.classList.remove('open');
    });

    refresh();
  });
})();
