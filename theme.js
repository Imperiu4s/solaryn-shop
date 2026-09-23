(function () {
  const STORAGE_KEY = 'solarcenter.theme';
  const THEMES = [
    { key: 'solaryn', label: 'Solaryn (alap)' },
    { key: 'ice', label: 'Jégkék' },
    { key: 'crimson', label: 'Bíbor' },
    { key: 'emerald', label: 'Smaragd' },
    { key: 'amethyst', label: 'Ametiszt' },
    { key: 'turquoise', label: 'Türkiz' }
  ];

  function getSavedTheme() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return THEMES.some((t) => t.key === v) ? v : 'solaryn';
    } catch {
      return 'solaryn';
    }
  }

  function applyTheme(key) {
    document.documentElement.setAttribute('data-theme', key);
  }

  applyTheme(getSavedTheme());

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('topbarThemeBtn');
    const dropdown = document.getElementById('topbarThemeDropdown');
    if (!btn || !dropdown) return;

    dropdown.innerHTML = THEMES.map((t) =>
      `<button type="button" class="topbar-theme-option" data-theme="${t.key}">${t.label}</button>`
    ).join('');

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
      applyTheme(key);
      try { localStorage.setItem(STORAGE_KEY, key); } catch {}
      dropdown.classList.add('hidden');
      btn.classList.remove('open');
    });
  });
})();
