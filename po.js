function generatePONumber(){
  const d=new Date();const date=d.getFullYear().toString()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const todayPOs=poList.filter(p=>p.poNumber&&p.poNumber.includes(date));
  return 'PO-'+date+'-'+String(todayPOs.length+1).padStart(3,'0');
}

// Shared date formatter — handles ISO "2026-05-06 08:38:13" and raw Date strings
function fmtPODate(d){
  if(!d) return '';
  const dt = new Date(String(d).replace(' ','T'));
  return isNaN(dt) ? d : dt.toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}

async function openPO(){
  showScreen('po-screen');updateFabVisibility();
  showPOSubtab('list',document.getElementById('po-tab-list'));
  await Promise.all([loadPOs(), loadSuppliers()]);
  // Proactive receipt reminder — show after list loads
  const needReceipt = poList.filter(p=>p.status==='APPROVED'||p.status==='PARTIAL');
  if(needReceipt.length){
    showToast(
      needReceipt.length === 1
        ? '1 approved PO is waiting to be received'
        : needReceipt.length + ' approved POs are waiting to be received',
      'warning', 5000
    );
  }
}

async function loadSuppliers(){
  if(supplierList.length) return; // already loaded this session
  try{
    const r=await api({action:'getSuppliers'});
    if(r.status==='ok') supplierList=r.suppliers||[];
  }catch(e){console.error('loadSuppliers failed',e);}
}

function closePO(){showHome();}

function showPOSubtab(tab,el){
  document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  document.getElementById('po-view-list').style.display=tab==='list'?'flex':'none';
  document.getElementById('po-view-create').style.display=tab==='create'?'flex':'none';
  document.getElementById('po-view-detail').style.display=tab==='detail'?'flex':'none';
  if(tab==='create')initPOCreate();
  if(tab==='list')loadPOs();
}

async function loadPOs(){
  try{
    const r=await api({action:'getPOs'});
    if(r.status==='ok'){poList=r.pos||[];buildPOStatusChips();renderPOList();
      const pending=poList.filter(p=>p.status==='PENDING').length;
      const badge=document.getElementById('po-pending-badge');
      if(badge){badge.textContent=pending;badge.style.display=pending>0?'block':'none';}
    }
  }catch(e){document.getElementById('po-list-body').innerHTML='<div class="po-list-empty">Could not load POs.</div>';}
}

async function loadPendingBadge(){
  try{const r=await api({action:'getPOs'});if(r.status==='ok'){poList=r.pos||[];const pending=poList.filter(p=>p.status==='PENDING').length;const badge=document.getElementById('po-pending-badge');if(badge){badge.textContent=pending;badge.style.display=pending>0?'block':'none';}}}catch(e){}
}

function buildPOStatusChips(){
  const bar=document.getElementById('po-status-chips');
  const statuses=['All','DRAFT','PENDING','APPROVED','PARTIAL','RECEIVED','REJECTED','CANCELLED'];
  const counts={};poList.forEach(p=>{counts[p.status]=(counts[p.status]||0)+1;});
  bar.innerHTML='';
  statuses.forEach(s=>{
    const cnt=s==='All'?poList.length:(counts[s]||0);
    if(s!=='All'&&cnt===0)return;
    const c=document.createElement('div');c.className='po-chip'+(s===poFilter?' active':'');
    c.textContent=s==='All'?'All ('+cnt+')':s+' ('+cnt+')';
    c.onclick=()=>{poFilter=s;buildPOStatusChips();renderPOList();};
    bar.appendChild(c);
  });
}

function renderPOList(){
  const body=document.getElementById('po-list-body');
  const _isAdm2=currentUser.role==='admin';
  const _canDist2=_isAdm2||currentUser.canManagePODist===true||currentUser.role==='staff';
  const _canRet2=_isAdm2||currentUser.canManagePORetail===true||currentUser.role==='staff-retail';
  const canSee=_isAdm2?poList:poList.filter(p=>{
    if(p.type==='DIST'&&_canDist2)return true;
    if(p.type==='RETAIL'&&_canRet2)return true;
    if(p.createdBy===currentUser.username)return true;
    return false;
  });
  const visible=poFilter==='All'?canSee:canSee.filter(p=>p.status===poFilter);
  if(!visible.length){body.innerHTML='<div class="po-list-empty">No purchase orders found.<br>Tap "+ New PO" to create one.</div>';return;}
  body.innerHTML='';
  visible.sort((a,b)=>new Date(b.createdDate)-new Date(a.createdDate));
  visible.forEach(po=>{
    const card=document.createElement('div');card.className='po-card';card.onclick=()=>openPODetail(po.poNumber);
    const statusCls={DRAFT:'s-draft',PENDING:'s-pending',APPROVED:'s-approved',PARTIAL:'s-partial',RECEIVED:'s-received',REJECTED:'s-rejected',CANCELLED:'s-cancelled'}[po.status]||'s-draft';
    card.innerHTML=`<div class="po-card-row1"><div><div class="po-number">${po.poNumber}</div><div class="po-supplier">${po.supplier} · ${po.type}</div><div class="po-meta">${fmtPODate(po.createdDate)} · ${po.createdBy}</div></div><span class="po-status-badge ${statusCls}">${po.status}</span></div><div class="po-card-row2"><span style="font-size:11px;color:#888">${po.lineCount||0} item(s)</span><span class="po-total">₱${Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>`;
    body.appendChild(card);
  });
}

function initPOCreate(){
  poLineItems=[];
  const _isAdm=currentUser.role==='admin';
  const hasDist  =_isAdm||currentUser.canManagePODist===true;
  const hasRetail=_isAdm||currentUser.canManagePORetail===true;
  const typeEl=document.getElementById('po-type');
  if(typeEl){
    Array.from(typeEl.options).forEach(function(opt){
      if(opt.value==='DIST')   opt.hidden=!hasDist;
      if(opt.value==='RETAIL') opt.hidden=!hasRetail;
    });
    typeEl.value=hasDist?'DIST':'RETAIL';
  }
  document.getElementById('po-notes').value='';
  document.getElementById('po-delivery-date').value='';
  const errEl=document.getElementById('po-create-err');
  if(errEl)errEl.textContent='';
  onPOTypeChange();renderPOLineItems();updatePOTotals();
}

