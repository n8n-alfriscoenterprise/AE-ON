// ════════════════════════════════════════════════════════
// HR DASHBOARD (admin) — every employee for one pay cutoff:
// attendance standing, expected pay, and the payroll total.
// Numbers come from the same server-side engine as each
// employee's own My HR screen, so the two always agree.
// ════════════════════════════════════════════════════════
let _hraOffset   = 0;
let _hraBusy     = false;
let _hraData     = null;
let _hraExpanded = {};    // username → daily detail open?

function openHRAdmin(){
  showScreen('hr-admin-screen');
  updateFabVisibility();
  _hraOffset = 0;
  _hraExpanded = {};
  _hraLoad();
}

function closeHRAdmin(){ showHome(); }

function hraShiftPeriod(dir){
  const next = _hraOffset + dir;
  if(next > 0) return;              // never past the current cutoff
  _hraOffset = next;
  _hraExpanded = {};
  _hraLoad();
}

async function _hraLoad(){
  if(_hraBusy) return;
  _hraBusy = true;
  const body = document.getElementById('hra-content');
  if(body) body.innerHTML = '<div class="hr-loading">Loading payroll…</div>';
  const nb = document.getElementById('hra-next-btn');
  if(nb) nb.disabled = (_hraOffset >= 0);
  try{
    const r = await api({ action:'getHRSummary', role: currentUser.role,
                          by: currentUser.username, offset: _hraOffset });
    if(r.status === 'ok'){ _hraData = r; _hraRender(); }
    else if(body) body.innerHTML = '<div class="hr-empty">'+(r.msg||'Could not load payroll.')+'</div>';
  }catch(e){
    if(body) body.innerHTML = '<div class="hr-empty">Network error — check your connection.</div>';
  }
  _hraBusy = false;
  const nb2 = document.getElementById('hra-next-btn');
  if(nb2) nb2.disabled = (_hraOffset >= 0);
}

function _hraPeso(n){
  return '₱' + Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
}

function toggleHRAEmployee(uname){
  _hraExpanded[uname] = !_hraExpanded[uname];
  _hraRender();
}

