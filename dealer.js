// ══════════════════════════════════════════════════════════════
// DEALER DIRECTORY
// ══════════════════════════════════════════════════════════════

// ── MATH HELPERS ─────────────────────────────────────────────

function _haversineMeters(lat1, lng1, lat2, lng2){
  const R    = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat  = toRad(lat2 - lat1);
  const dLng  = toRad(lng2 - lng1);
  const a     = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
let _dealerFlags            = {};
let _pendingDeletionRequests = [];

function analyzeDealers(activityMap){
  _dealerFlags = {};
  const now      = Date.now();
  const ms4Weeks = 28 * 24 * 60 * 60 * 1000;

  dealerList.forEach(d => {
    const flags = { incomplete: false, duplicate: false, autoInactive: false, dupWith: null };

    if(!d.storeName || !d.ownerName || !d.phone1 || !d.area || !d.lat || !d.lng){
      flags.incomplete = true;
    }

    if(activityMap && d.status === 'Active'){
      const lastDate = activityMap[d.dealerId];
      if(!lastDate || (now - new Date(lastDate).getTime()) > ms4Weeks){
        flags.autoInactive = true;
      }
    }

    _dealerFlags[d.dealerId] = flags;
  });

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
  showDealerSubtab('list', document.getElementById('dlr-tab-list'));
  loadVehicles().then(function(){ populateVehicleSelect('dlr-vehicle', currentDealer ? currentDealer.assignedVehicle : ''); });
  await loadDealers();

  // Activity data for auto-inactive badge
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

  // Admin: load any pending deletion requests
  if(currentUser && currentUser.role === 'admin'){
    await loadPendingDeletionRequests();
  }

  renderDealerList();
}

function closeDealer(){ showHome(); }

// ── SUB-TAB SWITCHING ─────────────────────────────────────────
// IMPORTANT: showDealerSubtab never calls resetDealerForm().
// resetDealerForm is only called by openNewDealerForm() so that
// currentDealer is never wiped out mid-edit.
function showDealerSubtab(tab, el){
  document.querySelectorAll('.dlr-subtab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  document.getElementById('dlr-view-list').style.display    = tab === 'list'    ? 'flex' : 'none';
  document.getElementById('dlr-view-form').style.display    = tab === 'new'     ? 'flex' : 'none';
  document.getElementById('dlr-view-profile').style.display = tab === 'profile' ? 'flex' : 'none';
  if(tab === 'list') renderDealerList();
}

// Called only when the user explicitly taps "+ New Dealer"
function openNewDealerForm(){
  resetDealerForm();
  showDealerSubtab('new', document.getElementById('dlr-tab-new'));
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
      && !(d.storeName || '').toLowerCase().includes(search)
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
          ? '<a class="dlr-tel-link" href="tel:' + phone1Safe
              + '" onclick="event.stopPropagation()">📞 ' + d.phone1 + '</a>'
          : '')
        + (d.area ? '<span class="dlr-meta">📍 ' + d.area + '</span>' : '')
      + '</div>'
      + '<div class="dlr-card-row3">'
        + (d.dealerType ? '<span class="dlr-type-tag">' + d.dealerType + '</span>' : '')
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
    ? 'https://maps.google.com/?q=' + d.lat + ',' + d.lng : null;

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
      <span class="dlr-status-badge ${statusCls[d.status] || 'dlr-s-prospect'}"
            style="margin-left:10px;flex-shrink:0">${d.status}</span>
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
      ${d.area    ? `<div class="dlr-prof-info-row">📍 ${d.area}</div>`   : ''}
      ${d.address ? `<div class="dlr-prof-address">${d.address}</div>`    : ''}
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
    if(date){ try{ dateStr = phDate(new Date(date)); }catch(e){ dateStr = date; } }
    return `<div class="dlr-prof-oh-row">
      <div class="dlr-prof-oh-num">${inv.invoiceNumber || inv.invNo || '—'}</div>
      <div class="dlr-prof-oh-date">${dateStr}</div>
      <div class="dlr-prof-oh-total">₱${total.toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    </div>`;
  }).join('');
}

// ── NAME SUGGESTION ───────────────────────────────────────────
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
    + (top.score >= 0.99 ? ' — exact match, check for duplicate!' : ' — is this the same dealer?');
}

