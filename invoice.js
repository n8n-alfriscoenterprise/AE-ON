// ══════════════════════════════════════════════════════════════
// SALES INVOICE  — field sales edition
// ══════════════════════════════════════════════════════════════

// ── STATE ─────────────────────────────────────────────────────
let invLines         = [];
let invProducts      = [];     // [{code, name, price, unit}]
let invSaved         = false;
let invCurrentNumber = null;
let invoiceHistory   = [];

// Van stock (driver mode)
let vanStockData     = {};     // {sku: {loaded, returned, invoiced, available}}
let vanStockLoaded   = false;

// Signature canvas
let sigCanvas        = null;
let sigCtx           = null;
let sigDrawing       = false;
let sigHasData       = false;
let _sigListeners    = false;  // guard — add canvas listeners only once

// Charge two-step state
let _chargeStep      = 0;     // 0 = ready, 1 = customer copy printed, waiting for merchant
let _cachedReceiptHtml = '';  // built once, reused for merchant copy

// Save double-tap guard
let _invSaving       = false;


// ── OPEN / CLOSE ──────────────────────────────────────────────
async function openInvoice(){
  showScreen('invoice-screen');
  updateFabVisibility();
  showInvSubtab('new', document.getElementById('inv-tab-new'));
  // Load dealers + products in PARALLEL — they were sequential, doubling the wait
  await Promise.all([
    dealerList.length ? Promise.resolve() : loadDealers(),
    loadInvProducts()
  ]);
  buildInvDealerSelect();
  resetInvForm();
  // Background loads
  loadVanStock();               // no-op for non-driver
  _fetchInvoiceHistory();       // pre-populate order history cards
  updateOfflineBadge();
  // Xero button — admin only
  const xeroBtn = document.getElementById('inv-xero-btn');
  if(xeroBtn) xeroBtn.style.display = (currentUser && currentUser.role==='admin') ? '' : 'none';
  // Signature canvas — needs a brief tick so the DOM has rendered
  setTimeout(initSignatureCanvas, 80);
}

function closeInvoice(){ showHome(); }

// ── ADD NEW DEALER SHORTCUT ───────────────────────────────────
function addNewDealerFromInvoice(){
  window._invReturnAfterDealer = true;
  openDealer();
  setTimeout(openNewDealerForm, 80);
}

