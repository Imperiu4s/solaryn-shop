// Csomagok (Vásárlás oldal + Admin > Csomagok) és a PP visszaváltása
// Egyenlegre (Egyenleg oldal + Admin > Fizetés). Az app.js globális
// segédeit használja ($, $$, session, BACKEND_URL, escapeHtml, showToast,
// confirmModal, saFetch, formatHuf, formatPp, formatMoney, approxHufText,
// cardPayment, currentPpBalance, applyPpBalance, currentWalletBalanceHuf,
// renderWalletBadge, cosmeticThumbHtml, hydrateCosmeticThumbs, RARITY_LABELS).

const BUNDLE_SLOT_LABELS = {
  head: 'Fej', back: 'Hát', body: 'Test', left_arm: 'Bal kéz', right_arm: 'Jobb kéz', main_hand: 'Kézben tartott', tail: 'Farok'
};

function bundleImageSrc(url) {
  return url ? BACKEND_URL + url : '';
}

function bundleRemainingText(endsAt) {
  if (!endsAt) return '';
  const ms = new Date(endsAt).getTime() - Date.now();
  if (!(ms > 0)) return 'Lejárt';
  const min = Math.floor(ms / 60000);
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (days > 0) return `Még ${days} nap ${hours} óra`;
  if (hours > 0) return `Még ${hours} óra ${mins} perc`;
  return `Még ${Math.max(1, mins)} perc`;
}

