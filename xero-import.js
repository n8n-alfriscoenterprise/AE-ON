// ════════════════════════════════════════════════════════
// SALES IMPORT — Distribution (Xero) + Retail (Loyverse)
// ════════════════════════════════════════════════════════

let siActiveTab = 'xero';

function openSalesImport(){
  showScreen('sales-import-screen');
  updateFabVisibility();
  setSiTab('xero');
  resetXiTab();
  resetLyTab();
  // Pre-load dealer list so contact cross-check works immediately
  if(!dealerList.length) loadDealers();
}

function closeSalesImport(){ showHome(); }

function setSiTab(tab){
  siActiveTab = tab;
  document.querySelectorAll('.si-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('si-tab-'+tab).classList.add('active');
  document.getElementById('si-panel-xero').style.display      = tab==='xero'      ? 'flex' : 'none';
  document.getElementById('si-panel-loyverse').style.display  = tab==='loyverse'  ? 'flex' : 'none';
}


// ════════════════════════════════════════════════════════
// TAB 1 — XERO  (Distribution Sales)
// ════════════════════════════════════════════════════════
let xiRows = [];

function resetXiTab(){
  xiRows = [];
  const fi = document.getElementById('xi-file-input'); if(fi) fi.value='';
  const pa = document.getElementById('xi-preview-area'); if(pa) pa.innerHTML='';
  const cb = document.getElementById('xi-confirm-btn'); if(cb) cb.style.display='none';
  const dz = document.getElementById('xi-drop-zone'); if(dz) dz.classList.remove('xi-drop-active');
  setXiStatus('','');
}

// ── Drag-drop ─────────────────────────────────────────
function onXiFileSelect(input){ if(input.files[0]) readXiFile(input.files[0]); }
function onXiDragOver(e){ e.preventDefault(); document.getElementById('xi-drop-zone').classList.add('xi-drop-active'); }
function onXiDragLeave(){ document.getElementById('xi-drop-zone').classList.remove('xi-drop-active'); }
function onXiDrop(e){
  e.preventDefault();
  document.getElementById('xi-drop-zone').classList.remove('xi-drop-active');
  if(e.dataTransfer.files[0]) readXiFile(e.dataTransfer.files[0]);
}

function readXiFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){ setXiStatus('Please select a CSV file exported from Xero.','error'); return; }
  setXiStatus('Reading file…','ok');
  const reader = new FileReader();
  reader.onload = e => parseXiCSV(e.target.result);
  reader.readAsText(file);
}

// ── Parser ────────────────────────────────────────────
function parseXiCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2){ setXiStatus('File appears empty.','error'); return; }

  const headers = parseSiLine(lines[0]);
  const col = {};
  const needed = {
    contact:'ContactName', invoiceNum:'InvoiceNumber', invoiceDate:'InvoiceDate',
    dueDate:'DueDate', total:'Total', amountPaid:'InvoiceAmountPaid',
    amountDue:'InvoiceAmountDue', skuCode:'InventoryItemCode', description:'Description',
    quantity:'Quantity', unitAmount:'UnitAmount', lineAmount:'LineAmount',
    status:'Status', type:'Type',
    division:'TrackingOption2'   // selling unit, e.g. "Wholesale-Bajaj1" → routes the Load List
  };
  Object.entries(needed).forEach(([k,v])=>{ col[k]=headers.indexOf(v); });

  if(col.invoiceNum<0||col.skuCode<0){
    setXiStatus('This doesn\'t look like a Xero Sales Invoice export. Export from Accounts → Sales Invoices and try again.','error');
    return;
  }

  xiRows = [];
  lines.slice(1).forEach(line=>{
    if(!line.trim()) return;
    const r = parseSiLine(line);
    const type   = String(r[col.type]  ||'').toLowerCase();
    const status = String(r[col.status]||'').toLowerCase();
    if(!type.includes('invoice')) return;
    if(status==='voided'||status==='deleted') return;
    const skuCode = String(r[col.skuCode]||'').trim();
    if(!skuCode) return;
    xiRows.push({
      invoiceNumber: String(r[col.invoiceNum]  ||'').trim(),
      invoiceDate:   String(r[col.invoiceDate] ||'').trim(),
      dueDate:       String(r[col.dueDate]     ||'').trim(),
      contactName:   String(r[col.contact]     ||'').trim(),
      skuCode,
      description:   String(r[col.description]||'').trim(),
      quantity:      parseFloat(r[col.quantity])   ||0,
      unitAmount:    parseFloat(r[col.unitAmount]) ||0,
      lineAmount:    parseFloat(r[col.lineAmount]) ||0,
      invoiceTotal:  parseFloat(r[col.total])      ||0,
      amountPaid:    parseFloat(r[col.amountPaid]) ||0,
      amountDue:     parseFloat(r[col.amountDue])  ||0,
      status:        String(r[col.status]||'').trim(),
      division:      col.division>=0 ? String(r[col.division]||'').trim() : ''
    });
  });

  if(!xiRows.length){ setXiStatus('No valid sales invoice line items found. Check that your export includes line-item detail.','error'); return; }
  renderXiPreview();
}