function _hraRender(){
  const d = _hraData;
  const el = document.getElementById('hra-content');
  const lbl = document.getElementById('hra-period-label');
  if(lbl) lbl.textContent = d.period || '';
  if(!el) return;

  // ── Payroll summary ──
  let html = '<div class="hr-card">'
    + '<div class="hr-card-title">Payroll summary</div>'
    + '<div class="hra-sum-grid">'
      + '<div class="hra-sum"><span class="hra-sum-val">'+d.headcount+'</span><span class="hra-sum-lbl">Employees</span></div>'
      + '<div class="hra-sum"><span class="hra-sum-val">'+_hraPeso(d.totalDeductions)+'</span><span class="hra-sum-lbl">Deductions</span></div>'
      + '<div class="hra-sum"><span class="hra-sum-val">'+_hraPeso(d.totalAdvances)+'</span><span class="hra-sum-lbl">Advances</span></div>'
    + '</div>'
    + '<div class="hra-total"><span>Total expected payroll</span><span>'+_hraPeso(d.totalPayroll)+'</span></div>'
    + (d.flagged > 0
        ? '<div class="hra-flag-note">⚠ '+d.flagged+' employee'+(d.flagged!==1?'s':'')
          +' need attention (missing time-out or no daily rate set).</div>' : '')
    + '<div class="hr-note">Estimate for '+d.startDate+' to '+d.endDate+', based on time records so far.</div>'
    + '</div>';

  // ── Per-employee ──
  if(!d.employees || !d.employees.length){
    html += '<div class="hr-card"><div class="hr-empty">No employee activity in this cutoff.</div></div>';
    el.innerHTML = html;
    return;
  }

  d.employees.forEach(function(e){
    const open = !!_hraExpanded[e.username];
    const hourly = e.payType === 'hourly';
    const needsAttention = e.incompleteDays > 0 || !e.rateSet;

    // Middle line: hourly shows hours, daily shows late/half counts
    const meta = hourly
      ? e.daysWorked+' day'+(e.daysWorked!==1?'s':'')+' · '+e.hoursPaid+'h'
        +(e.fullDays?' · '+e.fullDays+' full':'')
      : e.daysWorked+' day'+(e.daysWorked!==1?'s':'')
        +(e.lateDays?' · '+e.lateDays+' late':'')
        +(e.halfDays?' · '+e.halfDays+' half':'');

    html += '<div class="hra-emp'+(needsAttention?' warn':'')+'">'
      + '<div class="hra-emp-head" onclick="toggleHRAEmployee(\''+e.username.replace(/'/g,"\\'")+'\')">'
        + '<div class="hra-emp-main">'
          + '<div class="hra-emp-name">'+e.username
            + '<span class="hra-badge '+(hourly?'hourly':'daily')+'">'+(hourly?'HOURLY':'DAILY')+'</span>'
            + (e.role ? '<span class="hra-role">'+e.role+'</span>' : '')
          + '</div>'
          + '<div class="hra-emp-meta">'+meta+'</div>'
          + (e.incompleteDays > 0
              ? '<div class="hra-emp-warn">⚠ '+e.incompleteDays+' day'+(e.incompleteDays!==1?'s':'')+' missing time-out</div>' : '')
          + (!e.rateSet ? '<div class="hra-emp-warn">⚠ No daily rate set</div>' : '')
        + '</div>'
        + '<div class="hra-emp-pay">'
          + (e.rateSet ? '<div class="hra-emp-amt">'+_hraPeso(e.expected)+'</div>' : '<div class="hra-emp-amt muted">—</div>')
          + '<div class="hra-emp-toggle">'+(open?'▲ Hide':'▼ Detail')+'</div>'
        + '</div>'
      + '</div>';

    if(open){
      html += '<div class="hra-emp-detail">'
        + '<div class="hra-detail-line"><span>Rate</span><span>'+_hraPeso(e.dailyRate)+'/day'
          + (hourly ? ' ('+_hraPeso(e.dailyRate/d.stdHours)+'/hr)' : '')+'</span></div>'
        + '<div class="hra-detail-line"><span>'+(hourly?'Hours worked ('+e.hoursPaid+'h)':'Basic ('+e.daysWorked+' days)')+'</span><span>'+_hraPeso(e.gross)+'</span></div>'
        + (e.totalDeduction > 0 ? '<div class="hra-detail-line ded"><span>Deductions</span><span>− '+_hraPeso(e.totalDeduction)+'</span></div>' : '')
        + (e.cashAdvance   > 0 ? '<div class="hra-detail-line ded"><span>Cash advance</span><span>− '+_hraPeso(e.cashAdvance)+'</span></div>' : '')
        + (e.otHours > 0 ? '<div class="hr-note">'+e.otHours+'h beyond the '+d.stdHours+'-hour duty (not auto-paid).</div>' : '')
        + '<table class="hr-day-table" style="margin-top:8px"><thead><tr>'
          + '<th>Date</th><th>In</th><th>Out</th><th>Status</th><th class="r">Pay</th>'
        + '</tr></thead><tbody>';
      (e.days||[]).forEach(function(day){
        const bad = day.incomplete === true;
        const cls = bad ? 'half' : /half/i.test(day.status) ? 'half' : /late/i.test(day.status) ? 'late' : 'ok';
        html += '<tr>'
          + '<td>'+(typeof phDate==='function' ? phDate(day.date) : day.date)+'</td>'
          + '<td>'+(day.timeIn||'—')+'</td>'
          + '<td>'+(day.timeOut||'—')+'</td>'
          + '<td><span class="hr-flag '+cls+'">'+(bad?'⚠ ':'')+day.status+'</span></td>'
          + '<td class="r">'+(e.rateSet?_hraPeso(day.pay):'—')+'</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
  });

  el.innerHTML = html;
}