function onPOSupplierChange(){
  // Rebuild ALL existing line item dropdowns when supplier changes
  if(!poLineItems.length) return;
  const type     = document.getElementById('po-type').value;
  const supplier = document.getElementById('po-supplier').value;

  poLineItems.forEach((line, idx) => {
    if(line.removed) return;
    const sel = document.querySelector(`#po-line-${idx} select`);
    if(!sel) return;

    // Rebuild options for this line
    const filtered = liveSKUs.filter(s => s.type === type && s.supplier === supplier);
    const unassigned = liveSKUs.filter(s =>
      s.type === type && (!s.supplier || s.supplier.trim() === '')
    );
    const cats = [...new Set(filtered.map(s=>s.category))];
    let skuOpts = '<option value="">-- Select item --</option>';
    skuOpts += cats.map(cat=>{
      const items = filtered.filter(s=>s.category===cat)
        .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
        .join('');
      return items ? `<optgroup label="📦 ${cat}">${items}</optgroup>` : '';
    }).join('');
    if(unassigned.length){
      const uItems = unassigned
        .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
        .join('');
      skuOpts += `<optgroup label="⚠️ No Supplier Assigned">${uItems}</optgroup>`;
    }
    sel.innerHTML = skuOpts;

    // Re-select current value if it still exists for this supplier
    if(line.skuCode){
      const matchOpt = sel.querySelector(`option[value="${line.skuCode}|${line.skuName}"]`);
      if(matchOpt){
        sel.value = `${line.skuCode}|${line.skuName}`;
      } else {
        // SKU not in new supplier — clear it
        sel.value = '';
        poLineItems[idx].skuCode = '';
        poLineItems[idx].skuName = '';
        poLineItems[idx].unitCost = 0;
        const costInput = document.querySelector(`#po-line-${idx} .po-line-cost`);
        if(costInput) costInput.value = '';
        updatePOTotals();
      }
    }
  });
}

function onPOTypeChange(){
  const type = document.getElementById('po-type').value;
  const sup  = document.getElementById('po-supplier');
  // Use Suppliers sheet data when available, fall back to SKU Master derived list
  let supNames;
  if(supplierList.length){
    supNames = supplierList.filter(s=>s.type===type||s.type==='BOTH').map(s=>s.name).sort();
  }
  if(!supNames||!supNames.length){
    const assigned=[...new Set(liveSKUs.filter(s=>s.type===type&&s.supplier).map(s=>s.supplier))].sort();
    supNames = assigned.length ? assigned : (type==='DIST' ? DIST_SUPPLIERS : RETAIL_SUPPLIERS);
  }
  sup.innerHTML = supNames.map(s=>`<option value="${s}">${s}</option>`).join('');
  // Clear all line items when type changes — SKUs are different
  if(poLineItems.length > 0){
    if(confirm('Changing type will clear all current line items. Continue?')){
      poLineItems = [];
      renderPOLineItems();
      updatePOTotals();
    } else {
      // Revert type selection
      document.getElementById('po-type').value = type === 'DIST' ? 'RETAIL' : 'DIST';
    }
  }
}

// preData = {skuCode, skuName, qty, unitCost, unit} for edit-draft pre-fill
function addPOLineItem(preData){
  const type=document.getElementById('po-type').value;
  const supplier=document.getElementById('po-supplier').value;
  // Filter strictly to selected supplier — no fallback bleed-through
  const filtered = liveSKUs.filter(s => {
    if(s.type !== type) return false;
    return s.supplier === supplier;
  });
  // SKUs with no supplier assigned shown in separate group
  const unassigned = liveSKUs.filter(s =>
    s.type === type && (!s.supplier || s.supplier.trim() === '')
  );

  const cats = [...new Set(filtered.map(s=>s.category))];
  let skuOpts = cats.map(cat=>{
    const items = filtered.filter(s=>s.category===cat)
      .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
      .join('');
    return items ? `<optgroup label="📦 ${cat}">${items}</optgroup>` : '';
  }).join('');

  if(unassigned.length){
    const uItems = unassigned
      .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
      .join('');
    skuOpts += `<optgroup label="⚠️ No Supplier Assigned">${uItems}</optgroup>`;
  }

  if(!filtered.length && !unassigned.length){
    skuOpts = '<option value="" disabled>No SKUs found for this supplier</option>';
  }
  const idx=poLineItems.length;
  const initQty      = preData ? preData.qty          : 1;
  const initCost     = preData ? preData.unitCost      : 0;
  const initUnit     = preData ? (preData.unit||'bag') : 'bag';
  const initDisc     = preData ? (preData.discount||0) : 0;
  const initDiscType = preData ? (preData.discountType||'%') : '%';
  poLineItems.push({skuCode:'',skuName:'',qty:initQty,unitCost:initCost,unit:initUnit,
    discount:initDisc, discountType:initDiscType});

  // Pre-select option if restoring from edit-draft
  let selectHtml = '<option value="">-- Select item --</option>' + skuOpts;
  if(preData && preData.skuCode){
    poLineItems[idx].skuCode = preData.skuCode;
    poLineItems[idx].skuName = preData.skuName||preData.skuCode;
    selectHtml = selectHtml.replace(
      'value="'+preData.skuCode+'|'+preData.skuName+'"',
      'value="'+preData.skuCode+'|'+preData.skuName+'" selected'
    );
  }

  const pctActive = initDiscType==='%'  ? 'po-disc-type-active' : '';
  const phpActive = initDiscType==='₱'  ? 'po-disc-type-active' : '';

  const div=document.createElement('div');div.className='po-line-item';div.id='po-line-'+idx;
  div.innerHTML=`
    <div class="po-line-info">
      <select style="width:100%;padding:6px 8px;border:1.5px solid #e0e0e0;border-radius:7px;font-size:11px;outline:none;color:#222;background:white" onchange="onPOLineSelect(${idx},this)">${selectHtml}</select>
    </div>
    <div class="po-line-inputs">
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Qty</span>
        <input class="po-line-qty" type="number" min="1" value="${initQty}" oninput="onPOLineQty(${idx},this.value)">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Unit cost ₱</span>
        <input class="po-line-cost" type="number" min="0" placeholder="0.00" value="${initCost||''}" oninput="onPOLineCost(${idx},this.value)">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Discount</span>
        <div style="display:flex;gap:0">
          <button type="button" id="po-disc-pct-${idx}" class="po-disc-type-btn ${pctActive}" onclick="onPOLineDiscountType(${idx},'%')">%</button>
          <button type="button" id="po-disc-php-${idx}" class="po-disc-type-btn ${phpActive}" onclick="onPOLineDiscountType(${idx},'₱')">₱</button>
        </div>
        <input class="po-line-disc" type="number" min="0" placeholder="0" value="${initDisc||''}" oninput="onPOLineDiscount(${idx},this.value)" style="width:52px;margin-top:3px">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Net total</span>
        <div class="po-line-net" id="po-line-net-${idx}" style="font-size:11px;font-weight:700;color:#1A3A5C;padding-top:6px">—</div>
      </div>
    </div>
    <button class="po-line-del" onclick="removePOLine(${idx})">×</button>`;
  document.getElementById('po-line-items').appendChild(div);updatePOTotals();
}