// ── Preview ───────────────────────────────────────────
function renderXiPreview(){
  const area = document.getElementById('xi-preview-area');
  const invoices = [...new Set(xiRows.map(r=>r.invoiceNumber))];
  const dealers  = [...new Set(xiRows.map(r=>r.contactName))];
  const revenue  = xiRows.reduce((s,r)=>s+r.lineAmount,0);
  const dates    = xiRows.map(r=>r.invoiceDate).filter(Boolean).sort();
  const dr = dates.length ? (dates[0]===dates[dates.length-1] ? dates[0] : dates[0]+' – '+dates[dates.length-1]) : '—';

  // ── Cross-check Xero SKUs against Dist SKU Master ─────────────
  const xiSkuCodes  = [...new Set(xiRows.map(r=>r.skuCode))];
  const distKnown   = new Set(
    (liveSKUs||[]).filter(s=>s.type==='DIST').map(s=>s.code.trim().toLowerCase())
  );
  const unknownXiSkus = xiSkuCodes.filter(s=>!distKnown.has(s.trim().toLowerCase()));

  // ── Cross-check contacts against dealer directory ──────────────
  const unrecognized = _findUnrecognizedContacts(dealers);

  let html = `
    <div class="si-summary-grid">
      <div class="si-stat"><div class="si-stat-val">${invoices.length}</div><div class="si-stat-label">Invoices</div></div>
      <div class="si-stat"><div class="si-stat-val">${xiRows.length}</div><div class="si-stat-label">Lines</div></div>
      <div class="si-stat"><div class="si-stat-val">${dealers.length}</div><div class="si-stat-label">Dealers</div></div>
      <div class="si-stat"><div class="si-stat-val si-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Revenue</div></div>
    </div>
    <div class="si-date-range">📅 &nbsp;${dr}</div>`;

  // ── Xero SKU mismatch warning banner ──────────────────────────
  if(unknownXiSkus.length){
    const skuItems = unknownXiSkus.map(s=>{
      const lines    = xiRows.filter(r=>r.skuCode===s);
      const itemName = lines[0]?.description || '—';
      const totalQty = lines.reduce((sum,r)=>sum+r.quantity,0);
      return `<div class="ly-sku-warn-item"><strong>${s}</strong> — ${itemName} <span class="ly-sku-warn-qty">(total qty: ${totalQty})</span></div>`;
    }).join('');
    html+=`<div class="ly-sku-warn-wrap">
      <div class="ly-sku-warn-title">⚠ ${unknownXiSkus.length} SKU${unknownXiSkus.length!==1?'s':''} not found in Distribution SKU Master</div>
      <div class="ly-sku-warn-sub">These Xero SKU codes don't match any item in your Distribution SKU Master. Sales will still be logged, but stock won't be deducted for these items. Update the SKU Master first if needed.</div>
      <div class="ly-sku-warn-list">${skuItems}</div>
    </div>`;
  }

  // ── Unrecognized contacts banner ───────────────────────────────
  if(unrecognized.length){
    html += `<div class="xi-new-contacts-wrap">
      <div class="xi-new-contacts-title">⚠ ${unrecognized.length} contact${unrecognized.length!==1?'s':''} not in your Dealer Directory</div>
      <div class="xi-new-contacts-sub">These names appear in Xero but have no matching dealer record. You can add them now or import the data as-is.</div>
      <div id="xi-new-contacts-list">`;
    unrecognized.forEach(c=>{
      const contactRows = xiRows.filter(r=>r.contactName===c.name);
      const invCount = [...new Set(contactRows.map(r=>r.invoiceNumber))].length;
      // Xero repeats the invoice Total on every line — count each invoice's total
      // ONCE (otherwise a 2-line invoice shows 2× its real amount, etc.)
      const seenInv = {}; let total = 0;
      contactRows.forEach(r=>{ if(!seenInv[r.invoiceNumber]){ seenInv[r.invoiceNumber]=true; total += r.invoiceTotal; } });
      const uid      = 'xnc-'+c.name.replace(/[^a-zA-Z0-9]/g,'_');
      html += `<div class="xi-new-contact-card" id="${uid}">
        <div class="xi-nc-info">
          <div class="xi-nc-name">${c.name}</div>
          <div class="xi-nc-meta">${invCount} invoice${invCount!==1?'s':''} &nbsp;·&nbsp; ₱${total.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
        </div>
        <button class="xi-nc-add-btn" onclick="xiShowAddDealer('${c.name.replace(/'/g,"\\'")}','${uid}')">➕ Add as Dealer</button>
      </div>
      <div class="xi-nc-form" id="${uid}-form" style="display:none"></div>`;
    });
    html += `</div></div>`;
  }

  html += `<div class="si-table-wrap">
    <table class="si-table">
      <thead><tr><th>Invoice</th><th>Date</th><th>Dealer</th><th>SKU</th><th>Item</th><th>Qty</th><th>Unit ₱</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>`;
  xiRows.forEach(r=>{
    const sc = r.status.toLowerCase().includes('paid') ? 'si-badge-paid'
             : r.status.toLowerCase().includes('awaiting') ? 'si-badge-awaiting' : '';
    html+=`<tr>
      <td>${r.invoiceNumber}</td><td class="si-nowrap">${r.invoiceDate}</td>
      <td>${r.contactName}</td><td><strong>${r.skuCode}</strong></td><td>${r.description}</td>
      <td>${r.quantity}</td>
      <td class="si-num">₱${r.unitAmount.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td class="si-num si-green">₱${r.lineAmount.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td><span class="si-badge ${sc}">${r.status}</span></td>
    </tr>`;
  });
  html+=`</tbody></table></div>`;
  area.innerHTML = html;
  document.getElementById('xi-confirm-btn').style.display='block';
  setXiStatus(`✓ ${xiRows.length} line items across ${invoices.length} invoices ready to import.`,'ok');
}

