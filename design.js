(function () {
  'use strict';

  // Szerkezeti díszítések a dizájnréteghez (design.css): minden nézet címét és
  // leírását egy "page-hero" fejlécbe csomagolja a menüpont ikonjával, és a
  // felső sávba morzsamenüt tesz. A meglévő elemek (és az id-jaik) csak
  // átkerülnek a fejlécbe, így az app.js továbbra is ugyanúgy megtalálja őket.

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const FALLBACK_ICON = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const LEGAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7" stroke-linecap="round"/></svg>';

  // Nézetek, amelyekhez nincs saját menüpont: melyik menüpont "alá" tartoznak.
  const PARENT_VIEW = {
    playerProfile: { view: 'players', label: 'Játékosprofil' },
    deviceDetail: { view: 'players', label: 'Eszköz részletei' },
    revenueDetail: { view: 'revenue', label: 'Havi részletek' },
    legal: { label: 'Jogi információk', icon: LEGAL_ICON, eyebrow: 'SolarCenter' }
  };

  function navInfo(view) {
    const btn = $(`.app-nav-item[data-view="${view}"]`);
    if (!btn) return null;
    const label = ($('span', btn) || btn).textContent.trim();
    const group = btn.closest('.app-nav-group');
    let icon = $(':scope > svg:not(.app-nav-caret)', btn);
    let groupLabel = '';
    if (group) {
      const head = $('.app-nav-group-head', group);
      groupLabel = head ? ($('span', head) || head).textContent.trim() : '';
      if (!icon && head) icon = $(':scope > svg:not(.app-nav-caret)', head);
    }
    return { label, groupLabel, iconHtml: icon ? icon.outerHTML : '' };
  }

  function viewMeta(view) {
    const direct = navInfo(view);
    if (direct) return direct;
    const parent = PARENT_VIEW[view];
    if (!parent) return { label: '', groupLabel: '', iconHtml: FALLBACK_ICON };
    const p = parent.view ? navInfo(parent.view) : null;
    return {
      label: parent.label,
      groupLabel: parent.eyebrow || (p ? (p.groupLabel ? p.groupLabel + ' · ' + p.label : p.label) : ''),
      iconHtml: parent.icon || (p && p.iconHtml) || FALLBACK_ICON
    };
  }

  // Lágy, modern nap: izzó mag, halvány korona, elmosott és elvékonyodó
  // sugarak két ellentétesen, lassan forgó rétegben. A színeket a téma
  // változóiból veszi, így minden színtémához igazodik.
  let sunSeq = 0;
  function sunSvg() {
    const id = 'sun' + (++sunSeq);
    const ray = (i, n, long, short, width) => {
      const len = i % 2 ? short : long;
      return `<path d="M200 200 L${200 - width} ${200 - 58} L200 ${200 - len} L${200 + width} ${200 - 58} Z" transform="rotate(${(360 / n) * i} 200 200)"/>`;
    };
    const raysA = Array.from({ length: 10 }, (_, i) => ray(i, 10, 198, 162, 17)).join('');
    const raysB = Array.from({ length: 14 }, (_, i) => ray(i, 14, 176, 136, 6)).join('');
    return `<svg class="sun-svg" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="${id}-core" cx="44%" cy="40%" r="62%">
          <stop offset="0" style="stop-color:#fffaf0"/>
          <stop offset=".38" style="stop-color:color-mix(in srgb, var(--gold) 55%, #fff)"/>
          <stop offset=".78" style="stop-color:var(--gold)"/>
          <stop offset="1" style="stop-color:var(--gold-2)"/>
        </radialGradient>
        <radialGradient id="${id}-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" style="stop-color:var(--gold);stop-opacity:.42"/>
          <stop offset=".4" style="stop-color:var(--gold);stop-opacity:.12"/>
          <stop offset="1" style="stop-color:var(--gold);stop-opacity:0"/>
        </radialGradient>
        <radialGradient id="${id}-ray" gradientUnits="userSpaceOnUse" cx="200" cy="200" r="200">
          <stop offset=".22" style="stop-color:color-mix(in srgb, var(--gold) 70%, #fff);stop-opacity:.42"/>
          <stop offset="1" style="stop-color:var(--gold);stop-opacity:0"/>
        </radialGradient>
        <filter id="${id}-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
        <filter id="${id}-fine" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>
        <filter id="${id}-haze" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
      </defs>
      <circle cx="200" cy="200" r="200" fill="url(#${id}-glow)"/>
      <g class="sun-rays sun-rays-a" fill="url(#${id}-ray)" filter="url(#${id}-soft)">${raysA}</g>
      <g class="sun-rays sun-rays-b" fill="url(#${id}-ray)" filter="url(#${id}-fine)" opacity=".55" transform="rotate(15 200 200)">${raysB}</g>
      <circle class="sun-halo" cx="200" cy="200" r="66" style="fill:var(--gold)" opacity=".35" filter="url(#${id}-haze)"/>
      <circle cx="200" cy="200" r="46" fill="url(#${id}-core)"/>
      <circle cx="200" cy="200" r="46" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>
    </svg>`;
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Szép éjszakát';
    if (h < 10) return 'Jó reggelt';
    if (h < 18) return 'Szép napot';
    return 'Jó estét';
  }

  function buildHero(section) {
    const title = $(':scope > .page-title', section);
    if (!title || section.querySelector(':scope > .page-hero')) return;
    const view = section.dataset.view;
    const meta = viewMeta(view);
    const note = title.nextElementSibling && title.nextElementSibling.classList.contains('page-note')
      ? title.nextElementSibling
      : null;

    const hero = document.createElement('header');
    hero.className = 'page-hero';
    hero.dataset.heroView = view;
    hero.innerHTML = `
      <div class="page-hero-sun" aria-hidden="true">${sunSvg()}</div>
      <div class="page-hero-icon" aria-hidden="true">${meta.iconHtml || FALLBACK_ICON}</div>
      <div class="page-hero-text">
        <div class="page-hero-eyebrow">${view === 'home' ? greeting() : (meta.groupLabel || 'SolarCenter')}</div>
      </div>`;
    section.insertBefore(hero, title);
    const text = $('.page-hero-text', hero);
    text.appendChild(title);
    if (note) text.appendChild(note);
    const icon = $('.page-hero-icon svg', hero);
    if (icon) icon.removeAttribute('class');
  }

  function buildCrumbs() {
    const topbar = $('.app-topbar');
    if (!topbar || $('.topbar-crumbs', topbar)) return null;
    const crumbs = document.createElement('nav');
    crumbs.className = 'topbar-crumbs';
    crumbs.setAttribute('aria-label', 'Hol vagy');
    const menuBtn = $('.mobile-menu-btn', topbar);
    topbar.insertBefore(crumbs, menuBtn ? menuBtn.nextSibling : topbar.firstChild);
    return crumbs;
  }

  function updateCrumbs(view) {
    const crumbs = $('.topbar-crumbs');
    if (!crumbs) return;
    const meta = viewMeta(view);
    const parts = [];
    if (meta.groupLabel) parts.push(`<span class="crumb crumb-group">${escapeText(meta.groupLabel)}</span>`);
    parts.push(`<span class="crumb crumb-current">${escapeText(meta.label || 'SolarCenter')}</span>`);
    crumbs.innerHTML = `<span class="crumb-icon" aria-hidden="true">${meta.iconHtml || FALLBACK_ICON}</span>` +
      parts.join('<span class="crumb-sep" aria-hidden="true">/</span>');
    crumbs.classList.remove('crumbs-enter');
    void crumbs.offsetWidth;
    crumbs.classList.add('crumbs-enter');
  }

  function escapeText(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function wrapSwitchView() {
    if (typeof window.switchView !== 'function' || window.switchView.__designWrapped) return;
    const original = window.switchView;
    const wrapped = function (view) {
      original(view);
      updateCrumbs(view);
    };
    wrapped.__designWrapped = true;
    window.switchView = wrapped;
  }

  function buildAuthSun() {
    $$('.auth-info-side').forEach((side) => {
      if ($('.auth-sun', side)) return;
      const sun = document.createElement('div');
      sun.className = 'auth-sun';
      sun.setAttribute('aria-hidden', 'true');
      sun.innerHTML = sunSvg();
      side.insertBefore(sun, side.firstChild);
    });
  }

  function boot() {
    buildAuthSun();
    $$('.app-content > .view').forEach(buildHero);
    buildCrumbs();
    wrapSwitchView();
    const active = $('.app-content > .view.active');
    updateCrumbs(active ? active.dataset.view : 'home');
    document.documentElement.classList.add('design-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
