// ── STATE ──
let currentUser=null, isReturnMode=false, currentTab='dist', currentCat='All';
let quantities={}, staff=[], csskus={}, accessLog=[];
let driverManifest=[], driverCat='All', deliverTarget=null;
let supplierList=[];
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
// If the Apps Script returns non-JSON (HTML error page from a bad deployment),
// we return a structured error instead of crashing with a TypeError.
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
    return {status:'error', msg:'Network error — check your internet connection.'};
  }
}

// ── STAFF LOADING ──