// Returns unique contact names that don't match any dealer (case-insensitive)
function _findUnrecognizedContacts(contactNames){
  if(!dealerList || !dealerList.length) return contactNames.map(n=>({name:n}));
  const known = new Set(dealerList.map(d=>d.storeName.toLowerCase().trim()));
  return contactNames
    .filter(n=>!known.has(n.toLowerCase().trim()))
    .map(n=>({name:n}));
}

// Shows the inline mini-form to add an unrecognized contact as a dealer
function xiShowAddDealer(contactName, uid){
  const formEl = document.getElementById(uid+'-form');
  const addBtn = document.querySelector('#'+uid+' .xi-nc-add-btn');
  if(!formEl) return;

  // If form already open, toggle it closed
  if(formEl.style.display !== 'none'){ formEl.style.display='none'; if(addBtn) addBtn.textContent='➕ Add as Dealer'; return; }
  if(addBtn) addBtn.textContent='✕ Cancel';

  formEl.innerHTML = `
    <div class="xi-nc-form-inner">
      <div class="xi-nc-form-row">
        <div>
          <label class="xi-nc-label">Store Name *</label>
          <input class="xi-nc-input" id="${uid}-store" type="text" value="${contactName.replace(/"/g,'&quot;')}">
        </div>
        <div>
          <label class="xi-nc-label">Owner Name</label>
          <input class="xi-nc-input" id="${uid}-owner" type="text" placeholder="Contact person">
        </div>
      </div>
      <div class="xi-nc-form-row">
        <div>
          <label class="xi-nc-label">Area / Municipality</label>
          <input class="xi-nc-input" id="${uid}-area" type="text" placeholder="e.g. Dagupan City">
        </div>
        <div>
          <label class="xi-nc-label">Phone</label>
          <input class="xi-nc-input" id="${uid}-phone" type="text" placeholder="09XX XXX XXXX">
        </div>
      </div>
      <div class="xi-nc-form-row">
        <div>
          <label class="xi-nc-label">Dealer Type</label>
          <select class="xi-nc-input" id="${uid}-type">
            <option value="Feed Store">Feed Store</option>
            <option value="Pet Shop">Pet Shop</option>
            <option value="Vet Clinic">Vet Clinic</option>
            <option value="General Store">General Store</option>
            <option value="Supermarket">Supermarket</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label class="xi-nc-label">Status</label>
          <select class="xi-nc-input" id="${uid}-status">
            <option value="Active">Active</option>
            <option value="Prospect">Prospect</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div class="xi-nc-err" id="${uid}-err"></div>
      <button class="xi-nc-save-btn" id="${uid}-save" onclick="xiSaveNewDealer('${uid}','${contactName.replace(/'/g,"\\'")}')">💾 Save to Dealer Directory</button>
    </div>`;
  formEl.style.display = 'block';
}

