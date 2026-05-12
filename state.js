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

// ── SESSION TIMEOUT (auto-logout after 8 hrs inactivity) ──────────────
const _SESSION_TIMEOUT = 8 * 60 * 60 * 1000;
let _activityWatcherTimer = null;

function _touchActivity(){
  LS.set('alf_activity', Date.now());
}

function _startActivityWatcher(){
  _touchActivity();
  ['touchstart','mousedown','keydown'].forEach(ev =>
    document.addEventListener(ev, _touchActivity, {passive:true})
  );
  if (_activityWatcherTimer) return;
  _activityWatcherTimer = setInterval(function(){
    const last = LS.get('alf_activity') || 0;
    if (currentUser && Date.now() - last > _SESSION_TIMEOUT) {
      clearInterval(_activityWatcherTimer);
      _activityWatcherTimer = null;
      if (typeof showToast === 'function')
        showToast('Session expired — please sign in again.', 'warning', 5000);
      setTimeout(function(){ if (typeof doLogout === 'function') doLogout(); }, 2500);
    }
  }, 5 * 60 * 1000);
}

// ── API ──
// Never throws — always returns {status, ...}.
// Injects API secret token on every call.
// saveInvoice failures queue to localStorage for later sync.
async function api(payload){
  const secured = Object.assign({}, payload);
  if (typeof API_SECRET !== 'undefined' && API_SECRET) secured._token = API_SECRET;
  _touchActivity();
  try {
    const r = await fetch(WEBHOOK, {method:'POST', redirect:'follow', body:JSON.stringify(secured)});
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
    if (typeof API_SECRET !== 'undefined' && API_SECRET) clean._token = API_SECRET;
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

// ── DATE HELPERS (Philippine Standard Time = UTC+8) ──────────────────────
function _phParse(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === '—') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))            return new Date(s + 'T00:00:00+08:00');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return new Date(s.replace(' ','T') + '+08:00');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function phDate(val) {
  const d = _phParse(val);
  if (!d) return val ? String(val) : '—';
  const ph = new Date(d.toLocaleString('en-US',{timeZone:'Asia/Manila'}));
  return String(ph.getMonth()+1).padStart(2,'0')+'-'+String(ph.getDate()).padStart(2,'0')+'-'+ph.getFullYear();
}
function phDateTime(val) {
  const d = _phParse(val);
  if (!d) return val ? String(val) : '—';
  const ph  = new Date(d.toLocaleString('en-US',{timeZone:'Asia/Manila'}));
  const mon = String(ph.getMonth()+1).padStart(2,'0');
  const day = String(ph.getDate()).padStart(2,'0');
  const h   = ph.getHours(), ampm = h>=12?'PM':'AM', h12 = h%12||12;
  const mi  = String(ph.getMinutes()).padStart(2,'0');
  return mon+'-'+day+'-'+ph.getFullYear()+' · '+h12+':'+mi+' '+ampm;
}
function phToday(){ return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'}); }
function phNow()  { return new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'}); }

// ── STAFF LOADING ──
