// Média naptár (Közösség > Média naptár). A "média" rangú játékosok itt
// tervezik a live-jaikat és videóikat; mindenki látja a többiekét, és a staff
// is, akinek van rá joga. Az app.js globális segédeit használja ($, session,
// BACKEND_URL, escapeHtml, showToast, confirmModal).

const MC_DAY_MS = 86400000;
const MC_HOUR_PX = 44;
const MC_LIST_DAYS = 60;
const MC_WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
const MC_KIND_SHORT = { live: 'Live', video: 'Videó', short: 'Rövid', other: 'Egyéb' };

const mc = {
  view: 'month',
  cursor: mcStartOfDay(new Date()),
  data: null,
  hidden: new Set(),
  kind: 'all',
  onlyMine: false,
  loading: false,
  nowTimer: null
};

function mcStartOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function mcAddDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function mcStartOfWeek(d) { const x = mcStartOfDay(d); return mcAddDays(x, -((x.getDay() + 6) % 7)); }
function mcSameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function mcPad(n) { return String(n).padStart(2, '0'); }
function mcTime(d) { return `${mcPad(d.getHours())}:${mcPad(d.getMinutes())}`; }
function mcDateInput(d) { return `${d.getFullYear()}-${mcPad(d.getMonth() + 1)}-${mcPad(d.getDate())}`; }
function mcFmt(d, opts) { return new Intl.DateTimeFormat('hu-HU', opts).format(d); }
function mcDayKey(d) { return mcDateInput(d); }

function mcHeaders(json) {
  return json
    ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token }
    : { Authorization: 'Bearer ' + session.token };
}

function mcRange() {
  if (mc.view === 'week') {
    const from = mcStartOfWeek(mc.cursor);
    return { from, to: mcAddDays(from, 7) };
  }
  if (mc.view === 'list') {
    const from = mcStartOfDay(mc.cursor);
    return { from, to: mcAddDays(from, MC_LIST_DAYS) };
  }
  const first = new Date(mc.cursor.getFullYear(), mc.cursor.getMonth(), 1);
  const from = mcStartOfWeek(first);
  return { from, to: mcAddDays(from, 42) };
}

function mcColor(username) {
  const c = mc.data?.creators.find((x) => x.username === username);
  return c ? c.color : '#888888';
}

function mcCanTouch(ev) {
  const me = mc.data?.me;
  return !!me && (me.manage || (me.edit && ev.username === me.username));
}

function mcStart(ev) { return new Date(ev.startsAt); }
// Videónál nincs befejezés: a naptárban fél órás jelölőként látszik.
function mcEnd(ev) { return ev.endsAt ? new Date(ev.endsAt) : new Date(Date.parse(ev.startsAt) + 30 * 60000); }

function mcVisibleEvents() {
  if (!mc.data) return [];
  return mc.data.events.filter((ev) => {
    if (mc.onlyMine && ev.username !== mc.data.me.username && !ev.participants.includes(mc.data.me.username)) return false;
    if (mc.kind !== 'all' && ev.kind !== mc.kind) return false;
    return !mc.hidden.has(ev.username);
  });
}