// Saves the new dealer and marks the contact card as linked
async function xiSaveNewDealer(uid, originalName){
  const storeName = document.getElementById(uid+'-store')?.value.trim();
  const errEl     = document.getElementById(uid+'-err');
  if(!storeName){ if(errEl) errEl.textContent='Store name is required.'; return; }

  const saveBtn = document.getElementById(uid+'-save');
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Saving…'; }
  if(errEl)  errEl.textContent='';

  const now = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'});
  try{
    const r = await api({
      action:     'saveDealer',
      storeName,
      ownerName:  document.getElementById(uid+'-owner')?.value.trim()  || '',
      phone1:     document.getElementById(uid+'-phone')?.value.trim()  || '',
      area:       document.getElementById(uid+'-area')?.value.trim()   || '',
      dealerType: document.getElementById(uid+'-type')?.value          || 'Feed Store',
      status:     document.getElementById(uid+'-status')?.value        || 'Active',
      addedBy:    currentUser ? currentUser.username : '',
      addedAt:    now
    });
    if(r.status==='ok'){
      // Add to local dealer list so the invoice picker sees it immediately
      dealerList.push({
        dealerId:   r.dealerId,
        storeName,
        ownerName:  document.getElementById(uid+'-owner')?.value.trim()  || '',
        phone1:     document.getElementById(uid+'-phone')?.value.trim()  || '',
        area:       document.getElementById(uid+'-area')?.value.trim()   || '',
        dealerType: document.getElementById(uid+'-type')?.value          || 'Feed Store',
        status:     document.getElementById(uid+'-status')?.value        || 'Active'
      });
      // Replace the card with a success indicator
      const card = document.getElementById(uid);
      const formEl = document.getElementById(uid+'-form');
      if(card) card.innerHTML = `
        <div class="xi-nc-info">
          <div class="xi-nc-name">${storeName}</div>
          <div class="xi-nc-meta" style="color:#1B5E20">✓ Added as dealer — ${r.dealerId}</div>
        </div>`;
      if(formEl) formEl.style.display='none';
      showToast(storeName+' added to Dealer Directory ✓','success');
      // Refresh the invoice dealer picker if it's loaded
      if(typeof buildInvDealerSelect==='function') buildInvDealerSelect();
    } else {
      if(errEl) errEl.textContent = 'Error: '+(r.msg||'Could not save');
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 Save to Dealer Directory'; }
    }
  }catch(e){
    if(errEl) errEl.textContent = 'Network error: '+e.message;
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 Save to Dealer Directory'; }
  }
}

