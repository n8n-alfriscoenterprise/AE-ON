
async function toggleMode(){
  isReturnMode=!isReturnMode;
  const b=document.getElementById('mode-btn'),s=document.getElementById('submit-btn');
  b.textContent=isReturnMode?'RETURN':'LOAD';
  b.className='mode-btn'+(isReturnMode?' return-mode':'');
  s.className='submit-btn'+(isReturnMode?' return-mode':'');
  s.textContent=isReturnMode?'Submit Return to Google Sheets':'Submit to Google Sheets';

  if(isReturnMode){
    // Fetch today's LOAD data and pre-fill loaded quantities
    const unit=document.getElementById('unit-select').value;
    b.textContent='Loading...';b.disabled=true;
    try{
      const r=await api({action:'getTodayLoads',unit});
      if(r.status==='ok'&&r.rows&&r.rows.length>0){
        r.rows.forEach(item=>{
          const code=item.code;
          if(!quantities[code])quantities[code]={loaded:0,returned:0,cat:item.cat||''};
          quantities[code].loaded=Number(item.loaded)||0;
          quantities[code].cat=item.cat||quantities[code].cat;
        });
        showBanner('success-bar',
          `Loaded ${r.rows.length} SKU quantities from today\'s morning load`);
      }else{
        showBanner('success-bar',
          'No LOAD submission found for today — enter loaded quantities manually if needed');
      }
    }catch(e){
      showBanner('success-bar','Could not fetch today\'s load — check connection');
    }
    b.textContent='RETURN';b.disabled=false;b.className='mode-btn return-mode';
  }
  buildSkuList();
}

function buildTab(){buildChips();buildSkuList();updateTotals();}

function buildChips(){
  const bar=document.getElementById('chips-bar');bar.innerHTML='';
  let cats=['All'];
  if(currentTab==='dist')cats=['All',...DIST_CATS];
  else if(currentTab==='retail')cats=['All',...Object.keys(csskus)];
  cats.forEach(cat=>{
    const c=document.createElement('div');
    c.className='chip'+(cat===currentCat?' active':'');
    c.textContent=cat;
    c.onclick=()=>{currentCat=cat;buildChips();buildSkuList();};
    bar.appendChild(c);
  });
}

function getGroups(){
  if(currentTab==='dist'){
    const cats=currentCat==='All'?DIST_CATS:[currentCat];
    return cats.map(c=>({cat:c,skus:DIST_SKUS[c]||[]}));
  }
  if(currentTab==='retail'){
    const cats=currentCat==='All'?Object.keys(csskus):[currentCat];
    return cats.map(c=>({cat:c,skus:csskus[c]||[]}));
  }
  const g=DIST_CATS.map(c=>({cat:`DIST — ${c}`,skus:DIST_SKUS[c]||[]}));
  Object.keys(csskus).forEach(c=>g.push({cat:`RETAIL — ${c}`,skus:csskus[c]||[]}));
  return g;
}

function buildSkuList(){
  const list=document.getElementById('sku-list');list.innerHTML='';
  getGroups().forEach(({cat,skus})=>{
    if(!skus.length)return;
    const hdr=document.createElement('div');hdr.className='cat-header';hdr.textContent=cat;list.appendChild(hdr);
    skus.forEach(sku=>{
      if(!quantities[sku.code])quantities[sku.code]={loaded:0,returned:0,cat};
      const q=quantities[sku.code];
      const sold=Math.max(0,q.loaded-q.returned);
      const sid='sold_'+sku.code.replace(/[^a-z0-9]/gi,'_');

      // Mode-locked: LOAD mode locks Returned, RETURN mode shows loaded as badge
      const loadedLocked=isReturnMode;
      const returnedLocked=!isReturnMode;

      // In RETURN mode: show loaded as a read-only display badge (not an input)
      // This way the pre-filled value from Sheets is visible but not editable
      const loadedDisplay = isReturnMode
        ? `<div class="qty-col">
            <div class="qty-lbl">Loaded</div>
            <div class="sold-val ${q.loaded===0?'zero':''}" style="width:44px;font-size:13px;border-radius:8px;border:1.5px solid #85B7EB;background:#EEF5FE;color:#0C447C;padding:5px 2px;">${q.loaded||0}</div>
           </div>`
        : `<div class="qty-col">
            <div class="qty-lbl">Loaded</div>
            <input class="qty-input loaded active-input"
              type="number" min="0" step="1"
              value="${q.loaded||''}" placeholder="0"
              oninput="setQty('${sku.code}','loaded',this.value,'${cat}')">
           </div>`;

      const row=document.createElement('div');row.className='sku-row';
      row.innerHTML=`
        <div class="sku-info">
          <div class="sku-name">${sku.name}</div>
          <div class="sku-code">${sku.code}</div>
        </div>
        <div class="qty-group">
          ${loadedDisplay}
          <div class="qty-col">
            <div class="qty-lbl">Returned</div>
            <input class="qty-input returned ${returnedLocked?'locked-input':'active-input'}"
              type="number" min="0" step="1"
              value="${q.returned||''}" placeholder="0"
              ${returnedLocked?'disabled':''}
              oninput="setQty('${sku.code}','returned',this.value,'${cat}')">
          </div>
          <div class="sold-col">
            <div class="qty-lbl">Sold</div>
            <div class="sold-val ${sold===0?'zero':''}" id="${sid}">${sold}</div>
          </div>
        </div>`;
      list.appendChild(row);
    });
  });
}