function bundleDateText(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('hu-HU', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function bundleItemLine(item) {
  if (item.type === 'cosmetic') {
    const c = item.cosmetic;
    if (!c) return { thumb: '', name: 'Törölt kiegészítő', meta: '' };
    const meta = [RARITY_LABELS[c.rarity] || c.rarity, BUNDLE_SLOT_LABELS[c.slot] || c.slot];
    if (item.durationDays) meta.push(`${item.durationDays} napig`);
    return { thumb: cosmeticThumbHtml({ id: c.id, name: c.name }), name: c.name, meta: meta.join(' · '), rarity: c.rarity, owned: item.owned };
  }
  if (item.type === 'pp') {
    return { thumb: '<img class="bundle-item-icon" src="assets/pp-coin.svg" alt="" />', name: formatPp(item.amount), meta: 'PrémiumPont' };
  }
  return { thumb: '<span class="bundle-item-icon bundle-item-rank" aria-hidden="true">R</span>', name: `${item.label} rang`, meta: `${item.days} nap` };
}

// ---------------------------------------------------------------------------
// Vásárlás oldal
// ---------------------------------------------------------------------------

let shopBundles = [];

function bundleBuyButtons(b) {
  if (b.maxPerUser > 0 && b.purchasedCount >= b.maxPerUser) {
    return '<button type="button" class="btn-outline bundle-btn" disabled>Már megvetted</button>';
  }
  if (b.allOwned) return '<button type="button" class="btn-outline bundle-btn" disabled>Minden darabja megvan már</button>';
  const out = [];
  if (b.pricePp) {
    const short = b.pricePp - currentPpBalance;
    out.push(short > 0
      ? `<button type="button" class="btn-glow bundle-btn" disabled>Hiányzik ${formatPp(short)}</button>`
      : `<button type="button" class="btn-glow bundle-btn" data-bundle-buy="pp" data-bundle-id="${b.id}">Megveszem ${formatPp(b.pricePp)}-ért</button>`);
  }
  if (b.priceHuf) {
    const enough = currentWalletBalanceHuf >= b.priceHuf;
    out.push(`<button type="button" class="${b.pricePp ? 'btn-outline' : 'btn-glow'} bundle-btn" data-bundle-buy="wallet" data-bundle-id="${b.id}"${enough ? '' : ' disabled'}>${enough ? `Egyenlegből (${formatHuf(b.priceHuf)})` : `Egyenlegből: nincs elég (${formatHuf(b.priceHuf)})`}</button>`);
  }
  if (b.cardPriceCents !== null) {
    const approx = approxHufText(b.cardPriceCents, b.cardCurrency);
    out.push(`<button type="button" class="${b.pricePp || b.priceHuf ? 'btn-outline' : 'btn-glow'} bundle-btn" data-bundle-buy="card" data-bundle-id="${b.id}">Kártyával (${formatMoney(b.cardPriceCents, b.cardCurrency)}${approx ? `, ${approx}` : ''})</button>`);
  }
  return out.join('');
}

function bundlePriceHtml(b) {
  const parts = [];
  if (b.pricePp) parts.push(`<b>${formatPp(b.pricePp)}</b>`);
  if (b.priceHuf) parts.push(b.pricePp ? `<span>vagy ${formatHuf(b.priceHuf)} Egyenlegből</span>` : `<b>${formatHuf(b.priceHuf)}</b>`);
  if (b.cardPriceCents !== null) {
    const card = formatMoney(b.cardPriceCents, b.cardCurrency);
    parts.push(parts.length ? `<span>vagy ${card} kártyával</span>` : `<b>${card}</b>`);
  }
  return parts.join('');
}

function bundleCardHtml(b) {
  const items = b.items.map(bundleItemLine);
  const ownedCount = items.filter((i) => i.owned).length;
  const timer = bundleRemainingText(b.endsAt);
  return `
    <article class="bundle-card" data-bundle-card="${b.id}">
      <div class="bundle-media">
        ${b.imageUrl ? `<img src="${escapeHtml(bundleImageSrc(b.imageUrl))}" alt="${escapeHtml(b.name)}" loading="lazy" />` : '<div class="bundle-media-empty"></div>'}
        ${timer ? `<span class="bundle-timer" data-bundle-ends="${escapeHtml(b.endsAt)}" title="Lejár: ${escapeHtml(bundleDateText(b.endsAt))}">${escapeHtml(timer)}</span>` : ''}
      </div>
      <div class="bundle-body">
        <h3 class="bundle-name">${escapeHtml(b.name)}</h3>
        ${b.description ? `<p class="bundle-desc">${escapeHtml(b.description)}</p>` : ''}
        <ul class="bundle-items">
          ${items.map((i) => `
            <li class="bundle-item${i.rarity ? ` rarity-${escapeHtml(i.rarity)}` : ''}">
              <span class="bundle-item-thumb">${i.thumb}</span>
              <span class="bundle-item-text"><b>${escapeHtml(i.name)}</b><small>${escapeHtml(i.meta)}</small></span>
              ${i.owned ? '<span class="bundle-owned">Megvan</span>' : ''}
            </li>`).join('')}
        </ul>
        <div class="bundle-price">${bundlePriceHtml(b)}</div>
        <div class="bundle-actions">${bundleBuyButtons(b)}</div>
        ${ownedCount ? `<p class="bundle-note">${ownedCount === items.length ? 'Minden kiegészítője megvan már.' : 'Ami már megvan, az nem kerül hozzád még egyszer.'}</p>` : ''}
      </div>
    </article>`;
}

function renderBundleShelf() {
  const shelf = $('#bundleShelf');
  if (!shelf) return;
  if (!shopBundles.length) {
    shelf.classList.add('hidden');
    shelf.innerHTML = '';
    return;
  }
  shelf.classList.remove('hidden');
  shelf.innerHTML = `
    <h2 class="bundle-shelf-title">Csomagok</h2>
    ${shopBundles.map(bundleCardHtml).join('')}
    <h2 class="bundle-shelf-title">PrémiumPont</h2>`;
  hydrateCosmeticThumbs(shelf);
}

async function loadBundleShelf() {
  try {
    const res = await fetch(BACKEND_URL + '/api/bundles', session ? { headers: { Authorization: 'Bearer ' + session.token } } : undefined);
    const data = await res.json();
    shopBundles = data.ok && Array.isArray(data.bundles) ? data.bundles : [];
  } catch {
    shopBundles = [];
  }
  renderBundleShelf();
}

setInterval(() => {
  $$('.bundle-timer[data-bundle-ends]').forEach((el) => {
    const text = bundleRemainingText(el.dataset.bundleEnds);
    if (el.textContent !== text) el.textContent = text;
    if (text === 'Lejárt') el.closest('.bundle-card')?.classList.add('is-expired');
  });
}, 30000);

function bundleWaiverModal(name, price, viaWallet) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card waiver-modal">
        <h3>Vásárlás</h3>
        <p class="waiver-item"><span>${escapeHtml(name)}</span><b>${escapeHtml(price)}</b></p>
        <p class="waiver-text">${viaWallet ? '' : 'A fizetést a Tebex bonyolítja, euróban. '}Ez digitális tartalom, amit a fizetés után azonnal jóváírunk. Ehhez a beleegyezésed kell:</p>
        <label class="check-row waiver-check">
          <input type="checkbox" data-waiver-check />
          <span>Kérem a teljesítés azonnali megkezdését, és tudomásul veszem, hogy ezzel elveszítem a 14 napos elállási jogomat.</span>
        </label>
        <p class="waiver-links">Részletek: <a href="#legal" data-waiver-legal="aszf">ÁSZF</a></p>
        <div class="modal-actions">
          <button type="button" class="btn-outline" data-waiver-cancel>Mégse</button>
          <button type="button" class="btn-glow" data-waiver-ok style="margin-top:0;" disabled>${viaWallet ? 'Vásárlás az Egyenlegből' : 'Tovább a fizetéshez'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const check = overlay.querySelector('[data-waiver-check]');
    const okBtn = overlay.querySelector('[data-waiver-ok]');
    const finish = (result) => { overlay.remove(); resolve(result); };
    check.addEventListener('change', () => { okBtn.disabled = !check.checked; });
    okBtn.addEventListener('click', () => finish(check.checked));
    overlay.querySelector('[data-waiver-cancel]').addEventListener('click', () => finish(false));
    overlay.querySelector('[data-waiver-legal]').addEventListener('click', (e) => { e.preventDefault(); openLegalModal('aszf'); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
  });
}

function showBundleSuccess(b) {
  const hasCosmetic = b.items.some((i) => i.type === 'cosmetic');
  const hasRank = b.items.some((i) => i.type === 'rank');
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
      <h3>Megvetted: ${escapeHtml(b.name)}</h3>
      <p>${hasCosmetic ? 'A kiegészítők már a fiókodban vannak, a Kiegészítők oldalon fel is veheted őket.' : 'A csomag tartalma már a fiókodban van.'}${hasRank ? ' A rangot a szerver pár másodpercen belül megadja.' : ''}</p>
      <div class="modal-actions">
        <button type="button" class="btn-outline" data-close>Rendben</button>
        ${hasCosmetic ? '<button type="button" class="btn-glow" data-go style="margin-top:0;">Kiegészítőkhöz</button>' : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('[data-close]').addEventListener('click', close);
  overlay.querySelector('[data-go]')?.addEventListener('click', () => { close(); switchView('cosmetics'); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

async function buyBundle(b, method, btn) {
  if (!session || !session.token) {
    showToast('A vásárláshoz jelentkezz be.', true);
    return;
  }
  if (method === 'pp') {
    const ok = await confirmModal('Csomag vásárlása', `<b>${escapeHtml(b.name)}</b> - ${formatPp(b.pricePp)}. A tartalma azonnal a fiókodba kerül.`, 'Megveszem');
    if (!ok) return;
  } else if (method === 'wallet') {
    if (!(await bundleWaiverModal(b.name, formatHuf(b.priceHuf), true))) return;
  } else {
    const approx = approxHufText(b.cardPriceCents, b.cardCurrency);
    if (!(await bundleWaiverModal(b.name, formatMoney(b.cardPriceCents, b.cardCurrency) + (approx ? ` (${approx})` : ''), false))) return;
  }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = method === 'card' ? 'Átirányítás...' : 'Vásárlás...';
  try {
    const path = method === 'card' ? `/api/bundles/${b.id}/checkout` : `/api/bundles/${b.id}/buy`;
    const body = method === 'card'
      ? { withdrawalWaiver: true, returnUrl: window.location.origin + window.location.pathname }
      : { method, withdrawalWaiver: method === 'wallet' };
    const res = await fetch(BACKEND_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.token },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || 'Nem sikerült a vásárlás.');
    if (method === 'card') {
      window.location.href = data.url;
      return;
    }
    if (typeof data.ppBalance === 'number') applyPpBalance(data.ppBalance);
    if (typeof data.walletBalanceHuf === 'number') {
      currentWalletBalanceHuf = data.walletBalanceHuf;
      renderWalletBadge();
    }
    showBundleSuccess(b);
    loadBundleShelf();
  } catch (err) {
    showToast(err.message || 'Nem sikerült elérni a szervert.', true);
    btn.disabled = false;
    btn.textContent = original;
  }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-bundle-buy]');
  if (!btn || btn.disabled) return;
  const b = shopBundles.find((x) => x.id === Number(btn.dataset.bundleId));
  if (b) buyBundle(b, btn.dataset.bundleBuy, btn);
});

// ---------------------------------------------------------------------------
// PP visszaváltása Egyenlegre (Egyenleg oldal)
// ---------------------------------------------------------------------------

let ppExchange = null;

function ppExchangeMaxPp() {
  if (!ppExchange) return 0;
  const { ppStep, hufStep, remainingTodayHuf } = ppExchange;
  const byBalance = Math.floor(currentPpBalance / ppStep) * ppStep;
  const byLimit = Math.floor(remainingTodayHuf / hufStep) * ppStep;
  return Math.max(0, Math.min(byBalance, byLimit));
}

const ppToHuf = (pp) => (pp / ppExchange.ppStep) * ppExchange.hufStep;

function renderPpExchange() {
  const card = $('#ppExchangeCard');
  if (!card) return;
  if (!ppExchange || (!ppExchange.enabled && !ppExchange.paused)) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  const x = ppExchange;
  const rate = `${formatPp(x.ppStep)} = ${formatHuf(x.hufStep)}`;
  if (x.paused) {
    card.innerHTML = `
      <div class="redeem-icon pp-exchange-icon"><img src="assets/pp-coin.svg" alt="" /></div>
      <div class="pp-exchange-title">PrémiumPont visszaváltása</div>
      <p class="transfer-fee-note">Amíg PP-akció van érvényben, a visszaváltás szünetel.</p>`;
    return;
  }
  const max = ppExchangeMaxPp();
  const presets = [...new Set([x.minPp, 1000, 2000, 5000, 10000].filter((v) => v >= x.minPp && v % x.ppStep === 0))].sort((a, b) => a - b).slice(0, 4);
  card.innerHTML = `
    <div class="redeem-icon pp-exchange-icon"><img src="assets/pp-coin.svg" alt="" /></div>
    <div class="pp-exchange-title">PrémiumPont visszaváltása</div>
    <p class="transfer-fee-note">Árfolyam: <b>${rate}</b>. 24 órán belül még <b>${formatHuf(x.remainingTodayHuf)}</b> váltható vissza.</p>
    <label for="ppExchangeInput">Visszaváltandó PrémiumPont</label>
    <div class="topup-presets" id="ppExchangePresets">
      ${presets.map((v) => `
        <button type="button" class="topup-preset" data-exchange-pp="${v}"${v > max ? ' disabled' : ''}>
          <b>${formatPp(v)}</b><span>${formatHuf(ppToHuf(v))}</span>
        </button>`).join('')}
    </div>
    <input type="number" id="ppExchangeInput" placeholder="Vagy írd be (${x.ppStep} PP többszörösét)" min="${x.minPp}" step="${x.ppStep}" ${max > 0 ? `max="${max}"` : ''} />
    <div class="transfer-fee-note" id="ppExchangePreview"></div>
    <button type="button" class="btn-glow btn-glow-orange" id="btnPpExchange">Visszaváltás</button>
    <p class="redeem-result" id="ppExchangeResult"></p>`;
  updatePpExchangePreview();
}

function updatePpExchangePreview() {
  const input = $('#ppExchangeInput');
  const preview = $('#ppExchangePreview');
  if (!input || !preview || !ppExchange) return;
  const pp = parseInt(input.value, 10);
  const max = ppExchangeMaxPp();
  let ok = false;
  if (!Number.isInteger(pp) || pp <= 0) {
    preview.textContent = max >= ppExchange.minPp
      ? `Legalább ${formatPp(ppExchange.minPp)}, legfeljebb ${formatPp(max)} váltható most.`
      : (currentPpBalance < ppExchange.minPp ? `Legalább ${formatPp(ppExchange.minPp)} kell a visszaváltáshoz.` : 'Mára elérted a visszaváltási keretet.');
  } else if (pp % ppExchange.ppStep !== 0) {
    preview.textContent = `${formatPp(ppExchange.ppStep)} többszörösét adhatod meg.`;
  } else if (pp < ppExchange.minPp) {
    preview.textContent = `Legalább ${formatPp(ppExchange.minPp)} kell a visszaváltáshoz.`;
  } else if (pp > currentPpBalance) {
    preview.textContent = `Nincs ennyi PrémiumPontod (${formatPp(currentPpBalance)} van).`;
  } else if (ppToHuf(pp) > ppExchange.remainingTodayHuf) {
    preview.textContent = `24 órán belül még ${formatHuf(ppExchange.remainingTodayHuf)} váltható vissza.`;
  } else {
    preview.innerHTML = `<b>${formatPp(pp)}</b> helyett <b>${formatHuf(ppToHuf(pp))}</b> kerül az Egyenlegedre.`;
    ok = true;
  }
  $('#btnPpExchange').disabled = !ok;
  $$('#ppExchangePresets [data-exchange-pp]').forEach((b) => b.classList.toggle('active', Number(b.dataset.exchangePp) === pp));
}

async function loadPpExchange() {
  try {
    const res = await fetch(BACKEND_URL + '/api/shop/pp-exchange', session ? { headers: { Authorization: 'Bearer ' + session.token } } : undefined);
    const data = await res.json();
    ppExchange = data.ok ? data : null;
    if (ppExchange && typeof data.ppBalance === 'number') applyPpBalance(data.ppBalance);
  } catch {
    ppExchange = null;
  }
  renderPpExchange();
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'ppExchangeInput') updatePpExchangePreview();
});

document.addEventListener('click', async (e) => {
  const preset = e.target.closest('[data-exchange-pp]');
  if (preset && !preset.disabled) {
    $('#ppExchangeInput').value = preset.dataset.exchangePp;
    updatePpExchangePreview();
    return;
  }
  const btn = e.target.closest('#btnPpExchange');
  if (!btn || btn.disabled || !ppExchange) return;
  const pp = parseInt($('#ppExchangeInput').value, 10);
  const huf = ppToHuf(pp);
  const ok = await confirmModal('PP visszaváltása', `<b>${formatPp(pp)}</b> helyett <b>${formatHuf(huf)}</b> kerül az Egyenlegedre. A visszaváltás nem vonható vissza.`, 'Visszaváltás');
  if (!ok) return;
  const resultEl = $('#ppExchangeResult');
  btn.disabled = true;
  try {
    const data = await saFetch('/api/shop/pp-exchange', 'POST', { pp });
    applyPpBalance(data.ppBalance);
    currentWalletBalanceHuf = data.walletBalanceHuf;
    renderWalletBadge();
    ppExchange = data;
    renderPpExchange();
    const res = $('#ppExchangeResult');
    res.textContent = `Kész: ${formatHuf(data.huf)} került az Egyenlegedre.`;
    res.className = 'redeem-result success';
  } catch (err) {
    resultEl.textContent = err.message;
    resultEl.className = 'redeem-result error';
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Admin > Fizetés: a visszaváltás beállításai
// ---------------------------------------------------------------------------

function renderPpExchangeAdmin(data) {
  const card = $('#tbxExchangeCard');
  if (!card) return;
  const s = data.settings;
  const maxHuf = Math.floor(data.maxRate * s.ppStep * 100) / 100;
  const st = data.stats30d;
  const rows = data.recent.map((r) => `
    <tr><td>${escapeHtml(formatLedgerDate(r.created_at))}</td><td>${escapeHtml(r.username)}</td><td>${formatPp(r.price_pp)}</td><td>${formatHuf(r.price_huf)}</td></tr>`).join('');
  card.innerHTML = `
    <div class="card-title">PP visszaváltása Egyenlegre</div>
    <p class="sa-muted">A játékosok a PrémiumPontjukat Egyenlegre (forintra) válthatják az Egyenleg oldalon. Az árfolyam a legolcsóbb PP-csomag ára alatt kell maradjon, különben megérné PP-t venni és visszaváltani. Most ${formatPp(s.ppStep)} legfeljebb ${String(maxHuf).replace('.', ',')} Ft-nál kevesebb lehet. Ha egy játékosra PP-akció érvényes, és emiatt túl olcsón venne PP-t, nála a visszaváltás magától szünetel.</p>
    <label class="check-row" style="margin:12px 0 4px;"><input type="checkbox" id="pxEnabled"${s.enabled ? ' checked' : ''} /> Bekapcsolva</label>
    <div class="px-grid">
      <label class="gift-modal-label">Árfolyam
        <span class="px-rate"><input type="number" id="pxPpStep" class="gift-modal-input" min="1" step="1" value="${s.ppStep}" /><span>PP =</span><input type="number" id="pxHufStep" class="gift-modal-input" min="1" step="1" value="${s.hufStep}" /><span>Ft</span></span>
      </label>
      <label class="gift-modal-label">Legkisebb visszaváltás (PP)
        <input type="number" id="pxMinPp" class="gift-modal-input" min="1" step="${s.ppStep}" value="${s.minPp}" />
      </label>
      <label class="gift-modal-label">Keret játékosonként, 24 órára (Ft)
        <input type="number" id="pxDaily" class="gift-modal-input" min="0" step="50" value="${s.dailyMaxHuf}" />
      </label>
    </div>
    <button type="button" class="btn-glow" id="pxSave">Mentés</button>
    <p class="sa-muted" style="margin-top:14px;">Elmúlt 30 nap: ${st.count} visszaváltás, ${formatPp(st.pp)} &rarr; ${formatHuf(st.huf)}.</p>
    ${rows ? `<div class="ledger-table-wrap"><table class="ledger-table tbx-table"><thead><tr><th>Idő</th><th>Játékos</th><th>PP</th><th>Egyenleg</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}`;
  $('#pxSave').addEventListener('click', async () => {
    const btn = $('#pxSave');
    btn.disabled = true;
    try {
      renderPpExchangeAdmin(await saFetch('/api/admin/pp-exchange', 'POST', {
        enabled: $('#pxEnabled').checked,
        ppStep: Number($('#pxPpStep').value),
        hufStep: Number($('#pxHufStep').value),
        minPp: Number($('#pxMinPp').value),
        dailyMaxHuf: Number($('#pxDaily').value)
      }));
      showToast('Mentve.');
    } catch (err) {
      showToast(err.message, true);
      btn.disabled = false;
    }
  });
}

async function loadPpExchangeAdmin() {
  const card = $('#tbxExchangeCard');
  if (!card) return;
  try {
    renderPpExchangeAdmin(await saFetch('/api/admin/pp-exchange'));
  } catch (err) {
    card.innerHTML = `<div class="card-title">PP visszaváltása Egyenlegre</div><p class="sa-muted" style="margin:0;">${escapeHtml(err.message)}</p>`;
  }
}

// ---------------------------------------------------------------------------
// Admin > Csomagok
// ---------------------------------------------------------------------------

const bundleAdmin = { data: null, editingId: null, draftItems: [], imageFile: null };

function bundleStatus(b) {
  if (!b.active) return ['Kikapcsolva', 'tbx-chip-off'];
  if (b.endsAt && new Date(b.endsAt).getTime() <= Date.now()) return ['Lejárt', 'tbx-chip-bad'];
  if (b.startsAt && new Date(b.startsAt).getTime() > Date.now()) return ['Időzítve', 'tbx-chip-off'];
  return b.onSale ? ['Elérhető', 'tbx-chip-ok'] : ['Nincs ára', 'tbx-chip-bad'];
}

function bundleAdminPrices(b) {
  const out = [];
  if (b.pricePp) out.push(formatPp(b.pricePp));
  if (b.priceHuf) out.push(formatHuf(b.priceHuf) + ' Egyenleg');
  if (b.tebexPackageId) {
    const pkg = (bundleAdmin.data.tebexPackages || []).find((p) => p.id === b.tebexPackageId);
    out.push(pkg ? `kártya: ${formatMoney(Math.round(pkg.price * 100), pkg.currency)}` : `kártya: #${b.tebexPackageId}`);
  }
  return out.join(' · ');
}

function renderBundleAdminList() {
  const list = $('#bundleAdminList');
  const bundles = bundleAdmin.data.bundles;
  if (!bundles.length) {
    list.innerHTML = '<p class="sa-muted">Még nincs csomag.</p>';
    return;
  }
  list.innerHTML = bundles.map((b) => {
    const [label, chip] = bundleStatus(b);
    const methods = Object.entries(b.sold.byMethod || {}).map(([m, n]) => `${{ pp: 'PP', wallet: 'Egyenleg', card: 'kártya' }[m] || m}: ${n}`).join(', ');
    return `
      <div class="bundle-admin-card${b.id === bundleAdmin.editingId ? ' is-editing' : ''}">
        <div class="bundle-admin-thumb">${b.imageUrl ? `<img src="${escapeHtml(bundleImageSrc(b.imageUrl))}" alt="" />` : ''}</div>
        <div class="bundle-admin-info">
          <div class="bundle-admin-name">${escapeHtml(b.name)} <span class="tbx-chip ${chip}">${label}</span></div>
          <div class="sa-muted">${b.items.length} tétel · ${escapeHtml(bundleAdminPrices(b) || 'nincs ár')}</div>
          <div class="sa-muted">${b.endsAt ? `Lejár: ${escapeHtml(bundleDateText(b.endsAt))}` : 'Nincs lejárat'}${b.startsAt ? ` · kezdés: ${escapeHtml(bundleDateText(b.startsAt))}` : ''}</div>
          <div class="sa-muted">Eladva: ${b.sold.count}${methods ? ` (${escapeHtml(methods)})` : ''}</div>
        </div>
        <div class="bundle-admin-actions">
          <button type="button" class="btn-outline" data-bundle-edit="${b.id}">Szerkesztés</button>
          <button type="button" class="btn-outline" data-bundle-toggle="${b.id}">${b.active ? 'Kikapcsolás' : 'Aktiválás'}</button>
        </div>
      </div>`;
  }).join('');
}

function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function bundleDraftItemLabel(item) {
  const d = bundleAdmin.data;
  if (item.type === 'cosmetic') {
    const c = d.cosmetics.find((x) => x.id === item.cosmeticId);
    return {
      thumb: c ? cosmeticThumbHtml({ id: c.id, name: c.name }) : '',
      name: c ? c.name : `#${item.cosmeticId} (törölve)`,
      meta: [c ? RARITY_LABELS[c.rarity] || c.rarity : '', c ? BUNDLE_SLOT_LABELS[c.slot] || c.slot : '', item.durationDays ? `${item.durationDays} napig` : 'a kiegészítő alap időtartama'].filter(Boolean).join(' · ')
    };
  }
  if (item.type === 'pp') return { thumb: '<img class="bundle-item-icon" src="assets/pp-coin.svg" alt="" />', name: formatPp(item.amount), meta: 'PrémiumPont' };
  const rank = d.ranks.find((r) => r.id === item.rankId);
  return { thumb: '<span class="bundle-item-icon bundle-item-rank" aria-hidden="true">R</span>', name: `${rank ? rank.label : item.rankId} rang`, meta: `${item.days} nap` };
}

function renderBundleDraftItems() {
  const wrap = $('#bundleDraftItems');
  if (!bundleAdmin.draftItems.length) {
    wrap.innerHTML = '<p class="sa-muted" style="margin:0;">Még üres. Lent adj hozzá kiegészítőt, PP-t vagy rangot.</p>';
    return;
  }
  wrap.innerHTML = `<ul class="bundle-items bundle-items-edit">${bundleAdmin.draftItems.map((item, i) => {
    const l = bundleDraftItemLabel(item);
    return `<li class="bundle-item">
      <span class="bundle-item-thumb">${l.thumb}</span>
      <span class="bundle-item-text"><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.meta)}</small></span>
      <button type="button" class="bundle-item-remove" data-draft-remove="${i}" aria-label="Eltávolítás">&times;</button>
    </li>`;
  }).join('')}</ul>`;
  hydrateCosmeticThumbs(wrap);
}