// ── Confirm ───────────────────────────────────────────
async function confirmXiImport(){
  if(!xiRows.length) return;
  const btn = document.getElementById('xi-confirm-btn');
  btn.disabled=true; btn.textContent='Importing…';
  setXiStatus('Sending to Google Sheets…','ok');
  try{
    const r = await api({action:'importXeroSales', rows:xiRows, importedBy:currentUser.username});
    if(r.status==='ok'){
      const stockNote = r.stockUpdated > 0 ? ` Stock adjusted for ${r.stockUpdated} SKU${r.stockUpdated!==1?'s':''}.` : '';
      const replNote  = r.replaced > 0 ? ` ${r.replaced} existing invoice${r.replaced!==1?'s':''} updated.` : '';
      setXiStatus(`✅ Done — ${r.imported} line${r.imported!==1?'s':''} imported.${replNote}${stockNote}`,'ok');
      btn.style.display='none'; xiRows=[];
      document.getElementById('xi-file-input').value='';
      document.getElementById('xi-preview-area').innerHTML='';
      // Refresh product list data in background so low-stock badge updates
      if(typeof loadPLData === 'function') loadPLData();
    } else {
      setXiStatus('Import failed: '+(r.msg||'Unknown error'),'error');
      btn.disabled=false; btn.textContent='Confirm & Import';
    }
  }catch(e){
    setXiStatus('Import failed: '+e.message,'error');
    btn.disabled=false; btn.textContent='Confirm & Import';
  }
}

function setXiStatus(msg,type){
  const el=document.getElementById('xi-status'); if(!el) return;
  el.textContent=msg;
  el.className='si-status'+(type==='error'?' si-status-error':type==='ok'?' si-status-ok':'');
}


// ════════════════════════════════════════════════════════
// TAB 2 — LOYVERSE  (Retail Sales)
// ════════════════════════════════════════════════════════
let lyRows = [];

function resetLyTab(){
  lyRows = [];
  const fi = document.getElementById('ly-file-input'); if(fi) fi.value='';
  const pa = document.getElementById('ly-preview-area'); if(pa) pa.innerHTML='';
  const cb = document.getElementById('ly-confirm-btn'); if(cb) cb.style.display='none';
  const dz = document.getElementById('ly-drop-zone'); if(dz) dz.classList.remove('xi-drop-active');
  setLyStatus('','');
}

// ── Drag-drop ─────────────────────────────────────────
function onLyFileSelect(input){ if(input.files[0]) readLyFile(input.files[0]); }
function onLyDragOver(e){ e.preventDefault(); document.getElementById('ly-drop-zone').classList.add('xi-drop-active'); }
function onLyDragLeave(){ document.getElementById('ly-drop-zone').classList.remove('xi-drop-active'); }
function onLyDrop(e){
  e.preventDefault();
  document.getElementById('ly-drop-zone').classList.remove('xi-drop-active');
  if(e.dataTransfer.files[0]) readLyFile(e.dataTransfer.files[0]);
}

function readLyFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){ setLyStatus('Please select a CSV file exported from Loyverse.','error'); return; }
  setLyStatus('Reading file…','ok');
  const reader = new FileReader();
  reader.onload = e => parseLyCSV(e.target.result);
  reader.readAsText(file);
}

