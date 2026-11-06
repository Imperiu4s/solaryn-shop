/* A SolarCenter kerete: világ a fejlécben, hotbar, felső sáv, oldalfejlécek.
   A régi oldalsáv a DOM-ban marad adatforrásnak: az app.js továbbra is azt kapcsolgatja. */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ico = (n) => (window.pxIcon ? window.pxIcon(n) : '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const PARENT_VIEW = {
    playerProfile: { label: 'Játékosprofil', group: 'Játékosok' },
    deviceDetail: { label: 'Eszköz részletei', group: 'Játékosok' },
    revenueDetail: { label: 'Havi részletek', group: 'Havi bevétel' },
    legal: { label: 'Jogi információk', group: '' }
  };

  const VIEW_ICON = {
    home: 'home', skin: 'skin', cosmetics: 'cosmetic', market: 'market', trades: 'swap',
    coin: 'coin', wallet: 'wallet', transfer: 'send', redeem: 'gift', ledger: 'list',
    ranks: 'crown', sanction: 'hammer', players: 'people', casino: 'dice', mediaCalendar: 'calendar', staffApply: 'pen',
    security: 'shield', faq: 'book', legal: 'book'
  };

  const SLOTS = [
    { view: 'home', icon: 'home', label: 'Főoldal' },
    { group: 'character', icon: 'skin', label: 'Karakter' },
    { group: 'coin', icon: 'coin', label: 'PrémiumPont' },
    { view: 'ranks', icon: 'crown', label: 'Rangok' },
    { group: 'community', icon: 'people', label: 'Közösség' },
    { view: 'sanction', icon: 'hammer', label: 'Kitiltáscsökkentés' },
    { view: 'security', icon: 'shield', label: 'Biztonság' },
    { view: 'faq', icon: 'book', label: 'GYIK' },
    { group: 'admin', icon: 'wrench', label: 'Admin', staff: true, alt: { href: 'https://dc.solaryn.hu', icon: 'discord', label: 'Discord' } }
  ];

  const LEADS = {
    home: '',
    wallet: 'Forintban vezetett keret. Kártyával töltheted fel, vagy PrémiumPontból válthatod vissza.',
    coin: 'A PP vásárlás után azonnal megjelenik a Centerben, a kliensben és minden szerveren.',
    ranks: 'Rangot PrémiumPontból veszel. A plugin a levonás után azonnal beállítja.',
    transfer: 'Küldj PP-t más játékosnak. Minden átutalásra 10% díj jön.',
    ledger: 'Minden esemény, ami a PrémiumPont-egyenlegedet érinti.',
    redeem: 'Írd be a kapott ajándékkódot. A jutalom automatikusan a fiókodra kerül.',
    skin: 'PNG, 64x64 vagy annak többszöröse, egészen 2048x2048-ig. Ugyanez látszik a szerveren és a launcherben.',
    cosmetics: 'A kiegészítők a SolarClientben látszanak, texture pack nélkül. Helyenként egyet viselhetsz.',
    sanction: 'Lerövidítheted az aktív némításod vagy kitiltásod idejét. A teljes feloldást ticketben kérheted.',
    security: 'Kétlépcsős azonosítás és biztonsági kód. Bekapcsolhatod egyszerre mindkettőt, vagy csak az egyiket.',
    casino: 'Minden 7. egymást követő belépésért jár egy ingyenes pörgetés. Utána még 2 próbálkozás vehető 200 PP-ért.',
    faq: 'A leggyakoribb kérdések. Ha nem találod a választ, írj nekünk Discordon.'
  };

  function navInfo(view) {
    const btn = $(`.app-nav-item[data-view="${view}"]`);
    if (!btn) return null;
    const label = ($('span', btn) || btn).textContent.trim();
    const group = btn.closest('.app-nav-group');
    let groupLabel = '';
    if (group) {
      const head = $('.app-nav-group-head', group);
      groupLabel = head ? ($('span', head) || head).textContent.trim() : '';
    }
    return { label, groupLabel, group: group ? group.dataset.navGroup : null };
  }
  function viewMeta(view) {
    const direct = navInfo(view);
    if (direct) return direct;
    const parent = PARENT_VIEW[view];
    return parent ? { label: parent.label, groupLabel: parent.group, group: null } : { label: '', groupLabel: '', group: null };
  }

  const DAY_GREET = () => {
    const h = new Date().getHours();
    if (h < 5) return 'Késő van,';
    if (h < 10) return 'Jó reggelt,';
    if (h < 18) return 'Szép napot,';
    return 'Jó estét,';
  };

  // ---- Világ felépítése --------------------------------------------------------------------
  let world = null;
  let authWorld = null;

  function mountWorld() {
    const shell = $('#appScreen');
    const holder = document.createElement('div');
    holder.className = 'world';
    holder.setAttribute('aria-hidden', 'true');
    holder.innerHTML = '<canvas id="worldSky"></canvas><div class="world-under"><div class="stratum s-a"></div><div class="stratum s-b"></div><div class="stratum s-c"></div><div class="shaft"><div class="shaft-top"></div></div><div class="stratum s-bed"></div></div>';
    shell.insertBefore(holder, shell.firstChild);
    window.SolarWorldHolder = holder;
    world = new window.SolarWorld.World($('#worldSky'), { groundRows: 18 });
    window.solarWorld = world;

    const auth = $('#authSky');
    if (auth) {
      authWorld = new window.SolarWorld.World(auth, { groundRows: 24, lettersAt: 0.31 });
      window.solarAuthWorld = authWorld;
    }
    const applyTheme = () => {
      const key = document.documentElement.getAttribute('data-theme') || 'solaryn';
      if (world) world.setTheme(key, $('#appScreen').classList.contains('hidden'));
      if (authWorld) authWorld.setTheme(key, !$('#appScreen').classList.contains('hidden'));
      window.SolarWorld.applyStrata(document.documentElement, key, world ? world.scale : 3);
      applyShadow();
      refreshRunning();
    };
    new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    applyTheme();

    let resizeT = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if (world) world.resize();
        if (authWorld) authWorld.resize();
        const key = document.documentElement.getAttribute('data-theme') || 'solaryn';
        window.SolarWorld.applyStrata(document.documentElement, key, world.scale);
        syncSkinFoot();
      }, 120);
    });
    document.addEventListener('visibilitychange', refreshRunning);
    const auto = () => {
      if (world && world.running) world.rebuild();
      if (authWorld && authWorld.running) authWorld.rebuild();
      applyShadow();
    };
    setInterval(auto, 5 * 60 * 1000);
  }

  function refreshRunning() {
    const appVisible = !$('#appScreen').classList.contains('hidden');
    const authVisible = !appVisible;
    const hidden = document.hidden;
    const staticOnly = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (world) {
      if (appVisible && !hidden && !staticOnly) world.start();
      else { world.stop(); if (appVisible) world.drawOnce(); }
    }
    if (authWorld) {
      if (authVisible && !hidden && !staticOnly) authWorld.start();
      else { authWorld.stop(); if (authVisible) authWorld.drawOnce(); }
    }
  }

  // A kemény árnyékok a Nap állásától függenek: délelőtt jobbra, délután balra esnek.
  function applyShadow() {
    const w = world;
    if (!w) return;
    const sol = w.solarNow();
    const p = sol.sunP >= 0 && sol.sunP <= 1 ? sol.sunP : 0.5;
    const dx = Math.round((0.5 - p) * 10);
    document.documentElement.style.setProperty('--sh-x', `${dx}px`);
  }

  // ---- Oldalfejlécek --------------------------------------------------------------------------
  function buildHead(section) {
    const view = section.dataset.view;
    if (view === 'home') return;
    let title = $(':scope > .page-title', section);
    if ($(':scope > .page-head', section)) return;
    if (!title) {
      const m = viewMeta(view);
      title = document.createElement('h1');
      title.className = 'page-title';
      title.textContent = m.label || view;
      section.insertBefore(title, section.firstChild);
    }
    const note = title.nextElementSibling && title.nextElementSibling.classList.contains('page-note') ? title.nextElementSibling : null;
    const head = document.createElement('header');
    head.className = 'page-head';
    const back = $(':scope > .btn-back', section);
    section.insertBefore(head, section.firstChild);
    if (back) head.appendChild(back);
    head.appendChild(title);
    if (note) {
      note.classList.add('page-lead');
      if (LEADS[view] && !note.querySelector('strong, b, span[id]')) note.textContent = LEADS[view];
      head.insertAdjacentElement('afterend', note);
    }
  }

  // ---- Hotbar -----------------------------------------------------------------------------------
  let hotbar, pop, nameTip, tipTimer;

  function groupItems(key) {
    const group = $(`.app-nav-group[data-nav-group="${key}"]`);
    if (!group) return [];
    return $$('.app-nav-sub .app-nav-item', group).filter((b) => !b.classList.contains('hidden'));
  }
  function slotVisible(slot) {
    if (!slot.staff) return true;
    const g = $(`.app-nav-group[data-nav-group="${slot.group}"]`);
    return g && !g.classList.contains('hidden') && groupItems(slot.group).length > 0;
  }

  function buildHotbar() {
    hotbar = document.createElement('nav');
    hotbar.className = 'hotbar';
    hotbar.setAttribute('aria-label', 'Fő navigáció');
    document.getElementById('appScreen').appendChild(hotbar);

    nameTip = document.createElement('div');
    nameTip.className = 'hotbar-name';
    nameTip.setAttribute('aria-hidden', 'true');
    document.getElementById('appScreen').appendChild(nameTip);

    pop = document.createElement('div');
    pop.className = 'hotbar-pop hidden';
    pop.setAttribute('role', 'menu');
    document.getElementById('appScreen').appendChild(pop);

    renderHotbar();
    const src = $('#appSidebar');
    let t = null;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(renderHotbar, 60);
    }).observe(src, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true, characterData: true });

    document.addEventListener('click', (e) => {
      if (pop.classList.contains('hidden')) return;
      if (e.target.closest('.hotbar-pop') || e.target.closest('.hotbar-slot')) return;
      closePop();
    });
  }

  function slotBadge(slot) {
    if (slot.group) return groupItems(slot.group).some((b) => { const x = $('.app-nav-badge', b); return x && !x.classList.contains('hidden'); });
    const btn = $(`.app-nav-item[data-view="${slot.view}"]`);
    const x = btn && $('.app-nav-badge', btn);
    return !!(x && !x.classList.contains('hidden'));
  }

  let currentView = 'home';
  function renderHotbar() {
    const sig = SLOTS.map((s) => (slotVisible(s) ? 1 : s.alt ? 2 : 0)).join('');
    if (hotbar.dataset.sig === sig) {
      $$('.hotbar-slot[data-slot]', hotbar).forEach((b) => {
        if (b.tagName === 'A') return;
        const slot = SLOTS[Number(b.dataset.slot)];
        const holds = slot.view === currentView || !!(slot.group && $(`.app-nav-group[data-nav-group="${slot.group}"] .app-nav-item[data-view="${currentView}"]`));
        b.classList.toggle('active', holds);
        if (holds) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
        const dot = $('.hotbar-dot', b);
        const want = slotBadge(slot);
        if (want && !dot) b.insertAdjacentHTML('beforeend', '<i class="hotbar-dot"></i>');
        if (!want && dot) dot.remove();
      });
      return;
    }
    hotbar.dataset.sig = sig;
    const prevFocus = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.slot : null;
    let html = '<button type="button" class="hotbar-key" data-action="console" title="Parancssor (/)">' + ico('terminal') + '<span>/</span></button><div class="hotbar-slots">';
    let n = 0;
    SLOTS.forEach((slot, i) => {
      n++;
      const vis = slotVisible(slot);
      const useAlt = !vis && slot.alt;
      if (!vis && !slot.alt) return;
      const label = useAlt ? slot.alt.label : slot.label;
      const icon = useAlt ? slot.alt.icon : slot.icon;
      const holdsView = slot.view === currentView || (slot.group && $(`.app-nav-group[data-nav-group="${slot.group}"] .app-nav-item[data-view="${currentView}"]`));
      if (useAlt) {
        html += `<a class="hotbar-slot" href="${slot.alt.href}" target="_blank" rel="noopener noreferrer" data-slot="${i}" aria-label="${esc(label)}" title="${esc(label)}">${ico(icon)}<kbd>${n}</kbd></a>`;
      } else {
        html += `<button type="button" class="hotbar-slot${holdsView ? ' active' : ''}${slot.group ? ' has-sub' : ''}" data-slot="${i}" aria-label="${esc(label)}"${holdsView ? ' aria-current="page"' : ''} ${slot.group ? 'aria-haspopup="menu"' : ''} data-label="${esc(label)}">${ico(icon)}<kbd>${n}</kbd>${slotBadge(slot) ? '<i class="hotbar-dot"></i>' : ''}</button>`;
      }
    });
    html += '</div><button type="button" class="hotbar-key" data-action="map" title="Teljes menü (E)">' + ico('menu') + '<span>E</span></button>';
    hotbar.innerHTML = html;
    if (prevFocus != null) { const f = $(`[data-slot="${prevFocus}"]`, hotbar); if (f) f.focus(); }
    $$('.hotbar-slot', hotbar).forEach((b) => {
      if (b.tagName === 'A') return;
      b.addEventListener('click', () => activateSlot(Number(b.dataset.slot)));
      b.addEventListener('pointerenter', () => showName(b.dataset.label, b));
      b.addEventListener('pointerleave', hideName);
      b.addEventListener('focus', () => showName(b.dataset.label, b));
      b.addEventListener('blur', hideName);
    });
    $$('.hotbar-key', hotbar).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.action === 'map') toggleMap();
      if (b.dataset.action === 'console' && window.SolarQuest) window.SolarQuest.openConsole();
    }));
  }

  function showName(label, anchor) {
    if (!label || !nameTip) return;
    clearTimeout(tipTimer);
    nameTip.textContent = label;
    nameTip.classList.add('visible');
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      nameTip.style.left = `${Math.round(r.left + r.width / 2)}px`;
    } else nameTip.style.left = '50%';
  }
  function hideName() { clearTimeout(tipTimer); tipTimer = setTimeout(() => nameTip && nameTip.classList.remove('visible'), 200); }
  function flashName(label) { showName(label); clearTimeout(tipTimer); tipTimer = setTimeout(() => nameTip.classList.remove('visible'), 1400); }

  function activateSlot(i) {
    const slot = SLOTS[i];
    if (!slot) return;
    if (slot.group && slotVisible(slot)) return openPop([slot.group], i);
    if (slot.staff && slot.alt) return window.open(slot.alt.href, '_blank', 'noopener');
    closePop();
    window.switchView(slot.view);
  }

  function popColumn(key, title) {
    const items = groupItems(key);
    if (!items.length) return '';
    return `<div class="pop-col"><div class="pop-title">${esc(title)}</div><div class="pop-items">${items.map((b) => {
      const label = ($('span', b) || b).textContent.trim();
      const view = b.dataset.view;
      const badge = $('.app-nav-badge', b);
      const active = view === currentView;
      return `<button type="button" role="menuitem" class="pop-item${active ? ' active' : ''}" data-view="${esc(view)}">${VIEW_ICON[view] ? ico(VIEW_ICON[view]) : ''}<span>${esc(label)}</span>${badge && !badge.classList.contains('hidden') ? `<em>${esc(badge.textContent)}</em>` : ''}</button>`;
    }).join('')}</div></div>`;
  }

  let popKey = '';
  function openPop(keys, slotIndex) {
    const id = keys.join(',');
    if (!pop.classList.contains('hidden') && popKey === id) return closePop();
    popKey = id;
    const titleOf = (k) => { const s = SLOTS.find((x) => x.group === k); return s ? s.label : k; };
    let html = keys.map((k) => popColumn(k, titleOf(k))).join('');
    if (keys.length > 1) {
      const top = ['home', 'ranks', 'sanction', 'security', 'faq'];
      html = `<div class="pop-col"><div class="pop-title">Általános</div><div class="pop-items">${top.map((v) => {
        const b = $(`.app-nav-item[data-view="${v}"]`);
        const label = b ? ($('span', b) || b).textContent.trim() : v;
        return `<button type="button" role="menuitem" class="pop-item${v === currentView ? ' active' : ''}" data-view="${v}">${ico(VIEW_ICON[v] || 'home')}<span>${esc(label)}</span></button>`;
      }).join('')}<button type="button" role="menuitem" class="pop-item" data-action="quests">${ico('trophy')}<span>Felfedezések</span></button></div></div>` + html;
    }
    pop.innerHTML = html;
    pop.classList.toggle('pop-wide', keys.includes('admin') && keys.length === 1);
    pop.classList.toggle('pop-map', keys.length > 1);
    pop.classList.remove('hidden');
    if (slotIndex != null) {
      const b = $(`[data-slot="${slotIndex}"]`, hotbar);
      if (b && keys.length === 1) {
        const r = b.getBoundingClientRect();
        pop.style.setProperty('--pop-x', `${Math.round(r.left + r.width / 2)}px`);
      }
    } else pop.style.setProperty('--pop-x', '50%');
    $$('.pop-item', pop).forEach((it) => it.addEventListener('click', () => {
      closePop();
      if (it.dataset.action === 'quests') { if (window.SolarQuest) window.SolarQuest.openList(); return; }
      window.switchView(it.dataset.view);
    }));
    const first = $('.pop-item.active', pop) || $('.pop-item', pop);
    if (first) first.focus({ preventScroll: true });
  }
  function closePop() { if (pop) pop.classList.add('hidden'); popKey = ''; }
  function toggleMap() {
    const keys = ['character', 'coin', 'community'];
    const a = $(`.app-nav-group[data-nav-group="admin"]`);
    if (a && !a.classList.contains('hidden') && groupItems('admin').length) keys.push('admin');
    openPop(keys);
  }

  // ---- Váltás, fejléc-magasság ------------------------------------------------------------------
  function buildCrumbs() {
    const topbar = $('.app-topbar');
    if (!topbar || $('.topbar-crumbs', topbar)) return;
    const crumbs = document.createElement('nav');
    crumbs.className = 'topbar-crumbs';
    crumbs.setAttribute('aria-label', 'Hol vagy');
    const brand = $('.topbar-brand', topbar);
    if (brand) brand.insertAdjacentElement('afterend', crumbs);
    else topbar.insertBefore(crumbs, topbar.firstChild);
  }
  function updateCrumbs(view) {
    const crumbs = $('.topbar-crumbs');
    if (!crumbs) return;
    const m = viewMeta(view);
    const parts = [];
    if (m.groupLabel) parts.push(`<span class="crumb">${esc(m.groupLabel)}</span>`);
    if (m.label && view !== 'home') parts.push(`<span class="crumb crumb-current">${esc(m.label)}</span>`);
    crumbs.innerHTML = parts.join('<span class="crumb-sep" aria-hidden="true">/</span>');
  }

  function syncSkinFoot() {
    if (!world) return;
    document.documentElement.style.setProperty('--ground-css', `${world.groundCss}px`);
    const sk = $('#homeSkinCanvas');
    const r = sk ? sk.getBoundingClientRect() : null;
    if (r && r.width > 0) {
      world.skinShadowX = (r.left + r.width / 2) / world.scale;
      world.skinShadowW = Math.round((r.width * 0.46) / world.scale);
    }
  }

  function setViewChrome(view) {
    currentView = view;
    document.documentElement.setAttribute('data-view', view);
    if (world) {
      world.resize();
      world.setView(view);
      const dir = world.camAnim ? Math.sign(world.camAnim.delta) : 0;
      document.documentElement.style.setProperty('--enter-x', (window.innerWidth > 900 ? dir * 22 : 0) + 'px');
      world.showLetters = view === 'home';
      syncSkinFoot();
      if (!world.running) world.drawOnce();
    }
    updateCrumbs(view);
    renderHotbar();
    closePop();
  }

  function wrapSwitchView() {
    if (typeof window.switchView !== 'function' || window.switchView.__designWrapped) return;
    const original = window.switchView;
    const wrapped = function (view) {
      const changed = view !== currentView;
      original(view);
      setViewChrome(view);
      if (changed) {
        const m = viewMeta(view);
        if (m.label) flashName(m.label);
      }
      window.dispatchEvent(new CustomEvent('solar:view', { detail: { view } }));
    };
    wrapped.__designWrapped = true;
    window.switchView = wrapped;
  }

  // ---- Egyéb -----------------------------------------------------------------------------------
  function loadSkinIntoWorld() {
    const nameEl = $('#topbarUsername');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name || !world) return;
    const base = (typeof BACKEND_URL === 'string' && BACKEND_URL) || 'https://api.solaryn.hu:25572';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => world.setSkin(img, name);
    img.onerror = () => {
      const def = new Image();
      def.onload = () => world.setSkin(def, name);
      def.src = 'assets/default-skin.png';
    };
    img.src = `${base}/api/skin/${encodeURIComponent(name)}?t=${Date.now()}`;
  }

  async function loadFriendsIntoWorld() {
    const nameEl = $('#topbarUsername');
    const name = nameEl ? nameEl.textContent.trim() : '';
    if (!name || !world) return;
    const base = (typeof BACKEND_URL === 'string' && BACKEND_URL) || 'https://api.solaryn.hu:25572';
    try {
      const token = typeof session !== 'undefined' && session ? session.token : null;
      if (!token) return;
      const res = await fetch(base + '/api/friends/' + encodeURIComponent(name), { headers: { Authorization: 'Bearer ' + token } });
      const data = await res.json();
      const online = (data.friends || []).filter((f) => f.online).slice(0, 8);
      const list = await Promise.all(online.map((f) => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ name: f.username, img });
        // Akinek nincs saját skinje, az nem jelenik meg Steve-ként a horizonton.
        img.onerror = () => resolve(null);
        img.src = base + '/api/skin/' + encodeURIComponent(f.username);
      })));
      world.setFriends(list.filter(Boolean));
    } catch {}
  }

  function watchScreens() {
    const obs = new MutationObserver(() => {
      refreshRunning();
      if (!$('#appScreen').classList.contains('hidden')) {
        world.resize();
        syncSkinFoot();
        const greet = $('#homeGreet');
        if (greet) greet.textContent = DAY_GREET();
        loadSkinIntoWorld();
        loadFriendsIntoWorld();
      }
    });
    ['#appScreen', '#authScreen', '#lockedScreen'].forEach((s) => obs.observe($(s), { attributes: true, attributeFilter: ['class'] }));
    refreshRunning();
    if (!$('#appScreen').classList.contains('hidden')) { loadSkinIntoWorld(); loadFriendsIntoWorld(); }
    setInterval(() => { if (!document.hidden && !$('#appScreen').classList.contains('hidden')) loadFriendsIntoWorld(); }, 2 * 60 * 1000);
  }

  function keys() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ($('#appScreen').classList.contains('hidden')) return;
      if ($('.modal-overlay:not(.hidden)')) return;
      if (e.key === 'Escape') { if (!pop.classList.contains('hidden')) { closePop(); return; } }
      if (typing || (window.solarWorld && window.solarWorld.creative)) return;
      if (/^[1-9]$/.test(e.key)) {
        const visible = SLOTS.map((s, i) => ({ s, i })).filter(({ s }) => slotVisible(s) || s.alt);
        const hit = visible[Number(e.key) - 1];
        if (hit) { e.preventDefault(); activateSlot(hit.i); }
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        toggleMap();
      }
    });
  }

  function bindHomeIp() {
    const b = $('#homeIpCopy');
    if (!b) return;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('play.solaryn.hu'); } catch {}
      const label = $('span', b);
      const old = label.textContent;
      label.textContent = 'Kimásolva';
      setTimeout(() => { label.textContent = old; }, 1400);
    });
  }

  // Fáklyák az akna falán: a lap hosszához igazodnak.
  function placeTorches() {
    const shaft = $('.shaft');
    if (!shaft) return;
    $$('.torch', shaft).forEach((t) => t.remove());
    if (window.innerWidth < 900) return;
    const h = shaft.getBoundingClientRect().height;
    const step = 620;
    let i = 0;
    for (let y = 150; y < h - 260; y += step / 2) {
      const t = document.createElement('i');
      t.className = 'torch ' + (i % 2 ? 'torch-r' : 'torch-l');
      t.style.top = Math.round(y) + 'px';
      t.style.setProperty('--d', (i * 0.37 % 1.4).toFixed(2) + 's');
      shaft.appendChild(t);
      i++;
    }
  }

  function boot() {
    document.documentElement.classList.remove('has-session');
    bindHomeIp();
    mountWorld();
    $$('.app-content > .view').forEach(buildHead);
    buildHotbar();
    buildCrumbs();
    wrapSwitchView();
    const active = $('.app-content > .view.active');
    setViewChrome(active ? active.dataset.view : 'home');
    if ('ResizeObserver' in window) {
      let rt = null;
      new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(placeTorches, 150); }).observe($('.world-under'));
    }
    placeTorches();
    watchScreens();
    keys();
    window.SolarShell = { closePop, openMap: toggleMap, flashName, world: () => world };
    document.documentElement.classList.add('design-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
