// ════════════════════════════════════════════════════════
// LOAD LIST — consolidated "items to load" from Xero invoices,
// split per delivery vehicle. Each order is routed to a van via
// the dealer's Assigned Vehicle (Dealer Directory). The stockman
// can tick items off, override a van for the day, pre-fill the
// LOAD form for one van, and print a per-van checklist.
// ════════════════════════════════════════════════════════
let _llData     = null;   // last fetched payload {items, vehicles, ...}
let _llDate     = '';     // selected invoice date (YYYY-MM-DD)
let _llVehicle  = '';     // active tab: vehicle id | LL_UNASSIGNED | LL_ALL
let _llChecked  = {};     // { vehicle|sku: true } loaded ticks (per tab)
let _llExpanded = {};     // { vehicle|sku: true } breakdown expanded
let _llOverride = {};     // { sku|invoice|dealer: vehicleId } per-day reassignment

const LL_ALL        = '__ALL__';
const LL_UNASSIGNED = '__UNASSIGNED__';

function openLoadList(){
  _llChecked={}; _llExpanded={}; _llOverride={}; _llVehicle='';
  _llDate = (typeof phToday === 'function') ? phToday() : new Date().toISOString().slice(0,10);
  document.getElementById('loadlist-modal').style.display = 'flex';
  loadLoadList();
}
function closeLoadList(){ document.getElementById('loadlist-modal').style.display='none'; }

async function loadLoadList(){
  const body = document.getElementById('ll-body');
  body.innerHTML = '<div class="ll-loading">Loading load list…</div>';
  try{
    const r = await api({ action:'getLoadList', date:_llDate });
    if(r.status === 'ok'){
      _llData = r;
      _llDate = r.date || _llDate;
      _llVehicle = _llDefaultTab();
      renderLoadList();
    } else {
      body.innerHTML = '<div class="ll-empty">Could not load: '+(r.msg||'Unknown error')+'</div>';
    }
  }catch(e){
    body.innerHTML = '<div class="ll-empty">Network error: '+e.message+'</div>';
  }
}
function llChangeDate(v){ if(v){ _llDate=v; loadLoadList(); } }

// Effective vehicle of one order line, honoring any per-day override
function _llLineVehicle(sku, line){
  const k = sku+'|'+line.invoiceNumber+'|'+line.dealer;
  return _llOverride.hasOwnProperty(k) ? _llOverride[k] : (line.vehicle||'');
}

// Build { vehicleId|UNASSIGNED : { sku: {skuCode,itemName,known,qty,lines:[]} } }
function _llAggregate(){
  const agg = {};
  (_llData && _llData.items ? _llData.items : []).forEach(function(it){
    it.lines.forEach(function(l){
      const veh = _llLineVehicle(it.skuCode, l) || LL_UNASSIGNED;
      if(!agg[veh]) agg[veh] = {};
      if(!agg[veh][it.skuCode]) agg[veh][it.skuCode] = {skuCode:it.skuCode, itemName:it.itemName, known:it.known, qty:0, lines:[]};
      agg[veh][it.skuCode].qty += l.qty;
      agg[veh][it.skuCode].lines.push(l);
    });
  });
  return agg;
}

function _llVehLabel(id){
  if(id===LL_ALL) return 'All';
  if(id===LL_UNASSIGNED) return 'Unassigned';
  const v = ((_llData&&_llData.vehicles)||[]).find(function(x){return x.id===id;});
  return v ? v.label : id;
}

function _llDefaultTab(){
  const agg = _llAggregate();
  const vehs = (_llData&&_llData.vehicles)||[];
  for(let i=0;i<vehs.length;i++){ if(agg[vehs[i].id] && Object.keys(agg[vehs[i].id]).length) return vehs[i].id; }
  if(agg[LL_UNASSIGNED]) return LL_UNASSIGNED;
  return vehs.length ? vehs[0].id : LL_ALL;
}

function llSetTab(v){ _llVehicle=v; renderLoadList(); }

