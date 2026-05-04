// ════════════════════════════════════════════════════════
// XERO SALES IMPORT
// ════════════════════════════════════════════════════════
let xiRows = [];   // parsed + validated rows ready for import

function openXeroImport(){
  showScreen('xero-import-screen');
  updateFabVisibility();
  xiRows = [];
  document.getElementById('xi-file-input').value = '';
  document.getElementById('xi-preview-area').innerHTML = '';
  document.getElementById('xi-confirm-btn').style.display = 'none';
  document.getElementById('xi-drop-zone').classList.remove('xi-drop-active');
  setXiStatus('', '');
}

function closeXeroImport(){ showHome(); }

// ── FILE INPUT / DRAG-DROP ────────────────────────────────
function onXiFileSelect(input){
  const file = input.files[0];
  if(file) readXiFile(file);
}

function onXiDragOver(e){
  e.preventDefault();
  document.getElementById('xi-drop-zone').classList.add('xi-drop-active');
}

function onXiDragLeave(){
  document.getElementById('xi-drop-zone').classList.remove('xi-drop-active');
}

function onXiDrop(e){
  e.preventDefault();
  document.getElementById('xi-drop-zone').classList.remove('xi-drop-active');
  const file = e.dataTransfer.files[0];
  if(file) readXiFile(file);
}

function readXiFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){
    setXiStatus('Please select a CSV file exported from Xero.', 'error');
    return;
  }
  setXiStatus('Reading file...', 'ok');
  const reader = new FileReader();
  reader.onload = e => parseXiCSV(e.target.result);
  reader.readAsText(file);
}

// ── CSV PARSER ────────────────────────────────────────────
function parseXiCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2){
    setXiStatus('File appears empty.', 'error');
    return;
  }

  const headers = parseXiLine(lines[0]);

  // Map column names to indices
  const col = {};
  const needed = {
    contact:     'ContactName',
    invoiceNum:  'InvoiceNumber',
    invoiceDate: 'InvoiceDate',
    dueDate:     'DueDate',
    total:       'Total',
    amountPaid:  'InvoiceAmountPaid',
    amountDue:   'InvoiceAmountDue',
    skuCode:     'InventoryItemCode',
    description: 'Description',
    quantity:    'Quantity',
    unitAmount:  'UnitAmount',
    lineAmount:  'LineAmount',
    status:      'Status',
    type:        'Type',
  };
  Object.entries(needed).forEach(([key, colName])=>{
    col[key] = headers.indexOf(colName);
  });

  // Validate that it's a Xero export
  if(col.invoiceNum < 0 || col.skuCode < 0){
    setXiStatus('This doesn\'t look like a Xero Sales Invoice export. Export from Accounts → Sales Invoices in Xero and try again.', 'error');
    return;
  }

  xiRows = [];
  lines.slice(1).forEach(line=>{
    if(!line.trim()) return;
    const r = parseXiLine(line);

    // Only process sales invoices, skip voided/deleted
    const type   = String(r[col.type]   || '').toLowerCase();
    const status = String(r[col.status] || '').toLowerCase();
    if(!type.includes('invoice')) return;
    if(status === 'voided' || status === 'deleted') return;

    // Skip lines with no SKU code (freight, header-only rows, etc.)
    const skuCode = String(r[col.skuCode] || '').trim();
    if(!skuCode) return;

    xiRows.push({
      invoiceNumber: String(r[col.invoiceNum]  || '').trim(),
      invoiceDate:   String(r[col.invoiceDate] || '').trim(),
      dueDate:       String(r[col.dueDate]     || '').trim(),
      contactName:   String(r[col.contact]     || '').trim(),
      skuCode,
      description:   String(r[col.description] || '').trim(),
      quantity:      parseFloat(r[col.quantity])   || 0,
      unitAmount:    parseFloat(r[col.unitAmount]) || 0,
      lineAmount:    parseFloat(r[col.lineAmount]) || 0,
      invoiceTotal:  parseFloat(r[col.total])      || 0,
      amountPaid:    parseFloat(r[col.amountPaid]) || 0,
      amountDue:     parseFloat(r[col.amountDue])  || 0,
      status:        String(r[col.status] || '').trim(),
    });
  });

  if(!xiRows.length){
    setXiStatus('No valid sales invoice line items found. Check that your export includes line-item detail.', 'error');
    return;
  }

  renderXiPreview();
}

