// ══════════════════════════════════════════════════════════════
// SKU ADD REQUEST SYSTEM
// Staff / drivers submit requests.
// Admins approve (SKU written to master sheet) or reject.
// Production item fields are shown only for RETAIL segment.
// ══════════════════════════════════════════════════════════════

let _skuReqPending    = [];   // pending requests cache (admin)
let _skuApproveTarget = null; // request currently being approved

// ── STAFF: SHOW / HIDE HELPERS ────────────────────────────────
function _skureqUpdateCatList(){
  const seg = document.getElementById('skureq-segment')?.value || 'DIST';

  // Category suggestions filtered by segment
  const cats = [...new Set(
    liveSKUs.filter(s => s.type === seg).map(s => s.category)
  )].sort();
  const dl = document.getElementById('skureq-cat-list');
  if(dl) dl.innerHTML = cats.map(c => '<option value="' + c + '">').join('');

  // Show retail-specific fields only for RETAIL
  const retailFields = document.getElementById('skureq-retail-fields');
  if(retailFields) retailFields.style.display = seg === 'RETAIL' ? 'block' : 'none';

  // If switching away from RETAIL, clear and hide production fields
  if(seg !== 'RETAIL'){
    const isProd = document.getElementById('skureq-is-prod');
    if(isProd) isProd.checked = false;
    const prodFields = document.getElementById('skureq-prod-fields');
    if(prodFields) prodFields.style.display = 'none';
  }
}