function renderLoadList(){
  const d=_llData; const body=document.getElementById('ll-body');
  if(!d){ body.innerHTML=''; return; }

  const chips=(d.availableDates||[]).slice(0,8).map(function(dt){
    return '<div class="ll-date-chip'+(dt===_llDate?' active':'')+'" onclick="llChangeDate(\''+dt+'\')">'+_llFmtDate(dt)+'</div>';
  }).join('');
  let html='<div class="ll-controls"><label class="ll-date-label">Invoice date</label>'
    +'<input type="date" class="ll-date-input" value="'+_llDate+'" onchange="llChangeDate(this.value)"></div>'
    +(chips?'<div class="ll-date-chips">'+chips+'</div>':'');

  if(!d.items.length){
    html+='<div class="ll-empty">No invoices found for '+_llFmtDate(_llDate)+'.<br>Import the day’s Xero sales first (Sales Import → Xero), then open this again.</div>';
    body.innerHTML=html; _llUpdateFooter(null); return;
  }

  const agg=_llAggregate();

  // Tabs: every configured vehicle + Unassigned (if any) + All
  const tabs=[];
  (d.vehicles||[]).forEach(function(v){ tabs.push({id:v.id, label:v.label}); });
  if(agg[LL_UNASSIGNED]) tabs.push({id:LL_UNASSIGNED, label:'Unassigned'});
  tabs.push({id:LL_ALL, label:'All'});
  if(!tabs.find(function(t){return t.id===_llVehicle;})) _llVehicle=tabs[0].id;

  html+='<div class="ll-veh-tabs">'+tabs.map(function(t){
    const count = t.id===LL_ALL ? d.items.length : (agg[t.id]?Object.keys(agg[t.id]).length:0);
    const cls = (t.id===_llVehicle?' active':'') + (t.id===LL_UNASSIGNED?' ll-veh-tab-unassigned':'');
    return '<div class="ll-veh-tab'+cls+'" onclick="llSetTab(\''+t.id+'\')">'+t.label
      +'<span class="ll-veh-tab-count">'+count+'</span></div>';
  }).join('')+'</div>';

  const active=_llVehicle;
  let viewItems=[];
  if(active===LL_ALL){
    const merged={};
    Object.keys(agg).forEach(function(veh){
      Object.keys(agg[veh]).forEach(function(sku){
        const e=agg[veh][sku];
        if(!merged[sku]) merged[sku]={skuCode:sku,itemName:e.itemName,known:e.known,qty:0,lines:[]};
        merged[sku].qty+=e.qty;
        e.lines.forEach(function(l){ merged[sku].lines.push(l); });
      });
    });
    viewItems=Object.keys(merged).map(function(k){return merged[k];});
  } else {
    viewItems = agg[active] ? Object.keys(agg[active]).map(function(k){return agg[active][k];}) : [];
  }
  viewItems.sort(function(a,b){return a.itemName.localeCompare(b.itemName);});

  const tabBags=viewItems.reduce(function(s,i){return s+i.qty;},0);
  const tabDealers={}, tabInv={};
  viewItems.forEach(function(i){i.lines.forEach(function(l){ if(l.dealer)tabDealers[l.dealer]=true; tabInv[l.invoiceNumber]=true; });});

  html+='<div class="ll-stats">'
    +'<div class="ll-stat"><div class="ll-stat-val">'+tabBags+'</div><div class="ll-stat-lbl">To load</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+viewItems.length+'</div><div class="ll-stat-lbl">Products</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+Object.keys(tabInv).length+'</div><div class="ll-stat-lbl">Invoices</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+Object.keys(tabDealers).length+'</div><div class="ll-stat-lbl">Dealers</div></div>'
    +'</div>';

  if(active===LL_UNASSIGNED){
    html+='<div class="ll-unassigned-note">These orders have no van assigned. Tag the dealer with a vehicle in the Dealer Directory, or use the ▾ on a line below to assign it for today.</div>';
  }

  if(!viewItems.length){
    html+='<div class="ll-empty">Nothing to load on '+_llVehLabel(active)+' for this date.</div>';
    body.innerHTML=html; _llUpdateFooter(active); return;
  }

  html+='<div class="ll-list">';
  viewItems.forEach(function(it){
    const ck=active+'|'+it.skuCode;
    const checked=!!_llChecked[ck];
    const expanded=!!_llExpanded[ck];
    const warn=it.known?'':'<span class="ll-warn-tag">⚠ unknown SKU</span>';
    html+='<div class="ll-item'+(checked?' ll-checked':'')+'">'
      +'<div class="ll-item-main">'
        +'<button class="ll-check" onclick="llToggleCheck(\''+_llEsc(ck)+'\')">'+(checked?'✓':'')+'</button>'
        +'<div class="ll-item-info" onclick="llToggleExpand(\''+_llEsc(ck)+'\')">'
          +'<div class="ll-item-name">'+it.itemName+warn+'</div>'
          +'<div class="ll-item-code">'+it.skuCode+' · '+it.lines.length+' order'+(it.lines.length!==1?'s':'')+' '+(expanded?'▾':'▸')+'</div>'
        +'</div>'
        +'<div class="ll-item-qty">'+it.qty+'<span class="ll-item-qty-unit">bags</span></div>'
      +'</div>';
    if(expanded){
      html+='<div class="ll-breakdown">'+it.lines.map(function(l){
        const lineKey=it.skuCode+'|'+l.invoiceNumber+'|'+l.dealer;
        const eff=_llLineVehicle(it.skuCode,l);
        const opts=['<option value="">Unassigned</option>'].concat((d.vehicles||[]).map(function(v){
          return '<option value="'+v.id+'"'+(eff===v.id?' selected':'')+'>'+v.label+'</option>';
        })).join('');
        return '<div class="ll-bd-row">'
          +'<span class="ll-bd-dealer">'+(l.dealer||'—')+'</span>'
          +'<span class="ll-bd-inv">'+l.invoiceNumber+'</span>'
          +'<span class="ll-bd-qty">'+l.qty+'</span>'
          +'<select class="ll-bd-veh" onchange="llOverrideLine(\''+_llEsc(lineKey)+'\',this.value)">'+opts+'</select>'
          +'</div>';
      }).join('')+'</div>';
    }
    html+='</div>';
  });
  html+='</div>';

  body.innerHTML=html;
  _llUpdateFooter(active);
}

