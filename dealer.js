// ══════════════════════════════════════════════════════════════
// DEALER DIRECTORY
// ══════════════════════════════════════════════════════════════

// ── OPEN / CLOSE ──────────────────────────────────────────────
async function openDealer(){
  showScreen('dealer-screen');
  updateFabVisibility();
  // Default to New Dealer tab; if dealers already loaded switch to List
  const hasExisting = dealerList.length > 0;
  showDealerSubtab(hasExisting ? 'list' : 'new',
    document.getElementById(hasExisting ? 'dlr-tab-list' : 'dlr-tab-new'));
  await loadDealers();
  // After load, if we have dealers, go to list so staff can pick or add
  if(dealerList.length && !hasExisting){
    showDealerSubtab('list', document.getElementById('dlr-tab-list'));
  }
}

function closeDealer(){ showHome(); }

function showDealerSubtab(tab, el){
  document.querySelectorAll('.dlr-subtab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  document.getElementById('dlr-view-list').style.display = tab==='list' ? 'flex' : 'none';
  document.getElementById('dlr-view-form').style.display = tab==='new'  ? 'flex' : 'none';
  if(tab==='list')  renderDealerList();
  if(tab==='new')   resetDealerForm();
}

// ── LOAD ──────────────────────────────────────────────────────
async function loadDealers(){
  try{
    const r = await api({action:'getDealers'});
    if(r.status==='ok') dealerList = r.dealers || [];
  }catch(e){ console.error('loadDealers',e); }
}

// ── LIST ──────────────────────────────────────────────────────
function renderDealerList(){
  const body   = document.getElementById('dlr-list-body');
  const search = (document.getElementById('dlr-search')?.value||'').toLowerCase().trim();

  const visible = dealerList.filter(d=>{
    if(dealerFilter !== 'All' && d.status !== dealerFilter) return false;
    if(search && !d.storeName.toLowerCase().includes(search)
               && !d.ownerName.toLowerCase().includes(search)
               && !d.phone1.includes(search)
               && !(d.area||'').toLowerCase().includes(search)) return false;
    return true;
  });

  // Filter chips
  const chips = document.getElementById('dlr-filter-chips');
  if(chips){
    const counts = {All:dealerList.length};
    ['Prospect','Active','Inactive'].forEach(s=>{
      counts[s] = dealerList.filter(d=>d.status===s).length;
    });
    chips.innerHTML = ['All','Prospect','Active','Inactive'].map(s=>{
      const cnt = counts[s]||0;
      if(s!=='All'&&cnt===0) return '';
      return '<div class="dlr-chip'+(s===dealerFilter?' active':'')
        +'" onclick="dealerFilter=\''+s+'\';renderDealerList()">'+s+' ('+cnt+')</div>';
    }).join('');
  }

  if(!visible.length){
    body.innerHTML = '<div class="dlr-empty">'
      + (dealerList.length===0
        ? 'No dealers yet.<br>Tap <strong>+ New Dealer</strong> to add your first.'
        : 'No dealers match your search.')
      +'</div>';
    return;
  }

  const statusCls = {Prospect:'dlr-s-prospect', Active:'dlr-s-active', Inactive:'dlr-s-inactive'};
  body.innerHTML = '';
  visible.sort((a,b)=>a.storeName.localeCompare(b.storeName));
  visible.forEach(d=>{
    const card = document.createElement('div');
    card.className = 'dlr-card';
    card.onclick = () => openEditDealer(d);
    card.innerHTML =
      '<div class="dlr-card-row1">'
        +'<div>'
          +'<div class="dlr-store-name">'+d.storeName+'</div>'
          +'<div class="dlr-owner">'+d.ownerName+'</div>'
        +'</div>'
        +'<span class="dlr-status-badge '+(statusCls[d.status]||'dlr-s-prospect')+'">'+d.status+'</span>'
      +'</div>'
      +'<div class="dlr-card-row2">'
        +'<span class="dlr-meta">📞 '+d.phone1+(d.phone2?' · '+d.phone2:'')+'</span>'
        +(d.area?'<span class="dlr-meta">📍 '+d.area+'</span>':'')
      +'</div>'
      +'<div class="dlr-card-row3">'
        +(d.dealerType?'<span class="dlr-type-tag">'+d.dealerType+'</span>':'')
        +(d.lat&&d.lng
          ?'<a class="dlr-map-link" href="https://maps.google.com/?q='+d.lat+','+d.lng
            +'" target="_blank" rel="noopener" onclick="event.stopPropagation()">🗺 View on Map</a>':'')
      +'</div>';
    body.appendChild(card);
  });
}

// ── FORM — NEW / EDIT ─────────────────────────────────────────
function resetDealerForm(){
  currentDealer = null;
  document.getElementById('dlr-form-title').textContent = 'New Dealer';
  document.getElementById('dlr-save-btn').textContent   = '💾 Save Dealer';
  document.getElementById('dlr-delete-row').style.display = 'none';
  document.getElementById('dlr-err').textContent = '';
  ['dlr-store','dlr-owner','dlr-phone1','dlr-phone2',
   'dlr-area','dlr-address','dlr-notes','dlr-lat','dlr-lng','dlr-acc']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('dlr-type').value   = 'Pet Shop';
  document.getElementById('dlr-status').value = 'Prospect';
  const preview = document.getElementById('dlr-loc-preview');
  if(preview){ preview.style.display='none'; preview.innerHTML=''; }
  const btn = document.getElementById('dealer-pin-btn');
  if(btn){ btn.disabled=false; btn.textContent='📍 Pin My Location'; }
}

function openEditDealer(d){
  currentDealer = d;
  showDealerSubtab('new', document.getElementById('dlr-tab-new'));

  document.getElementById('dlr-form-title').textContent = 'Edit Dealer';
  document.getElementById('dlr-save-btn').textContent   = '💾 Update Dealer';
  const isAdmin = currentUser && currentUser.role==='admin';
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

  // Show existing GPS pin if available
  const preview = document.getElementById('dlr-loc-preview');
  const btn     = document.getElementById('dealer-pin-btn');
  if(d.lat && d.lng){
    const mapUrl = 'https://maps.google.com/?q='+d.lat+','+d.lng;
    preview.innerHTML = '✓ <strong>'+d.lat+', '+d.lng+'</strong>'
      +(d.accuracy?' &nbsp;(±'+d.accuracy+'m)':'')
      +'<br><a class="dlr-map-a" href="'+mapUrl+'" target="_blank" rel="noopener">📍 View on Google Maps →</a>';
    preview.style.display = 'block';
    if(btn) btn.textContent = '📍 Re-pin Location';
  } else {
    preview.style.display = 'none';
    if(btn) btn.textContent = '📍 Pin My Location';
  }
}

// ── GPS ───────────────────────────────────────────────────────
function pinDealerLocation(){
  if(!navigator.geolocation){
    alert('Geolocation is not supported on this device.\nPlease use a mobile device with GPS enabled.');
    return;
  }
  const btn     = document.getElementById('dealer-pin-btn');
  const preview = document.getElementById('dlr-loc-preview');
  if(btn){ btn.disabled=true; btn.textContent='📡 Getting GPS fix...'; }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(7);
      const lng = pos.coords.longitude.toFixed(7);
      const acc = Math.round(pos.coords.accuracy);

      document.getElementById('dlr-lat').value = lat;
      document.getElementById('dlr-lng').value = lng;
      document.getElementById('dlr-acc').value = acc;

      const mapUrl = 'https://maps.google.com/?q='+lat+','+lng;
      preview.innerHTML = '✓ <strong>'+lat+', '+lng+'</strong>'
        +' &nbsp;(±'+acc+'m accuracy)'
        +'<br><a class="dlr-map-a" href="'+mapUrl+'" target="_blank" rel="noopener">📍 View on Google Maps →</a>';
      preview.style.display = 'block';

      if(btn){ btn.disabled=false; btn.textContent='📍 Re-pin Location'; }
    },
    err => {
      if(btn){ btn.disabled=false; btn.textContent='📍 Pin My Location'; }
      const msgs = {
        1: 'Location permission denied.\nPlease tap Allow when your browser asks for location access.',
        2: 'GPS signal unavailable.\nTry stepping outside or enabling device GPS.',
        3: 'Location request timed out.\nPlease try again.'
      };
      alert(msgs[err.code] || 'Could not get location: '+err.message);
    },
    { enableHighAccuracy:true, timeout:20000, maximumAge:0 }
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

  if(!storeName){ errEl.textContent='Store/Business name is required.'; return; }
  if(!ownerName){ errEl.textContent='Owner/Contact name is required.';  return; }
  if(!phone1)   { errEl.textContent='Primary phone is required.';       return; }
  if(!area)     { errEl.textContent='Area/Municipality is required.';   return; }

  const btn = document.getElementById('dlr-save-btn');
  btn.disabled=true; btn.textContent='Saving...';

  const now = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'});
  const payload = {
    storeName, ownerName, phone1, phone2, area, address,
    dealerType, status, notes, lat, lng, accuracy,
    updatedBy: currentUser.username, updatedAt: now
  };

  try{
    let r;
    if(currentDealer){
      r = await api({action:'updateDealer', dealerId:currentDealer.dealerId, ...payload});
    } else {
      r = await api({action:'saveDealer', addedBy:currentUser.username, addedAt:now, ...payload});
    }

    if(r.status==='ok'){
      await loadDealers();
      showToast(currentDealer ? storeName+' updated ✓' : storeName+' added to directory ✓', 'success');
      showDealerSubtab('list', document.getElementById('dlr-tab-list'));
    } else {
      errEl.textContent = 'Error: '+(r.msg||'Could not save');
    }
  }catch(e){
    errEl.textContent = 'Network error: '+e.message;
  }
  btn.disabled=false;
  btn.textContent = currentDealer ? '💾 Update Dealer' : '💾 Save Dealer';
}

async function deleteDealer(){
  if(!currentDealer) return;
  if(!confirm('Delete '+currentDealer.storeName+'?\n\nThis cannot be undone.')) return;
  try{
    const r = await api({action:'deleteDealer', dealerId:currentDealer.dealerId, deletedBy:currentUser.username});
    if(r.status==='ok'){
      dealerList = dealerList.filter(d=>d.dealerId!==currentDealer.dealerId);
      showToast(currentDealer.storeName+' removed from directory','warning');
      currentDealer = null;
      showDealerSubtab('list', document.getElementById('dlr-tab-list'));
    } else {
      alert('Error: '+(r.msg||'Could not delete'));
    }
  }catch(e){ alert('Network error: '+e.message); }
}