function showInvSubtab(tab, el){
  document.querySelectorAll('.inv-subtab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  document.getElementById('inv-view-new').style.display     = tab==='new'     ? 'flex' : 'none';
  document.getElementById('inv-view-history').style.display = tab==='history' ? 'flex' : 'none';
  if(tab==='history') loadInvoiceHistory();
}


// ── LOAD PRODUCTS ─────────────────────────────────────────────
async function loadInvProducts(){
  if(invProducts.length) return;
  try{
    const r = await api({action:'getProductList'});
    if(r.status==='ok'){
      invProducts = (r.dist||[]).map(i=>({
        code:      i.sku,
        name:      i.name,
        price:     Number(i.price)||0,
        unit:      i.unit||'unit',
        bundleQty: Number(i.bundleQty)||1
      }));
    }
  }catch(e){ console.error('loadInvProducts',e); }
}


// ── VAN STOCK ─────────────────────────────────────────────────
async function loadVanStock(){
  if(!currentUser) return;
  const unit = currentUser.assignedUnit;
  if(!unit || unit==='All') return;        // not a driver — skip
  vanStockData   = {};
  vanStockLoaded = false;
  try{
    const r = await api({action:'getVanStock', unit, createdBy: currentUser.username});
    if(r.status==='ok'){
      vanStockData   = r.vanStock || {};
      vanStockLoaded = true;
      renderInvLines(); // refresh labels if form already has lines
    }
  }catch(e){ console.error('loadVanStock',e); }
}

// Returns how many of `sku` the driver still has available,
// after subtracting qty already used in other lines of this invoice.
function getVanAvailableForLine(sku, currentIdx){
  if(!sku || !vanStockData[sku]) return null;
  const base = vanStockData[sku].available;
  let used = 0;
  invLines.forEach((l,i)=>{ if(i!==currentIdx && l.sku===sku) used += (l.qty||0); });
  return Math.max(0, base - used);
}


// ── RESET FORM ────────────────────────────────────────────────
function resetInvForm(){
  invLines         = [];
  invSaved         = false;
  invCurrentNumber = null;

  document.getElementById('inv-number').value = 'Draft';
  const today = new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'}).slice(0,10);
  document.getElementById('inv-date').value  = today;
  _clearInvDealer();   // hidden id + search text + info + contact-fix + history
  document.getElementById('inv-ref').value   = '';
  document.getElementById('inv-terms').value = 'COD';
  onInvTermsChange();

  // Payment type
  const ptEl = document.getElementById('inv-payment-type');
  if(ptEl) ptEl.value = 'Cash';
  onInvPaymentTypeChange();

  document.getElementById('inv-err').textContent = '';
  document.getElementById('inv-lines-container').innerHTML = '';
  clearSignature();
  updateInvTotals();
  addInvLine();

  // Reset charge two-step state
  _chargeStep        = 0;
  _cachedReceiptHtml = '';
  const chargeBtn = document.getElementById('inv-charge-btn');
  if(chargeBtn){
    chargeBtn.textContent  = '⚡ Charge';
    chargeBtn.style.background = '';
  }

  // Options collapse back for the next sale (defaults cover street selling)
  toggleInvOptions(false);
  _updateInvOptionsSummary();
}


// ── DEALER SEARCH COMBOBOX ────────────────────────────────────
// Type-to-search picker over dealerList. The hidden #inv-dealer input still holds
// the selected dealerId, so every downstream save/charge read is unchanged.
function _invDealerCandidates(){
  return dealerList
    .filter(d=>d.status==='Active'||d.status==='On Hold')
    .sort((a,b)=>a.storeName.localeCompare(b.storeName));
}

// Kept for existing callers (openInvoice, xero-import): re-syncs the visible
// search text to whatever dealerId the hidden field currently holds.
function buildInvDealerSelect(){
  const hid = document.getElementById('inv-dealer');
  _setInvDealerDisplay(hid ? hid.value : '');
}

function _setInvDealerDisplay(dealerId){
  const d     = dealerList.find(x=>x.dealerId===dealerId);
  const input = document.getElementById('inv-dealer-search');
  const clr   = document.getElementById('inv-dealer-clear');
  if(input) input.value = d ? d.storeName+(d.area?' · '+d.area:'') : '';
  if(clr)   clr.style.display = d ? 'flex' : 'none';
}

function _invDealerFocus(){
  const input = document.getElementById('inv-dealer-search');
  if(input) input.value = '';          // clear so the user can type fresh
  _invDealerSearch('');
}

function _invDealerSearch(query){
  const dd = document.getElementById('inv-dealer-dd');
  if(!dd) return;
  const q   = query.toLowerCase().trim();
  const all = _invDealerCandidates();
  const matches = !q
    ? all.slice(0,20)
    : all.filter(d=>
        (d.storeName||'').toLowerCase().includes(q)
        || (d.ownerName||'').toLowerCase().includes(q)
        || (d.area||'').toLowerCase().includes(q)
        || (d.phone1||'').includes(q)
      ).slice(0,25);
  let html = '<div class="inv-dealer-dd-item inv-dealer-dd-add" '
    +'onmousedown="_selectInvDealer(\'__add_new__\')">＋ Add New Dealer</div>';
  html += matches.length
    ? matches.map(d=>{
        const missing = _invContactMissing(d);
        const flag = missing.length ? '<span class="inv-dealer-dd-flag">⚠ incomplete</span>' : '';
        const meta = [d.ownerName, d.area].filter(Boolean).join(' · ');
        return '<div class="inv-dealer-dd-item" onmousedown="_selectInvDealer(\''+d.dealerId+'\')">'
          +'<div class="inv-dealer-dd-name">'+d.storeName+flag+'</div>'
          +(meta?'<div class="inv-dealer-dd-meta">'+meta+'</div>':'')
          +'</div>';
      }).join('')
    : '<div class="inv-dealer-dd-empty">No dealers found — tap ＋ to add</div>';
  dd.innerHTML = html;
  dd.style.display = 'block';
}

function _hideInvDealerDd(){
  // Delay so an onmousedown selection lands before blur hides the list
  setTimeout(function(){
    const dd = document.getElementById('inv-dealer-dd');
    if(dd) dd.style.display = 'none';
    // Restore the display text to the currently-selected dealer (if any)
    const hid = document.getElementById('inv-dealer');
    _setInvDealerDisplay(hid ? hid.value : '');
  }, 150);
}

function _selectInvDealer(dealerId){
  const dd = document.getElementById('inv-dealer-dd');
  if(dd) dd.style.display = 'none';
  if(dealerId === '__add_new__'){
    _clearInvDealer();
    addNewDealerFromInvoice();
    return;
  }
  const hid = document.getElementById('inv-dealer');
  if(hid) hid.value = dealerId;
  _setInvDealerDisplay(dealerId);
  onInvDealerChange();
}

function _clearInvDealer(){
  const hid   = document.getElementById('inv-dealer');
  if(hid) hid.value = '';
  const input = document.getElementById('inv-dealer-search');
  if(input) input.value = '';
  const clr   = document.getElementById('inv-dealer-clear');
  if(clr) clr.style.display = 'none';
  const info  = document.getElementById('inv-dealer-info');
  if(info) info.style.display = 'none';
  const fix   = document.getElementById('inv-contact-fix');
  if(fix) fix.style.display = 'none';
  const oh    = document.getElementById('inv-order-history');
  if(oh) oh.style.display = 'none';
}

// Invoice-relevant contact fields that a dealer should have on file
function _invContactMissing(d){
  const missing = [];
  if(!d) return missing;
  if(!String(d.ownerName||'').trim()) missing.push('Owner name');
  if(!String(d.phone1||'').trim())    missing.push('Phone');
  if(!String(d.area||'').trim())      missing.push('Area');
  if(!String(d.address||'').trim())   missing.push('Address');
  return missing;
}

function onInvDealerChange(){
  const hid  = document.getElementById('inv-dealer');
  const info = document.getElementById('inv-dealer-info');
  const d    = dealerList.find(x=>x.dealerId===(hid?hid.value:''));
  if(d){
    info.innerHTML =
      '<strong>'+(d.ownerName||'—')+'</strong> · '+(d.phone1||'no phone')
      +(d.area?' · '+d.area:'')
      +(d.address?'<br>'+d.address:'');
    info.style.display = 'block';
    _renderContactFixTrigger(d);
    _renderDealerOrderHistory(d.dealerId);
  } else {
    info.style.display = 'none';
    const fix = document.getElementById('inv-contact-fix');
    if(fix) fix.style.display = 'none';
    const oh = document.getElementById('inv-order-history');
    if(oh) oh.style.display = 'none';
  }
}

// ── CONTACT-COMPLETION TRIGGER ────────────────────────────────
// When the selected dealer is missing invoice-relevant details, surface a quick
// prompt so the seller can complete the contact right there — without leaving
// the invoice (which would lose the cart).
function _renderContactFixTrigger(d){
  const fix = document.getElementById('inv-contact-fix');
  if(!fix) return;
  const missing = _invContactMissing(d);
  if(!missing.length){ fix.style.display='none'; return; }
  fix.innerHTML =
    '<div class="inv-contact-fix-msg">⚠ Missing: <strong>'+missing.join(', ')+'</strong></div>'
    +'<button class="inv-contact-fix-btn" onclick="openInvContactModal()">Complete</button>';
  fix.style.display = 'flex';
}

function openInvContactModal(){
  const hid = document.getElementById('inv-dealer');
  const d = dealerList.find(x=>x.dealerId===(hid?hid.value:''));
  if(!d) return;
  document.getElementById('icm-store-label').textContent = d.storeName;
  document.getElementById('icm-owner').value   = d.ownerName || '';
  document.getElementById('icm-phone1').value  = d.phone1    || '';
  document.getElementById('icm-area').value    = d.area      || '';
  document.getElementById('icm-address').value = d.address   || '';
  document.getElementById('icm-err').textContent = '';
  document.getElementById('inv-contact-modal').style.display = 'flex';
}

function closeInvContactModal(){
  const m = document.getElementById('inv-contact-modal');
  if(m) m.style.display = 'none';
}

async function saveInvContact(){
  const hid = document.getElementById('inv-dealer');
  const d = dealerList.find(x=>x.dealerId===(hid?hid.value:''));
  if(!d) return;
  const err = document.getElementById('icm-err');
  err.textContent = '';
  const owner   = document.getElementById('icm-owner').value.trim();
  const phone1  = document.getElementById('icm-phone1').value.trim();
  const area    = document.getElementById('icm-area').value.trim();
  const address = document.getElementById('icm-address').value.trim();
  if(!owner) { err.textContent='Owner/Contact name is required.'; return; }
  if(!phone1){ err.textContent='Primary phone is required.';      return; }
  if(!area)  { err.textContent='Area/Municipality is required.';  return; }

  const btn = document.getElementById('icm-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Manila' });
  try{
    // updateDealer overwrites EVERY column, so send the full record: spread the
    // existing dealer's fields and override only the four the user just edited.
    const r = await api({
      action:'updateDealer', dealerId:d.dealerId,
      storeName:d.storeName, ownerName:owner, phone1:phone1, phone2:d.phone2||'',
      area:area, address:address, dealerType:d.dealerType||'', status:d.status||'',
      lat:d.lat||'', lng:d.lng||'', accuracy:d.accuracy||'', notes:d.notes||'',
      assignedVehicle:(d.assignedVehicle!==undefined?d.assignedVehicle:''),
      updatedBy: currentUser.username, updatedAt: now
    });
    if(r.status==='ok'){
      await loadDealers();
      if(typeof analyzeDealers==='function') analyzeDealers(null);
      closeInvContactModal();
      showToast(d.storeName+' details updated ✓','success');
      onInvDealerChange();   // refresh info panel + hide the now-satisfied trigger
    } else {
      err.textContent = 'Error: ' + (r.msg||'Could not save');
    }
  }catch(e){
    err.textContent = 'Network error: ' + e.message;
  }
  btn.disabled = false; btn.textContent = '💾 Save Details';
}

