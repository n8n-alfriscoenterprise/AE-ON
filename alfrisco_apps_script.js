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
                         'CanProduction','CanTransfer','CanViewProductList','CanStockAdjust','PLView',
                         'CanManageDealers','CanCreateInvoice']);
        sheet.appendRow(['Adrian','admin2026','admin','All',
                         'YES','YES','YES','YES','YES','YES','YES','YES','YES','YES','both','YES','YES']);
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
        plView:            String(r[14]|| 'both').toLowerCase() || 'both',
        canManageDealers:  String(r[15]|| 'NO').toUpperCase()  === 'YES',
        canCreateInvoice:  String(r[16]|| 'NO').toUpperCase()  === 'YES'
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
                         'CanProduction','CanTransfer','CanViewProductList','CanStockAdjust','PLView',
                         'CanManageDealers','CanCreateInvoice']);
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
          sheet.getRange(i+1, 14).setValue(data.canStockAdjust     ? 'YES' : 'NO');
          sheet.getRange(i+1, 15).setValue(data.plView || 'both');
          sheet.getRange(i+1, 16).setValue(data.canManageDealers   ? 'YES' : 'NO');
          sheet.getRange(i+1, 17).setValue(data.canCreateInvoice   ? 'YES' : 'NO');
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
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r=>{
          if(!r[0]) return false;
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[0]).slice(0,10);
          return ts===today;
        })
        .filter(r=>String(r[2])===data.unit&&String(r[3])==='LOAD')
        .map(r=>({code:String(r[4]),name:String(r[5]),cat:String(r[6]),
          loaded:Number(r[7])||0,returned:Number(r[8])||0,sold:Number(r[9])||0}));
      return ok({rows});
    }


    // ── GET PRODUCTION BOM (now reads from SKU Master - Retail) ──────────
    if (data.action === 'getBOM') {
      const sheet = ss.getSheetByName('SKU Master - Retail');
      if (!sheet) return ok({bom:[]});
      // Cols: A-Code B-Name C-Cat D-Type E-Unit F-Rev G-Order H-Active
      //       I-Supplier J-Cost K-SellingPrice
      //       L-IsProductionItem M-DisassemblyUOM N-AssemblyUOM O-StandardRatio

      // allRows — full sheet, used for cross-reference lookups
      const allRows = sheet.getDataRange().getValues().slice(4).filter(r => r[0]);

      // prodRows — col H Active=YES AND col L IsProductionItem=YES
      const prodRows = allRows.filter(r =>
        String(r[7]||'').toUpperCase()  === 'YES' &&
        String(r[11]||'').toUpperCase() === 'YES'
      );

      // Find any SKU across the full sheet (not just production rows)
      function findSku(code) {
        return allRows.find(r => String(r[0]).trim() === String(code||'').trim()) || null;
      }

      // Extract SKU code from cell values like "SKU001 (Name)" or plain "SKU001"
      function parseSkuCode(cell) {
        const m = String(cell||'').trim().match(/^([^\s(]+)/);
        return m ? m[1] : String(cell||'').trim();
      }

      const bom = [];

      prodRows.forEach(r => {
        const code     = String(r[0]).trim();
        const name     = String(r[1]).trim();
        const category = String(r[2]||'').trim(); // col C
        const ratio    = Number(r[14]) || 0;
        const disUOM   = String(r[12]||'').trim(); // col M — DisassemblyUOM
        const asmUOM   = String(r[13]||'').trim(); // col N — AssemblyUOM

        const sourceUnit     = String(r[4]||'').trim(); // col E
        const hasDisassembly = disUOM && disUOM !== '—';
        const hasAssembly    = asmUOM && asmUOM !== '—';

        if (hasDisassembly) {
          const outCode    = parseSkuCode(disUOM);
          const outRow     = findSku(outCode);
          const outputUnit = outRow ? String(outRow[4]||'').trim() : '';
          bom.push({
            sourceSku:   code,
            sourceName:  name,
            category:    category,
            sourceUnit:  sourceUnit,
            outputSku:   outCode,
            outputName:  outRow ? String(outRow[1]).trim() : outCode,
            outputUnit:  outputUnit,
            ratio:       ratio,
            canAssemble: false
          });

        } else if (hasAssembly) {
          const outCode    = parseSkuCode(asmUOM);
          const outRow     = findSku(outCode);
          const outputUnit = outRow ? String(outRow[4]||'').trim() : '';
          bom.push({
            sourceSku:   code,
            sourceName:  name,
            category:    category,
            sourceUnit:  sourceUnit,
            outputSku:   outCode,
            outputName:  outRow ? String(outRow[1]).trim() : outCode,
            outputUnit:  outputUnit,
            ratio:       outRow ? (Number(outRow[14])||ratio) : ratio,
            canAssemble: true
          });

        } else {
          bom.push({
            sourceSku:   code,
            sourceName:  name,
            category:    category,
            sourceUnit:  sourceUnit,
            outputSku:   '',
            outputName:  '(output not configured)',
            outputUnit:  '',
            ratio:       ratio || 1,
            canAssemble: false
          });
        }
      });

      return ok({bom});
    }

    // ── SUBMIT PRODUCTION ──────────────────────────────────────────────
    if (data.action === 'submitProduction') {
      const variance    = Number(data.unitsProduced||0) - Number(data.standardUnits||0);
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
        data.sourceSku,data.sourceName,-data.bagsConsumed,data.sourceUnit||'','RETAIL','Production']);
      cs.appendRow([data.timestamp,data.submittedBy,'Production',
        data.outputSku,data.outputName,data.unitsProduced,data.outputUnit||'','RETAIL','Production']);
      return ok({});
    }

    // ── CREATE PO ─────────────────────────────────────────────────────
    if (data.action === 'createPO') {
      const poSheet = getOrCreateSheet(ss,'Purchase Orders',[
        'PO Number','Type','Supplier','Status','Created By','Created Date',
        'Approved By','Approved Date','Delivery Date','Total Value','Notes',
        'Payment Terms Days','Payment Mode','Cheque Ref','Due Date',
        'Rejection Reason','Doc Ref','Date Received','Received By','Payment History',
        'Amount Paid','Overpayment','Payment Schedule']);
      const liSheet = getOrCreateSheet(ss,'PO Line Items',[
        'PO Number','SKU Code','Item Name','Category',
        'Qty Ordered','Unit','Unit Cost','Total Cost',
        'Qty Received','Qty Outstanding','Line Status']);
      // Stamp date server-side in unambiguous ISO format (avoids M/D vs D/M
      // misinterpretation when Google Sheets auto-detects locale date strings)
      const createdDate = Utilities.formatDate(
        new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'
      );
      poSheet.appendRow([data.poNumber,data.type,data.supplier,data.status,
        data.createdBy, createdDate,'','',
        data.deliveryDate||'',data.totalValue||0,data.notes||'']);
      (data.lineItems||[]).forEach(li=>liSheet.appendRow(li));
      return ok({poNumber:data.poNumber});
    }

    // ── GET POs ───────────────────────────────────────────────────────
    if (data.action === 'getPOs') {
      const sheet = ss.getSheetByName('Purchase Orders');
      if (!sheet) return ok({pos:[]});
      const rows = sheet.getDataRange().getValues();
      // Build raw list then deduplicate by PO number (first row = canonical).
      // This prevents legacy duplicate rows (from double-submit bug) causing
      // status mismatches between the list view and the detail view.
      const seen = new Set();
      const pos = rows.slice(1).filter(r => {
        if (!r[0]) return false;
        const num = String(r[0]);
        if (seen.has(num)) return false;
        seen.add(num);
        return true;
      }).map(r=>({
        poNumber:  String(r[0]),
        type:      String(r[1]),
        supplier:  String(r[2]),
        status:    String(r[3]),
        createdBy: String(r[4]),
        // Safe date read: Sheets may return a Date object if it auto-detected the cell
        createdDate: r[5] instanceof Date
          ? Utilities.formatDate(r[5], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(r[5]||''),
        approvedBy:   String(r[6]||''),
        deliveryDate: String(r[8]||''),
        totalValue:   Number(r[9]||0),
        notes:        String(r[10]||''),
        lineCount:    0
      }));
      const liSheet = ss.getSheetByName('PO Line Items');
      if (liSheet) {
        // Deduplicate line items by PO+SKU so duplicate rows don't inflate counts
        const liSeen = new Set();
        liSheet.getDataRange().getValues().slice(1).forEach(li => {
          const key = String(li[0]) + '|' + String(li[1]);
          if (liSeen.has(key)) return;
          liSeen.add(key);
          const po = pos.find(p => p.poNumber === String(li[0]));
          if (po) po.lineCount = (po.lineCount||0) + 1;
        });
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
        deliveryDate:     String(poRow[8]||''),
        totalValue:       Number(poRow[9]||0),
        notes:            String(poRow[10]||''),
        paymentTermsDays: String(poRow[11]||''),
        paymentMode:      String(poRow[12]||''),
        chequeRef:        String(poRow[13]||''),
        dueDate:          String(poRow[14]||''),
        rejectionReason:  String(poRow[15]||''),
        docRef:           String(poRow[16]||''),
        dateReceived:     String(poRow[17]||''),
        receivedBy:       String(poRow[18]||''),
        paymentHistory:   String(poRow[19]||''),
        amountPaid:       Number(poRow[20]||0),
        overpayment:      Number(poRow[21]||0),
        paymentSchedule:  (() => { try{ return JSON.parse(String(poRow[22]||'[]')); }catch(e){ return []; } })()
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
            lineStatus:String(r[10]||'Open'),
            discount:Number(r[11]||0),discountType:String(r[12]||'%')}));
      }
      return ok({po,lineItems});
    }

    // ── APPROVE PO ────────────────────────────────────────────────────
    if (data.action === 'approvePO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // No break — update ALL rows matching this PO number so duplicates stay in sync
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('APPROVED');
          sheet.getRange(i+1, 7).setValue(data.approvedBy);
          sheet.getRange(i+1, 8).setValue(now);
          if(data.deliveryDate) sheet.getRange(i+1, 9).setValue(data.deliveryDate);
          sheet.getRange(i+1,12).setValue(data.paymentTermsDays || '');
          sheet.getRange(i+1,13).setValue(data.paymentMode      || '');
          sheet.getRange(i+1,14).setValue(data.chequeRef        || '');
          sheet.getRange(i+1,15).setValue(data.dueDate          || '');
          if(data.paymentSchedule) sheet.getRange(i+1,23).setValue(JSON.stringify(data.paymentSchedule));
        }
      }
      return ok({});
    }

    // ── REJECT PO ─────────────────────────────────────────────────────
    if (data.action === 'rejectPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // No break — update ALL rows matching this PO number
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('REJECTED');
          sheet.getRange(i+1, 7).setValue(data.rejectedBy);
          sheet.getRange(i+1, 8).setValue(now);
          sheet.getRange(i+1,16).setValue(data.reason||'');
        }
      }
      return ok({});
    }

    // ── RESUBMIT PO (creator resubmits after rejection) ───────────────
    if (data.action === 'resubmitPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // No break — update ALL rows matching this PO number
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1, 4).setValue('PENDING');
          const existing = String(rows[i][10]||'');
          sheet.getRange(i+1,11).setValue(
            (existing?existing+' | ':'')+'Resubmitted by '+data.resubmittedBy+' on '+now
          );
        }
      }
      return ok({});
    }

    // ── CANCEL PO ─────────────────────────────────────────────────────
    if (data.action === 'cancelPO') {
      const sheet=ss.getSheetByName('Purchase Orders');
      if(!sheet)return err('Sheet not found');
      const rows=sheet.getDataRange().getValues();
      // No break — update ALL rows matching this PO number
      for(let i=1;i<rows.length;i++){
        if(String(rows[i][0])===data.poNumber){
          sheet.getRange(i+1,4).setValue('CANCELLED');
          const n=rows[i][10]||'';
          sheet.getRange(i+1,11).setValue(n+(n?' | ':'')+'Cancelled by: '+data.cancelledBy);
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
      const now=Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

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
      var calendarNote = '';
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

          const title = 'Payment Due — ' + data.poNumber
            + ' · ' + supplier
            + ' · ₱' + amount.toLocaleString('en-PH',{minimumFractionDigits:2})
            + ' · ' + (paymentMode || 'Payment')
            + (chequeRef ? ' — Cheque: ' + chequeRef : '')
            + (docRef    ? ' — Ref: '    + docRef    : '');

          const desc = [
            'PO: '           + data.poNumber,
            'Supplier: '     + supplier,
            'Amount: ₱' + amount.toLocaleString('en-PH',{minimumFractionDigits:2}),
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

          calendarNote = 'Event created for ' + dueDate.toLocaleDateString('en-PH');
        } else {
          calendarNote = 'PO row not found in poRows — no event created';
        }
      } catch(calErr) {
        calendarNote = 'ERROR: ' + calErr.toString();
        Logger.log('Calendar event creation failed: ' + calErr.toString());
      }
      // ─────────────────────────────────────────────────────────────────

      return ok({newStatus, calendarNote});
    }


    // ── CREATE TRANSFER ───────────────────────────────────────────────
    if (data.action === 'createTransfer') {
      const hdrSheet = getOrCreateSheet(ss, 'Transfer Log', [
        'Transfer No','From Location','To Location','Via','Status',
        'Created By','Created Date','Received By','Received Date',
        'SKU Code','Item Name','Qty Dispatched','Qty Received',
        'Discrepancy','Unit','Notes'
      ]);
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      (data.lineItems||[]).forEach(li => {
        hdrSheet.appendRow([
          data.trfNumber, data.fromLocation, data.toLocation, data.via,
          data.status || 'IN TRANSIT',
          data.createdBy, now, '', '',
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
            createdDate:  r[6] instanceof Date ? Utilities.formatDate(r[6], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(r[6]||''),
            receivedBy:   String(r[7]||''),
            receivedDate: r[8] instanceof Date ? Utilities.formatDate(r[8], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(r[8]||''),
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
        createdDate:  first[6] instanceof Date ? Utilities.formatDate(first[6], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : String(first[6]||''),
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
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      let allReceived = true;

      // Update each line item's received qty — also mirror updates into rows[] so
      // the fullyDone check below sees the new values, not the pre-write snapshot
      (data.receipts||[]).forEach(receipt => {
        for (let i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber &&
              String(rows[i][9]) === String(receipt.skuCode)) {
            const newRec = Number(rows[i][12]||0) + Number(receipt.qtyReceived);
            const dispatched = Number(rows[i][11]||0);
            sheet.getRange(i+1, 13).setValue(newRec);
            sheet.getRange(i+1, 14).setValue(dispatched - newRec);
            sheet.getRange(i+1, 8).setValue(data.receivedBy);
            sheet.getRange(i+1, 9).setValue(now);
            rows[i][12] = newRec;           // keep in-memory copy in sync
            rows[i][13] = dispatched - newRec;
            if (newRec < dispatched) allReceived = false;
            break;
          }
        }
      });

      // Now rows[] reflects the updated values — this check is accurate
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
          const code    = String(r[3]).trim();
          // Normalise timestamp — Sheets auto-converts stored date strings to Date objects
          const tsFormatted = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[0]);
          const ts = new Date(tsFormatted);
          if (!map[code] || ts > new Date(map[code].lastUpdated)) {
            map[code] = {
              stock:       Number(r[5]) || 0,
              lastUpdated: tsFormatted,   // always an ISO string now, never a raw toString()
              unit:        String(r[6]||'units')
            };
          }
        });
        return map;
      }

      const distStock   = buildStockMap(distCntSheet);
      const retailStock = buildStockMap(retailCntSheet);

      // ── Build distribution product list ──
      const includeInactive = data.includeInactive === true;
      const dist = [];
      if (distSkuSheet) {
        // Cols: A-Code B-Name C-Cat D-Type E-Order F-Active G-Notes
        //       H-Supplier I-Cost J-SellingPrice K-ParLevel
        distSkuSheet.getDataRange().getValues().slice(4)
          .filter(r=>r[0]&&(includeInactive||String(r[5]).toUpperCase()==='YES'))
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
          .filter(r=>r[0]&&(includeInactive||String(r[7]).toUpperCase()==='YES'))
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
      const now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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
      const now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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
      const now      = data.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
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

    // ── DEALER DIRECTORY ─────────────────────────────────────────────
    if (data.action === 'getDealers') {
      const sheet = getOrCreateSheet(ss, 'Dealer Directory', [
        'Dealer ID','Store Name','Owner Name','Phone 1','Phone 2',
        'Area','Address','Dealer Type','Status',
        'Latitude','Longitude','GPS Accuracy (m)',
        'Notes','Added By','Date Added','Updated By','Last Updated'
      ]);
      const rows = sheet.getDataRange().getValues().slice(1)
        .filter(r => r[0])
        .map(r => ({
          dealerId:   String(r[0]),
          storeName:  String(r[1]),
          ownerName:  String(r[2]),
          phone1:     String(r[3]),
          phone2:     String(r[4]||''),
          area:       String(r[5]||''),
          address:    String(r[6]||''),
          dealerType: String(r[7]||''),
          status:     String(r[8]||'Prospect'),
          lat:        String(r[9]||''),
          lng:        String(r[10]||''),
          accuracy:   String(r[11]||''),
          notes:      String(r[12]||''),
          addedBy:    String(r[13]||''),
          addedAt:    r[14] instanceof Date
            ? Utilities.formatDate(r[14], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[14]||''),
          updatedBy:  String(r[15]||''),
          updatedAt:  r[16] instanceof Date
            ? Utilities.formatDate(r[16], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[16]||'')
        }));
      return ok({ dealers: rows });
    }

    if (data.action === 'saveDealer') {
      const sheet = getOrCreateSheet(ss, 'Dealer Directory', [
        'Dealer ID','Store Name','Owner Name','Phone 1','Phone 2',
        'Area','Address','Dealer Type','Status',
        'Latitude','Longitude','GPS Accuracy (m)',
        'Notes','Added By','Date Added','Updated By','Last Updated'
      ]);
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      // Generate Dealer ID: DLR-YYYYMMDD-NNN
      const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
      const existing = sheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]).includes(dateStr));
      const dealerId = 'DLR-' + dateStr + '-' + String(existing.length + 1).padStart(3,'0');
      sheet.appendRow([
        dealerId,
        data.storeName || '', data.ownerName || '',
        data.phone1 || '',    data.phone2 || '',
        data.area || '',      data.address || '',
        data.dealerType || '', data.status || 'Prospect',
        data.lat || '',       data.lng || '',  data.accuracy || '',
        data.notes || '',
        data.addedBy || '', now,
        '', ''
      ]);
      return ok({ dealerId });
    }

    if (data.action === 'updateDealer') {
      const sheet = ss.getSheetByName('Dealer Directory');
      if (!sheet) return err('Dealer Directory sheet not found');
      const now  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) !== data.dealerId) continue;
        sheet.getRange(i+1, 2).setValue(data.storeName  || '');
        sheet.getRange(i+1, 3).setValue(data.ownerName  || '');
        sheet.getRange(i+1, 4).setValue(data.phone1     || '');
        sheet.getRange(i+1, 5).setValue(data.phone2     || '');
        sheet.getRange(i+1, 6).setValue(data.area       || '');
        sheet.getRange(i+1, 7).setValue(data.address    || '');
        sheet.getRange(i+1, 8).setValue(data.dealerType || '');
        sheet.getRange(i+1, 9).setValue(data.status     || '');
        sheet.getRange(i+1,10).setValue(data.lat        || '');
        sheet.getRange(i+1,11).setValue(data.lng        || '');
        sheet.getRange(i+1,12).setValue(data.accuracy   || '');
        sheet.getRange(i+1,13).setValue(data.notes      || '');
        sheet.getRange(i+1,16).setValue(data.updatedBy  || '');
        sheet.getRange(i+1,17).setValue(now);
        return ok({ dealerId: data.dealerId, updatedAt: now });
      }
      return err('Dealer not found: ' + data.dealerId);
    }

    if (data.action === 'deleteDealer') {
      const sheet = ss.getSheetByName('Dealer Directory');
      if (!sheet) return err('Dealer Directory sheet not found');
      const rows = sheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]) === data.dealerId) {
          sheet.deleteRow(i + 1);
          return ok({ deleted: data.dealerId });
        }
      }
      return err('Dealer not found: ' + data.dealerId);
    }

    // ── SALES INVOICES ────────────────────────────────────────────────
    if (data.action === 'saveInvoice') {
      const invSheet  = getOrCreateSheet(ss, 'Sales Invoices', [
        'Invoice Number','Contact Name','Dealer ID','Reference',
        'Invoice Date','Due Date','Payment Terms','Subtotal','Total',
        'Status','Created By','Created At'
      ]);
      const lineSheet = getOrCreateSheet(ss, 'Sales Invoice Lines', [
        'Invoice Number','Line #','SKU','Description',
        'Quantity','Unit Price','Discount %','Line Total'
      ]);

      // Generate invoice number: INV-YYYYMMDD-NNN
      const today  = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
      const prefix = 'INV-' + today + '-';
      const allRows = invSheet.getDataRange().getValues();
      let maxSeq = 0;
      allRows.slice(1).forEach(function(r){
        if (String(r[0]).startsWith(prefix)){
          const seq = parseInt(String(r[0]).slice(prefix.length)) || 0;
          if (seq > maxSeq) maxSeq = seq;
        }
      });
      const invoiceNumber = prefix + String(maxSeq + 1).padStart(3, '0');

      invSheet.appendRow([
        invoiceNumber,
        data.contactName  || '',
        data.dealerId     || '',
        data.reference    || '',
        data.invoiceDate  || '',
        data.dueDate      || '',
        data.paymentTerms || '',
        Number(data.subtotal) || 0,
        Number(data.total)    || 0,
        'Saved',
        data.createdBy || '',
        data.createdAt || ''
      ]);

      const lines = data.lines || [];
      lines.forEach(function(l, i){
        lineSheet.appendRow([
          invoiceNumber,
          i + 1,
          l.sku       || '',
          l.desc      || '',
          Number(l.qty)       || 0,
          Number(l.unitPrice) || 0,
          Number(l.discount)  || 0,
          Number(l.lineTotal) || 0
        ]);
      });

      return ok({ invoiceNumber: invoiceNumber });
    }

    if (data.action === 'getInvoices') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return ok({ invoices: [] });
      const rows = invSheet.getDataRange().getValues().slice(1)
        .filter(r => r[0]);
      // Return newest first, cap at 200
      const invoices = rows.reverse().slice(0, 200).map(function(r){
        return {
          invoiceNumber: String(r[0]),
          contactName:   String(r[1]),
          dealerId:      String(r[2]),
          reference:     String(r[3]),
          invoiceDate:   r[4] instanceof Date
            ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[4]),
          dueDate:       r[5] instanceof Date
            ? Utilities.formatDate(r[5], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[5]),
          paymentTerms:  String(r[6]),
          subtotal:      Number(r[7]) || 0,
          total:         Number(r[8]) || 0,
          status:        String(r[9]),
          createdBy:     String(r[10]),
          createdAt:     String(r[11])
        };
      });
      return ok({ invoices: invoices });
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

    // ── DELETE PO (admin only — removes PO row + all line items) ─────────
    if (data.action === 'deletePO') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet) return err('Purchase Orders sheet not found');

      // Delete matching rows in reverse order (bottom-up) to preserve row indices
      const poRows = poSheet.getDataRange().getValues();
      for (let i = poRows.length - 1; i >= 1; i--) {
        if (String(poRows[i][0]) === data.poNumber) {
          poSheet.deleteRow(i + 1);
        }
      }
      if (liSheet) {
        const liRows = liSheet.getDataRange().getValues();
        for (let i = liRows.length - 1; i >= 1; i--) {
          if (String(liRows[i][0]) === data.poNumber) {
            liSheet.deleteRow(i + 1);
          }
        }
      }
      return ok({ deleted: data.poNumber });
    }

    // ── UPDATE PO PAYMENT DETAILS (admin — APPROVED or PARTIAL only) ─────
    if (data.action === 'updatePOPayment') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      if (!poSheet) return err('Purchase Orders sheet not found');

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const poRows = poSheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < poRows.length; i++) {
        if (String(poRows[i][0]) !== data.poNumber) continue;

        const curStatus = String(poRows[i][3]);
        if (!['APPROVED','PARTIAL'].includes(curStatus)) {
          return err('Payment details can only be edited on APPROVED or PARTIAL POs');
        }

        // Build the history entry from the OLD values before overwriting
        const oldMode   = String(poRows[i][12] || '');
        const oldCheque = String(poRows[i][13] || '');
        const oldTerms  = String(poRows[i][11] || '');
        const oldDue    = String(poRows[i][14] || '');

        const oldAmount = Number(poRows[i][20] || 0);

        // Only log if there were actual old values to preserve
        if (oldMode || oldCheque || oldTerms || oldDue || oldAmount > 0) {
          const histEntry = '[' + now + ' — edited by ' + (data.editedBy || 'admin') + '] '
            + (oldMode   ? 'Mode: '   + oldMode   : '')
            + (oldCheque ? ' · Cheque #' + oldCheque : '')
            + (oldTerms  ? ' · Terms: '  + (oldTerms === '0' ? 'Upon Delivery' : oldTerms + ' days') : '')
            + (oldDue    ? ' · Due: '    + oldDue    : '')
            + (oldAmount > 0 ? ' · Amount Paid: ₱' + oldAmount : '');

          const existing = String(poRows[i][19] || '');
          const newHistory = existing ? existing + '|||' + histEntry : histEntry;
          poSheet.getRange(i + 1, 20).setValue(newHistory); // col 20 = Payment History
        }

        // Write new payment values
        poSheet.getRange(i + 1, 12).setValue(data.paymentTermsDays || '');
        poSheet.getRange(i + 1, 13).setValue(data.paymentMode      || '');
        poSheet.getRange(i + 1, 14).setValue(data.chequeRef        || '');
        poSheet.getRange(i + 1, 15).setValue(data.dueDate          || '');
        poSheet.getRange(i + 1, 21).setValue(data.amountPaid       || 0);   // col 21 = Amount Paid
        poSheet.getRange(i + 1, 22).setValue(data.overpayment      || 0);   // col 22 = Overpayment
        if(data.paymentSchedule !== undefined)
          poSheet.getRange(i + 1, 23).setValue(data.paymentSchedule ? JSON.stringify(data.paymentSchedule) : ''); // col 23 = Payment Schedule

        found = true;
        // No break — update ALL matching rows (safety for legacy duplicates)
      }

      if (!found) return err('PO not found: ' + data.poNumber);
      return ok({ poNumber: data.poNumber, updatedAt: now });
    }

    // ── MARK INSTALLMENT PAID ────────────────────────────────────────────
    if (data.action === 'markInstallmentPaid') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      if (!poSheet) return err('Purchase Orders sheet not found');
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const poRows = poSheet.getDataRange().getValues();
      let found = false;

      for (let i = 1; i < poRows.length; i++) {
        if (String(poRows[i][0]) !== data.poNumber) continue;

        // Parse existing schedule
        let schedule = [];
        try { schedule = JSON.parse(String(poRows[i][22] || '[]')); } catch(e) { return err('Invalid payment schedule data'); }

        const idx = Number(data.installmentIndex);
        if (!schedule[idx]) return err('Installment not found at index ' + idx);
        if (schedule[idx].status === 'Paid') return err('Installment ' + (idx+1) + ' is already marked as paid');

        // Update the installment
        schedule[idx].status     = 'Paid';
        schedule[idx].paidDate   = data.paidDate   || now.split(' ')[0];
        schedule[idx].paidAmount = Number(data.paidAmount || schedule[idx].amount);
        schedule[idx].paidBy     = data.markedBy   || '';

        poSheet.getRange(i + 1, 23).setValue(JSON.stringify(schedule));
        found = true;
        // No break — update all matching rows (safety for legacy duplicates)
      }

      if (!found) return err('PO not found: ' + data.poNumber);
      return ok({ poNumber: data.poNumber, installment: Number(data.installmentIndex) + 1, updatedAt: now });
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

    // ── GET PENDING COUNTS (home tile badges) ─────────────────────────
    if (data.action === 'getPendingCounts') {
      // Transfer: unique IN TRANSIT transfer numbers
      let transferCount = 0;
      const trfSheet = ss.getSheetByName('Transfer Log');
      if (trfSheet) {
        const seen = {};
        trfSheet.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach(r => {
          const num = String(r[0]);
          if (!seen[num] && String(r[4]).toUpperCase() === 'IN TRANSIT') {
            seen[num] = true; transferCount++;
          }
        });
      }
      // Backorders: OPEN + PARTIAL across both sheets
      let boCount = 0;
      ['Backorders','Backorders - Retail'].forEach(sn => {
        const s = ss.getSheetByName(sn);
        if (s) s.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach(r => {
          const st = String(r[9]||'').toUpperCase();
          if (st === 'OPEN' || st === 'PARTIAL') boCount++;
        });
      });
      // Movement: Bajaj units with a LOAD today but no RETURN
      let movCount = 0;
      const movSheet = ss.getSheetByName('Stock Movements');
      if (movSheet) {
        const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const loadUnits = new Set(), returnUnits = new Set();
        movSheet.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach(r => {
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
            : String(r[0]);
          if (!ts.startsWith(today)) return;
          const mode = String(r[3]).toUpperCase();
          if (mode === 'LOAD')   loadUnits.add(String(r[2]));
          if (mode === 'RETURN') returnUnits.add(String(r[2]));
        });
        loadUnits.forEach(u => { if (!returnUnits.has(u)) movCount++; });
      }
      return ok({ transferCount, boCount, movCount });
    }

    // ── DELETE BACKORDER ───────────────────────────────────────────────
    if (data.action === 'deleteBackorder') {
      const sn = data.boType === 'retail' ? 'Backorders - Retail' : 'Backorders';
      const s  = ss.getSheetByName(sn);
      if (!s) return err('Sheet not found');
      const sheetRow = Number(data.rowIndex) + 1;
      if (sheetRow < 2) return err('Invalid row');
      s.deleteRow(sheetRow);
      return ok({});
    }

    // ── EDIT BACKORDER ─────────────────────────────────────────────────
    if (data.action === 'editBackorder') {
      const sn = data.boType === 'retail' ? 'Backorders - Retail' : 'Backorders';
      const s  = ss.getSheetByName(sn);
      if (!s) return err('Sheet not found');
      const row = Number(data.rowIndex) + 1;
      if (row < 2) return err('Invalid row');
      // Columns: 1=Timestamp 2=SubmittedBy 3=Dealer 4=Phone 5=SKU 6=Item
      //          7=Qty 8=Unit 9=PromisedDate 10=Status 11=Notes
      if (data.dealer       != null) s.getRange(row, 3).setValue(data.dealer);
      if (data.phone        != null) s.getRange(row, 4).setValue(data.phone);
      if (data.qty          != null) s.getRange(row, 7).setValue(Number(data.qty));
      if (data.promisedDate != null) s.getRange(row, 9).setValue(data.promisedDate);
      if (data.status       != null) s.getRange(row,10).setValue(data.status);
      if (data.notes        != null) s.getRange(row,11).setValue(data.notes);
      return ok({});
    }

    // ── DELETE TRANSFER ────────────────────────────────────────────────
    if (data.action === 'deleteTransfer') {
      const s = ss.getSheetByName('Transfer Log');
      if (!s) return err('Sheet not found');
      const rows = s.getDataRange().getValues();
      // Collect matching rows in reverse so indices stay valid after each delete
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]) === data.trfNumber) s.deleteRow(i + 1);
      }
      return ok({});
    }

    // ── EDIT TRANSFER ──────────────────────────────────────────────────
    if (data.action === 'editTransfer') {
      const s = ss.getSheetByName('Transfer Log');
      if (!s) return err('Sheet not found');
      const rows = s.getDataRange().getValues();
      // Columns: 1=TrfNo 2=From 3=To 4=Via 5=Status 6=CreatedBy 7=CreatedDate
      //          8=ReceivedBy 9=ReceivedDate 10=SKU 11=Name 12=QtyDisp 13=QtyRcvd
      //          14=Discrepancy 15=Unit 16=Notes
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === data.trfNumber) {
          if (data.via    != null) s.getRange(i+1, 4).setValue(data.via);
          if (data.status != null) s.getRange(i+1, 5).setValue(data.status);
          if (data.notes  != null) s.getRange(i+1,16).setValue(data.notes);
        }
      }
      return ok({});
    }

    // ── GET MOVEMENT HISTORY ───────────────────────────────────────────
    if (data.action === 'getMovementHistory') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return ok({ batches: [] });
      // Group rows into batches by timestamp+unit+mode
      const batchMap = {};
      s.getDataRange().getValues().slice(1).filter(r=>r[0]).forEach((r, i) => {
        const ts = r[0] instanceof Date
          ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(r[0]);
        const key = ts + '|' + String(r[2]) + '|' + String(r[3]);
        if (!batchMap[key]) batchMap[key] = {
          batchKey: key, timestamp: ts, submittedBy: String(r[1]),
          unit: String(r[2]), mode: String(r[3]), items: 0,
          totalLoaded:0, totalReturned:0
        };
        batchMap[key].items++;
        batchMap[key].totalLoaded   += Number(r[7]||0);
        batchMap[key].totalReturned += Number(r[8]||0);
      });
      const batches = Object.values(batchMap)
        .sort((a,b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, Number(data.limit)||60);
      return ok({ batches });
    }

    // ── DELETE MOVEMENT BATCH ──────────────────────────────────────────
    if (data.action === 'deleteMovementBatch') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return err('Sheet not found');
      const rows = s.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        const ts = rows[i][0] instanceof Date
          ? Utilities.formatDate(rows[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(rows[i][0]);
        const key = ts + '|' + String(rows[i][2]) + '|' + String(rows[i][3]);
        if (key === data.batchKey) s.deleteRow(i + 1);
      }
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
        'Qty Received','Qty Outstanding','Line Status',
        'Discount','Discount Type'
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

      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

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

// ── RUN THIS ONCE from the Apps Script editor to authorize Calendar access ──
// Extensions → Apps Script → select testCalendar → Run
// Google will show a consent dialog — click Allow.
// Then re-deploy (Deploy → Manage Deployments → pencil → New version → Deploy).
function testCalendar() {
  const cal   = CalendarApp.getDefaultCalendar();
  const today = new Date();
  const event = cal.createAllDayEvent('[TEST] AE-ON Calendar Auth OK', today, {
    description: 'You can delete this event — it confirms Calendar access is authorized.'
  });
  Logger.log('Calendar test passed. Event ID: ' + event.getId());
}