// Proper CSV line parser — handles quoted fields with commas
function parseXiLine(line){
  const result = [];
  let current = '';
  let inQuotes = false;
  for(let i = 0; i < line.length; i++){
    const ch = line[i];
    if(ch === '"'){
      inQuotes = !inQuotes;
    } else if(ch === ',' && !inQuotes){
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ── PREVIEW RENDERER ──────────────────────────────────────
function renderXiPreview(){
  const area = document.getElementById('xi-preview-area');

  const invoices = [...new Set(xiRows.map(r=>r.invoiceNumber))];
  const dealers  = [...new Set(xiRows.map(r=>r.contactName))];
  const revenue  = xiRows.reduce((s,r)=>s+r.lineAmount, 0);
  const dates    = xiRows.map(r=>r.invoiceDate).filter(Boolean).sort();
  const dateRange = dates.length
    ? (dates[0] === dates[dates.length-1] ? dates[0] : dates[0] + ' – ' + dates[dates.length-1])
    : '—';

  let html = `
    <div class="xi-summary-grid">
      <div class="xi-stat">
        <div class="xi-stat-val">${invoices.length}</div>
        <div class="xi-stat-label">Invoices</div>
      </div>
      <div class="xi-stat">
        <div class="xi-stat-val">${xiRows.length}</div>
        <div class="xi-stat-label">Line Items</div>
      </div>
      <div class="xi-stat">
        <div class="xi-stat-val">${dealers.length}</div>
        <div class="xi-stat-label">Dealers</div>
      </div>
      <div class="xi-stat">
        <div class="xi-stat-val xi-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
        <div class="xi-stat-label">Total Revenue</div>
      </div>
    </div>
    <div class="xi-date-range">📅 &nbsp;${dateRange}</div>
    <div class="xi-table-wrap">
      <table class="xi-table">
        <thead><tr>
          <th>Invoice</th><th>Date</th><th>Dealer</th>
          <th>SKU</th><th>Description</th>
          <th>Qty</th><th>Unit ₱</th><th>Amount</th><th>Status</th>
        </tr></thead>
        <tbody>`;

  xiRows.forEach(r=>{
    const sc = r.status.toLowerCase().includes('paid') ? 'xi-badge-paid'
             : r.status.toLowerCase().includes('awaiting') ? 'xi-badge-awaiting'
             : '';
    html += `<tr>
      <td>${r.invoiceNumber}</td>
      <td class="xi-nowrap">${r.invoiceDate}</td>
      <td>${r.contactName}</td>
      <td><strong>${r.skuCode}</strong></td>
      <td>${r.description}</td>
      <td>${r.quantity}</td>
      <td class="xi-num">₱${r.unitAmount.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td class="xi-num xi-green">₱${r.lineAmount.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td><span class="xi-badge ${sc}">${r.status}</span></td>
    </tr>`;
  });

  html += `</tbody></table></div>`;
  area.innerHTML = html;

  document.getElementById('xi-confirm-btn').style.display = 'block';
  setXiStatus(`✓ ${xiRows.length} line items across ${invoices.length} invoices ready to import.`, 'ok');
}

// ── CONFIRM IMPORT ────────────────────────────────────────
async function confirmXiImport(){
  if(!xiRows.length) return;
  const btn = document.getElementById('xi-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Importing…';
  setXiStatus('Sending to Google Sheets…', 'ok');

  try{
    const r = await api({
      action:     'importXeroSales',
      rows:       xiRows,
      importedBy: currentUser.username
    });
    if(r.status === 'ok'){
      const msg = `✅ Import complete — ${r.imported} new rows added, ${r.skipped} duplicate${r.skipped!==1?'s':''} skipped.`;
      setXiStatus(msg, 'ok');
      btn.style.display = 'none';
      xiRows = [];
      document.getElementById('xi-file-input').value = '';
      document.getElementById('xi-preview-area').innerHTML = '';
    } else {
      setXiStatus('Import failed: ' + (r.msg || 'Unknown error'), 'error');
      btn.disabled = false;
      btn.textContent = 'Confirm & Import';
    }
  }catch(e){
    setXiStatus('Import failed: ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Confirm & Import';
  }
}

function setXiStatus(msg, type){
  const el = document.getElementById('xi-status');
  if(!el) return;
  el.textContent = msg;
  el.className = 'xi-status' + (type === 'error' ? ' xi-status-error' : type === 'ok' ? ' xi-status-ok' : '');
}