function renderBundleAddFields() {
  const type = $('#bundleAddType').value;
  const d = bundleAdmin.data;
  const fields = $('#bundleAddFields');
  if (type === 'cosmetic') {
    fields.innerHTML = `
      <input type="search" id="bundleCosmeticFilter" class="gift-modal-input" placeholder="Keresés név alapján" />
      <select id="bundleCosmeticSelect" class="gift-modal-input">${d.cosmetics.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${escapeHtml(RARITY_LABELS[c.rarity] || c.rarity)}, ${escapeHtml(BUNDLE_SLOT_LABELS[c.slot] || c.slot)})${c.enabled ? '' : ' - rejtett'}</option>`).join('')}</select>
      <input type="number" id="bundleCosmeticDays" class="gift-modal-input" min="1" max="3650" placeholder="Napok (üres: alap)" />`;
    $('#bundleCosmeticFilter').addEventListener('input', () => {
      const q = $('#bundleCosmeticFilter').value.trim().toLowerCase();
      const sel = $('#bundleCosmeticSelect');
      let firstVisible = null;
      [...sel.options].forEach((o) => {
        const show = !q || o.textContent.toLowerCase().includes(q);
        o.hidden = !show;
        if (show && !firstVisible) firstVisible = o;
      });
      if (firstVisible && sel.selectedOptions[0]?.hidden) sel.value = firstVisible.value;
    });
  } else if (type === 'pp') {
    fields.innerHTML = '<input type="number" id="bundlePpAmount" class="gift-modal-input" min="1" step="1" placeholder="Mennyiség (PP)" />';
  } else {
    fields.innerHTML = `
      <select id="bundleRankSelect" class="gift-modal-input">${d.ranks.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join('')}</select>
      <input type="number" id="bundleRankDays" class="gift-modal-input" min="1" max="365" value="30" placeholder="Napok" />`;
  }
}

function addBundleDraftItem() {
  const type = $('#bundleAddType').value;
  if (type === 'cosmetic') {
    const cosmeticId = Number($('#bundleCosmeticSelect').value);
    if (!cosmeticId) return;
    if (bundleAdmin.draftItems.some((i) => i.type === 'cosmetic' && i.cosmeticId === cosmeticId)) {
      showToast('Ez a kiegészítő már benne van.', true);
      return;
    }
    const days = parseInt($('#bundleCosmeticDays').value, 10);
    bundleAdmin.draftItems.push({ type, cosmeticId, durationDays: days > 0 ? days : null });
  } else if (type === 'pp') {
    const amount = parseInt($('#bundlePpAmount').value, 10);
    if (!(amount > 0)) { showToast('Adj meg PP-mennyiséget.', true); return; }
    bundleAdmin.draftItems.push({ type, amount });
  } else {
    const days = parseInt($('#bundleRankDays').value, 10);
    if (!(days > 0)) { showToast('Adj meg napokat.', true); return; }
    bundleAdmin.draftItems.push({ type, rankId: $('#bundleRankSelect').value, days });
  }
  renderBundleDraftItems();
}

function openBundleEditor(id) {
  const d = bundleAdmin.data;
  const b = id ? d.bundles.find((x) => x.id === id) : null;
  bundleAdmin.editingId = b ? b.id : null;
  bundleAdmin.draftItems = b ? b.items.map((i) => (i.type === 'cosmetic'
    ? { type: 'cosmetic', cosmeticId: i.cosmeticId, durationDays: i.durationDays }
    : i.type === 'pp' ? { type: 'pp', amount: i.amount } : { type: 'rank', rankId: i.rankId, days: i.days })) : [];
  bundleAdmin.imageFile = null;
  const pkgOptions = ['<option value="">Nincs kártyás fizetés</option>'].concat((d.tebexPackages || []).map((p) =>
    `<option value="${p.id}"${b && b.tebexPackageId === p.id ? ' selected' : ''}>${escapeHtml(p.name)} - ${formatMoney(Math.round(p.price * 100), p.currency)} (#${p.id})</option>`));
  if (b && b.tebexPackageId && !(d.tebexPackages || []).some((p) => p.id === b.tebexPackageId)) {
    pkgOptions.push(`<option value="${b.tebexPackageId}" selected>#${b.tebexPackageId} (nem található)</option>`);
  }
  const editor = $('#bundleEditor');
  editor.innerHTML = `
    <div class="card-title">${b ? 'Csomag szerkesztése' : 'Új csomag'}</div>
    <div class="bundle-editor-grid">
      <div>
        <label class="gift-modal-label" style="margin-top:0;" for="bundleName">Név</label>
        <input type="text" id="bundleName" class="gift-modal-input" maxlength="60" value="${escapeHtml(b ? b.name : '')}" placeholder="Pl. Halloweeni csomag" />
        <label class="gift-modal-label" for="bundleDesc">Leírás (nem kötelező)</label>
        <textarea id="bundleDesc" class="gift-modal-input" maxlength="400" rows="2" placeholder="Egy-két mondat a csomagról">${escapeHtml(b ? b.description : '')}</textarea>

        <label class="gift-modal-label">Tartalom</label>
        <div id="bundleDraftItems"></div>
        <div class="bundle-add-row">
          <select id="bundleAddType" class="gift-modal-input">
            <option value="cosmetic">Kiegészítő</option>
            <option value="pp">PrémiumPont</option>
            <option value="rank">Rang</option>
          </select>
          <div class="bundle-add-fields" id="bundleAddFields"></div>
          <button type="button" class="btn-outline" id="bundleAddItemBtn">Hozzáadás</button>
        </div>

        <label class="gift-modal-label">Ár</label>
        <div class="bundle-price-grid">
          <label class="bundle-field"><span>PrémiumPont</span><input type="number" id="bundlePricePp" class="gift-modal-input" min="1" step="1" value="${b && b.pricePp ? b.pricePp : ''}" placeholder="Pl. 1990" /></label>
          <label class="bundle-field"><span>Egyenleg (Ft)</span><input type="number" id="bundlePriceHuf" class="gift-modal-input" min="1" step="1" value="${b && b.priceHuf ? b.priceHuf : ''}" placeholder="Üres: nem vehető így" /></label>
          <label class="bundle-field bundle-field-wide"><span>Kártyás ár (meglévő Tebex-csomag ára)</span><select id="bundleTebexPkg" class="gift-modal-input">${pkgOptions.join('')}</select></label>
        </div>
        ${d.tebexError ? `<p class="tbx-help">A Tebex-csomagok most nem tölthetők be: ${escapeHtml(d.tebexError)}</p>` : '<p class="tbx-help">Kártyánál a kiválasztott Tebex-csomag kerül a kosárba, de a csomag tartalmát kapja meg a játékos. Ha csak PP-ért vehető, hagyd üresen.</p>'}

        <div class="bundle-price-grid">
          <label class="bundle-field"><span>Kezdés (üres: azonnal)</span><input type="datetime-local" id="bundleStartsAt" class="gift-modal-input" value="${isoToLocalInput(b && b.startsAt)}" /></label>
          <label class="bundle-field"><span>Lejárat (üres: nincs)</span><input type="datetime-local" id="bundleEndsAt" class="gift-modal-input" value="${isoToLocalInput(b && b.endsAt)}" /></label>
          <label class="bundle-field"><span>Játékosonként legfeljebb (0: nincs korlát)</span><input type="number" id="bundleMaxPerUser" class="gift-modal-input" min="0" max="100" value="${b ? b.maxPerUser : 1}" /></label>
          <label class="bundle-field"><span>Sorrend (kisebb elöl)</span><input type="number" id="bundleSort" class="gift-modal-input" value="${b ? b.sort : 0}" /></label>
        </div>
        <label class="check-row" style="margin-top:12px;"><input type="checkbox" id="bundleActive"${b ? (b.active ? ' checked' : '') : ''} /> Aktív (megjelenik a Vásárlás oldalon)</label>
      </div>
      <div>
        <label class="gift-modal-label" style="margin-top:0;">Kép</label>
        <div class="bundle-image-preview" id="bundleImagePreview">${b && b.imageUrl ? `<img src="${escapeHtml(bundleImageSrc(b.imageUrl))}" alt="" />` : '<span class="sa-muted">Nincs kép</span>'}</div>
        <input type="file" id="bundleImageInput" accept="image/png,image/jpeg,image/webp,image/gif" class="gift-modal-input" />
        <p class="tbx-help">16:9 arányú kép mutat a legjobban (pl. 1600x900). PNG, JPEG, WebP vagy GIF, legfeljebb 5 MB.</p>
        ${b && b.imageUrl ? '<button type="button" class="btn-outline" id="bundleImageRemove">Kép törlése</button>' : ''}
      </div>
    </div>
    <div class="modal-actions" style="margin-top:16px;">
      ${b ? '<button type="button" class="btn-outline bundle-delete" id="bundleDeleteBtn">Törlés</button>' : ''}
      <button type="button" class="btn-outline" id="bundleCancelBtn">Mégse</button>
      <button type="button" class="btn-glow" id="bundleSaveBtn" style="margin-top:0;">Mentés</button>
    </div>`;
  editor.classList.remove('hidden');
  renderBundleDraftItems();
  renderBundleAddFields();
  renderBundleAdminList();
  $('#bundleAddType').addEventListener('change', renderBundleAddFields);
  $('#bundleAddItemBtn').addEventListener('click', addBundleDraftItem);
  $('#bundleDraftItems').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-draft-remove]');
    if (!btn) return;
    bundleAdmin.draftItems.splice(Number(btn.dataset.draftRemove), 1);
    renderBundleDraftItems();
  });
  $('#bundleImageInput').addEventListener('change', () => {
    const file = $('#bundleImageInput').files[0] || null;
    bundleAdmin.imageFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = () => { $('#bundleImagePreview').innerHTML = `<img src="${reader.result}" alt="" />`; };
      reader.readAsDataURL(file);
    }
  });
  $('#bundleImageRemove')?.addEventListener('click', async () => {
    try {
      bundleAdmin.data = await saFetch(`/api/admin/bundles/${b.id}/image`, 'DELETE');
      openBundleEditor(b.id);
      showToast('Kép törölve.');
    } catch (err) {
      showToast(err.message, true);
    }
  });
  $('#bundleCancelBtn').addEventListener('click', closeBundleEditor);
  $('#bundleDeleteBtn')?.addEventListener('click', async () => {
    const sold = b.sold.count;
    const ok = await confirmModal('Csomag törlése', `Biztosan törlöd: <b>${escapeHtml(b.name)}</b>?${sold ? ` Már ${sold} játékos megvette; amit kaptak, megmarad.` : ''}`, 'Törlés');
    if (!ok) return;
    try {
      bundleAdmin.data = await saFetch(`/api/admin/bundles/${b.id}`, 'DELETE');
      closeBundleEditor();
      showToast('Csomag törölve.');
    } catch (err) {
      showToast(err.message, true);
    }
  });
  $('#bundleSaveBtn').addEventListener('click', saveBundle);
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeBundleEditor() {
  bundleAdmin.editingId = null;
  bundleAdmin.imageFile = null;
  $('#bundleEditor').classList.add('hidden');
  $('#bundleEditor').innerHTML = '';
  renderBundleAdminList();
}

