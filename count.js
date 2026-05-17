function onUnitChange(){
  const hasUnsaved=Object.values(quantities).some(q=>q.loaded>0||q.returned>0);
  if(hasUnsaved){
    const unitLabel=document.getElementById('unit-select').value;
    const confirmed=confirm('You have unsaved quantities for the current unit.\n\nSwitching to '+unitLabel+' will clear the current form.\n\nHave you already submitted the previous unit\'s data?');
    if(!confirmed){const sel=document.getElementById('unit-select');sel.value=sel.dataset.lastUnit||sel.options[0].value;return;}
  }
  quantities={};
  const sel=document.getElementById('unit-select');
  sel.dataset.lastUnit=sel.value;
  if(isReturnMode){
    isReturnMode=false;
    document.getElementById('mode-btn').textContent='LOAD';
    document.getElementById('mode-btn').className='mode-btn';
    document.getElementById('submit-btn').className='submit-btn';
    document.getElementById('submit-btn').textContent='Submit to Google Sheets';
  }
  buildSkuList();updateTotals();
  showBanner('success-bar','Switched to '+sel.value+' — form cleared and ready for new entry');
}

// ── TOGGLE MODE ──
// ── LIVE SKU MASTER ──
// ── STOCK COUNT SYSTEM ──
let countCat='All';
let countSaveTimer=null;
let currentCountType='dist';

function countSessionKey(loc){return 'alf_count_'+(loc||getCurrentCountLoc()).replace(/\s+/g,'_');}
function getCurrentCountLoc(){const el=document.getElementById('count-loc-select');return el?el.value:'Distribution WH';}
function getCountSession(loc){return LS.get(countSessionKey(loc))||{};}
function saveCountSession(loc,session){
  LS.set(countSessionKey(loc),session);
  const el=document.getElementById('count-save-status');
  if(el){const now=new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});el.textContent='Auto-saved at '+now;}
}

function openCount(){
  const canDist=currentUser&&currentUser.canCountDist!==false;
  const canRetail=currentUser&&currentUser.canCountRetail!==false;
  if(!canDist&&!canRetail){alert('You do not have permission to perform inventory counts.');return;}
  if(canDist&&canRetail){updateCountTypeCards();showScreen('count-type-screen');}
  else{startCount(canDist?'dist':'retail');}
  updateFabVisibility();
}

function updateCountTypeCards(){
  const allSkus=getAllCountSKUs();
  const distCount=liveSKUs.filter(s=>s.type==='DIST').length||allSkus.filter(s=>s.type==='DIST').length;
  const retailCount=liveSKUs.filter(s=>s.type==='RETAIL').length||allSkus.filter(s=>s.type==='RETAIL').length;
  const canDist=currentUser&&currentUser.canCountDist!==false;
  const canRetail=currentUser&&currentUser.canCountRetail!==false;
  const distCard=document.getElementById('count-card-dist');
  const retailCard=document.getElementById('count-card-retail');
  if(distCard){distCard.className='count-type-card dist'+(canDist?'':' disabled');distCard.onclick=canDist?()=>startCount('dist'):null;const dc=document.getElementById('count-card-dist-count');if(dc)dc.textContent=distCount+' SKUs';}
  if(retailCard){retailCard.className='count-type-card retail'+(canRetail?'':' disabled');retailCard.onclick=canRetail?()=>startCount('retail'):null;const rc=document.getElementById('count-card-retail-count');if(rc)rc.textContent=retailCount+' SKUs';}
  // Show "View History" button if user has permission
  const histBtn = document.getElementById('ch-type-history-btn');
  if(histBtn) histBtn.style.display = _chCanView() ? 'block' : 'none';
}

function closeCountType(){if(currentUser&&currentUser.role==='driver')showDriver();else showHome();}

function startCount(type){
  currentCountType=type;
  const isRetail=type==='retail';
  const color=isRetail?'#C07000':'#7B2D8B';
  const topbar=document.getElementById('count-topbar');
  const title=document.getElementById('count-topbar-title');
  const fill=document.getElementById('count-progress-fill');
  const pct=document.getElementById('count-progress-pct');
  const submitBtn=document.getElementById('count-submit-btn');
  const successBar=document.getElementById('count-success-bar');
  if(topbar)topbar.style.background=color;
  if(title)title.textContent=isRetail?'🛒 Retail Stock Count':'📦 Distribution Stock Count';
  if(fill)fill.style.background=color;
  if(pct)pct.style.color=color;
  if(submitBtn)submitBtn.style.background=color;
  if(successBar)successBar.style.background=color;
  showScreen('count-screen');
  updateFabVisibility();
  countCat='All';
  buildCountChips();buildCountList();updateCountProgress();
}

