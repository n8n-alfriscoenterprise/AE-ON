// ════════════════════════════════════════════════════════
// SUPPLIER MANAGEMENT
// Admin + PO staff can view and edit.
// Supplier data backs the PO creation dropdown and
// auto-fills payment defaults at approval.
// ════════════════════════════════════════════════════════
let supFilter       = 'All';   // 'All' | 'DIST' | 'RETAIL' | 'BOTH'
let editingSupplier = null;    // null = add mode, string = original name (edit mode)

async function openSuppliers(){
  showScreen('suppliers-screen');
  updateFabVisibility();
  supplierList = []; // force fresh load
  document.getElementById('suppliers-body').innerHTML = '<div class="pl-empty">Loading suppliers...</div>';
  await loadSuppliers();
  renderSupplierList();
}

function closeSuppliers(){ showHome(); }

function setSupplierFilter(f, el){
  supFilter = f;
  document.querySelectorAll('.sup-tab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  renderSupplierList();
}

function renderSupplierList(){
  const body = document.getElementById('suppliers-body');
  const visible = supFilter === 'All'
    ? supplierList
    : supplierList.filter(s => s.type === supFilter || s.type === 'BOTH');

  if(!visible.length){
    body.innerHTML = '<div class="pl-empty">No suppliers yet. Tap + Add Supplier to get started.</div>';
    return;
  }

  const typeStyle = {
    DIST:  { bg:'#EDE0F5', color:'#7B2D8B' },
    RETAIL:{ bg:'#FFF3DC', color:'#C07000' },
    BOTH:  { bg:'#E3EEF9', color:'#1A3A5C' }
  };

  body.innerHTML = '';
  visible.forEach((sup, i)=>{
    const ts  = typeStyle[sup.type] || typeStyle.DIST;
    const row = document.createElement('div');
    row.className = 'sup-row';

    const termsLabel = sup.defTerms === '0' ? 'Upon Delivery'
      : sup.defTerms ? sup.defTerms + ' days' : '';
    const metaParts = [
      sup.contact     ? sup.contact                           : '',
      sup.defPayMode  ? sup.defPayMode                        : '',
      termsLabel      ? termsLabel                            : '',
    ].filter(Boolean);
    const meta2Parts = [
      sup.deliveryDay ? '📅 ' + sup.deliveryDay               : '',
      sup.leadTime    ? '⏱ '  + sup.leadTime                  : '',
      sup.notes       ? sup.notes                             : '',
    ].filter(Boolean);

    row.innerHTML = `
      <div class="sup-info">
        <div class="sup-name-row">
          <span class="sup-name">${sup.name}</span>
          <span class="sup-type-badge" style="background:${ts.bg};color:${ts.color}">${sup.type}</span>
        </div>
        ${metaParts.length  ? '<div class="sup-meta">'  + metaParts.map(p=>`<span class="sup-chip">${p}</span>`).join('') + '</div>' : ''}
        ${meta2Parts.length ? '<div class="sup-meta2">' + meta2Parts.join(' · ') + '</div>' : ''}
      </div>
      <div class="sup-actions">
        <button class="sup-edit-btn" onclick="openEditSupplierModal(${i})">Edit</button>
        <button class="sup-del-btn"  onclick="removeSupplierConfirm('${sup.name.replace(/'/g,"\\'")}')">×</button>
      </div>`;
    body.appendChild(row);
  });
}

// ── ADD / EDIT MODAL ──────────────────────────────────
function openAddSupplierModal(){
  editingSupplier = null;
  document.getElementById('sup-modal-title').textContent = 'Add Supplier';
  ['sup-name','sup-contact','sup-delivery-day','sup-lead-time','sup-notes']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('sup-type').value     = 'DIST';
  document.getElementById('sup-pay-mode').value = '';
  document.getElementById('sup-terms').value    = '';
  document.getElementById('sup-modal-err').textContent = '';
  document.getElementById('sup-save-btn').disabled    = false;
  document.getElementById('sup-save-btn').textContent = 'Add Supplier';
  document.getElementById('supplier-modal').style.display = 'flex';
}

function openEditSupplierModal(i){
  const visible = supFilter === 'All'
    ? supplierList
    : supplierList.filter(s => s.type === supFilter || s.type === 'BOTH');
  const sup = visible[i];
  if(!sup) return;
  editingSupplier = sup.name;

  document.getElementById('sup-modal-title').textContent = 'Edit Supplier';
  document.getElementById('sup-name').value         = sup.name;
  document.getElementById('sup-type').value         = sup.type        || 'DIST';
  document.getElementById('sup-contact').value      = sup.contact     || '';
  document.getElementById('sup-pay-mode').value     = sup.defPayMode  || '';
  document.getElementById('sup-terms').value        = sup.defTerms    || '';
  document.getElementById('sup-delivery-day').value = sup.deliveryDay || '';
  document.getElementById('sup-lead-time').value    = sup.leadTime    || '';
  document.getElementById('sup-notes').value        = sup.notes       || '';
  document.getElementById('sup-modal-err').textContent = '';
  document.getElementById('sup-save-btn').disabled    = false;
  document.getElementById('sup-save-btn').textContent = 'Save Changes';
  document.getElementById('supplier-modal').style.display = 'flex';
}

function closeSupplierModal(){
  document.getElementById('supplier-modal').style.display = 'none';
  editingSupplier = null;
}

async function saveSupplier(){
  const name        = document.getElementById('sup-name').value.trim();
  const type        = document.getElementById('sup-type').value;
  const contact     = document.getElementById('sup-contact').value.trim();
  const defPayMode  = document.getElementById('sup-pay-mode').value;
  const defTerms    = document.getElementById('sup-terms').value;
  const deliveryDay = document.getElementById('sup-delivery-day').value.trim();
  const leadTime    = document.getElementById('sup-lead-time').value.trim();
  const notes       = document.getElementById('sup-notes').value.trim();
  const errEl       = document.getElementById('sup-modal-err');
  const btn         = document.getElementById('sup-save-btn');

  if(!name){ errEl.textContent = 'Supplier name is required.'; return; }

  btn.disabled = true;
  btn.textContent = 'Saving...';
  errEl.textContent = '';

  const payload = Object.assign(
    { action: editingSupplier ? 'updateSupplier' : 'addSupplier' },
    editingSupplier ? { originalName: editingSupplier } : {},
    { name, type, contact, defPayMode, defTerms, deliveryDay, leadTime, notes }
  );

  try{
    const r = await api(payload);
    if(r.status === 'ok'){
      if(editingSupplier){
        const idx = supplierList.findIndex(s=>s.name===editingSupplier);
        if(idx>=0) supplierList[idx] = { name, type, contact, defPayMode, defTerms, deliveryDay, leadTime, notes };
      } else {
        supplierList.push({ name, type, contact, defPayMode, defTerms, deliveryDay, leadTime, notes });
      }
      closeSupplierModal();
      renderSupplierList();
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Could not save');
      btn.disabled = false;
      btn.textContent = editingSupplier ? 'Save Changes' : 'Add Supplier';
    }
  } catch(e){
    errEl.textContent = 'Network error: ' + e.message;
    btn.disabled = false;
    btn.textContent = editingSupplier ? 'Save Changes' : 'Add Supplier';
  }
}

async function removeSupplierConfirm(name){
  if(!confirm('Remove ' + name + '?\nExisting POs will not be affected.')) return;
  try{
    const r = await api({ action:'removeSupplier', name });
    if(r.status === 'ok'){
      supplierList = supplierList.filter(s=>s.name!==name);
      renderSupplierList();
    } else {
      alert('Error: ' + (r.msg||'Could not remove'));
    }
  } catch(e){ alert('Network error: ' + e.message); }
}
