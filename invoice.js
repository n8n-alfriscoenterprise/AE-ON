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


// ── OPEN / CLOSE ──────────────────────────────────────────────
async function openInvoice(){
  showScreen('invoice-screen');
  updateFabVisibility();
  showInvSubtab('new', document.getElementById('inv-tab-new'));
  if(!dealerList.length) await loadDealers();
  await loadInvProducts();
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
  document.getElementById('inv-dealer').value = '';
  document.getElementById('inv-dealer-info').style.display = 'none';
  const oh = document.getElementById('inv-order-history');
  if(oh) oh.style.display = 'none';
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
}


// ── DEALER SELECT ─────────────────────────────────────────────
function buildInvDealerSelect(){
  const sel = document.getElementById('inv-dealer');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Select Dealer --</option>'
    + '<option value="__add_new__">＋ Add New Dealer</option>';
  const visible = dealerList
    .filter(d=>d.status==='Active'||d.status==='On Hold')
    .sort((a,b)=>a.storeName.localeCompare(b.storeName));
  visible.forEach(d=>{
    const o = document.createElement('option');
    o.value       = d.dealerId;
    o.textContent = d.storeName+(d.area?' · '+d.area:'');
    sel.appendChild(o);
  });
  if(cur) sel.value = cur;
}

function onInvDealerChange(){
  const sel  = document.getElementById('inv-dealer');
  if(sel.value === '__add_new__'){
    sel.value = '';   // reset so dropdown shows placeholder on return
    addNewDealerFromInvoice();
    return;
  }
  const info = document.getElementById('inv-dealer-info');
  const d    = dealerList.find(x=>x.dealerId===sel.value);
  if(d){
    info.innerHTML =
      '<strong>'+d.ownerName+'</strong> · '+d.phone1
      +(d.area?' · '+d.area:'')
      +(d.address?'<br>'+d.address:'');
    info.style.display = 'block';
    _renderDealerOrderHistory(d.dealerId);
  } else {
    info.style.display = 'none';
    const oh = document.getElementById('inv-order-history');
    if(oh) oh.style.display = 'none';
  }
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


// ── PAYMENT TERMS ─────────────────────────────────────────────
function onInvTermsChange(){
  const terms   = document.getElementById('inv-terms').value;
  const dateStr = document.getElementById('inv-date').value;
  const dueEl   = document.getElementById('inv-due');
  if(!dateStr){ dueEl.value=''; return; }
  const base = new Date(dateStr+'T00:00:00');
  const days = terms==='Net 7'?7:terms==='Net 15'?15:terms==='Net 30'?30:0;
  base.setDate(base.getDate()+days);
  dueEl.value = base.toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'});
}


// ── PAYMENT TYPE ──────────────────────────────────────────────
function onInvPaymentTypeChange(){
  const pt    = document.getElementById('inv-payment-type')?.value || 'Cash';
  const field = document.getElementById('inv-check-ref-field');
  if(field) field.style.display = (pt==='Check') ? 'block' : 'none';
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

async function printInvoice(){
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
  if(!invSaved) await saveInvoice();
  if(!invSaved) return;
  const rcpt = _buildReceiptHtml();
  const pv   = document.getElementById('inv-print-view');
  pv.innerHTML =
    '<div class="rcp-copy-label">&#x2014; CUSTOMER COPY &#x2014;</div>' + rcpt +
    '<div class="rcp-page-break"></div>' +
    '<div class="rcp-copy-label">&#x2014; MERCHANT COPY &#x2014;</div>' + rcpt;
  window.print();
  setTimeout(()=>{
    showToast('Sale charged ✓ — ready for next invoice','success');
    resetInvForm();
  }, 600);
}

async function voidInvoice(invNum){
  if(!currentUser || currentUser.role!=='admin') return;
  const reason = window.prompt('Void reason for '+invNum+' (required):');
  if(!reason || !reason.trim()) return;
  try{
    const btn = document.querySelector('[data-void-inv="'+invNum+'"]');
    if(btn){ btn.disabled=true; btn.textContent='Voiding…'; }
    const r = await api({action:'voidInvoice', invoiceNumber:invNum, reason:reason.trim(), voidedBy:currentUser.username});
    if(r.status==='ok'){
      showToast(invNum+' voided','warning');
      invoiceHistory = invoiceHistory.map(i=>i.invoiceNumber===invNum?{...i,status:'VOID'}:i);
      renderInvoiceHistory();
    } else {
      alert('Error: '+(r.msg||'Could not void'));
      if(btn){ btn.disabled=false; btn.textContent='Void'; }
    }
  }catch(e){
    alert('Network error: '+e.message);
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