function onPOLineDiscount(idx,val){
  poLineItems[idx].discount=parseFloat(val)||0;
  updatePOTotals();
}
function onPOLineDiscountType(idx,type){
  poLineItems[idx].discountType=type;
  const pctBtn=document.getElementById('po-disc-pct-'+idx);
  const phpBtn=document.getElementById('po-disc-php-'+idx);
  if(pctBtn) pctBtn.className='po-disc-type-btn'+(type==='%'?' po-disc-type-active':'');
  if(phpBtn) phpBtn.className='po-disc-type-btn'+(type==='₱'?' po-disc-type-active':'');
  updatePOTotals();
}

function editPODraft(){
  if(!currentPO||!['DRAFT','REJECTED'].includes(currentPO.status)) return;
  poEditMode      = true;
  poEditingNumber = currentPO.poNumber;

  // Switch to create tab and initialise
  showPOSubtab('create', document.getElementById('po-tab-create'));

  // Pre-fill header
  const typeEl = document.getElementById('po-type');
  if(typeEl){ typeEl.value = currentPO.type; onPOTypeChange(); }
  setTimeout(()=>{
    const supEl = document.getElementById('po-supplier');
    if(supEl) supEl.value = currentPO.supplier;
    onPOSupplierChange();

    // Pre-fill delivery date (YYYY-MM-DD format for date input)
    const ddEl = document.getElementById('po-delivery-date');
    if(ddEl && currentPO.deliveryDate){
      try{ ddEl.value = new Date(currentPO.deliveryDate).toISOString().split('T')[0]; }
      catch(e){}
    }
    document.getElementById('po-notes').value = currentPO.notes || '';

    // Restore line items
    poLineItems = [];
    document.getElementById('po-line-items').innerHTML = '';
    (currentPO.lineItems||[]).forEach(li=>{
      addPOLineItem({
        skuCode:      li.skuCode,
        skuName:      li.itemName||li.skuCode,
        qty:          li.qtyOrdered,
        unitCost:     li.unitCost,
        unit:         li.unit||'bag',
        discount:     li.discount||0,
        discountType: li.discountType||'%'
      });
    });
    updatePOTotals();

    // Update button labels + title
    const isRejected = currentPO.status === 'REJECTED';
    const titleEl = document.getElementById('po-create-title');
    if(titleEl) titleEl.textContent = (isRejected ? 'Edit & Resubmit: ' : 'Editing Draft: ') + currentPO.poNumber;
    const draftBtn = document.getElementById('po-save-draft-btn');
    if(draftBtn) draftBtn.textContent = isRejected ? 'Save as Draft' : 'Update Draft';
    const subBtn = document.getElementById('po-submit-btn');
    if(subBtn) subBtn.textContent = isRejected ? 'Resubmit for Approval' : 'Update & Submit for Approval';
  }, 80); // short delay to let supplier dropdown render
}