function llToggleCheck(k){ _llChecked[k]=!_llChecked[k]; renderLoadList(); }
function llToggleExpand(k){ _llExpanded[k]=!_llExpanded[k]; renderLoadList(); }
function llOverrideLine(lineKey, veh){ _llOverride[lineKey]=veh; renderLoadList(); }

function _llUpdateFooter(active){
  let total=0, checked=0;
  if(active && active!==LL_ALL){
    const agg=_llAggregate(); const t=agg[active]||{};
    total=Object.keys(t).length;
    Object.keys(t).forEach(function(sku){ if(_llChecked[active+'|'+sku]) checked++; });
  }
  const el=document.getElementById('ll-progress');
  if(el) el.textContent = (active && active!==LL_ALL && total) ? (checked+' / '+total+' on '+_llVehLabel(active)) : '';
  const isRealVeh = active && active!==LL_ALL && active!==LL_UNASSIGNED;
  const pf=document.getElementById('ll-prefill-btn');
  if(pf){ pf.disabled=!isRealVeh; pf.textContent = isRealVeh ? '⬇ Pre-fill '+_llVehLabel(active) : '⬇ Pre-fill LOAD'; }
  const pr=document.getElementById('ll-print-btn');
  if(pr) pr.disabled = !(active && _llData && _llData.items.length);
}

// Pre-fill the LOAD movement form for the ACTIVE vehicle tab
function llPrefillLoad(){
  const d=_llData; if(!d) return;
  const active=_llVehicle;
  if(active===LL_ALL || active===LL_UNASSIGNED){
    alert('Pick a specific vehicle tab first — "All" and "Unassigned" can’t be loaded onto one van.');
    return;
  }
  const tab=_llAggregate()[active]||{};
  const skus=Object.keys(tab);
  if(!skus.length){ alert('Nothing to load on '+_llVehLabel(active)+' for this date.'); return; }

  const distCodes={};
  (typeof liveSKUs!=='undefined'?liveSKUs:[]).filter(function(s){return s.type==='DIST';})
    .forEach(function(s){ distCodes[s.code]=s; });

  const matched=[], skipped=[];
  skus.forEach(function(sku){ (distCodes[sku]?matched:skipped).push(tab[sku]); });
  if(!matched.length){ alert('None of these SKUs match your Distribution SKU Master, so the LOAD form can’t be filled.'); return; }

  const bags=matched.reduce(function(s,i){return s+i.qty;},0);
  let msg='Fill the LOAD form for '+_llVehLabel(active)+' with '+matched.length+' item(s) totalling '+bags+' bags?';
  if(skipped.length) msg+='\n\n'+skipped.length+' skipped (not in SKU Master): '+skipped.map(function(i){return i.skuCode;}).join(', ');
  msg+='\n\nThis sets the unit to '+_llVehLabel(active)+', clears the form, and fills Loaded quantities — review against the van before submitting.';
  if(!confirm(msg)) return;

  // Point the unit selector at this vehicle (add the option if a new van isn't listed yet)
  const unitSel=document.getElementById('unit-select');
  if(unitSel){
    if(!Array.prototype.some.call(unitSel.options,function(o){return o.value===active;})){
      const opt=document.createElement('option'); opt.value=active; opt.textContent=_llVehLabel(active); unitSel.appendChild(opt);
    }
    unitSel.value=active;
    unitSel.dataset.lastUnit=active; // prevent onUnitChange's "switch unit" confirm later
  }

  // Force DIST + LOAD mode
  if(typeof isReturnMode!=='undefined' && isReturnMode){
    isReturnMode=false;
    const mb=document.getElementById('mode-btn'); if(mb){mb.textContent='LOAD';mb.className='mode-btn';}
    const sb=document.getElementById('submit-btn'); if(sb){sb.className='submit-btn';sb.textContent='Submit to Google Sheets';}
  }
  if(typeof currentTab!=='undefined') currentTab='dist';
  if(typeof currentCat!=='undefined') currentCat='All';
  const movTabs=document.querySelectorAll('#movement-area .tab');
  if(movTabs.length){ movTabs.forEach(function(t){t.classList.remove('active');}); movTabs[0].classList.add('active'); }

  // One van at a time — clear then set this van's quantities exactly
  Object.keys(quantities).forEach(function(k){ delete quantities[k]; });
  matched.forEach(function(it){
    const cat=(distCodes[it.skuCode]||{}).category||'';
    quantities[it.skuCode]={loaded:it.qty, returned:0, cat:cat};
  });

  if(typeof buildTab==='function') buildTab();
  else { if(typeof buildSkuList==='function') buildSkuList(); if(typeof updateTotals==='function') updateTotals(); }

  closeLoadList();
  if(typeof showToast==='function')
    showToast(_llVehLabel(active)+': '+matched.length+' item(s) filled — review & submit','success',4500);
}