async function uploadBundleImage(id, file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(BACKEND_URL + `/api/admin/bundles/${id}/image`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.token },
    body: form
  });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!data.ok) throw new Error(data.message || 'A kép feltöltése nem sikerült.');
  return data;
}

async function saveBundle() {
  const btn = $('#bundleSaveBtn');
  const localToIso = (v) => (v ? new Date(v).toISOString() : null);
  const body = {
    name: $('#bundleName').value,
    description: $('#bundleDesc').value,
    items: bundleAdmin.draftItems,
    pricePp: $('#bundlePricePp').value ? Number($('#bundlePricePp').value) : null,
    priceHuf: $('#bundlePriceHuf').value ? Number($('#bundlePriceHuf').value) : null,
    tebexPackageId: $('#bundleTebexPkg').value ? Number($('#bundleTebexPkg').value) : null,
    startsAt: localToIso($('#bundleStartsAt').value),
    endsAt: localToIso($('#bundleEndsAt').value),
    maxPerUser: Number($('#bundleMaxPerUser').value || 0),
    sort: Number($('#bundleSort').value || 0),
    active: $('#bundleActive').checked
  };
  btn.disabled = true;
  try {
    const id = bundleAdmin.editingId;
    let data = await saFetch(id ? `/api/admin/bundles/${id}` : '/api/admin/bundles', id ? 'PUT' : 'POST', body);
    if (bundleAdmin.imageFile) data = await uploadBundleImage(data.id || id, bundleAdmin.imageFile);
    bundleAdmin.data = data;
    closeBundleEditor();
    showToast('Csomag mentve.');
  } catch (err) {
    showToast(err.message, true);
    btn.disabled = false;
  }
}