function closeCount(){if(currentUser&&currentUser.role==='driver')showDriver();else showHome();}

function switchCountLocation(){countCat='All';buildCountChips();buildCountList();updateCountProgress();}

function getAllCountSKUs(){
  const typeFilter=currentCountType==='retail'?'RETAIL':'DIST';
  const all=[];
  if(liveSKUs&&liveSKUs.length>0){
    liveSKUs.filter(s=>s.type===typeFilter).forEach(s=>all.push({code:s.code,name:s.name,category:s.category,type:s.type,unit:'bag'}));
  }else{
    if(typeFilter==='DIST'){DIST_CATS.forEach(cat=>{(DIST_SKUS[cat]||[]).forEach(s=>all.push({code:s.code,name:s.name,category:cat,type:'DIST',unit:'bag'}));});}
    else{Object.keys(csskus).forEach(cat=>{(csskus[cat]||[]).forEach(s=>all.push({code:s.code,name:s.name,category:cat,type:'RETAIL',unit:'bag'}));});}
  }
  return all;
}

function buildCountChips(){
  const bar=document.getElementById('count-chips-bar');bar.innerHTML='';
  const skus=getAllCountSKUs();
  const cats=['All',...new Set(skus.map(s=>s.category).filter(Boolean))];
  cats.forEach(cat=>{const c=document.createElement('div');c.className='count-chip'+(cat===countCat?' active':'');c.textContent=cat;c.onclick=()=>{countCat=cat;buildCountChips();buildCountList();};bar.appendChild(c);});
}

function buildCountList(){
  const list=document.getElementById('count-sku-list');list.innerHTML='';
  const loc=getCurrentCountLoc();const session=getCountSession(loc);
  const allSkus=getAllCountSKUs();
  const visible=countCat==='All'?allSkus:allSkus.filter(s=>s.category===countCat);
  const cats=countCat==='All'?[...new Set(allSkus.map(s=>s.category))]:[countCat];
  cats.forEach(cat=>{
    const catSkus=visible.filter(s=>s.category===cat);
    if(!catSkus.length)return;
    if(countCat==='All'){const hdr=document.createElement('div');hdr.className='count-cat-header';const counted=catSkus.filter(s=>session[s.code]!==undefined&&session[s.code]!=='').length;hdr.textContent=cat+' ('+counted+'/'+catSkus.length+')';list.appendChild(hdr);}
    catSkus.forEach(sku=>{
      const val=session[sku.code];const hasCounted=val!==undefined&&val!=='';
      const row=document.createElement('div');row.className='count-sku-row'+(hasCounted?' counted':'');row.id='count-row-'+sku.code.replace(/[^a-z0-9]/gi,'_');
      row.innerHTML=`<div class="count-sku-status ${hasCounted?'done':'pending'}"></div><div class="count-sku-info"><div class="count-sku-name">${sku.name}</div><div class="count-sku-code">${sku.code} · ${sku.type}</div></div><div class="count-qty-wrap"><div class="count-qty-lbl">On Hand</div><input class="count-qty-input ${hasCounted?'has-value':''}" type="number" min="0" step="1" value="${hasCounted?val:''}" placeholder="—" oninput="onCountInput('${sku.code}',this.value,'${sku.category}','${sku.type}')"><div class="count-unit">${sku.unit||'units'}</div></div>`;
      list.appendChild(row);
    });
  });
}

function onCountInput(code,val,category,type){
  const loc=getCurrentCountLoc();const session=getCountSession(loc);
  if(val===''||val===null){delete session[code];}else{session[code]=parseFloat(val)||0;}
  const rowEl=document.getElementById('count-row-'+code.replace(/[^a-z0-9]/gi,'_'));
  const hasCounted=session[code]!==undefined;
  if(rowEl){rowEl.className='count-sku-row'+(hasCounted?' counted':'');const dot=rowEl.querySelector('.count-sku-status');if(dot)dot.className='count-sku-status '+(hasCounted?'done':'pending');const input=rowEl.querySelector('.count-qty-input');if(input)input.className='count-qty-input'+(hasCounted?' has-value':'');}
  clearTimeout(countSaveTimer);
  countSaveTimer=setTimeout(()=>{saveCountSession(loc,session);updateCountProgress();},800);
}