// ── Parser ────────────────────────────────────────────
function parseLyCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2){ setLyStatus('File appears empty.','error'); return; }

  const headers = parseSiLine(lines[0]);
  // Loyverse "Receipts by Item" columns
  const col = {
    date:       headers.indexOf('Date'),
    receiptNum: headers.indexOf('Receipt number'),
    type:       headers.indexOf('Receipt type'),
    category:   headers.indexOf('Category'),
    sku:        headers.indexOf('SKU'),
    item:       headers.indexOf('Item'),
    variant:    headers.indexOf('Variant'),
    qty:        headers.indexOf('Quantity'),
    grossSales: headers.indexOf('Gross sales'),
    discounts:  headers.indexOf('Discounts'),
    netSales:   headers.indexOf('Net sales'),
    cogs:       headers.indexOf('Cost of goods'),
    profit:     headers.indexOf('Gross profit'),
    taxes:      headers.indexOf('Taxes'),
    cashier:    headers.indexOf('Cashier name'),
    customer:   headers.indexOf('Customer name'),
    contacts:   headers.indexOf('Customer contacts'),
    store:      headers.indexOf('Store'),
    status:     headers.indexOf('Status')
  };

  if(col.receiptNum<0||col.sku<0){
    setLyStatus('This doesn\'t look like a Loyverse "Receipts by Item" export. Export from Loyverse → Reports → Receipts by Item.','error');
    return;
  }

  lyRows = [];
  lines.slice(1).forEach(line=>{
    if(!line.trim()) return;
    const r = parseSiLine(line);
    const type   = String(r[col.type]  ||'').toLowerCase();
    const status = String(r[col.status]||'').toLowerCase();
    // Keep Sales and Refunds; skip voided
    if(!type.includes('sale')&&!type.includes('refund')) return;
    if(status==='voided') return;
    const sku = String(r[col.sku]||'').trim();
    if(!sku) return;

    // Parse date and time from combined field e.g. "5/3/26 7:12 PM"
    const rawDate = String(r[col.date]||'').trim();
    const dateParts = rawDate.split(' ');
    const dateOnly = dateParts[0]||rawDate;
    const timeOnly = dateParts.length>1 ? dateParts.slice(1).join(' ') : '';

    const qty = parseFloat(r[col.qty])||0;
    // Refunds come through as positive qty — sign by type
    const signedQty = type.includes('refund') ? -Math.abs(qty) : qty;

    lyRows.push({
      receiptNumber: String(r[col.receiptNum]||'').trim(),
      date:          dateOnly,
      time:          timeOnly,
      receiptType:   String(r[col.type]||'').trim(),
      category:      String(r[col.category]||'').trim(),
      sku,
      item:          String(r[col.item]   ||'').trim(),
      variant:       String(r[col.variant]||'').trim(),
      qty:           signedQty,
      grossSales:    parseFloat(r[col.grossSales])||0,
      discounts:     parseFloat(r[col.discounts]) ||0,
      netSales:      parseFloat(r[col.netSales])  ||0,
      cogs:          parseFloat(r[col.cogs])       ||0,
      grossProfit:   parseFloat(r[col.profit])     ||0,
      taxes:         parseFloat(r[col.taxes])      ||0,
      cashier:       String(r[col.cashier] ||'').trim(),
      customerName:  String(r[col.customer]||'').trim(),
      customerContact:String(r[col.contacts]||'').trim(),
      store:         String(r[col.store]   ||'').trim(),
      status:        String(r[col.status]  ||'').trim()
    });
  });

  if(!lyRows.length){ setLyStatus('No valid receipt line items found. Check you exported "Receipts by Item" (not the summary report).','error'); return; }
  renderLyPreview();
}

