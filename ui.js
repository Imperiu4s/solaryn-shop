/* ═══════════════════════════════════════════════════════════════════════
   ★ SOLARCENTER UI-RÉTEG (2026-09-03)
   ───────────────────────────────────────────────────────────────────────
   Az app.js UTÁN töltődik be, és SZÁNDÉKOSAN nem nyúl bele az ottani
   üzleti logikába: csak rátesz egy megjelenítési/interakciós réteget
   (mozgás, egérkövetés, mobil-fiók, süti-hozzájárulás, GYIK, hash-alapú
   mély-linkek). Ami mégis "beleszól" az app.js-be, azt csomagolással
   (wrapper) teszi - a globális switchView()/showToast() köré -, nem az
   eredeti kód átírásával, hogy az app.js frissítései ne ütközzenek ezzel.

   Tartalom:
     1.  Segédfüggvények
     2.  Belépő-animációk sorszámozása (--i)
     3.  Kártya-fényfolt (egérkövetés)
     4.  Kattintás-hullám (ripple)
     5.  Ragadós felső sáv árnyéka
     6.  Görgetésre megjelenő elemek
     7.  Számláló-animáció (count-up)
     8.  Mobil oldalsáv-fiók
     9.  Felső betöltés-csík (fetch-csomagolás)
     10. Értesítés (toast) ikonnal
     11. Nézetváltás: cím, görgetés, hash-mélylink
     12. GYIK (accordion) + keresés
     13. Süti-hozzájárulás (banner + kategóriák + beágyazás-zárolás)
     14. Űrlap-ellenőrzés segédek
     15. Külső linkek biztonsági kiegészítése
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── 1. Segédfüggvények ────────────────────────────────────────────── */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motionQuery.matches;

  // A backend címét az app.js már definiálta (BACKEND_URL). Az `typeof`
  // őrfeltétel arra az esetre szól, ha az app.js valamiért nem töltött be:
  // a mérés hiánya miatt semmiképp ne dőljön el az egész ui.js.
  const BACKEND_ORIGIN = (typeof BACKEND_URL === 'string' && BACKEND_URL) || 'https://api.overclockgame.hu:8908';

  /* ── 2. Belépő-animációk sorszámozása ───────────────────────────────────
     A CSS `animation-delay: calc(var(--i) * Xms)`-t használ a lépcsőzetes
     belépéshez. Az indexet itt osztjuk ki, mert a legtöbb ilyen lista
     (menü, statisztika-jelvények) futásidőben, JS-ből épül fel, tehát egy
     CSS :nth-child() sorozat nem lenne karbantartható. */
  function setStaggerIndexes(root) {
    const scope = root || document;
    ['.app-nav-item', '.app-nav-divider'].forEach((sel) => {
      $$(sel, scope).forEach((el, i) => el.style.setProperty('--i', i));
    });
    $$('.stat-badge', scope).forEach((el, i) => el.style.setProperty('--i', i));
  }

  /* ── 3. Kártya-fényfolt ─────────────────────────────────────────────────
     Egyetlen, delegált pointermove figyelő az egész dokumentumon (nem
     kártyánként egy) - a koordinátákat requestAnimationFrame-ben írjuk ki,
     így egérmozgásonként legfeljebb egy stílus-írás történik. Érintésen
     (pointer: coarse) teljesen kihagyjuk: ott nincs "hover", csak fölösleges
     munkát adna. */
  function initCardSpotlight() {
    if (window.matchMedia('(pointer: coarse)').matches || reduced()) return;
    let pending = null;
    let lastCard = null;

    document.addEventListener('pointermove', (e) => {
      const card = e.target.closest && e.target.closest('.card:not(.card-static)');
      if (card !== lastCard && lastCard) lastCard.style.setProperty('--spot', '0');
      lastCard = card;
      if (!card) return;
      pending = { card, x: e.clientX, y: e.clientY };
      if (pending.queued) return;
      pending.queued = true;
      requestAnimationFrame(() => {
        if (!pending) return;
        const { card: c, x, y } = pending;
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', ((x - r.left) / r.width * 100).toFixed(1) + '%');
        c.style.setProperty('--my', ((y - r.top) / r.height * 100).toFixed(1) + '%');
        c.style.setProperty('--spot', '1');
        pending = null;
      });
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
      if (lastCard) { lastCard.style.setProperty('--spot', '0'); lastCard = null; }
    }, { passive: true });
  }

  /* ── 4. Kattintás-hullám (ripple) ───────────────────────────────────────
     Delegált, tehát a futásidőben generált gombokon (vásárlás, admin
     listák) is működik, újrakötés nélkül. */
  function initRipples() {
    document.addEventListener('pointerdown', (e) => {
      if (reduced()) return;
      const btn = e.target.closest && e.target.closest(
        '.btn-glow, .btn-outline, .btn-buy, .btn-discord, .legal-tab, .perms-mode-tab, .faq-q'
      );
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.width = span.style.height = size + 'px';
      span.style.left = (e.clientX - r.left) + 'px';
      span.style.top = (e.clientY - r.top) + 'px';
      btn.appendChild(span);
      setTimeout(() => span.remove(), 620);
    }, { passive: true });
  }

  /* ── 5. Ragadós felső sáv árnyéka ──────────────────────────────────── */
  function initTopbarScroll() {
    const bar = $('.app-topbar');
    if (!bar) return;
    const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── 6. Görgetésre megjelenő elemek ─────────────────────────────────────
     A .reveal osztályt a nézetváltáskor tesszük rá a hajtás alatti
     kártyákra; az observer egyszer old fel egy elemet, aztán elengedi. */
  let revealObserver = null;
  function initReveal() {
    if (!('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('revealed');
        revealObserver.unobserve(el);
        // A .reveal/.revealed párost a lefutás UTÁN levesszük. Enélkül a
        // `forwards` kitöltésű animáció záró képkockája (transform: none)
        // tartósan felülírná a kártya hover-emelkedését - a CSS-kaszkádban
        // ugyanis egy futó/kitöltő animáció erősebb minden sima szabálynál.
        el.addEventListener('animationend', () => {
          el.classList.remove('reveal', 'revealed');
        }, { once: true });
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  }
  function applyReveal(view) {
    if (!revealObserver || reduced()) return;
    // Csak a HAJTÁS ALATTI kártyákat rejtjük el induláskor - ami eleve
    // látszik, azt a .view belépő-animációja már megmozgatja, egy második
    // (reveal) animáció rajta csak villogásnak látszana.
    const fold = window.innerHeight * 0.92;
    $$('.card, .info-box', view).forEach((el, i) => {
      if (el.dataset.revealDone) return;
      if (el.getBoundingClientRect().top < fold) return;
      el.dataset.revealDone = '1';
      el.style.setProperty('--i', i % 4);
      el.classList.add('reveal');
      revealObserver.observe(el);
    });
  }
  /* ── 8. Mobil oldalsáv-fiók ─────────────────────────────────────────── */
  let closeDrawer = () => {};
  function initMobileDrawer() {
    const sidebar = $('.app-sidebar');
    const topbar = $('.app-topbar');
    if (!sidebar || !topbar) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mobile-menu-btn';
    btn.id = 'mobileMenuBtn';
    btn.setAttribute('aria-label', 'Menü megnyitása');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'appSidebar');
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16"/></svg>';
    topbar.insertBefore(btn, topbar.firstChild);

    const scrim = document.createElement('div');
    scrim.className = 'sidebar-scrim';
    scrim.setAttribute('aria-hidden', 'true');
    // FONTOS: az elsötétítő réteg az APP-HÉJBA kerül, nem a <body>-ba. A
    // style.css az .app-shell-nek `z-index: 1`-et ad, ami saját rétegzési
    // környezetet (stacking context) nyit - az oldalsáv `z-index: 30`-a
    // tehát csak AZON BELÜL érvényes. Egy <body> alatti, 29-es réteg így a
    // teljes app-héjra (annak 1-es szintjére) ült volna rá, és elsötétítette
    // volna magát a kinyitott menüt is.
    (document.querySelector('.app-shell') || document.body).appendChild(scrim);

    const open = () => {
      sidebar.classList.add('open');
      scrim.classList.add('visible');
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      const first = sidebar.querySelector('.app-nav-item');
      if (first) first.focus({ preventScroll: true });
    };
    closeDrawer = () => {
      if (!sidebar.classList.contains('open')) return;
      sidebar.classList.remove('open');
      scrim.classList.remove('visible');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    btn.addEventListener('click', () => (sidebar.classList.contains('open') ? closeDrawer() : open()));
    scrim.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
    // Asztali méretre visszaváltva a fiók-állapot nem maradhat "beragadva".
    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) closeDrawer(); });
  }

  /* ── 9. Felső betöltés-csík ─────────────────────────────────────────────
     A window.fetch köré tett burok számolja a folyamatban lévő kéréseket.
     Az app.js `fetch(...)`-et hív, ami hívásidőben oldódik fel a globális
     objektumon, tehát a csomagolás visszamenőleg is érvényes rá. */
  function initTopProgress() {
    const bar = document.createElement('div');
    bar.className = 'top-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    let inflight = 0;
    let timer = null;
    const start = () => {
      if (inflight++ > 0) return;
      clearTimeout(timer);
      bar.classList.add('active');
      bar.style.width = '0';
      requestAnimationFrame(() => { bar.style.width = '72%'; });
    };
    const done = () => {
      if (--inflight > 0) return;
      inflight = 0;
      bar.style.width = '100%';
      timer = setTimeout(() => {
        bar.classList.remove('active');
        setTimeout(() => { if (inflight === 0) bar.style.width = '0'; }, 300);
      }, 220);
    };

    const nativeFetch = window.fetch.bind(window);
    window.fetch = function (...args) {
      start();
      return nativeFetch(...args).finally(done);
    };
  }

  /* ── 10. Értesítés (toast) ikonnal ──────────────────────────────────────
     Az app.js showToast()-ját csomagoljuk: ugyanaz a hívási felület
     (üzenet, hiba-e), csak a felépített DOM lesz gazdagabb + kap egy
     aria-live régiót, hogy képernyőolvasó is felolvassa. */
  const ICON_OK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M4 12.5l5.2 5.2L20 7"/></svg>';
  const ICON_ERR = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>';
  function initToast() {
    if (typeof window.showToast !== 'function') return;
    window.showToast = function (message, isError) {
      const el = document.createElement('div');
      el.className = 'shop-toast' + (isError ? ' shop-toast-error' : '');
      el.setAttribute('role', isError ? 'alert' : 'status');
      el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
      const icon = document.createElement('span');
      icon.className = 'shop-toast-icon';
      icon.innerHTML = isError ? ICON_ERR : ICON_OK;
      const text = document.createElement('span');
      text.textContent = message;
      el.append(icon, text);
      document.body.appendChild(el);
      // Ld. showBanner megjegyzését: háttérben lévő fülön a rAF nem fut le,
      // és az értesítés láthatatlan maradna.
      void el.offsetWidth;
      el.classList.add('visible');
      setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 340);
      }, 4500);
    };
  }

  /* ── 11. Nézetváltás: görgetés, hash-mélylink ────────────────────────────
     A böngésző fül-címét SZÁNDÉKOSAN nem írjuk át fülváltáskor - a
     felhasználó kérésére a fülre húzott kurzor fölötti buboréknak
     egyszerűen "SolarCenter"-t kell mutatnia, mindegy, melyik nézetben
     jár (ld. index.html <title>, ez itt már csak a hash/görgetés). A
     #hash viszont megmarad: megoszthatóvá/könyvjelzőzhetővé teszi az
     egyes füleket, és a vissza gomb is a fülek közt lépked vele. */
  let applyingHash = false;

  function initViewWrapper() {
    if (typeof window.switchView !== 'function') return;
    const original = window.switchView;
    window.switchView = function (view) {
      original(view);
      closeDrawer();
      // A tartalom tetejére ugrunk - a hosszabb füleken (Napló, Piac) e
      // nélkül a felhasználó a régi görgetési pozíción, egy nézet közepén
      // találná magát.
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      if (!applyingHash) {
        const hash = view === 'home' ? '' : '#' + view;
        if (window.location.hash !== hash) {
          history.pushState({ view }, '', window.location.pathname + window.location.search + hash);
        }
      }
      const active = $('.view.active');
      if (active) {
        applyReveal(active);
        setStaggerIndexes(active);
      }
    };

    // Egy nézetre csak akkor váltunk hash-ből, ha a felhasználó tényleg
    // hozzáfér - különben egy megosztott admin-link üres oldalt mutatna.
    const canOpen = (view) => {
      const btn = $('.app-nav-item[data-view="' + view + '"]');
      if (btn) return !btn.classList.contains('hidden');
      return !!$('.view[data-view="' + view + '"]');
    };
    const applyHash = () => {
      const shell = $('#appScreen');
      if (!shell || shell.classList.contains('hidden')) return;
      const view = (window.location.hash || '').replace(/^#/, '');
      applyingHash = true;
      try {
        if (!view) window.switchView('home');
        else if (canOpen(view)) window.switchView(view);
      } finally { applyingHash = false; }
    };
    window.addEventListener('popstate', applyHash);
    window.addEventListener('hashchange', applyHash);
    // Bejelentkezés után (amikor az app-héj láthatóvá válik) egyszer
    // alkalmazzuk a belépéskori hash-t - így egy megosztott mélylink a
    // bejelentkezésen keresztül is a helyes fülre érkezik.
    const shell = $('#appScreen');
    if (shell) {
      new MutationObserver(() => {
        if (shell.classList.contains('hidden') || shell.dataset.hashApplied) return;
        shell.dataset.hashApplied = '1';
        setStaggerIndexes();
        setTimeout(applyHash, 60);
      }).observe(shell, { attributes: true, attributeFilter: ['class'] });
    }
  }

  /* ── 12. GYIK (accordion) + keresés ─────────────────────────────────── */
  function initFaq() {
    const list = $('#faqList');
    if (!list) return;
    list.addEventListener('click', (e) => {
      const q = e.target.closest('.faq-q');
      if (!q) return;
      const item = q.closest('.faq-item');
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    const search = $('#faqSearch');
    if (!search) return;
    const empty = $('#faqEmpty');
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      $$('.faq-item', list).forEach((item) => {
        const hit = !q || item.textContent.toLowerCase().includes(q);
        item.hidden = !hit;
        if (hit) shown++;
        // Keresésnél nyitva mutatjuk a találatot, hogy a keresett szöveg
        // tényleg látszódjon is.
        if (q && hit) item.classList.add('open');
        else if (!q) item.classList.remove('open');
      });
      if (empty) empty.hidden = shown > 0;
    });
  }

  /* ── 13. Süti-hozzájárulás ──────────────────────────────────────────────
     Három kategória. A "necessary" nem kapcsolható ki: ebbe tartozik a
     bejelentkezés fenntartása és a felhasználó SAJÁT, kifejezett kérésére
     elmentett téma-választás is - ezek az ePrivacy szerint hozzájárulás
     nélkül is használhatók, mert a kifejezetten kért szolgáltatás
     nyújtásához kellenek, és sem követésre, sem profilozásra nem alkalmasak.

     A döntés a localStorage-ban él, verziószámmal: ha a kategóriák köre
     később bővül, a CONSENT_VERSION emelésével újra megkérdezzük a
     felhasználót, ahogy a GDPR megkívánja.

     A hozzájárulás VALÓDI következménnyel jár - ez a lényeg, enélkül a sáv
     csak díszlet lenne:
       - embeds    -> a Discord-widget iframe CSAK ekkor töltődik be (addig
                      helyőrző + "Betöltés" gomb áll a helyén, tehát a
                      Discord szervere el sem éri a látogatót),
       - analytics -> csak ekkor indul el a névtelen látogatás-mérés. */
  const CONSENT_KEY = 'solarcenter_cookies';
  const CONSENT_VERSION = 2;
  const DEFAULT_CONSENT = { necessary: true, analytics: false, embeds: false };

  function readConsent() {
    try {
      const raw = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
      if (!raw) return null;
      // Migráció a régi, egykategóriás formátumról ({analytics:bool}) - a
      // korábbi döntést tiszteletben tartjuk, de a most bevezetett új
      // kategóriákra (embeds/preferences) újra rá kell kérdezni, ezért nem
      // adjuk vissza érvényes hozzájárulásként.
      if (raw.v !== CONSENT_VERSION) return null;
      return Object.assign({}, DEFAULT_CONSENT, raw, { necessary: true });
    } catch { return null; }
  }
  function writeConsent(c) {
    const payload = Object.assign({}, DEFAULT_CONSENT, c, {
      necessary: true, v: CONSENT_VERSION, ts: new Date().toISOString()
    });
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(payload)); } catch { /* privát mód */ }
    window.solarConsent = payload;
    applyConsent(payload);
    document.dispatchEvent(new CustomEvent('solar:consent', { detail: payload }));
    return payload;
  }
  window.getSolarConsent = () => window.solarConsent || readConsent() || DEFAULT_CONSENT;

  function applyConsent(c) {
    // Beágyazott külső tartalom (Discord widget).
    $$('[data-embed-src]').forEach((ph) => {
      if (c.embeds) loadEmbed(ph);
    });
    // Névtelen statisztika - a modul csak hozzájárulás után indul el.
    if (c.analytics) startAnalytics();
  }

  function loadEmbed(ph) {
    if (ph.dataset.embedLoaded) return;
    ph.dataset.embedLoaded = '1';
    const frame = document.createElement('iframe');
    frame.src = ph.dataset.embedSrc;
    frame.title = ph.dataset.embedTitle || 'Beágyazott tartalom';
    frame.className = ph.dataset.embedClass || '';
    frame.width = '100%';
    frame.height = ph.dataset.embedHeight || '420';
    frame.loading = 'lazy';
    frame.setAttribute('frameborder', '0');
    frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts');
    ph.replaceWith(frame);
  }

  function initCookies() {
    const banner = $('#cookieBanner');
    const modal = $('#cookieModal');
    if (!modal) return;

    const boxes = {
      analytics: $('#cookieAnalytics'),
      embeds: $('#cookieEmbeds')
    };
    const fill = (c) => Object.keys(boxes).forEach((k) => { if (boxes[k]) boxes[k].checked = !!c[k]; });
    const collect = () => {
      const out = {};
      Object.keys(boxes).forEach((k) => { out[k] = !!(boxes[k] && boxes[k].checked); });
      return out;
    };

    const showBanner = () => {
      if (!banner) return;
      banner.hidden = false;
      // A .visible osztály SZÁNDÉKOSAN nem requestAnimationFrame-ben kerül
      // fel: a rAF háttérben lévő böngészőfülön egyáltalán nem fut le, és
      // akkor a sáv a `hidden` levétele után is opacity: 0 maradna - vagyis
      // a felhasználó soha nem látná meg a hozzájárulás-kérőt. A kényszerített
      // újraelrendezés (offsetWidth olvasása) ugyanúgy rögzíti az animáció
      // kiinduló állapotát, de fülállapottól függetlenül megtörténik.
      void banner.offsetWidth;
      banner.classList.add('visible');
    };
    const hideBanner = () => {
      if (!banner) return;
      banner.classList.remove('visible');
      setTimeout(() => { banner.hidden = true; }, 500);
    };

    const openModal = () => { fill(window.getSolarConsent()); modal.classList.remove('hidden'); };
    const closeModal = () => {
      modal.classList.add('modal-closing');
      setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('modal-closing'); }, 200);
    };

    const settingsLink = $('#btnCookieSettings');
    if (settingsLink) settingsLink.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    const accept = (c) => { writeConsent(c); hideBanner(); closeModal(); };
    const ALL = { analytics: true, embeds: true };
    const NONE = { analytics: false, embeds: false };

    [['#cookieAcceptAll', ALL], ['#cookieRejectAll', NONE], ['#cookieBannerAccept', ALL], ['#cookieBannerReject', NONE]]
      .forEach(([sel, val]) => { const b = $(sel); if (b) b.addEventListener('click', () => accept(val)); });
    const saveBtn = $('#cookieSaveBtn');
    if (saveBtn) saveBtn.addEventListener('click', () => accept(collect()));
    const bannerSettings = $('#cookieBannerSettings');
    if (bannerSettings) bannerSettings.addEventListener('click', () => openModal());

    const existing = readConsent();
    if (existing) { window.solarConsent = existing; applyConsent(existing); }
    else { window.solarConsent = Object.assign({}, DEFAULT_CONSENT); setTimeout(showBanner, 900); }
    fill(window.getSolarConsent());
  }

  /* Névtelen látogatás-mérés. SZÁNDÉKOSAN nem harmadik fél (Google
     Analytics stb.), hanem a SAJÁT backendünk (ld. SolarBackend
     src/analytics.js): nincs kereszt-oldali azonosító, nincs IP-alapú
     profilozás, és az adat nem hagyja el a rendszert. Az azonosító a lap
     bezárásáig él (sessionStorage), véletlenszerű, és a szerver azt is csak
     naponta forgó kulccsal hashelve tárolja - vagyis két különböző napon
     ugyanaz a látogató nem köthető össze.

     A modul CSAK az `analytics` süti-kategória elfogadása után indul el
     (ld. applyConsent). */
  const SOLAR_ANALYTICS_ENDPOINT = BACKEND_ORIGIN + '/api/analytics/collect';
  let analyticsStarted = false;
  function startAnalytics() {
    if (analyticsStarted) return;
    analyticsStarted = true;
    let sid;
    try {
      sid = sessionStorage.getItem('solar_sid');
      if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('solar_sid', sid); }
    } catch { sid = 'anon'; }

    const send = (event, data) => {
      const body = JSON.stringify(Object.assign({
        sid, event, path: location.pathname + location.hash,
        ref: document.referrer ? new URL(document.referrer).origin : '',
        vw: window.innerWidth, ts: Date.now()
      }, data || {}));
      if (!SOLAR_ANALYTICS_ENDPOINT) return;
      try {
        // A tartalomtípus SZÁNDÉKOSAN "text/plain", nem "application/json":
        // az utóbbi nem CORS-biztonságos érték, ezért a böngésző előellenőrző
        // (preflight OPTIONS) kérést küldene - amit viszont a sendBeacon nem
        // tud végrehajtani, így a mérés néma hibával elveszne. A szerver
        // ezért nyers szövegként veszi át és maga parse-olja
        // (ld. SolarBackend src/analytics.js).
        if (navigator.sendBeacon) navigator.sendBeacon(SOLAR_ANALYTICS_ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        else fetch(SOLAR_ANALYTICS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body, keepalive: true });
      } catch { /* a mérés soha nem törheti el az oldalt */ }
    };
    send('pageview');
    window.addEventListener('hashchange', () => send('pageview'), { passive: true });
    window.addEventListener('pagehide', () => send('leave', { dur: Math.round(performance.now() / 1000) }));
  }

  /* ── 14. Űrlap-ellenőrzés segédek ───────────────────────────────────────
     Globálisan elérhető, hogy az app.js validációi is használhassák; a
     mező-szintű hibajelzés (piros keret + rázás + magyarázó szöveg)
     lényegesen egyértelműbb, mint az űrlap alján egyetlen közös hibasor. */
  // A hibaüzenet HOVA kerüljön: a jelszómezőket az initPasswordToggles egy
  // .pw-field-wrap-be csomagolja (az üzenet a wrapper UTÁN kell jöjjön, nem
  // a szem-ikon mellé), a jelölőnégyzetek pedig egy <label class="check-row">
  // BELSEJÉBEN vannak (ott az üzenet a címke szövegének a KÖZEPÉBE esne).
  const errorHolder = (el) => el.closest('.pw-field-wrap') || el.closest('label.check-row') || el;

  window.markFieldInvalid = function (el, message) {
    if (!el) return;
    el.classList.add('field-invalid');
    el.setAttribute('aria-invalid', 'true');
    const holder = errorHolder(el);
    let msg = holder.nextElementSibling;
    if (!msg || !msg.classList.contains('field-error-msg')) {
      msg = null;
      if (message) {
        msg = document.createElement('p');
        msg.className = 'field-error-msg';
        holder.insertAdjacentElement('afterend', msg);
      }
    }
    if (msg) {
      msg.textContent = message || '';
      // A mezőhöz kötjük, hogy a képernyőolvasó a mező fókuszálásakor
      // felolvassa a hibaüzenetet is, ne csak a mező nevét.
      if (!msg.id) msg.id = 'fe-' + Math.random().toString(36).slice(2, 9);
      el.setAttribute('aria-describedby', msg.id);
    }

    const clear = () => {
      el.classList.remove('field-invalid');
      el.removeAttribute('aria-invalid');
      el.removeAttribute('aria-describedby');
      const m = errorHolder(el).nextElementSibling;
      if (m && m.classList.contains('field-error-msg')) m.remove();
      el.removeEventListener('input', clear);
      el.removeEventListener('change', clear);
    };
    el.addEventListener('input', clear);
    el.addEventListener('change', clear);
  };
  window.setButtonLoading = function (btn, on) {
    if (!btn) return;
    btn.classList.toggle('is-loading', !!on);
    btn.disabled = !!on;
    if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
  };

  /* ── 15. Külső linkek biztonsági kiegészítése ───────────────────────────
     Minden target="_blank" link kap rel="noopener noreferrer"-t, akkor is,
     ha futásidőben, sablonból került a DOM-ba (reverse tabnabbing ellen). */
  function hardenExternalLinks(root) {
    $$('a[target="_blank"]', root || document).forEach((a) => {
      const rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      if (!rel.includes('noopener')) rel.push('noopener');
      if (!rel.includes('noreferrer')) rel.push('noreferrer');
      a.setAttribute('rel', rel.join(' '));
    });
  }

  /* ── 15/b. Modál fókusz-csapda ──────────────────────────────────────────
     Egy megnyitott modálból a TAB eddig kivitte a fókuszt a mögötte lévő,
     letakart oldalra: a billentyűzettel navigáló felhasználó "elveszett"
     egy olyan felületen, amit nem is lát (WCAG 2.1.2, "nincs billentyűzet-
     csapda" ELLENkezője: itt épp a csapda a helyes viselkedés modálnál).

     Egyetlen, delegált keydown-figyelő az egész dokumentumon - így a
     futásidőben létrehozott modálokra is érvényes, és nem kell minden
     megnyitáshoz be-/kikötni. A nyitott modált a `.modal-overlay:not(.hidden)`
     azonosítja, ami a projekt meglévő megnyitási/bezárási mintája. */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function initModalFocusTrap() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const open = $('.modal-overlay:not(.hidden)');
      if (!open) return;
      const items = $$(FOCUSABLE, open).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Ha a fókusz kívülről érkezne (pl. a modál megnyitása után még a
      // háttéren áll), az első TAB már a modálba visz.
      if (!open.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── 16. Apró bekötések ─────────────────────────────────────────────── */
  function initMisc() {
    // Lábléc / szövegközi "ugorj erre a fülre" linkek.
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('[data-view-link]');
      if (!a) return;
      e.preventDefault();
      if (typeof window.switchView === 'function') window.switchView(a.dataset.viewLink);
    });

    // "Beágyazott tartalom engedélyezése" a Discord-widget helyőrzőjén: a
    // hozzájárulást csak erre az EGY kategóriára állítja át, a többit
    // érintetlenül hagyja.
    const enableEmbeds = $('#btnEnableEmbeds');
    if (enableEmbeds) {
      enableEmbeds.addEventListener('click', () => {
        const c = Object.assign({}, window.getSolarConsent(), { embeds: true });
        writeConsent(c);
        const banner = $('#cookieBanner');
        if (banner && !banner.hidden) { banner.classList.remove('visible'); setTimeout(() => { banner.hidden = true; }, 500); }
      });
    }
  }

  /* ── Indítás ────────────────────────────────────────────────────────── */
  function boot() {
    setStaggerIndexes();
    initCardSpotlight();
    initRipples();
    initTopbarScroll();
    initReveal();
    initMobileDrawer();
    initTopProgress();
    initToast();
    initViewWrapper();
    initFaq();
    initCookies();
    initModalFocusTrap();
    initMisc();
    hardenExternalLinks();
    // A futásidőben beszúrt linkeket is lefedjük, kattintás-időben.
    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a[target="_blank"]');
      if (a) hardenExternalLinks(a.parentElement || document);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
