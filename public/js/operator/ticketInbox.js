const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const TICKETS_API_URL = `${BACKEND_BASE_URL}/api/tickets`;

const SLA_THRESHOLD_MS = 48 * 60 * 60 * 1000; 
const IN_FLIGHT_STATUSES = ['In Progress', 'Finding Solution', 'Testing', 'Awaiting Response'];
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusBadge(status) {
  let cls = 'status-open';
  if (IN_FLIGHT_STATUSES.includes(status)) cls = 'status-inflight';
  else if (status === 'Completed') cls = 'status-completed';
  else if (status === 'Unresolvable') cls = 'status-unresolvable';
  return `<span class="status-badge ${cls}">${status}</span>`;
}

function isVideoType(type) { return VIDEO_TYPES.includes(type); }

function attachmentHtml(att) {
  const url = `${BACKEND_BASE_URL}${att.StoragePath}`;
  const media = isVideoType(att.FileType)
    ? `<video src="${url}" controls></video>`
    : `<img src="${url}" alt="${att.FileName}">`;
  return `<a class="attachment-thumb" href="${url}" target="_blank" rel="noopener">${media}<span class="file-label">${att.FileName}</span></a>`;
}

(function initTicketInboxPage() {
  const tableBody = document.getElementById('inboxList');
  if (!tableBody) return; 

  const token = localStorage.getItem('authToken');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (!token || role !== 'operator') {
    window.location.href = '/auth/login.html';
    return;
  }

  const emptyMsg = document.getElementById('inboxEmptyMsg');
  const filterCategory = document.getElementById('filterCategory');
  const filterStatus = document.getElementById('filterStatus');
  const filterCentreWrap = document.getElementById('filterCentreWrap');
  const filterCentre = document.getElementById('filterCentre');

  const detailModal = document.getElementById('ticketDetailModal');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const detailTicketTitle = document.getElementById('detailTicketTitle');
  const detailTicketBody = document.getElementById('detailTicketBody');
  const detailActions = document.getElementById('detailActions');
  const detailMsg = document.getElementById('detailMsg');

  const completeModal = document.getElementById('completeModal');
  const closeCompleteModalBtn = document.getElementById('closeCompleteModalBtn');
  const cancelCompleteBtn = document.getElementById('cancelCompleteBtn');
  const completeForm = document.getElementById('completeForm');
  const completeMsg = document.getElementById('completeMsg');

  let currentTicketId = null;

  async function loadAssignedCentres() {
    try {
      const res = await fetch(`${TICKETS_API_URL}/centres/mine`, { headers: { ...authHeaders() } });
      const centres = await res.json();
      if (Array.isArray(centres) && centres.length > 1) {
        filterCentre.innerHTML = '<option value="">All my centres</option>' +
          centres.map(c => `<option value="${c.HawkerId}">${c.Name}</option>`).join('');
        filterCentreWrap.style.display = 'flex';
      }
    } catch (err) {
      
    }
  }

  function renderRows(data) {
    tableBody.innerHTML = '';
    if (data.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    const now = Date.now();
    data.forEach(t => {
      const ageMs = now - new Date(t.CreatedAt).getTime();
      const breached = ageMs > SLA_THRESHOLD_MS;
      const category = t.Category === 'Others' ? (t.OtherCategoryText || 'Others') : t.Category;
      const wrap = document.createElement('div');
      wrap.className = 'listRowWrap' + (breached ? ' sla-breach' : '');
      wrap.innerHTML = `
        <button type="button" class="listRow edit-btn" data-id="${t.TicketId}">
          <span class="listRowMain">
            <span class="listRowName">${t.Subject}</span>
            <span class="listRowMeta">${category} &middot; ${t.HawkerName || ''}</span>
          </span>
          <span class="listRowWhen">${statusBadge(t.Status)}${breached ? '<span class="sla-breach-badge">SLA</span>' : ''}</span>
        </button>
      `;
      tableBody.appendChild(wrap);
    });
  }

  async function loadTickets() {
    const params = new URLSearchParams();
    params.set('status', 'open');
    if (filterCategory.value) params.set('category', filterCategory.value);
    if (filterStatus.value) params.set('exactStatus', filterStatus.value);
    if (filterCentre.value) params.set('hawkerId', filterCentre.value);

    try {
      const res = await fetch(`${TICKETS_API_URL}?${params.toString()}`, { headers: { ...authHeaders() } });
      const data = await res.json();
      renderRows(Array.isArray(data) ? data : []);
    } catch (err) {
      emptyMsg.textContent = 'Failed to load tickets.';
      emptyMsg.style.display = 'block';
    }
  }

  filterCategory.addEventListener('change', loadTickets);
  filterStatus.addEventListener('change', loadTickets);
  filterCentre.addEventListener('change', loadTickets);

  tableBody.addEventListener('click', (e) => {
    const btn = e.target instanceof HTMLElement ? e.target.closest('.edit-btn') : null;
    if (btn) {
      openDetailModal(Number(btn.dataset.id));
    }
  });

  const myOperatorId = String(localStorage.getItem('userId'));

  function renderDetailActions(t) {
    if (t.Status === 'Open') {
      detailActions.innerHTML = `<button type="button" id="claimBtn" class="claim-btn">Claim Ticket</button>`;
      document.getElementById('claimBtn').addEventListener('click', () => claimTicket(t.TicketId));
      return;
    }

    if (String(t.AssignedOperatorId) === myOperatorId) {
      const otherStatuses = IN_FLIGHT_STATUSES.filter(s => s !== t.Status);
      detailActions.innerHTML = `
        <div class="form-actions" style="justify-content: space-between; flex-wrap: wrap;">
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="statusSelect" class="status-select">
              ${otherStatuses.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <button type="button" id="updateStatusBtn" class="edit-btn">Update Status</button>
          </div>
          <button type="button" id="markCompleteBtn" class="complete-btn">Mark Complete</button>
        </div>
      `;
      document.getElementById('updateStatusBtn').addEventListener('click', () => updateStatus(t.TicketId));
      document.getElementById('markCompleteBtn').addEventListener('click', () => openCompleteModal(t.TicketId));
    } else {
      detailActions.innerHTML = '<p class="empty-msg" style="padding:0;">Assigned to another operator.</p>';
    }
  }

  async function openDetailModal(ticketId) {
    detailMsg.textContent = '';
    detailMsg.className = 'msg';
    try {
      const res = await fetch(`${TICKETS_API_URL}/${ticketId}`, { headers: { ...authHeaders() } });
      const t = await res.json();
      if (!res.ok) {
        alert(t.error || 'Failed to load ticket.');
        return;
      }

      currentTicketId = t.TicketId;
      detailTicketTitle.textContent = t.Subject;

      let rowsHtml = `
        <div class="detail-row"><span>Submitter</span><strong>${t.SubmitterUserName} (${t.UserRole})</strong></div>
        <div class="detail-row"><span>Hawker Centre</span><strong>${t.HawkerName}</strong></div>
        <div class="detail-row"><span>Category</span><strong>${t.Category}${t.Category === 'Others' && t.OtherCategoryText ? ` (${t.OtherCategoryText})` : ''}</strong></div>
        <div class="detail-row"><span>Status</span><strong>${statusBadge(t.Status)}</strong></div>
        <div class="detail-row"><span>Created</span><strong>${new Date(t.CreatedAt).toLocaleString()}</strong></div>
        <div class="detail-row detail-row-block"><span>Description</span><p>${t.Description}</p></div>
      `;
      if (t.attachments && t.attachments.length) {
        rowsHtml += `<div class="detail-row-block"><span>Attachments</span><div class="attachment-grid">${t.attachments.map(attachmentHtml).join('')}</div></div>`;
      }

      detailTicketBody.innerHTML = rowsHtml;
      renderDetailActions(t);
      detailModal.classList.add('show');
    } catch (err) {
      alert('Network error loading ticket.');
    }
  }

  async function claimTicket(ticketId) {
    try {
      const res = await fetch(`${TICKETS_API_URL}/${ticketId}/claim`, {
        method: 'PATCH',
        headers: { ...authHeaders() },
      });
      const result = await res.json();
      if (!res.ok) {
        detailMsg.textContent = result.error || 'Failed to claim ticket.';
        detailMsg.classList.add('error');
        return;
      }
      detailModal.classList.remove('show');
      await loadTickets();
    } catch (err) {
      detailMsg.textContent = 'Network error. Please try again.';
      detailMsg.classList.add('error');
    }
  }

  async function updateStatus(ticketId) {
    const newStatus = document.getElementById('statusSelect').value;
    try {
      const res = await fetch(`${TICKETS_API_URL}/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ Status: newStatus }),
      });
      const result = await res.json();
      if (!res.ok) {
        detailMsg.textContent = result.error || 'Failed to update status.';
        detailMsg.classList.add('error');
        return;
      }
      detailModal.classList.remove('show');
      await loadTickets();
    } catch (err) {
      detailMsg.textContent = 'Network error. Please try again.';
      detailMsg.classList.add('error');
    }
  }

  function openCompleteModal(ticketId) {
    currentTicketId = ticketId;
    completeForm.reset();
    completeMsg.textContent = '';
    completeMsg.className = 'msg';
    completeModal.classList.add('show');
  }

  function closeCompleteModal() {
    completeModal.classList.remove('show');
  }

  completeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    completeMsg.textContent = '';
    completeMsg.className = 'msg';

    const outcome = document.getElementById('Outcome').value;
    const message = document.getElementById('Message').value.trim();
    if (!message) {
      completeMsg.textContent = 'A resolution message is required.';
      completeMsg.classList.add('error');
      return;
    }

    try {
      const res = await fetch(`${TICKETS_API_URL}/${currentTicketId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ Outcome: outcome, Message: message }),
      });
      const result = await res.json();
      if (!res.ok) {
        completeMsg.textContent = result.error || 'Failed to close ticket.';
        completeMsg.classList.add('error');
        return;
      }
      closeCompleteModal();
      detailModal.classList.remove('show');
      await loadTickets();
    } catch (err) {
      completeMsg.textContent = 'Network error. Please try again.';
      completeMsg.classList.add('error');
    }
  });

  closeCompleteModalBtn.addEventListener('click', closeCompleteModal);
  cancelCompleteBtn.addEventListener('click', closeCompleteModal);
  completeModal.addEventListener('click', (e) => {
    if (e.target === completeModal) closeCompleteModal();
  });

  closeDetailModalBtn.addEventListener('click', () => detailModal.classList.remove('show'));
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.classList.remove('show');
  });

  loadAssignedCentres();
  loadTickets();
})();