function updateCountProgress(){
  const loc=getCurrentCountLoc();const session=getCountSession(loc);
  const total=getAllCountSKUs().length;const counted=Object.keys(session).length;
  const pct=total>0?Math.round(counted/total*100):0;
  const labelEl=document.getElementById('count-progress-label');const pctEl=document.getElementById('count-progress-pct');const fillEl=document.getElementById('count-progress-fill');const btnEl=document.getElementById('count-submit-btn');const noteEl=document.getElementById('count-submit-note');
  if(labelEl)labelEl.textContent=counted+' of '+total+' SKUs counted';
  if(pctEl)pctEl.textContent=pct+'%';
  if(fillEl)fillEl.style.width=pct+'%';
  if(btnEl){
    if(counted===0){btnEl.disabled=true;btnEl.textContent='Submit Count to Google Sheets';if(noteEl)noteEl.textContent='Count at least one SKU before submitting';}
    else if(counted<total){btnEl.disabled=false;btnEl.textContent='Submit Partial Count ('+counted+' SKUs)';if(noteEl)noteEl.textContent='Partial counts accepted — remaining SKUs unverified';}
    else{btnEl.disabled=false;btnEl.textContent='Submit Full Count — '+total+' SKUs ✓';if(noteEl)noteEl.textContent='All SKUs counted — ready to submit';}
  }
}

async function submitCount(){
  const loc=getCurrentCountLoc();const session=getCountSession(loc);const counted=Object.keys(session).length;
  if(counted===0){alert('Please count at least one SKU before submitting.');return;}
  const allSkus=getAllCountSKUs();const skuMap={};allSkus.forEach(s=>skuMap[s.code]=s);
  if(!confirm(counted+' SKU counts will be submitted for '+loc+'.\nThis will clear the current session. Continue?'))return;
  const btn=document.getElementById('count-submit-btn');btn.disabled=true;btn.textContent='Submitting...';
  const now=new Date().toLocaleString('sv-SE', {timeZone:'Asia/Manila'});
  const rows=Object.entries(session).map(([code,qty])=>{const sku=skuMap[code]||{};return[now,currentUser.username,loc,code,sku.name||code,qty,sku.unit||'units',sku.type||'',sku.category||''];});
  try{
    const sheetName=currentCountType==='retail'?'Stock Counts - Retail':'Stock Counts - Distribution';
    const r=await api({sheet:sheetName,rows});
    if(r.status==='ok'){
      LS.set(countSessionKey(loc),{});
      const bar=document.getElementById('count-success-bar');bar.textContent=counted+' counts submitted for '+loc+' by '+currentUser.username+' — session cleared';bar.style.display='block';setTimeout(()=>{bar.style.display='none';},6000);
      buildCountList();updateCountProgress();
      // Refresh product list data in background so low-stock badge stays current
      if(typeof loadPLData === 'function') loadPLData();
    }else{alert('Error: '+(r.msg||'Could not submit'));}
  }catch(e){alert('Network error: '+e.message);}
  btn.disabled=false;updateCountProgress();
}

// ══════════════════════════════════════════════════════════════
// COUNT HISTORY SYSTEM
// ══════════════════════════════════════════════════════════════
let _chSegment  = 'dist';
let _chAllItems = [];

function _chCanView(){
  return currentUser && (currentUser.role === 'admin' || currentUser.canViewCountHistory === true);
}

async function openCountHistory(){
  if(!_chCanView()){ alert('You do not have permission to view count history.'); return; }
  showScreen('count-history-screen');
  updateFabVisibility();

  // Default to a segment this user can count; fall back to dist
  const canDist   = currentUser.role==='admin' || currentUser.canCountDist!==false;
  const canRetail = currentUser.role==='admin' || currentUser.canCountRetail!==false;
  _chSegment = canDist ? 'dist' : 'retail';

  // Tab visibility
  const dtab = document.getElementById('ch-tab-dist');
  const rtab = document.getElementById('ch-tab-retail');
  if(dtab) dtab.style.display = canDist   ? 'block' : 'none';
  if(rtab) rtab.style.display = canRetail ? 'block' : 'none';

  const searchEl = document.getElementById('ch-search');
  if(searchEl) searchEl.value = '';

  await _chLoadSegment(_chSegment);
}

function closeCountHistory(){ showHome(); }

async function _chLoadSegment(seg){
  _chSegment = seg;
  _chAllItems = [];

  // Update tab highlight
  ['dist','retail'].forEach(s => {
    const t = document.getElementById('ch-tab-'+s);
    if(t) t.classList.toggle('active', s === seg);
  });

  // Reset summary
  ['ch-summary-last','ch-summary-total','ch-summary-variance','ch-summary-stale']
    .forEach(id => { const el=document.getElementById(id); if(el) el.textContent='—'; });

  const body = document.getElementById('ch-body');
  body.innerHTML = '<div class="ch-loading">Loading count history…</div>';

  try{
    const r = await api({ action:'getCountHistory', segment: seg });
    if(r.status === 'ok'){
      _chAllItems = r.items || [];
      _chRenderSummary(r.summary || {});
      _chBuildCatChips();
      _chRenderList();
    } else {
      body.innerHTML = '<div class="ch-empty">Could not load: '+(r.msg||'Unknown error')+'</div>';
    }
  }catch(e){
    body.innerHTML = '<div class="ch-empty">Network error: '+e.message+'</div>';
  }
}

