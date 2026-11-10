// Teendők (staff feladattábla): hibák, javaslatok, feladatok szerverenként.
// Az app.js globális segédeit használja ($, $$, session, BACKEND_URL, escapeHtml,
// showToast, confirmModal). A backend: SolarBackend/src/staffTasks.js.

const ST_KIND_EMOJI = { bug: '🐞', idea: '💡', task: '📌' };
const ST_STATUS = {
  open: { emoji: '', label: 'Nyitott' },
  progress: { emoji: '🔧', label: 'Folyamatban' },
  done: { emoji: '✅', label: 'Megcsinálva' },
  rejected: { emoji: '❌', label: 'Elvetve' }
};
const ST_PRIORITY = [
  { v: 2, label: 'Sürgős' },
  { v: 1, label: 'Normál' },
  { v: 0, label: 'Ráér' }
];
const ST_STATUS_FILTERS = [
  { v: 'todo', label: 'Teendő' },
  { v: 'progress', label: '🔧 Folyamatban' },
  { v: 'done', label: '✅ Megcsinálva' },
  { v: 'rejected', label: '❌ Elvetve' },
  { v: 'all', label: 'Mind' },
  { v: 'archive', label: 'Archívum' }
];
const ST_PREFS_KEY = 'solarcenter.staffTasks';

const stState = {
  meta: null,
  board: [],
  archive: null,
  status: 'todo',
  kind: 'all',
  server: 'all',
  category: 'all',
  group: 'server',
  sort: 'new',
  search: '',
  mine: false,
  editing: null,
  form: { kind: 'bug', priority: 1 },
  openBodies: new Set(),
  noteFor: null,
  timer: null
};

(function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(ST_PREFS_KEY) || '{}');
    for (const k of ['status', 'kind', 'server', 'category', 'group', 'sort', 'mine']) if (p[k] !== undefined) stState[k] = p[k];
  } catch {}
})();
function stSavePrefs() {
  try {
    const { status, kind, server, category, group, sort, mine } = stState;
    localStorage.setItem(ST_PREFS_KEY, JSON.stringify({ status, kind, server, category, group, sort, mine }));
  } catch {}
}

