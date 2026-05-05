// ── TOAST NOTIFICATION ───────────────────────────────────────────────────────
// showToast(message, type, duration)
//   type     : 'success' | 'error' | 'warning' | 'info'  (default: 'info')
//   duration : milliseconds before auto-dismiss           (default: 3500)
//
// Can be called from anywhere in the app:
//   showToast('PO received — inventory updated', 'success');
//   showToast('Calendar event created for May 10', 'info', 4000);
//   showToast('Calendar auth required — run testCalendar in Apps Script', 'error', 6000);

let _toastTimer = null;

function showToast(message, type, duration) {
  type     = type     || 'info';
  duration = duration || 3500;

  let el = document.getElementById('ae-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ae-toast';
    document.body.appendChild(el);
  }

  if (_toastTimer) clearTimeout(_toastTimer);

  el.className  = 'ae-toast ae-toast-' + type + ' ae-toast-show';
  el.textContent = message;

  _toastTimer = setTimeout(function() {
    el.classList.remove('ae-toast-show');
  }, duration);
}
