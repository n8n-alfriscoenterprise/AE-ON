// ════════════════════════════════════════════════════════
// MY HR — each employee's own attendance standing + expected
// salary for the current semi-monthly cutoff (1–15 / 16–end).
// Read-only: the numbers are computed server-side from the
// Attendance sheet and the employee's Daily Rate.
// ════════════════════════════════════════════════════════
let _hrOffset = 0;    // 0 = current cutoff, -1 = previous, …
let _hrBusy   = false;

function openHR(){
  showScreen('hr-screen');
  updateFabVisibility();
  _hrOffset = 0;
  _hrLoad();
}

function closeHR(){
  if(currentUser && currentUser.role === 'driver') showDriver();
  else showHome();
}

function hrShiftPeriod(dir){
  // dir −1 = older cutoff, +1 = newer. Never go past the current one.
  const next = _hrOffset + dir;
  if(next > 0) return;
  _hrOffset = next;
  _hrLoad();
}

async function _hrLoad(){
  if(_hrBusy) return;
  _hrBusy = true;
  const content = document.getElementById('hr-content');
  if(content) content.innerHTML = '<div class="hr-loading">Loading your record…</div>';
  const nextBtn = document.getElementById('hr-next-btn');
  if(nextBtn) nextBtn.disabled = (_hrOffset >= 0);
  try{
    const r = await api({ action:'getMyHR', username: currentUser.username, offset: _hrOffset });
    if(r.status === 'ok') _hrRender(r);
    else if(content) content.innerHTML = '<div class="hr-empty">Could not load your HR record.</div>';
  }catch(e){
    if(content) content.innerHTML = '<div class="hr-empty">Network error — check your connection.</div>';
  }
  _hrBusy = false;
  const nb = document.getElementById('hr-next-btn');
  if(nb) nb.disabled = (_hrOffset >= 0);
}

function _hrPeso(n){
  return '₱' + Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
}

function _hrTime12(t){
  if(!t) return '—';
  const p = t.split(':'); let h = parseInt(p[0],10); const m = p[1];
  const ap = h>=12 ? 'PM' : 'AM'; h = h%12 || 12;
  return h + ':' + m + ' ' + ap;
}