// Print the ACTIVE vehicle tab's checklist on the 58mm receipt printer
function llPrintLoadList(){
  const d=_llData; if(!d || !d.items.length) return;
  const active=_llVehicle;
  const agg=_llAggregate();
  let items;
  if(active===LL_ALL){
    const merged={};
    Object.keys(agg).forEach(function(veh){ Object.keys(agg[veh]).forEach(function(sku){
      if(!merged[sku]) merged[sku]={skuCode:sku,itemName:agg[veh][sku].itemName,qty:0};
      merged[sku].qty+=agg[veh][sku].qty;
    }); });
    items=Object.keys(merged).map(function(k){return merged[k];});
  } else {
    const t=agg[active]||{};
    items=Object.keys(t).map(function(k){return {skuCode:k,itemName:t[k].itemName,qty:t[k].qty};});
  }
  items.sort(function(a,b){return a.itemName.localeCompare(b.itemName);});
  if(!items.length){ alert('Nothing to load on '+_llVehLabel(active)+' for this date.'); return; }

  const pv=document.getElementById('inv-print-view');
  if(!pv){ alert('Printer view not available on this screen.'); return; }
  const rows=items.map(function(it){
    return '<div class="rcp-row" style="align-items:flex-start;gap:8px">'
      +'<span style="flex:1">☐ '+it.itemName+'<br><span class="rcp-sku">'+it.skuCode+'</span></span>'
      +'<span style="font-weight:700;font-size:14px;white-space:nowrap">'+it.qty+'</span></div>';
  }).join('');
  const logo=(typeof LOGO_SMALL!=='undefined'&&LOGO_SMALL)
    ?'<img src="'+LOGO_SMALL+'" style="display:block;margin:0 auto 4px;height:48px;width:48px;object-fit:contain;border-radius:6px">':'';
  const totalBags=items.reduce(function(s,i){return s+i.qty;},0);
  pv.innerHTML='<div class="rcp-wrap">'+logo
    +'<div class="rcp-biz-name">ALFRISCO ENTERPRISE</div>'
    +'<div class="rcp-biz-sub">Load List — '+_llVehLabel(active)+'</div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-row"><span>Inv. Date</span><span>'+_llFmtDate(d.date)+'</span></div>'
    +'<div class="rcp-row"><span>Vehicle</span><span>'+_llVehLabel(active)+'</span></div>'
    +'<div class="rcp-row"><span>Products</span><span>'+items.length+'</span></div>'
    +'<div class="rcp-row"><span>Total Bags</span><span>'+totalBags+'</span></div>'
    +'<div class="rcp-div"></div><div class="rcp-section-label">Items to Load</div>'+rows
    +'<div class="rcp-div"></div>'
    +'<div style="font-size:10px;margin-top:8px">Loaded by: ____________________</div>'
    +'<div style="font-size:10px;margin-top:10px">Checked by: ___________________</div>'
    +'<div class="rcp-footer">— Alfrisco Enterprise —</div></div>';
  window.print();
}

function _llFmtDate(s){
  if(!s) return '—';
  if(typeof phDate === 'function'){ const x=phDate(s); if(x && x!=='—') return x; }
  return s;
}
function _llEsc(s){ return String(s).replace(/'/g, "\\'"); }