function onPOLineSelect(idx,sel){if(!sel.value)return;const parts=sel.value.split('|');poLineItems[idx].skuCode=parts[0];poLineItems[idx].skuName=parts[1]||parts[0];const skuData=liveSKUs.find(s=>s.code===parts[0]);if(skuData&&skuData.cost){poLineItems[idx].unitCost=skuData.cost;const costInput=document.querySelector('#po-line-'+idx+' .po-line-cost');if(costInput)costInput.value=skuData.cost;}updatePOTotals();}
function onPOLineQty(idx,val){poLineItems[idx].qty=parseFloat(val)||0;updatePOTotals();}
function onPOLineCost(idx,val){poLineItems[idx].unitCost=parseFloat(val)||0;updatePOTotals();}
function removePOLine(idx){poLineItems[idx]={removed:true};const el=document.getElementById('po-line-'+idx);if(el)el.remove();updatePOTotals();}
function renderPOLineItems(){document.getElementById('po-line-items').innerHTML='';poLineItems=[];}
function calcLineNet(l){
  const gross = l.qty * (l.unitCost||0);
  const disc  = l.discount || 0;
  if(!disc) return gross;
  if(l.discountType === '₱') return Math.max(0, gross - (disc * l.qty));
  return Math.max(0, gross * (1 - disc/100));
}
function updatePOTotals(){
  const active=poLineItems.filter(l=>!l.removed&&l.skuCode);
  let total=0;
  active.forEach((l,_)=>{
    const net=calcLineNet(l);
    total+=net;
    // Update per-line net display
    const origIdx=poLineItems.indexOf(l);
    const netEl=document.getElementById('po-line-net-'+origIdx);
    if(netEl) netEl.textContent='₱'+net.toLocaleString('en-PH',{minimumFractionDigits:2});
  });
  document.getElementById('po-item-count').textContent=active.length;
  document.getElementById('po-grand-total').textContent='₱'+total.toLocaleString('en-PH',{minimumFractionDigits:2});
}
async function savePODraft(){await savePO('DRAFT');}
async function submitPOForApproval(){await savePO('PENDING');}
async function savePO(status){
  // ── Guard: block double-tap / concurrent submissions ──────────────────
  if(_poSaving) return;
  _poSaving = true;
  const draftBtn = document.getElementById('po-save-draft-btn');
  const subBtn   = document.getElementById('po-submit-btn');
  if(draftBtn){ draftBtn.disabled=true; draftBtn.style.opacity='0.6'; }
  if(subBtn)  { subBtn.disabled=true;   subBtn.style.opacity='0.6';   }

  try{
    const type      = document.getElementById('po-type').value;
    const supplier  = document.getElementById('po-supplier').value;
    const notes     = document.getElementById('po-notes').value.trim();
    const delivDate = document.getElementById('po-delivery-date').value;
    const active    = poLineItems.filter(l=>!l.removed&&l.skuCode);
    if(!supplier){ alert('Please select a supplier.'); return; }
    if(active.length===0){ alert('Please add at least one line item.'); return; }
    const total = active.reduce((s,l)=>s+calcLineNet(l),0);

    if(poEditMode && poEditingNumber){
      // ── UPDATE EXISTING DRAFT ──────────────────────────────────────────
      const r=await api({action:'updatePODraft',poNumber:poEditingNumber,type,supplier,
        status, deliveryDate:delivDate,notes,totalValue:total,
        lineItems:active.map(l=>[poEditingNumber,l.skuCode,l.skuName,'',l.qty,l.unit||'bag',l.unitCost,calcLineNet(l),0,l.qty,'Open',l.discount||0,l.discountType||'%'])});
      if(r.status==='ok'){
        showBanner('po-success-bar','Draft '+poEditingNumber+(status==='PENDING'?' updated & submitted for approval':' updated'));
        showToast(status==='PENDING'?poEditingNumber+' updated & submitted for approval':poEditingNumber+' draft updated','info');
      } else { alert('Error: '+(r.msg||'Could not update PO')); return; }

    } else {
      // ── CREATE NEW PO ─────────────────────────────────────────────────
      // createdDate is generated server-side (avoids D/M vs M/D ambiguity in Sheets)
      const poNumber = generatePONumber();
      const r=await api({action:'createPO',poNumber,type,supplier,status,
        createdBy:currentUser.username,
        deliveryDate:delivDate,notes,totalValue:total,
        lineItems:active.map(l=>[poNumber,l.skuCode,l.skuName,'',l.qty,l.unit||'bag',l.unitCost,calcLineNet(l),0,l.qty,'Open',l.discount||0,l.discountType||'%'])});
      if(r.status==='ok'){
        showBanner('po-success-bar','PO '+poNumber+' '+(status==='DRAFT'?'saved as draft':'submitted for approval'));
        showToast(status==='DRAFT'?poNumber+' saved as draft':poNumber+' submitted for approval','info');
      } else { alert('Error: '+(r.msg||'Could not save PO')); return; }
    }

    // ── Reset and return to list ─────────────────────────────────────────
    poEditMode=false; poEditingNumber=null;
    const titleEl=document.getElementById('po-create-title');
    if(titleEl) titleEl.textContent='New Purchase Order';
    if(draftBtn) draftBtn.textContent='Save as Draft';
    if(subBtn)   subBtn.textContent='Submit for Approval';
    poLineItems=[];
    await loadPOs();
    showPOSubtab('list',document.getElementById('po-tab-list'));

  } catch(e){
    alert('Network error: '+e.message);
  } finally {
    // Always re-enable buttons and clear the save lock
    _poSaving = false;
    if(draftBtn){ draftBtn.disabled=false; draftBtn.style.opacity=''; }
    if(subBtn)  { subBtn.disabled=false;   subBtn.style.opacity='';   }
  }
}

async function openPODetail(poNumber){
  try{const r=await api({action:'getPODetail',poNumber});if(r.status==='ok'){currentPO={...r.po,lineItems:r.lineItems};renderPODetail();document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));document.getElementById('po-view-list').style.display='none';document.getElementById('po-view-create').style.display='none';const detail=document.getElementById('po-view-detail');detail.style.display='flex';detail.style.flexDirection='column';}}catch(e){alert('Could not load PO details.');}
}