async function stApi(path, method = 'GET', body) {
  const res = await fetch(BACKEND_URL + path, {
    method,
    headers: { Authorization: 'Bearer ' + session.token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok || !data.ok) throw new Error(data.message || 'Nem sikerült, próbáld újra.');
  return data;
}

function stAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'most';
  if (min < 60) return `${min} perce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} órája`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} napja`;
  return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric' });
}
function stTime(iso) {
  return new Date(iso).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function stLeft(iso) {
  const min = Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 60000));
  if (min >= 60) return `${Math.floor(min / 60)} óra ${min % 60} perc`;
  return `${min} perc`;
}
function stDayLabel(iso) {
  const d = new Date(iso);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(new Date()) - start(d)) / 86400000);
  if (diff === 0) return 'Ma';
  if (diff === 1) return 'Tegnap';
  return d.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
}

function stIsMine(t) {
  return session && t.createdBy.toLowerCase() === String(session.username).toLowerCase();
}

// A 12 óra letelte után a táblán ne maradjon ott, akkor sem, ha még nem frissült.
function stLiveBoard() {
  const now = Date.now();
  return stState.board.filter((t) => !t.hideAt || Date.parse(t.hideAt) > now);
}

function stSource() {
  return stState.status === 'archive' ? (stState.archive || []) : stLiveBoard();
}

function stFiltered() {
  const q = stState.search.trim().toLowerCase();
  return stSource().filter((t) => {
    const s = stState.status;
    if (s === 'todo' && !(t.status === 'open' || t.status === 'progress')) return false;
    if (['progress', 'done', 'rejected'].includes(s) && t.status !== s) return false;
    if (stState.kind !== 'all' && t.kind !== stState.kind) return false;
    if (stState.server !== 'all' && t.server !== stState.server) return false;
    if (stState.category !== 'all' && t.category !== stState.category) return false;
    if (stState.mine && !stIsMine(t)) return false;
    if (q && !`${t.title} ${t.body} ${t.createdBy} ${t.statusBy || ''}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function stSorted(list) {
  const by = stState.sort;
  const time = (t) => Date.parse(t.createdAt);
  return list.slice().sort((a, b) => {
    if (by === 'old') return time(a) - time(b);
    if (by === 'prio') return (b.priority - a.priority) || (time(a) - time(b));
    return time(b) - time(a);
  });
}

function stGroups(list) {
  const m = stState.meta;
  const g = stState.group;
  if (g === 'none') return [{ key: '', label: '', items: list }];
  const order = g === 'server' ? Object.keys(m.servers) : g === 'category' ? Object.keys(m.categories) : g === 'kind' ? Object.keys(m.kinds) : null;
  const keyOf = (t) => (g === 'day' ? new Date(t.createdAt).toDateString() : t[g]);
  const labelOf = (t) => (g === 'server' ? m.servers[t.server] : g === 'category' ? m.categories[t.category]
    : g === 'kind' ? `${ST_KIND_EMOJI[t.kind]} ${m.kinds[t.kind]}` : stDayLabel(t.createdAt));
  const map = new Map();
  for (const t of list) {
    const k = keyOf(t);
    if (!map.has(k)) map.set(k, { key: k, label: labelOf(t), items: [] });
    map.get(k).items.push(t);
  }
  const groups = [...map.values()];
  if (order) groups.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  else groups.sort((a, b) => (stState.sort === 'old' ? 1 : -1) * (Date.parse(a.items[0].createdAt) - Date.parse(b.items[0].createdAt)));
  return groups;
}

function stPillsHtml(items, active, attr) {
  return items.map((i) => `<button type="button" class="pill${String(i.v) === String(active) ? ' active' : ''}" data-${attr}="${escapeHtml(String(i.v))}" aria-pressed="${String(i.v) === String(active)}">${escapeHtml(i.label)}${i.count != null ? ` <b>${i.count}</b>` : ''}</button>`).join('');
}

function stOptions(map, active, allLabel) {
  return (allLabel ? `<option value="all">${escapeHtml(allLabel)}</option>` : '')
    + Object.entries(map).map(([k, v]) => `<option value="${escapeHtml(k)}"${k === active ? ' selected' : ''}>${escapeHtml(v)}</option>`).join('');
}

function stRenderControls() {
  const m = stState.meta;
  if (!m) return;
  const live = stLiveBoard();
  const count = (fn) => live.filter(fn).length;
  const counts = {
    todo: count((t) => t.status === 'open' || t.status === 'progress'),
    progress: count((t) => t.status === 'progress'),
    done: count((t) => t.status === 'done'),
    rejected: count((t) => t.status === 'rejected'),
    all: live.length
  };
  $('#stStatusPills').innerHTML = stPillsHtml(ST_STATUS_FILTERS.map((f) => ({ ...f, count: counts[f.v] })), stState.status, 'status');
  $('#stKindPills').innerHTML = stPillsHtml([{ v: 'all', label: 'Minden típus' }, ...Object.entries(m.kinds).map(([k, v]) => ({ v: k, label: `${ST_KIND_EMOJI[k]} ${v}` }))], stState.kind, 'kind');
  $('#stFilterServer').innerHTML = stOptions(m.servers, stState.server, 'Minden szerver');
  $('#stFilterCategory').innerHTML = stOptions(m.categories, stState.category, 'Minden kategória');
  $('#stGroup').value = stState.group;
  $('#stSort').value = stState.sort;
  $('#stMine').checked = stState.mine;

  // Szerverenkénti összesítő: hány nyitott tétel van hol (kattintva szűr).
  const perServer = {};
  for (const t of live) if (t.status === 'open' || t.status === 'progress') perServer[t.server] = (perServer[t.server] || 0) + 1;
  const parts = Object.keys(m.servers).filter((k) => perServer[k]).map((k) =>
    `<button type="button" class="tk-count${stState.server === k ? ' active' : ''}" data-count-server="${k}">${escapeHtml(m.servers[k])} <b>${perServer[k]}</b></button>`);
  $('#stCounts').innerHTML = parts.length ? parts.join('') : '<span class="tk-count-none">Nincs nyitott teendő.</span>';

  const badge = $('#navStaffTasksBadge');
  if (badge) {
    badge.textContent = String(counts.todo);
    badge.classList.toggle('hidden', !counts.todo);
  }
}

function stItemHtml(t) {
  const m = stState.meta;
  const st = ST_STATUS[t.status] || ST_STATUS.open;
  const closed = t.status === 'done' || t.status === 'rejected';
  const prio = closed ? '' : t.priority === 2 ? '<span class="tk-prio tk-prio-high">Sürgős</span>' : t.priority === 0 ? '<span class="tk-prio tk-prio-low">Ráér</span>' : '';
  const meta = [
    `${ST_KIND_EMOJI[t.kind] || ''} ${escapeHtml(m.kinds[t.kind] || t.kind)}`,
    escapeHtml(m.servers[t.server] || t.server),
    escapeHtml(m.categories[t.category] || t.category),
    `<span title="${escapeHtml(stTime(t.createdAt))}">${escapeHtml(t.createdBy)}, ${escapeHtml(stAgo(t.createdAt))}</span>`
  ].join('<i class="tk-dot" aria-hidden="true"></i>');

  let statusLine = '';
  if (t.status !== 'open' && t.statusBy) {
    statusLine = `<div class="tk-status tk-status-${t.status}"><span class="tk-emoji" aria-hidden="true">${st.emoji}</span> <b>${st.label}</b> · ${escapeHtml(t.statusBy)}, ${escapeHtml(stTime(t.statusAt))}`
      + (closed && t.hideAt && stState.status !== 'archive' ? ` · <span class="tk-left">${escapeHtml(stLeft(t.hideAt))} múlva lekerül</span>` : '')
      + (t.statusNote ? `<div class="tk-note">${escapeHtml(t.statusNote)}</div>` : '')
      + '</div>';
  }

  const body = t.body ? `<p class="tk-body${stState.openBodies.has(t.id) ? ' open' : ''}" data-body="${t.id}">${escapeHtml(t.body)}</p>` : '';

  let actions = '';
  if (stState.noteFor && stState.noteFor.id === t.id) {
    const s = stState.noteFor.status;
    actions = `<div class="tk-note-form">
      <input type="text" maxlength="500" id="stNoteInput" placeholder="${s === 'rejected' ? 'Miért vetitek el? (nem kötelező)' : 'Megjegyzés (nem kötelező)'}" />
      <button type="button" class="btn-outline" data-act="note-cancel" data-id="${t.id}">Mégse</button>
      <button type="button" class="btn-outline tk-act-${s}" data-act="note-ok" data-id="${t.id}">${ST_STATUS[s].emoji} ${s === 'rejected' ? 'Elvetés' : 'Kész'}</button>
    </div>`;
  } else if (closed) {
    actions = `<button type="button" class="btn-outline" data-act="status" data-status="open" data-id="${t.id}">Visszanyitás</button>`;
  } else {
    actions = `<button type="button" class="btn-outline tk-act-done" data-act="ask" data-status="done" data-id="${t.id}">✅ Megcsinálva</button>`
      + `<button type="button" class="btn-outline tk-act-rejected" data-act="ask" data-status="rejected" data-id="${t.id}">❌ Elvetés</button>`
      + (t.status === 'progress'
        ? `<button type="button" class="btn-outline" data-act="status" data-status="open" data-id="${t.id}">Mégsem csinálom</button>`
        : `<button type="button" class="btn-outline" data-act="status" data-status="progress" data-id="${t.id}">🔧 Elkezdem</button>`);
  }
  const own = t.canEdit && stState.status !== 'archive'
    ? `<span class="tk-own"><button type="button" class="link-btn" data-act="edit" data-id="${t.id}">Szerkesztés</button><button type="button" class="link-btn" data-act="delete" data-id="${t.id}">Törlés</button></span>`
    : '';

  return `<article class="tk-item tk-${t.status}${t.priority === 2 && !closed ? ' tk-urgent' : ''}" data-id="${t.id}">
    <div class="tk-mark" aria-hidden="true">${st.emoji || (ST_KIND_EMOJI[t.kind] || '')}</div>
    <div class="tk-main">
      <div class="tk-head"><h3 class="tk-title">${escapeHtml(t.title)}</h3>${prio}</div>
      <div class="tk-meta">${meta}</div>
      ${body}
      ${statusLine}
      <div class="tk-actions">${actions}${own}</div>
    </div>
  </article>`;
}

function stRenderList() {
  if (!stState.meta) return;
  const list = stSorted(stFiltered());
  const groups = stGroups(list);
  const empty = $('#stEmpty');
  if (!list.length) {
    $('#stList').innerHTML = '';
    empty.textContent = stState.status === 'archive' && !stState.archive ? 'Betöltés...'
      : stState.status === 'todo' && !stSource().length ? 'Nincs egyetlen teendő sem. Ha hibát találsz vagy ötleted van, vedd fel az Új bejegyzés gombbal.'
      : 'Ezekkel a szűrőkkel nincs találat.';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  $('#stList').innerHTML = groups.map((g) => `<section class="tk-group">
    ${g.label ? `<h2 class="tk-group-title">${escapeHtml(g.label)} <span>${g.items.length}</span></h2>` : ''}
    ${g.items.map(stItemHtml).join('')}
  </section>`).join('');
  const note = $('#stNoteInput');
  if (note) note.focus();
}

function stRender() {
  stRenderControls();
  stRenderList();
}

async function loadStaffTasks(opts = {}) {
  if (!session || !session.token) return;
  try {
    const data = await stApi('/api/staff/tasks');
    stState.meta = { kinds: data.kinds, servers: data.servers, categories: data.categories, holdHours: data.holdHours };
    stState.board = data.tasks;
    if (stState.status === 'archive') await stLoadArchive();
    if (!opts.quiet || $('section[data-view="staffTasks"]').classList.contains('active')) stRender();
    else stRenderControls();
  } catch (e) {
    if (!opts.quiet) {
      $('#stList').innerHTML = '';
      $('#stEmpty').textContent = e.message;
      $('#stEmpty').classList.remove('hidden');
    }
  }
  stStartTimer();
}

async function stLoadArchive() {
  const data = await stApi('/api/staff/tasks?scope=archive');
  stState.archive = data.tasks;
}

// A nav-jelvényhez (nyitott teendők száma) belépéskor, csendben.
function refreshStaffTasksBadge() {
  loadStaffTasks({ quiet: true });
}

function stStartTimer() {
  if (stState.timer) return;
  stState.timer = setInterval(() => {
    if (!session || !session.token) return;
    const active = $('section[data-view="staffTasks"]').classList.contains('active');
    if (!active) return;
    // Írás közben ne rajzoljuk újra a listát.
    if (stState.noteFor || document.activeElement?.closest?.('#stForm')) return;
    loadStaffTasks();
  }, 60000);
}

// ---- Űrlap ----------------------------------------------------------------------------------
function stRenderFormPills() {
  const m = stState.meta;
  $('#stForm [data-field="kind"]').innerHTML = stPillsHtml(Object.entries(m.kinds).map(([k, v]) => ({ v: k, label: `${ST_KIND_EMOJI[k]} ${v}` })), stState.form.kind, 'form-kind');
  $('#stForm [data-field="priority"]').innerHTML = stPillsHtml(ST_PRIORITY, stState.form.priority, 'form-priority');
}

function stOpenForm(task) {
  if (!stState.meta) return;
  stState.editing = task ? task.id : null;
  stState.form = { kind: task ? task.kind : 'bug', priority: task ? task.priority : 1 };
  $('#stFormTitle').textContent = task ? 'Bejegyzés szerkesztése' : 'Új bejegyzés';
  $('#stServer').innerHTML = (task ? '' : '<option value="" disabled selected>Válassz...</option>') + stOptions(stState.meta.servers, task ? task.server : '');
  $('#stCategory').innerHTML = (task ? '' : '<option value="" disabled selected>Válassz...</option>') + stOptions(stState.meta.categories, task ? task.category : '');
  if (!task && stState.server !== 'all') $('#stServer').value = stState.server;
  $('#stTitle').value = task ? task.title : '';
  $('#stBody').value = task ? task.body : '';
  $('#stFormMsg').textContent = '';
  $('#stFormMsg').classList.remove('error');
  stRenderFormPills();
  $('#stForm').classList.remove('hidden');
  $('#stNewBtn').classList.add('hidden');
  $('#stForm').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  $('#stTitle').focus({ preventScroll: true });
}

function stCloseForm() {
  stState.editing = null;
  $('#stForm').classList.add('hidden');
  $('#stNewBtn').classList.remove('hidden');
}

$('#stNewBtn')?.addEventListener('click', () => stOpenForm(null));
$('#stCancelBtn')?.addEventListener('click', stCloseForm);

$('#stForm')?.addEventListener('click', (e) => {
  const k = e.target.closest('[data-form-kind]');
  if (k) { stState.form.kind = k.dataset.formKind; stRenderFormPills(); return; }
  const p = e.target.closest('[data-form-priority]');
  if (p) { stState.form.priority = Number(p.dataset.formPriority); stRenderFormPills(); }
});

$('#stForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#stFormMsg');
  const body = {
    kind: stState.form.kind,
    priority: stState.form.priority,
    server: $('#stServer').value,
    category: $('#stCategory').value,
    title: $('#stTitle').value,
    body: $('#stBody').value
  };
  const btn = $('#stSaveBtn');
  btn.disabled = true;
  try {
    const editing = stState.editing;
    const data = editing
      ? await stApi('/api/staff/tasks/' + editing, 'PUT', body)
      : await stApi('/api/staff/tasks', 'POST', body);
    stState.board = editing ? stState.board.map((t) => (t.id === editing ? data.task : t)) : [data.task, ...stState.board];
    stCloseForm();
    if (!editing && !['todo', 'all'].includes(stState.status)) stState.status = 'todo';
    stRender();
    showToast(editing ? 'Mentve.' : 'Felvéve a teendők közé.');
  } catch (err) {
    msg.textContent = err.message;
    msg.classList.add('error');
  } finally {
    btn.disabled = false;
  }
});

