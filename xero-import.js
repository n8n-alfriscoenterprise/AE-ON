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
    status:'Status', type:'Type'
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
      status:        String(r[col.status]||'').trim()
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

  let html = `
    <div class="si-summary-grid">
      <div class="si-stat"><div class="si-stat-val">${invoices.length}</div><div class="si-stat-label">Invoices</div></div>
      <div class="si-stat"><div class="si-stat-val">${xiRows.length}</div><div class="si-stat-label">Lines</div></div>
      <div class="si-stat"><div class="si-stat-val">${dealers.length}</div><div class="si-stat-label">Dealers</div></div>
      <div class="si-stat"><div class="si-stat-val si-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Revenue</div></div>
    </div>
    <div class="si-date-range">📅 &nbsp;${dr}</div>
    <div class="si-table-wrap">
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

// ── Confirm ───────────────────────────────────────────
async function confirmXiImport(){
  if(!xiRows.length) return;
  const btn = document.getElementById('xi-confirm-btn');
  btn.disabled=true; btn.textContent='Importing…';
  setXiStatus('Sending to Google Sheets…','ok');
  try{
    const r = await api({action:'importXeroSales', rows:xiRows, importedBy:currentUser.username});
    if(r.status==='ok'){
      setXiStatus(`✅ Done — ${r.imported} new rows added, ${r.skipped} duplicate${r.skipped!==1?'s':''} skipped.`,'ok');
      btn.style.display='none'; xiRows=[];
      document.getElementById('xi-file-input').value='';
      document.getElementById('xi-preview-area').innerHTML='';
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

  let html = `
    <div class="si-summary-grid">
      <div class="si-stat"><div class="si-stat-val">${receipts.length}</div><div class="si-stat-label">Receipts</div></div>
      <div class="si-stat"><div class="si-stat-val">${lyRows.length}</div><div class="si-stat-label">Lines</div></div>
      <div class="si-stat"><div class="si-stat-val si-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Net Sales</div></div>
      <div class="si-stat"><div class="si-stat-val si-profit">₱${profit.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Gross Profit</div></div>
    </div>
    <div class="si-date-range">📅 &nbsp;${dr}${refundCount>0?' &nbsp;·&nbsp; <span style="color:#C62828">'+refundCount+' refund line'+(refundCount!==1?'s':'')+' included</span>':''}</div>
    <div class="si-table-wrap">
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
      setLyStatus(`✅ Done — ${r.imported} new rows added, ${r.skipped} duplicate${r.skipped!==1?'s':''} skipped.`,'ok');
      btn.style.display='none'; lyRows=[];
      document.getElementById('ly-file-input').value='';
      document.getElementById('ly-preview-area').innerHTML='';
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
