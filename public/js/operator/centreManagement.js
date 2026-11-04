const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const CM_API_URL = `${BACKEND_BASE_URL}/api/centre-management`;
const CENTRES_API_URL = `${BACKEND_BASE_URL}/api/profile/centres`;

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function jsonHeaders() {
  return { 'Content-Type': 'application/json', ...authHeaders() };
}
function toDatetimeLocal(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

(function initCentreManagementPage() {
  const centreSwitcher = document.getElementById('centreSwitcher');
  if (!centreSwitcher) return; 

  const token = localStorage.getItem('authToken');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (!token || role !== 'operator') {
    window.location.href = '/auth/login.html';
    return;
  }

  const noCentreMsg = document.getElementById('noCentreMsg');
  const centreContent = document.getElementById('centreContent');

  let myCentres = [];
  let currentHawkerId = null;
  let currentPeriod = 'week';
  let currentPromotions = [];

  
  async function loadMyCentres() {
    try {
      const res = await fetch(`${CENTRES_API_URL}/mine`, { headers: { ...authHeaders() } });
      myCentres = await res.json();
      if (!Array.isArray(myCentres) || myCentres.length === 0) {
        noCentreMsg.style.display = 'block';
        centreContent.style.display = 'none';
        return;
      }

      centreSwitcher.innerHTML = myCentres.map(c => `<option value="${c.HawkerId}">${c.Name}</option>`).join('');
      currentHawkerId = myCentres[0].HawkerId;
      noCentreMsg.style.display = 'none';
      centreContent.style.display = 'block';
      loadAllTabs();
    } catch (err) {
      noCentreMsg.textContent = 'Failed to load your hawker centres.';
      noCentreMsg.style.display = 'block';
    }
  }

  centreSwitcher.addEventListener('change', () => {
    currentHawkerId = Number(centreSwitcher.value);
    loadAllTabs();
  });

  function loadAllTabs() {
    loadClosures();
    loadAnalytics();
    loadSatisfaction();
    loadPromotions();
  }

  
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-tab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.querySelectorAll('.tab-btn[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn[data-period]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      loadAnalytics();
    });
  });

  
  
  
  const closuresTableBody = document.querySelector('#closuresTable tbody');
  const closuresEmptyMsg = document.getElementById('closuresEmptyMsg');
  const closureStatusLine = document.getElementById('closureStatusLine');

  function closureStatusBadge(status) {
    const map = { Scheduled: 'status-open', Active: 'status-inflight', Completed: 'status-completed', Cancelled: 'status-unresolvable' };
    return `<span class="status-badge ${map[status] || 'status-open'}">${status}</span>`;
  }

  async function loadClosures() {
    try {
      const res = await fetch(`${CM_API_URL}/closures?hawkerId=${currentHawkerId}`, { headers: { ...authHeaders() } });
      const closures = await res.json();
      closuresTableBody.innerHTML = '';

      if (!Array.isArray(closures) || closures.length === 0) {
        closuresEmptyMsg.style.display = 'block';
      } else {
        closuresEmptyMsg.style.display = 'none';
        closures.forEach(c => {
          const row = document.createElement('tr');
          const actions = [];
          if (c.Status === 'Active') actions.push(`<button type="button" class="edit-btn end-closure-btn" data-id="${c.ClosureId}">End Now</button>`);
          if (c.Status === 'Scheduled') actions.push(`<button type="button" class="delete-btn cancel-closure-btn" data-id="${c.ClosureId}">Cancel</button>`);
          row.innerHTML = `
            <td>${c.Reason}</td>
            <td>${new Date(c.StartDateTime).toLocaleString()}</td>
            <td>${new Date(c.EndDateTime).toLocaleString()}</td>
            <td>${closureStatusBadge(c.Status)}</td>
            <td>${c.Notes || '-'}</td>
            <td>${actions.join(' ') || '-'}</td>
          `;
          closuresTableBody.appendChild(row);
        });
      }

      const isClosedNow = Array.isArray(closures) && closures.some(c => c.Status === 'Active');
      closureStatusLine.innerHTML = isClosedNow
        ? '<span class="status-badge status-unresolvable">Centre currently closed</span>'
        : '<span class="status-badge status-completed">Centre currently open</span>';
    } catch (err) {
      closuresEmptyMsg.textContent = 'Failed to load closures.';
      closuresEmptyMsg.style.display = 'block';
    }
  }

  closuresTableBody.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    if (target.classList.contains('end-closure-btn')) {
      await fetch(`${CM_API_URL}/closures/${id}/end`, { method: 'PATCH', headers: { ...authHeaders() } });
      loadClosures();
    } else if (target.classList.contains('cancel-closure-btn')) {
      await fetch(`${CM_API_URL}/closures/${id}/cancel`, { method: 'PATCH', headers: { ...authHeaders() } });
      loadClosures();
    }
  });

  
  const closureModal = document.getElementById('closureModal');
  const closureForm = document.getElementById('closureForm');
  const closureMsg = document.getElementById('closureMsg');
  const c_Immediate = document.getElementById('c_Immediate');
  const c_Start = document.getElementById('c_Start');

  document.getElementById('newClosureBtn').addEventListener('click', () => {
    closureForm.reset();
    c_Start.disabled = false;
    closureMsg.textContent = '';
    closureMsg.className = 'msg';
    closureModal.classList.add('show');
  });
  document.getElementById('closeClosureModalBtn').addEventListener('click', () => closureModal.classList.remove('show'));
  document.getElementById('cancelClosureModalBtn').addEventListener('click', () => closureModal.classList.remove('show'));
  closureModal.addEventListener('click', (e) => { if (e.target === closureModal) closureModal.classList.remove('show'); });

  c_Immediate.addEventListener('change', () => {
    if (c_Immediate.checked) {
      c_Start.value = toDatetimeLocal(new Date());
      c_Start.disabled = true;
    } else {
      c_Start.disabled = false;
    }
  });

  closureForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    closureMsg.textContent = '';
    closureMsg.className = 'msg';

    const payload = {
      HawkerId: currentHawkerId,
      Reason: document.getElementById('c_Reason').value,
      StartDateTime: c_Immediate.checked ? new Date().toISOString() : c_Start.value,
      EndDateTime: document.getElementById('c_End').value,
      Notes: document.getElementById('c_Notes').value,
    };

    try {
      const res = await fetch(`${CM_API_URL}/closures`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) {
        closureMsg.textContent = result.error || 'Failed to schedule closure.';
        closureMsg.classList.add('error');
        return;
      }
      closureModal.classList.remove('show');
      loadClosures();
    } catch (err) {
      closureMsg.textContent = 'Network error. Please try again.';
      closureMsg.classList.add('error');
    }
  });

  
  
  
  function renderBarChart(container, rows, labelKey, valueKey, labelFormatter) {
    if (!rows.length) {
      container.innerHTML = '<p class="empty-msg">No orders in this period.</p>';
      return;
    }
    const max = Math.max(...rows.map(r => r[valueKey]));
    container.innerHTML = rows.map(r => `
      <div class="bar-row">
        <span class="bar-label">${labelFormatter ? labelFormatter(r[labelKey]) : r[labelKey]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${max ? (r[valueKey] / max) * 100 : 0}%"></div></div>
        <span class="bar-value">${r[valueKey]}</span>
      </div>
    `).join('');
  }

  async function fetchAnalytics(hawkerId, period) {
    const res = await fetch(`${CM_API_URL}/analytics/${hawkerId}?period=${period}`, { headers: { ...authHeaders() } });
    return res.json();
  }

  async function loadAnalytics() {
    try {
      const data = await fetchAnalytics(currentHawkerId, currentPeriod);
      document.getElementById('a_totalOrders').textContent = data.totalOrders ?? '0';
      document.getElementById('a_peakHour').textContent = data.peakHour !== null && data.peakHour !== undefined ? `${data.peakHour}:00` : '-';
      document.getElementById('a_underUtilisedCount').textContent = (data.underUtilisedStalls || []).length;

      renderBarChart(document.getElementById('hourChart'), data.orderVolumeByHour || [], 'HourOfDay', 'OrderCount', h => `${h}:00`);
      renderBarChart(document.getElementById('dayChart'), data.orderVolumeByDay || [], 'OrderDay', 'OrderCount', d => new Date(d).toLocaleDateString());

      const utilBody = document.querySelector('#utilisationTable tbody');
      const underIds = new Set((data.underUtilisedStalls || []).map(s => s.StallId));
      utilBody.innerHTML = (data.stallUtilisation || []).map(s => `
        <tr>
          <td>${s.StallName}</td>
          <td>${s.OrderCount}</td>
          <td>${underIds.has(s.StallId) ? '<span class="status-badge status-inflight">Under-utilised</span>' : '<span class="status-badge status-completed">Typical</span>'}</td>
        </tr>
      `).join('');

      
      const compareCard = document.getElementById('analyticsCompareCard');
      if (myCentres.length > 1) {
        compareCard.style.display = 'block';
        const rows = await Promise.all(myCentres.map(async c => {
          const d = await fetchAnalytics(c.HawkerId, currentPeriod);
          return { name: c.Name, total: d.totalOrders ?? 0, peak: d.peakHour };
        }));
        document.querySelector('#analyticsCompareTable tbody').innerHTML = rows.map(r => `
          <tr><td>${r.name}</td><td>${r.total}</td><td>${r.peak !== null && r.peak !== undefined ? `${r.peak}:00` : '-'}</td></tr>
        `).join('');
      } else {
        compareCard.style.display = 'none';
      }
    } catch (err) {
      
    }
  }

  
  
  
  const BAND_COLOR = { green: 'var(--success)', yellow: 'var(--warning)', red: 'var(--danger)', none: 'var(--border)' };

  function renderRing(el, labelEl, band, avgRating) {
    const color = BAND_COLOR[band] || BAND_COLOR.none;
    const pct = avgRating ? Math.min(100, (avgRating / 5) * 100) : 0;
    el.style.background = `conic-gradient(${color} ${pct}%, var(--border) ${pct}% 100%)`;
    labelEl.textContent = avgRating ? avgRating.toFixed(1) : 'N/A';
  }

  async function fetchSatisfaction(hawkerId) {
    const res = await fetch(`${CM_API_URL}/satisfaction/${hawkerId}`, { headers: { ...authHeaders() } });
    return res.json();
  }

  async function loadSatisfaction() {
    try {
      const data = await fetchSatisfaction(currentHawkerId);

      renderRing(document.getElementById('stallRing'), document.getElementById('stallRingLabel'), data.stallFeedback.band, data.stallFeedback.AvgRating);
      document.getElementById('stallRingMeta').textContent = `${data.stallFeedback.FeedbackCount || 0} reviews`;

      document.querySelector('#stallRatingsTable tbody').innerHTML = (data.stallFeedbackBreakdown || []).map(s => `
        <tr><td>${s.StallName}</td><td>${s.FeedbackCount}</td><td>${s.AvgRating != null ? s.AvgRating.toFixed(1) : 'N/A'}</td></tr>
      `).join('') || '<tr><td colspan="3">No stall reviews yet.</td></tr>';

      renderRing(document.getElementById('hawkerRing'), document.getElementById('hawkerRingLabel'), data.hawkerFeedback.band, data.hawkerFeedback.AvgRating);
      document.getElementById('hawkerRingMeta').textContent = `${data.hawkerFeedback.FeedbackCount || 0} reviews`;

      const trendArrow = { up: '▲', down: '▼', flat: '▬' }[data.trend.direction] || '▬';
      const trendColor = { up: 'var(--success)', down: 'var(--danger)', flat: 'var(--text-muted)' }[data.trend.direction];
      document.getElementById('hawkerTrendLine').innerHTML = data.trend.RecentAvg != null
        ? `<span style="color:${trendColor};font-weight:700;">${trendArrow}</span> ${data.trend.RecentAvg.toFixed(1)} vs ${data.trend.PreviousAvg != null ? data.trend.PreviousAvg.toFixed(1) : 'N/A'} (last 30 vs prior 30 days)`
        : 'Not enough data for a trend yet.';

      document.querySelector('#facilityTable tbody').innerHTML = (data.facilityBreakdown || []).map(f => `
        <tr><td>${f.FacilityTag}</td><td>${f.FeedbackCount}</td><td>${f.AvgRating.toFixed(1)}</td></tr>
      `).join('') || '<tr><td colspan="3">No hawker feedback yet.</td></tr>';

      const compareCard = document.getElementById('satisfactionCompareCard');
      if (myCentres.length > 1) {
        compareCard.style.display = 'block';
        const rows = await Promise.all(myCentres.map(async c => {
          const d = await fetchSatisfaction(c.HawkerId);
          return { name: c.Name, stall: d.stallFeedback.AvgRating, hawker: d.hawkerFeedback.AvgRating };
        }));
        document.querySelector('#satisfactionCompareTable tbody').innerHTML = rows.map(r => `
          <tr><td>${r.name}</td><td>${r.stall ? r.stall.toFixed(1) : 'N/A'}</td><td>${r.hawker ? r.hawker.toFixed(1) : 'N/A'}</td></tr>
        `).join('');
      } else {
        compareCard.style.display = 'none';
      }
    } catch (err) {
      
    }
  }

  const negativeModal = document.getElementById('negativeModal');
  const negativeModalTitle = document.getElementById('negativeModalTitle');
  const negativeModalBody = document.getElementById('negativeModalBody');

  async function openNegativeModal(source, title) {
    negativeModalTitle.textContent = title;
    negativeModalBody.innerHTML = '<p class="empty-msg">Loading...</p>';
    negativeModal.classList.add('show');
    try {
      const res = await fetch(`${CM_API_URL}/satisfaction/${currentHawkerId}/negative?source=${source}`, { headers: { ...authHeaders() } });
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        negativeModalBody.innerHTML = '<p class="empty-msg">No negative feedback found.</p>';
        return;
      }
      negativeModalBody.innerHTML = rows.map(r => `
        <div class="detail-row detail-row-block">
          <span>${r.StallName || r.FacilityTag || 'Feedback'} — Rating ${r.FeedbackRating ?? r.Rating}/5 (${new Date(r.FeedbackDateTime || r.CreatedAt).toLocaleDateString()})</span>
          <p>${r.FeedbackComment || r.Comment || 'No comment provided.'}</p>
        </div>
      `).join('');
    } catch (err) {
      negativeModalBody.innerHTML = '<p class="empty-msg">Failed to load feedback.</p>';
    }
  }

  document.getElementById('viewStallNegativeBtn').addEventListener('click', () => openNegativeModal('stall', 'Negative Stall Feedback'));
  document.getElementById('viewHawkerNegativeBtn').addEventListener('click', () => openNegativeModal('hawker', 'Negative Hawker Centre Feedback'));
  document.getElementById('closeNegativeModalBtn').addEventListener('click', () => negativeModal.classList.remove('show'));
  negativeModal.addEventListener('click', (e) => { if (e.target === negativeModal) negativeModal.classList.remove('show'); });

  
  
  
  const promotionsTableBody = document.querySelector('#promotionsTable tbody');
  const promotionsEmptyMsg = document.getElementById('promotionsEmptyMsg');

  function promotionStatusBadge(status) {
    const map = { Upcoming: 'status-open', Active: 'status-inflight', Archived: 'status-completed' };
    return `<span class="status-badge ${map[status] || 'status-open'}">${status}</span>`;
  }

  async function loadPromotions() {
    try {
      const res = await fetch(`${CM_API_URL}/promotions?hawkerId=${currentHawkerId}`, { headers: { ...authHeaders() } });
      const promotions = await res.json();
      currentPromotions = Array.isArray(promotions) ? promotions : [];

      if (!currentPromotions.length) {
        promotionsEmptyMsg.style.display = 'block';
        promotionsTableBody.innerHTML = '';
        return;
      }
      promotionsEmptyMsg.style.display = 'none';

      promotionsTableBody.innerHTML = currentPromotions.map(p => `
        <tr>
          <td>${p.Name}</td>
          <td>${p.DiscountType === 'Percentage' ? `${p.DiscountValue}%` : `$${Number(p.DiscountValue).toFixed(2)}`}</td>
          <td>${new Date(p.StartDateTime).toLocaleDateString()}</td>
          <td>${new Date(p.EndDateTime).toLocaleDateString()}</td>
          <td>${promotionStatusBadge(p.Status)}</td>
          <td>${p.TargetedStallCount}</td>
          <td>${myCentres.length > 1 ? `<button type="button" class="edit-btn clone-promo-btn" data-id="${p.PromotionId}">Clone</button>` : '-'}</td>
        </tr>
      `).join('');
    } catch (err) {
      promotionsEmptyMsg.textContent = 'Failed to load promotions.';
      promotionsEmptyMsg.style.display = 'block';
    }
  }

  
  const promotionModal = document.getElementById('promotionModal');
  const promotionForm = document.getElementById('promotionForm');
  const promotionMsg = document.getElementById('promotionMsg');
  const p_AllStalls = document.getElementById('p_AllStalls');
  const p_StallChecklist = document.getElementById('p_StallChecklist');

  document.getElementById('newPromotionBtn').addEventListener('click', () => {
    promotionForm.reset();
    p_AllStalls.checked = true;
    p_StallChecklist.style.display = 'none';
    promotionMsg.textContent = '';
    promotionMsg.className = 'msg';
    promotionModal.classList.add('show');
  });
  document.getElementById('closePromotionModalBtn').addEventListener('click', () => promotionModal.classList.remove('show'));
  document.getElementById('cancelPromotionModalBtn').addEventListener('click', () => promotionModal.classList.remove('show'));
  promotionModal.addEventListener('click', (e) => { if (e.target === promotionModal) promotionModal.classList.remove('show'); });

  p_AllStalls.addEventListener('change', async () => {
    if (p_AllStalls.checked) {
      p_StallChecklist.style.display = 'none';
      return;
    }
    p_StallChecklist.style.display = 'grid';
    p_StallChecklist.innerHTML = '<p class="empty-msg">Loading stalls...</p>';
    try {
      const res = await fetch(`${CM_API_URL}/stalls?hawkerId=${currentHawkerId}`, { headers: { ...authHeaders() } });
      const stalls = await res.json();
      p_StallChecklist.innerHTML = (Array.isArray(stalls) ? stalls : []).map(s => `
        <label class="checkbox-item"><input type="checkbox" value="${s.StallId}"><span>${s.StallName}</span></label>
      `).join('') || '<p class="empty-msg">No active stalls in this centre.</p>';
    } catch (err) {
      p_StallChecklist.innerHTML = '<p class="empty-msg">Failed to load stalls.</p>';
    }
  });

  promotionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    promotionMsg.textContent = '';
    promotionMsg.className = 'msg';

    const stallIds = p_AllStalls.checked
      ? 'all'
      : Array.from(p_StallChecklist.querySelectorAll('input:checked')).map(cb => Number(cb.value));

    if (Array.isArray(stallIds) && stallIds.length === 0) {
      promotionMsg.textContent = 'Select at least one stall, or choose "All stalls".';
      promotionMsg.classList.add('error');
      return;
    }

    const payload = {
      HawkerId: currentHawkerId,
      Name: document.getElementById('p_Name').value,
      Description: document.getElementById('p_Description').value,
      DiscountType: document.getElementById('p_DiscountType').value,
      DiscountValue: Number(document.getElementById('p_DiscountValue').value),
      StartDateTime: document.getElementById('p_Start').value,
      EndDateTime: document.getElementById('p_End').value,
      stallIds,
    };

    try {
      const res = await fetch(`${CM_API_URL}/promotions`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
      const result = await res.json();
      if (!res.ok) {
        promotionMsg.textContent = result.error || 'Failed to create promotion.';
        promotionMsg.classList.add('error');
        return;
      }
      promotionModal.classList.remove('show');
      loadPromotions();
    } catch (err) {
      promotionMsg.textContent = 'Network error. Please try again.';
      promotionMsg.classList.add('error');
    }
  });

  
  const cloneModal = document.getElementById('cloneModal');
  const cloneTargetCentre = document.getElementById('cloneTargetCentre');
  const cloneMsg = document.getElementById('cloneMsg');
  let cloningPromotionId = null;

  promotionsTableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('clone-promo-btn')) return;
    cloningPromotionId = Number(target.dataset.id);
    const others = myCentres.filter(c => c.HawkerId !== currentHawkerId);
    cloneTargetCentre.innerHTML = others.map(c => `<option value="${c.HawkerId}">${c.Name}</option>`).join('');
    cloneMsg.textContent = '';
    cloneMsg.className = 'msg';
    cloneModal.classList.add('show');
  });
  document.getElementById('cancelCloneBtn').addEventListener('click', () => cloneModal.classList.remove('show'));
  cloneModal.addEventListener('click', (e) => { if (e.target === cloneModal) cloneModal.classList.remove('show'); });

  document.getElementById('confirmCloneBtn').addEventListener('click', async () => {
    cloneMsg.textContent = '';
    cloneMsg.className = 'msg';
    try {
      const res = await fetch(`${CM_API_URL}/promotions/${cloningPromotionId}/clone`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ targetHawkerId: Number(cloneTargetCentre.value) }),
      });
      const result = await res.json();
      if (!res.ok) {
        cloneMsg.textContent = result.error || 'Failed to clone promotion.';
        cloneMsg.classList.add('error');
        return;
      }
      cloneModal.classList.remove('show');
      alert('Promotion cloned. Switch to the target centre to select stalls for it.');
    } catch (err) {
      cloneMsg.textContent = 'Network error. Please try again.';
      cloneMsg.classList.add('error');
    }
  });

  loadMyCentres();
})();
