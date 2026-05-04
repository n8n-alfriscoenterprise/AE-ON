async function openPL(){
  showScreen('pl-screen');
  updateFabVisibility();
  document.getElementById('pl-search').value = '';
  plSearch = '';
  plCat = 'All';

  // Enforce plView permission — show/hide tabs and set default
  const view = (currentUser && currentUser.plView) || 'both';
  const distTab   = document.getElementById('pl-tab-dist');
  const retailTab = document.getElementById('pl-tab-retail');
  const subtabBar = document.querySelector('.pl-subtabs');

  if(view === 'dist'){
    plTab = 'dist';
    if(subtabBar) subtabBar.style.display = 'none'; // only one list — hide tabs
  } else if(view === 'retail'){
    plTab = 'retail';
    if(subtabBar) subtabBar.style.display = 'none';
  } else {
    plTab = 'dist';
    if(subtabBar) subtabBar.style.display = '';     // show both tabs
  }

  document.querySelectorAll('.pl-subtab').forEach(t=>t.classList.remove('active'));
  const activeTab = document.getElementById('pl-tab-' + plTab);
  if(activeTab) activeTab.classList.add('active');

  document.getElementById('pl-body').innerHTML = '<div class="pl-empty">Loading product list...</div>';
  document.getElementById('pl-summary-count').textContent = 'Loading...';
  await loadPLData();
  buildPLChips();
  renderPL();
}

function closePL(){
  if(currentUser && currentUser.role === 'driver') showDriver();
  else showHome();
}

async function loadPLData(){
  try{
    const r = await api({action:'getProductList'});
    if(r.status==='ok'){
      plData.dist   = r.dist   || [];
      plData.retail = r.retail || [];
      plLoaded = true;
      updateLowStockBadge();
    }
  }catch(e){
    console.error('loadPLData failed', e);
  }
}

function countLowStock(){
  const all = [...(plData.dist||[]), ...(plData.retail||[])];
  return all.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel).length;
}

