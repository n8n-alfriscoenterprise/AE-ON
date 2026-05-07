async function openProduction(){
  const isAdmin = currentUser && currentUser.role==='admin';
  const canProd = isAdmin || currentUser.canProduction===true || currentUser.role==='staff-retail';
  if(!canProd){alert('You do not have permission to run production conversions.');return;}
  showScreen('prod-screen');
  updateFabVisibility();
  document.getElementById('prod-lines').innerHTML = '<div class="prod-empty" style="color:#1B5E20">Loading...</div>';
  prodCategory = 'All';
  await loadBOM();
  buildProdCategoryChips();
  prodLines = [];
  addProdLine();
}

function buildProdCategoryChips(){
  const bar = document.getElementById('prod-cat-bar');
  if(!bar) return;
  const cats = ['All', ...new Set(bom.map(b => b.category).filter(Boolean).sort())];
  bar.innerHTML = '';
  cats.forEach(cat => {
    const c = document.createElement('div');
    c.className = 'chip' + (cat === prodCategory ? ' active' : '');
    c.textContent = cat;
    c.onclick = () => { prodCategory = cat; buildProdCategoryChips(); renderProdLines(); };
    bar.appendChild(c);
  });
}

function closeProduction(){ showHome(); }

async function loadBOM(){
  try{
    const r = await api({action:'getBOM'});
    if(r.status==='ok'&&Array.isArray(r.bom)){ bom=r.bom; }
    else{ bom=[]; }
  }catch(e){ bom=[]; }
}

