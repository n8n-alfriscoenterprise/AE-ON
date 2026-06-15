// ════════════════════════════════════════════════════════
// LOAD LIST — consolidated "items to load" from Xero invoices
// Reads Sales Log - Distribution (already imported), aggregates
// by SKU for a chosen invoice date, lets the stockman tick off
// each item, pre-fill the LOAD movement form, and print a copy.
// ════════════════════════════════════════════════════════
let _llData     = null;   // last fetched payload
let _llDate     = '';     // selected invoice date (YYYY-MM-DD)
let _llChecked  = {};     // { skuCode: true } loaded-confirmation ticks
let _llExpanded = {};     // { skuCode: true } dealer breakdown expanded

function openLoadList(){
  _llChecked  = {};
  _llExpanded = {};
  _llDate     = (typeof phToday === 'function') ? phToday() : new Date().toISOString().slice(0,10);
  document.getElementById('loadlist-modal').style.display = 'flex';
  loadLoadList();
}
function closeLoadList(){ document.getElementById('loadlist-modal').style.display = 'none'; }

async function loadLoadList(){
  const body = document.getElementById('ll-body');
  body.innerHTML = '<div class="ll-loading">Loading load list…</div>';
  try{
    const r = await api({ action:'getLoadList', date:_llDate });
    if(r.status === 'ok'){
      _llData = r;
      _llDate = r.date || _llDate;   // backend may resolve to most-recent date
      renderLoadList();
    } else {
      body.innerHTML = '<div class="ll-empty">Could not load: '+(r.msg||'Unknown error')+'</div>';
    }
  }catch(e){
    body.innerHTML = '<div class="ll-empty">Network error: '+e.message+'</div>';
  }
}

function llChangeDate(v){ if(v){ _llDate = v; loadLoadList(); } }

function renderLoadList(){
  const d = _llData;
  const body = document.getElementById('ll-body');
  if(!d){ body.innerHTML=''; return; }

  const chips = (d.availableDates||[]).slice(0,8).map(function(dt){
    return '<div class="ll-date-chip'+(dt===_llDate?' active':'')+'" onclick="llChangeDate(\''+dt+'\')">'+_llFmtDate(dt)+'</div>';
  }).join('');

  let html =
    '<div class="ll-controls">'
      +'<label class="ll-date-label">Invoice date</label>'
      +'<input type="date" class="ll-date-input" value="'+_llDate+'" onchange="llChangeDate(this.value)">'
    +'</div>'
    +(chips ? '<div class="ll-date-chips">'+chips+'</div>' : '');

  if(!d.items.length){
    html += '<div class="ll-empty">No invoices found for '+_llFmtDate(_llDate)+'.<br>'
         +  'Import the day’s Xero sales first (Sales Import → Xero), then open this again.</div>';
    body.innerHTML = html;
    _llUpdateFooter();
    return;
  }

  html += '<div class="ll-stats">'
    +'<div class="ll-stat"><div class="ll-stat-val">'+d.totalBags+'</div><div class="ll-stat-lbl">To load</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+d.items.length+'</div><div class="ll-stat-lbl">Products</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+d.invoiceCount+'</div><div class="ll-stat-lbl">Invoices</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+d.dealerCount+'</div><div class="ll-stat-lbl">Dealers</div></div>'
    +'</div>';

  html += '<div class="ll-list">';
  d.items.forEach(function(it){
    const checked  = !!_llChecked[it.skuCode];
    const expanded = !!_llExpanded[it.skuCode];
    const warn = it.known ? '' : '<span class="ll-warn-tag">⚠ unknown SKU</span>';
    html += '<div class="ll-item'+(checked?' ll-checked':'')+'">'
      + '<div class="ll-item-main">'
        + '<button class="ll-check" onclick="llToggleCheck(\''+_llEsc(it.skuCode)+'\')">'+(checked?'✓':'')+'</button>'
        + '<div class="ll-item-info" onclick="llToggleExpand(\''+_llEsc(it.skuCode)+'\')">'
          + '<div class="ll-item-name">'+it.itemName+warn+'</div>'
          + '<div class="ll-item-code">'+it.skuCode+' · '+it.lines.length+' order'+(it.lines.length!==1?'s':'')+' '+(expanded?'▾':'▸')+'</div>'
        + '</div>'
        + '<div class="ll-item-qty">'+it.totalQty+'<span class="ll-item-qty-unit">bags</span></div>'
      + '</div>';
    if(expanded){
      html += '<div class="ll-breakdown">'
        + it.lines.map(function(l){
            return '<div class="ll-bd-row"><span class="ll-bd-dealer">'+(l.dealer||'—')+'</span>'
              +'<span class="ll-bd-inv">'+l.invoiceNumber+'</span>'
              +'<span class="ll-bd-qty">'+l.qty+'</span></div>';
          }).join('')
        + '</div>';
    }
    html += '</div>';
  });
  html += '</div>';

  body.innerHTML = html;
  _llUpdateFooter();
}

function llToggleCheck(sku){ _llChecked[sku]  = !_llChecked[sku];  renderLoadList(); }
function llToggleExpand(sku){ _llExpanded[sku] = !_llExpanded[sku]; renderLoadList(); }

function _llUpdateFooter(){
  const d = _llData;
  const total = d && d.items ? d.items.length : 0;
  const checkedCount = Object.keys(_llChecked).filter(function(k){ return _llChecked[k]; }).length;
  const el = document.getElementById('ll-progress');
  if(el) el.textContent = total ? (checkedCount+' / '+total+' loaded') : '';
  const pfBtn = document.getElementById('ll-prefill-btn');
  if(pfBtn) pfBtn.disabled = !total;
  const prBtn = document.getElementById('ll-print-btn');
  if(prBtn) prBtn.disabled = !total;
}