function renderPODetail(){
  const po = currentPO;
  const isAdmin = currentUser.role === 'admin';
  const isCreator = po.createdBy === currentUser.username;
  const canReceive = isAdmin
    || (po.type==='DIST'   && (currentUser.canManagePODist===true   || currentUser.role==='staff'))
    || (po.type==='RETAIL' && (currentUser.canManagePORetail===true || currentUser.role==='staff-retail'));
  const canCancel = isAdmin
    || (isCreator && ['DRAFT','PENDING'].includes(po.status));
  const canResubmit = isCreator && po.status === 'REJECTED';

  const statusCls = {
    DRAFT:'s-draft', PENDING:'s-pending', APPROVED:'s-approved',
    PARTIAL:'s-partial', RECEIVED:'s-received',
    REJECTED:'s-rejected', CANCELLED:'s-cancelled'
  }[po.status] || '';

  const body = document.getElementById('po-detail-body');
  body.innerHTML = '';

  // ── REJECTION BANNER (visible to creator on REJECTED) ──
  if(po.status === 'REJECTED' && po.rejectionReason){
    const rb = document.createElement('div');
    rb.className = 'po-rejection-banner';
    rb.innerHTML = '<div class="po-rejection-title">⛔ PO Rejected</div>'
      + '<div class="po-rejection-comment">' + po.rejectionReason + '</div>'
      + '<div class="po-resubmit-note">Please review the comment above, update the PO as needed, then tap Resubmit for Re-approval.</div>';
    body.appendChild(rb);
  }

  // ── APPROVED BANNER (visible to creator on APPROVED) ──
  if(po.status === 'APPROVED' && isCreator && !isAdmin){
    const ab = document.createElement('div');
    ab.className = 'po-approved-banner';
    ab.innerHTML = '<div class="po-approved-title">✅ PO Approved</div>'
      + '<div style="font-size:12px;color:#1B5E20">Your PO has been approved'
      + (po.paymentTermsDays ? ' with ' + po.paymentTermsDays + '-day payment terms' : '')
      + (po.dueDate ? ' — due by <strong>' + po.dueDate + '</strong>' : '') + '.'
      + ' Proceed to receive items when goods arrive.</div>';
    body.appendChild(ab);
  }

  // ── HEADER ──
  const hdr = document.createElement('div');
  hdr.className = 'po-detail-header';
  hdr.innerHTML = '<div class="po-detail-num">' + po.poNumber + '</div>'
    + '<div><span class="po-status-badge ' + statusCls + '">' + po.status + '</span></div>'
    + '<div class="po-detail-meta" style="margin-top:8px">'
    + 'Supplier: <strong>' + po.supplier + '</strong><br>'
    + 'Type: ' + po.type + ' &nbsp;·&nbsp; Created: ' + fmtPODate(po.createdDate) + '<br>'
    + 'Created by: ' + po.createdBy
    + (po.approvedBy ? '<br>Approved by: ' + po.approvedBy : '')
    + (po.paymentMode ? '<br>Payment: ' + po.paymentMode
        + (po.chequeRef ? ' — Cheque #' + po.chequeRef : '')
        + (po.dueDate ? ' — Due: <strong>' + po.dueDate + '</strong>' : '') : '')
    + (po.docRef ? '<br>Doc Ref #: <strong>' + po.docRef + '</strong>' : '')
    + '<br>Total: <strong>₱' + Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2}) + '</strong>'
    + (po.notes ? '<br>Notes: ' + po.notes : '')
    + '</div>';
  body.appendChild(hdr);

  // ── PAYMENT HISTORY LOG (shown when previous payment edits exist) ──
  if(po.paymentHistory){
    const entries = po.paymentHistory.split('|||').map(e=>e.trim()).filter(Boolean);
    if(entries.length){
      const histDiv = document.createElement('div');
      histDiv.className = 'po-pay-history';
      histDiv.innerHTML = '<div class="po-pay-history-title">Previous Payment Records</div>'
        + entries.map(e => '<div class="po-pay-history-entry">' + e + '</div>').join('');
      hdr.appendChild(histDiv);
    }
  }

  // ── EDIT PAYMENT DETAILS (admin only — APPROVED or PARTIAL) ──
  if(isAdmin && ['APPROVED','PARTIAL'].includes(po.status)){
    const epmDiv = document.createElement('div');
    epmDiv.className = 'po-action-row';
    epmDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="openEditPaymentModal()" style="background:#1F4E78">✏️ Edit Payment Details</button>';
    body.appendChild(epmDiv);
  }

  // ── EDIT DRAFT / REJECTED (creator or admin) ──
  if(['DRAFT','REJECTED'].includes(po.status) && (isAdmin || isCreator)){
    const editDiv = document.createElement('div');
    editDiv.className = 'po-action-row';
    const editLabel = po.status === 'REJECTED' ? '✏️ Edit Before Resubmitting' : '✏️ Edit Draft';
    editDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="editPODraft()">' + editLabel + '</button>';
    body.appendChild(editDiv);
  }

  // ── APPROVAL SECTION (admin only, PENDING status) ──
  if(isAdmin && po.status === 'PENDING'){
    // Auto-fill supplier defaults if available
    const supDef = supplierList.find(s=>s.name===po.supplier)||{};
    const defMode  = supDef.defPayMode || '';
    const defTerms = supDef.defTerms   || '';
    // Convert po.deliveryDate to YYYY-MM-DD for date input
    let delivVal = '';
    if(po.deliveryDate){ try{ delivVal = new Date(po.deliveryDate).toISOString().split('T')[0]; }catch(e){} }

    const approvalDiv = document.createElement('div');
    approvalDiv.innerHTML = ''
      + '<div class="po-payment-section">'
        + '<div class="po-payment-title">Delivery &amp; Payment Terms</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Confirm delivery date</span>'
            + '<input class="po-cheque-ref" id="po-approval-delivery-date" type="date" value="' + delivVal + '" onchange="updatePODueDate()">'
          + '</div>'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Mode of payment</span>'
            + '<select class="po-payment-select" id="po-payment-mode" onchange="onPOPaymentModeChange()">'
              + '<option value="">-- Select --</option>'
              + ['Cheque','Cash Out','GCash','Maya','Bank Transfer']
                .map(m => '<option value="' + m + '"' + (m===defMode?' selected':'') + '>' + m + '</option>').join('')
            + '</select>'
          + '</div>'
        + '</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Payment terms</span>'
            + '<select class="po-payment-select" id="po-terms-days" onchange="updatePODueDate()">'
              + '<option value="">-- Select --</option>'
              + '<option value="0"' + (defTerms==='0'?' selected':'') + '>Upon Delivery</option>'
              + ['7','15','30','45','60'].map(d => '<option value="' + d + '"' + (d===defTerms?' selected':'') + '>' + d + ' days</option>').join('')
            + '</select>'
          + '</div>'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Est. due date</span>'
            + '<div class="po-due-date-display" id="po-due-date-display">—</div>'
          + '</div>'
        + '</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field" id="po-cheque-field" style="display:none">'
            + '<span class="po-payment-label">Cheque ref # (10 chars)</span>'
            + '<input class="po-cheque-ref" id="po-cheque-ref" type="text" maxlength="10" placeholder="XXXXXXXXXX">'
          + '</div>'
        + '</div>'
      + '</div>'
      // Reject reason (hidden until Reject tapped)
      + '<div class="po-reject-section" id="po-reject-section">'
        + '<div class="po-reject-title">Rejection reason (required)</div>'
        + '<textarea class="po-reject-textarea" id="po-reject-reason" placeholder="Explain why this PO is being rejected and what changes are needed..."></textarea>'
        + '<div class="modal-err" id="po-reject-err" style="margin-top:4px"></div>'
      + '</div>'
      // Action buttons
      + '<div class="po-action-row">'
        + '<button class="po-btn po-btn-success" onclick="approvePO()">✓ Approve</button>'
        + '<button class="po-btn po-btn-danger" id="po-reject-toggle-btn" onclick="toggleRejectSection()">✗ Reject</button>'
        + '<button class="po-btn po-btn-danger" id="po-reject-confirm-btn" onclick="rejectPO()" style="display:none">Confirm Rejection</button>'
      + '</div>';
    body.appendChild(approvalDiv);
  }

  // ── RESUBMIT (creator on REJECTED) ──
  if(canResubmit){
    const rsDiv = document.createElement('div');
    rsDiv.innerHTML = '<div class="po-action-row">'
      + '<button class="po-btn po-btn-primary" onclick="resubmitPO()">↩ Resubmit for Approval</button>'
      + '<button class="po-btn po-btn-secondary" onclick="cancelPO()">Cancel PO</button>'
      + '</div>';
    body.appendChild(rsDiv);
  }

  // ── RECEIPT SECTION (on APPROVED/PARTIAL, for receiving staff) ──
  if(canReceive && ['APPROVED','PARTIAL'].includes(po.status)){
    const rcptDiv = document.createElement('div');
    rcptDiv.className = 'po-receipt-header';
    rcptDiv.innerHTML = '<div class="po-receipt-title">📦 Delivery Acknowledgment</div>'
      + '<span class="po-payment-label">Document Ref # &nbsp;<span style="font-size:10px;color:#aaa">(DR / SI / AR — whichever applies)</span></span>'
      + '<input class="po-doc-ref-input" id="po-doc-ref" type="text" maxlength="30" placeholder="e.g. DR-2026-001234">';
    body.appendChild(rcptDiv);
  }

  // ── LINE ITEMS ──
  const itemsSection = document.createElement('div');
  itemsSection.className = 'po-detail-section';
  const canEdit = canReceive && ['APPROVED','PARTIAL'].includes(po.status);

  let lineHTML = '<div class="po-detail-section-title">Line Items</div>';

  if(canEdit){
    lineHTML += '<div style="font-size:10px;color:#888;margin-bottom:8px">'
      + 'Qty and unit cost are editable — adjust for price changes or partial returns.</div>';
  }

  (po.lineItems||[]).forEach((li, i) => {
    const outstanding = Number(li.qtyOutstanding) || (Number(li.qtyOrdered) - Number(li.qtyReceived||0));
    const received    = Number(li.qtyReceived||0);
    const isFull      = outstanding <= 0;
    const defaultCost = Number(li.unitCost||0);

    const discAmt  = Number(li.discount||0);
    const discType = li.discountType || '%';
    const discLabel = discAmt > 0
      ? (discType==='₱' ? '−₱'+discAmt.toLocaleString('en-PH')+'/unit' : '−'+discAmt+'%') : '';
    const netUnit = discAmt > 0
      ? (discType==='₱' ? Number(li.unitCost)-discAmt : Number(li.unitCost)*(1-discAmt/100)) : Number(li.unitCost);

    lineHTML += '<div class="po-receive-row">'
      + '<div class="po-receive-info">'
        + '<div class="po-receive-name">' + (li.itemName||li.skuCode) + '</div>'
        + '<div class="po-receive-ordered">Ordered: ' + li.qtyOrdered
          + ' &nbsp;·&nbsp; Received: ' + received
          + ' &nbsp;·&nbsp; Outstanding: ' + outstanding + '</div>'
        + '<div class="po-receive-ordered">Cost: ₱' + Number(li.unitCost||0).toLocaleString('en-PH',{minimumFractionDigits:2})
          + (discLabel ? ' &nbsp;<span style="color:#E24B4A;font-weight:600">'+discLabel+'</span>'
            + ' &nbsp;→ Net ₱'+Math.max(0,netUnit).toLocaleString('en-PH',{minimumFractionDigits:2}) : '')
          + '</div>'
      + '</div>';

    if(isFull){
      lineHTML += '<span class="po-received-badge">Received ✓</span>';
    } else if(canEdit){
      lineHTML += '<input class="po-recv-qty" type="number" min="0" max="' + outstanding + '"'
          + ' placeholder="' + outstanding + '" id="recv-qty-' + i + '" value="' + outstanding + '">'
        + '<input class="po-recv-cost" type="number" min="0" step="0.01"'
          + ' placeholder="cost" id="recv-cost-' + i + '" value="' + defaultCost + '">';
    }

    lineHTML += '</div>';
  });

  itemsSection.innerHTML = lineHTML;
  body.appendChild(itemsSection);

  // ── RECEIVE BUTTON ──
  if(canReceive && ['APPROVED','PARTIAL'].includes(po.status)){
    const recvDiv = document.createElement('div');
    recvDiv.className = 'po-action-row';
    recvDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="receiveItems()">📦 Confirm Receipt &amp; Update Inventory</button>';
    body.appendChild(recvDiv);
  }

  // ── CANCEL ──
  // Admin: any active status (not already CANCELLED or fully RECEIVED)
  // Creator (non-admin): DRAFT or PENDING only, and not in resubmit state
  const showCancel = isAdmin
    ? !['CANCELLED','RECEIVED'].includes(po.status)
    : (isCreator && ['DRAFT','PENDING'].includes(po.status) && !canResubmit);
  if(showCancel){
    const cancelDiv = document.createElement('div');
    cancelDiv.className = 'po-action-row';
    cancelDiv.innerHTML = '<button class="po-btn po-btn-secondary" onclick="cancelPO()">Cancel PO</button>';
    body.appendChild(cancelDiv);
  }

  // ── DELETE (admin only — permanent, removes PO + line items from sheet) ──
  if(isAdmin){
    const delDiv = document.createElement('div');
    delDiv.className = 'po-action-row';
    delDiv.innerHTML = '<button class="po-btn po-btn-danger" onclick="deletePO()" style="background:#8B0000">🗑 Delete PO Permanently</button>';
    body.appendChild(delDiv);
  }

  // ── BACK ──
  const backDiv = document.createElement('div');
  backDiv.className = 'po-action-row';
  backDiv.style.marginTop = '4px';
  backDiv.innerHTML = '<button class="po-btn po-btn-secondary" onclick="backToPOList()">← Back to list</button>';
  body.appendChild(backDiv);
}