function _chRenderSummary(s){
  const setEl = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setEl('ch-summary-last',     s.lastCountDate || 'Never');
  setEl('ch-summary-total',    (s.totalSKUs||0)+' SKUs');
  setEl('ch-summary-variance', (s.varianceCount||0)+' items');
  setEl('ch-summary-stale',    (s.staleSKUs||0)+' items');
}

function _chBuildCatChips(){
  const bar = document.getElementById('ch-cat-chips');
  if(!bar) return;
  const cats = ['All', ...[...new Set(_chAllItems.map(i=>i.category).filter(Boolean))].sort()];
  bar.innerHTML = '';
  // Store current filter
  if(!window._chCatFilter) window._chCatFilter = 'All';
  cats.forEach(cat => {
    const c = document.createElement('div');
    c.className = 'count-chip' + (cat === window._chCatFilter ? ' active' : '');
    c.textContent = cat;
    c.onclick = () => { window._chCatFilter = cat; _chBuildCatChips(); _chRenderList(); };
    bar.appendChild(c);
  });
}

function _chRenderList(){
  const body    = document.getElementById('ch-body');
  const isAdmin = currentUser.role === 'admin';
  const search  = (document.getElementById('ch-search')?.value || '').toLowerCase().trim();
  const catFilter = window._chCatFilter || 'All';

  let items = _chAllItems.slice();
  if(catFilter !== 'All') items = items.filter(i => i.category === catFilter);
  if(search) items = items.filter(i =>
    i.skuName.toLowerCase().includes(search) || i.skuCode.toLowerCase().includes(search));

  if(!items.length){
    body.innerHTML = '<div class="ch-empty">No records match the current filters.</div>';
    return;
  }

  body.innerHTML = '';

  // Group by category
  const groups = {};
  items.forEach(item => {
    const cat = item.category || 'Uncategorized';
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  Object.entries(groups).forEach(([cat, catItems]) => {
    const hdr = document.createElement('div');
    hdr.className = 'ch-cat-hdr';
    hdr.textContent = cat + ' (' + catItems.length + ')';
    body.appendChild(hdr);

    catItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'ch-item-row';
      row.onclick = () => openCountItemHistory(item.skuCode, item.skuName, item.unit);

      // Variance display
      let varHtml;
      if(item.variance === null || item.variance === undefined){
        varHtml = '<span class="ch-variance-na">first count</span>';
      } else if(item.variance > 0){
        varHtml = '<span class="ch-variance-up">▲ +'+item.variance+'</span>';
      } else if(item.variance < 0){
        varHtml = '<span class="ch-variance-down">▼ '+item.variance+'</span>';
      } else {
        varHtml = '<span class="ch-variance-zero">±0</span>';
      }

      const staleBadge = item.daysSince > 30
        ? '<span class="ch-stale-badge">⏰ '+item.daysSince+'d ago</span>' : '';
      const shrinkBadge = item.isShrinkage
        ? '<span class="ch-shrinkage-badge">⚠ Shrinkage</span>' : '';

      const dateDisplay = item.lastCounted ? item.lastCounted.slice(0,10) : '—';
      const metaParts   = [dateDisplay];
      if(isAdmin && item.submittedBy) metaParts.push(item.submittedBy);
      if(item.location) metaParts.push(item.location);

      row.innerHTML =
        '<div class="ch-item-main">'
          + '<div class="ch-item-name">'+item.skuName+staleBadge+shrinkBadge+'</div>'
          + '<div class="ch-item-meta">'+metaParts.join(' · ')+'</div>'
        + '</div>'
        + '<div class="ch-item-right">'
          + '<div class="ch-item-qty">'+item.lastQty+' <span style="font-size:10px;color:#aaa">'+item.unit+'</span></div>'
          + '<div class="ch-item-var">'+varHtml+'</div>'
        + '</div>';
      body.appendChild(row);
    });
  });
}