// Pre-fill the LOAD movement form with these quantities
function llPrefillLoad(){
  const d = _llData;
  if(!d || !d.items.length) return;

  // Only pre-fill SKUs that exist in the live DIST SKU Master (DIST_SKUS is
  // rebuilt from liveSKUs, so the movement form can render these rows)
  const distCodes = {};
  (typeof liveSKUs !== 'undefined' ? liveSKUs : [])
    .filter(function(s){ return s.type === 'DIST'; })
    .forEach(function(s){ distCodes[s.code] = s; });

  const matched = [], skipped = [];
  d.items.forEach(function(it){ (distCodes[it.skuCode] ? matched : skipped).push(it); });

  if(!matched.length){
    alert('None of these SKUs match your Distribution SKU Master, so the LOAD form can’t be filled.\nCheck the inventory item codes in Xero.');
    return;
  }

  const matchedBags = matched.reduce(function(s,i){ return s + i.totalQty; }, 0);
  let msg = 'Fill the LOAD form with '+matched.length+' item(s) totalling '+matchedBags+' bags for '+_llFmtDate(_llDate)+'?';
  if(skipped.length) msg += '\n\n'+skipped.length+' item(s) skipped (not in SKU Master): '+skipped.map(function(i){return i.skuCode;}).join(', ');
  msg += '\n\nThis sets the Loaded quantities — review them against the van before submitting.';
  if(!confirm(msg)) return;

  // Force the movement form into DIST + LOAD mode
  if(typeof isReturnMode !== 'undefined' && isReturnMode){
    isReturnMode = false;
    const mb = document.getElementById('mode-btn');
    if(mb){ mb.textContent = 'LOAD'; mb.className = 'mode-btn'; }
    const sb = document.getElementById('submit-btn');
    if(sb){ sb.className = 'submit-btn'; sb.textContent = 'Submit to Google Sheets'; }
  }
  if(typeof currentTab !== 'undefined') currentTab = 'dist';
  if(typeof currentCat !== 'undefined') currentCat = 'All';
  // Reflect the DIST tab as active in the UI
  const movTabs = document.querySelectorAll('#movement-area .tab');
  if(movTabs.length){ movTabs.forEach(function(t){ t.classList.remove('active'); }); movTabs[0].classList.add('active'); }

  // Merge load quantities (overwrite loaded for matched SKUs, keep others)
  matched.forEach(function(it){
    const cat = (distCodes[it.skuCode] || {}).category || '';
    if(!quantities[it.skuCode]) quantities[it.skuCode] = { loaded:0, returned:0, cat:cat };
    quantities[it.skuCode].loaded = it.totalQty;
    quantities[it.skuCode].cat = cat || quantities[it.skuCode].cat;
  });

  if(typeof buildTab === 'function') buildTab();
  else { if(typeof buildSkuList === 'function') buildSkuList(); if(typeof updateTotals === 'function') updateTotals(); }

  closeLoadList();
  if(typeof showToast === 'function')
    showToast(matched.length+' item(s) filled into LOAD form — review & submit', 'success', 4500);
}

// Print the load list on the same 58mm receipt printer (reuses receipt pipeline)
function llPrintLoadList(){
  const d = _llData;
  if(!d || !d.items.length) return;
  const pv = document.getElementById('inv-print-view');
  if(!pv){ alert('Printer view not available on this screen.'); return; }

  const rows = d.items.map(function(it){
    return '<div class="rcp-row" style="align-items:flex-start;gap:8px">'
      + '<span style="flex:1">☐ '+it.itemName+'<br><span class="rcp-sku">'+it.skuCode+'</span></span>'
      + '<span style="font-weight:700;font-size:14px;white-space:nowrap">'+it.totalQty+'</span>'
      + '</div>';
  }).join('');
  const logo = (typeof LOGO_SMALL !== 'undefined' && LOGO_SMALL)
    ? '<img src="'+LOGO_SMALL+'" style="display:block;margin:0 auto 4px;height:48px;width:48px;object-fit:contain;border-radius:6px">' : '';

  pv.innerHTML =
    '<div class="rcp-wrap">'
    + logo
    + '<div class="rcp-biz-name">ALFRISCO ENTERPRISE</div>'
    + '<div class="rcp-biz-sub">Van Load List</div>'
    + '<div class="rcp-div"></div>'
    + '<div class="rcp-row"><span>Inv. Date</span><span>'+_llFmtDate(d.date)+'</span></div>'
    + '<div class="rcp-row"><span>Products</span><span>'+d.items.length+'</span></div>'
    + '<div class="rcp-row"><span>Total Bags</span><span>'+d.totalBags+'</span></div>'
    + '<div class="rcp-row"><span>Invoices</span><span>'+d.invoiceCount+'</span></div>'
    + '<div class="rcp-div"></div>'
    + '<div class="rcp-section-label">Items to Load</div>'
    + rows
    + '<div class="rcp-div"></div>'
    + '<div style="font-size:10px;margin-top:8px">Loaded by: ____________________</div>'
    + '<div style="font-size:10px;margin-top:10px">Checked by: ___________________</div>'
    + '<div class="rcp-footer">— Alfrisco Enterprise —</div>'
    + '</div>';
  window.print();
}

function _llFmtDate(s){
  if(!s) return '—';
  if(typeof phDate === 'function'){ const x = phDate(s); if(x && x !== '—') return x; }
  return s;
}
function _llEsc(s){ return String(s).replace(/'/g, "\\'"); }