function mcEventsOnDay(events, day) {
  const start = mcStartOfDay(day).getTime();
  const end = start + MC_DAY_MS;
  return events.filter((ev) => mcStart(ev).getTime() < end && mcEnd(ev).getTime() > start)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function mcTimeRange(ev) {
  const s = mcStart(ev);
  if (!ev.endsAt) return mcTime(s);
  const e = new Date(ev.endsAt);
  return `${mcTime(s)}–${mcTime(e)}${mcSameDay(s, e) ? '' : ' (+1)'}`;
}

function mcDuration(ev) {
  if (!ev.endsAt) return '';
  const min = Math.round((Date.parse(ev.endsAt) - Date.parse(ev.startsAt)) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} óra${m ? ` ${m} perc` : ''}` : `${m} perc`;
}

async function loadMediaCalendar() {
  const body = $('#mediaCalendarBody');
  if (!body || !session?.token) return;
  if (!mc.data) body.innerHTML = '<div class="card"><p class="mc-muted">Naptár betöltése...</p></div>';
  const { from, to } = mcRange();
  mc.loading = true;
  try {
    const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    const res = await fetch(BACKEND_URL + '/api/media-calendar?' + params, { headers: mcHeaders() });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message);
    mc.data = data;
    renderMediaCalendar();
  } catch (err) {
    body.innerHTML = `<div class="card"><p class="mc-muted">${escapeHtml(err.message || 'Nem sikerült betölteni a naptárat.')}</p></div>`;
  } finally {
    mc.loading = false;
  }
  clearInterval(mc.nowTimer);
  // A "most élő" sáv és a heti nézet időjelzője percenként frissül.
  mc.nowTimer = setInterval(() => {
    if ($('.view.active')?.dataset.view !== 'mediaCalendar') { clearInterval(mc.nowTimer); return; }
    renderMcNow();
    renderMcNowLine();
  }, 60000);
}

function mcTitle() {
  if (mc.view === 'week') {
    const from = mcStartOfWeek(mc.cursor);
    const to = mcAddDays(from, 6);
    const sameMonth = from.getMonth() === to.getMonth();
    return `${mcFmt(from, { year: 'numeric', month: 'long', day: 'numeric' })} – ${mcFmt(to, sameMonth ? { day: 'numeric' } : { month: 'long', day: 'numeric' })}`;
  }
  if (mc.view === 'list') return `${mcFmt(mc.cursor, { month: 'long', day: 'numeric' })}-től ${MC_LIST_DAYS} nap`;
  return mcFmt(mc.cursor, { year: 'numeric', month: 'long' });
}

function renderMediaCalendar() {
  const body = $('#mediaCalendarBody');
  const d = mc.data;
  if (!body || !d) return;
  closeMcMenus();
  const events = mcVisibleEvents();
  const counts = {};
  for (const ev of d.events) counts[ev.username] = (counts[ev.username] || 0) + 1;
  const kinds = d.options.kinds;

  body.innerHTML = `
    <div class="card mc-card">
      <div class="mc-toolbar">
        <div class="mc-nav">
          <button type="button" class="mc-icon-btn" data-mc-step="-1" aria-label="Előző">&#8249;</button>
          <button type="button" class="mc-today" data-mc-today>Ma</button>
          <button type="button" class="mc-icon-btn" data-mc-step="1" aria-label="Következő">&#8250;</button>
          <h2 class="mc-title">${escapeHtml(mcTitle())}</h2>
        </div>
        <div class="mc-tools">
          <div class="nr-seg mc-seg" role="radiogroup" aria-label="Nézet">
            ${[['month', 'Hónap'], ['week', 'Hét'], ['list', 'Lista']].map(([v, l]) => `<button type="button" class="nr-seg-btn${mc.view === v ? ' active' : ''}" data-mc-view="${v}" role="radio" aria-checked="${mc.view === v}">${l}</button>`).join('')}
          </div>
          ${d.me.edit ? '<button type="button" class="btn-glow mc-add" data-mc-new>+ Új bejegyzés</button>' : ''}
        </div>
      </div>

      <div id="mcNow"></div>

      <div class="mc-filters">
        <div class="mc-legend">
          ${d.creators.map((c) => `
            <button type="button" class="mc-creator${mc.hidden.has(c.username) ? ' off' : ''}" data-mc-toggle="${escapeHtml(c.username)}" title="${mc.hidden.has(c.username) ? 'Megjelenítés' : 'Elrejtés'}">
              <i style="background:${escapeHtml(c.color)}"></i>${escapeHtml(c.username)}<span>${counts[c.username] || 0}</span>
            </button>`).join('') || '<span class="mc-muted">Még nincs média rangú játékos.</span>'}
        </div>
        <div class="mc-filter-right">
          ${mcDropdownHtml('kindFilter', [{ value: 'all', label: 'Minden típus' }, ...Object.entries(kinds).map(([k, l]) => ({ value: k, label: l }))], mc.kind, { label: 'Típus', compact: true })}
          ${d.me.edit ? `<button type="button" class="mc-toggle" data-mc-mine aria-pressed="${mc.onlyMine}">${MC_ICON.check}Csak az enyém</button>` : ''}
          ${d.me.media || d.me.manage ? '<button type="button" class="mc-link" data-mc-color>Saját szín</button>' : ''}
        </div>
      </div>

      <div class="mc-body mc-body-${mc.view}">${mc.view === 'week' ? mcWeekHtml(events) : mc.view === 'list' ? mcListHtml(events) : mcMonthHtml(events)}</div>
    </div>`;
  renderMcNow();
  if (mc.view === 'week') {
    layoutMcWeek(events);
    renderMcNowLine();
    const scroller = $('.mc-week-scroll');
    if (scroller && !scroller.dataset.scrolled) {
      scroller.scrollTop = 8 * MC_HOUR_PX;
      scroller.dataset.scrolled = '1';
    }
  }
}

// "Most élő" és "következő" sáv a naptár fölött.
function renderMcNow() {
  const el = $('#mcNow');
  if (!el || !mc.data) return;
  const now = Date.now();
  const live = mc.data.events.filter((ev) => ev.status !== 'cancelled' && ev.kind === 'live' && Date.parse(ev.startsAt) <= now && mcEnd(ev).getTime() > now);
  const next = mc.data.events.filter((ev) => ev.status !== 'cancelled' && Date.parse(ev.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (!live.length && !next) { el.innerHTML = ''; return; }
  const liveHtml = live.map((ev) => `<button type="button" class="mc-now-item" data-mc-open="${ev.id}"><span class="mc-live-dot"></span><b>${escapeHtml(ev.username)}</b> most live: ${escapeHtml(ev.title)} <span class="mc-muted">· ${escapeHtml(mcTime(new Date(ev.endsAt)))}-ig</span></button>`).join('');
  const nextHtml = next ? `<button type="button" class="mc-now-item" data-mc-open="${next.id}"><i style="background:${escapeHtml(mcColor(next.username))}"></i>Következő: <b>${escapeHtml(next.username)}</b> · ${escapeHtml(next.title)} <span class="mc-muted">· ${escapeHtml(mcFmt(mcStart(next), { month: 'short', day: 'numeric', weekday: 'short' }))} ${escapeHtml(mcTime(mcStart(next)))}</span></button>` : '';
  el.innerHTML = `<div class="mc-now">${liveHtml}${nextHtml}</div>`;
}

function mcChip(ev, withTime = true) {
  const color = mcColor(ev.username);
  const cls = `mc-chip mc-kind-${ev.kind}${ev.status === 'cancelled' ? ' cancelled' : ''}${ev.status === 'done' ? ' done' : ''}`;
  const time = withTime ? `<span class="mc-chip-time">${escapeHtml(mcTime(mcStart(ev)))}</span>` : '';
  return `<button type="button" class="${cls}" style="--mc-c:${escapeHtml(color)}" data-mc-open="${ev.id}" title="${escapeHtml(`${ev.username} · ${MC_KIND_SHORT[ev.kind] || ev.kind} · ${mcTimeRange(ev)} · ${ev.title}`)}">${time}<span class="mc-chip-title">${escapeHtml(ev.title)}</span></button>`;
}

function mcMonthHtml(events) {
  const { from } = mcRange();
  const today = new Date();
  const month = mc.cursor.getMonth();
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const day = mcAddDays(from, i);
    const list = mcEventsOnDay(events, day);
    const shown = list.slice(0, 3);
    const more = list.length - shown.length;
    cells += `
      <div class="mc-cell${day.getMonth() !== month ? ' other' : ''}${mcSameDay(day, today) ? ' today' : ''}" data-mc-day="${mcDayKey(day)}">
        <span class="mc-cell-num">${day.getDate()}</span>
        <div class="mc-cell-events">${shown.map((ev) => mcChip(ev)).join('')}${more > 0 ? `<button type="button" class="mc-more" data-mc-dayopen="${mcDayKey(day)}">+${more} további</button>` : ''}</div>
      </div>`;
  }
  return `<div class="mc-month">
    <div class="mc-month-head">${MC_WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="mc-month-grid">${cells}</div>
  </div>`;
}

function mcWeekHtml() {
  const from = mcStartOfWeek(mc.cursor);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => mcAddDays(from, i));
  const hours = Array.from({ length: 24 }, (_, h) => `<div class="mc-hour"><span>${mcPad(h)}:00</span></div>`).join('');
  return `<div class="mc-week">
    <div class="mc-week-head"><span></span>${days.map((d, i) => `<span class="${mcSameDay(d, today) ? 'today' : ''}">${MC_WEEKDAYS[i]} <b>${d.getDate()}</b></span>`).join('')}</div>
    <div class="mc-week-scroll">
      <div class="mc-week-grid" style="height:${24 * MC_HOUR_PX}px">
        <div class="mc-hours">${hours}</div>
        ${days.map((d) => `<div class="mc-week-col${mcSameDay(d, today) ? ' today' : ''}" data-mc-weekday="${mcDayKey(d)}"></div>`).join('')}
      </div>
    </div>
  </div>`;
}

// Heti nézet: az egymást átfedő bejegyzések egymás mellé kerülnek.
function layoutMcWeek(events) {
  $$('.mc-week-col').forEach((col) => {
    const day = new Date(col.dataset.mcWeekday + 'T00:00:00');
    const dayStart = day.getTime();
    const dayEnd = dayStart + MC_DAY_MS;
    const items = mcEventsOnDay(events, day).map((ev) => ({
      ev,
      s: Math.max(mcStart(ev).getTime(), dayStart),
      e: Math.min(mcEnd(ev).getTime(), dayEnd)
    }));
    const lanes = [];
    let cluster = [];
    let clusterEnd = 0;
    const flush = () => { const n = Math.max(1, ...cluster.map((it) => it.lane + 1)); cluster.forEach((it) => { it.lanes = n; }); cluster = []; };
    for (const it of items) {
      if (cluster.length && it.s >= clusterEnd) { flush(); lanes.length = 0; }
      let lane = lanes.findIndex((end) => end <= it.s);
      if (lane === -1) { lane = lanes.length; lanes.push(it.e); } else lanes[lane] = it.e;
      it.lane = lane;
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.e);
    }
    flush();
    col.innerHTML = items.map((it) => {
      const top = ((it.s - dayStart) / 3600000) * MC_HOUR_PX;
      const height = Math.max(22, ((it.e - it.s) / 3600000) * MC_HOUR_PX - 2);
      const width = 100 / it.lanes;
      const ev = it.ev;
      return `<button type="button" class="mc-block mc-kind-${ev.kind}${ev.status === 'cancelled' ? ' cancelled' : ''}${ev.status === 'done' ? ' done' : ''}" data-mc-open="${ev.id}"
        style="--mc-c:${escapeHtml(mcColor(ev.username))};top:${top}px;height:${height}px;left:calc(${it.lane * width}% + 2px);width:calc(${width}% - 4px)">
        <span class="mc-block-time">${escapeHtml(mcTimeRange(ev))}</span>
        <span class="mc-block-title">${escapeHtml(ev.title)}</span>
        <span class="mc-block-who">${escapeHtml(ev.username)}</span>
      </button>`;
    }).join('') + '<div class="mc-now-line hidden"></div>';
  });
}

function renderMcNowLine() {
  const now = new Date();
  $$('.mc-week-col').forEach((col) => {
    const line = col.querySelector('.mc-now-line');
    if (!line) return;
    const day = new Date(col.dataset.mcWeekday + 'T00:00:00');
    const on = mcSameDay(day, now);
    line.classList.toggle('hidden', !on);
    if (on) line.style.top = `${((now - day) / 3600000) * MC_HOUR_PX}px`;
  });
}

function mcListHtml(events) {
  const from = mcStartOfDay(mc.cursor);
  let html = '';
  for (let i = 0; i < MC_LIST_DAYS; i++) {
    const day = mcAddDays(from, i);
    const list = mcEventsOnDay(events, day).filter((ev) => mcSameDay(mcStart(ev), day) || i === 0);
    if (!list.length) continue;
    html += `<div class="mc-list-day">
      <div class="mc-list-date${mcSameDay(day, new Date()) ? ' today' : ''}">${escapeHtml(mcFmt(day, { month: 'long', day: 'numeric', weekday: 'long' }))}</div>
      ${list.map((ev) => mcListRow(ev)).join('')}
    </div>`;
  }
  return html || `<div class="mc-empty"><b>Nincs bejegyzés a következő ${MC_LIST_DAYS} napban.</b>${mc.data.me.edit ? '<span>Az "+ Új bejegyzés" gombbal vehetsz fel live-ot vagy videót.</span>' : ''}</div>`;
}

function mcListRow(ev) {
  const kinds = mc.data.options.kinds;
  const platforms = mc.data.options.platforms;
  const meta = [kinds[ev.kind], ev.platform ? platforms[ev.platform] : null, ev.server].filter(Boolean).map(escapeHtml).join(' · ');
  return `<button type="button" class="mc-list-row${ev.status === 'cancelled' ? ' cancelled' : ''}" data-mc-open="${ev.id}" style="--mc-c:${escapeHtml(mcColor(ev.username))}">
    <span class="mc-list-time">${escapeHtml(mcTimeRange(ev))}</span>
    <span class="mc-list-main"><b>${escapeHtml(ev.title)}</b><span>${escapeHtml(ev.username)}${ev.participants.length ? ` + ${ev.participants.map(escapeHtml).join(', ')}` : ''}</span></span>
    <span class="mc-list-meta">${meta}${ev.status === 'done' ? ' · <em>megtartva</em>' : ev.status === 'cancelled' ? ' · <em>elmaradt</em>' : ''}</span>
  </button>`;
}

// --- Felugró ablakok ---

function mcModal(html, cls = '') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay mc-overlay';
  overlay.innerHTML = `<div class="modal-card mc-modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  return { overlay, card: overlay.firstElementChild, close };
}

function openMcEvent(id) {
  const ev = mc.data?.events.find((x) => x.id === id);
  if (!ev) return;
  const o = mc.data.options;
  const s = mcStart(ev);
  const past = mcEnd(ev).getTime() < Date.now();
  const canTouch = mcCanTouch(ev);
  const statusLabel = { planned: 'Tervezett', done: 'Megtartva', cancelled: 'Elmaradt' }[ev.status];
  const rows = [
    ['Időpont', `${mcFmt(s, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}, ${mcTimeRange(ev)}${ev.endsAt ? ` (${mcDuration(ev)})` : ''}`],
    ['Platform', ev.platform ? o.platforms[ev.platform] : null],
    ['Szerver', ev.server],
    ['Közreműködők', ev.participants.length ? ev.participants.join(', ') : null],
    ['Állapot', statusLabel],
    ['Ismétlődő', ev.seriesId ? 'Igen, heti sorozat része' : null]
  ].filter(([, v]) => v);
  const m = mcModal(`
    <div class="mc-detail-head" style="--mc-c:${escapeHtml(mcColor(ev.username))}">
      <span class="mc-detail-kind">${escapeHtml(o.kinds[ev.kind])}</span>
      <h3>${escapeHtml(ev.title)}</h3>
      <span class="mc-detail-who"><i></i>${escapeHtml(ev.username)}</span>
    </div>
    <dl class="mc-detail">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
    ${ev.details ? `<p class="mc-detail-notes">${escapeHtml(ev.details)}</p>` : ''}
    ${ev.link ? `<a class="mc-detail-link" href="${escapeHtml(ev.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.link)}</a>` : ''}
    ${canTouch && past ? `<div class="mc-status-row"><span>Hogy sikerült?</span>
      <button type="button" class="nr-seg-btn${ev.status === 'done' ? ' active' : ''}" data-mc-status="done">Megtartva</button>
      <button type="button" class="nr-seg-btn${ev.status === 'cancelled' ? ' active' : ''}" data-mc-status="cancelled">Elmaradt</button></div>` : ''}
    <div class="mc-modal-actions">
      <button type="button" class="mc-link" data-mc-ics>Hozzáadás a saját naptáradhoz (.ics)</button>
      <span class="mc-spacer"></span>
      ${canTouch ? '<button type="button" class="btn-outline sa-btn-danger" data-mc-delete>Törlés</button><button type="button" class="btn-outline" data-mc-edit>Szerkesztés</button>' : ''}
      <button type="button" class="btn-glow" data-mc-close>Bezárás</button>
    </div>`);
  m.card.addEventListener('click', async (e) => {
    if (e.target.closest('[data-mc-close]')) { m.close(); return; }
    if (e.target.closest('[data-mc-ics]')) { mcDownloadIcs([ev], `${ev.title}.ics`); return; }
    if (e.target.closest('[data-mc-edit]')) { m.close(); openMcForm(ev); return; }
    const st = e.target.closest('[data-mc-status]');
    if (st) {
      const status = ev.status === st.dataset.mcStatus ? 'planned' : st.dataset.mcStatus;
      const res = await mcSend('POST', `/api/media-calendar/events/${ev.id}/status`, { status });
      if (res) { m.close(); await loadMediaCalendar(); openMcEvent(ev.id); }
      return;
    }
    if (e.target.closest('[data-mc-delete]')) {
      let series = false;
      if (ev.seriesId) {
        series = await confirmModal('Ismétlődő bejegyzés', 'Ez egy heti sorozat része. Ezt és az összes későbbi alkalmat is törlöd? (Mégse: csak ezt az egyet.)', 'Igen, a későbbieket is');
      } else if (!(await confirmModal('Bejegyzés törlése', `Biztosan törlöd: <b>${escapeHtml(ev.title)}</b>?`, 'Igen, törlés'))) {
        return;
      }
      const res = await mcSend('DELETE', `/api/media-calendar/events/${ev.id}${series ? '?series=following' : ''}`);
      if (res) { m.close(); showToast(res.removed > 1 ? `${res.removed} alkalom törölve.` : 'Bejegyzés törölve.'); loadMediaCalendar(); }
    }
  });
}

function openMcDay(key) {
  const day = new Date(key + 'T00:00:00');
  const list = mcEventsOnDay(mcVisibleEvents(), day);
  const m = mcModal(`
    <h3>${escapeHtml(mcFmt(day, { month: 'long', day: 'numeric', weekday: 'long' }))}</h3>
    <div class="mc-day-list">${list.map((ev) => mcListRow(ev)).join('')}</div>
    <div class="mc-modal-actions"><span class="mc-spacer"></span>
      ${mc.data.me.edit ? '<button type="button" class="btn-outline" data-mc-dnew>+ Új erre a napra</button>' : ''}
      <button type="button" class="btn-glow" data-mc-close>Bezárás</button></div>`);
  m.card.addEventListener('click', (e) => {
    const open = e.target.closest('[data-mc-open]');
    if (open) { m.close(); openMcEvent(Number(open.dataset.mcOpen)); return; }
    if (e.target.closest('[data-mc-dnew]')) { m.close(); openMcForm(null, day); return; }
    if (e.target.closest('[data-mc-close]')) m.close();
  });
}

function openMcForm(ev, presetDay) {
  const d = mc.data;
  const o = d.options;
  const editing = !!ev;
  const base = editing ? mcStart(ev) : (() => {
    const x = presetDay ? new Date(presetDay) : mcStartOfDay(new Date());
    x.setHours(18, 0, 0, 0);
    return x;
  })();
  const end = editing && ev.endsAt ? new Date(ev.endsAt) : new Date(base.getTime() + 2 * 3600000);
  const kind = editing ? ev.kind : 'live';
  const owner = editing ? ev.username : d.me.username;
  const mediaCreators = d.creators.filter((c) => c.media);
  const ownerOptions = mediaCreators.map((c) => ({ value: c.username, label: c.username, color: c.color }));
  if (!ownerOptions.some((x) => x.value === owner)) ownerOptions.push({ value: owner, label: owner, color: mcColor(owner) });
  const m = mcModal(`
    <h3>${editing ? 'Bejegyzés szerkesztése' : 'Új bejegyzés'}</h3>
    <form class="mc-form" novalidate>
      <div class="nr-seg mc-kind-seg" role="radiogroup" aria-label="Típus">
        ${Object.entries(o.kinds).map(([k, l]) => `<button type="button" class="nr-seg-btn${k === kind ? ' active' : ''}" data-mc-kindpick="${k}" role="radio" aria-checked="${k === kind}">${escapeHtml(l)}</button>`).join('')}
      </div>
      ${d.me.manage && !editing ? `<div class="mc-field"><span>Médiás</span>${mcDropdownHtml('username', ownerOptions, owner, { label: 'Médiás' })}</div>` : ''}
      <label>Cím<input name="title" maxlength="80" placeholder="pl. Kingdoms háború élőben" value="${editing ? escapeHtml(ev.title) : ''}" required /></label>
      <div class="mc-form-row3">
        <div class="mc-field"><span>Nap</span>${mcDatePickerHtml('date', mcDateInput(base))}</div>
        <div class="mc-field"><span data-mc-startlabel>${kind === 'live' ? 'Kezdés' : 'Megjelenés'}</span>${mcDropdownHtml('start', mcTimeOptions(mcTime(base)), mcTime(base), { label: 'Kezdés', icon: MC_ICON.clock })}</div>
        <div class="mc-field" data-mc-endwrap><span>Befejezés${kind === 'live' ? '' : ' (nem kötelező)'}</span>${mcDropdownHtml('end', mcTimeOptions(mcTime(end), true), editing && !ev.endsAt ? '' : mcTime(end), { label: 'Befejezés', icon: MC_ICON.clock })}</div>
      </div>
      <div class="mc-form-row2">
        <div class="mc-field"><span>Platform</span>${mcDropdownHtml('platform', [{ value: '', label: 'Nincs megadva' }, ...Object.entries(o.platforms).map(([k, l]) => ({ value: k, label: l }))], editing ? ev.platform || '' : '', { label: 'Platform' })}</div>
        <div class="mc-field"><span>Szerver</span>${mcDropdownHtml('server', [{ value: '', label: 'Nincs megadva' }, ...o.servers.map((s) => ({ value: s, label: s }))], editing ? ev.server || '' : '', { label: 'Szerver' })}</div>
      </div>
      <label>Link (nem kötelező)<input name="link" type="url" maxlength="300" placeholder="https://youtube.com/..." value="${editing && ev.link ? escapeHtml(ev.link) : ''}" /></label>
      ${mediaCreators.length > 1 ? `<div class="mc-field"><span>Közreműködők</span><div class="mc-people">${mediaCreators.filter((c) => c.username !== owner).map((c) => {
        const on = editing && ev.participants.includes(c.username);
        return `<button type="button" class="mc-toggle mc-person" data-mc-person="${escapeHtml(c.username)}" aria-pressed="${on}" style="--mc-c:${escapeHtml(c.color)}">${MC_ICON.check}<i></i>${escapeHtml(c.username)}</button>`;
      }).join('')}</div></div>` : ''}
      <label>Megjegyzés (nem kötelező)<textarea name="details" maxlength="500" rows="3" placeholder="Miről szól, kell-e segítség a staff részéről, stb.">${editing ? escapeHtml(ev.details) : ''}</textarea></label>
      ${editing ? '' : `<div class="mc-repeat"><span>Hetente ismétlődik</span>
        <div class="mc-stepper" data-mc-stepper="repeat" data-value="0" data-min="0" data-max="12">
          <button type="button" data-mc-stepdelta="-1" aria-label="Kevesebb">&minus;</button><b>0</b><button type="button" data-mc-stepdelta="1" aria-label="Több">+</button>
        </div><span class="mc-repeat-hint" data-mc-repeathint>nem ismétlődik</span></div>`}
      <div class="mc-conflicts" data-mc-conflicts></div>
      <p class="auth-error" data-mc-error></p>
      <div class="mc-modal-actions"><span class="mc-spacer"></span>
        <button type="button" class="btn-outline" data-mc-close>Mégse</button>
        <button type="submit" class="btn-glow">${editing ? 'Mentés' : 'Hozzáadás'}</button>
      </div>
    </form>`, 'mc-form-modal');
  const form = m.card.querySelector('form');
  let currentKind = kind;

  const readTimes = () => {
    const date = mcGetVal(form, 'date');
    const start = mcGetVal(form, 'start');
    const endVal = mcGetVal(form, 'end');
    if (!date || !start) return null;
    const startsAt = new Date(`${date}T${start}:00`);
    let endsAt = null;
    if (endVal) {
      endsAt = new Date(`${date}T${endVal}:00`);
      if (endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + MC_DAY_MS);
    }
    return { startsAt, endsAt };
  };

  // Tájékoztatás arról, ki tervez még ugyanerre az időre. Nem tilt: több
  // médiás is live-olhat egyszerre, ez csak a közös szervezést segíti.
  const checkConflicts = () => {
    const box = form.querySelector('[data-mc-conflicts]');
    const t = readTimes();
    if (!t) { box.innerHTML = ''; return; }
    const s = t.startsAt.getTime();
    const e = (t.endsAt || new Date(s + 30 * 60000)).getTime();
    const who = mcGetVal(form, 'username') || owner;
    const clash = d.events.filter((x) => x.status !== 'cancelled' && x.username !== who && (!editing || x.id !== ev.id)
      && Date.parse(x.startsAt) < e && mcEnd(x).getTime() > s);
    box.innerHTML = clash.length ? `<b>Ugyanebben az időben:</b> ${clash.map((x) => `<span><i style="background:${escapeHtml(mcColor(x.username))}"></i>${escapeHtml(x.username)}: ${escapeHtml(x.title)} (${escapeHtml(mcTimeRange(x))})</span>`).join('')}` : '';
  };

  const syncKind = () => {
    form.querySelectorAll('[data-mc-kindpick]').forEach((b) => {
      b.classList.toggle('active', b.dataset.mcKindpick === currentKind);
      b.setAttribute('aria-checked', String(b.dataset.mcKindpick === currentKind));
    });
    form.querySelector('[data-mc-startlabel]').textContent = currentKind === 'live' ? 'Kezdés' : 'Megjelenés';
    form.querySelector('[data-mc-endwrap] > span').textContent = currentKind === 'live' ? 'Befejezés' : 'Befejezés (nem kötelező)';
    const start = mcGetVal(form, 'start');
    if (currentKind === 'live' && !mcGetVal(form, 'end') && start) {
      const [h, mi] = start.split(':').map(Number);
      mcSetVal(form, 'end', `${mcPad((h + 2) % 24)}:${mcPad(mi)}`);
    }
    checkConflicts();
  };

  form.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-mc-kindpick]');
    if (pick) { currentKind = pick.dataset.mcKindpick; syncKind(); return; }
    const person = e.target.closest('[data-mc-person]');
    if (person) { person.setAttribute('aria-pressed', String(person.getAttribute('aria-pressed') !== 'true')); return; }
    const delta = e.target.closest('[data-mc-stepdelta]');
    if (delta) {
      const box = delta.closest('[data-mc-stepper]');
      const v = Math.max(Number(box.dataset.min), Math.min(Number(box.dataset.max), Number(box.dataset.value) + Number(delta.dataset.mcStepdelta)));
      box.dataset.value = String(v);
      box.querySelector('b').textContent = String(v);
      form.querySelector('[data-mc-repeathint]').textContent = v ? `még ${v} héten át (összesen ${v + 1} alkalom)` : 'nem ismétlődik';
      return;
    }
    if (e.target.closest('[data-mc-close]')) m.close();
  });
  form.addEventListener('input', checkConflicts);
  form.addEventListener('mc-change', checkConflicts);
  checkConflicts();
  setTimeout(() => form.title.focus(), 30);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = form.querySelector('[data-mc-error]');
    errEl.textContent = '';
    const t = readTimes();
    if (!form.title.value.trim()) { errEl.textContent = 'Adj címet a bejegyzésnek.'; return; }
    if (!t) { errEl.textContent = 'Add meg a napot és az időpontot.'; return; }
    if (currentKind === 'live' && !t.endsAt) { errEl.textContent = 'Live-nál add meg, meddig tart.'; return; }
    const payload = {
      kind: currentKind,
      title: form.title.value,
      startsAt: t.startsAt.toISOString(),
      endsAt: t.endsAt ? t.endsAt.toISOString() : null,
      platform: mcGetVal(form, 'platform') || null,
      server: mcGetVal(form, 'server') || null,
      link: form.link.value.trim() || null,
      details: form.details.value,
      participants: [...form.querySelectorAll('[data-mc-person][aria-pressed="true"]')].map((x) => x.dataset.mcPerson)
    };
    if (form.querySelector('[data-mc-dd="username"]')) payload.username = mcGetVal(form, 'username');
    if (!editing) payload.repeatWeeks = Number(form.querySelector('[data-mc-stepper="repeat"]').dataset.value) || 0;
    if (editing) payload.status = ev.status;
    const btn = form.querySelector('button[type="submit"]');
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, true);
    const res = await mcSend(editing ? 'PUT' : 'POST', editing ? `/api/media-calendar/events/${ev.id}` : '/api/media-calendar/events', payload, errEl);
    if (typeof window.setButtonLoading === 'function') window.setButtonLoading(btn, false);
    if (!res) return;
    m.close();
    showToast(editing ? 'Mentve.' : res.events.length > 1 ? `${res.events.length} alkalom felvéve.` : 'Bejegyzés felvéve.');
    mc.cursor = mcStartOfDay(t.startsAt);
    loadMediaCalendar();
  });
}

// --- Saját vezérlők a böngésző alap select / dátum / idő elemei helyett ---

const MC_ICON = {
  chevron: '<svg class="mc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>',
  calendar: '<svg class="mc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  clock: '<svg class="mc-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  check: '<svg class="mc-ico mc-ico-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
};

// Időpontok negyedóránként; a már beállított, rácson kívüli érték is bekerül.
function mcTimeOptions(current, allowEmpty) {
  const list = [];
  for (let m = 0; m < 24 * 60; m += 15) list.push(`${mcPad(Math.floor(m / 60))}:${mcPad(m % 60)}`);
  if (current && !list.includes(current)) { list.push(current); list.sort(); }
  const opts = list.map((t) => ({ value: t, label: t }));
  return allowEmpty ? [{ value: '', label: 'Nincs megadva' }, ...opts] : opts;
}

function mcOptionLabel(o) {
  return `${o.color ? `<i class="mc-dd-dot" style="background:${escapeHtml(o.color)}"></i>` : ''}<span>${escapeHtml(o.label)}</span>`;
}

function mcDropdownHtml(name, options, value, { label = '', icon = '', compact = false } = {}) {
  const current = options.find((o) => o.value === value) || options[0];
  return `<div class="mc-dd${compact ? ' mc-dd-compact' : ''}" data-mc-dd="${escapeHtml(name)}" data-value="${escapeHtml(current ? current.value : '')}">
    <button type="button" class="mc-dd-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${escapeHtml(label)}">${icon}<span class="mc-dd-val">${current ? mcOptionLabel(current) : ''}</span>${MC_ICON.chevron}</button>
    <div class="mc-dd-menu hidden" role="listbox">${options.map((o) => `<button type="button" role="option" class="mc-dd-opt" data-mc-opt="${escapeHtml(o.value)}" aria-selected="${o.value === (current && current.value)}">${mcOptionLabel(o)}</button>`).join('')}</div>
  </div>`;
}

function mcDatePickerHtml(name, value) {
  return `<div class="mc-dd mc-date" data-mc-dd="${escapeHtml(name)}" data-mc-datepicker data-value="${escapeHtml(value)}">
    <button type="button" class="mc-dd-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Nap">${MC_ICON.calendar}<span class="mc-dd-val">${escapeHtml(mcDateLabel(value))}</span>${MC_ICON.chevron}</button>
    <div class="mc-dd-menu mc-datepicker hidden" role="dialog" aria-label="Nap kiválasztása"></div>
  </div>`;
}

function mcDateLabel(value) {
  return value ? mcFmt(new Date(value + 'T00:00:00'), { year: 'numeric', month: 'short', day: 'numeric', weekday: 'short' }) : 'Válassz napot';
}

function mcGetVal(root, name) {
  const dd = root.querySelector(`[data-mc-dd="${name}"]`);
  return dd ? dd.dataset.value : '';
}

function mcSetVal(root, name, value) {
  const dd = root.querySelector(`[data-mc-dd="${name}"]`);
  if (!dd) return;
  dd.dataset.value = value;
  if (dd.hasAttribute('data-mc-datepicker')) {
    dd.querySelector('.mc-dd-val').textContent = mcDateLabel(value);
  } else {
    const opts = [...mcMenu(dd).querySelectorAll('[data-mc-opt]')];
    const opt = opts.find((b) => b.dataset.mcOpt === value);
    opts.forEach((b) => b.setAttribute('aria-selected', String(b === opt)));
    if (opt) dd.querySelector('.mc-dd-val').innerHTML = opt.innerHTML;
  }
  dd.dispatchEvent(new CustomEvent('mc-change', { bubbles: true, detail: { name, value } }));
}

// A nyitott menü a <body>-ba kerül (a blur-ös ablak és kártya különben
// levágná), ezért a menüt mindig ezen keresztül érjük el.
function mcMenu(dd) { return dd.mcMenu || (dd.mcMenu = dd.querySelector('.mc-dd-menu')); }
function mcOwner(el) {
  const menu = el.closest && el.closest('.mc-dd-menu');
  return (menu && menu.mcOwner) || (el.closest && el.closest('.mc-dd'));
}

function renderMcDatepicker(dd, monthDate) {
  const menu = mcMenu(dd);
  const selected = dd.dataset.value;
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const start = mcStartOfWeek(first);
  const today = new Date();
  let days = '';
  for (let i = 0; i < 42; i++) {
    const day = mcAddDays(start, i);
    const key = mcDayKey(day);
    days += `<button type="button" class="mc-dp-day${day.getMonth() !== first.getMonth() ? ' other' : ''}${mcSameDay(day, today) ? ' today' : ''}${key === selected ? ' selected' : ''}" data-mc-dpday="${key}">${day.getDate()}</button>`;
  }
  menu.dataset.month = mcDayKey(first);
  menu.innerHTML = `<div class="mc-dp-head">
      <button type="button" class="mc-dp-nav" data-mc-dpstep="-1" aria-label="Előző hónap">&#8249;</button>
      <b>${escapeHtml(mcFmt(first, { year: 'numeric', month: 'long' }))}</b>
      <button type="button" class="mc-dp-nav" data-mc-dpstep="1" aria-label="Következő hónap">&#8250;</button>
    </div>
    <div class="mc-dp-grid">${MC_WEEKDAYS.map((w) => `<span>${w}</span>`).join('')}${days}</div>
    <div class="mc-dp-foot"><button type="button" class="mc-link" data-mc-dpday="${mcDayKey(today)}">Ma</button></div>`;
}

function closeMcMenus(except) {
  document.querySelectorAll('.mc-dd.open').forEach((dd) => {
    if (dd === except) return;
    const menu = mcMenu(dd);
    dd.classList.remove('open');
    menu.classList.add('hidden');
    dd.appendChild(menu);
    dd.querySelector('.mc-dd-btn').setAttribute('aria-expanded', 'false');
  });
}

function placeMcMenu(dd) {
  const btn = dd.querySelector('.mc-dd-btn');
  const menu = mcMenu(dd);
  const r = btn.getBoundingClientRect();
  menu.style.minWidth = `${Math.max(r.width, dd.hasAttribute('data-mc-datepicker') ? 280 : 0)}px`;
  menu.style.left = `${Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)}px`;
  const below = window.innerHeight - r.bottom;
  if (below < Math.min(menu.scrollHeight, 280) + 12 && r.top > below) {
    menu.style.top = '';
    menu.style.bottom = `${window.innerHeight - r.top + 6}px`;
  } else {
    menu.style.bottom = '';
    menu.style.top = `${r.bottom + 6}px`;
  }
}

function openMcMenu(dd) {
  closeMcMenus(dd);
  const menu = mcMenu(dd);
  if (dd.hasAttribute('data-mc-datepicker')) renderMcDatepicker(dd, new Date((dd.dataset.value || mcDayKey(new Date())) + 'T00:00:00'));
  menu.mcOwner = dd;
  document.body.appendChild(menu);
  dd.classList.add('open');
  menu.classList.remove('hidden');
  dd.querySelector('.mc-dd-btn').setAttribute('aria-expanded', 'true');
  placeMcMenu(dd);
  const sel = menu.querySelector('[aria-selected="true"], .mc-dp-day.selected');
  if (sel) {
    menu.scrollTop = Math.max(0, sel.offsetTop - menu.clientHeight / 2 + sel.offsetHeight / 2);
    sel.focus({ preventScroll: true });
  }
}

document.addEventListener('click', (e) => {
  const dd = mcOwner(e.target);
  if (!dd) { closeMcMenus(); return; }
  if (e.target.closest('.mc-dd-btn')) {
    if (dd.classList.contains('open')) closeMcMenus(); else openMcMenu(dd);
    return;
  }
  const step = e.target.closest('[data-mc-dpstep]');
  if (step) {
    const cur = new Date(mcMenu(dd).dataset.month + 'T00:00:00');
    renderMcDatepicker(dd, new Date(cur.getFullYear(), cur.getMonth() + Number(step.dataset.mcDpstep), 1));
    return;
  }
  const day = e.target.closest('[data-mc-dpday]');
  const opt = e.target.closest('[data-mc-opt]');
  if (day || opt) {
    mcSetVal(dd.parentElement, dd.dataset.mcDd, day ? day.dataset.mcDpday : opt.dataset.mcOpt);
    closeMcMenus();
    dd.querySelector('.mc-dd-btn').focus();
  }
});

// Billentyűzet: nyilak a listában, Esc bezárja a menüt (és nem az ablakot).
document.addEventListener('keydown', (e) => {
  const dd = mcOwner(e.target);
  if (!dd) return;
  if ((e.key === 'Escape' || e.key === 'Tab') && dd.classList.contains('open')) {
    if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); }
    closeMcMenus();
    dd.querySelector('.mc-dd-btn').focus();
    return;
  }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  if (!dd.classList.contains('open')) { openMcMenu(dd); return; }
  const items = [...mcMenu(dd).querySelectorAll('[data-mc-opt], .mc-dp-day')];
  const i = items.indexOf(document.activeElement);
  const step = dd.hasAttribute('data-mc-datepicker') ? 7 : 1;
  const next = items[Math.max(0, Math.min(items.length - 1, (i < 0 ? 0 : i) + (e.key === 'ArrowDown' ? step : -step)))];
  if (next) next.focus();
}, true);

window.addEventListener('resize', () => closeMcMenus());
document.addEventListener('scroll', (e) => {
  if (!e.target.closest || !e.target.closest('.mc-dd-menu')) closeMcMenus();
}, true);

function openMcColor() {
  const d = mc.data;
  const mine = d.creators.find((c) => c.username === d.me.username);
  const current = mine ? mine.color : d.options.palette[0];
  const taken = new Map(d.creators.filter((c) => c.username !== d.me.username).map((c) => [c.color, c.username]));
  const m = mcModal(`
    <h3>Saját szín</h3>
    <p>Ezzel a színnel látszanak a bejegyzéseid mindenkinek. Két médiásnak nem lehet ugyanaz a színe.</p>
    <div class="mc-palette">${d.options.palette.map((c) => `<button type="button" class="mc-swatch${c === current ? ' active' : ''}" data-mc-swatch="${c}" style="background:${c}" ${taken.has(c) ? `disabled title="${escapeHtml(taken.get(c))} színe"` : `title="${c}"`}></button>`).join('')}
      <label class="mc-swatch mc-swatch-custom" title="Egyéni szín"><span>+</span><input type="color" value="${escapeHtml(current)}" data-mc-custom aria-label="Egyéni szín" /></label></div>
    <p class="auth-error" data-mc-error></p>
    <div class="mc-modal-actions"><span class="mc-spacer"></span><button type="button" class="btn-outline" data-mc-close>Bezárás</button></div>`);
  const save = async (color) => {
    const res = await mcSend('PUT', '/api/media-calendar/color', { color }, m.card.querySelector('[data-mc-error]'));
    if (res) { m.close(); showToast('Szín elmentve.'); loadMediaCalendar(); }
  };
  m.card.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-mc-swatch]');
    if (sw && !sw.disabled) { save(sw.dataset.mcSwatch); return; }
    if (e.target.closest('[data-mc-close]')) m.close();
  });
  m.card.querySelector('[data-mc-custom]').addEventListener('change', (e) => save(e.target.value));
}

async function mcSend(method, path, body, errEl) {
  try {
    const res = await fetch(BACKEND_URL + path, { method, headers: mcHeaders(!!body), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!data.ok) {
      if (errEl) errEl.textContent = data.message || 'Nem sikerült.';
      else showToast(data.message || 'Nem sikerült.', true);
      return null;
    }
    return data;
  } catch {
    if (errEl) errEl.textContent = 'Nem sikerült elérni a szervert.';
    else showToast('Nem sikerült elérni a szervert.', true);
    return null;
  }
}

// iCalendar fájl, hogy a médiás a saját Google/Outlook naptárába is felvehesse.
function mcDownloadIcs(events, filename) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Solaryn//Media naptar//HU', 'CALSCALE:GREGORIAN'];
  for (const ev of events) {
    const endIso = ev.endsAt || new Date(Date.parse(ev.startsAt) + 30 * 60000).toISOString();
    const desc = [mc.data.options.kinds[ev.kind], ev.platform ? mc.data.options.platforms[ev.platform] : '', ev.server || '', ev.details || ''].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', `UID:media-${ev.id}@solaryn.hu`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(ev.startsAt)}`, `DTEND:${stamp(endIso)}`, `SUMMARY:${esc(`${ev.title} (${ev.username})`)}`,
      `DESCRIPTION:${esc(desc)}`);
    if (ev.link) lines.push(`URL:${ev.link}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace(/[\\/:*?"<>|]+/g, '_');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// --- Események ---

document.querySelector('.view[data-view="mediaCalendar"]').addEventListener('click', (e) => {
  if (!mc.data) return;
  const open = e.target.closest('[data-mc-open]');
  if (open) { openMcEvent(Number(open.dataset.mcOpen)); return; }
  const dayOpen = e.target.closest('[data-mc-dayopen]');
  if (dayOpen) { openMcDay(dayOpen.dataset.mcDayopen); return; }
  const step = e.target.closest('[data-mc-step]');
  if (step) {
    const n = Number(step.dataset.mcStep);
    if (mc.view === 'month') mc.cursor = new Date(mc.cursor.getFullYear(), mc.cursor.getMonth() + n, 1);
    else mc.cursor = mcAddDays(mc.cursor, n * (mc.view === 'week' ? 7 : MC_LIST_DAYS));
    loadMediaCalendar();
    return;
  }
  if (e.target.closest('[data-mc-today]')) { mc.cursor = mcStartOfDay(new Date()); loadMediaCalendar(); return; }
  const view = e.target.closest('[data-mc-view]');
  if (view) {
    mc.view = view.dataset.mcView;
    // A havi nézetből az aktuális hónapban a mai naphoz ugrunk, máskor marad a kiválasztott nap.
    const now = new Date();
    if (mc.view !== 'month' && mc.cursor.getMonth() === now.getMonth() && mc.cursor.getFullYear() === now.getFullYear()) mc.cursor = mcStartOfDay(now);
    loadMediaCalendar();
    return;
  }
  const toggle = e.target.closest('[data-mc-toggle]');
  if (toggle) {
    const u = toggle.dataset.mcToggle;
    if (mc.hidden.has(u)) mc.hidden.delete(u); else mc.hidden.add(u);
    renderMediaCalendar();
    return;
  }
  if (e.target.closest('[data-mc-new]')) { openMcForm(null, mc.view === 'month' ? null : mc.cursor); return; }
  if (e.target.closest('[data-mc-color]')) { openMcColor(); return; }
  if (e.target.closest('[data-mc-mine]')) { mc.onlyMine = !mc.onlyMine; renderMediaCalendar(); return; }
  // Üres napra / órára kattintás: új bejegyzés arra az időpontra.
  if (!mc.data.me.edit) return;
  const cell = e.target.closest('[data-mc-day]');
  if (cell && !e.target.closest('button')) { openMcForm(null, new Date(cell.dataset.mcDay + 'T00:00:00')); return; }
  const col = e.target.closest('[data-mc-weekday]');
  if (col && e.target === col) {
    const day = new Date(col.dataset.mcWeekday + 'T00:00:00');
    const hour = Math.floor((e.offsetY / MC_HOUR_PX));
    const pre = new Date(day);
    pre.setHours(Math.max(0, Math.min(23, hour)));
    openMcFormAt(pre);
  }
});

function openMcFormAt(date) {
  openMcForm(null, date);
  const form = document.querySelector('.mc-form');
  if (form) {
    mcSetVal(form, 'start', mcTime(date));
    mcSetVal(form, 'end', mcTime(new Date(date.getTime() + 2 * 3600000)));
  }
}

document.querySelector('.view[data-view="mediaCalendar"]').addEventListener('mc-change', (e) => {
  if (e.detail.name === 'kindFilter') { mc.kind = e.detail.value; renderMediaCalendar(); }
});