function updatePODueDate(){
  const daysVal  = document.getElementById('po-terms-days')
    ? document.getElementById('po-terms-days').value : '';
  const days     = parseInt(daysVal) || 0;
  const el       = document.getElementById('po-due-date-display');
  if(!el) return;
  if(daysVal === '' ){ el.textContent = '—'; return; }
  if(days === 0){ el.textContent = 'Upon Delivery'; return; }
  // Base on confirmed delivery date, fall back to today
  const delivInput = document.getElementById('po-approval-delivery-date');
  const base = delivInput && delivInput.value ? new Date(delivInput.value) : new Date();
  const due  = new Date(base);
  due.setDate(due.getDate() + days);
  el.textContent = due.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) + ' (est.)';
}

function onPOPaymentModeChange(){
  const mode  = document.getElementById('po-payment-mode').value;
  const field = document.getElementById('po-cheque-field');
  if(field) field.style.display = mode === 'Cheque' ? 'block' : 'none';
}

function toggleRejectSection(){
  const sec   = document.getElementById('po-reject-section');
  const tog   = document.getElementById('po-reject-toggle-btn');
  const conf  = document.getElementById('po-reject-confirm-btn');
  if(!sec) return;
  const showing = sec.style.display !== 'none';
  sec.style.display  = showing ? 'none' : 'block';
  tog.style.display  = showing ? 'inline-flex' : 'none';
  conf.style.display = showing ? 'none' : 'inline-flex';
}

