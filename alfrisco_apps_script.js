// ════════════════════════════════════════════════════════════════════════
// ALFRISCO INVENTORY SYSTEM — Complete Google Apps Script
// Last updated: includes updateStaff, canBackorderDist, canBackorderRetail
// HOW TO DEPLOY:
//   1. Open Google Sheet → Extensions → Apps Script
//   2. Select ALL existing code → Delete
//   3. Paste this entire file
//   4. Save (Ctrl+S)
//   5. Deploy → Manage Deployments → pencil icon → New version → Deploy
// ════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── GET STAFF ──────────────────────────────────────────────────────
    if (data.action === 'getStaff') {
      let sheet = ss.getSheetByName('Staff');
      if (!sheet) {
        sheet = ss.insertSheet('Staff');
        sheet.appendRow(['Username','Password','Role','AssignedUnit',
                         'CanCountDist','CanCountRetail',
                         'CanManagePODist','CanManagePORetail',
                         'CanBackorderDist','CanBackorderRetail',
                         'CanProduction','CanTransfer','CanViewProductList','CanStockAdjust','PLView']);
        sheet.appendRow(['Adrian','admin2026','admin','All',
                         'YES','YES','YES','YES','YES','YES','YES','YES','YES','YES']);
      }
      const rows = sheet.getDataRange().getValues();
      const staff = rows.slice(1).filter(r => r[0]).map(r => ({
        username:          String(r[0]).trim(),
        password:          String(r[1]).trim(),
        role:              String(r[2]).trim(),
        assignedUnit:      String(r[3] || 'All').trim(),
        canCountDist:      String(r[4] || 'YES').toUpperCase() !== 'NO',
        canCountRetail:    String(r[5] || 'YES').toUpperCase() !== 'NO',
        canManagePODist:   String(r[6] || 'NO').toUpperCase()  === 'YES',
        canManagePORetail: String(r[7] || 'NO').toUpperCase()  === 'YES',
        canBackorderDist:  String(r[8] || 'YES').toUpperCase() !== 'NO',
        canBackorderRetail:String(r[9] || 'NO').toUpperCase()  === 'YES',
        canProduction:     String(r[10]|| 'NO').toUpperCase()  === 'YES',
        canTransfer:       String(r[11]|| 'NO').toUpperCase()  === 'YES',
        canViewProductList:String(r[12]|| 'YES').toUpperCase() !== 'NO',
        canStockAdjust:    String(r[13]|| 'NO').toUpperCase()  === 'YES',
        plView:            String(r[14]|| 'both').toLowerCase() || 'both'
      }));
      return ok({ staff });
    }

    // ── ADD STAFF ──────────────────────────────────────────────────────
    if (data.action === 'addStaff') {
      let sheet = ss.getSheetByName('Staff');
      if (!sheet) {
        sheet = ss.insertSheet('Staff');
        sheet.appendRow(['Username','Password','Role','AssignedUnit',
                         'CanCountDist','CanCountRetail',
                         'CanManagePODist','CanManagePORetail',
                         'CanBackorderDist','CanBackorderRetail',
                         'CanProduction','CanTransfer','CanViewProductList','CanStockAdjust','PLView']);
      }
      sheet.appendRow([
        data.username,
        data.password,
        data.role,
        data.assignedUnit      || 'All',
        data.canCountDist      !== false ? 'YES' : 'NO',
        data.canCountRetail    !== false ? 'YES' : 'NO',
        data.canManagePO       !== false ? 'YES' : 'NO',
        data.canBackorderDist  !== false ? 'YES' : 'NO',
        data.canBackorderRetail ? 'YES' : 'NO',
        data.canProduction ? 'YES' : 'NO',
        data.canTransfer ? 'YES' : 'NO'
      ]);
      return ok({});
    }

    // ── UPDATE STAFF PERMISSIONS ───────────────────────────────────
    if (data.action === 'updateStaff') {
      const sheet = ss.getSheetByName('Staff');
      if (!sheet) return err('Staff sheet not found');
      const rows = sheet.getDataRange().getValues();
      let updated = false;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === String(data.username).toLowerCase()) {
          sheet.getRange(i+1, 3).setValue(data.role);
          sheet.getRange(i+1, 4).setValue(data.assignedUnit || 'All');
          sheet.getRange(i+1, 5).setValue(data.canCountDist       !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 6).setValue(data.canCountRetail     !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 7).setValue(data.canManagePODist    ? 'YES' : 'NO');
          sheet.getRange(i+1, 8).setValue(data.canManagePORetail  ? 'YES' : 'NO');
          sheet.getRange(i+1, 9).setValue(data.canBackorderDist   !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 10).setValue(data.canBackorderRetail ? 'YES' : 'NO');
          sheet.getRange(i+1, 11).setValue(data.canProduction     ? 'YES' : 'NO');
          sheet.getRange(i+1, 12).setValue(data.canTransfer       ? 'YES' : 'NO');
          sheet.getRange(i+1, 13).setValue(data.canViewProductList !== false ? 'YES' : 'NO');
          sheet.getRange(i+1, 14).setValue(data.canStockAdjust ? 'YES' : 'NO');
          sheet.getRange(i+1, 15).setValue(data.plView || 'both');
          updated = true;
          break;
        }
      }
      return ok({ updated });
    }

    // ── REMOVE STAFF ───────────────────────────────────────────────────
    if (data.action === 'removeStaff') {
      const sheet = ss.getSheetByName('Staff');
      if (sheet) {
        const rows = sheet.getDataRange().getValues();
        for (let i = rows.length - 1; i >= 1; i--) {
          if (String(rows[i][0]).toLowerCase() === String(data.username).toLowerCase()) {
            sheet.deleteRow(i + 1);
            break;
          }
        }
      }
      return ok({});
    }

    // ── GET ALL SKUs ───────────────────────────────────────────────────
    if (data.action === 'getAllSKUs') {
      const skus = [];
      const distSheet = ss.getSheetByName('SKU Master');
      if (distSheet) {
        distSheet.getDataRange().getValues().slice(4)
          .filter(r => r[0] && String(r[5]).toUpperCase() === 'YES')
          .forEach((r, i) => skus.push({
            code:String(r[0]).trim(),name:String(r[1]).trim(),
            category:String(r[2]).trim(),type:'DIST',
            order:Number(r[4])||i,supplier:String(r[7]||'').trim(),cost:Number(r[8])||0
          }));
      }
      const retailSheet = ss.getSheetByName('SKU Master - Retail');
      if (retailSheet) {
        retailSheet.getDataRange().getValues().slice(4)
          .filter(r => r[0] && String(r[7]).toUpperCase() === 'YES')
          .forEach((r, i) => skus.push({
            code:String(r[0]).trim(),name:String(r[1]).trim(),
            category:String(r[2]).trim(),type:'RETAIL',
            unit:String(r[4]||'').trim(),order:Number(r[6])||1000+i,
            supplier:String(r[8]||'').trim(),cost:Number(r[9])||0
          }));
      }
      skus.sort((a,b)=>a.order-b.order);
      return ok({skus});
    }

    // ── GET SKU MASTER (fallback) ──────────────────────────────────────
    if (data.action === 'getSKUMaster') {
      const sheet = ss.getSheetByName('SKU Master');
      if (!sheet) return ok({skus:[]});
      const skus = sheet.getDataRange().getValues().slice(4)
        .filter(r=>r[0]&&String(r[5]).toUpperCase()==='YES')
        .map((r,i)=>({code:String(r[0]).trim(),name:String(r[1]).trim(),
          category:String(r[2]).trim(),type:'DIST',order:Number(r[4])||i,
          supplier:String(r[7]||'').trim(),cost:Number(r[8])||0}))
        .sort((a,b)=>a.order-b.order);
      return ok({skus});
    }

    // ── GET TODAY'S LOADS ──────────────────────────────────────────────
    if (data.action === 'getTodayLoads') {
      const sheet = ss.getSheetByName('Stock Movements');
      if (!sheet) return ok({rows:[]});
      const today = new Date().toLocaleDateString('en-PH');
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r=>new Date(r[0]).toLocaleDateString('en-PH')===today&&
                   String(r[2])===data.unit&&String(r[3])==='LOAD')
        .map(r=>({code:String(r[4]),name:String(r[5]),cat:String(r[6]),
          loaded:Number(r[7])||0,returned:Number(r[8])||0,sold:Number(r[9])||0}));
      return ok({rows});
    }

    // ── MARK DELIVERED ─────────────────────────────────────────────────
    if (data.action === 'markDelivered') {
      const sheet = getOrCreateSheet(ss,'Deliveries',[
        'Timestamp','Driver','Bajaj Unit','Dealer Name',
        'SKU Code','Item Name','Qty Delivered','Purchase Unit','Backorder?','Notes']);
      sheet.appendRow([new Date().toLocaleString('en-PH'),
        data.driver,data.unit,data.dealer||'',data.code,data.name,
        data.qty,data.unit_type||'bag',data.backorder||'No',data.notes||'']);
      return ok({});
    }

    // ── GET PRODUCTION BOM (now reads from SKU Master - Retail) ──────────
    if (data.action === 'getBOM') {
      const sheet = ss.getSheetByName('SKU Master - Retail');
      if (!sheet) return ok({bom:[]});
      // Cols: A-Code B-Name C-Cat D-Type E-Unit F-Rev G-Order H-Active
      //       I-Supplier J-Cost K-SellingPrice
      //       L-IsProductionItem M-DisassemblyUOM N-AssemblyUOM O-StandardRatio
      const rows = sheet.getDataRange().getValues().slice(4)
        .filter(r => r[0] && String(r[7]).toUpperCase()==='YES'
                  && String(r[11]||'').toUpperCase()==='YES');

      // Build BOM entries for DISASSEMBLY (bag → kg)
      // A bag SKU has a DisassemblyUOM (col M) set
      const bom = [];
      rows.forEach(r => {
        const disUOM = String(r[12]||'').trim(); // col M
        const asmUOM = String(r[13]||'').trim(); // col N
        if (!disUOM || disUOM === '—') return;  // skip kg SKUs (no disassembly target)

        // Parse output SKU code from format "10461 (Int1/kg)"
        const outCodeMatch = disUOM.match(/^(\S+)/);
        const outCode = outCodeMatch ? outCodeMatch[1] : '';
        // Find output SKU name from sheet
        const outRow = rows.find(r2 => String(r2[0]).trim() === outCode);
        const outName = outRow ? String(outRow[1]).trim() : disUOM;

        bom.push({
          sourceSku:    String(r[0]).trim(),
          sourceName:   String(r[1]).trim(),
          bagSizeKg:    Number(r[4]||0),   // unit col = selling unit (kg size)
          outputSku:    outCode,
          outputName:   outName,
          ratio:        Number(r[14])||0,   // col O = standard ratio
          active:       'YES',
          verified:     'YES',
          notes:        '',
          // Assembly direction
          assemblyUOM:  asmUOM,
          canAssemble:  false   // bag SKUs disassemble only
        });
      });

      // Build ASSEMBLY entries (kg → bag) for reverse production
      rows.forEach(r => {
        const asmUOM = String(r[13]||'').trim(); // col N
        if (!asmUOM || asmUOM === '—') return; // skip bag SKUs

        const srcCodeMatch = asmUOM.match(/^(\S+)/);
        const srcCode = srcCodeMatch ? srcCodeMatch[1] : '';
        const srcRow  = rows.find(r2 => String(r2[0]).trim() === srcCode);
        const srcName = srcRow ? String(srcRow[1]).trim() : asmUOM;

        bom.push({
          sourceSku:    String(r[0]).trim(),   // kg SKU = source for assembly
          sourceName:   String(r[1]).trim(),
          bagSizeKg:    0,
          outputSku:    srcCode,               // bag SKU = output
          outputName:   srcName,
          ratio:        Number(r[14])||0,
          active:       'YES',
          verified:     'YES',
          notes:        '',
          canAssemble:  true    // assembly direction
        });
      });

      return ok({bom});
    }

    // ── SUBMIT PRODUCTION ──────────────────────────────────────────────
    if (data.action === 'submitProduction') {
      const variance    = Number(data.standardUnits||0) - Number(data.unitsProduced||0);
      const variancePct = data.standardUnits > 0
        ? ((variance / data.standardUnits)*100).toFixed(2)+'%' : '0%';
      const log = getOrCreateSheet(ss,'Production Log',[
        'Timestamp','Submitted By','Direction','Source SKU','Source Name',
        'Qty Consumed','Output SKU','Output Name',
        'Standard Yield','Actual Yield','Variance','Variance %','Notes']);
      log.appendRow([
        data.timestamp, data.submittedBy,
        data.canAssemble ? 'ASSEMBLY' : 'DISASSEMBLY',
        data.sourceSku, data.sourceName, data.bagsConsumed,
        data.outputSku, data.outputName,
        data.standardUnits||data.unitsProduced,
        data.unitsProduced, variance, variancePct,
        data.notes||''
      ]);
      const cs = getOrCreateSheet(ss,'Stock Counts - Retail',[
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);
      cs.appendRow([data.timestamp,data.submittedBy,'Production',
        data.sourceSku,data.sourceName,-data.bagsConsumed,'bag','RETAIL','Production']);
      cs.appendRow([data.timestamp,data.submittedBy,'Production',
        data.outputSku,data.outputName,data.unitsProduced,'kg','RETAIL','Production']);
      return ok({});
    }

    // ── CREATE PO ─────────────────────────────────────────────────────
    if (data.action === 'createPO') {
      const poSheet = getOrCreateSheet(ss,'Purchase Orders',[
        'PO Number','Type','Supplier','Status','Created By','Created Date',
        'Approved By','Approved Date','Delivery Date','Total Value','Notes']);
      const liSheet = getOrCreateSheet(ss,'PO Line Items',[
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status']);
      poSheet.appendRow([data.poNumber,data.type,data.supplier,data.status,
        data.createdBy,data.createdDate,'','',
        data.deliveryDate||'',data.totalValue||0,data.notes||'']);
      (data.lineItems||[]).forEach(li=>liSheet.appendRow(li));
      return ok({poNumber:data.poNumber});
    }

    // ── GET POs ───────────────────────────────────────────────────────
    if (data.action === 'getPOs') {
      const sheet = ss.getSheetByName('Purchase Orders');
      if (!sheet) return ok({pos:[]});
      const rows = sheet.getDataRange().getValues();
      const pos = rows.slice(1).filter(r=>r[0]).map(r=>({
        poNumber:String(r[0]),type:String(r[1]),supplier:String(r[2]),
        status:String(r[3]),createdBy:String(r[4]),createdDate:String(r[5]),
        approvedBy:String(r[6]||''),deliveryDate:String(r[8]||''),
        totalValue:Number(r[9]||0),notes:String(r[10]||''),lineCount:0}));
      const liSheet = ss.getSheetByName('PO Line Items');
      if (liSheet) {
        liSheet.getDataRange().getValues().slice(1).forEach(li=>{
          const po=pos.find(p=>p.poNumber===String(li[0]));
          if(po)po.lineCount=(po.lineCount||0)+1;});
      }
      return ok({pos});
    }

    // ── GET PO DETAIL ─────────────────────────────────────────────────
    if (data.action === 'getPODetail') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet) return err('Purchase Orders sheet not found');
      const poRows = poSheet.getDataRange().getValues();
      const poRow = poRows.slice(1).find(r=>String(r[0])===data.poNumber);
      if (!poRow) return err('PO not found: '+data.poNumber);
      const po={
        poNumber:         String(poRow[0]),
        type:             String(poRow[1]),
        supplier:         String(poRow[2]),
        status:           String(poRow[3]),
        createdBy:        String(poRow[4]),
        createdDate:      String(poRow[5]),
        approvedBy:       String(poRow[6]||''),
        totalValue:       Number(poRow[9]||0),
        notes:            String(poRow[10]||''),
        paymentTermsDays: String(poRow[11]||''),
        paymentMode:      String(poRow[12]||''),
        chequeRef:        String(poRow[13]||''),
        dueDate:          String(poRow[14]||''),
        rejectionReason:  String(poRow[15]||''),
        docRef:           String(poRow[16]||''),
        dateReceived:     String(poRow[17]||''),
        receivedBy:       String(poRow[18]||'')
      };
      let lineItems=[];
      if(liSheet){
        lineItems=liSheet.getDataRange().getValues().slice(1)
          .filter(r=>String(r[0])===data.poNumber)
          .map(r=>({poNumber:String(r[0]),skuCode:String(r[1]),
            itemName:String(r[2]),category:String(r[3]),
            qtyOrdered:Number(r[4]||0),unit:String(r[5]||'bag'),
            unitCost:Number(r[6]||0),totalCost:Number(r[7]||0),
            qtyReceived:Number(r[8]||0),qtyOutstanding:Number(r[9]||0),
            lineStatus:String(r[10]||'Open')}));
      }
      return ok({po,lineItems});
    }

    // ── APPROVE PO ────────────────────────────────────────────────────
    if (data.action === 'approvePO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = new Date().toLocaleString('en-PH');
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('APPROVED');
          sheet.getRange(i+1, 7).setValue(data.approvedBy);
          sheet.getRange(i+1, 8).setValue(now);
          // Delivery date — correctable at approval (col 9)
          if(data.deliveryDate) sheet.getRange(i+1, 9).setValue(data.deliveryDate);
          // Payment terms — cols 12-15
          sheet.getRange(i+1,12).setValue(data.paymentTermsDays || '');
          sheet.getRange(i+1,13).setValue(data.paymentMode      || '');
          sheet.getRange(i+1,14).setValue(data.chequeRef        || '');
          sheet.getRange(i+1,15).setValue(data.dueDate          || '');
          break;
        }
      }
      return ok({});
    }

    // ── REJECT PO ─────────────────────────────────────────────────────
    if (data.action === 'rejectPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = new Date().toLocaleString('en-PH');
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('REJECTED');
          sheet.getRange(i+1, 7).setValue(data.rejectedBy);
          sheet.getRange(i+1, 8).setValue(now);
          // Rejection reason col 16
          sheet.getRange(i+1,16).setValue(data.reason||'');
          break;
        }
      }
      return ok({});
    }

    // ── RESUBMIT PO (creator resubmits after rejection) ───────────────
    if (data.action === 'resubmitPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = new Date().toLocaleString('en-PH');
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('PENDING');
          // Log resubmission in notes col 11
          const existing = String(rows[i][10]||'');
          sheet.getRange(i+1,11).setValue(
            (existing?existing+' | ':'')+'Resubmitted by '+data.resubmittedBy+' on '+now
          );
          break;
        }
      }
      return ok({});
    }

    // ── CANCEL PO ─────────────────────────────────────────────────────
    if (data.action === 'cancelPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1,4).setValue('CANCELLED');
          const n=rows[i][10]||'';
          sheet.getRange(i+1,11).setValue(n+(n?' | ':'')+'Cancelled by: '+data.cancelledBy);
          break;
        }
      }
      return ok({});
    }

    // ── RECEIVE PO ────────────────────────────────────────────────────
    if (data.action === 'receivePO') {
      const poSheet=ss.getSheetByName('Purchase Orders');
      const liSheet=ss.getSheetByName('PO Line Items');
      if(!poSheet||!liSheet)return err('Sheets not found');
      const liRows=liSheet.getDataRange().getValues();
      const now=new Date().toLocaleString('en-PH');

      // Update line items with received qty and actual cost
      (data.receipts||[]).forEach(receipt=>{
        for(let i=1;i<liRows.length;i++){
          if(String(liRows[i][0])===data.poNumber&&String(liRows[i][1])===receipt.skuCode){
            const newRec=Number(liRows[i][8]||0)+Number(receipt.qtyReceived);
            const newOut=Math.max(0,Number(liRows[i][4]||0)-newRec);
            liSheet.getRange(i+1,9).setValue(newRec);
            liSheet.getRange(i+1,10).setValue(newOut);
            // Update actual unit cost if changed
            if(receipt.unitCost && receipt.unitCost!==liRows[i][6]){
              liSheet.getRange(i+1,7).setValue(receipt.unitCost);
            }
            if(newOut<=0)liSheet.getRange(i+1,11).setValue('Closed');
            break;
          }
        }
      });

      // Determine new status
      const updatedLi=liSheet.getDataRange().getValues().slice(1)
        .filter(r=>String(r[0])===data.poNumber);
      const allFulfilled=updatedLi.every(r=>Number(r[9]||1)<=0);
      const anyReceived=updatedLi.some(r=>Number(r[8]||0)>0);
      const newStatus=allFulfilled?'RECEIVED':anyReceived?'PARTIAL':'APPROVED';

      // Update PO header: status + docRef + received date
      const poRows=poSheet.getDataRange().getValues();
      for(let i=1;i<poRows.length;i++){
        if(String(poRows[i][0])===data.poNumber){
          poSheet.getRange(i+1, 4).setValue(newStatus);
          if(data.docRef) poSheet.getRange(i+1,17).setValue(data.docRef);
          poSheet.getRange(i+1,18).setValue(now);
          poSheet.getRange(i+1,19).setValue(data.receivedBy);
          break;
        }
      }

      // Write STOCK IN entries to Stock Counts sheet
      const csName=data.poType==='RETAIL'?'Stock Counts - Retail':'Stock Counts - Distribution';
      const cs=getOrCreateSheet(ss,csName,[
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);
      (data.receipts||[]).forEach(r=>{
        cs.appendRow([
          now, data.receivedBy,
          'STOCK IN — ' + data.poNumber + (data.docRef?' ('+data.docRef+')':''),
          r.skuCode, r.itemName, r.qtyReceived,
          'bag', data.poType, 'PO Receipt'
        ]);
      });

      // ── GOOGLE CALENDAR PAYMENT REMINDER ─────────────────────────────
      // Due date is always based on actual receipt date so the reminder is accurate.
      //   COD / Cash / E-Wallet / Bank Transfer / Cheque "Upon Delivery" → due = receipt date
      //   Cheque with terms → due = receipt date + termsDays
      try {
        const poRowData = poRows.find(function(r){ return String(r[0])===data.poNumber; });
        if(poRowData){
          const paymentMode  = String(poRowData[12] || '');
          const termsDays    = Number(poRowData[11]) || 0;
          const receiptDate  = new Date();
          const dueDate      = new Date(receiptDate);
          if(termsDays > 0) dueDate.setDate(dueDate.getDate() + termsDays);

          const amount    = Number(poRowData[9]  || 0);
          const supplier  = String(poRowData[2]);
          const chequeRef = String(poRowData[13] || '');
          const docRef    = data.docRef || '';

          const title = '💳 Payment Due — ' + data.poNumber
            + ' · ' + supplier
            + ' · ₱' + amount.toLocaleString('en-PH',{minimumFractionDigits:2})
            + ' · ' + (paymentMode || 'Payment')
            + (chequeRef ? ' — Cheque: ' + chequeRef : '')
            + (docRef    ? ' — Ref: '    + docRef    : '');

          const desc = [
            'PO: '           + data.poNumber,
            'Supplier: '     + supplier,
            'Amount: ₱'      + amount.toLocaleString('en-PH',{minimumFractionDigits:2}),
            'Payment Mode: ' + (paymentMode || 'N/A'),
            'Terms: '        + (termsDays > 0 ? termsDays+' days from receipt' : 'Upon Delivery'),
            'Receipt Date: ' + receiptDate.toLocaleDateString('en-PH'),
            'Due Date: '     + dueDate.toLocaleDateString('en-PH'),
            chequeRef ? 'Cheque Ref: ' + chequeRef : '',
            docRef    ? 'Doc Ref: '    + docRef    : '',
            'Received By: '  + (data.receivedBy || '')
          ].filter(Boolean).join('\n');

          const cal   = CalendarApp.getDefaultCalendar();
          const event = cal.createAllDayEvent(title, dueDate, { description: desc });

          // Add popup reminders — only if due date is far enough away
          const msLeft = dueDate.getTime() - new Date().getTime();
          if(msLeft > 7*24*60*60000) event.addPopupReminder(7*24*60);
          if(msLeft > 3*24*60*60000) event.addPopupReminder(3*24*60);
          if(msLeft > 1*24*60*60000) event.addPopupReminder(1*24*60);
        }
      } catch(calErr) {
        Logger.log('Calendar event creation failed: ' + calErr.toString());
      }
      // ─────────────────────────────────────────────────────────────────

      return ok({newStatus});
    }


    // ── CREATE TRANSFER ───────────────────────────────────────────────
    if (data.action === 'createTransfer') {
      const hdrSheet = getOrCreateSheet(ss, 'Transfer Log', [
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ]);
      const now = new Date().toLocaleString('en-PH');
      (data.lineItems||[]).forEach(li => {
        hdrSheet.appendRow([
          data.trfNumber, data.fromLocation, data.toLocation, data.via,
          data.status || 'IN TRANSIT',
          data.createdBy, data.createdDate, '', '',
          li[1], li[2], li[3], 0, li[3],
          li[4] || 'bag', data.notes || ''
        ]);
      });
      return ok({ trfNumber: data.trfNumber });
    }

    // ── GET TRANSFERS ─────────────────────────────────────────────────
    if (data.action === 'getTransfers') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return ok({ transfers: [] }); // Sheet auto-created on first transfer submit
      const rows = sheet.getDataRange().getValues();
      // Group rows by Transfer No (one row per line item in sheet)
      const map = {};
      rows.slice(1).filter(r=>r[0]).forEach(r => {
        const num = String(r[0]);
        if (!map[num]) {
          map[num] = {
            trfNumber:    num,
            fromLocation: String(r[1]),
            toLocation:   String(r[2]),
            via:          String(r[3]),
            status:       String(r[4]),
            createdBy:    String(r[5]),
            createdDate:  String(r[6]),
            receivedBy:   String(r[7]||''),
            receivedDate: String(r[8]||''),
            notes:        String(r[15]||''),
            lineCount:    0
          };
        }
        map[num].lineCount++;
      });
      const transfers = Object.values(map)
        .sort((a,b)=>new Date(b.createdDate)-new Date(a.createdDate));
      return ok({ transfers });
    }

    // ── GET TRANSFER DETAIL ───────────────────────────────────────────
    if (data.action === 'getTransferDetail') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return err('No transfers found yet — create a transfer first');
      const rows = sheet.getDataRange().getValues();
      const trfRows = rows.slice(1).filter(r=>String(r[0])===data.trfNumber);
      if (!trfRows.length) return err('Transfer not found: '+data.trfNumber);
      const first = trfRows[0];
      const transfer = {
        trfNumber:    String(first[0]),
        fromLocation: String(first[1]),
        toLocation:   String(first[2]),
        via:          String(first[3]),
        status:       String(first[4]),
        createdBy:    String(first[5]),
        createdDate:  String(first[6]),
        receivedBy:   String(first[7]||''),
        notes:        String(first[15]||'')
      };
      const lineItems = trfRows.map((r,i) => ({
        lineIndex:     i,
        skuCode:       String(r[9]),
        itemName:      String(r[10]),
        qtyDispatched: Number(r[11]||0),
        qtyOrdered:    Number(r[11]||0),
        qtyReceived:   Number(r[12]||0),
        unit:          String(r[14]||'bag')
      }));
      return ok({ transfer, lineItems });
    }

    // ── ACKNOWLEDGE TRANSFER ──────────────────────────────────────────
    if (data.action === 'acknowledgeTransfer') {
      const sheet = getOrCreateSheet(ss, 'Transfer Log', [
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ]);
      const rows = sheet.getDataRange().getValues();
      const now = new Date().toLocaleString('en-PH');
      let allReceived = true;

      // Update each line item's received qty and check if all fulfilled
      (data.receipts||[]).forEach(receipt => {
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber &&
              String(rows[i][9]) === String(receipt.skuCode)) {
            const newRec = Number(rows[i][12]||0) + Number(receipt.qtyReceived);
            const dispatched = Number(rows[i][11]||0);
            sheet.getRange(i+1, 13).setValue(newRec);    // Qty Received
            sheet.getRange(i+1, 14).setValue(dispatched - newRec); // Discrepancy
            sheet.getRange(i+1, 8).setValue(data.receivedBy);
            sheet.getRange(i+1, 9).setValue(now);
            if (newRec < dispatched) allReceived = false;
            break;
          }
        }
      });

      // Check if any lines are still outstanding
      const allLines = rows.slice(1).filter(r=>String(r[0])===data.trfNumber);
      const fullyDone = allLines.every(r=>Number(r[12]||0)>=Number(r[11]||0));
      const newStatus = fullyDone ? 'RECEIVED' : 'PARTIAL';

      // Update status on all rows for this transfer
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          sheet.getRange(i+1, 5).setValue(newStatus);
        }
      }

      // ── INVENTORY UPDATE: only happens on acknowledgment ──
      const fromLoc = data.fromLocation;
      const toLoc   = data.toLocation;

      // Determine which stock count sheets to write to
      function getCountSheetName(location) {
        if (location === 'Retail Store') return 'Stock Counts - Retail';
        return 'Stock Counts - Distribution'; // WH, Bajaj1, Bajaj2
      }

      const fromSheetName = getCountSheetName(fromLoc);
      const toSheetName   = getCountSheetName(toLoc);
      const fromSheet = getOrCreateSheet(ss, fromSheetName, [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);
      const toSheet   = getOrCreateSheet(ss, toSheetName, [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category']);

      (data.receipts||[]).forEach(r => {
        // Deduct from source
        fromSheet.appendRow([now, data.receivedBy, fromLoc,
          r.skuCode, r.itemName, -r.qtyReceived,
          r.unit||'bag', 'TRANSFER', 'Transfer Out']);
        // Add to destination
        toSheet.appendRow([now, data.receivedBy, toLoc,
          r.skuCode, r.itemName, r.qtyReceived,
          r.unit||'bag', 'TRANSFER', 'Transfer In']);
      });

      return ok({ newStatus, toLocation: toLoc });
    }



    // ── GET PRODUCT LIST (prices + latest stock counts) ──────────────
    if (data.action === 'getProductList') {
      const distSkuSheet   = ss.getSheetByName('SKU Master');
      const retailSkuSheet = ss.getSheetByName('SKU Master - Retail');
      const distCntSheet   = ss.getSheetByName('Stock Counts - Distribution');
      const retailCntSheet = ss.getSheetByName('Stock Counts - Retail');

      // ── Build latest stock map per SKU from Stock Counts sheets ──
      // Stock Counts cols: Timestamp(0) SubmittedBy(1) Location(2) SKUCode(3)
      //                    ItemName(4) QtyOnHand(5) Unit(6) Type(7) Category(8)
      function buildStockMap(sheet) {
        const map = {}; // {skuCode: {stock, lastUpdated, unit}}
        if (!sheet) return map;
        const rows = sheet.getDataRange().getValues();
        rows.slice(1).filter(r=>r[0]&&r[3]).forEach(r=>{
          const code = String(r[3]).trim();
          const ts   = new Date(r[0]);
          if (!map[code] || ts > new Date(map[code].lastUpdated)) {
            map[code] = {
              stock:       Number(r[5]) || 0,
              lastUpdated: String(r[0]),
              unit:        String(r[6]||'units')
            };
          }
        });
        return map;
      }

      const distStock   = buildStockMap(distCntSheet);
      const retailStock = buildStockMap(retailCntSheet);

      // ── Build distribution product list ──
      const dist = [];
      if (distSkuSheet) {
        // Cols: A-Code B-Name C-Cat D-Type E-Order F-Active G-Notes
        //       H-Supplier I-Cost J-SellingPrice K-ParLevel
        distSkuSheet.getDataRange().getValues().slice(4)
          .filter(r=>r[0]&&String(r[5]).toUpperCase()==='YES')
          .forEach(r=>{
            const code = String(r[0]).trim();
            const stk  = distStock[code];
            dist.push({
              sku:         code,
              name:        String(r[1]).trim(),
              category:    String(r[2]).trim(),
              unit:        'bag',
              price:       Number(r[9])  || 0,
              parLevel:    Number(r[10]) || 0,
              stock:       stk ? stk.stock       : null,
              lastUpdated: stk ? stk.lastUpdated : null
            });
          });
      }

      // ── Build retail product list ──
      const retail = [];
      if (retailSkuSheet) {
        // Cols: A-Code B-Name C-Cat D-Type E-Unit F-Revenue G-Order
        //       H-Active I-Supplier J-Cost K-SellingPrice
        //       L-IsProductionItem M-DisassemblyUOM N-AssemblyUOM O-StandardRatio P-ParLevel
        retailSkuSheet.getDataRange().getValues().slice(4)
          .filter(r=>r[0]&&String(r[7]).toUpperCase()==='YES')
          .forEach(r=>{
            const code = String(r[0]).trim();
            const stk  = retailStock[code];
            retail.push({
              sku:         code,
              name:        String(r[1]).trim(),
              category:    String(r[2]).trim(),
              unit:        String(r[4]||'pc').trim(),
              price:       Number(r[10]) || 0,
              parLevel:    Number(r[15]) || 0,
              stock:       stk ? stk.stock       : null,
              lastUpdated: stk ? stk.lastUpdated : null
            });
          });
      }

      return ok({ dist, retail });
    }


    // ── UPDATE COST PRICES ────────────────────────────────────────────
    if (data.action === 'updateCostPrices') {
      const sheetName = data.type === 'retail'
        ? 'SKU Master - Retail'
        : 'SKU Master';
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) return err(sheetName + ' sheet not found');

      const rows = sheet.getDataRange().getValues();
      // Cost Price column:
      // Distribution SKU Master → col I (index 8)
      // Retail SKU Master       → col J (index 9)
      const costCol = data.type === 'retail' ? 10 : 9;
      let updated = 0;

      for (let i = 1; i < rows.length; i++) {
        const code = String(rows[i][0]).trim();
        if (!code) continue;
        if (data.edits.hasOwnProperty(code)) {
          sheet.getRange(i+1, costCol).setValue(Number(data.edits[code]) || 0);
          updated++;
        }
      }
      return ok({ updated });
    }

    // ── DECLINE TRANSFER (receiving staff refuses) ────────────────────
    if (data.action === 'declineTransfer') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return err('Transfer Log not found');
      const rows = sheet.getDataRange().getValues();
      const now  = new Date().toLocaleString('en-PH');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          sheet.getRange(i+1, 5).setValue('DECLINED');
          sheet.getRange(i+1, 8).setValue(data.declinedBy);
          sheet.getRange(i+1, 9).setValue(now);
          const existing = String(rows[i][15]||'');
          sheet.getRange(i+1, 16).setValue(
            (existing?existing+' | ':'') + 'Declined: ' + (data.reason||'')
          );
        }
      }
      return ok({ trfNumber: data.trfNumber });
    }

    // ── CANCEL TRANSFER (creator/admin cancels) ───────────────────────
    if (data.action === 'cancelTransfer') {
      const sheet = ss.getSheetByName('Transfer Log');
      if (!sheet) return err('Transfer Log not found');
      const rows = sheet.getDataRange().getValues();
      const now  = new Date().toLocaleString('en-PH');
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          sheet.getRange(i+1, 5).setValue('CANCELLED');
          sheet.getRange(i+1, 8).setValue(data.cancelledBy);
          sheet.getRange(i+1, 9).setValue(now);
          const existing = String(rows[i][15]||'');
          sheet.getRange(i+1, 16).setValue(
            (existing?existing+' | ':'') + 'Cancelled by: ' + data.cancelledBy +
            (data.reason ? ' — ' + data.reason : '')
          );
        }
      }
      return ok({ trfNumber: data.trfNumber });
    }


    // ── STOCK ADJUSTMENT ──────────────────────────────────────────────
    if (data.action === 'submitStockAdjustment') {
      const segment  = data.segment || 'dist';
      const adjType  = data.adjType || 'receive';
      const now      = data.timestamp || new Date().toLocaleString('en-PH');
      const user     = data.submittedBy || '';
      const notes    = data.notes || '';
      const batchRef = data.batchRef || '';

      // ── Stock Adjustments log sheet ──
      const logSheet = getOrCreateSheet(ss, 'Stock Adjustments', [
        'Batch Ref','Timestamp','Submitted By','Segment','Adj Type',
        'SKU Code','Item Name','Stock Before','Qty Input','Adj Qty',
        'Stock After','Cost (₱)','Notes'
      ]);

      // ── Stock Counts target sheet ──
      const csName = segment==='retail'
        ? 'Stock Counts - Retail'
        : 'Stock Counts - Distribution';
      const csType = segment==='retail' ? 'RETAIL' : 'DIST';
      const csSheet = getOrCreateSheet(ss, csName, [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'
      ]);

      (data.entries||[]).forEach(e => {
        // Log entry
        logSheet.appendRow([
          batchRef, now, user,
          segment.toUpperCase(), adjType.toUpperCase(),
          e.skuCode, e.skuName,
          e.currentStock, e.qtyInput,
          e.adjQty, e.stockAfter,
          e.cost || 0, notes
        ]);

        // Stock count adjustment entry
        const location = adjType.toUpperCase() + ' ADJUSTMENT';
        csSheet.appendRow([
          now, user, location,
          e.skuCode, e.skuName,
          e.adjQty,     // signed value (+/-)
          'unit', csType, adjType.toUpperCase()
        ]);
      });

      return ok({ adjusted: (data.entries||[]).length });
    }

    // ── IMPORT XERO SALES ─────────────────────────────────────────────
    if (data.action === 'importXeroSales') {
      const sheet = getOrCreateSheet(ss, 'Sales Log - Distribution', [
        'Invoice Number','Invoice Date','Due Date','Dealer',
        'SKU Code','Description','Qty','Unit Price (₱)','Line Amount (₱)',
        'Invoice Total (₱)','Amount Paid (₱)','Amount Due (₱)',
        'Status','Imported At','Imported By'
      ]);

      // Build set of existing invoice+sku combos to deduplicate
      const existing = new Set();
      const existingRows = sheet.getDataRange().getValues().slice(1);
      existingRows.forEach(r => {
        if (r[0] && r[4]) existing.add(String(r[0]).trim() + '|' + String(r[4]).trim());
      });

      const now = new Date().toLocaleString('en-PH');
      let imported = 0, skipped = 0;

      (data.rows || []).forEach(r => {
        const key = String(r.invoiceNumber).trim() + '|' + String(r.skuCode).trim();
        if (existing.has(key)) { skipped++; return; }
        sheet.appendRow([
          r.invoiceNumber, r.invoiceDate, r.dueDate, r.contactName,
          r.skuCode, r.description, r.quantity, r.unitAmount, r.lineAmount,
          r.invoiceTotal, r.amountPaid, r.amountDue,
          r.status, now, data.importedBy || ''
        ]);
        existing.add(key);
        imported++;
      });

      return ok({ imported, skipped });
    }

    // ── IMPORT LOYVERSE SALES ─────────────────────────────────────────
    if (data.action === 'importLoyverseSales') {
      const sheet = getOrCreateSheet(ss, 'Sales Log - Retail', [
        'Receipt No','Date','Time','Receipt Type','Category',
        'SKU','Item','Variant','Qty',
        'Gross Sales (₱)','Discounts (₱)','Net Sales (₱)',
        'Cost of Goods (₱)','Gross Profit (₱)','Taxes (₱)',
        'Cashier','Customer Name','Customer Contact','Store',
        'Status','Imported At','Imported By'
      ]);

      // Deduplicate by Receipt No + SKU + Variant
      const existing = new Set();
      sheet.getDataRange().getValues().slice(1).forEach(r => {
        if (r[0] && r[5]) existing.add(String(r[0]).trim()+'|'+String(r[5]).trim()+'|'+String(r[7]).trim());
      });

      const now = new Date().toLocaleString('en-PH');
      let imported = 0, skipped = 0;

      (data.rows || []).forEach(r => {
        const key = String(r.receiptNumber).trim()+'|'+String(r.sku).trim()+'|'+String(r.variant||'').trim();
        if (existing.has(key)) { skipped++; return; }
        sheet.appendRow([
          r.receiptNumber, r.date, r.time, r.receiptType, r.category,
          r.sku, r.item, r.variant||'',  r.qty,
          r.grossSales, r.discounts, r.netSales,
          r.cogs, r.grossProfit, r.taxes,
          r.cashier, r.customerName, r.customerContact, r.store,
          r.status, now, data.importedBy||''
        ]);
        existing.add(key);
        imported++;
      });

      return ok({ imported, skipped });
    }

    // ── GET LOYVERSE SALES ────────────────────────────────────────────
    if (data.action === 'getLoyverseSales') {
      const sheet = ss.getSheetByName('Sales Log - Retail');
      if (!sheet) return ok({ rows: [] });
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          receiptNumber:   String(r[0]),
          date:            String(r[1]),
          time:            String(r[2]),
          receiptType:     String(r[3]),
          category:        String(r[4]),
          sku:             String(r[5]),
          item:            String(r[6]),
          variant:         String(r[7]),
          qty:             Number(r[8])  || 0,
          grossSales:      Number(r[9])  || 0,
          discounts:       Number(r[10]) || 0,
          netSales:        Number(r[11]) || 0,
          cogs:            Number(r[12]) || 0,
          grossProfit:     Number(r[13]) || 0,
          taxes:           Number(r[14]) || 0,
          cashier:         String(r[15]),
          customerName:    String(r[16]),
          customerContact: String(r[17]),
          store:           String(r[18]),
          status:          String(r[19]),
          importedAt:      String(r[20]),
          importedBy:      String(r[21])
        }));
      return ok({ rows });
    }

    // ── GET XERO SALES ────────────────────────────────────────────────
    if (data.action === 'getXeroSales') {
      const sheet = ss.getSheetByName('Sales Log - Distribution');
      if (!sheet) return ok({ rows: [] });
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          invoiceNumber: String(r[0]),
          invoiceDate:   String(r[1]),
          dueDate:       String(r[2]),
          dealer:        String(r[3]),
          skuCode:       String(r[4]),
          description:   String(r[5]),
          qty:           Number(r[6])  || 0,
          unitPrice:     Number(r[7])  || 0,
          lineAmount:    Number(r[8])  || 0,
          invoiceTotal:  Number(r[9])  || 0,
          amountPaid:    Number(r[10]) || 0,
          amountDue:     Number(r[11]) || 0,
          status:        String(r[12]),
          importedAt:    String(r[13]),
          importedBy:    String(r[14])
        }));
      return ok({ rows });
    }

    // ── GET SUPPLIERS ─────────────────────────────────────────────────
    if (data.action === 'getSuppliers') {
      const sheet = getOrCreateSheet(ss, 'Suppliers', [
        'Name','Type','Contact','Default Payment Mode',
        'Default Terms','Delivery Day','Lead Time','Notes'
      ]);
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          name:        String(r[0]),
          type:        String(r[1] || 'DIST'),
          contact:     String(r[2] || ''),
          defPayMode:  String(r[3] || ''),
          defTerms:    String(r[4] || ''),
          deliveryDay: String(r[5] || ''),
          leadTime:    String(r[6] || ''),
          notes:       String(r[7] || '')
        }));
      return ok({ suppliers: rows });
    }

    // ── ADD SUPPLIER ──────────────────────────────────────────────────
    if (data.action === 'addSupplier') {
      const sheet = getOrCreateSheet(ss, 'Suppliers', [
        'Name','Type','Contact','Default Payment Mode',
        'Default Terms','Delivery Day','Lead Time','Notes'
      ]);
      const exists = sheet.getDataRange().getValues().slice(1)
        .find(r => String(r[0]).toLowerCase() === String(data.name).toLowerCase());
      if (exists) return err('Supplier already exists: ' + data.name);
      sheet.appendRow([
        data.name, data.type || 'DIST', data.contact || '',
        data.defPayMode || '', data.defTerms || '',
        data.deliveryDay || '', data.leadTime || '', data.notes || ''
      ]);
      return ok({});
    }

    // ── UPDATE SUPPLIER ───────────────────────────────────────────────
    if (data.action === 'updateSupplier') {
      const sheet = ss.getSheetByName('Suppliers');
      if (!sheet) return err('Suppliers sheet not found');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === String(data.originalName).toLowerCase()) {
          sheet.getRange(i+1,1).setValue(data.name);
          sheet.getRange(i+1,2).setValue(data.type        || 'DIST');
          sheet.getRange(i+1,3).setValue(data.contact     || '');
          sheet.getRange(i+1,4).setValue(data.defPayMode  || '');
          sheet.getRange(i+1,5).setValue(data.defTerms    || '');
          sheet.getRange(i+1,6).setValue(data.deliveryDay || '');
          sheet.getRange(i+1,7).setValue(data.leadTime    || '');
          sheet.getRange(i+1,8).setValue(data.notes       || '');
          return ok({});
        }
      }
      return err('Supplier not found: ' + data.originalName);
    }

    // ── REMOVE SUPPLIER ───────────────────────────────────────────────
    if (data.action === 'removeSupplier') {
      const sheet = ss.getSheetByName('Suppliers');
      if (!sheet) return err('Suppliers sheet not found');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).toLowerCase() === String(data.name).toLowerCase()) {
          sheet.deleteRow(i + 1);
          return ok({});
        }
      }
      return err('Supplier not found: ' + data.name);
    }

    // ── UPDATE PO DRAFT ───────────────────────────────────────────────
    if (data.action === 'updatePODraft') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet) return err('Purchase Orders sheet not found');
      const poRows = poSheet.getDataRange().getValues();
      let found = false;
      for (let i = 1; i < poRows.length; i++) {
        if (String(poRows[i][0]) === data.poNumber) {
          const editableStatuses = ['DRAFT','REJECTED'];
          if (!editableStatuses.includes(String(poRows[i][3]))) return err('Only DRAFT or REJECTED POs can be edited');
          poSheet.getRange(i+1, 2).setValue(data.type         || poRows[i][1]);
          poSheet.getRange(i+1, 3).setValue(data.supplier     || poRows[i][2]);
          poSheet.getRange(i+1, 4).setValue(data.status       || 'DRAFT');
          poSheet.getRange(i+1, 9).setValue(data.deliveryDate || '');
          poSheet.getRange(i+1,10).setValue(data.totalValue   || 0);
          poSheet.getRange(i+1,11).setValue(data.notes        || '');
          found = true;
          break;
        }
      }
      if (!found) return err('PO not found: ' + data.poNumber);
      // Replace line items: delete existing rows then re-append
      if (liSheet) {
        const liRows = liSheet.getDataRange().getValues();
        const toDelete = [];
        for (let i = 1; i < liRows.length; i++) {
          if (String(liRows[i][0]) === data.poNumber) toDelete.push(i + 1);
        }
        for (let i = toDelete.length - 1; i >= 0; i--) liSheet.deleteRow(toDelete[i]);
      }
      const liNew = getOrCreateSheet(ss, 'PO Line Items', [
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status'
      ]);
      (data.lineItems || []).forEach(li => liNew.appendRow(li));
      return ok({ poNumber: data.poNumber });
    }

    // ── GET BACKORDERS ────────────────────────────────────────────────
    if (data.action === 'getBackorders') {
      function mapBoRow(r, i, type) {
        return {
          rowIndex:    i + 1,          // 1-based data row (header is row 1, data starts row 2)
          type:        type,
          timestamp:   String(r[0]),
          submittedBy: String(r[1]),
          dealer:      String(r[2]),   // dealer name or customer name
          phone:       String(r[3]),
          skuCode:     String(r[4]),
          itemName:    String(r[5]),
          qty:         Number(r[6]) || 0,
          unit:        String(r[7]),
          promisedDate:String(r[8]),
          status:      String(r[9])  || 'OPEN',
          notes:       String(r[10]) || ''
        };
      }
      const boDist   = ss.getSheetByName('Backorders');
      const boRetail = ss.getSheetByName('Backorders - Retail');
      const distRows   = boDist
        ? boDist.getDataRange().getValues().slice(1).filter(r=>r[0]).map((r,i)=>mapBoRow(r,i,'dist'))
        : [];
      const retailRows = boRetail
        ? boRetail.getDataRange().getValues().slice(1).filter(r=>r[0]).map((r,i)=>mapBoRow(r,i,'retail'))
        : [];
      return ok({ dist: distRows, retail: retailRows });
    }

    // ── UPDATE BACKORDER STATUS ────────────────────────────────────────
    if (data.action === 'updateBackorderStatus') {
      const boSheetName = data.boType === 'retail' ? 'Backorders - Retail' : 'Backorders';
      const boSheet = ss.getSheetByName(boSheetName);
      if (!boSheet) return err('Backorders sheet not found');
      const sheetRow = Number(data.rowIndex) + 1; // +1 for header row
      if (sheetRow < 2) return err('Invalid row index');
      const STATUS_COL = 10; // Column J
      boSheet.getRange(sheetRow, STATUS_COL).setValue(data.status);
      return ok({});
    }

    // ── STANDARD SHEET APPEND ──────────────────────────────────────────
    const sheetName = data.sheet;
    if (!sheetName) return err('No sheet name provided');
    const headerMap = {
      'Stock Movements':['Timestamp','Submitted By','Bajaj Unit','Mode',
        'SKU Code','Item Name','Category','Qty Loaded','Qty Returned','Qty Sold'],
      'Backorders':['Timestamp','Submitted By','Dealer Name','Dealer Phone',
        'SKU Code','Item Name','Qty Requested','Purchase Unit','Promised Date','Status','Notes'],
      'Backorders - Retail':['Timestamp','Submitted By','Customer Name','Contact Number',
        'SKU Code','Item Name','Qty Requested','Purchase Unit','Promised Date','Status','Notes'],
      'Deliveries':['Timestamp','Driver','Bajaj Unit','Dealer Name',
        'SKU Code','Item Name','Qty Delivered','Purchase Unit','Backorder?'],
      'Production Log':[
        'Timestamp','Submitted By','Source SKU','Source Name',
        'Bags Consumed','Output SKU','Output Name','Units Produced','Ratio','Verified'
      ],
      'Purchase Orders':[
        'PO Number','Type','Supplier','Status','Created By','Created Date',
        'Approved By','Approved Date','Delivery Date','Total Value','Notes',
        'Payment Terms (days)','Payment Mode','Cheque Ref','Due Date',
        'Rejection Reason','Doc Ref #','Date Received','Received By'
      ],
      'PO Line Items':[
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status'
      ],
      'Stock Counts - Distribution':['Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'],
      'Stock Counts - Retail':['Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'],
      'Transfer Log':[
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ],
      'Stock Adjustments':[
        'Batch Ref','Timestamp','Submitted By','Segment','Adj Type',
        'SKU Code','Item Name','Stock Before','Qty Input','Adj Qty',
        'Stock After','Cost (₱)','Notes'
      ],
    };
    const sheet = getOrCreateSheet(ss, sheetName, headerMap[sheetName]||null);
    data.rows.forEach(row => sheet.appendRow(row));

    // ── STOCK MOVEMENTS → STOCK COUNTS SYNC ──────────────────────────────
    // When a Stock Movement is submitted, compute the new absolute stock per
    // SKU and append a fresh entry to Stock Counts - Distribution so the
    // Product List reflects the change immediately.
    //   LOAD   → stock leaves the warehouse  → currentStock - qtyLoaded
    //   RETURN → unsold stock comes back     → currentStock + qtyReturned
    if (sheetName === 'Stock Movements') {
      const distCnt = getOrCreateSheet(ss, 'Stock Counts - Distribution',
        headerMap['Stock Counts - Distribution']);

      // Build current stock map: latest entry per SKU (sheet is append-only,
      // so the last row for a SKU is the most recent absolute count).
      const stockMap = {};
      distCnt.getDataRange().getValues().slice(1).forEach(function(r) {
        const sku = String(r[3]);
        if (!sku) return;
        stockMap[sku] = {
          qty:      Number(r[5]) || 0,
          itemName: String(r[4]),
          unit:     String(r[6]),
          type:     String(r[7]),
          category: String(r[8])
        };
      });

      const now = new Date();

      data.rows.forEach(function(row) {
        const mode        = String(row[3]);   // 'LOAD' or 'RETURN'
        const bajajUnit   = String(row[2]);
        const skuCode     = String(row[4]);
        const itemName    = String(row[5]);
        const category    = String(row[6]);
        const qtyLoaded   = Number(row[7]) || 0;
        const qtyReturned = Number(row[8]) || 0;

        if (!skuCode) return;

        const cur  = stockMap[skuCode] || { qty: 0, itemName: itemName,
          unit: '', type: 'Dist', category: category };
        var newQty = cur.qty;

        if      (mode === 'LOAD')   { newQty = cur.qty - qtyLoaded;   }
        else if (mode === 'RETURN') { newQty = cur.qty + qtyReturned; }
        else    { return; }  // unknown mode — skip

        // Update in-memory map so multiple rows for the same SKU chain correctly
        stockMap[skuCode] = { qty: newQty,
          itemName: cur.itemName || itemName,
          unit:     cur.unit,
          type:     cur.type,
          category: cur.category || category
        };

        // Append new absolute stock entry — buildStockMap() picks up
        // the latest row per SKU when Product List next loads.
        distCnt.appendRow([
          now,
          String(row[1]),              // Submitted By
          bajajUnit,                   // Location = Bajaj unit
          skuCode,
          cur.itemName || itemName,
          newQty,
          cur.unit     || '',
          cur.type     || 'Dist',
          cur.category || category
        ]);
      });
    }
    // ─────────────────────────────────────────────────────────────────────

    return ok({rows: data.rows.length});

  } catch(e) {
    return err(e.toString());
  }
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1,1,1,headers.length)
           .setFontWeight('bold').setBackground('#1F4E78').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'ok',...data}))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({status:'error',msg}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return ok({msg:'Alfrisco Inventory webhook active'});
}