// Show the last 3 invoices for this dealer (uses already-loaded history)
function _renderDealerOrderHistory(dealerId){
  const el = document.getElementById('inv-order-history');
  if(!el) return;
  const orders = invoiceHistory.filter(inv=>inv.dealerId===dealerId).slice(0,3);
  if(!orders.length){ el.style.display='none'; return; }

  const fmt  = v=>'₱'+(Number(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fmtD = s=>phDate(s);

  el.innerHTML =
    '<div class="inv-oh-title">Recent Orders</div>'
    + orders.map(inv=>
        '<div class="inv-oh-card">'
          +'<span class="inv-oh-num">'+inv.invoiceNumber+'</span>'
          +'<span class="inv-oh-date">'+fmtD(inv.invoiceDate)+'</span>'
          +'<span class="inv-oh-total">'+fmt(inv.total)+'</span>'
          +'<span class="inv-oh-pt">'+( inv.paymentType||'')+'</span>'
        +'</div>'
      ).join('');
  el.style.display = 'block';
}


// ── OPTIONS (rarely-changed fields, collapsed by default) ─────
// The everyday screen is dealer → items → total → signature → charge.
// Date/Reference/Terms/Payment live behind this toggle; the summary keeps
// their current values visible so nothing is hidden-hidden.
function toggleInvOptions(force){
  const body = document.getElementById('inv-options-body');
  const chev = document.getElementById('inv-options-chev');
  if(!body) return;
  const open = (force !== undefined) ? force : body.style.display === 'none';
  body.style.display = open ? 'block' : 'none';
  if(chev) chev.textContent = open ? '▾' : '▸';
}

function _updateInvOptionsSummary(){
  const el = document.getElementById('inv-options-summary');
  if(!el) return;
  const dateStr = document.getElementById('inv-date')?.value || '';
  const isToday = (typeof phToday==='function') && dateStr === phToday();
  const dateLbl = !dateStr ? '—' : (isToday ? 'Today' : (typeof phDate==='function' ? phDate(dateStr) : dateStr));
  const terms   = document.getElementById('inv-terms')?.value || 'COD';
  const pt      = document.getElementById('inv-payment-type')?.value || 'Cash';
  el.textContent = dateLbl + ' · ' + terms + ' · ' + pt;
}

// ── PAYMENT TERMS ─────────────────────────────────────────────
function onInvTermsChange(){
  const terms   = document.getElementById('inv-terms').value;
  const dateStr = document.getElementById('inv-date').value;
  const dueEl   = document.getElementById('inv-due');
  if(!dateStr){ dueEl.value=''; _updateInvOptionsSummary(); return; }
  const base = new Date(dateStr+'T00:00:00');
  const days = terms==='Net 7'?7:terms==='Net 15'?15:terms==='Net 30'?30:0;
  base.setDate(base.getDate()+days);
  dueEl.value = base.toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'});
  _updateInvOptionsSummary();
}


// ── PAYMENT TYPE ──────────────────────────────────────────────
function onInvPaymentTypeChange(){
  const pt    = document.getElementById('inv-payment-type')?.value || 'Cash';
  const field = document.getElementById('inv-check-ref-field');
  if(field) field.style.display = (pt==='Check') ? 'block' : 'none';
  _updateInvOptionsSummary();
}


// ── LINE ITEMS ────────────────────────────────────────────────
function addInvLine(){
  invLines.push({sku:'',desc:'',qty:1,price:0,disc:0});
  renderInvLines();
}

function removeInvLine(idx){
  if(invLines.length===1){ showToast('At least one item is required','warning'); return; }
  invLines.splice(idx,1);
  renderInvLines();
}

function renderInvLines(){
  const container = document.getElementById('inv-lines-container');
  container.innerHTML = '';
  invLines.forEach((line,idx)=>{

    // Van stock label (given a stable id so qty changes can update it in-place)
    let vanLabelHtml = '';
    if(vanStockLoaded && line.sku){
      const avail = getVanAvailableForLine(line.sku, idx);
      if(avail !== null){
        let cls = 'inv-van-ok', icon = '✓';
        if(avail === 0)          { cls = 'inv-van-zero'; icon = '⊘'; }
        else if(line.qty > avail){ cls = 'inv-van-warn'; icon = '⚠'; }
        vanLabelHtml = '<div id="inv-van-'+idx+'" class="inv-van-label '+cls+'">'+icon+' '+avail+' available on van</div>';
      } else {
        // SKU not in today's manifest — show a hard warning for drivers
        const driverMode = currentUser && currentUser.assignedUnit && currentUser.assignedUnit !== 'All';
        vanLabelHtml = driverMode
          ? '<div id="inv-van-'+idx+'" class="inv-van-label inv-van-zero">⛔ Not in today\'s manifest</div>'
          : '<div id="inv-van-'+idx+'" style="display:none"></div>';
      }
    } else {
      vanLabelHtml = '<div id="inv-van-'+idx+'" style="display:none"></div>';
    }

    const selProd    = invProducts.find(p=>p.code===line.sku);
    const displayVal = selProd ? selProd.name+' · '+selProd.code : '';

    const div = document.createElement('div');
    div.className = 'inv-line-row';
    div.id        = 'inv-line-'+idx;
    div.innerHTML =
      '<div class="inv-line-header">'
        +'<span class="inv-line-num">Item '+(idx+1)+'</span>'
        +'<button class="inv-line-remove" onclick="removeInvLine('+idx+')">✕ Remove</button>'
      +'</div>'
      +'<div class="inv-sku-wrap">'
        +'<input class="inv-input inv-sku-input" id="inv-sku-input-'+idx+'" type="text" autocomplete="off" '
          +'placeholder="🔍 Type to search product..." '
          +'value="'+displayVal.replace(/"/g,'&quot;')+'" '
          +'oninput="_invSkuSearch('+idx+',this.value)" '
          +'onfocus="_invSkuFocus('+idx+')" '
          +'onblur="_hideInvSkuDd('+idx+')">'
        +'<div class="inv-sku-dropdown" id="inv-sku-dd-'+idx+'" style="display:none"></div>'
      +'</div>'
      + vanLabelHtml
      +'<input class="inv-input" type="text" placeholder="Description" id="inv-ldesc-'+idx+'" value="'+(line.desc||'')+'" oninput="invLines['+idx+'].desc=this.value">'
      +'<div class="inv-line-nums">'
        +'<div><label class="inv-field-label">Qty</label>'
          +'<input class="inv-input inv-input-num" id="inv-qty-'+idx+'" type="number" min="1" value="'+line.qty+'" oninput="invLines['+idx+'].qty=Number(this.value)||0;updateInvTotals();_refreshVanLabel('+idx+')"></div>'
        +'<div><label class="inv-field-label">Unit Price (₱)</label>'
          +'<input class="inv-input inv-input-num" id="inv-price-'+idx+'" type="number" min="0" step="0.01" value="'+(line.price||'')+'" placeholder="0.00" oninput="invLines['+idx+'].price=Number(this.value)||0;updateInvTotals()"></div>'
        +'<div><label class="inv-field-label">Disc %</label>'
          +'<input class="inv-input inv-input-num" type="number" min="0" max="100" value="'+(line.disc||0)+'" oninput="invLines['+idx+'].disc=Number(this.value)||0;updateInvTotals()"></div>'
        +'<div><label class="inv-field-label">Line Total</label>'
          +'<div class="inv-line-total" id="inv-ltotal-'+idx+'">₱0.00</div></div>'
      +'</div>';
    container.appendChild(div);
  });
  updateInvTotals();
}

// Update just the van stock label for one line (avoids full re-render which resets focus)
function _refreshVanLabel(idx){
  const el = document.getElementById('inv-van-'+idx);
  if(!el || !vanStockLoaded) return;
  const line  = invLines[idx];
  if(!line || !line.sku){ el.style.display='none'; return; }
  const avail = getVanAvailableForLine(line.sku, idx);
  if(avail === null){
    const driverMode = currentUser && currentUser.assignedUnit && currentUser.assignedUnit !== 'All';
    if(driverMode){
      el.className   = 'inv-van-label inv-van-zero';
      el.textContent = '⛔ Not in today\'s manifest';
      el.style.display = 'inline-block';
    } else {
      el.style.display = 'none';
    }
    return;
  }
  let cls = 'inv-van-ok', icon = '✓';
  if(avail === 0)           { cls = 'inv-van-zero'; icon = '⊘'; }
  else if(line.qty > avail) { cls = 'inv-van-warn'; icon = '⚠'; }
  el.className    = 'inv-van-label '+cls;
  el.textContent  = icon+' '+avail+' available on van';
  el.style.display = 'inline-block';
}

function onInvSKUChange(idx, val){
  invLines[idx].sku = val;
  const p = invProducts.find(x=>x.code===val);
  if(p){
    invLines[idx].desc  = p.name;
    invLines[idx].price = p.price;
    const descEl = document.getElementById('inv-ldesc-'+idx);
    if(descEl) descEl.value = p.name;
  }
  renderInvLines();
}

// ── SKU SEARCH COMBOBOX ───────────────────────────────────────
function _invSkuFocus(idx){
  const input = document.getElementById('inv-sku-input-'+idx);
  if(input) input.value = '';          // clear so user can type fresh
  _invSkuSearch(idx, '');
}

function _invSkuSearch(idx, query){
  const dd = document.getElementById('inv-sku-dd-'+idx);
  if(!dd) return;
  const q = query.toLowerCase().trim();
  const matches = !q
    ? invProducts.slice(0, 15)
    : invProducts.filter(p=>
        p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      ).slice(0, 20);
  dd.innerHTML = matches.length
    ? matches.map(p=>
        '<div class="inv-sku-dd-item" onmousedown="_selectInvSku('+idx+',\''+p.code+'\')">'
          +'<span class="inv-sku-dd-name">'+p.name+'</span>'
          +'<span class="inv-sku-dd-code">'+p.code+'</span>'
        +'</div>'
      ).join('')
    : '<div class="inv-sku-dd-empty">No products found</div>';
  dd.style.display = 'block';
}

function _selectInvSku(idx, code){
  const p = invProducts.find(x=>x.code===code);
  invLines[idx].sku   = code;
  invLines[idx].desc  = p ? p.name        : '';
  invLines[idx].price = p ? p.price       : 0;
  invLines[idx].qty   = p ? (p.bundleQty||1) : 1;
  const input = document.getElementById('inv-sku-input-'+idx);
  if(input) input.value = p ? p.name+' · '+p.code : code;
  const dd = document.getElementById('inv-sku-dd-'+idx);
  if(dd) dd.style.display = 'none';
  const descEl = document.getElementById('inv-ldesc-'+idx);
  if(descEl && p) descEl.value = p.name;
  const qtyEl   = document.getElementById('inv-qty-'+idx);
  if(qtyEl) qtyEl.value = invLines[idx].qty;
  const priceEl = document.getElementById('inv-price-'+idx);
  if(priceEl) priceEl.value = invLines[idx].price || '';
  updateInvTotals();
  _refreshVanLabel(idx);
}

function _hideInvSkuDd(idx){
  setTimeout(()=>{
    const dd = document.getElementById('inv-sku-dd-'+idx);
    if(dd) dd.style.display = 'none';
    // Restore display value if a product is selected
    const input = document.getElementById('inv-sku-input-'+idx);
    if(input && invLines[idx] && invLines[idx].sku){
      const p = invProducts.find(x=>x.code===invLines[idx].sku);
      if(p) input.value = p.name+' · '+p.code;
      else if(!input.value) input.value = '';
    }
  }, 150);
}

function updateInvTotals(){
  let subtotal = 0;
  const fmt = v=>'₱'+v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  invLines.forEach((line,idx)=>{
    const d  = Math.min(100,Math.max(0,line.disc||0));
    const lt = (line.qty||0)*(line.price||0)*(1-d/100);
    subtotal += lt;
    const el = document.getElementById('inv-ltotal-'+idx);
    if(el) el.textContent = fmt(lt);
  });
  const stEl = document.getElementById('inv-subtotal');
  const gtEl = document.getElementById('inv-grand-total');
  if(stEl) stEl.textContent = fmt(subtotal);
  if(gtEl) gtEl.textContent = fmt(subtotal);
}


// ── SAVE ──────────────────────────────────────────────────────
async function saveInvoice(){
  // Guard: a Save+Charge double-tap would create two invoices and deduct stock twice
  if(_invSaving) return;
  const errEl = document.getElementById('inv-err');
  errEl.textContent = '';

  const dealerId  = document.getElementById('inv-dealer').value;
  const invDate   = document.getElementById('inv-date').value;
  const invDue    = document.getElementById('inv-due').value;
  const terms     = document.getElementById('inv-terms').value;
  const reference = document.getElementById('inv-ref').value.trim();
  const payType   = document.getElementById('inv-payment-type')?.value || 'Cash';
  const checkRef  = document.getElementById('inv-check-ref')?.value?.trim() || '';

  if(!dealerId) { errEl.textContent='Please select a dealer.'; return; }
  if(!invDate)  { errEl.textContent='Invoice date is required.'; return; }

  const validLines = invLines.filter(l=>l.sku && l.qty>0);
  if(!validLines.length){ errEl.textContent='Add at least one product with a quantity.'; return; }

  // Signature is required on every invoice — the saved record must carry it,
  // not just the printed receipt
  if(!_requireSignature()) return;

  // Van stock validation — drivers only
  const isDriver = currentUser && currentUser.assignedUnit && currentUser.assignedUnit !== 'All';
  if(isDriver && vanStockLoaded){
    // Hard block: no manifest loaded for today
    if(Object.keys(vanStockData).length === 0){
      errEl.textContent = '⛔ No stock loaded for today. Ask warehouse to submit the morning load before creating invoices.';
      return;
    }
    // Hard block: item not in today's manifest
    const notInManifest = [];
    const overages      = [];
    validLines.forEach(l=>{
      const avail = getVanAvailableForLine(l.sku, invLines.indexOf(l));
      const p     = invProducts.find(x=>x.code===l.sku);
      const label = p ? p.name : l.sku;
      if(avail === null){
        notInManifest.push(label);
      } else if(l.qty > avail){
        overages.push(label+' (want '+l.qty+', available '+avail+')');
      }
    });
    if(notInManifest.length){
      errEl.textContent = '⛔ Not in today\'s manifest: '+notInManifest.join(', ')+'. Only items loaded on the van today can be sold.';
      return;
    }
    // Soft warning: qty exceeds available (allows save with confirmation)
    if(overages.length && !confirm('⚠ Van stock exceeded:\n\n'+overages.join('\n')+'\n\nSave anyway?')){
      return;
    }
  }

  const dealer = dealerList.find(d=>d.dealerId===dealerId)||{};
  let subtotal = 0;
  validLines.forEach(l=>{ const d=Math.min(100,Math.max(0,l.disc||0)); subtotal+=(l.qty||0)*(l.price||0)*(1-d/100); });

  const btn = document.getElementById('inv-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='Saving...'; }
  _invSaving = true;

  const now       = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'});
  const signature = getSignatureBase64();

  try{
    const r = await api({
      action:       'saveInvoice',
      assignedUnit: currentUser ? (currentUser.assignedUnit||'') : '',
      dealerId,
      contactName:  dealer.storeName||'',
      reference,
      invoiceDate:  invDate,
      dueDate:      invDue,
      paymentTerms: terms,
      paymentType:  payType,
      checkRef,
      receivedBy:   currentUser ? currentUser.username : '',
      signature,
      subtotal,
      total:        subtotal,
      lines: validLines.map(l=>({
        sku:       l.sku,
        desc:      l.desc||'',
        qty:       l.qty,
        unitPrice: l.price,
        discount:  l.disc||0,
        lineTotal: (l.qty)*(l.price)*(1-(l.disc||0)/100)
      })),
      createdBy: currentUser ? currentUser.username : '',
      createdAt: now
    });

    if(r.status==='ok'){
      invSaved         = true;
      invCurrentNumber = r.invoiceNumber;
      document.getElementById('inv-number').value = r.invoiceNumber;
      showToast(r.invoiceNumber+' saved ✓','success');
      // Refresh van stock after saving so next invoice shows updated available
      loadVanStock();
    } else if(r.status==='queued'){
      invSaved         = true;
      invCurrentNumber = r.invoiceNumber; // e.g. OFFLINE-1234567890
      document.getElementById('inv-number').value = r.invoiceNumber;
      showToast('No connection — saved offline, will sync automatically','warning');
    } else {
      errEl.textContent = 'Error: '+(r.msg||'Could not save');
    }
  }catch(e){
    errEl.textContent = 'Network error: '+e.message;
  }
  _invSaving = false;
  if(btn){ btn.disabled=false; btn.textContent='💾 Save Invoice'; }
}


// ── OFFLINE BADGE ─────────────────────────────────────────────
function updateOfflineBadge(){
  const queue = LS.get('alf_pending_invoices') || [];
  const badge = document.getElementById('inv-offline-badge');
  if(!badge) return;
  if(queue.length > 0){
    badge.textContent = queue.length + (queue.length===1?' pending':' pending');
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}


// ── SIGNATURE CANVAS ──────────────────────────────────────────
function initSignatureCanvas(){
  sigCanvas = document.getElementById('inv-sig-canvas');
  if(!sigCanvas) return;
  sigCtx = sigCanvas.getContext('2d');

  // Size canvas to actual CSS display size
  const dpr = window.devicePixelRatio || 1;
  const w   = sigCanvas.offsetWidth  || 320;
  const h   = sigCanvas.offsetHeight || 120;
  sigCanvas.width  = w * dpr;
  sigCanvas.height = h * dpr;
  sigCtx.scale(dpr, dpr);
  sigCtx.strokeStyle = '#1a1a1a';
  sigCtx.lineWidth   = 2.5;
  sigCtx.lineCap     = 'round';
  sigCtx.lineJoin    = 'round';

  if(_sigListeners) return; // listeners already attached
  _sigListeners = true;

  function pos(e){
    const r   = sigCanvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }
  function startDraw(e){
    e.preventDefault();
    sigDrawing = true;
    const p = pos(e);
    sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y);
    const ph = document.getElementById('inv-sig-placeholder');
    if(ph) ph.style.display = 'none';
  }
  function draw(e){
    if(!sigDrawing) return; e.preventDefault();
    const p = pos(e);
    sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); sigHasData = true;
  }
  function endDraw(){ sigDrawing = false; }

  sigCanvas.addEventListener('mousedown',  startDraw);
  sigCanvas.addEventListener('mousemove',  draw);
  sigCanvas.addEventListener('mouseup',    endDraw);
  sigCanvas.addEventListener('mouseleave', endDraw);
  sigCanvas.addEventListener('touchstart', startDraw, {passive:false});
  sigCanvas.addEventListener('touchmove',  draw,      {passive:false});
  sigCanvas.addEventListener('touchend',   endDraw);
}

function clearSignature(){
  if(sigCtx && sigCanvas) sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  sigHasData = false;
  const ph = document.getElementById('inv-sig-placeholder');
  if(ph) ph.style.display = 'flex';
}

function getSignatureBase64(){
  if(!sigCanvas || !sigHasData) return '';
  return sigCanvas.toDataURL('image/jpeg', 0.5);
}


// ── PRINT ─────────────────────────────────────────────────────
function _buildReceiptHtml(){
  const dealerId  = document.getElementById('inv-dealer').value;
  const dealer    = dealerList.find(d=>d.dealerId===dealerId)||{};
  const invDate   = document.getElementById('inv-date').value;
  const dueDate   = document.getElementById('inv-due').value;
  const terms     = document.getElementById('inv-terms').value;
  const reference = document.getElementById('inv-ref').value.trim();
  const payType   = document.getElementById('inv-payment-type')?.value || 'Cash';
  const checkRef  = document.getElementById('inv-check-ref')?.value?.trim() || '';
  const invNum    = invCurrentNumber;

  const validLines = invLines.filter(l=>l.sku && l.qty>0);
  let subtotal = 0;
  const fmt  = v=>'₱'+v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fmtD = s=>phDate(s);

  const itemsHtml = validLines.map(l=>{
    const d  = Math.min(100,Math.max(0,l.disc||0));
    const lt = (l.qty||0)*(l.price||0)*(1-d/100);
    subtotal += lt;
    const label = (l.desc||l.sku||'')+(l.desc&&l.sku?' <span class="rcp-sku">['+l.sku+']</span>':'');
    const calc  = l.qty+' x '+fmt(l.price||0)+(d>0?' (-'+d+'%)':'')+' = <strong>'+fmt(lt)+'</strong>';
    return '<div class="rcp-item-name">'+label+'</div>'
          +'<div class="rcp-item-calc">'+calc+'</div>';
  }).join('');

  const dueLabel = terms==='COD' ? 'COD' : fmtD(dueDate)+' ('+terms+')';
  const sigData  = getSignatureBase64();
  const _logoSrc = typeof LOGO_SMALL !== 'undefined' ? LOGO_SMALL : '';
  const _logoHtml = _logoSrc ? '<img src="'+_logoSrc+'" style="display:block;margin:0 auto 4px;height:48px;width:48px;object-fit:contain;border-radius:6px">' : '';

  return '<div class="rcp-wrap">'
    +_logoHtml
    +'<div class="rcp-biz-name">ALFRISCO ENTERPRISE</div>'
    +'<div class="rcp-biz-sub">Animal Feed Distributor</div>'
    +'<div class="rcp-biz-sub">Province of Pangasinan, Philippines</div>'
    +'<div class="rcp-biz-sub">alfriscoenterprise@gmail.com</div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-inv-label">Sales Invoice</div>'
    +'<div class="rcp-inv-num">'+invNum+'</div>'
    +'<div class="rcp-row"><span>Date</span><span>'+fmtD(invDate)+'</span></div>'
    +'<div class="rcp-row"><span>Due</span><span>'+dueLabel+'</span></div>'
    +(reference?'<div class="rcp-row"><span>Ref</span><span>'+reference+'</span></div>':'')
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-section-label">Bill To</div>'
    +'<div class="rcp-dealer-name">'+(dealer.storeName||'')+'</div>'
    +(dealer.ownerName?'<div class="rcp-dealer-sub">'+dealer.ownerName+'</div>':'')
    +(dealer.area?'<div class="rcp-dealer-sub">'+dealer.area+'</div>':'')
    +(dealer.phone1?'<div class="rcp-dealer-sub">Tel: '+dealer.phone1+(dealer.phone2?' / '+dealer.phone2:'')+'</div>':'')
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-section-label">Items</div>'
    +itemsHtml
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-total-row"><span>Subtotal</span><span>'+fmt(subtotal)+'</span></div>'
    +'<div class="rcp-total-row rcp-grand"><span>TOTAL DUE</span><span>'+fmt(subtotal)+'</span></div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-payment">Payment: <strong>'+payType+'</strong></div>'
    +(checkRef?'<div class="rcp-payment">Check Ref: <strong>'+checkRef+'</strong></div>':'')
    +'<div class="rcp-div"></div>'
    +(sigData?'<img class="rcp-sig-img" src="'+sigData+'">'
            :'<div class="rcp-sig-blank"></div>')
    +'<div class="rcp-sig-label">Customer Signature</div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-footer">Thank you for your business!</div>'
    +'<div class="rcp-footer">— Alfrisco Enterprise —</div>'
    +'</div>';
}

// ── PAST INVOICE: DETAIL + REPRINT ────────────────────────────
// Builds the same 58mm receipt from a SAVED invoice rather than the live form,
// so any past transaction can be reprinted exactly as it was issued.
let _invDetail = null;   // {invoice, lines, dealer}

function _buildReceiptFromData(d){
  const inv = d.invoice, dealer = d.dealer || {}, lines = d.lines || [];
  const fmt  = v=>'₱'+(Number(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fmtD = s=>phDate(s);
  let subtotal = 0;
  const itemsHtml = lines.map(function(l){
    const lt = Number(l.lineTotal) || 0;
    subtotal += lt;
    const label = (l.description||l.skuCode||'')
      + (l.description && l.skuCode ? ' <span class="rcp-sku">['+l.skuCode+']</span>' : '');
    const calc = l.qty+' x '+fmt(l.unitPrice)
      + (l.discount>0 ? ' (-'+l.discount+'%)' : '') + ' = <strong>'+fmt(lt)+'</strong>';
    return '<div class="rcp-item-name">'+label+'</div>'
         + '<div class="rcp-item-calc">'+calc+'</div>';
  }).join('');
  if(!subtotal) subtotal = Number(inv.subtotal) || Number(inv.total) || 0;

  const dueLabel = inv.paymentTerms==='COD' ? 'COD' : fmtD(inv.dueDate)+' ('+inv.paymentTerms+')';
  const _logoSrc = typeof LOGO_SMALL !== 'undefined' ? LOGO_SMALL : '';
  const _logoHtml = _logoSrc ? '<img src="'+_logoSrc+'" style="display:block;margin:0 auto 4px;height:48px;width:48px;object-fit:contain;border-radius:6px">' : '';
  const isVoid = inv.status === 'VOID';

  return '<div class="rcp-wrap">'
    +_logoHtml
    +'<div class="rcp-biz-name">ALFRISCO ENTERPRISE</div>'
    +'<div class="rcp-biz-sub">Animal Feed Distributor</div>'
    +'<div class="rcp-biz-sub">Province of Pangasinan, Philippines</div>'
    +'<div class="rcp-biz-sub">alfriscoenterprise@gmail.com</div>'
    +'<div class="rcp-div"></div>'
    +(isVoid?'<div class="rcp-inv-label" style="color:#C0392B">*** VOIDED ***</div>':'')
    +'<div class="rcp-inv-label">Sales Invoice</div>'
    +'<div class="rcp-inv-num">'+inv.invoiceNumber+'</div>'
    +'<div class="rcp-row"><span>Date</span><span>'+fmtD(inv.invoiceDate)+'</span></div>'
    +'<div class="rcp-row"><span>Due</span><span>'+dueLabel+'</span></div>'
    +(inv.reference?'<div class="rcp-row"><span>Ref</span><span>'+inv.reference+'</span></div>':'')
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-section-label">Bill To</div>'
    +'<div class="rcp-dealer-name">'+(dealer.storeName||inv.contactName||'')+'</div>'
    +(dealer.ownerName?'<div class="rcp-dealer-sub">'+dealer.ownerName+'</div>':'')
    +(dealer.area?'<div class="rcp-dealer-sub">'+dealer.area+'</div>':'')
    +(dealer.phone1?'<div class="rcp-dealer-sub">Tel: '+dealer.phone1+(dealer.phone2?' / '+dealer.phone2:'')+'</div>':'')
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-section-label">Items</div>'
    +itemsHtml
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-total-row"><span>Subtotal</span><span>'+fmt(subtotal)+'</span></div>'
    +'<div class="rcp-total-row rcp-grand"><span>TOTAL DUE</span><span>'+fmt(inv.total||subtotal)+'</span></div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-payment">Payment: <strong>'+(inv.paymentType||'Cash')+'</strong></div>'
    +(inv.checkRef?'<div class="rcp-payment">Check Ref: <strong>'+inv.checkRef+'</strong></div>':'')
    +'<div class="rcp-div"></div>'
    +(inv.signature?'<img class="rcp-sig-img" src="'+inv.signature+'">':'<div class="rcp-sig-blank"></div>')
    +'<div class="rcp-sig-label">Customer Signature</div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-footer">Thank you for your business!</div>'
    +'<div class="rcp-footer">— Alfrisco Enterprise —</div>'
    +'</div>';
}

async function openInvoiceDetail(invNum){
  _invDetail = null;
  document.getElementById('inv-detail-modal').style.display = 'flex';
  const body = document.getElementById('inv-detail-body');
  body.innerHTML = '<div style="text-align:center;color:#888;padding:24px;font-size:13px">Loading…</div>';
  document.getElementById('inv-detail-title').textContent = invNum;
  try{
    const r = await api({action:'getInvoiceDetail', invoiceNumber: invNum});
    if(r.status !== 'ok'){ body.innerHTML = '<div class="modal-err">'+(r.msg||'Could not load invoice')+'</div>'; return; }
    _invDetail = r;
    _renderInvoiceDetail(r);
  }catch(e){ body.innerHTML = '<div class="modal-err">Network error: '+e.message+'</div>'; }
}

function closeInvoiceDetail(){
  document.getElementById('inv-detail-modal').style.display = 'none';
  _invDetail = null;
}

function _renderInvoiceDetail(d){
  const inv = d.invoice, lines = d.lines||[], dealer = d.dealer||{};
  const fmt = v=>'₱'+(Number(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const isVoid = inv.status === 'VOID';
  let html = '';
  if(isVoid){
    html += '<div class="invd-void">*** VOIDED ***'
      + (inv.voidReason?'<div class="invd-void-sub">'+inv.voidReason+'</div>':'')
      + (inv.voidedBy?'<div class="invd-void-sub">by '+inv.voidedBy+(inv.voidedAt?' · '+phDateTime(inv.voidedAt):'')+'</div>':'')
      + '</div>';
  }
  html += '<div class="invd-head">'
    + '<div class="invd-dealer">'+(dealer.storeName||inv.contactName||'')+'</div>'
    + (dealer.ownerName||dealer.area
        ? '<div class="invd-sub">'+[dealer.ownerName,dealer.area].filter(Boolean).join(' · ')+'</div>' : '')
    + '<div class="invd-meta">'+phDate(inv.invoiceDate)+' · '+inv.paymentTerms
      + ' · <strong>'+(inv.paymentType||'Cash')+'</strong>'
      + (inv.checkRef?' ('+inv.checkRef+')':'')+'</div>'
    + (inv.reference?'<div class="invd-meta">Ref: '+inv.reference+'</div>':'')
    + '<div class="invd-meta">Issued by '+inv.createdBy+'</div>'
    + '</div>';

  html += '<table class="invd-table"><thead><tr><th>Item</th><th class="r">Qty</th>'
        + '<th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>';
  if(!lines.length){
    html += '<tr><td colspan="4" style="color:#888;text-align:center;padding:12px">No line items recorded.</td></tr>';
  } else {
    lines.forEach(function(l){
      html += '<tr><td>'+(l.description||l.skuCode)
        + (l.skuCode?'<div class="invd-sku">'+l.skuCode+'</div>':'')+'</td>'
        + '<td class="r">'+l.qty+'</td>'
        + '<td class="r">'+fmt(l.unitPrice)+(l.discount>0?'<div class="invd-sku">−'+l.discount+'%</div>':'')+'</td>'
        + '<td class="r">'+fmt(l.lineTotal)+'</td></tr>';
    });
  }
  html += '</tbody></table>'
    + '<div class="invd-total"><span>TOTAL</span><span>'+fmt(inv.total)+'</span></div>'
    + (inv.signature
        ? '<div class="invd-sig-wrap"><div class="invd-sig-lbl">Customer signature</div>'
          + '<img class="invd-sig" src="'+inv.signature+'"></div>'
        : '<div class="invd-meta" style="margin-top:8px;color:#C0392B">⚠ No signature on file</div>');
  document.getElementById('inv-detail-body').innerHTML = html;
}

// Reprint a past invoice — customer copy, then merchant copy on the second tap
let _reprintStep = 0;
function reprintInvoice(){
  if(!_invDetail) return;
  const rcpt = _buildReceiptFromData(_invDetail);
  const pv = document.getElementById('inv-print-view');
  if(!pv) return;
  const copyLabel = _reprintStep === 0 ? 'CUSTOMER COPY' : 'MERCHANT COPY';
  pv.innerHTML = rcpt.replace('<div class="rcp-div"></div>',
    '<div class="rcp-copy-label">'+copyLabel+' (REPRINT)</div><div class="rcp-div"></div>');
  window.print();
  _reprintStep = _reprintStep === 0 ? 1 : 0;
  const btn = document.getElementById('inv-reprint-btn');
  if(btn) btn.textContent = _reprintStep === 1 ? '🖨 Print Merchant Copy' : '🖨 Reprint Receipt';
}

function _requireSignature(){
  if(sigHasData) return true;
  // Flash the signature pad red and scroll it into view
  const wrap = document.getElementById('inv-sig-wrap');
  if(wrap){
    wrap.style.border = '2px solid #E24B4A';
    wrap.style.boxShadow = '0 0 0 3px rgba(226,75,74,0.25)';
    wrap.scrollIntoView({behavior:'smooth', block:'center'});
    setTimeout(()=>{
      wrap.style.border = '1.5px solid #ddd';
      wrap.style.boxShadow = '';
    }, 2500);
  }
  showToast('Customer signature required before printing.','warning', 4000);
  return false;
}

async function printInvoice(){
  if(!_requireSignature()) return;
  if(!invSaved) await saveInvoice();
  if(!invSaved) return;
  const rcpt = _buildReceiptHtml();
  const pv   = document.getElementById('inv-print-view');
  pv.innerHTML =
    '<div class="rcp-copy-label">&#x2014; CUSTOMER COPY &#x2014;</div>' + rcpt +
    '<div class="rcp-page-break"></div>' +
    '<div class="rcp-copy-label">&#x2014; MERCHANT COPY &#x2014;</div>' + rcpt;
  window.print();
}

async function chargeInvoice(){
  const chargeBtn = document.getElementById('inv-charge-btn');

  // ── STEP 2: Print merchant copy ───────────────────────────────
  if(_chargeStep === 1){
    const pv = document.getElementById('inv-print-view');
    pv.innerHTML = '<div class="rcp-copy-label">&#x2014; MERCHANT COPY &#x2014;</div>' + _cachedReceiptHtml;
    window.print();
    setTimeout(()=>{
      showToast('Merchant copy printed ✓ — ready for next invoice','success');
      resetInvForm();
    }, 600);
    return;
  }

  // ── STEP 1: Validate, save, print customer copy ───────────────
  if(!_requireSignature()) return;

  if(!invSaved){
    if(chargeBtn){ chargeBtn.disabled=true; chargeBtn.textContent='⏳ Saving…'; }
    await saveInvoice();
    if(chargeBtn){ chargeBtn.disabled=false; chargeBtn.textContent='⚡ Charge'; }
  }
  if(!invSaved) return;

  _cachedReceiptHtml = _buildReceiptHtml();
  const pv = document.getElementById('inv-print-view');
  pv.innerHTML = '<div class="rcp-copy-label">&#x2014; CUSTOMER COPY &#x2014;</div>' + _cachedReceiptHtml;
  window.print();

  // Flip button to merchant copy mode
  _chargeStep = 1;
  if(chargeBtn){
    chargeBtn.textContent = '🖨 Merchant Copy';
    chargeBtn.style.background = '#1B5E20';
  }
  showToast('Customer copy printed — tap Merchant Copy to print yours','info', 5000);
}

async function voidInvoice(invNum){
  if(!currentUser || currentUser.role!=='admin') return;
  const reason = window.prompt('Void reason for '+invNum+' (required):');
  if(!reason || !reason.trim()) return;
  const btn = document.querySelector('[data-void-inv="'+invNum+'"]');
  if(btn){ btn.disabled=true; btn.textContent='Voiding…'; }
  try{
    const r = await api({action:'voidInvoice', invoiceNumber:invNum, reason:reason.trim(), voidedBy:currentUser.username});
    if(r.status==='ok'){
      showToast(invNum+' voided'+(r.stockRestored?' — stock restored':''),'warning');
      invoiceHistory = invoiceHistory.map(i=>i.invoiceNumber===invNum?{...i,status:'VOID'}:i);
      renderInvoiceHistory();
    } else {
      alert('Error: '+(r.msg||'Could not void'));
      if(btn){ btn.disabled=false; btn.textContent='Void'; }
    }
  }catch(e){
    alert('Network error: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='Void'; }
  }
}

// ── PRINTER SETUP ─────────────────────────────────────────────
function openPrinterSetup(){
  document.getElementById('printer-setup-modal').style.display='flex';
}
function closePrinterSetup(){
  document.getElementById('printer-setup-modal').style.display='none';
}
function testPrint(){
  const pv = document.getElementById('inv-print-view');
  const _tLogoSrc = typeof LOGO_SMALL !== 'undefined' ? LOGO_SMALL : '';
  const _tLogoHtml = _tLogoSrc ? '<img src="'+_tLogoSrc+'" style="display:block;margin:0 auto 4px;height:48px;width:48px;object-fit:contain;border-radius:6px">' : '';
  pv.innerHTML =
    '<div class="rcp-wrap">'
    +_tLogoHtml
    +'<div class="rcp-biz-name">ALFRISCO ENTERPRISE</div>'
    +'<div class="rcp-biz-sub">--- PRINTER TEST ---</div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-inv-label">Test Receipt</div>'
    +'<div style="text-align:center;font-size:10px;margin:8px 0">Printer is connected!</div>'
    +'<div class="rcp-row"><span>Paper</span><span>58mm</span></div>'
    +'<div class="rcp-row"><span>Date</span><span>'+phDate(phToday())+'</span></div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-footer">AE-ON · Alfrisco Enterprise Online</div>'
    +'<div class="rcp-footer">If you can read this, your printer is ready.</div>'
    +'</div>';
  window.print();
}


// ── XERO CSV EXPORT ───────────────────────────────────────────
function exportXero(){
  if(!invSaved){ showToast('Save the invoice first','warning'); return; }

  const dealerId  = document.getElementById('inv-dealer').value;
  const dealer    = dealerList.find(d=>d.dealerId===dealerId)||{};
  const invDate   = document.getElementById('inv-date').value;
  const dueDate   = document.getElementById('inv-due').value;
  const reference = document.getElementById('inv-ref').value.trim();
  const invNum    = invCurrentNumber;

  const validLines = invLines.filter(l=>l.sku && l.qty>0);
  let grandTotal = 0;
  validLines.forEach(l=>{ const d=l.disc||0; grandTotal+=(l.qty)*(l.price)*(1-d/100); });

  const fmtD = s=>{ if(!s)return''; const [y,m,d]=s.split('-'); return d+'/'+m+'/'+y; };
  const esc  = v=>{ const s=String(v==null?'':v); return (s.includes(',')||s.includes('"'))?'"'+s.replace(/"/g,'""')+'"':s; };

  const headers = [
    '*ContactName','EmailAddress',
    'POAddressLine1','POAddressLine2','POAddressLine3','POAddressLine4',
    'POCity','PORegion','POPostalCode','POCountry',
    '*InvoiceNumber','Reference','*InvoiceDate','*DueDate','Total',
    'InventoryItemCode','*Description','*Quantity','*UnitAmount','Discount',
    '*AccountCode','*TaxType','TaxAmount',
    'TrackingName1','TrackingOption1','TrackingName2','TrackingOption2',
    'Currency','BrandingTheme'
  ];

  const rows = [headers.join(',')];
  validLines.forEach((l,i)=>{
    const d  = l.disc||0;
    const row = [
      esc(dealer.storeName||''),
      '',
      esc(dealer.address||''),
      '','','',
      esc(dealer.area||''),
      'Pangasinan',
      '',
      'Philippines',
      esc(invNum),
      esc(reference),
      fmtD(invDate),
      fmtD(dueDate),
      i===0 ? grandTotal.toFixed(2) : '',
      esc(l.sku),
      esc(l.desc||''),
      l.qty,
      (l.price||0).toFixed(2),
      d||'',
      '200',
      'No Tax',
      '0',
      '','','','',
      'PHP',
      ''
    ];
    rows.push(row.join(','));
  });

  const csv  = rows.join('\r\n');
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = invNum+'-xero.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Xero CSV downloaded ✓','success');
}


// ── HISTORY ───────────────────────────────────────────────────
async function _fetchInvoiceHistory(){
  try{
    const r = await api({action:'getInvoices'});
    if(r.status==='ok') invoiceHistory = r.invoices || [];
  }catch(e){ console.error('_fetchInvoiceHistory',e); }
}

async function loadInvoiceHistory(){
  const body = document.getElementById('inv-history-body');
  if(body) body.innerHTML = '<div style="text-align:center;color:#888;padding:24px;font-size:13px">Loading…</div>';
  await _fetchInvoiceHistory();
  renderInvoiceHistory();
}

function renderInvoiceHistory(){
  const body    = document.getElementById('inv-history-body');
  if(!body) return;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const search  = (document.getElementById('inv-history-search')?.value||'').toLowerCase().trim();
  let list = invoiceHistory;
  if(search) list = list.filter(inv=>
    inv.invoiceNumber.toLowerCase().includes(search)||
    inv.contactName.toLowerCase().includes(search)||
    (inv.reference||'').toLowerCase().includes(search)
  );
  if(!list.length){
    body.innerHTML = '<div style="text-align:center;color:#888;padding:24px;font-size:13px">'
      +(invoiceHistory.length===0?'No invoices yet.':'No matches found.')+'</div>';
    return;
  }
  const fmt  = v=>'₱'+(Number(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fmtD = s=>phDate(s);
  body.innerHTML = '';
  list.forEach(inv=>{
    const pt     = inv.paymentType || 'Cash';
    const ptCls  = 'inv-pt-'+pt.replace(/\s+/g,'').toLowerCase();
    const isVoid = inv.status === 'VOID';
    const voidBadge = isVoid ? ' <span class="inv-void-badge">VOID</span>' : '';
    const voidBtn   = (isAdmin && !isVoid)
      ? '<button class="inv-void-btn" data-void-inv="'+inv.invoiceNumber+'" onclick="voidInvoice(\''+inv.invoiceNumber+'\')">Void</button>'
      : '';
    const card = document.createElement('div');
    card.className = 'inv-hist-card' + (isVoid ? ' inv-hist-voided' : '');
    // Tapping the card opens the full record (line items, signature, reprint).
    // The Void button stops propagation so it doesn't also open the detail.
    card.style.cursor = 'pointer';
    card.onclick = function(ev){
      if(ev.target.closest('.inv-void-btn')) return;
      openInvoiceDetail(inv.invoiceNumber);
    };
    card.innerHTML =
      '<div class="inv-hist-row1">'
        +'<div>'
          +'<div class="inv-hist-num">'+inv.invoiceNumber+voidBadge+'</div>'
          +'<div class="inv-hist-dealer">'+inv.contactName+'</div>'
        +'</div>'
        +'<div style="text-align:right">'
          +'<div class="inv-hist-total" style="'+(isVoid?'text-decoration:line-through;color:#bbb':'')+'">'+fmt(inv.total)+'</div>'
          +'<span class="inv-pt-badge '+ptCls+'">'+pt+'</span>'
        +'</div>'
      +'</div>'
      +'<div class="inv-hist-row2">'
        +'<span>'+fmtD(inv.invoiceDate)+'</span>'
        +(inv.reference?'<span>Ref: '+inv.reference+'</span>':'')
        +'<span>'+inv.paymentTerms+'</span>'
        +'<span style="color:#888">by '+inv.createdBy+'</span>'
        +voidBtn
      +'</div>';
    body.appendChild(card);
  });
}


// ── DAY TALLY ─────────────────────────────────────────────────
async function showDayTally(){
  const overlay = document.getElementById('inv-tally-overlay');
  if(!overlay) return;
  overlay.style.display = 'flex';
  const body = document.getElementById('inv-tally-body');
  body.innerHTML = '<div style="text-align:center;color:#888;padding:24px">Loading…</div>';
  const isAdmin = currentUser && currentUser.role === 'admin';
  try{
    const r = await api({
      action:    'getDayTally',
      createdBy: isAdmin ? '' : (currentUser ? currentUser.username : ''),
      adminView: isAdmin
    });
    if(r.status==='ok') _renderDayTally(r, isAdmin);
    else body.innerHTML = '<div style="color:#c00;padding:14px">Could not load tally.</div>';
  }catch(e){
    body.innerHTML = '<div style="color:#c00;padding:14px">Network error.</div>';
  }
}

function _renderDayTally(data, isAdmin){
  const body = document.getElementById('inv-tally-body');
  const fmt  = v=>'₱'+(Number(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');

  let html = '<div class="inv-tally-totals">';
  ['Cash','Check','Terms AR'].forEach(t=>{
    const v = (data.totals||{})[t]||0;
    if(v>0) html += '<div class="inv-tally-row"><span>'+t+'</span><span>'+fmt(v)+'</span></div>';
  });
  html += '<div class="inv-tally-row inv-tally-grand"><span>TOTAL COLLECTED</span><span>'+fmt(data.grandTotal||0)+'</span></div>';
  html += '</div>';

  if(data.invoices && data.invoices.length){
    if(isAdmin){
      // Group by driver/createdBy
      const byDriver = {};
      data.invoices.forEach(inv=>{
        const who = inv.createdBy || 'Unknown';
        if(!byDriver[who]) byDriver[who] = {invoices:[], total:0};
        byDriver[who].invoices.push(inv);
        byDriver[who].total += inv.total||0;
      });
      Object.entries(byDriver).forEach(([driver, group])=>{
        html += '<div class="inv-tally-label">'+driver+' ('+group.invoices.length+' invoice'+(group.invoices.length===1?'':'s')+' · '+fmt(group.total)+')</div>';
        group.invoices.forEach(inv=>{
          const ptCls = 'inv-pt-'+(inv.paymentType||'Cash').replace(/\s+/g,'').toLowerCase();
          html += '<div class="inv-tally-inv-row">'
            +'<span class="inv-tally-inv-num">'+inv.invoiceNumber+'</span>'
            +'<span class="inv-tally-inv-dealer">'+inv.contactName+'</span>'
            +'<span>'+fmt(inv.total)+'</span>'
            +'<span class="inv-pt-badge '+ptCls+'">'+(inv.paymentType||'Cash')+'</span>'
            +'</div>';
        });
      });
    } else {
      html += '<div class="inv-tally-label">Invoices Today ('+data.invoices.length+')</div>';
      data.invoices.forEach(inv=>{
        const ptCls = 'inv-pt-'+(inv.paymentType||'Cash').replace(/\s+/g,'').toLowerCase();
        html += '<div class="inv-tally-inv-row">'
          +'<span class="inv-tally-inv-num">'+inv.invoiceNumber+'</span>'
          +'<span class="inv-tally-inv-dealer">'+inv.contactName+'</span>'
          +'<span>'+fmt(inv.total)+'</span>'
          +'<span class="inv-pt-badge '+ptCls+'">'+(inv.paymentType||'Cash')+'</span>'
          +'</div>';
      });
    }
  } else {
    html += '<div style="text-align:center;color:#888;padding:16px;font-size:13px">No invoices today.</div>';
  }

  body.innerHTML = html;
}

function closeDayTally(){
  const overlay = document.getElementById('inv-tally-overlay');
  if(overlay) overlay.style.display = 'none';
}