function updateLowStockBadge(){
  const badge = document.getElementById('ls-alert-badge');
  if(!badge) return;
  const n = countLowStock();
  if(n > 0){
    badge.textContent = n;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function setPLTab(tab, el){
  plTab = tab;
  plCat = 'All';
  plSearch = '';
  document.getElementById('pl-search').value = '';
  document.querySelectorAll('.pl-subtab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  buildPLChips();
  renderPL();
}

function buildPLChips(){
  const bar = document.getElementById('pl-chips');
  bar.innerHTML = '';
  const items = plData[plTab];

  // Low Stock chip — shown when any items in this tab have par levels set
  const lowCount = items.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel).length;
  if(lowCount > 0){
    const lc = document.createElement('div');
    lc.className = 'pl-chip pl-chip-alert' + (plCat==='__lowstock__'?' active':'');
    lc.textContent = '⚠️ Low Stock (' + lowCount + ')';
    lc.onclick = ()=>{ plCat='__lowstock__'; buildPLChips(); renderPL(); };
    bar.appendChild(lc);
  }

  const cats = ['All', ...new Set(items.map(i=>i.category).filter(Boolean))];
  cats.forEach(cat=>{
    const c = document.createElement('div');
    c.className = 'pl-chip' + (cat===plCat?' active':'');
    const count = cat==='All' ? items.length : items.filter(i=>i.category===cat).length;
    c.textContent = cat + ' (' + count + ')';
    c.onclick = ()=>{ plCat=cat; buildPLChips(); renderPL(); };
    bar.appendChild(c);
  });
}

function onPLSearch(val){
  plSearch = val.toLowerCase().trim();
  renderPL();
}

function renderPL(){
  const body   = document.getElementById('pl-body');
  const items  = plData[plTab];
  if(!items.length){
    body.innerHTML = '<div class="pl-empty">No products found.<br>Make sure SKU Master sheets are uploaded.</div>';
    document.getElementById('pl-summary-count').textContent = '0 products';
    return;
  }

  // Filter
  let visible;
  if(plCat==='__lowstock__'){
    visible = items.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel);
  } else {
    visible = plCat==='All' ? items : items.filter(i=>i.category===plCat);
  }
  if(plSearch){
    visible = visible.filter(i=>
      i.name.toLowerCase().includes(plSearch) ||
      String(i.sku).toLowerCase().includes(plSearch)
    );
  }

  // Summary
  const withPrice = visible.filter(i=>i.price>0).length;
  const withStock = visible.filter(i=>i.stock!==null).length;
  document.getElementById('pl-summary-count').textContent =
    visible.length + ' product' + (visible.length!==1?'s':'') +
    ' · ' + withPrice + ' priced · ' + withStock + ' with stock';

  // Latest update timestamp
  const dated = visible.filter(i=>i.lastUpdated);
  if(dated.length){
    const latest = dated.reduce((a,b)=>new Date(a.lastUpdated)>new Date(b.lastUpdated)?a:b);
    document.getElementById('pl-summary-updated').textContent = 'Stock as of: ' + latest.lastUpdated;
  } else {
    document.getElementById('pl-summary-updated').textContent = 'No stock counts yet';
  }

  if(!visible.length){
    body.innerHTML = '<div class="pl-empty">No products match your search.</div>';
    return;
  }

  body.innerHTML = '';

  // Group by category
  const groupAll = plCat==='All' || plCat==='__lowstock__';
  const cats = groupAll
    ? [...new Set(visible.map(i=>i.category))]
    : [plCat];

  cats.forEach(cat=>{
    const catItems = visible.filter(i=>i.category===cat);
    if(!catItems.length) return;

    if(groupAll){
      const hdr = document.createElement('div');
      hdr.className = 'pl-cat-header';
      hdr.textContent = cat + ' (' + catItems.length + ')';
      body.appendChild(hdr);
    }

    catItems.forEach(item=>{
      const row = document.createElement('div');
      row.className = 'pl-row';

      // Stock display
      let stockHtml = '';
      if(item.stock === null){
        stockHtml = `<div class="pl-stock">
          <div class="pl-stock-val pl-stock-na">—</div>
          <div class="pl-stock-label">no count</div>
        </div>`;
      } else {
        const qty = Number(item.stock);
        const par = Number(item.parLevel) || 0;
        let cls, label;
        if(qty <= 0){
          cls = 'pl-stock-out'; label = 'FOR BACKORDER';
        } else if(par > 0 && qty < par){
          cls = 'pl-stock-low'; label = 'LOW (par ' + par + ')';
        } else {
          cls = 'pl-stock-ok'; label = 'IN STOCK';
        }
        stockHtml = `<div class="pl-stock">
          <div class="pl-stock-val ${cls}">${qty <= 0 ? '0' : qty}</div>
          <div class="pl-stock-label">${label}</div>
        </div>`;
      }

      // Price display
      const priceHtml = item.price > 0
        ? `<div class="pl-price">
            <div class="pl-price-val">₱${Number(item.price).toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
            <div class="pl-price-label">per ${item.unit||'unit'}</div>
          </div>`
        : `<div class="pl-price">
            <div class="pl-price-val" style="color:#ccc">—</div>
            <div class="pl-price-label">no price</div>
          </div>`;

      row.innerHTML = `
        <div class="pl-info">
          <div class="pl-name">${item.name}</div>
          <div class="pl-code">${item.sku}</div>
        </div>
        ${priceHtml}
        ${stockHtml}`;
      body.appendChild(row);
    });
  });
}


// ════════════════════════════════════════════════════════
// COST PRICE EDITOR — admin only
// ════════════════════════════════════════════════════════
let ceType = 'dist';
let ceSearch = '';
let ceEdits = {};  // {skuCode: newCost}
let ceSKUs = [];   // current type's SKUs from liveSKUs