function backToPOList(){currentPO=null;document.getElementById('po-view-detail').style.display='none';showPOSubtab('list',document.getElementById('po-tab-list'));}
async function approvePO(){
  const days       = document.getElementById('po-terms-days')              ? document.getElementById('po-terms-days').value                              : '';
  const mode       = document.getElementById('po-payment-mode')            ? document.getElementById('po-payment-mode').value                            : '';
  const cheque     = document.getElementById('po-cheque-ref')              ? document.getElementById('po-cheque-ref').value.trim().toUpperCase()          : '';
  const dueDisp    = document.getElementById('po-due-date-display')        ? document.getElementById('po-due-date-display').textContent                   : '';
  const delivInput = document.getElementById('po-approval-delivery-date')  ? document.getElementById('po-approval-delivery-date').value                   : '';

  if(mode==='Cheque' && cheque.length!==10){
    alert('Cheque reference must be exactly 10 characters.');return;
  }
  if(!confirm('Approve '+currentPO.poNumber+'?'))return;
  try{
    const r=await api({
      action:'approvePO',
      poNumber:currentPO.poNumber,
      approvedBy:currentUser.username,
      deliveryDate:delivInput||'',
      paymentTermsDays:days||'',
      paymentMode:mode||'',
      chequeRef:cheque||'',
      dueDate:dueDisp&&dueDisp!=='—'&&dueDisp!=='Upon Delivery'?dueDisp:''
    });
    if(r.status==='ok'){
      showBanner('po-success-bar','PO '+currentPO.poNumber+' approved'+(mode?' — '+mode+' payment':'')+' ✓');
      showToast(currentPO.poNumber+' approved'+(mode?' — '+mode:''),'success');
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Approve failed: '+e.message);}
}
async function rejectPO(){
  const reasonEl = document.getElementById('po-reject-reason');
  const errEl    = document.getElementById('po-reject-err');
  const reason   = reasonEl ? reasonEl.value.trim() : '';
  if(!reason){
    if(errEl) errEl.textContent = 'Please enter a rejection reason — the creator needs this to make corrections.';
    return;
  }
  if(!confirm('Reject '+currentPO.poNumber+'? The creator will be notified to review your comment.'))return;
  try{
    const r=await api({action:'rejectPO',poNumber:currentPO.poNumber,rejectedBy:currentUser.username,reason});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO rejected — '+currentPO.createdBy+' has been notified');
      showToast(currentPO.poNumber+' rejected — '+currentPO.createdBy+' needs to review','warning',5000);
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Reject failed: '+e.message);}
}

async function resubmitPO(){
  if(!confirm('Resubmit '+currentPO.poNumber+' for approval? Make sure you have addressed the rejection comments.'))return;
  try{
    const r=await api({action:'resubmitPO',poNumber:currentPO.poNumber,resubmittedBy:currentUser.username});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO resubmitted for approval ✓');
      showToast(currentPO.poNumber+' resubmitted for approval','info');
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Resubmit failed: '+e.message);}
}
async function cancelPO(){
  if(!confirm('Cancel '+currentPO.poNumber+'? This cannot be undone.'))return;
  try{
    const r=await api({action:'cancelPO',poNumber:currentPO.poNumber,cancelledBy:currentUser.username});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO cancelled');
      showToast(currentPO.poNumber+' cancelled','warning');
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Cancel failed: '+e.message);}
}

async function deletePO(){
  const po = currentPO;
  const receivedWarning = po.status === 'RECEIVED'
    ? '\n\n⚠️ This PO has already been RECEIVED. Deleting it will NOT reverse the stock-in entries — inventory counts will remain as-is.'
    : '';
  if(!confirm(
    'Permanently delete ' + po.poNumber + '?\n\n'
    + 'This will remove the PO and all its line items from the database.\n'
    + 'This action cannot be undone.'
    + receivedWarning
  )) return;
  try{
    const r = await api({ action:'deletePO', poNumber:po.poNumber, deletedBy:currentUser.username });
    if(r.status==='ok'){
      showToast(po.poNumber+' permanently deleted','warning',4000);
      backToPOList();
      await loadPOs();
    } else alert('Error: '+r.msg);
  }catch(e){ alert('Network error: '+e.message); }
}

async function receiveItems(){
  const lines = currentPO.lineItems || [];
  const receipts = [];
  const docRef = document.getElementById('po-doc-ref') ? document.getElementById('po-doc-ref').value.trim() : '';

  lines.forEach((li, i)=>{
    const qtyInput  = document.getElementById('recv-qty-'+i);
    const costInput = document.getElementById('recv-cost-'+i);
    if(!qtyInput) return; // already fully received
    const qty  = parseFloat(qtyInput.value)  || 0;
    const cost = parseFloat(costInput ? costInput.value : li.unitCost) || Number(li.unitCost) || 0;
    if(qty > 0) receipts.push({
      skuCode:     li.skuCode,
      itemName:    li.itemName||li.skuCode,
      qtyReceived: qty,
      unitCost:    cost,
      lineIndex:   i
    });
  });

  if(!receipts.length){ alert('Enter quantities to receive for at least one item.'); return; }

  const confirmMsg = receipts.map(r =>
    r.qtyReceived + ' x ' + r.itemName + ' @ ₱' + Number(r.unitCost).toLocaleString('en-PH',{minimumFractionDigits:2})
  ).join('\n');

  if(!confirm('Confirm receipt of:\n\n' + confirmMsg + '\n\nThis will update inventory stock counts as STOCK IN.')) return;

  try{
    const r = await api({
      action:      'receivePO',
      poNumber:    currentPO.poNumber,
      receivedBy:  currentUser.username,
      poType:      currentPO.type,
      docRef:      docRef,
      receipts
    });
    if(r.status==='ok'){
      const summary = receipts.length + ' item(s) received'
        + (docRef ? ' — Doc Ref: ' + docRef : '')
        + ' — inventory updated as STOCK IN ✓';
      showBanner('po-success-bar', summary);
      if(r.calendarNote){
        const isErr = r.calendarNote.startsWith('ERROR:') || r.calendarNote.includes('not found');
        showToast(
          isErr ? 'Calendar: ' + r.calendarNote : 'Calendar event created — ' + r.calendarNote,
          isErr ? 'error' : 'success',
          isErr ? 6000 : 4000
        );
      }
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){ alert('Network error: '+e.message); }
}

// ── EDIT PAYMENT DETAILS ──────────────────────────────────────────────────
function openEditPaymentModal(){
  const po = currentPO;
  if(!po) return;

  // Pre-fill label
  document.getElementById('epm-po-label').textContent =
    po.poNumber + ' — ' + po.supplier;

  // Pre-fill mode
  const modeEl = document.getElementById('epm-mode');
  modeEl.value = po.paymentMode || '';
  epmOnModeChange();

  // Pre-fill cheque ref
  const chequeEl = document.getElementById('epm-cheque');
  chequeEl.value = po.chequeRef || '';

  // Pre-fill terms
  const termsEl = document.getElementById('epm-terms');
  termsEl.value = po.paymentTermsDays || '';

  // Pre-fill delivery date — derive from due date or use today
  const delivEl = document.getElementById('epm-delivery');
  try {
    const base = po.deliveryDate
      ? new Date(po.deliveryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    delivEl.value = base;
  } catch(e){ delivEl.value = new Date().toISOString().split('T')[0]; }

  epmCalcDue();
  document.getElementById('epm-err').textContent = '';
  document.getElementById('edit-payment-modal').style.display = 'flex';
}

function closeEditPaymentModal(){
  document.getElementById('edit-payment-modal').style.display = 'none';
}

function epmOnModeChange(){
  const mode  = document.getElementById('epm-mode').value;
  const wrap  = document.getElementById('epm-cheque-wrap');
  if(wrap) wrap.style.display = mode === 'Cheque' ? 'block' : 'none';
}

function epmCalcDue(){
  const terms   = document.getElementById('epm-terms').value;
  const delivEl = document.getElementById('epm-delivery');
  const disp    = document.getElementById('epm-due-display');
  if(!disp) return;
  if(terms === '') { disp.textContent = 'Est. due date: —'; return; }
  if(terms === '0'){ disp.textContent = 'Est. due date: Upon Delivery'; return; }
  try {
    const base = delivEl && delivEl.value ? new Date(delivEl.value) : new Date();
    const due  = new Date(base);
    due.setDate(due.getDate() + parseInt(terms));
    disp.textContent = 'Est. due date: '
      + due.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
  } catch(e){ disp.textContent = 'Est. due date: —'; }
}

async function savePaymentDetails(){
  const po      = currentPO;
  const mode    = document.getElementById('epm-mode').value;
  const cheque  = document.getElementById('epm-cheque').value.trim().toUpperCase();
  const terms   = document.getElementById('epm-terms').value;
  const dueDisp = document.getElementById('epm-due-display').textContent.replace('Est. due date: ','').trim();
  const errEl   = document.getElementById('epm-err');

  if(!mode){ errEl.textContent = 'Please select a payment mode.'; return; }
  if(mode === 'Cheque' && cheque.length !== 10){
    errEl.textContent = 'Cheque reference must be exactly 10 characters.'; return;
  }
  errEl.textContent = '';

  const btn = document.getElementById('epm-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try{
    const r = await api({
      action:           'updatePOPayment',
      poNumber:         po.poNumber,
      editedBy:         currentUser.username,
      // old values (for history log)
      oldPaymentMode:   po.paymentMode     || '',
      oldChequeRef:     po.chequeRef       || '',
      oldTermsDays:     po.paymentTermsDays|| '',
      oldDueDate:       po.dueDate         || '',
      // new values
      paymentMode:      mode,
      chequeRef:        mode === 'Cheque' ? cheque : '',
      paymentTermsDays: terms,
      dueDate:          (dueDisp === '—' || dueDisp === 'Upon Delivery') ? dueDisp : dueDisp
    });

    if(r.status === 'ok'){
      closeEditPaymentModal();
      showToast('Payment details updated for ' + po.poNumber, 'success', 4000);
      await openPODetail(po.poNumber);
      await loadPOs();
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Unknown error');
    }
  } catch(e){
    errEl.textContent = 'Save failed: ' + e.message;
  }
  btn.disabled = false; btn.textContent = 'Save Changes';
}

// ── PRODUCTION CONVERSION SYSTEM ──
let bom = [];
let prodLines = [];
let prodCategory = 'All';