function setQty(code,field,val,cat){
  if(!quantities[code])quantities[code]={loaded:0,returned:0,cat};
  quantities[code][field]=Math.max(0,parseFloat(val)||0);
  quantities[code].cat=cat;
  const sold=Math.max(0,quantities[code].loaded-quantities[code].returned);
  const el=document.getElementById('sold_'+code.replace(/[^a-z0-9]/gi,'_'));
  if(el){el.textContent=sold;el.className='sold-val'+(sold===0?' zero':'');}
  updateTotals();
}

function updateTotals(){
  let tl=0,tr=0;
  Object.values(quantities).forEach(q=>{tl+=q.loaded;tr+=q.returned;});
  document.getElementById('t-loaded').textContent=Math.round(tl);
  document.getElementById('t-returned').textContent=Math.round(tr);
  document.getElementById('t-sold').textContent=Math.round(Math.max(0,tl-tr));
}

async function submitForm(){
  const entries=Object.entries(quantities).filter(([k,v])=>v.loaded>0||v.returned>0);
  if(!entries.length){alert('Please enter at least one quantity before submitting.');return;}
  const btn=document.getElementById('submit-btn');
  btn.disabled=true;btn.textContent='Submitting...';
  const mode=isReturnMode?'RETURN':'LOAD';
  const unit=document.getElementById('unit-select').value;
  const now=new Date().toLocaleString('sv-SE', {timeZone:'Asia/Manila'});
  const allSkus={};
  Object.values(DIST_SKUS).flat().forEach(s=>allSkus[s.code]=s.name);
  Object.values(csskus).flat().forEach(s=>allSkus[s.code]=s.name);
  const rows=entries.map(([code,q])=>[
    now,currentUser.username,unit,mode,code,
    allSkus[code]||code,q.cat||'',q.loaded,q.returned,
    Math.max(0,q.loaded-q.returned)
  ]);
  try{
    const r=await api({sheet:'Stock Movements',rows});
    if(r.status==='ok'){
      showBanner('success-bar',`${mode} submitted — ${rows.length} SKUs logged by ${currentUser.username}`);
      accessLog.unshift({who:currentUser.username,what:`${mode} — ${rows.length} SKUs via ${unit}`,when:now});
      saveLocal();quantities={};buildSkuList();updateTotals();
    }else{alert('Error: '+(r.msg||'Unknown'));}
  }catch(e){alert('Network error: '+e.message);}
  btn.disabled=false;
  btn.textContent=isReturnMode?'Submit Return to Google Sheets':'Submit to Google Sheets';
}

function showBanner(id,msg){
  const b=document.getElementById(id);
  if(!b){ console.warn('showBanner: element not found —',id); return; }
  b.textContent=msg;
  b.style.display='block';
  setTimeout(()=>{ if(b) b.style.display='none'; },5000);
}

// ── MOVEMENT HISTORY (admin / staff) ────────────────────────────
let _movHistBatches  = [];
let _movHistExpanded = new Set();
let _movEditBatch    = null;
let _movEditChanges  = {}; // {rowIndex: {loaded, returned}}

async function openMovHistory(){
  document.getElementById('mov-hist-modal').style.display='flex';
  await _loadMovHistory();
}

async function _loadMovHistory(){
  const body = document.getElementById('mov-hist-body');
  body.innerHTML = '<div style="text-align:center;padding:24px;color:#888;font-size:13px">Loading…</div>';
  const mode = document.getElementById('mov-hist-mode')?.value || 'All';
  const date = document.getElementById('mov-hist-date')?.value || '';
  const r    = await api({action:'getMovementHistory', mode, date, limit:200});
  if(r.status!=='ok'){
    body.innerHTML='<div style="padding:16px;color:#E24B4A">Failed to load history.</div>';
    return;
  }
  _movHistBatches  = r.batches || [];
  _movHistExpanded = new Set();
  _renderMovHistory();
}

