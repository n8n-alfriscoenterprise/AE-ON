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

// ── SECURITY TOKEN — must match API_SECRET in config.js ──────────────────
const API_TOKEN = 'ALF-1b9KshUR1pds6qKb7jwaYEKF';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // Reject requests that don't carry the correct token
    if (!data._token || data._token !== API_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({status:'error', msg:'Unauthorized'}))
        .setMimeType(ContentService.MimeType.JSON);
    }

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
        data.username,                                              // A: Username
        data.password,                                              // B: Password
        data.role,                                                  // C: Role
        data.assignedUnit || 'All',                                 // D: AssignedUnit
        data.canCountDist      !== false ? 'YES' : 'NO',           // E: CanCountDist
        data.canCountRetail    !== false ? 'YES' : 'NO',           // F: CanCountRetail
        data.canManagePODist    ? 'YES' : 'NO',                    // G: CanManagePODist
        data.canManagePORetail  ? 'YES' : 'NO',                    // H: CanManagePORetail
        data.canBackorderDist  !== false ? 'YES' : 'NO',           // I: CanBackorderDist
        data.canBackorderRetail ? 'YES' : 'NO',                    // J: CanBackorderRetail
        data.canProduction      ? 'YES' : 'NO',                    // K: CanProduction
        data.canTransfer        ? 'YES' : 'NO',                    // L: CanTransfer
        data.canViewProductList !== false ? 'YES' : 'NO',          // M: CanViewProductList
        data.canStockAdjust     ? 'YES' : 'NO',                    // N: CanStockAdjust
        data.plView || 'both',                                      // O: PLView
        data.canManageDealers   ? 'YES' : 'NO',                    // P: CanManageDealers
        data.canCreateInvoice   ? 'YES' : 'NO'                     // Q: CanCreateInvoice
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

      // Build loaded/returned map from Stock Movements
      const loadMap = {};
      sheet.getDataRange().getValues().slice(1)
        .filter(function(r){
          if(!r[0]) return false;
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[0]).slice(0,10);
          return ts===today && String(r[2])===data.unit && String(r[3])==='LOAD';
        })
        .forEach(function(r){
          const code = String(r[4]);
          if(!loadMap[code]) loadMap[code]={code,name:String(r[5]),cat:String(r[6]),loaded:0,returned:0};
          loadMap[code].loaded   += Number(r[7])||0;
          loadMap[code].returned += Number(r[8])||0;
        });

      // Calculate sold from today's Sales Invoice Lines for this driver
      const soldMap = {};
      const invSheet2     = ss.getSheetByName('Sales Invoices');
      const invLineSheet2 = ss.getSheetByName('Sales Invoice Lines');
      if(invSheet2 && invLineSheet2 && data.createdBy){
        const todayNums = new Set();
        invSheet2.getDataRange().getValues().slice(1).forEach(function(r){
          if(!r[0]) return;
          const invDate2 = r[4] instanceof Date
            ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[4]||'').slice(0,10);
          if(invDate2===today && String(r[10]||'')===String(data.createdBy) && String(r[9])!=='VOID')
            todayNums.add(String(r[0]));
        });
        invLineSheet2.getDataRange().getValues().slice(1).forEach(function(r){
          if(!r[0]||!todayNums.has(String(r[0]))) return;
          const sku = String(r[2]).trim();
          soldMap[sku] = (soldMap[sku]||0) + (Number(r[4])||0);
        });
      }

      const rows = Object.values(loadMap).map(function(item){
        return {code:item.code,name:item.name,cat:item.cat,
                loaded:item.loaded,returned:item.returned,sold:soldMap[item.code]||0};
      });
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
          const code = String(r[3]).trim();
          // Normalise timestamp — handles Date objects AND legacy "M/D/YYYY, H:MM:" strings
          var tsFormatted;
          if (r[0] instanceof Date) {
            tsFormatted = Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          } else {
            var d = new Date(String(r[0]));
            tsFormatted = isNaN(d.getTime())
              ? String(r[0])
              : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          }
          const ts = new Date(tsFormatted);
          if (!map[code] || (!isNaN(ts.getTime()) && ts > new Date(map[code].lastUpdated))) {
            map[code] = {
              stock:       Number(r[5]) || 0,
              lastUpdated: tsFormatted,
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
              bundleQty:   Number(r[11]) || 1,
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
              bundleQty:   Number(r[16]) || 1,
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
      const importedXeroRows = [];

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
        importedXeroRows.push(r);
      });

      // ── Auto-deduct from Stock Counts - Distribution ──────────────
      // Build net qty map per SKU from newly imported rows only
      const xeroDeductMap = {}; // skuCode → { netQty, item }
      importedXeroRows.forEach(function(r) {
        const sku = String(r.skuCode).trim();
        if (!xeroDeductMap[sku]) xeroDeductMap[sku] = { netQty: 0, item: String(r.description||'') };
        xeroDeductMap[sku].netQty += Number(r.quantity) || 0;
      });

      // Read current stock from Stock Counts - Distribution
      // Cols: Timestamp(0) SubmittedBy(1) Location(2) SKUCode(3) ItemName(4) QtyOnHand(5) Unit(6) Type(7) Category(8)
      const distCntSheet = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'
      ]);
      const distCntRows = distCntSheet.getDataRange().getValues().slice(1)
        .filter(function(r) { return r[0] && r[3]; });

      // Find latest stock entry per SKU
      const distLatestStock = {};
      distCntRows.forEach(function(r) {
        const sku = String(r[3]).trim();
        distLatestStock[sku] = { qty: Number(r[5]) || 0, unit: String(r[6] || 'bag'), category: String(r[8] || '') };
      });

      // Append new stock count entries for affected SKUs
      let stockUpdated = 0;
      Object.keys(xeroDeductMap).forEach(function(sku) {
        const info = xeroDeductMap[sku];
        if (info.netQty === 0) return;
        if (!distLatestStock.hasOwnProperty(sku)) return; // No baseline — skip
        const current = distLatestStock[sku];
        const newQty  = current.qty - info.netQty;
        distCntSheet.appendRow([
          now,
          'Xero Import (' + (data.importedBy || 'system') + ')',
          'Warehouse',
          sku,
          info.item,
          newQty,
          current.unit,
          'DIST',
          current.category
        ]);
        stockUpdated++;
      });

      return ok({ imported, skipped, stockUpdated });
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
      const importedRows = [];

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
        importedRows.push(r);
      });

      // ── Auto-deduct from Stock Counts - Retail ────────────────────
      // Build net qty map per SKU from newly imported rows only
      // r.qty is already signed (sales = positive, refunds = negative from parseLyCSV)
      const deductMap = {}; // sku → { netQty, item, category }
      importedRows.forEach(function(r) {
        const sku = String(r.sku).trim();
        if (!deductMap[sku]) deductMap[sku] = { netQty: 0, item: String(r.item||''), category: String(r.category||'') };
        deductMap[sku].netQty += Number(r.qty) || 0;
      });

      // Read current stock from Stock Counts - Retail
      // Cols: Timestamp(0) SubmittedBy(1) Location(2) SKUCode(3) ItemName(4) QtyOnHand(5) Unit(6) Type(7) Category(8)
      const cntSheet = getOrCreateSheet(ss, 'Stock Counts - Retail', [
        'Timestamp','Submitted By','Location','SKU Code',
        'Item Name','Qty On Hand','Unit','Type','Category'
      ]);
      const cntRows = cntSheet.getDataRange().getValues().slice(1)
        .filter(function(r) { return r[0] && r[3]; });

      // Find latest stock entry per SKU (last row wins since sheet is append-only)
      const latestStock = {};
      cntRows.forEach(function(r) {
        const sku = String(r[3]).trim();
        latestStock[sku] = { qty: Number(r[5]) || 0, unit: String(r[6] || ''), category: String(r[8] || '') };
      });

      // Append new stock count entries for affected SKUs
      let stockUpdated = 0;
      Object.keys(deductMap).forEach(function(sku) {
        const info = deductMap[sku];
        if (info.netQty === 0) return;                   // No net movement — skip
        if (!latestStock.hasOwnProperty(sku)) return;    // SKU not in stock counts — skip (no baseline)
        const current = latestStock[sku];
        const newQty  = current.qty - info.netQty;       // netQty positive = sales deduct stock
        cntSheet.appendRow([
          now,
          'Loyverse Import (' + (data.importedBy || 'system') + ')',
          'Retail Store',
          sku,
          info.item,
          newQty,
          current.unit,
          'RETAIL',
          current.category || info.category
        ]);
        stockUpdated++;
      });

      return ok({ imported, skipped, stockUpdated });
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

    // ── DEALER DELETION REQUESTS ──────────────────────────────────────
    // Staff/drivers submit requests; admins approve or reject them.

    if (data.action === 'requestDealerDeletion') {
      const sheet = getOrCreateSheet(ss, 'Dealer Deletion Requests', [
        'Request ID','Dealer ID','Store Name','Requested By','Requested At',
        'Status','Resolved By','Resolved At'
      ]);
      const now   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const reqId = 'DELREQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
      sheet.appendRow([
        reqId,
        data.dealerId    || '',
        data.storeName   || '',
        data.requestedBy || '',
        now,
        'Pending',
        '',
        ''
      ]);
      return ok({ requestId: reqId });
    }

    if (data.action === 'getDealerDeletionRequests') {
      const sheet = ss.getSheetByName('Dealer Deletion Requests');
      if (!sheet) return ok({ requests: [] });
      const requests = sheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[5]) === 'Pending'; })
        .map(function(r){
          return {
            requestId:   String(r[0]),
            dealerId:    String(r[1]),
            storeName:   String(r[2]),
            requestedBy: String(r[3]),
            requestedAt: r[4] instanceof Date
              ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
              : String(r[4] || '').slice(0, 16),
            status:      String(r[5])
          };
        });
      return ok({ requests: requests });
    }

    if (data.action === 'resolveDealerDeletion') {
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      // 1. Update the request row status
      const reqSheet = ss.getSheetByName('Dealer Deletion Requests');
      if (reqSheet) {
        const reqRows = reqSheet.getDataRange().getValues();
        for (var ri = 1; ri < reqRows.length; ri++) {
          if (String(reqRows[ri][0]) === data.requestId) {
            reqSheet.getRange(ri + 1, 6).setValue(data.approve ? 'Approved' : 'Rejected');
            reqSheet.getRange(ri + 1, 7).setValue(data.resolvedBy || '');
            reqSheet.getRange(ri + 1, 8).setValue(now);
            break;
          }
        }
      }

      // 2. If approved, physically delete the dealer row
      if (data.approve) {
        const dlrSheet = ss.getSheetByName('Dealer Directory');
        if (dlrSheet) {
          const dlrRows = dlrSheet.getDataRange().getValues();
          for (var di = dlrRows.length - 1; di >= 1; di--) {
            if (String(dlrRows[di][0]) === data.dealerId) {
              dlrSheet.deleteRow(di + 1);
              break;
            }
          }
        }
      }

      return ok({ resolved: data.requestId, approved: !!data.approve });
    }

    // ── SKU ADD REQUESTS ──────────────────────────────────────────────
    // Staff submit item suggestions; admins approve (writes to SKU Master) or reject.

    if (data.action === 'submitSKURequest') {
      // Columns: A:RequestID B:Segment C:Category D:ItemName E:SKUCode
      //          F:Supplier G:CostPrice H:Notes I:RequestedBy J:RequestedAt K:Status
      //          L:ResolvedBy M:ResolvedAt N:Unit O:IsProd P:ProdType Q:RelatedSKU R:Ratio
      const sheet = getOrCreateSheet(ss, 'SKU Add Requests', [
        'Request ID','Segment','Category','Item Name','SKU Code',
        'Supplier','Cost Price','Notes','Requested By','Requested At',
        'Status','Resolved By','Resolved At',
        'Unit','Is Production Item','Prod Type','Related SKU','Standard Ratio'
      ]);
      const now   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      const reqId = 'SKUREQ-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
      sheet.appendRow([
        reqId,
        data.segment     || 'DIST',  // B
        data.category    || '',       // C
        data.name        || '',       // D
        data.code        || '',       // E
        data.supplier    || '',       // F
        Number(data.cost) || 0,       // G: Cost Price
        data.notes       || '',       // H
        data.requestedBy || '',       // I
        now,                          // J
        'Pending', '', '',            // K L M
        data.unit        || '',       // N
        data.isProd      || 'NO',     // O
        data.prodType    || '',       // P
        data.relatedSku  || '',       // Q
        data.ratio       || ''        // R
      ]);
      return ok({ requestId: reqId });
    }

    if (data.action === 'getSKURequests') {
      const sheet = ss.getSheetByName('SKU Add Requests');
      if (!sheet) return ok({ requests: [] });
      const requests = sheet.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[10]) === 'Pending'; })
        .map(function(r){
          return {
            requestId:   String(r[0]),
            segment:     String(r[1]),
            category:    String(r[2]),
            name:        String(r[3]),
            code:        String(r[4]  || ''),
            supplier:    String(r[5]  || ''),
            cost:        r[6] || 0,
            notes:       String(r[7]  || ''),
            requestedBy: String(r[8]),
            requestedAt: r[9] instanceof Date
              ? Utilities.formatDate(r[9], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')
              : String(r[9] || '').slice(0, 16),
            unit:        String(r[13] || ''),
            isProd:      String(r[14] || 'NO'),
            prodType:    String(r[15] || ''),
            relatedSku:  String(r[16] || ''),
            ratio:       String(r[17] || '')
          };
        });
      return ok({ requests: requests });
    }

    if (data.action === 'resolveSKURequest') {
      const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      // Update request row status in SKU Add Requests sheet
      const reqSheet = ss.getSheetByName('SKU Add Requests');
      if (reqSheet) {
        const reqRows = reqSheet.getDataRange().getValues();
        for (var ri = 1; ri < reqRows.length; ri++) {
          if (String(reqRows[ri][0]) === data.requestId) {
            reqSheet.getRange(ri + 1, 11).setValue(data.approve ? 'Approved' : 'Rejected');
            reqSheet.getRange(ri + 1, 12).setValue(data.resolvedBy || '');
            reqSheet.getRange(ri + 1, 13).setValue(now);
            break;
          }
        }
      }

      // If approved, append to the appropriate SKU Master sheet
      if (data.approve) {
        const isProd = String(data.isProd || 'NO').toUpperCase() === 'YES';

        if (String(data.segment) === 'RETAIL') {
          // SKU Master - Retail:
          // A:Code B:Name C:Category D:Type E:Unit F:Rev G:Order H:Active
          // I:Supplier J:Cost K:SellingPrice
          // L:IsProductionItem M:DisassemblyUOM N:AssemblyUOM O:StandardRatio
          const rSheet = getOrCreateSheet(ss, 'SKU Master - Retail', [
            'Code','Name','Category','Type','Unit','Rev','Order',
            'Active','Supplier','Cost','Selling Price',
            'Is Production Item','Disassembly UOM','Assembly UOM','Standard Ratio'
          ]);
          const rRows = rSheet.getDataRange().getValues().slice(4).filter(function(r){ return r[0]; });
          const rMax  = rRows.reduce(function(m, r){ return Math.max(m, Number(r[6]) || 0); }, 1000);

          const disUOM = (isProd && String(data.prodType) === 'disassemble') ? (data.relatedSku || '') : '';
          const asmUOM = (isProd && String(data.prodType) === 'assemble')    ? (data.relatedSku || '') : '';

          rSheet.appendRow([
            data.code,              // A: Code
            data.name,              // B: Name
            data.category || '',    // C: Category
            '',                     // D: Type
            data.unit     || 'bag', // E: Unit
            '',                     // F: Rev
            rMax + 10,              // G: Order
            'YES',                  // H: Active
            data.supplier || '',          // I: Supplier
            Number(data.cost) || 0,       // J: Cost
            0,                            // K: Selling Price
            isProd ? 'YES' : 'NO',  // L: IsProductionItem
            disUOM,                 // M: DisassemblyUOM
            asmUOM,                 // N: AssemblyUOM
            isProd ? (Number(data.ratio) || 0) : '' // O: StandardRatio
          ]);

        } else {
          // SKU Master (DIST):
          // A:Code B:Name C:Category D:Description E:Order F:Active G:DisplayOrder H:Supplier I:Cost
          const dSheet = getOrCreateSheet(ss, 'SKU Master', [
            'Code','Name','Category','Description','Order','Active',
            'Display Order','Supplier','Cost'
          ]);
          const dRows = dSheet.getDataRange().getValues().slice(4).filter(function(r){ return r[0]; });
          const dMax  = dRows.reduce(function(m, r){ return Math.max(m, Number(r[4]) || 0); }, 100);
          dSheet.appendRow([
            data.code,           // A: Code
            data.name,           // B: Name
            data.category || '', // C: Category
            '',                  // D: Description
            dMax + 10,           // E: Order
            'YES',               // F: Active
            '',                  // G: Display Order
            data.supplier || '',       // H: Supplier
            Number(data.cost) || 0    // I: Cost
          ]);
        }
      }

      return ok({ resolved: data.requestId, approved: !!data.approve });
    }

    // ── SALES INVOICES ────────────────────────────────────────────────
    if (data.action === 'saveInvoice') {
      const invSheet  = getOrCreateSheet(ss, 'Sales Invoices', [
        'Invoice Number','Contact Name','Dealer ID','Reference',
        'Invoice Date','Due Date','Payment Terms','Subtotal','Total',
        'Status','Created By','Created At',
        'Payment Type','Check Reference','Received By','Signature'
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
        data.createdBy    || '',
        data.createdAt    || '',
        data.paymentType  || 'Cash',
        data.checkRef     || '',
        data.receivedBy   || '',
        data.signature    || ''
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

      // ── Admin sale: deduct from distribution stock immediately ──
      // Only when no van unit is assigned (i.e. not a driver sale)
      if(!data.assignedUnit || String(data.assignedUnit).trim()===''){
        const distCntSale = getOrCreateSheet(ss, 'Stock Counts - Distribution', [
          'Timestamp','Submitted By','Location','SKU Code',
          'Item Name','Qty On Hand','Unit','Type','Category'
        ]);
        // Build latest absolute stock per SKU
        const stkRows = distCntSale.getDataRange().getValues().slice(1).filter(function(r){return r[0]&&r[3];});
        const latestStkMap = {};
        stkRows.forEach(function(r){
          const sku = String(r[3]).trim();
          latestStkMap[sku] = {qty:Number(r[5])||0, unit:String(r[6]||'bag'), category:String(r[8]||'')};
        });
        const nowSale = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        lines.forEach(function(l){
          if(!l.sku||!l.qty) return;
          const sku = String(l.sku).trim();
          if(!latestStkMap.hasOwnProperty(sku)) return;
          const info   = latestStkMap[sku];
          const newQty = Math.max(0, info.qty - (Number(l.qty)||0));
          distCntSale.appendRow([
            nowSale, data.createdBy||'', 'Admin Sale - '+invoiceNumber,
            sku, String(l.desc||''), newQty, info.unit||'bag', 'DIST', info.category||''
          ]);
        });
      }

      return ok({ invoiceNumber: invoiceNumber });
    }

    if (data.action === 'getInvoices') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return ok({ invoices: [] });
      let rows = invSheet.getDataRange().getValues().slice(1).filter(r => r[0]);
      // Optional dealer filter
      if (data.dealerId) rows = rows.filter(r => String(r[2]) === String(data.dealerId));
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
          createdAt:     String(r[11]),
          paymentType:   String(r[12] || 'Cash'),
          checkRef:      String(r[13] || ''),
          receivedBy:    String(r[14] || '')
          // col 15 (P) = Signature — omitted from list (large base64)
        };
      });
      return ok({ invoices: invoices });
    }

    // ── VOID INVOICE (admin only) ─────────────────────────────────────────
    if (data.action === 'voidInvoice') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return err('Sales Invoices sheet not found');
      const invNum = String(data.invoiceNumber || '').trim();
      if (!invNum) return err('Invoice number required');
      const rows = invSheet.getDataRange().getValues();
      var targetRow = -1;
      for (var vi = 1; vi < rows.length; vi++) {
        if (String(rows[vi][0]).trim() === invNum) { targetRow = vi + 1; break; }
      }
      if (targetRow < 0) return err('Invoice not found: ' + invNum);
      if (String(rows[targetRow - 1][9]) === 'VOID') return err('Already voided');
      const voidNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      invSheet.getRange(targetRow, 10).setValue('VOID');                    // Col J = Status
      invSheet.getRange(targetRow, 17).setValue(String(data.reason || '')); // Col Q = Void Reason
      invSheet.getRange(targetRow, 18).setValue(String(data.voidedBy || '')); // Col R = Voided By
      invSheet.getRange(targetRow, 19).setValue(voidNow);                   // Col S = Voided At
      return ok({ invoiceNumber: invNum, status: 'VOID' });
    }

    // ── DEALER ACTIVITY (lightweight: last invoice date per dealer) ───────
    if (data.action === 'getRecentDealerActivity') {
      const invSheet = ss.getSheetByName('Sales Invoices');
      if (!invSheet) return ok({ activity: [] });
      const rows = invSheet.getDataRange().getValues().slice(1).filter(function(r){ return r[0]; });
      const latestMap = {};
      rows.forEach(function(r){
        const dealerId = String(r[2] || '').trim();
        if (!dealerId) return;
        const dateVal = r[4] instanceof Date
          ? Utilities.formatDate(r[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(r[4] || '').slice(0, 10);
        if (!dateVal) return;
        if (!latestMap[dealerId] || dateVal > latestMap[dealerId]) {
          latestMap[dealerId] = dateVal;
        }
      });
      const activity = Object.keys(latestMap).map(function(id){
        return { dealerId: id, lastDate: latestMap[id] };
      });
      return ok({ activity: activity });
    }

    // ── VAN STOCK (driver's available qty per SKU today) ──────────────
    if (data.action === 'getVanStock') {
      const unit      = String(data.unit || '');
      const username  = String(data.createdBy || '');
      const today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      // 1. Load + Return movements for this unit today
      const movSheet = ss.getSheetByName('Stock Movements');
      const stockMap = {}; // {sku: {loaded, returned}}
      if (movSheet) {
        movSheet.getDataRange().getValues().slice(1).forEach(function(r) {
          if (!r[0]) return;
          const ts = r[0] instanceof Date
            ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[0]).slice(0, 10);
          if (ts !== today) return;
          if (String(r[2]) !== unit) return;
          const sku = String(r[4]).trim();
          if (!stockMap[sku]) stockMap[sku] = {loaded: 0, returned: 0};
          if (String(r[3]) === 'LOAD')   stockMap[sku].loaded   += Number(r[7]) || 0;
          if (String(r[3]) === 'RETURN') stockMap[sku].returned += Number(r[8]) || 0;
        });
      }

      // 2. Already-invoiced qty for this user today
      const invSheet2    = ss.getSheetByName('Sales Invoices');
      const invLineSheet = ss.getSheetByName('Sales Invoice Lines');
      const invoicedMap  = {}; // {sku: qty}
      if (invSheet2 && invLineSheet) {
        const todayInvNums = new Set();
        invSheet2.getDataRange().getValues().slice(1).forEach(function(r) {
          if (!r[0]) return;
          const ca = r[11] instanceof Date
            ? Utilities.formatDate(r[11], Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : String(r[11]).slice(0, 10);
          if (ca === today && String(r[10]) === username) todayInvNums.add(String(r[0]));
        });
        invLineSheet.getDataRange().getValues().slice(1).forEach(function(r) {
          if (!r[0] || !todayInvNums.has(String(r[0]))) return;
          const sku = String(r[2]).trim();
          invoicedMap[sku] = (invoicedMap[sku] || 0) + (Number(r[4]) || 0);
        });
      }

      // 3. available = loaded − returned − already invoiced
      const vanStock = {};
      Object.keys(stockMap).forEach(function(sku) {
        const loaded    = stockMap[sku].loaded;
        const returned  = stockMap[sku].returned;
        const invoiced  = invoicedMap[sku] || 0;
        vanStock[sku] = {
          loaded:    loaded,
          returned:  returned,
          invoiced:  invoiced,
          available: Math.max(0, loaded - returned - invoiced)
        };
      });
      return ok({ vanStock: vanStock });
    }

    // ── DAY TALLY (driver end-of-day summary / admin full view) ─────────
    if (data.action === 'getDayTally') {
      const username  = String(data.createdBy || '');
      const adminView = !username || data.adminView === true;
      const today     = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const invSheet3 = ss.getSheetByName('Sales Invoices');
      if (!invSheet3) return ok({ invoices: [], totals: {Cash:0,Check:0,'Terms AR':0}, grandTotal: 0 });

      const todayRows = invSheet3.getDataRange().getValues().slice(1).filter(function(r) {
        if (!r[0]) return false;
        if (String(r[9]) === 'VOID') return false; // exclude voided
        const ca = r[11] instanceof Date
          ? Utilities.formatDate(r[11], Session.getScriptTimeZone(), 'yyyy-MM-dd')
          : String(r[11]).slice(0, 10);
        if (adminView) return ca === today;
        return ca === today && String(r[10]) === username;
      });

      const totals = {Cash: 0, Check: 0, 'Terms AR': 0};
      let grandTotal = 0;
      const invoices = todayRows.map(function(r) {
        const pt    = String(r[12] || 'Cash');
        const total = Number(r[8]) || 0;
        grandTotal += total;
        if (totals[pt] !== undefined) totals[pt] += total;
        else totals[pt] = (totals[pt]||0) + total;
        return {
          invoiceNumber: String(r[0]),
          contactName:   String(r[1]),
          total:         total,
          paymentType:   pt,
          createdBy:     String(r[10] || '')
        };
      });
      return ok({ invoices: invoices, totals: totals, grandTotal: grandTotal, adminView: adminView });
    }

    // ── BOTTLENECK ALERTS ─────────────────────────────────────────────
    if (data.action === 'getBottleneckAlerts') {
      const distSkuSheet = ss.getSheetByName('SKU Master');
      const distCntSheet = ss.getSheetByName('Stock Counts - Distribution');
      const poSheet      = ss.getSheetByName('Purchase Orders');
      const liSheet      = ss.getSheetByName('PO Line Items');

      // Latest stock per SKU
      const stockMap = {};
      if (distCntSheet) {
        distCntSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && r[3]; })
          .forEach(function(r){
            const sku = String(r[3]).trim();
            const ts  = r[0] instanceof Date ? r[0] : new Date(String(r[0]));
            if (!stockMap[sku] || ts > stockMap[sku].ts)
              stockMap[sku] = { qty: Number(r[5]) || 0, ts: ts };
          });
      }

      // SKUs already covered by an open PO
      const coveredSkus = new Set();
      if (poSheet && liSheet) {
        const openStatuses = { DRAFT:true, PENDING:true, APPROVED:true, PARTIAL:true };
        const openPONums   = new Set();
        poSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && openStatuses[String(r[3]).trim().toUpperCase()]; })
          .forEach(function(r){ openPONums.add(String(r[0]).trim()); });
        liSheet.getDataRange().getValues().slice(1)
          .filter(function(r){ return r[0] && openPONums.has(String(r[0]).trim()); })
          .forEach(function(r){ coveredSkus.add(String(r[1]).trim()); });
      }

      // Build bottleneck list: below par + no open PO
      const bottlenecks = [];
      if (distSkuSheet) {
        distSkuSheet.getDataRange().getValues().slice(4)
          .filter(function(r){ return r[0] && String(r[5]).toUpperCase() === 'YES'; })
          .forEach(function(r){
            const sku      = String(r[0]).trim();
            const parLevel = Number(r[10]) || 0;
            if (parLevel <= 0) return;
            const entry = stockMap[sku];
            const stock = entry ? Number(entry.qty) : null;
            if (stock === null || stock >= parLevel) return;
            if (coveredSkus.has(sku)) return;
            bottlenecks.push({
              sku:      sku,
              name:     String(r[1]).trim(),
              category: String(r[2]).trim(),
              supplier: String(r[7] || '').trim(),
              stock:    stock,
              parLevel: parLevel,
              shortfall: parLevel - stock
            });
          });
      }

      // Sort by criticality — fully out of stock first, then lowest stock ratio
      bottlenecks.sort(function(a, b){
        if (a.stock === 0 && b.stock > 0) return -1;
        if (b.stock === 0 && a.stock > 0) return 1;
        return (a.stock / a.parLevel) - (b.stock / b.parLevel);
      });

      return ok({ bottlenecks: bottlenecks });
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

    // ── EDIT PO LINE ITEMS (admin only) ──────────────────────────────
    if (data.action === 'editPOLineItems') {
      const poSheet = ss.getSheetByName('Purchase Orders');
      const liSheet = ss.getSheetByName('PO Line Items');
      if (!poSheet || !liSheet) return err('Sheets not found');

      const poNumber = String(data.poNumber || '').trim();
      if (!poNumber) return err('PO number required');

      // Locate PO row and guard against editing closed POs
      const poRows   = poSheet.getDataRange().getValues();
      var   poRowIdx = -1;
      for (var pi = 1; pi < poRows.length; pi++) {
        if (String(poRows[pi][0]).trim() === poNumber) {
          const status = String(poRows[pi][3]);
          if (['RECEIVED','CANCELLED'].includes(status))
            return err('Cannot edit line items of a ' + status + ' PO');
          poRowIdx = pi;
          break;
        }
      }
      if (poRowIdx < 0) return err('PO not found: ' + poNumber);

      // Delete existing line items for this PO (bottom-up to preserve row indices)
      const liRows    = liSheet.getDataRange().getValues();
      const toDelete  = [];
      for (var li = 1; li < liRows.length; li++) {
        if (String(liRows[li][0]).trim() === poNumber) toDelete.push(li + 1);
      }
      for (var td = toDelete.length - 1; td >= 0; td--) liSheet.deleteRow(toDelete[td]);

      // Re-append updated line items, preserving received quantities
      var newTotal = 0;
      (data.lineItems || []).forEach(function(item) {
        var qty      = Number(item.qtyOrdered)  || 0;
        var cost     = Number(item.unitCost)     || 0;
        var disc     = Number(item.discount)     || 0;
        var discType = String(item.discountType  || '%');
        var qtyRcv   = Number(item.qtyReceived)  || 0;
        var gross    = qty * cost;
        var net      = discType === '₱'
          ? Math.max(0, gross - disc * qty)
          : Math.max(0, gross * (1 - disc / 100));
        var outstanding = Math.max(0, qty - qtyRcv);
        newTotal += net;
        liSheet.appendRow([
          poNumber,
          String(item.skuCode   || ''),
          String(item.itemName  || item.skuCode || ''),
          '',                          // Category (kept blank, sourced from SKU Master)
          qty,
          String(item.unit      || 'bag'),
          cost,
          net,
          qtyRcv,
          outstanding,
          outstanding <= 0 ? 'Received' : 'Open',
          disc,
          discType
        ]);
      });

      // Update PO header: total value (col 10) and audit note appended to notes (col 11)
      poSheet.getRange(poRowIdx + 1, 10).setValue(newTotal);
      var existingNotes = String(poRows[poRowIdx][10] || '');
      var auditStamp    = '[Line items edited by ' + String(data.editedBy || 'admin')
        + ' on ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ']';
      poSheet.getRange(poRowIdx + 1, 11).setValue(
        existingNotes ? existingNotes + ' ' + auditStamp : auditStamp
      );

      return ok({ updated: (data.lineItems || []).length, newTotal: newTotal });
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
          notes:       String(r[10]) || '',
          qtyServed:   Number(r[11]) || 0,
          servedDate:  String(r[12]  || '')
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
      // PARTIAL: also write qty served (col 12) and served date (col 13)
      if (data.status === 'PARTIAL') {
        if (data.qtyServed  != null) boSheet.getRange(sheetRow, 12).setValue(Number(data.qtyServed) || 0);
        if (data.servedDate != null) boSheet.getRange(sheetRow, 13).setValue(String(data.servedDate || ''));
      }
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

    // ── GET COUNT HISTORY ─────────────────────────────────────────────
    if (data.action === 'getCountHistory') {
      const seg = String(data.segment || 'dist').toLowerCase();
      const sheetName = seg === 'retail' ? 'Stock Counts - Retail' : 'Stock Counts - Distribution';
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) return ok({ items: [], summary: { lastCountDate: 'Never', totalSKUs: 0, varianceCount: 0, staleSKUs: 0 } });

      const rows = sheet.getDataRange().getValues().slice(1).filter(function(r){ return r[0] && r[3]; });

      // Build per-SKU record list
      var skuMap = {};
      rows.forEach(function(r) {
        // Normalise timestamp — handles Date objects AND legacy "M/D/YYYY, H:MM:" strings
        var ts;
        if (r[0] instanceof Date) {
          ts = Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        } else {
          var d = new Date(String(r[0]));
          ts = isNaN(d.getTime())
            ? String(r[0])
            : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        }
        var code = String(r[3]);
        if (!skuMap[code]) skuMap[code] = { name: String(r[4]||code), unit: String(r[6]||'bag'), category: String(r[8]||''), records: [] };
        skuMap[code].records.push({ date: ts, qty: Number(r[5])||0, submittedBy: String(r[1]||''), location: String(r[2]||'') });
      });

      var now = new Date();
      var lastCountDate = '';
      var lastCountDateMs = 0; // track as epoch ms to avoid mixed-format string comparison bugs
      var varianceCount = 0;

      var items = Object.keys(skuMap).map(function(code) {
        var info = skuMap[code];
        info.records.sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
        var latest   = info.records[0];
        var prev     = info.records[1];
        var variance = prev != null ? latest.qty - prev.qty : null;
        var latestMs = new Date(latest.date).getTime();
        if (!isNaN(latestMs) && latestMs > lastCountDateMs) { lastCountDateMs = latestMs; lastCountDate = latest.date; }
        if (variance !== null && variance !== 0) varianceCount++;
        var daysSince = Math.floor((now - new Date(latest.date)) / 86400000);

        // Shrinkage flag: negative variance on a manual count that's unexpectedly large
        // Auto-generated entries (Loyverse/Xero imports, PO receipts, transfers) are excluded
        var isManualEntry = !/(loyverse|xero|import|stock.?in|po.?receipt|transfer|production)/i
          .test(String(latest.submittedBy || ''));
        var isShrinkage = isManualEntry && variance !== null && variance < -3;

        return {
          skuCode:     code,
          skuName:     info.name,
          category:    info.category,
          unit:        info.unit,
          lastCounted: latest.date,
          lastQty:     latest.qty,
          prevQty:     prev ? prev.qty : null,
          variance:    variance,
          submittedBy: latest.submittedBy,
          location:    latest.location,
          daysSince:   daysSince,
          isShrinkage: isShrinkage
        };
      });

      items.sort(function(a,b){ return new Date(b.lastCounted)-new Date(a.lastCounted); });

      var summary = {
        lastCountDate: lastCountDate ? lastCountDate.slice(0,16) : 'Never',
        totalSKUs:     items.length,
        varianceCount: varianceCount,
        staleSKUs:     items.filter(function(i){ return i.daysSince > 30; }).length
      };

      return ok({ items: items, summary: summary });
    }

    // ── GET COUNT ITEM HISTORY ─────────────────────────────────────────
    if (data.action === 'getCountItemHistory') {
      var seg2 = String(data.segment || 'dist').toLowerCase();
      var sName2 = seg2 === 'retail' ? 'Stock Counts - Retail' : 'Stock Counts - Distribution';
      var sheet2 = ss.getSheetByName(sName2);
      if (!sheet2) return ok({ records: [] });

      var records = sheet2.getDataRange().getValues().slice(1)
        .filter(function(r){ return r[0] && String(r[3]) === String(data.skuCode); })
        .map(function(r){
          var recDate;
          if (r[0] instanceof Date) {
            recDate = Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          } else {
            var d2 = new Date(String(r[0]));
            recDate = isNaN(d2.getTime())
              ? String(r[0])
              : Utilities.formatDate(d2, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
          }
          return {
            date:        recDate,
            qty:         Number(r[5])||0,
            submittedBy: String(r[1]||''),
            location:    String(r[2]||'')
          };
        });

      records.sort(function(a,b){ return new Date(b.date)-new Date(a.date); });
      return ok({ records: records.slice(0,10) });
    }

    // ── EDIT TRANSFER ──────────────────────────────────────────────────
    if (data.action === 'editTransfer') {
      const s = ss.getSheetByName('Transfer Log');
      if (!s) return err('Sheet not found');

      if (data.lineItems && data.lineItems.length > 0) {
        // Rebuild: delete existing rows for this transfer, then re-insert
        const rows = s.getDataRange().getValues();
        var firstRowData = null;
        var rowsToDelete = [];
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber) {
            if (!firstRowData) firstRowData = rows[i];
            rowsToDelete.push(i + 1); // 1-based
          }
        }
        if (!firstRowData) return err('Transfer not found');

        // Delete from bottom to top to avoid row-index shift
        for (var j = rowsToDelete.length - 1; j >= 0; j--) {
          s.deleteRow(rowsToDelete[j]);
        }

        // Re-insert with updated fields
        data.lineItems.forEach(function(li) {
          s.appendRow([
            data.trfNumber,
            firstRowData[1],                                             // fromLocation
            firstRowData[2],                                             // toLocation
            data.via    != null ? data.via    : firstRowData[3],         // via
            data.status != null ? data.status : firstRowData[4],         // status
            firstRowData[5],                                             // createdBy
            firstRowData[6],                                             // createdDate
            firstRowData[7],                                             // receivedBy
            firstRowData[8],                                             // receivedDate
            li.skuCode  || '',                                           // SKU code
            li.skuName  || '',                                           // item name
            Number(li.qty) || 0,                                         // qty dispatched
            0,                                                           // qty received (reset)
            Number(li.qty) || 0,                                         // discrepancy
            li.unit     || 'bag',                                        // unit
            data.notes  != null ? data.notes  : firstRowData[15]         // notes
          ]);
        });

      } else {
        // No line items — just update via / status / notes on all matching rows
        const rows = s.getDataRange().getValues();
        for (var i = 1; i < rows.length; i++) {
          if (String(rows[i][0]) === data.trfNumber) {
            if (data.via    != null) s.getRange(i+1, 4).setValue(data.via);
            if (data.status != null) s.getRange(i+1, 5).setValue(data.status);
            if (data.notes  != null) s.getRange(i+1,16).setValue(data.notes);
          }
        }
      }

      return ok({ trfNumber: data.trfNumber });
    }

    // ── GET MOVEMENT HISTORY ───────────────────────────────────────────
    if (data.action === 'getMovementHistory') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return ok({ batches: [] });

      const batchMap = {};
      s.getDataRange().getValues().slice(1).forEach(function(r, i) {
        if (!r[0]) return;
        const ts = r[0] instanceof Date
          ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')
          : String(r[0]);
        const key = ts + '|' + String(r[2]) + '|' + String(r[3]);
        if (!batchMap[key]) batchMap[key] = {
          batchKey:      key,
          timestamp:     ts,
          submittedBy:   String(r[1]),
          unit:          String(r[2]),
          mode:          String(r[3]),
          items:         0,
          totalLoaded:   0,
          totalReturned: 0,
          lines:         []
        };
        const loaded   = Number(r[7]) || 0;
        const returned = Number(r[8]) || 0;
        const sold     = Number(r[9]) || 0;
        batchMap[key].items++;
        batchMap[key].totalLoaded   += loaded;
        batchMap[key].totalReturned += returned;
        batchMap[key].lines.push({
          rowIndex: i + 2,  // +1 for header row, +1 for 1-based index
          sku:      String(r[4]),
          name:     String(r[5]),
          category: String(r[6]),
          loaded,
          returned,
          sold
        });
      });

      let batches = Object.values(batchMap);

      // Optional filters
      if (data.mode && data.mode !== 'All') {
        batches = batches.filter(function(b){ return b.mode.toUpperCase() === data.mode.toUpperCase(); });
      }
      if (data.date) {
        batches = batches.filter(function(b){ return b.timestamp.slice(0,10) === data.date; });
      }

      // Sort newest first — compare as real dates, fall back to string compare
      batches.sort(function(a, b) {
        const ta = new Date(a.timestamp).getTime() || 0;
        const tb = new Date(b.timestamp).getTime() || 0;
        return (tb - ta) || b.timestamp.localeCompare(a.timestamp);
      });

      return ok({ batches: batches.slice(0, Number(data.limit) || 200) });
    }

    // ── UPDATE MOVEMENT ROW (admin / staff edit) ───────────────────────
    if (data.action === 'updateMovementRow') {
      const s = ss.getSheetByName('Stock Movements');
      if (!s) return err('Stock Movements sheet not found');
      const rowIndex = Number(data.rowIndex);
      if (!rowIndex || rowIndex < 2) return err('Invalid row index');
      const allRows = s.getDataRange().getValues();
      if (rowIndex > allRows.length) return err('Row not found');
      const loaded   = Math.max(0, Number(data.loaded)   || 0);
      const returned = Math.max(0, Number(data.returned) || 0);
      const sold     = Math.max(0, loaded - returned);
      s.getRange(rowIndex,  8).setValue(loaded);
      s.getRange(rowIndex,  9).setValue(returned);
      s.getRange(rowIndex, 10).setValue(sold);
      return ok({ rowIndex, loaded, returned, sold });
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
