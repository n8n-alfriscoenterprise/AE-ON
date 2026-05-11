// ══════════════════════════════════════════════════════════════
// SALES INVOICE
// ══════════════════════════════════════════════════════════════

let invLines          = [];
let invProducts       = [];   // [{code, name, price}]
let invSaved          = false;
let invCurrentNumber  = null;
let invoiceHistory    = [];

// ── OPEN / CLOSE ──────────────────────────────────────────────
async function openInvoice(){
  showScreen('invoice-screen');
  updateFabVisibility();
  showInvSubtab('new', document.getElementById('inv-tab-new'));
  if(!dealerList.length) await loadDealers();
  await loadInvProducts();
  buildInvDealerSelect();
  resetInvForm();
}

function closeInvoice(){ showHome(); }

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
        code:  i.sku,
        name:  i.name,
        price: Number(i.price)||0
      }));
    }
  }catch(e){ console.error('loadInvProducts',e); }
}

// ── RESET FORM ────────────────────────────────────────────────
function resetInvForm(){
  invLines          = [];
  invSaved          = false;
  invCurrentNumber  = null;

  document.getElementById('inv-number').value = 'Draft';
  const today = new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'}).slice(0,10);
  document.getElementById('inv-date').value  = today;
  document.getElementById('inv-dealer').value = '';
  document.getElementById('inv-dealer-info').style.display = 'none';
  document.getElementById('inv-ref').value   = '';
  document.getElementById('inv-terms').value = 'COD';
  document.getElementById('inv-err').textContent = '';
  onInvTermsChange();
  document.getElementById('inv-lines-container').innerHTML = '';
  updateInvTotals();
  addInvLine();
}

// ── DEALER SELECT ─────────────────────────────────────────────
function buildInvDealerSelect(){
  const sel = document.getElementById('inv-dealer');
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Select Dealer --</option>';
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
  const info = document.getElementById('inv-dealer-info');
  const d    = dealerList.find(x=>x.dealerId===sel.value);
  if(d){
    info.innerHTML = '<strong>'+d.ownerName+'</strong> · '+d.phone1
      +(d.area?' · '+d.area:'')
      +(d.address?'<br>'+d.address:'');
    info.style.display = 'block';
  } else {
    info.style.display = 'none';
  }
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
  dueEl.value = base.toISOString().slice(0,10);
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
    const div = document.createElement('div');
    div.className = 'inv-line-row';
    div.id        = 'inv-line-'+idx;

    let skuOpts = '<option value="">-- Select product --</option>';
    invProducts.forEach(p=>{
      skuOpts += '<option value="'+p.code+'"'+(line.sku===p.code?' selected':'')+'>'+p.code+' — '+p.name+'</option>';
    });

    div.innerHTML =
      '<div class="inv-line-header">'
        +'<span class="inv-line-num">Item '+(idx+1)+'</span>'
        +'<button class="inv-line-remove" onclick="removeInvLine('+idx+')">✕ Remove</button>'
      +'</div>'
      +'<select class="inv-input" onchange="onInvSKUChange('+idx+',this.value)">'+skuOpts+'</select>'
      +'<input class="inv-input" type="text" placeholder="Description" id="inv-ldesc-'+idx+'" value="'+(line.desc||'')+'" oninput="invLines['+idx+'].desc=this.value">'
      +'<div class="inv-line-nums">'
        +'<div><label class="inv-field-label">Qty</label>'
          +'<input class="inv-input inv-input-num" type="number" min="1" value="'+line.qty+'" oninput="invLines['+idx+'].qty=Number(this.value)||0;updateInvTotals()"></div>'
        +'<div><label class="inv-field-label">Unit Price (₱)</label>'
          +'<input class="inv-input inv-input-num" type="number" min="0" step="0.01" value="'+(line.price||'')+'" placeholder="0.00" oninput="invLines['+idx+'].price=Number(this.value)||0;updateInvTotals()"></div>'
        +'<div><label class="inv-field-label">Disc %</label>'
          +'<input class="inv-input inv-input-num" type="number" min="0" max="100" value="'+(line.disc||0)+'" oninput="invLines['+idx+'].disc=Number(this.value)||0;updateInvTotals()"></div>'
        +'<div><label class="inv-field-label">Line Total</label>'
          +'<div class="inv-line-total" id="inv-ltotal-'+idx+'">₱0.00</div></div>'
      +'</div>';
    container.appendChild(div);
  });
  updateInvTotals();
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
  updateInvTotals();
}