// ---- Szűrők ---------------------------------------------------------------------------------
$('#stStatusPills')?.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  stState.status = b.dataset.status;
  stState.noteFor = null;
  stSavePrefs();
  stRender();
  if (stState.status === 'archive') {
    try { await stLoadArchive(); } catch (err) { showToast(err.message, true); }
    stRenderList();
  }
});
$('#stKindPills')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-kind]');
  if (!b) return;
  stState.kind = b.dataset.kind;
  stSavePrefs();
  stRender();
});
$('#stCounts')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-count-server]');
  if (!b) return;
  stState.server = stState.server === b.dataset.countServer ? 'all' : b.dataset.countServer;
  stSavePrefs();
  stRender();
});
for (const [id, key] of [['#stFilterServer', 'server'], ['#stFilterCategory', 'category'], ['#stGroup', 'group'], ['#stSort', 'sort']]) {
  $(id)?.addEventListener('change', (e) => { stState[key] = e.target.value; stSavePrefs(); stRender(); });
}
$('#stMine')?.addEventListener('change', (e) => { stState.mine = e.target.checked; stSavePrefs(); stRenderList(); });
$('#stSearch')?.addEventListener('input', (e) => { stState.search = e.target.value; stRenderList(); });

// ---- Tételek --------------------------------------------------------------------------------
function stFind(id) {
  return stState.board.find((t) => t.id === id) || (stState.archive || []).find((t) => t.id === id);
}