function _hrRender(d){
  const el = document.getElementById('hr-content');
  const lbl = document.getElementById('hr-period-label');
  if(lbl) lbl.textContent = d.period || '';
  if(!el) return;

  const hourly = d.payType === 'hourly';

  // ── Attendance standing (hourly counts hours & full days instead of late/half) ──
  let html = '<div class="hr-card">'
    + '<div class="hr-card-title">Attendance standing'
      + (hourly ? ' <span style="color:#7B1FA2">· paid hourly</span>' : '') + '</div>'
    + '<div class="hr-stat-grid">'
    + (hourly
      ? '<div class="hr-stat days"><span class="hr-stat-val">'+d.daysWorked+'</span><span class="hr-stat-lbl">Days</span></div>'
        + '<div class="hr-stat ok"><span class="hr-stat-val">'+(d.fullDays||0)+'</span><span class="hr-stat-lbl">Full days</span></div>'
        + '<div class="hr-stat days"><span class="hr-stat-val">'+(d.hoursPaid||0)+'</span><span class="hr-stat-lbl">Hours</span></div>'
        + '<div class="hr-stat half"><span class="hr-stat-val">'+(d.incompleteDays||0)+'</span><span class="hr-stat-lbl">No out</span></div>'
      : '<div class="hr-stat days"><span class="hr-stat-val">'+d.daysWorked+'</span><span class="hr-stat-lbl">Days</span></div>'
        + '<div class="hr-stat ok"><span class="hr-stat-val">'+Math.max(0,d.daysWorked-d.lateDays-d.halfDays)+'</span><span class="hr-stat-lbl">On time</span></div>'
        + '<div class="hr-stat late"><span class="hr-stat-val">'+d.lateDays+'</span><span class="hr-stat-lbl">Late</span></div>'
        + '<div class="hr-stat half"><span class="hr-stat-val">'+d.halfDays+'</span><span class="hr-stat-lbl">Half day</span></div>')
    + '</div>'
    + (hourly && d.incompleteDays > 0
        ? '<div class="hr-note" style="color:#C0392B"><strong>'+d.incompleteDays+' day'+(d.incompleteDays!==1?'s':'')
          +' missing a time-out</strong> — those days pay ₱0.00 until corrected. Ask Admin to fix them.</div>' : '')
    + (hourly && d.otHours > 0
        ? '<div class="hr-note">Beyond the '+d.stdHours+'-hour duty: <strong>'+d.otHours+' hour'+(d.otHours!==1?'s':'')
          +'</strong> (not automatically paid).</div>' : '')
    + (d.lateMinutes > 0
        ? '<div class="hr-note">Total time late this cutoff: <strong>'+d.lateMinutes+' minute'+(d.lateMinutes!==1?'s':'')+'</strong>'
          + (hourly ? ' — already reflected in your hours.' : '.') + '</div>'
        : '')
    + '</div>';

  // ── Expected salary (only when a rate is on file) ──
  if(!d.rateSet){
    html += '<div class="hr-card">'
      + '<div class="hr-card-title">Expected salary</div>'
      + '<div class="hr-norate">Your daily rate isn’t set yet, so pay can’t be estimated. '
      + 'Please ask Admin to add it to your staff record — your attendance above is already being tracked.</div>'
      + '</div>';
  } else {
    html += '<div class="hr-card">'
      + '<div class="hr-card-title">Expected salary — estimate</div>'
      + (hourly
        ? '<div class="hr-pay-row"><span>Hourly rate ('+_hrPeso(d.dailyRate)+' ÷ '+d.stdHours+'h)</span><span>'+_hrPeso(d.hourlyRate)+'</span></div>'
          + '<div class="hr-pay-row"><span>Hours worked ('+(d.hoursPaid||0)+'h × rate)</span><span>'+_hrPeso(d.gross)+'</span></div>'
        : '<div class="hr-pay-row"><span>Daily rate</span><span>'+_hrPeso(d.dailyRate)+'</span></div>'
          + '<div class="hr-pay-row"><span>Basic ('+d.daysWorked+' day'+(d.daysWorked!==1?'s':'')+' × rate)</span><span>'+_hrPeso(d.gross)+'</span></div>')
      + (d.lateDeduction > 0
          ? '<div class="hr-pay-row ded"><span>Late deductions</span><span>− '+_hrPeso(d.lateDeduction)+'</span></div>' : '')
      + (d.halfDayDeduction > 0
          ? '<div class="hr-pay-row ded"><span>Half-day deductions</span><span>− '+_hrPeso(d.halfDayDeduction)+'</span></div>' : '')
      + (d.cashAdvance > 0
          ? '<div class="hr-pay-row ded"><span>Cash advance</span><span>− '+_hrPeso(d.cashAdvance)+'</span></div>' : '')
      + '<div class="hr-pay-total"><span>Expected pay</span><span>'+_hrPeso(d.expected)+'</span></div>'
      + '<div class="hr-note">Estimate only, based on time records so far this cutoff ('+d.startDate+' to '+d.endDate+'). '
      + 'Final pay is confirmed by Admin.</div>'
      + '</div>';
  }

  // ── Daily breakdown ──
  html += '<div class="hr-card"><div class="hr-card-title">Daily record</div>';
  if(!d.days || !d.days.length){
    html += '<div class="hr-empty">No attendance recorded for this cutoff.</div>';
  } else {
    html += '<table class="hr-day-table"><thead><tr>'
      + '<th>Date</th><th>In</th><th>Out</th><th>Status</th>'
      + (d.rateSet ? '<th class="r">Day pay</th>' : '')
      + '</tr></thead><tbody>';
    d.days.forEach(function(day){
      // Missing/invalid punches are the loudest signal for hourly staff
      const bad    = day.incomplete === true;
      const isHalf = /half/i.test(day.status), isLate = /late/i.test(day.status);
      const cls = bad ? 'half' : isHalf ? 'half' : isLate ? 'late' : 'ok';
      const label = bad ? '⚠ '+day.status : day.status;
      html += '<tr>'
        + '<td>'+(typeof phDate==='function' ? phDate(day.date) : day.date)+'</td>'
        + '<td>'+_hrTime12(day.timeIn)+'</td>'
        + '<td>'+_hrTime12(day.timeOut)+'</td>'
        + '<td><span class="hr-flag '+cls+'">'+label+'</span>'
          + (day.ot > 0 ? '<div style="font-size:10px;color:#7B1FA2;margin-top:2px">+'+day.ot+'h beyond duty</div>' : '')
          + '</td>'
        + (d.rateSet ? '<td class="r">'+_hrPeso(day.pay)+'</td>' : '')
        + '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  el.innerHTML = html;
}
