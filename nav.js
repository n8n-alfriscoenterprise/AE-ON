// ── NAVIGATION ──
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Persist last screen so refresh restores it
  if(currentUser && id !== 'login-screen'){
    const session = LS.get('alf_session') || {};
    session.lastScreen = id;
    LS.set('alf_session', session);
  }
}

// ── STAFF / ADMIN APP ──
// ── PRIMARY ENTRY AFTER LOGIN ──
function showApp(){
  startOfflineSync();
  _startActivityWatcher();
  if(currentUser.role==='driver') showDriver();
  else showHome();
}

function showHome(){
  showScreen('home-screen');
  updateFabVisibility();
  document.getElementById('home-topbar-user').textContent=`${currentUser.username} · ${currentUser.role}`;
  const isDriver=currentUser.role==='driver';
  const canPO=(currentUser.role==='admin'
    || currentUser.canManagePODist===true
    || currentUser.canManagePORetail===true)
    && !isDriver;
  const isAdmin=currentUser.role==='admin';
  const hpo=document.getElementById('home-po-nav');
  const hadm=document.getElementById('home-admin-nav');
  const hstock=document.getElementById('home-stock-nav');
  const hcount=document.getElementById('home-count-nav');
  if(hpo)hpo.style.display=canPO?'block':'none';
  if(hadm)hadm.style.display=isAdmin?'block':'none';
  if(hstock){
    if(isDriver){ hstock.textContent='📋 Manifest'; hstock.onclick=showDriver; }
    else { hstock.textContent='📦 Stock'; hstock.onclick=showMovement; }
  }
  if(hcount) hcount.style.display=isDriver?'none':'block';
  const h=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Manila'})).getHours();
  const greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  document.getElementById('home-greeting').textContent=greet+', '+currentUser.username;
  buildHomeTiles();
}

function buildHomeTiles(){
  const grid=document.getElementById('home-tiles');
  if(!grid)return;
  grid.innerHTML='';
  const tiles=[];
  // 0. Product List — always visible if canViewProductList
  const canPL = currentUser.role==='admin' || currentUser.canViewProductList===true;
  if(canPL) tiles.push({icon:'📋',name:'Product List',desc:'Item prices & current stock levels',cls:'t-product',fn:'openPL()',badge:'ls-alert-badge'});
  // 1. Stock Movement / Manifest
  if(currentUser.role==='driver'){
    tiles.unshift({icon:'📋',name:"Today's Manifest",desc:"View today's van load & remaining stock",cls:'t-movement',fn:'showDriver()',badge:'mov-home-badge'});
  } else {
    tiles.push({icon:'📦',name:'Stock Movement',desc:'Load & return stocks for Bajaj routes',cls:'t-movement',fn:'showMovement()',badge:'mov-home-badge'});
  }
  // 2. Transfer
  const canTrfTile=currentUser.role==='admin'||currentUser.canTransfer===true;
  if(canTrfTile) tiles.push({icon:'🔄',name:'Transfer',desc:'Move stock between warehouse, store & Bajaj',cls:'t-transfer',fn:'openTransfer()',badge:'trf-home-badge'});
  // 3. Purchase Orders
  const canPODist   = currentUser.role==='admin' || currentUser.canManagePODist===true;
  const canPORetail = currentUser.role==='admin' || currentUser.canManagePORetail===true;
  const canAnyPO    = canPODist || canPORetail;
  if(canAnyPO) tiles.push({icon:'📋',name:'Purchase Orders',desc:'Create, approve & receive supplier orders',cls:'t-po',fn:'openPO()',badge:'po-pending-badge'});
  // 4. General Inventory
  const canCount=currentUser.canCountDist!==false||currentUser.canCountRetail!==false;
  if(canCount) tiles.push({icon:'🔢',name:'General Inventory',desc:'Physical count for Distribution or Retail',cls:'t-inventory',fn:'openCount()'});
  const canSATile = currentUser.role==='admin' || currentUser.canStockAdjust===true;
  if(canSATile) tiles.push({icon:'📊',name:'Stock Adjustment',desc:'Receive, count, remove or record damage',cls:'t-sa',fn:'openSA()'});
  // Count History
  const canCH = currentUser.role==='admin' || currentUser.canViewCountHistory===true;
  if(canCH) tiles.push({icon:'📊',name:'Count History',desc:'View submitted counts, variances & frequency analysis',cls:'t-count-history',fn:'openCountHistory()'});
  // Request New Item — staff & drivers (not admin; admin reviews via Admin panel)
  if(currentUser.role !== 'admin'){
    tiles.push({icon:'📥',name:'Request New Item',desc:'Suggest a product to be added to the SKU Master list',cls:'t-skureq',fn:'openSKURequestModal()'});
  }
  // 5. Suppliers — admin + PO staff
  const canSuppliers = currentUser.role==='admin'||currentUser.canManagePODist===true||currentUser.canManagePORetail===true;
  if(canSuppliers) tiles.push({icon:'🏢',name:'Suppliers',desc:'Contacts, payment terms & delivery schedules',cls:'t-supplier',fn:'openSuppliers()'});
  // 6. Backorders — opens monitoring screen; FABs handle quick-log
  const canBoDist   = currentUser.role==='admin' || currentUser.canBackorderDist!==false;
  const canBoRetail = currentUser.role==='admin' || currentUser.canBackorderRetail===true;
  if(canBoDist||canBoRetail){
    const boDesc = (canBoDist&&canBoRetail)
      ? 'Track & update dealer and retail backorder status'
      : canBoDist ? 'Track & update dealer backorder status'
                  : 'Track & update retail backorder status';
    tiles.push({icon:'⚠️',name:'Backorders',desc:boDesc,cls:'t-backorder',fn:'openBoScreen()',badge:'bo-home-badge'});
  }
  // 7. Production
  const canProdTile=currentUser.role==='admin'||currentUser.canProduction===true||currentUser.role==='staff-retail';
  if(canProdTile) tiles.push({icon:'🏭',name:'Production',desc:'Convert bags to smaller retail units',cls:'t-prod',fn:'openProduction()'});
  // 8. Dealer Directory
  const canDealers = currentUser.role==='admin' || currentUser.canBackorderDist!==false || currentUser.canManageDealers===true;
  if(canDealers) tiles.push({icon:'👥',name:'Dealer Directory',desc:'Dealer profiles, GPS pins & contact records',cls:'t-dealer',fn:'openDealer()'});
  // 9. Sales Invoice
  const canInvoice = currentUser.role==='admin' || currentUser.canCreateInvoice===true;
  if(canInvoice) tiles.push({icon:'🧾',name:'Sales Invoice',desc:'Create invoices, print & export to Xero',cls:'t-invoice',fn:'openInvoice()'});
  // 10. Sales Import — admin only
  if(currentUser.role==='admin') tiles.push({icon:'📥',name:'Sales Import',desc:'Import Xero (distribution) & Loyverse (retail) sales',cls:'t-xero',fn:'openSalesImport()'});
  // 10. Admin
  if(currentUser.role==='admin') tiles.push({icon:'⚙️',name:'Admin',desc:'Staff accounts & app settings',cls:'t-admin',fn:'openAdminFromHome()'});
  if(tiles.length%2!==0) tiles[tiles.length-1].full=true;
  tiles.forEach(t=>{
    const div=document.createElement('div');
    div.className='tile '+t.cls+(t.full?' full-width':'');
    div.onclick=new Function(t.fn);
    div.innerHTML=`<span class="tile-icon">${t.icon}</span><div class="tile-name">${t.name}</div><div class="tile-desc">${t.desc}</div><span class="tile-arrow">→</span>${t.badge?'<span class="tile-badge" id="'+t.badge+'" style="display:none">!</span>':''}`;
    grid.appendChild(div);
  });
  if(currentUser.role==='admin') loadPendingBadge();
  if(canPL) loadLowStockBadge();
  loadPendingCounts();
  loadBottleneckAlerts();
}

