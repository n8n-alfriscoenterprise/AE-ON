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
  startOfflineSync(); // begin offline invoice sync loop (no-op if already running)
  if(currentUser.role==='driver') showDriver();
  else showHome();
}

function showHome(){
  showScreen('home-screen');
  updateFabVisibility();
  document.getElementById('home-topbar-user').textContent=`${currentUser.username} · ${currentUser.role}`;
  const canPO=(currentUser.role==='admin'
    || currentUser.canManagePODist===true
    || currentUser.canManagePORetail===true)
    && currentUser.role!=='driver';
  const isAdmin=currentUser.role==='admin';
  const hpo=document.getElementById('home-po-nav');
  const hadm=document.getElementById('home-admin-nav');
  if(hpo)hpo.style.display=canPO?'block':'none';
  if(hadm)hadm.style.display=isAdmin?'block':'none';
  const h=new Date().getHours();
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
  // 1. Stock Movement — always visible
  tiles.push({icon:'📦',name:'Stock Movement',desc:'Load & return stocks for Bajaj routes',cls:'t-movement',fn:'showMovement()',badge:'mov-home-badge'});
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