function addProdLine(){
  prodLines.push({skuCode:'',skuName:'',direction:'dis',qty:1,actualYield:'',ratio:1});
  renderProdLines();
  setTimeout(()=>{
    const el=document.getElementById('prod-lines');
    if(el&&el.lastElementChild)el.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function removeProdLine(idx){
  prodLines.splice(idx,1);
  if(!prodLines.length) addProdLine();
  else renderProdLines();
}

function renderProdLines(){
  const container=document.getElementById('prod-lines');
  if(!container)return;
  container.innerHTML='';
  if(!bom.length){
    container.innerHTML='<div class="prod-empty">No production items found.<br>Make sure SKU Master - Retail has Production Item = YES rows.</div>';
    return;
  }
  const disItems=bom.filter(b=>!b.canAssemble&&(prodCategory==='All'||b.category===prodCategory));
  const asmItems=bom.filter(b=> b.canAssemble&&(prodCategory==='All'||b.category===prodCategory));
  prodLines.forEach((line,idx)=>{
    const items = line.direction==='dis' ? disItems : asmItems;

    // Resolve full BOM item for this line (needed for unit labels throughout the card)
    const bi = line.skuCode
      ? bom.find(b=>b.sourceSku===line.skuCode&&(line.direction==='asm'?b.canAssemble:!b.canAssemble))
      : null;
    const srcUnit = bi ? (bi.sourceUnit||'unit') : 'unit';
    const outUnit = bi ? (bi.outputUnit||'unit') : 'unit';

    // Dropdown — ratio label uses actual col E units
    const skuOpts='<option value="">-- Select item --</option>'+
      items.map(b=>{
        const su = b.sourceUnit||'unit';
        const ou = b.outputUnit||'unit';
        const ratioLabel = line.direction==='dis'
          ? `1 ${su} → ${b.ratio} ${ou}`
          : `${b.ratio} ${su} → 1 ${ou}`;
        return `<option value="${b.sourceSku}|${b.sourceName}|${b.ratio}"${line.skuCode===b.sourceSku?' selected':''}>${b.sourceName} (${ratioLabel})</option>`;
      }).join('');

    // Hint and variance
    let ruleHint='', varianceHtml='';
    if(bi && line.qty>0){
      const outputAmount = line.qty * bi.ratio;
      if(line.direction==='asm'){
        // Assembly: user enters target output qty; show how many source units are consumed
        ruleHint = `Requires <strong>${outputAmount}</strong> ${srcUnit} of ${bi.sourceName} → yields <strong>${line.qty}</strong> ${outUnit} of ${bi.outputName}`;
      } else {
        // Disassembly: user enters source qty; show how many output units are produced
        ruleHint = `Standard yield: <strong>${outputAmount}</strong> ${outUnit} of ${bi.outputName}`;
      }
      const stdForVariance = line.direction==='asm' ? line.qty : outputAmount;
      if(line.actualYield!==''){
        const act=parseFloat(line.actualYield)||0;
        const v=act-stdForVariance;
        const vc=v<0?'#E24B4A':v>0?'#27AE60':'#888';
        varianceHtml=`<div class="prod-variance" style="color:${vc}">Variance: ${v>=0?'+':''}${v.toFixed(1)} vs standard (${stdForVariance} ${outUnit})</div>`;
      }
    }

    // Field labels reflect direction and actual units
    const convertLabel = line.direction==='asm'
      ? `Target Output (${outUnit})`
      : `Qty to Convert (${srcUnit})`;
    const yieldLabel = `Actual Yield (${outUnit})`;

    const card=document.createElement('div');
    card.className='prod-line-card';
    card.id='prod-line-'+idx;
    card.innerHTML=`
      <div class="prod-line-header">
        <span class="prod-line-num">Item ${idx+1}</span>
        ${prodLines.length>1?'<button class="prod-line-del" onclick="removeProdLine('+idx+')">&#215;</button>':''}
      </div>
      <span class="prod-field-label">Product</span>
      <select class="prod-select" onchange="onProdSKU(${idx},this.value)">${skuOpts}</select>
      <span class="prod-field-label">Operation</span>
      <div class="prod-dir-row">
        <button class="prod-dir-btn ${line.direction==='dis'?'active-dis':''}" onclick="onProdDir(${idx},'dis')">🏭 Disassemble</button>
        <button class="prod-dir-btn ${line.direction==='asm'?'active-asm':''}" onclick="onProdDir(${idx},'asm')">🔄 Assemble</button>
      </div>
      <div class="prod-nums-row">
        <div class="prod-num-wrap">
          <span class="prod-field-label">${convertLabel}</span>
          <input type="number" class="prod-num-input" min="1" step="1" value="${line.qty||1}" placeholder="Qty" oninput="onProdQty(${idx},this.value)">
        </div>
        <div class="prod-num-wrap">
          <span class="prod-field-label">${yieldLabel}</span>
          <input type="number" class="prod-num-input" min="0" step="0.1" value="${line.actualYield!==''?line.actualYield:''}" placeholder="Optional" style="border-color:${line.actualYield!==''?'#1B5E20':'#e0e0e0'}" oninput="onProdActual(${idx},this.value)">
        </div>
      </div>
      ${varianceHtml}
      ${ruleHint?'<div class="prod-rule-hint">'+ruleHint+'</div>':''}`;
    container.appendChild(card);
  });
}

function onProdSKU(idx,val){
  if(!val){prodLines[idx].skuCode='';prodLines[idx].skuName='';renderProdLines();return;}
  const p=val.split('|');
  prodLines[idx].skuCode=p[0]||'';
  prodLines[idx].skuName=p[1]||'';
  prodLines[idx].ratio=parseFloat(p[2])||1;
  prodLines[idx].actualYield='';
  renderProdLines();
}

function onProdDir(idx,dir){
  prodLines[idx].direction=dir;
  prodLines[idx].skuCode='';
  prodLines[idx].skuName='';
  prodLines[idx].actualYield='';
  renderProdLines();
}

function onProdQty(idx,val){ prodLines[idx].qty=parseInt(val)||1; renderProdLines(); }
function onProdActual(idx,val){ prodLines[idx].actualYield=val!==''?val:''; renderProdLines(); }

async function submitAllProduction(){
  const valid=prodLines.filter(l=>l.skuCode&&l.qty>0);
  if(!valid.length){alert('Please select at least one product and enter a quantity.');return;}
  const summary=valid.map(line=>{
    const bi=bom.find(b=>b.sourceSku===line.skuCode&&(line.direction==='asm'?b.canAssemble:!b.canAssemble));
    if(!bi)return null;
    // Disassembly: consume qty bags, produce qty×ratio kg
    // Assembly:    consume qty×ratio kg, produce qty bags
    const stdOutput  = line.direction==='asm' ? line.qty            : line.qty*bi.ratio;
    const consumed   = line.direction==='asm' ? line.qty*bi.ratio   : line.qty;
    const act        = line.actualYield!==''  ? parseFloat(line.actualYield)||0 : stdOutput;
    return{...line,bomItem:bi,standard:stdOutput,actual:act,variance:act-stdOutput,consumed};
  }).filter(Boolean);
  if(!summary.length){alert('No valid BOM rules found for selected items.');return;}
  const msg=summary.map(s=>{
    const su=s.bomItem.sourceUnit||'unit';
    const ou=s.bomItem.outputUnit||'unit';
    const consumedQty = s.direction==='asm' ? s.consumed : s.qty;
    const producedQty = s.actual;
    return `${s.direction==='dis'?'🏭':'🔄'} ${s.skuName} × ${consumedQty} ${su} → ${producedQty} ${ou} of ${s.bomItem.outputName}`
      +(s.variance!==0?` (variance: ${s.variance>=0?'+':''}${s.variance.toFixed(1)})`:'');
  }).join('\n');
  if(!confirm(`Production batch:

${msg}

Update Stock Counts - Retail?`))return;
  const btn=document.getElementById('prod-convert-btn');
  btn.disabled=true;btn.textContent='Converting...';
  const now=new Date().toLocaleString('sv-SE', {timeZone:'Asia/Manila'});
  const failures=[];
  for(const s of summary){
    const r=await api({action:'submitProduction',submittedBy:currentUser.username,timestamp:now,sourceSku:s.skuCode,sourceName:s.skuName,sourceUnit:s.bomItem.sourceUnit||'',bagsConsumed:s.consumed,outputSku:s.bomItem.outputSku,outputName:s.bomItem.outputName,outputUnit:s.bomItem.outputUnit||'',unitsProduced:s.actual,standardUnits:s.standard,ratio:s.bomItem.ratio,canAssemble:s.direction==='asm',notes:s.variance!==0?`Variance: ${s.variance>=0?'+':''}${s.variance.toFixed(1)} vs standard ${s.standard}`:''});
    if(r.status!=='ok'){
      console.error('submitProduction failed for',s.skuName,'— response:',JSON.stringify(r));
      failures.push(s.skuName+(r.msg?' ('+r.msg+')':''));
    }
  }
  btn.disabled=false;btn.textContent='🏭 CONVERT';
  const bar=document.getElementById('prod-success-bar');
  if(!failures.length){
    bar.textContent=`✓ ${summary.length} item(s) converted — stock counts updated`;
    bar.style.display='block';setTimeout(()=>bar.style.display='none',5000);
    prodLines=[];addProdLine();
  }else{alert('The following item(s) failed:\n\n'+failures.join('\n')+'\n\nOpen the browser console (F12) for details.');}
}


// ── FAB VISIBILITY CONTROL ──