async function loadPendingCounts(){
  try{
    const r=await api({action:'getPendingCounts'});
    if(r.status!=='ok') return;
    const trf=document.getElementById('trf-home-badge');
    const bo =document.getElementById('bo-home-badge');
    const mov=document.getElementById('mov-home-badge');
    if(trf){ if(r.transferCount>0){trf.textContent=r.transferCount;trf.style.display='inline-flex';}else{trf.style.display='none';} }
    if(bo){  if(r.boCount>0)      {bo.textContent=r.boCount;      bo.style.display='inline-flex';}else{bo.style.display='none';}  }
    if(mov){ if(r.movCount>0)     {mov.textContent=r.movCount;    mov.style.display='inline-flex';}else{mov.style.display='none';}}
  }catch(e){ console.error('loadPendingCounts failed',e); }
}

async function loadBottleneckAlerts(){
  const canAlert = currentUser && (currentUser.role === 'admin' || currentUser.canManagePODist === true);
  if(!canAlert) return;
  try{
    const r = await api({ action: 'getBottleneckAlerts' });
    if(r.status === 'ok') _renderBottleneckBanner(r.bottlenecks || []);
  }catch(e){ console.error('loadBottleneckAlerts', e); }
}

function _renderBottleneckBanner(items){
  const banner = document.getElementById('bottleneck-banner');
  if(!banner) return;
  if(!items.length){ banner.style.display = 'none'; return; }

  const outOfStock = items.filter(i => i.stock === 0).length;

  banner.style.display = 'block';
  banner.innerHTML =
    '<div class="bnk-header" onclick="_toggleBottleneckList()">'
      +'<span class="bnk-icon">⚠</span>'
      +'<div class="bnk-title">'
        +'<strong>'+items.length+' item'+(items.length===1?'':'s')+' need reordering</strong>'
        +'<span class="bnk-sub"> · No open PO</span>'
        +(outOfStock ? ' <span class="bnk-oos-badge">'+outOfStock+' out of stock</span>' : '')
      +'</div>'
      +'<span class="bnk-chevron" id="bnk-chevron">▼</span>'
    +'</div>'
    +'<div class="bnk-list" id="bnk-list" style="display:none">'
      +items.map(function(i){
        const pct  = i.parLevel > 0 ? Math.round((i.stock / i.parLevel) * 100) : 0;
        const zero = i.stock === 0;
        return '<div class="bnk-item'+(zero?' bnk-item-zero':'')+'">'
          +'<div class="bnk-item-info">'
            +'<div class="bnk-item-name">'+i.name+'</div>'
            +'<div class="bnk-item-supplier">'+(i.supplier||'No supplier set')+'</div>'
          +'</div>'
          +'<div class="bnk-item-right">'
            +'<div class="bnk-stock-label">'
              +(zero ? '<span class="bnk-zero-tag">OUT</span>'
                     : '<span>'+i.stock+' / '+i.parLevel+'</span>')
            +'</div>'
            +'<div class="bnk-bar-wrap"><div class="bnk-bar-fill" style="width:'+Math.min(100,pct)+'%'+(zero?';background:#E53935':'')+'"></div></div>'
            +'<div class="bnk-shortfall">Need '+i.shortfall+'</div>'
          +'</div>'
        +'</div>';
      }).join('')
      +'<button class="bnk-po-btn" onclick="openPO()">📋 Go to Purchase Orders →</button>'
    +'</div>';
}

