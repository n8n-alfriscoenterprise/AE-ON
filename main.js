// ── KEYBOARD ──
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('admin-pass-input').addEventListener('keydown',e=>{if(e.key==='Enter')verifyAdmin();});

// ── START ──
init();