function updateInvTotals(){
  let subtotal = 0;
  const fmt = v=>'₱'+v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  invLines.forEach((line,idx)=>{
    const d       = Math.min(100, Math.max(0, line.disc||0));
    const lt      = (line.qty||0) * (line.price||0) * (1 - d/100);
    subtotal     += lt;
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

  if(!dealerId) { errEl.textContent='Please select a dealer.'; return; }
  if(!invDate)  { errEl.textContent='Invoice date is required.'; return; }

  const validLines = invLines.filter(l=>l.sku && l.qty>0);
  if(!validLines.length){ errEl.textContent='Add at least one product with a quantity.'; return; }

  const dealer = dealerList.find(d=>d.dealerId===dealerId)||{};
  let subtotal = 0;
  validLines.forEach(l=>{
    const d = Math.min(100,Math.max(0,l.disc||0));
    subtotal += (l.qty||0)*(l.price||0)*(1-d/100);
  });

  const btn = document.getElementById('inv-save-btn');
  if(btn){ btn.disabled=true; btn.textContent='Saving...'; }

  const now = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'});
  try{
    const r = await api({
      action:       'saveInvoice',
      dealerId,
      contactName:  dealer.storeName||'',
      reference,
      invoiceDate:  invDate,
      dueDate:      invDue,
      paymentTerms: terms,
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
      createdBy: currentUser.username,
      createdAt: now
    });

    if(r.status==='ok'){
      invSaved          = true;
      invCurrentNumber  = r.invoiceNumber;
      document.getElementById('inv-number').value = r.invoiceNumber;
      showToast(r.invoiceNumber+' saved ✓','success');
    } else {
      errEl.textContent = 'Error: '+(r.msg||'Could not save');
    }
  }catch(e){
    errEl.textContent = 'Network error: '+e.message;
  }
  if(btn){ btn.disabled=false; btn.textContent='💾 Save Invoice'; }
}

// ── PRINT ─────────────────────────────────────────────────────
async function printInvoice(){
  if(!invSaved) await saveInvoice();
  if(!invSaved) return;

  const dealerId  = document.getElementById('inv-dealer').value;
  const dealer    = dealerList.find(d=>d.dealerId===dealerId)||{};
  const invDate   = document.getElementById('inv-date').value;
  const dueDate   = document.getElementById('inv-due').value;
  const terms     = document.getElementById('inv-terms').value;
  const reference = document.getElementById('inv-ref').value.trim();
  const invNum    = invCurrentNumber;

  const validLines = invLines.filter(l=>l.sku && l.qty>0);
  let subtotal = 0;
  const fmt    = v=>'₱'+v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fmtD   = s=>{ if(!s)return''; const [y,m,d]=s.split('-'); return d+'/'+m+'/'+y; };

  const lineRows = validLines.map((l,i)=>{
    const d  = Math.min(100,Math.max(0,l.disc||0));
    const lt = (l.qty||0)*(l.price||0)*(1-d/100);
    subtotal += lt;
    return '<tr>'
      +'<td>'+(i+1)+'</td>'
      +'<td>'+l.sku+'</td>'
      +'<td>'+(l.desc||'')+'</td>'
      +'<td class="ipv-r">'+l.qty+'</td>'
      +'<td class="ipv-r">'+fmt(l.price||0)+'</td>'
      +'<td class="ipv-r">'+(d>0?d+'%':'—')+'</td>'
      +'<td class="ipv-r"><strong>'+fmt(lt)+'</strong></td>'
      +'</tr>';
  }).join('');

  const dueLabel = terms==='COD'
    ? 'COD — Cash on Delivery'
    : fmtD(dueDate)+' ('+terms+')';

  const pv = document.getElementById('inv-print-view');
  pv.innerHTML =
    '<div class="ipv-wrap">'
    // Header
    +'<div class="ipv-header">'
      +'<div class="ipv-biz">'
        +'<div class="ipv-biz-name">ALFRISCO ENTERPRISE</div>'
        +'<div class="ipv-biz-sub">Animal Feed Distributor · Province of Pangasinan, Philippines</div>'
        +'<div class="ipv-biz-sub">alfriscoenterprise@gmail.com</div>'
      +'</div>'
      +'<div class="ipv-inv-box">'
        +'<div class="ipv-inv-label">SALES INVOICE</div>'
        +'<div class="ipv-inv-num">'+invNum+'</div>'
      +'</div>'
    +'</div>'
    // Meta row
    +'<div class="ipv-meta">'
      +'<div><span class="ipv-ml">Date:</span> '+fmtD(invDate)+'</div>'
      +'<div><span class="ipv-ml">Due:</span> '+dueLabel+'</div>'
      +(reference?'<div><span class="ipv-ml">Ref:</span> '+reference+'</div>':'')
    +'</div>'
    // Bill To
    +'<div class="ipv-bill">'
      +'<div class="ipv-bill-label">BILL TO</div>'
      +'<div class="ipv-bill-name">'+(dealer.storeName||'')+'</div>'
      +'<div class="ipv-bill-sub">'+(dealer.ownerName||'')+'</div>'
      +(dealer.area?'<div class="ipv-bill-sub">'+dealer.area+'</div>':'')
      +(dealer.address?'<div class="ipv-bill-sub">'+dealer.address+'</div>':'')
      +(dealer.phone1?'<div class="ipv-bill-sub">Tel: '+dealer.phone1+(dealer.phone2?' · '+dealer.phone2:'')+'</div>':'')
    +'</div>'
    // Table
    +'<table class="ipv-table">'
      +'<thead><tr>'
        +'<th>#</th><th>SKU</th><th>Description</th>'
        +'<th class="ipv-r">Qty</th><th class="ipv-r">Unit Price</th>'
        +'<th class="ipv-r">Disc</th><th class="ipv-r">Total</th>'
      +'</tr></thead>'
      +'<tbody>'+lineRows+'</tbody>'
    +'</table>'
    // Totals
    +'<div class="ipv-totals">'
      +'<div class="ipv-total-row"><span>Subtotal</span><span>'+fmt(subtotal)+'</span></div>'
      +'<div class="ipv-total-row ipv-grand"><span>TOTAL DUE</span><span>'+fmt(subtotal)+'</span></div>'
    +'</div>'
    // Footer
    +'<div class="ipv-footer">Thank you for your business! &nbsp;·&nbsp; Alfrisco Enterprise</div>'
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
      esc(dealer.storeName||''),    // *ContactName
      '',                            // EmailAddress
      esc(dealer.address||''),       // POAddressLine1
      '','','',                      // POAddressLine2-4
      esc(dealer.area||''),          // POCity
      'Pangasinan',                  // PORegion
      '',                            // POPostalCode
      'Philippines',                 // POCountry
      esc(invNum),                   // *InvoiceNumber
      esc(reference),                // Reference
      fmtD(invDate),                 // *InvoiceDate
      fmtD(dueDate),                 // *DueDate
      i===0 ? grandTotal.toFixed(2) : '', // Total (first line only)
      esc(l.sku),                    // InventoryItemCode
      esc(l.desc||''),               // *Description
      l.qty,                         // *Quantity
      (l.price||0).toFixed(2),       // *UnitAmount
      d||'',                         // Discount
      '200',                         // *AccountCode
      'No Tax',                      // *TaxType
      '0',                           // TaxAmount
      '','','','',                   // Tracking (blank)
      'PHP',                         // Currency
      ''                             // BrandingTheme
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
async function loadInvoiceHistory(){
  const body = document.getElementById('inv-history-body');
  body.innerHTML = '<div style="text-align:center;color:#888;padding:24px;font-size:13px">Loading…</div>';
  try{
    const r = await api({action:'getInvoices'});
    if(r.status==='ok'){
      invoiceHistory = r.invoices||[];
      renderInvoiceHistory();
    } else {
      body.innerHTML = '<div style="color:#c00;padding:14px;font-size:13px">Could not load invoices.</div>';
    }
  }catch(e){
    body.innerHTML = '<div style="color:#c00;padding:14px;font-size:13px">Network error.</div>';
  }
}

function renderInvoiceHistory(){
  const body   = document.getElementById('inv-history-body');
  const search = (document.getElementById('inv-history-search')?.value||'').toLowerCase().trim();
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
  const fmt = v=>'₱'+(Number(v)||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  const fmtD = s=>{ if(!s)return''; const p=String(s).slice(0,10).split('-'); return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s; };
  body.innerHTML = '';
  list.forEach(inv=>{
    const card = document.createElement('div');
    card.className = 'inv-hist-card';
    card.innerHTML =
      '<div class="inv-hist-row1">'
        +'<div>'
          +'<div class="inv-hist-num">'+inv.invoiceNumber+'</div>'
          +'<div class="inv-hist-dealer">'+inv.contactName+'</div>'
        +'</div>'
        +'<div class="inv-hist-total">'+fmt(inv.total)+'</div>'
      +'</div>'
      +'<div class="inv-hist-row2">'
        +'<span>'+fmtD(inv.invoiceDate)+'</span>'
        +(inv.reference?'<span>Ref: '+inv.reference+'</span>':'')
        +'<span>'+inv.paymentTerms+'</span>'
        +'<span style="color:#888">by '+inv.createdBy+'</span>'
      +'</div>';
    body.appendChild(card);
  });
}