async function loadBundlesAdmin() {
  try {
    bundleAdmin.data = await saFetch('/api/admin/bundles');
  } catch (err) {
    $('#bundleAdminList').innerHTML = `<p class="sa-muted">${escapeHtml(err.message)}</p>`;
    return;
  }
  if (bundleAdmin.editingId && !bundleAdmin.data.bundles.some((b) => b.id === bundleAdmin.editingId)) closeBundleEditor();
  renderBundleAdminList();
}

$('#bundleNewBtn')?.addEventListener('click', () => {
  if (bundleAdmin.data) openBundleEditor(null);
});

$('#bundleAdminList')?.addEventListener('click', async (e) => {
  const edit = e.target.closest('[data-bundle-edit]');
  if (edit) {
    openBundleEditor(Number(edit.dataset.bundleEdit));
    return;
  }
  const toggle = e.target.closest('[data-bundle-toggle]');
  if (!toggle) return;
  const b = bundleAdmin.data.bundles.find((x) => x.id === Number(toggle.dataset.bundleToggle));
  if (!b) return;
  toggle.disabled = true;
  try {
    bundleAdmin.data = await saFetch(`/api/admin/bundles/${b.id}/active`, 'POST', { active: !b.active });
    renderBundleAdminList();
    showToast(b.active ? 'Csomag kikapcsolva.' : 'Csomag aktiválva.');
  } catch (err) {
    showToast(err.message, true);
    toggle.disabled = false;
  }
});