async function stSetStatus(id, status, note) {
  try {
    const data = await stApi(`/api/staff/tasks/${id}/status`, 'POST', { status, note: note || '' });
    stState.noteFor = null;
    const inBoard = stState.board.some((t) => t.id === id);
    if (inBoard) stState.board = stState.board.map((t) => (t.id === id ? data.task : t));
    else {
      // Archívumból visszanyitva: újra a táblára kerül.
      stState.archive = (stState.archive || []).filter((t) => t.id !== id);
      stState.board = [data.task, ...stState.board];
    }
    stRender();
  } catch (err) {
    showToast(err.message, true);
  }
}

$('#stList')?.addEventListener('click', async (e) => {
  const bodyEl = e.target.closest('[data-body]');
  if (bodyEl && !e.target.closest('button')) {
    const id = Number(bodyEl.dataset.body);
    if (stState.openBodies.has(id)) stState.openBodies.delete(id); else stState.openBodies.add(id);
    bodyEl.classList.toggle('open');
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const id = Number(b.dataset.id);
  const act = b.dataset.act;
  if (act === 'status') return stSetStatus(id, b.dataset.status);
  if (act === 'ask') { stState.noteFor = { id, status: b.dataset.status }; return stRenderList(); }
  if (act === 'note-cancel') { stState.noteFor = null; return stRenderList(); }
  if (act === 'note-ok') return stSetStatus(id, stState.noteFor.status, $('#stNoteInput')?.value);
  if (act === 'edit') return stOpenForm(stFind(id));
  if (act === 'delete') {
    const t = stFind(id);
    const ok = await confirmModal('Bejegyzés törlése', `Biztosan törlöd ezt: „${t ? t.title : ''}”?`, 'Törlés');
    if (!ok) return;
    try {
      await stApi('/api/staff/tasks/' + id, 'DELETE');
      stState.board = stState.board.filter((x) => x.id !== id);
      stRender();
    } catch (err) {
      showToast(err.message, true);
    }
  }
});

$('#stList')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'stNoteInput' && stState.noteFor) {
    e.preventDefault();
    stSetStatus(stState.noteFor.id, stState.noteFor.status, e.target.value);
  }
  if (e.key === 'Escape' && stState.noteFor) { stState.noteFor = null; stRenderList(); }
});
