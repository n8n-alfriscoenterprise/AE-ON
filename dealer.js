// ══════════════════════════════════════════════════════════════
// DEALER DIRECTORY
// ══════════════════════════════════════════════════════════════

// ── MATH HELPERS ─────────────────────────────────────────────

// Haversine formula — returns distance in metres between two GPS points
function _haversineMeters(lat1, lng1, lat2, lng2){
  const R    = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a     = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Levenshtein similarity — returns 0 (nothing alike) to 1 (identical)
function _nameSimilarity(a, b){
  a = a.toLowerCase().trim();
  b = b.toLowerCase().trim();
  if(a === b) return 1;
  const la = a.length, lb = b.length;
  if(!la || !lb) return 0;
  const prev = Array.from({ length: lb + 1 }, (_, j) => j);
  const curr = new Array(lb + 1);
  for(let i = 1; i <= la; i++){
    curr[0] = i;
    for(let j = 1; j <= lb; j++){
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev.splice(0, lb + 1, ...curr);
  }
  return 1 - prev[lb] / Math.max(la, lb);
}

// ── ANALYSIS ──────────────────────────────────────────────────
// _dealerFlags: { dealerId → { incomplete, duplicate, autoInactive, dupWith } }
let _dealerFlags = {};

function analyzeDealers(activityMap){
  // activityMap: { dealerId: 'YYYY-MM-DD' } from getRecentDealerActivity, or null
  _dealerFlags = {};
  const now       = Date.now();
  const ms4Weeks  = 28 * 24 * 60 * 60 * 1000;

  dealerList.forEach(d => {
    const flags = { incomplete: false, duplicate: false, autoInactive: false, dupWith: null };

    // Incomplete: any of the critical fields is missing
    if(!d.storeName || !d.ownerName || !d.phone1 || !d.area || !d.lat || !d.lng){
      flags.incomplete = true;
    }

    // Auto-inactive: Active dealer with no invoice in the last 4 weeks
    if(activityMap && d.status === 'Active'){
      const lastDate = activityMap[d.dealerId];
      if(!lastDate || (now - new Date(lastDate).getTime()) > ms4Weeks){
        flags.autoInactive = true;
      }
    }

    _dealerFlags[d.dealerId] = flags;
  });

  // GPS duplicate: any two dealers within 30 m of each other
  const withGps = dealerList.filter(d => d.lat && d.lng);
  for(let i = 0; i < withGps.length; i++){
    for(let j = i + 1; j < withGps.length; j++){
      const dist = _haversineMeters(
        +withGps[i].lat, +withGps[i].lng,
        +withGps[j].lat, +withGps[j].lng
      );
      if(dist < 30){
        if(_dealerFlags[withGps[i].dealerId]){
          _dealerFlags[withGps[i].dealerId].duplicate = true;
          _dealerFlags[withGps[i].dealerId].dupWith   = withGps[j].storeName;
        }
        if(_dealerFlags[withGps[j].dealerId]){
          _dealerFlags[withGps[j].dealerId].duplicate = true;
          _dealerFlags[withGps[j].dealerId].dupWith   = withGps[i].storeName;
        }
      }
    }
  }
}

// ── OPEN / CLOSE ──────────────────────────────────────────────
async function openDealer(){
  showScreen('dealer-screen');
  updateFabVisibility();
  // Always start on the list — prevents the new-dealer-tab flash
  showDealerSubtab('list', document.getElementById('dlr-tab-list'));
  await loadDealers();
  // Fetch lightweight activity data for the auto-inactive badge
  try{
    const r = await api({ action: 'getRecentDealerActivity' });
    if(r.status === 'ok'){
      const map = {};
      (r.activity || []).forEach(a => { map[a.dealerId] = a.lastDate; });
      analyzeDealers(map);
    } else {
      analyzeDealers(null);
    }
  }catch(e){
    analyzeDealers(null);
  }
  renderDealerList();
}

function closeDealer(){ showHome(); }

function showDealerSubtab(tab, el){
  document.querySelectorAll('.dlr-subtab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  document.getElementById('dlr-view-list').style.display    = tab === 'list'    ? 'flex' : 'none';
  document.getElementById('dlr-view-form').style.display    = tab === 'new'     ? 'flex' : 'none';
  document.getElementById('dlr-view-profile').style.display = tab === 'profile' ? 'flex' : 'none';
  if(tab === 'list') renderDealerList();
  if(tab === 'new')  resetDealerForm();
}

// ── LOAD ──────────────────────────────────────────────────────
async function loadDealers(){
  try{
    const r = await api({ action: 'getDealers' });
    if(r.status === 'ok') dealerList = r.dealers || [];
  }catch(e){ console.error('loadDealers', e); }
}

// ── LIST ──────────────────────────────────────────────────────
function renderDealerList(){
  const body   = document.getElementById('dlr-list-body');
  const search = (document.getElementById('dlr-search')?.value || '').toLowerCase().trim();

  const visible = dealerList.filter(d => {
    if(dealerFilter !== 'All' && d.status !== dealerFilter) return false;
    if(search
      && !d.storeName.toLowerCase().includes(search)
      && !(d.ownerName || '').toLowerCase().includes(search)
      && !(d.phone1    || '').includes(search)
      && !(d.area      || '').toLowerCase().includes(search)) return false;
    return true;
  });

  // Filter chips
  const chips = document.getElementById('dlr-filter-chips');
  if(chips){
    const counts = { All: dealerList.length };
    ['Prospect','Active','On Hold','Inactive'].forEach(s => {
      counts[s] = dealerList.filter(d => d.status === s).length;
    });
    chips.innerHTML = ['All','Prospect','Active','On Hold','Inactive'].map(s => {
      const cnt = counts[s] || 0;
      if(s !== 'All' && cnt === 0) return '';
      return '<div class="dlr-chip' + (s === dealerFilter ? ' active' : '')
        + '" onclick="dealerFilter=\'' + s + '\';renderDealerList()">'
        + s + ' (' + cnt + ')</div>';
    }).join('');
  }

  if(!visible.length){
    body.innerHTML = '<div class="dlr-empty">'
      + (dealerList.length === 0
        ? 'No dealers yet.<br>Tap <strong>+ New Dealer</strong> to add your first.'
        : 'No dealers match your search.')
      + '</div>';
    return;
  }

  const statusCls = {
    Prospect: 'dlr-s-prospect', Active: 'dlr-s-active',
    'On Hold': 'dlr-s-on-hold', Inactive: 'dlr-s-inactive'
  };
  body.innerHTML = '';
  visible.sort((a, b) => a.storeName.localeCompare(b.storeName));

  visible.forEach(d => {
    const flags      = _dealerFlags[d.dealerId] || {};
    const phone1Safe = (d.phone1 || '').replace(/\s/g, '');

    // Smart badges
    let badges = '';
    if(flags.incomplete)   badges += '<span class="dlr-badge dlr-badge-incomplete">⚠ Incomplete</span>';
    if(flags.duplicate)    badges += '<span class="dlr-badge dlr-badge-duplicate">⚑ Possible Duplicate</span>';
    if(flags.autoInactive) badges += '<span class="dlr-badge dlr-badge-autoinactive">● No Recent Orders</span>';

    const card = document.createElement('div');
    card.className = 'dlr-card';
    card.onclick   = () => openDealerProfile(d);

    card.innerHTML =
      '<div class="dlr-card-row1">'
        + '<div>'
          + '<div class="dlr-store-name">' + d.storeName + '</div>'
          + '<div class="dlr-owner">' + (d.ownerName || '') + '</div>'
        + '</div>'
        + '<span class="dlr-status-badge ' + (statusCls[d.status] || 'dlr-s-prospect') + '">'
          + d.status + '</span>'
      + '</div>'
      + (badges ? '<div class="dlr-badges-wrap">' + badges + '</div>' : '')
      + '<div class="dlr-card-row2">'
        + (d.phone1
          ? '<a class="dlr-tel-link" href="tel:' + phone1Safe + '" onclick="event.stopPropagation()">📞 ' + d.phone1 + '</a>'
          : '')
        + (d.area ? '<span class="dlr-meta">📍 ' + d.area + '</span>' : '')
      + '</div>'
      + '<div class="dlr-card-row3">'
        + (d.dealerType
          ? '<span class="dlr-type-tag">' + d.dealerType + '</span>'
          : '')
        + (d.lat && d.lng
          ? '<a class="dlr-map-link" href="https://maps.google.com/?q=' + d.lat + ',' + d.lng
              + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">🗺 View on Map</a>'
          : '')
      + '</div>';

    body.appendChild(card);
  });
}

// ── PROFILE VIEW ──────────────────────────────────────────────
async function openDealerProfile(d){
  currentDealer = d;
  _renderDealerProfile(d);
  showDealerSubtab('profile', null);

  // Load last 10 orders for this dealer
  const ordersEl = document.getElementById('dlr-profile-orders');
  try{
    const r = await api({ action: 'getInvoices', dealerId: d.dealerId });
    if(r.status === 'ok'){
      _renderProfileOrders(r.invoices || []);
    } else {
      if(ordersEl) ordersEl.innerHTML = '<div class="dlr-prof-oh-empty">No order history available.</div>';
    }
  }catch(e){
    if(ordersEl) ordersEl.innerHTML = '<div class="dlr-prof-oh-empty">Could not load order history.</div>';
  }
}

function _renderDealerProfile(d){
  const flags     = _dealerFlags[d.dealerId] || {};
  const statusCls = {
    Prospect: 'dlr-s-prospect', Active: 'dlr-s-active',
    'On Hold': 'dlr-s-on-hold', Inactive: 'dlr-s-inactive'
  };
  const phone1Safe = (d.phone1 || '').replace(/\s/g, '');
  const phone2Safe = (d.phone2 || '').replace(/\s/g, '');
  const mapUrl     = (d.lat && d.lng)
    ? 'https://maps.google.com/?q=' + d.lat + ',' + d.lng
    : null;

  let badgesHtml = '';
  if(flags.incomplete)
    badgesHtml += '<span class="dlr-badge dlr-badge-incomplete">⚠ Incomplete Profile</span>';
  if(flags.duplicate)
    badgesHtml += '<span class="dlr-badge dlr-badge-duplicate">⚑ Possible Duplicate'
      + (flags.dupWith ? ' of ' + flags.dupWith : '') + '</span>';
  if(flags.autoInactive)
    badgesHtml += '<span class="dlr-badge dlr-badge-autoinactive">● No Recent Orders (4 wks)</span>';

  const content = document.getElementById('dlr-profile-content');
  if(!content) return;

  content.innerHTML = `
    <div class="dlr-prof-header">
      <div style="flex:1;min-width:0">
        <div class="dlr-prof-name">${d.storeName}</div>
        <div class="dlr-prof-owner">${d.ownerName || ''}</div>
        ${badgesHtml ? '<div class="dlr-prof-badges">' + badgesHtml + '</div>' : ''}
      </div>
      <span class="dlr-status-badge ${statusCls[d.status] || 'dlr-s-prospect'}" style="margin-left:10px;flex-shrink:0">${d.status}</span>
    </div>

    <div class="dlr-prof-section">
      <div class="dlr-prof-section-label">Contact</div>
      ${d.phone1
        ? `<a class="dlr-tel-link dlr-tel-block" href="tel:${phone1Safe}">📞 ${d.phone1}</a>`
        : '<span class="dlr-prof-missing">No phone number on record</span>'}
      ${d.phone2
        ? `<a class="dlr-tel-link dlr-tel-block" href="tel:${phone2Safe}" style="margin-top:6px">📞 ${d.phone2}</a>`
        : ''}
    </div>

    ${(d.area || d.address) ? `
    <div class="dlr-prof-section">
      <div class="dlr-prof-section-label">Location</div>
      ${d.area    ? `<div class="dlr-prof-info-row">📍 ${d.area}</div>` : ''}
      ${d.address ? `<div class="dlr-prof-address">${d.address}</div>`  : ''}
      ${mapUrl    ? `<a class="dlr-map-link" href="${mapUrl}" target="_blank" rel="noopener"
                       style="display:inline-block;margin-top:8px;font-size:12px">🗺 Open in Google Maps</a>` : ''}
    </div>` : ''}

    ${d.dealerType ? `
    <div class="dlr-prof-section">
      <div class="dlr-prof-section-label">Dealer Type</div>
      <span class="dlr-type-tag">${d.dealerType}</span>
    </div>` : ''}

    ${d.notes ? `
    <div class="dlr-prof-section">
      <div class="dlr-prof-section-label">Notes</div>
      <div class="dlr-prof-notes">${d.notes}</div>
    </div>` : ''}

    <div class="dlr-prof-section">
      <div class="dlr-prof-section-label">Last 10 Orders</div>
      <div id="dlr-profile-orders">
        <div class="dlr-prof-oh-loading">⏳ Loading order history…</div>
      </div>
    </div>
  `;
}

function _renderProfileOrders(invoices){
  const el = document.getElementById('dlr-profile-orders');
  if(!el) return;
  if(!invoices.length){
    el.innerHTML = '<div class="dlr-prof-oh-empty">No orders on record yet.</div>';
    return;
  }
  el.innerHTML = invoices.slice(0, 10).map(inv => {
    const total = Number(inv.total || inv.grandTotal || 0);
    const date  = inv.invoiceDate || inv.date || '';
    let dateStr = '—';
    if(date){
      try{ dateStr = phDate(new Date(date)); }catch(e){ dateStr = date; }
    }
    return `<div class="dlr-prof-oh-row">
      <div class="dlr-prof-oh-num">${inv.invoiceNumber || inv.invNo || '—'}</div>
      <div class="dlr-prof-oh-date">${dateStr}</div>
      <div class="dlr-prof-oh-total">₱${total.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    </div>`;
  }).join('');
}

// ── NAME SIMILARITY SUGGESTION ────────────────────────────────
function onDlrStoreNameInput(val){
  const sugg = document.getElementById('dlr-name-suggestion');
  if(!sugg) return;
  const v = val.trim();
  if(v.length < 3){ sugg.style.display = 'none'; return; }

  const matches = dealerList
    .filter(d => !currentDealer || d.dealerId !== currentDealer.dealerId)
    .map(d  => ({ name: d.storeName, score: _nameSimilarity(v, d.storeName) }))
    .filter(m => m.score >= 0.75)
    .sort((a, b) => b.score - a.score);

  if(!matches.length){ sugg.style.display = 'none'; return; }

  const top = matches[0];
  sugg.style.display = 'block';
  sugg.innerHTML = '⚠️ Similar name found: <strong>' + top.name + '</strong>'
    + (top.score >= 0.99
      ? ' — exact match, check for duplicate!'
      : ' — is this the same dealer?');
}

// ── FORM — NEW / EDIT ─────────────────────────────────────────
function resetDealerForm(){
  currentDealer = null;
  document.getElementById('dlr-form-title').textContent     = 'New Dealer';
  document.getElementById('dlr-save-btn').textContent       = '💾 Save Dealer';
  document.getElementById('dlr-delete-row').style.display   = 'none';
  document.getElementById('dlr-err').textContent            = '';
  ['dlr-store','dlr-owner','dlr-phone1','dlr-phone2',
   'dlr-area','dlr-address','dlr-notes','dlr-lat','dlr-lng','dlr-acc']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('dlr-type').value   = 'Feed Store';
  document.getElementById('dlr-status').value = 'Prospect';
  const preview = document.getElementById('dlr-loc-preview');
  if(preview){ preview.style.display = 'none'; preview.innerHTML = ''; }
  const btn = document.getElementById('dealer-pin-btn');
  if(btn){ btn.disabled = false; btn.textContent = '📍 Pin My Location'; }
  const sugg = document.getElementById('dlr-name-suggestion');
  if(sugg) sugg.style.display = 'none';
}

function openEditDealer(d){
  currentDealer = d;
  showDealerSubtab('new', document.getElementById('dlr-tab-new'));

  document.getElementById('dlr-form-title').textContent = 'Edit Dealer';
  document.getElementById('dlr-save-btn').textContent   = '💾 Update Dealer';
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('dlr-delete-row').style.display = isAdmin ? 'block' : 'none';
  document.getElementById('dlr-err').textContent = '';

  document.getElementById('dlr-store').value   = d.storeName  || '';
  document.getElementById('dlr-owner').value   = d.ownerName  || '';
  document.getElementById('dlr-phone1').value  = d.phone1     || '';
  document.getElementById('dlr-phone2').value  = d.phone2     || '';
  document.getElementById('dlr-area').value    = d.area       || '';
  document.getElementById('dlr-address').value = d.address    || '';
  document.getElementById('dlr-type').value    = d.dealerType || 'Pet Shop';
  document.getElementById('dlr-status').value  = d.status     || 'Active';
  document.getElementById('dlr-notes').value   = d.notes      || '';
  document.getElementById('dlr-lat').value     = d.lat        || '';
  document.getElementById('dlr-lng').value     = d.lng        || '';
  document.getElementById('dlr-acc').value     = d.accuracy   || '';

  const preview = document.getElementById('dlr-loc-preview');
  const btn     = document.getElementById('dealer-pin-btn');
  if(d.lat && d.lng){
    const mapUrl = 'https://maps.google.com/?q=' + d.lat + ',' + d.lng;
    preview.innerHTML = '✓ <strong>' + d.lat + ', ' + d.lng + '</strong>'
      + (d.accuracy ? ' &nbsp;(±' + d.accuracy + 'm)' : '')
      + '<br><a class="dlr-map-a" href="' + mapUrl + '" target="_blank" rel="noopener">📍 View on Google Maps →</a>';
    preview.style.display = 'block';
    if(btn) btn.textContent = '📍 Re-pin Location';
  } else {
    preview.style.display = 'none';
    if(btn) btn.textContent = '📍 Pin My Location';
  }

  // Suppress suggestion when editing (don't flag the dealer's own name)
  const sugg = document.getElementById('dlr-name-suggestion');
  if(sugg) sugg.style.display = 'none';
}

// ── GPS ───────────────────────────────────────────────────────
function pinDealerLocation(){
  if(!navigator.geolocation){
    alert('Geolocation is not supported on this device.\nPlease use a mobile device with GPS enabled.');
    return;
  }
  const btn     = document.getElementById('dealer-pin-btn');
  const preview = document.getElementById('dlr-loc-preview');
  if(btn){ btn.disabled = true; btn.textContent = '📡 Getting GPS fix...'; }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(7);
      const lng = pos.coords.longitude.toFixed(7);
      const acc = Math.round(pos.coords.accuracy);

      document.getElementById('dlr-lat').value = lat;
      document.getElementById('dlr-lng').value = lng;
      document.getElementById('dlr-acc').value = acc;

      const mapUrl = 'https://maps.google.com/?q=' + lat + ',' + lng;
      preview.innerHTML = '✓ <strong>' + lat + ', ' + lng + '</strong>'
        + ' &nbsp;(±' + acc + 'm accuracy)'
        + '<br><a class="dlr-map-a" href="' + mapUrl + '" target="_blank" rel="noopener">📍 View on Google Maps →</a>';
      preview.style.display = 'block';
      if(btn){ btn.disabled = false; btn.textContent = '📍 Re-pin Location'; }
    },
    err => {
      if(btn){ btn.disabled = false; btn.textContent = '📍 Pin My Location'; }
      const msgs = {
        1: 'Location permission denied.\nPlease tap Allow when your browser asks for location access.',
        2: 'GPS signal unavailable.\nTry stepping outside or enabling device GPS.',
        3: 'Location request timed out.\nPlease try again.'
      };
      alert(msgs[err.code] || 'Could not get location: ' + err.message);
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
  );
}

// ── SAVE ──────────────────────────────────────────────────────
async function saveDealerForm(){
  const errEl = document.getElementById('dlr-err');
  errEl.textContent = '';

  const storeName  = document.getElementById('dlr-store').value.trim();
  const ownerName  = document.getElementById('dlr-owner').value.trim();
  const phone1     = document.getElementById('dlr-phone1').value.trim();
  const phone2     = document.getElementById('dlr-phone2').value.trim();
  const area       = document.getElementById('dlr-area').value.trim();
  const address    = document.getElementById('dlr-address').value.trim();
  const dealerType = document.getElementById('dlr-type').value;
  const status     = document.getElementById('dlr-status').value;
  const notes      = document.getElementById('dlr-notes').value.trim();
  const lat        = document.getElementById('dlr-lat').value.trim();
  const lng        = document.getElementById('dlr-lng').value.trim();
  const accuracy   = document.getElementById('dlr-acc').value.trim();

  if(!storeName){ errEl.textContent = 'Store/Business name is required.'; return; }
  if(!ownerName){ errEl.textContent = 'Owner/Contact name is required.';  return; }
  if(!phone1)   { errEl.textContent = 'Primary phone is required.';       return; }
  if(!area)     { errEl.textContent = 'Area/Municipality is required.';   return; }

  const btn = document.getElementById('dlr-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Manila' });
  const payload = {
    storeName, ownerName, phone1, phone2, area, address,
    dealerType, status, notes, lat, lng, accuracy,
    updatedBy: currentUser.username, updatedAt: now
  };

  try{
    let r;
    if(currentDealer){
      r = await api({ action: 'updateDealer', dealerId: currentDealer.dealerId, ...payload });
    } else {
      r = await api({ action: 'saveDealer', addedBy: currentUser.username, addedAt: now, ...payload });
    }

    if(r.status === 'ok'){
      await loadDealers();
      analyzeDealers(null);   // re-analyse after change
      showToast(currentDealer ? storeName + ' updated ✓' : storeName + ' added to directory ✓', 'success');
      showDealerSubtab('list', document.getElementById('dlr-tab-list'));
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Could not save');
    }
  }catch(e){
    errEl.textContent = 'Network error: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = currentDealer ? '💾 Update Dealer' : '💾 Save Dealer';
}

async function deleteDealer(){
  if(!currentDealer) return;
  if(!confirm('Delete ' + currentDealer.storeName + '?\n\nThis cannot be undone.')) return;
  try{
    const r = await api({
      action: 'deleteDealer',
      dealerId: currentDealer.dealerId,
      deletedBy: currentUser.username
    });
    if(r.status === 'ok'){
      dealerList    = dealerList.filter(d => d.dealerId !== currentDealer.dealerId);
      showToast(currentDealer.storeName + ' removed from directory', 'warning');
      currentDealer = null;
      showDealerSubtab('list', document.getElementById('dlr-tab-list'));
    } else {
      alert('Error: ' + (r.msg || 'Could not delete'));
    }
  }catch(e){ alert('Network error: ' + e.message); }
}