// ── ITEM HISTORY DRILL-DOWN ───────────────────────────────────
async function openCountItemHistory(skuCode, skuName, unit){
  const panel    = document.getElementById('ch-item-panel');
  const titleEl  = document.getElementById('ch-panel-title');
  const subEl    = document.getElementById('ch-panel-sub');
  const bodyEl   = document.getElementById('ch-panel-body');

  if(titleEl) titleEl.textContent = skuName;
  if(subEl)   subEl.textContent   = skuCode + (unit ? ' · '+unit : '');
  if(bodyEl)  bodyEl.innerHTML    = '<div style="color:#aaa;font-size:12px;padding:12px 16px">Loading…</div>';
  if(panel)   panel.style.display = 'flex';

  try{
    const r = await api({ action:'getCountItemHistory', skuCode, segment: _chSegment });
    if(r.status === 'ok'){
      const records = r.records || [];
      if(!records.length){
        bodyEl.innerHTML = '<div class="ch-empty">No records found for this item.</div>';
        return;
      }
      const isAdmin = currentUser.role === 'admin';
      bodyEl.innerHTML = '';
      records.forEach((rec, idx) => {
        const prev     = records[idx + 1];
        const variance = prev != null ? rec.qty - prev.qty : null;
        let varHtml = '';
        if(variance !== null){
          if(variance > 0)      varHtml = '<span class="ch-variance-up" style="font-size:11px">▲ +'+variance+'</span>';
          else if(variance < 0) varHtml = '<span class="ch-variance-down" style="font-size:11px">▼ '+variance+'</span>';
          else                  varHtml = '<span class="ch-variance-zero" style="font-size:11px">±0</span>';
        }
        const div = document.createElement('div');
        div.className = 'ch-hist-row' + (idx === 0 ? ' ch-hist-latest' : '');
        div.innerHTML =
          '<div>'
            + '<div style="font-size:12px;font-weight:600;color:#222">'+rec.date.slice(0,16)+'</div>'
            + '<div style="font-size:11px;color:#888">'+rec.location+(isAdmin&&rec.submittedBy?' · '+rec.submittedBy:'')+'</div>'
          + '</div>'
          + '<div style="text-align:right">'
            + '<div style="font-size:15px;font-weight:700;color:#222">'+rec.qty+'</div>'
            + varHtml
          + '</div>';
        bodyEl.appendChild(div);
      });
    } else {
      bodyEl.innerHTML = '<div class="ch-empty">Error: '+(r.msg||'Could not load')+'</div>';
    }
  }catch(e){
    bodyEl.innerHTML = '<div class="ch-empty">Network error: '+e.message+'</div>';
  }
}

function closeCountItemPanel(){
  const panel = document.getElementById('ch-item-panel');
  if(panel) panel.style.display = 'none';
}

// ── EXPORT ────────────────────────────────────────────────────
function exportCountHistory(){
  const isAdmin   = currentUser.role === 'admin';
  const search    = (document.getElementById('ch-search')?.value||'').toLowerCase().trim();
  const catFilter = window._chCatFilter || 'All';

  let items = _chAllItems.slice();
  if(catFilter !== 'All') items = items.filter(i => i.category === catFilter);
  if(search) items = items.filter(i =>
    i.skuName.toLowerCase().includes(search) || i.skuCode.toLowerCase().includes(search));

  if(!items.length){ showToast('No data to export', 'info'); return; }

  const headers = ['SKU Code','Item Name','Category','Last Counted','Qty On Hand',
    'Unit','vs Previous Count','Days Since Count'];
  if(isAdmin) headers.push('Submitted By','Location');

  const rows = items.map(i => {
    const varDisplay = i.variance === null ? 'First count'
      : i.variance > 0 ? '+'+i.variance
      : String(i.variance);
    const row = [
      i.skuCode, i.skuName, i.category,
      (i.lastCounted||'').slice(0,16),
      i.lastQty, i.unit, varDisplay, i.daysSince
    ];
    if(isAdmin){ row.push(i.submittedBy||''); row.push(i.location||''); }
    return row;
  });

  const csv = [headers, ...rows]
    .map(r => r.map(v => '"'+String(v==null?'':v).replace(/"/g,'""')+'"').join(','))
    .join('\n');

  const blob = new Blob(['﻿'+csv], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'count-history-'+_chSegment.toUpperCase()+'-'
    + new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  showToast('Export ready ✓', 'success');
}

// ── PURCHASE ORDER SYSTEM ──
const DIST_SUPPLIERS=['A-Legacy','AAS','CCPI','EMT','PDI','TFI','THB','TOPPERSWARE'];
const RETAIL_SUPPLIERS=['Alfrisco Distribution','Edzena','JFL','Jake','Magpayo','Zoe'];
let poList=[],currentPO=null,poFilter='All',poLineItems=[];

