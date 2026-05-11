// ── STATE ──
let currentUser=null, isReturnMode=false, currentTab='dist', currentCat='All';
let quantities={}, staff=[], csskus={}, accessLog=[];
let driverManifest=[], driverCat='All';
let supplierList=[];
let dealerList=[], dealerFilter='All', currentDealer=null;
let poEditMode=false, poEditingNumber=null;
let _poSaving=false; // guard against double-tap duplicate submissions

// ── STORAGE ──
const LS={
  get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
function saveLocal(){LS.set('alf_csskus',csskus);LS.set('alf_log',accessLog.slice(0,100));}

// ── API ──
// Never throws — always returns {status, ...}.
// saveInvoice failures queue to localStorage for later sync.
async function api(payload){
  try {
    const r = await fetch(WEBHOOK, {method:'POST', redirect:'follow', body:JSON.stringify(payload)});
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch(_) {
      console.error('Apps Script non-JSON response:', text.slice(0, 400));
      return {status:'error', msg:'Apps Script returned an unexpected response — re-deploy and try again.'};
    }
  } catch(netErr) {
    console.error('Fetch failed:', netErr.message);
    if (payload.action === 'saveInvoice') {
      const tempNum = _queueOfflineInvoice(payload);
      return {status:'queued', invoiceNumber: tempNum};
    }
    return {status:'error', msg:'Network error — check your internet connection.'};
  }
}

// ── OFFLINE INVOICE QUEUE ──────────────────────────────────────────
let _offlineSyncTimer = null;

function _queueOfflineInvoice(payload) {
  const p        = Object.assign({}, payload);
  p._queuedAt    = new Date().toISOString();
  p._tempNumber  = 'OFFLINE-' + Date.now();
  const queue    = LS.get('alf_pending_invoices') || [];
  queue.push(p);
  LS.set('alf_pending_invoices', queue);
  if (typeof updateOfflineBadge === 'function') updateOfflineBadge();
  return p._tempNumber;
}

async function syncOfflinePending() {
  const queue = LS.get('alf_pending_invoices') || [];
  if (!queue.length) return;
  const remaining = [];
  for (const payload of queue) {
    const tempNum = payload._tempNumber || 'PENDING';
    const clean   = Object.assign({}, payload);
    delete clean._queuedAt;
    delete clean._tempNumber;
    try {
      const resp = await fetch(WEBHOOK, {method:'POST', redirect:'follow', body:JSON.stringify(clean)});
      const r    = JSON.parse(await resp.text());
      if (r.status === 'ok') {
        if (typeof showToast === 'function')
          showToast(tempNum + ' synced → ' + r.invoiceNumber + ' ✓', 'success');
      } else {
        remaining.push(payload);
      }
    } catch(e) {
      remaining.push(payload); // still offline
    }
  }
  LS.set('alf_pending_invoices', remaining);
  if (typeof updateOfflineBadge === 'function') updateOfflineBadge();
}

function startOfflineSync() {
  if (_offlineSyncTimer) return;
  syncOfflinePending(); // immediate first attempt
  _offlineSyncTimer = setInterval(syncOfflinePending, 30000);
}

// ── STAFF LOADING ──