function _renderMovHistory(){
  const body = document.getElementById('mov-hist-body');
  if(!_movHistBatches.length){
    body.innerHTML='<div style="text-align:center;padding:24px;color:#888;font-size:13px">No movement records found.</div>';
    return;
  }
  body.innerHTML='';
  _movHistBatches.forEach(b=>{
    const isLoad   = b.mode.toUpperCase()==='LOAD';
    const expanded = _movHistExpanded.has(b.batchKey);
    const canEdit  = _canEditMovBatch(b);
    const isAdmin  = currentUser && currentUser.role==='admin';
    const ts       = _fmtMovTs(b.timestamp);

    // Totals line — always show both sides so RETURN is never ambiguous
    const loadedLine   = 'Loaded: <strong>'+b.totalLoaded+'</strong>';
    const returnedLine = 'Returned: <strong>'+b.totalReturned+'</strong>';
    const soldLine     = 'Sold: <strong>'+Math.max(0,b.totalLoaded-b.totalReturned)+'</strong>';
    const totalsHtml   = isLoad
      ? loadedLine
      : loadedLine+' &nbsp;·&nbsp; '+returnedLine+' &nbsp;·&nbsp; '+soldLine;

    const card = document.createElement('div');
    card.className = 'mov-hist-card';
    card.id        = 'mhc-'+b.batchKey.replace(/[^a-z0-9]/gi,'_');

    let linesHtml = '';
    if(expanded){
      linesHtml = '<div class="mov-hist-lines">'
        +'<table class="mov-hist-table">'
        +'<thead><tr><th>SKU</th><th>Item</th><th class="mh-r">Loaded</th><th class="mh-r">Returned</th><th class="mh-r">Sold</th></tr></thead>'
        +'<tbody>'
        + b.lines.map(l=>`<tr>
            <td class="mh-sku">${l.sku}</td>
            <td>${l.name}</td>
            <td class="mh-r">${l.loaded}</td>
            <td class="mh-r ${l.returned>0?'mh-returned':''}">${l.returned}</td>
            <td class="mh-r">${l.sold}</td>
          </tr>`).join('')
        +'</tbody></table></div>';
    }

    card.innerHTML =
      '<div class="mov-hist-row">'
        +'<div class="mov-hist-main">'
          +'<div class="mov-hist-badge" style="background:'+(isLoad?'#E3F2FD':'#FFF3E0')+';color:'+(isLoad?'#1565C0':'#E65100')+'">'+b.mode+'</div>'
          +'<div class="mov-hist-info">'
            +'<div class="mh-unit">'+b.unit+' &nbsp;·&nbsp; '+b.items+' SKU'+(b.items!==1?'s':'')+'</div>'
            +'<div class="mh-by">'+b.submittedBy+' · '+ts+'</div>'
            +'<div class="mh-totals">'+totalsHtml+'</div>'
          +'</div>'
        +'</div>'
        +'<div class="mov-hist-actions">'
          +(canEdit?'<button class="mov-hist-edit-btn" onclick="openEditMovBatch(\''+b.batchKey.replace(/'/g,"\\'")+'\')" >✏ Edit</button>':'')
          +(isAdmin?'<button class="mov-hist-del-btn" onclick="deleteMovBatch(\''+b.batchKey.replace(/'/g,"\\'")+'\')" >Delete</button>':'')
          +'<button class="mov-hist-expand-btn" onclick="toggleMovBatch(\''+b.batchKey.replace(/'/g,"\\'")+'\')">'+( expanded?'▲ Hide':'▼ Items')+'</button>'
        +'</div>'
      +'</div>'
      + linesHtml;
    body.appendChild(card);
  });
}

function toggleMovBatch(key){
  if(_movHistExpanded.has(key)) _movHistExpanded.delete(key);
  else _movHistExpanded.add(key);
  _renderMovHistory();
}

function _canEditMovBatch(batch){
  if(!currentUser) return false;
  if(currentUser.role==='driver') return false;
  if(currentUser.role==='admin')  return true;
  // Staff can edit only their own submissions
  return batch.submittedBy === currentUser.username;
}

function _fmtMovTs(ts){
  return phDateTime(ts);
}

function closeMovHistory(){
  document.getElementById('mov-hist-modal').style.display='none';
}

// ── EDIT MODAL ─────────────────────────────────────────────────
function openEditMovBatch(batchKey){
  _movEditBatch   = _movHistBatches.find(b=>b.batchKey===batchKey);
  if(!_movEditBatch) return;
  _movEditChanges = {};

  const title = document.getElementById('mov-edit-title');
  if(title) title.textContent = '✏ Edit — '+_movEditBatch.unit+' '+_movEditBatch.mode+' · '+_fmtMovTs(_movEditBatch.timestamp);

  const body = document.getElementById('mov-edit-body');
  body.innerHTML =
    '<div style="font-size:11px;color:#888;margin-bottom:10px">Adjust loaded / returned quantities per SKU. Sold is calculated automatically.</div>'
    +'<table class="mov-hist-table" style="width:100%">'
    +'<thead><tr><th>Item</th><th class="mh-r">Loaded</th><th class="mh-r">Returned</th></tr></thead>'
    +'<tbody>'
    + _movEditBatch.lines.map(l=>
        '<tr>'
          +'<td><div class="mh-sku">'+l.sku+'</div><div style="font-size:11px;color:#555">'+l.name+'</div></td>'
          +'<td class="mh-r"><input class="mov-edit-input" type="number" min="0" step="1"'
            +' id="mev-l-'+l.rowIndex+'" value="'+l.loaded+'"'
            +' oninput="_movEditChanges['+l.rowIndex+'] = _movEditChanges['+l.rowIndex+'] || {}; _movEditChanges['+l.rowIndex+'].loaded=Number(this.value)||0; _movEditUpdateSoldLabel('+l.rowIndex+')"></td>'
          +'<td class="mh-r"><input class="mov-edit-input" type="number" min="0" step="1"'
            +' id="mev-r-'+l.rowIndex+'" value="'+l.returned+'"'
            +' oninput="_movEditChanges['+l.rowIndex+'] = _movEditChanges['+l.rowIndex+'] || {}; _movEditChanges['+l.rowIndex+'].returned=Number(this.value)||0; _movEditUpdateSoldLabel('+l.rowIndex+')"></td>'
        +'</tr>'
      ).join('')
    +'</tbody></table>'
    +'<div id="mov-edit-err" style="font-size:11px;color:#c00;margin-top:8px;min-height:14px"></div>';

  document.getElementById('mov-edit-modal').style.display='flex';
}

function _movEditUpdateSoldLabel(rowIndex){
  // no-op for now — sold is just recalculated on save
}

function closeEditMov(){
  document.getElementById('mov-edit-modal').style.display='none';
  _movEditBatch   = null;
  _movEditChanges = {};
}

async function saveMovEdits(){
  if(!_movEditBatch) return;
  const errEl  = document.getElementById('mov-edit-err');
  const saveBtn = document.getElementById('mov-edit-save');
  errEl.textContent='';

  // Build list of rows that actually changed
  const updates = [];
  _movEditBatch.lines.forEach(l=>{
    const loadedEl   = document.getElementById('mev-l-'+l.rowIndex);
    const returnedEl = document.getElementById('mev-r-'+l.rowIndex);
    if(!loadedEl||!returnedEl) return;
    const newLoaded   = Math.max(0, Number(loadedEl.value)  ||0);
    const newReturned = Math.max(0, Number(returnedEl.value)||0);
    if(newLoaded!==l.loaded || newReturned!==l.returned){
      updates.push({rowIndex:l.rowIndex, loaded:newLoaded, returned:newReturned});
    }
  });

  if(!updates.length){ closeEditMov(); return; }

  saveBtn.disabled=true; saveBtn.textContent='Saving…';

  let failed = 0;
  for(const u of updates){
    const r = await api({action:'updateMovementRow', rowIndex:u.rowIndex, loaded:u.loaded, returned:u.returned, editedBy: currentUser?currentUser.username:''});
    if(r.status!=='ok') failed++;
    else {
      // Update local batch data
      const line = _movEditBatch.lines.find(l=>l.rowIndex===u.rowIndex);
      if(line){ line.loaded=u.loaded; line.returned=u.returned; line.sold=Math.max(0,u.loaded-u.returned); }
    }
  }

  saveBtn.disabled=false; saveBtn.textContent='💾 Save Changes';

  if(failed){
    errEl.textContent = failed+' row(s) failed to save. Try again.';
    return;
  }

  // Recompute batch totals
  _movEditBatch.totalLoaded   = _movEditBatch.lines.reduce((s,l)=>s+l.loaded,  0);
  _movEditBatch.totalReturned = _movEditBatch.lines.reduce((s,l)=>s+l.returned,0);

  showToast(updates.length+' row'+(updates.length!==1?'s':'')+' updated ✓','success');
  closeEditMov();
  _renderMovHistory(); // refresh cards with new values
}

// ── DELETE ─────────────────────────────────────────────────────
async function deleteMovBatch(batchKey){
  if(!confirm('Delete this movement batch? Stock counts will NOT be reversed automatically.')) return;
  const r = await api({action:'deleteMovementBatch', batchKey});
  if(r.status==='ok'){
    _movHistBatches = _movHistBatches.filter(b=>b.batchKey!==batchKey);
    _renderMovHistory();
    showToast('Movement batch deleted','success');
  } else {
    alert('Delete failed: '+(r.msg||'Unknown error'));
  }
}

// ── DRIVER SCREEN ──