// ── Preview ───────────────────────────────────────────
function renderLyPreview(){
  const area = document.getElementById('ly-preview-area');
  const receipts  = [...new Set(lyRows.map(r=>r.receiptNumber))];
  const revenue   = lyRows.filter(r=>r.receiptType.toLowerCase().includes('sale')).reduce((s,r)=>s+r.netSales,0);
  const refunds   = lyRows.filter(r=>r.receiptType.toLowerCase().includes('refund')).reduce((s,r)=>s+r.netSales,0);
  const profit    = lyRows.reduce((s,r)=>s+r.grossProfit,0);
  const dates     = lyRows.map(r=>r.date).filter(Boolean).sort();
  const dr = dates.length ? (dates[0]===dates[dates.length-1] ? dates[0] : dates[0]+' – '+dates[dates.length-1]) : '—';
  const refundCount = lyRows.filter(r=>r.receiptType.toLowerCase().includes('refund')).length;

  // ── Cross-check Loyverse SKUs against Retail SKU Master ───────────
  const lySkuCodes   = [...new Set(lyRows.map(r=>r.sku))];
  const retailKnown  = new Set(
    (liveSKUs||[]).filter(s=>s.type==='RETAIL').map(s=>s.code.trim().toLowerCase())
  );
  const unknownSkus  = lySkuCodes.filter(s=>!retailKnown.has(s.trim().toLowerCase()));

  let html = `
    <div class="si-summary-grid">
      <div class="si-stat"><div class="si-stat-val">${receipts.length}</div><div class="si-stat-label">Receipts</div></div>
      <div class="si-stat"><div class="si-stat-val">${lyRows.length}</div><div class="si-stat-label">Lines</div></div>
      <div class="si-stat"><div class="si-stat-val si-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Net Sales</div></div>
      <div class="si-stat"><div class="si-stat-val si-profit">₱${profit.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Gross Profit</div></div>
    </div>
    <div class="si-date-range">📅 &nbsp;${dr}${refundCount>0?' &nbsp;·&nbsp; <span style="color:#C62828">'+refundCount+' refund line'+(refundCount!==1?'s':'')+' included</span>':''}</div>`;

  // ── SKU mismatch warning banner ────────────────────────────────────
  if(unknownSkus.length){
    const skuItems = unknownSkus.map(s=>{
      const lines    = lyRows.filter(r=>r.sku===s);
      const itemName = lines[0]?.item || '—';
      const netQty   = lines.reduce((sum,r)=>sum+r.qty,0);
      return `<div class="ly-sku-warn-item"><strong>${s}</strong> — ${itemName} <span class="ly-sku-warn-qty">(net qty: ${netQty})</span></div>`;
    }).join('');
    html+=`<div class="ly-sku-warn-wrap">
      <div class="ly-sku-warn-title">⚠ ${unknownSkus.length} SKU${unknownSkus.length!==1?'s':''} not found in Retail SKU Master</div>
      <div class="ly-sku-warn-sub">These Loyverse SKU codes don't match any item in your app's Retail SKU Master. Sales will still be logged, but stock won't be deducted for these items. Update the SKU Master first if needed.</div>
      <div class="ly-sku-warn-list">${skuItems}</div>
    </div>`;
  }

  html+=`<div class="si-table-wrap">
      <table class="si-table">
        <thead><tr><th>Receipt</th><th>Date</th><th>Time</th><th>SKU</th><th>Item</th><th>Variant</th><th>Qty</th><th>Net Sales</th><th>Profit</th><th>Cashier</th></tr></thead>
        <tbody>`;

  lyRows.forEach(r=>{
    const isRefund = r.receiptType.toLowerCase().includes('refund');
    html+=`<tr${isRefund?' style="background:#FFF5F5"':''}>
      <td>${r.receiptNumber}</td>
      <td class="si-nowrap">${r.date}</td>
      <td class="si-nowrap">${r.time}</td>
      <td><strong>${r.sku}</strong></td>
      <td>${r.item}</td>
      <td>${r.variant||'—'}</td>
      <td>${r.qty}</td>
      <td class="si-num ${isRefund?'si-red':'si-green'}">₱${r.netSales.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td class="si-num si-profit">₱${r.grossProfit.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td>${r.cashier}</td>
    </tr>`;
  });
  html+=`</tbody></table></div>`;
  area.innerHTML = html;
  document.getElementById('ly-confirm-btn').style.display='block';
  setLyStatus(`✓ ${lyRows.length} line items across ${receipts.length} receipts ready to import.`,'ok');
}

// ── Confirm ───────────────────────────────────────────
async function confirmLyImport(){
  if(!lyRows.length) return;
  const btn = document.getElementById('ly-confirm-btn');
  btn.disabled=true; btn.textContent='Importing…';
  setLyStatus('Sending to Google Sheets…','ok');
  try{
    const r = await api({action:'importLoyverseSales', rows:lyRows, importedBy:currentUser.username});
    if(r.status==='ok'){
      const stockNote = r.stockUpdated > 0 ? ` Stock updated for ${r.stockUpdated} SKU${r.stockUpdated!==1?'s':''}.` : '';
      setLyStatus(`✅ Done — ${r.imported} new rows added, ${r.skipped} duplicate${r.skipped!==1?'s':''} skipped.${stockNote}`,'ok');
      btn.style.display='none'; lyRows=[];
      document.getElementById('ly-file-input').value='';
      document.getElementById('ly-preview-area').innerHTML='';
      // Refresh product list data in background so low-stock badge updates
      if(typeof loadPLData === 'function') loadPLData();
    } else {
      setLyStatus('Import failed: '+(r.msg||'Unknown error'),'error');
      btn.disabled=false; btn.textContent='Confirm & Import';
    }
  }catch(e){
    setLyStatus('Import failed: '+e.message,'error');
    btn.disabled=false; btn.textContent='Confirm & Import';
  }
}

function setLyStatus(msg,type){
  const el=document.getElementById('ly-status'); if(!el) return;
  el.textContent=msg;
  el.className='si-status'+(type==='error'?' si-status-error':type==='ok'?' si-status-ok':'');
}


// ════════════════════════════════════════════════════════
// SHARED UTILITY
// ════════════════════════════════════════════════════════
function parseSiLine(line){
  const result=[]; let current=''; let inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ inQuotes=!inQuotes; }
    else if(ch===','&&!inQuotes){ result.push(current.trim()); current=''; }
    else { current+=ch; }
  }
  result.push(current.trim());
  return result;
}