function _skureqToggleProdFields(){
  const checked = document.getElementById('skureq-is-prod')?.checked;
  const prodFields = document.getElementById('skureq-prod-fields');
  if(prodFields) prodFields.style.display = checked ? 'block' : 'none';
  if(!checked){
    // Clear fields when unchecked
    ['skureq-related-sku','skureq-ratio'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
  }
}

// ── STAFF: OPEN / CLOSE / SUBMIT ─────────────────────────────
function openSKURequestModal(){
  // Populate category suggestions
  const cats = [...new Set(liveSKUs.map(s => s.category))].sort();
  const dl = document.getElementById('skureq-cat-list');
  if(dl) dl.innerHTML = cats.map(c => '<option value="' + c + '">').join('');

  // Reset all fields
  document.getElementById('skureq-segment').value = 'DIST';
  ['skureq-cat','skureq-name','skureq-code','skureq-supplier',
   'skureq-unit','skureq-related-sku','skureq-ratio','skureq-notes']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  const isProd = document.getElementById('skureq-is-prod');
  if(isProd) isProd.checked = false;

  // Apply initial show/hide state
  _skureqUpdateCatList();
  const prodFields = document.getElementById('skureq-prod-fields');
  if(prodFields) prodFields.style.display = 'none';

  document.getElementById('skureq-err').textContent = '';
  const btn = document.getElementById('skureq-submit-btn');
  if(btn){ btn.disabled = false; btn.textContent = '📥 Submit Request'; }

  document.getElementById('sku-req-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('skureq-name')?.focus(), 120);
}

function closeSKURequestModal(){
  document.getElementById('sku-req-modal').style.display = 'none';
}

async function submitSKURequest(){
  const segment  = document.getElementById('skureq-segment').value;
  const cat      = document.getElementById('skureq-cat').value.trim();
  const name     = document.getElementById('skureq-name').value.trim();
  const code     = document.getElementById('skureq-code').value.trim();
  const supplier = document.getElementById('skureq-supplier').value.trim();
  const notes    = document.getElementById('skureq-notes').value.trim();
  const errEl    = document.getElementById('skureq-err');

  // Retail-specific fields
  const unit       = segment === 'RETAIL' ? (document.getElementById('skureq-unit')?.value.trim()       || '') : '';
  const isProd     = segment === 'RETAIL' && (document.getElementById('skureq-is-prod')?.checked         || false);
  const prodType   = isProd ? (document.getElementById('skureq-prod-type')?.value    || 'disassemble') : '';
  const relatedSku = isProd ? (document.getElementById('skureq-related-sku')?.value.trim() || '')        : '';
  const ratio      = isProd ? (document.getElementById('skureq-ratio')?.value.trim() || '')               : '';

  errEl.textContent = '';
  if(!cat)  { errEl.textContent = 'Category is required.'; return; }
  if(!name) { errEl.textContent = 'Item name is required.'; return; }
  if(isProd && !relatedSku){ errEl.textContent = 'Related SKU code is required for production items.'; return; }
  if(isProd && !ratio)     { errEl.textContent = 'Standard ratio is required for production items.'; return; }

  const btn = document.getElementById('skureq-submit-btn');
  btn.disabled = true; btn.textContent = 'Submitting…';

  try{
    const r = await api({
      action:   'submitSKURequest',
      segment, category: cat, name, code, supplier, notes,
      unit, isProd: isProd ? 'YES' : 'NO',
      prodType, relatedSku, ratio,
      requestedBy: currentUser.username
    });
    if(r.status === 'ok'){
      closeSKURequestModal();
      showToast(name + ' request submitted — admin will review it shortly', 'success', 5000);
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Could not submit');
      btn.disabled = false; btn.textContent = '📥 Submit Request';
    }
  }catch(e){
    errEl.textContent = 'Network error: ' + e.message;
    btn.disabled = false; btn.textContent = '📥 Submit Request';
  }
}

// ── ADMIN: LOAD & RENDER ──────────────────────────────────────
async function loadPendingSKURequests(){
  try{
    const r = await api({ action: 'getSKURequests' });
    if(r.status === 'ok'){
      _skuReqPending = r.requests || [];
      renderPendingSKURequests();
      const badge = document.getElementById('skureq-admin-badge');
      if(badge){
        if(_skuReqPending.length){
          badge.textContent = _skuReqPending.length;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  }catch(e){ console.error('loadPendingSKURequests', e); }
}

function renderPendingSKURequests(){
  const body = document.getElementById('sku-req-list');
  if(!body) return;

  if(!_skuReqPending.length){
    body.innerHTML = '<div class="empty-state">No pending item requests.</div>';
    return;
  }

  body.innerHTML = '';
  _skuReqPending.forEach(req => {
    const segBadge = req.segment === 'DIST'
      ? '<span class="skureq-seg-badge skureq-seg-dist">DIST</span>'
      : '<span class="skureq-seg-badge skureq-seg-retail">RETAIL</span>';
    const prodBadge = req.isProd === 'YES'
      ? '<span class="skureq-seg-badge" style="background:#E8F5E9;color:#1B5E20;margin-left:2px">🏭 Production</span>'
      : '';

    const row = document.createElement('div');
    row.className = 'skureq-admin-row';
    row.innerHTML =
      '<div class="skureq-admin-info">'
        + '<div class="skureq-admin-name">' + req.name + ' ' + segBadge + prodBadge + '</div>'
        + '<div class="skureq-admin-cat">' + req.category
          + (req.supplier ? ' · ' + req.supplier : '')
          + (req.unit ? ' · Unit: ' + req.unit : '')
          + '</div>'
        + (req.code ? '<div class="skureq-admin-meta">Suggested code: <strong>' + req.code + '</strong></div>' : '')
        + (req.isProd === 'YES'
            ? '<div class="skureq-admin-meta" style="color:#0A5C46">⚙️ '
              + (req.prodType === 'assemble' ? 'Build Up' : 'Break Down')
              + ' · Related SKU: <strong>' + (req.relatedSku || '—') + '</strong>'
              + ' · Ratio: <strong>' + (req.ratio || '—') + '</strong></div>'
            : '')
        + (req.notes ? '<div class="skureq-admin-notes">"' + req.notes + '"</div>' : '')
        + '<div class="skureq-admin-meta">By ' + req.requestedBy + ' · ' + req.requestedAt + '</div>'
      + '</div>'
      + '<div class="skureq-admin-actions">'
        + '<button class="skureq-approve-btn" onclick="openApproveSKUModal(\'' + req.requestId + '\')">✓ Approve</button>'
        + '<button class="skureq-reject-btn"  onclick="rejectSKURequest(\'' + req.requestId + '\')">✕</button>'
      + '</div>';
    body.appendChild(row);
  });
}

// ── ADMIN: APPROVE MODAL HELPERS ─────────────────────────────
function _skuApproveToggleProdFields(){
  const checked = document.getElementById('sku-approve-is-prod')?.checked;
  const prodFields = document.getElementById('sku-approve-prod-fields');
  if(prodFields) prodFields.style.display = checked ? 'block' : 'none';
}

// ── ADMIN: OPEN APPROVE MODAL ────────────────────────────────
function openApproveSKUModal(requestId){
  const req = _skuReqPending.find(r => r.requestId === requestId);
  if(!req) return;
  _skuApproveTarget = req;

  const isRetail = req.segment === 'RETAIL';
  document.getElementById('sku-approve-seg-label').textContent =
    isRetail ? 'Retail SKU Master' : 'Distribution SKU Master';

  // Core fields
  document.getElementById('sku-approve-code').value     = req.code     || '';
  document.getElementById('sku-approve-name').value     = req.name;
  document.getElementById('sku-approve-cat').value      = req.category;
  document.getElementById('sku-approve-supplier').value = req.supplier  || '';

  // Retail-specific
  const retailFields = document.getElementById('sku-approve-retail-fields');
  if(retailFields) retailFields.style.display = isRetail ? 'block' : 'none';

  if(isRetail){
    document.getElementById('sku-approve-unit').value = req.unit || '';

    const isProdChecked = req.isProd === 'YES';
    const isProdEl = document.getElementById('sku-approve-is-prod');
    if(isProdEl) isProdEl.checked = isProdChecked;

    const prodFields = document.getElementById('sku-approve-prod-fields');
    if(prodFields) prodFields.style.display = isProdChecked ? 'block' : 'none';

    if(isProdChecked){
      document.getElementById('sku-approve-prod-type').value   = req.prodType   || 'disassemble';
      document.getElementById('sku-approve-related-sku').value = req.relatedSku || '';
      document.getElementById('sku-approve-ratio').value       = req.ratio      || '';
    }
  }

  document.getElementById('sku-approve-err').textContent = '';
  const btn = document.getElementById('sku-approve-confirm-btn');
  if(btn){ btn.disabled = false; btn.textContent = '✓ Add to SKU Master'; }

  document.getElementById('sku-approve-modal').style.display = 'flex';
  setTimeout(() => document.getElementById('sku-approve-code')?.focus(), 120);
}

function closeApproveSKUModal(){
  document.getElementById('sku-approve-modal').style.display = 'none';
  _skuApproveTarget = null;
}

async function confirmApproveSKU(){
  if(!_skuApproveTarget) return;
  const isRetail = _skuApproveTarget.segment === 'RETAIL';

  const code     = document.getElementById('sku-approve-code').value.trim();
  const name     = document.getElementById('sku-approve-name').value.trim();
  const cat      = document.getElementById('sku-approve-cat').value.trim();
  const supplier = document.getElementById('sku-approve-supplier').value.trim();
  const errEl    = document.getElementById('sku-approve-err');

  // Retail-specific reads
  const unit       = isRetail ? (document.getElementById('sku-approve-unit')?.value.trim()       || 'bag') : '';
  const isProd     = isRetail && (document.getElementById('sku-approve-is-prod')?.checked         || false);
  const prodType   = isProd ? (document.getElementById('sku-approve-prod-type')?.value || 'disassemble') : '';
  const relatedSku = isProd ? (document.getElementById('sku-approve-related-sku')?.value.trim() || '') : '';
  const ratio      = isProd ? (parseFloat(document.getElementById('sku-approve-ratio')?.value) || 0) : 0;

  errEl.textContent = '';
  if(!code){ errEl.textContent = 'SKU code is required before adding to the master.'; return; }
  if(!name){ errEl.textContent = 'Item name is required.'; return; }
  if(!cat) { errEl.textContent = 'Category is required.'; return; }
  if(isProd && !relatedSku){ errEl.textContent = 'Related SKU code is required for production items.'; return; }
  if(isProd && !ratio)     { errEl.textContent = 'Standard ratio is required for production items.'; return; }

  const btn = document.getElementById('sku-approve-confirm-btn');
  btn.disabled = true; btn.textContent = 'Adding to master…';

  try{
    const r = await api({
      action:    'resolveSKURequest',
      requestId: _skuApproveTarget.requestId,
      approve:   true,
      segment:   _skuApproveTarget.segment,
      code, name, category: cat, supplier,
      unit, isProd: isProd ? 'YES' : 'NO',
      prodType, relatedSku, ratio,
      resolvedBy: currentUser.username
    });
    if(r.status === 'ok'){
      // Update liveSKUs cache immediately
      liveSKUs.push({
        code, name, category: cat, supplier,
        type: _skuApproveTarget.segment,
        cost: 0, order: 9999
      });
      rebuildSKUData();
      buildBoDropdown();

      _skuReqPending = _skuReqPending.filter(req => req.requestId !== _skuApproveTarget.requestId);
      showToast(name + ' added to ' + _skuApproveTarget.segment + ' SKU Master ✓', 'success');
      closeApproveSKUModal();
      renderPendingSKURequests();
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Could not approve');
      btn.disabled = false; btn.textContent = '✓ Add to SKU Master';
    }
  }catch(e){
    errEl.textContent = 'Network error: ' + e.message;
    btn.disabled = false; btn.textContent = '✓ Add to SKU Master';
  }
}

// ── ADMIN: REJECT ─────────────────────────────────────────────
async function rejectSKURequest(requestId){
  const req = _skuReqPending.find(r => r.requestId === requestId);
  if(!req) return;
  if(!confirm('Reject the request for "' + req.name + '"?\nThe requester can be informed separately.')) return;

  try{
    const r = await api({
      action: 'resolveSKURequest',
      requestId, approve: false,
      resolvedBy: currentUser.username
    });
    if(r.status === 'ok'){
      _skuReqPending = _skuReqPending.filter(req => req.requestId !== requestId);
      renderPendingSKURequests();
      showToast('Request rejected', 'info');
    } else {
      alert('Error: ' + (r.msg || 'Could not reject'));
    }
  }catch(e){ alert('Network error: ' + e.message); }
}