function _toggleBottleneckList(){
  const list    = document.getElementById('bnk-list');
  const chevron = document.getElementById('bnk-chevron');
  if(!list) return;
  const open = list.style.display === 'none';
  list.style.display    = open ? 'block' : 'none';
  if(chevron) chevron.textContent = open ? '▲' : '▼';
}

async function loadLowStockBadge(){
  // If plData is already loaded (user visited Product List this session), compute directly
  if(typeof plLoaded !== 'undefined' && plLoaded){
    if(typeof updateLowStockBadge === 'function') updateLowStockBadge();
    return;
  }
  // Otherwise fetch fresh from API
  try{
    const r = await api({action:'getProductList'});
    if(r.status==='ok'){
      const all = [...(r.dist||[]), ...(r.retail||[])];
      const n = all.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel).length;
      const badge = document.getElementById('ls-alert-badge');
      if(badge){
        if(n > 0){ badge.textContent = n; badge.style.display = 'inline-flex'; }
        else { badge.style.display = 'none'; }
      }
      if(n > 0){
        showToast(
          n === 1 ? '1 item is below par level' : n + ' items are below par level',
          'warning', 4500
        );
      }
    }
  }catch(e){
    console.error('loadLowStockBadge failed', e);
  }
}

function showMovement(){
  showScreen('app-screen');
  updateFabVisibility();
  document.getElementById('topbar-user').textContent=`${currentUser.username} · ${currentUser.role}`;
  const canPO=currentUser.role==='admin'
    || currentUser.canManagePODist===true
    || currentUser.canManagePORetail===true;
  const isAdmin=currentUser.role==='admin';
  if(document.getElementById('tnav-po')) document.getElementById('tnav-po').style.display=canPO?'block':'none';
  if(document.getElementById('tnav-admin')) document.getElementById('tnav-admin').style.display=isAdmin?'block':'none';
  const histBtn=document.getElementById('mov-history-btn');
  if(histBtn) histBtn.style.display=isAdmin?'flex':'none';
  document.getElementById('movement-area').style.display='block';
  document.getElementById('mode-btn').style.display='flex';
  isReturnMode=false;
  document.getElementById('mode-btn').textContent='LOAD';
  document.getElementById('mode-btn').className='mode-btn';
  document.getElementById('submit-btn').className='submit-btn';
  document.getElementById('submit-btn').textContent='Submit to Google Sheets';
  setTNav('tnav-movement');
  quantities={};currentTab='dist';currentCat='All';
  document.querySelectorAll('#movement-area .tab').forEach(t=>t.classList.remove('active'));
  const ft=document.querySelector('#movement-area .tab');
  if(ft)ft.classList.add('active');
  buildTab();
  // Pull in any vehicles added to the Delivery Vehicles sheet, then init tracking
  loadVehicles().then(function(){
    injectUnitVehicles();
    const s = document.getElementById('unit-select');
    if(s) s.dataset.lastUnit = s.value;
  });
  // Initialize unit tracking
  const sel = document.getElementById('unit-select');
  if(sel) sel.dataset.lastUnit = sel.value;
}

function setTNav(activeId){
  document.querySelectorAll('#app-screen .tnav').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById(activeId);
  if(el)el.classList.add('active');
}

function openAdminFromHome(){
  // Go directly to admin-screen — no intermediate app-screen, no redundant password prompt
  showScreen('admin-screen');
  updateFabVisibility();
  showAdmin();
}

function setTab(tab,el){
  currentTab=tab;currentCat='All';
  document.querySelectorAll('#app-screen .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');buildTab();
}