// ── PENDING DELETION REQUESTS (admin) ─────────────────────────
async function loadPendingDeletionRequests(){
  try{
    const r = await api({ action: 'getDealerDeletionRequests' });
    if(r.status === 'ok'){
      _pendingDeletionRequests = r.requests || [];
      renderPendingDeletionPanel();
    }
  }catch(e){ console.error('loadPendingDeletionRequests', e); }
}

function renderPendingDeletionPanel(){
  const panel = document.getElementById('dlr-pending-panel');
  if(!panel) return;

  if(!_pendingDeletionRequests.length){
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML =
    '<div class="dlr-pending-header">🚩 '
      + _pendingDeletionRequests.length
      + ' Deletion Request'
      + (_pendingDeletionRequests.length > 1 ? 's' : '')
      + ' Pending</div>'
    + _pendingDeletionRequests.map(req =>
        '<div class="dlr-pending-row">'
          + '<div class="dlr-pending-info">'
            + '<div class="dlr-pending-name">' + req.storeName + '</div>'
            + '<div class="dlr-pending-meta">Requested by ' + req.requestedBy + ' · ' + req.requestedAt + '</div>'
          + '</div>'
          + '<div class="dlr-pending-actions">'
            + '<button class="dlr-pending-approve" onclick="resolveDeletionRequest(\''
              + req.requestId + '\',\'' + req.dealerId + '\',true)">✓ Delete</button>'
            + '<button class="dlr-pending-reject" onclick="resolveDeletionRequest(\''
              + req.requestId + '\',\'' + req.dealerId + '\',false)">✕ Dismiss</button>'
          + '</div>'
        + '</div>'
      ).join('');
}

async function resolveDeletionRequest(requestId, dealerId, approve){
  const msg = approve
    ? 'Confirm deletion of this dealer.\nThis cannot be undone.'
    : 'Dismiss this deletion request?';
  if(!confirm(msg)) return;

  try{
    const r = await api({
      action: 'resolveDealerDeletion',
      requestId, dealerId, approve,
      resolvedBy: currentUser.username
    });
    if(r.status === 'ok'){
      _pendingDeletionRequests = _pendingDeletionRequests.filter(req => req.requestId !== requestId);
      if(approve){
        dealerList = dealerList.filter(d => d.dealerId !== dealerId);
        showToast('Dealer deleted ✓', 'success');
      } else {
        showToast('Request dismissed', 'info');
      }
      renderPendingDeletionPanel();
      renderDealerList();
    } else {
      alert('Error: ' + (r.msg || 'Could not process request'));
    }
  }catch(e){ alert('Network error: ' + e.message); }
}

// ── FORM — NEW / EDIT ─────────────────────────────────────────
function resetDealerForm(){
  currentDealer = null;
  document.getElementById('dlr-form-title').textContent   = 'New Dealer';
  document.getElementById('dlr-save-btn').textContent     = '💾 Save Dealer';
  document.getElementById('dlr-delete-row').style.display = 'none';
  document.getElementById('dlr-err').textContent          = '';
  ['dlr-store','dlr-owner','dlr-phone1','dlr-phone2',
   'dlr-area','dlr-address','dlr-notes','dlr-lat','dlr-lng','dlr-acc']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('dlr-type').value   = 'Feed Store';
  document.getElementById('dlr-status').value = 'Prospect';
  populateVehicleSelect('dlr-vehicle', '');
  const preview = document.getElementById('dlr-loc-preview');
  if(preview){ preview.style.display = 'none'; preview.innerHTML = ''; }
  const btn = document.getElementById('dealer-pin-btn');
  if(btn){ btn.disabled = false; btn.textContent = '📍 Pin My Location'; }
  const sugg = document.getElementById('dlr-name-suggestion');
  if(sugg) sugg.style.display = 'none';
}

function openEditDealer(d){
  // Set currentDealer FIRST — before any function that might clear it
  currentDealer = d;

  // Switch to the form view WITHOUT calling resetDealerForm
  showDealerSubtab('new', document.getElementById('dlr-tab-new'));

  document.getElementById('dlr-form-title').textContent = 'Edit Dealer';
  document.getElementById('dlr-save-btn').textContent   = '💾 Update Dealer';
  document.getElementById('dlr-err').textContent        = '';

  // Role-based delete/request row
  const isAdmin = currentUser && currentUser.role === 'admin';
  document.getElementById('dlr-delete-row').style.display    = 'block';
  document.getElementById('dlr-real-delete-btn').style.display   = isAdmin ? '' : 'none';
  document.getElementById('dlr-request-del-btn').style.display   = isAdmin ? 'none' : '';

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
  populateVehicleSelect('dlr-vehicle', d.assignedVehicle || '');

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
  const assignedVehicle = document.getElementById('dlr-vehicle') ? document.getElementById('dlr-vehicle').value : '';

  if(!storeName){ errEl.textContent = 'Store/Business name is required.'; return; }
  if(!ownerName){ errEl.textContent = 'Owner/Contact name is required.';  return; }
  if(!phone1)   { errEl.textContent = 'Primary phone is required.';       return; }
  if(!area)     { errEl.textContent = 'Area/Municipality is required.';   return; }

  const btn = document.getElementById('dlr-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Manila' });
  const payload = {
    storeName, ownerName, phone1, phone2, area, address,
    dealerType, status, notes, lat, lng, accuracy, assignedVehicle,
    updatedBy: currentUser.username, updatedAt: now
  };

  try{
    const isNew = !currentDealer;
    let r;
    if(currentDealer){
      r = await api({ action: 'updateDealer', dealerId: currentDealer.dealerId, ...payload });
    } else {
      r = await api({ action: 'saveDealer', addedBy: currentUser.username, addedAt: now, ...payload });
    }

    if(r.status === 'ok'){
      const savedDealerId = r.dealerId;
      await loadDealers();
      analyzeDealers(null);
      showToast(isNew ? storeName + ' added ✓' : storeName + ' updated ✓', 'success');

      // If launched from Sales Invoice, return there and auto-select new dealer
      if(isNew && window._invReturnAfterDealer){
        window._invReturnAfterDealer = false;
        await openInvoice();
        if(savedDealerId && typeof _selectInvDealer==='function'){
          _selectInvDealer(savedDealerId);   // sets hidden id + search text + info
        }
        return;
      }

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

// ── DELETE (admin only) ───────────────────────────────────────
async function deleteDealer(){
  if(!currentDealer){
    alert('No dealer selected.');
    return;
  }
  if(!confirm('Delete "' + currentDealer.storeName + '"?\n\nThis permanently removes the dealer from the directory and cannot be undone.')) return;

  const btn = document.getElementById('dlr-real-delete-btn');
  if(btn){ btn.disabled = true; btn.textContent = 'Deleting...'; }

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
      if(btn){ btn.disabled = false; btn.textContent = '🗑 Delete Dealer'; }
    }
  }catch(e){
    alert('Network error: ' + e.message);
    if(btn){ btn.disabled = false; btn.textContent = '🗑 Delete Dealer'; }
  }
}

// ── REQUEST DELETION (non-admin staff / drivers) ───────────────
async function requestDealerDeletion(){
  if(!currentDealer){
    alert('No dealer selected.');
    return;
  }
  if(!confirm('Submit a request to delete "' + currentDealer.storeName + '"?\n\nAn admin will review this with you before anything is removed.')) return;

  const btn = document.getElementById('dlr-request-del-btn');
  if(btn){ btn.disabled = true; btn.textContent = 'Submitting…'; }

  try{
    const r = await api({
      action: 'requestDealerDeletion',
      dealerId:    currentDealer.dealerId,
      storeName:   currentDealer.storeName,
      requestedBy: currentUser.username
    });
    if(r.status === 'ok'){
      showToast('Deletion request submitted — admin will follow up with you', 'info', 5500);
      showDealerSubtab('list', document.getElementById('dlr-tab-list'));
    } else {
      alert('Error: ' + (r.msg || 'Could not submit request'));
      if(btn){ btn.disabled = false; btn.textContent = '🚩 Request Deletion'; }
    }
  }catch(e){
    alert('Network error: ' + e.message);
    if(btn){ btn.disabled = false; btn.textContent = '🚩 Request Deletion'; }
  }
}
