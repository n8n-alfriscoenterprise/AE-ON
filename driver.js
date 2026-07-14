async function showDriver(){
  showScreen('driver-screen');
  updateFabVisibility();
  const unit=currentUser.assignedUnit||'Bajaj1';
  document.getElementById('driver-topbar-user').textContent=`${currentUser.username} · driver`;
  document.getElementById('driver-unit-badge').textContent=unit;
  // Show Price List button only if driver has permission
  const plBtn=document.getElementById('driver-pl-btn');
  if(plBtn) plBtn.style.display=(currentUser.canViewProductList!==false)?'block':'none';
  driverCat='All';
  await loadDriverManifest();
}

async function loadDriverManifest(){
  const unit=currentUser.assignedUnit||'Bajaj1';
  const listEl=document.getElementById('driver-sku-list');
  listEl.innerHTML='<div class="driver-empty">Loading manifest...</div>';
  try{
    const r=await api({action:'getTodayLoads',unit,createdBy:currentUser.username});
    if(r.status==='ok'){
      driverManifest=r.rows||[];
      buildDriverChips();
      buildDriverList();
      updateDriverTotals();
    }else{
      listEl.innerHTML='<div class="driver-empty">Could not load manifest. Pull to refresh.</div>';
    }
  }catch(e){
    listEl.innerHTML='<div class="driver-empty">Network error. Please check your connection.</div>';
  }
}

function buildDriverChips(){
  const bar=document.getElementById('driver-chips-bar');bar.innerHTML='';
  const cats=['All',...new Set(driverManifest.map(i=>i.cat).filter(Boolean))];
  cats.forEach(cat=>{
    const c=document.createElement('div');
    c.className='chip'+(cat===driverCat?' active':'');
    c.textContent=cat;
    c.onclick=()=>{driverCat=cat;buildDriverChips();buildDriverList();};
    bar.appendChild(c);
  });
}

function buildDriverList(){
  const list=document.getElementById('driver-sku-list');list.innerHTML='';
  const visible=driverCat==='All'?driverManifest:driverManifest.filter(i=>i.cat===driverCat);
  if(!visible.length){
    list.innerHTML='<div class="driver-empty">No items loaded yet for today.<br>Ask warehouse staff to submit the morning load.</div>';
    return;
  }
  // Group by category
  const cats=[...new Set(visible.map(i=>i.cat||'Uncategorised'))];
  cats.forEach(cat=>{
    if(driverCat==='All'){
      const hdr=document.createElement('div');hdr.className='cat-header';hdr.textContent=cat;list.appendChild(hdr);
    }
    visible.filter(i=>(i.cat||'Uncategorised')===cat).forEach((item,idx)=>{
      // INV/OTS split comes from the Tag column (older backend: everything = INV)
      const inv = Number(item.invoicedLoaded!=null ? item.invoicedLoaded : item.loaded)||0;
      const ots = Number(item.otsExtra)||0;
      const row=document.createElement('div');row.className='driver-sku-row';
      row.innerHTML=`
        <div class="driver-sku-info">
          <div class="driver-sku-name">${item.name}</div>
          <div class="driver-sku-code">${item.code}</div>
        </div>
        <div class="driver-stat-strip">
          <div class="driver-stat inv"><span class="driver-stat-lbl">Inv</span><span class="driver-stat-val">${inv}</span></div>
          <div class="driver-stat ots"><span class="driver-stat-lbl">OTS</span><span class="driver-stat-val">${ots}</span></div>
          <div class="driver-stat load"><span class="driver-stat-lbl">Loaded</span><span class="driver-stat-val">${item.loaded||0}</span></div>
          <div class="driver-stat ret"><span class="driver-stat-lbl">Returned</span><span class="driver-stat-val">${item.returned||0}</span></div>
          <div class="driver-stat sold"><span class="driver-stat-lbl">Sold</span><span class="driver-stat-val">${item.sold||0}</span></div>
        </div>`;
      list.appendChild(row);
    });
  });
}

function updateDriverTotals(){
  const totalLoaded=driverManifest.reduce((s,i)=>s+(i.loaded||0),0);
  const totalSold=driverManifest.reduce((s,i)=>s+(i.sold||0),0);
  const totalRemaining=Math.max(0,totalLoaded-totalSold);
  document.getElementById('d-loaded').textContent=Math.round(totalLoaded);
  document.getElementById('d-remaining').textContent=Math.round(totalRemaining);
}

// ── ADMIN MODAL ──
