const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const TICKETS_API_URL = `${BACKEND_BASE_URL}/api/tickets`;

const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function outcomeBadge(status) {
  const cls = status === 'Completed' ? 'status-completed' : 'status-unresolvable';
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

(function initOperatorTicketHistoryPage() {
  const tableBody = document.querySelector('#historyTable tbody');
  if (!tableBody) return; 

  const token = localStorage.getItem('authToken');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (!token || role !== 'operator') {
    window.location.href = '/auth/login.html';
    return;
  }

  const emptyMsg = document.getElementById('historyEmptyMsg');
  const filterCategory = document.getElementById('filterCategory');
  const filterOutcome = document.getElementById('filterOutcome');
  const filterDateFrom = document.getElementById('filterDateFrom');
  const filterDateTo = document.getElementById('filterDateTo');
  const clearFilterBtn = document.getElementById('clearHistoryFilterBtn');

  const viewModal = document.getElementById('viewHistoryModal');
  const closeViewModalBtn = document.getElementById('closeViewModalBtn');
  const viewModalTitle = document.getElementById('viewModalTitle');
  const viewModalBody = document.getElementById('viewModalBody');

  function renderRows(data) {
    tableBody.innerHTML = '';
    if (data.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    data.forEach(h => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${h.Subject}</td>
        <td>${h.Category}</td>
        <td>${h.HawkerName || ''}</td>
        <td>${outcomeBadge(h.Status)}</td>
        <td>${new Date(h.CompletedAt).toLocaleDateString()}</td>
        <td><button type="button" class="edit-btn" data-ticket-id="${h.TicketId}">View</button></td>
      `;
      tableBody.appendChild(row);
    });
  }

  async function loadHistory() {
    const params = new URLSearchParams();
    if (filterCategory.value) params.set('category', filterCategory.value);
    if (filterOutcome.value) params.set('outcome', filterOutcome.value);
    if (filterDateFrom.value) params.set('dateFrom', `${filterDateFrom.value}T00:00:00`);
    if (filterDateTo.value) params.set('dateTo', `${filterDateTo.value}T23:59:59`);

    try {
      const res = await fetch(`${TICKETS_API_URL}/history?${params.toString()}`, { headers: { ...authHeaders() } });
      const data = await res.json();
      renderRows(Array.isArray(data) ? data : []);
    } catch (err) {
      emptyMsg.textContent = 'Failed to load ticket history.';
      emptyMsg.style.display = 'block';
    }
  }

  [filterCategory, filterOutcome, filterDateFrom, filterDateTo].forEach(el => el.addEventListener('change', loadHistory));
  clearFilterBtn.addEventListener('click', () => {
    filterCategory.value = '';
    filterOutcome.value = '';
    filterDateFrom.value = '';
    filterDateTo.value = '';
    loadHistory();
  });

  tableBody.addEventListener('click', async (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('edit-btn')) return;

    const ticketId = target.dataset.ticketId;
    try {
      const res = await fetch(`${TICKETS_API_URL}/${ticketId}`, { headers: { ...authHeaders() } });
      const t = await res.json();
      if (!res.ok) {
        alert(t.error || 'Failed to load ticket.');
        return;
      }

      viewModalTitle.textContent = t.Subject;
      let rowsHtml = `
        <div class="detail-row"><span>Submitter</span><strong>${t.SubmitterUserName} (${t.UserRole})</strong></div>
        <div class="detail-row"><span>Hawker Centre</span><strong>${t.HawkerName}</strong></div>
        <div class="detail-row"><span>Category</span><strong>${t.Category}${t.Category === 'Others' && t.OtherCategoryText ? ` (${t.OtherCategoryText})` : ''}</strong></div>
        <div class="detail-row"><span>Outcome</span><strong>${outcomeBadge(t.Status)}</strong></div>
        <div class="detail-row"><span>Submitted</span><strong>${new Date(t.CreatedAt).toLocaleString()}</strong></div>
        <div class="detail-row detail-row-block"><span>Original Description</span><p>${t.Description}</p></div>
      `;
      if (t.attachments && t.attachments.length) {
        rowsHtml += `<div class="detail-row-block"><span>Attachments</span><div class="attachment-grid">${t.attachments.map(attachmentHtml).join('')}</div></div>`;
      }
      if (t.history) {
        rowsHtml += `
          <div class="detail-row"><span>Resolved By</span><strong>${t.history.ResolvedByUserName}</strong></div>
          <div class="detail-row"><span>Closed</span><strong>${new Date(t.history.CompletedAt).toLocaleString()}</strong></div>
          <div class="detail-row detail-row-block"><span>Resolution Message</span><p>${t.history.Message}</p></div>
        `;
      }

      viewModalBody.innerHTML = rowsHtml;
      viewModal.classList.add('show');
    } catch (err) {
      alert('Network error loading ticket.');
    }
  });

  closeViewModalBtn.addEventListener('click', () => viewModal.classList.remove('show'));
  viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) viewModal.classList.remove('show');
  });

  loadHistory();
})();
