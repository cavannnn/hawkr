const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const TICKETS_API_URL = `${BACKEND_BASE_URL}/api/tickets`;

const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusBadge(status) {
  let cls = 'status-open';
  if (['In Progress', 'Finding Solution', 'Testing', 'Awaiting Response'].includes(status)) cls = 'status-inflight';
  else if (status === 'Completed') cls = 'status-completed';
  else if (status === 'Unresolvable') cls = 'status-unresolvable';
  return `<span class="status-badge ${cls}">${status}</span>`;
}

function isImageType(type) { return IMAGE_TYPES.includes(type); }
function isVideoType(type) { return VIDEO_TYPES.includes(type); }

(function initTicketsPage() {
  const submittedTableBody = document.querySelector('#submittedTable tbody');
  if (!submittedTableBody) return; // not on the tickets page

  const token = localStorage.getItem('authToken');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (!token || !['customer', 'vendor'].includes(role)) {
    window.location.href = '/auth/login.html';
    return;
  }

  // ---------- Navbar ----------
  const username = localStorage.getItem('username');
  document.getElementById('profileUsername').textContent = username || 'there';
  document.getElementById('profileAvatar').textContent = (username || '?').charAt(0).toUpperCase();
  document.getElementById('homeLink').href = role === 'vendor' ? 'vendor/dashboard.html' : 'customer/customer.html';

  const profileMenu = document.getElementById('profileMenu');
  document.getElementById('profileTrigger').addEventListener('click', (e) => {
    e.stopPropagation();
    profileMenu.classList.toggle('open');
  });
  document.addEventListener('click', () => profileMenu.classList.remove('open'));
  document.getElementById('navLogoutBtn').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    window.location.href = '/auth/login.html';
  });

  // ---------- Tabs ----------
  const tabSubmittedBtn = document.getElementById('tabSubmittedBtn');
  const tabHistoryBtn = document.getElementById('tabHistoryBtn');
  const submittedPanel = document.getElementById('submittedPanel');
  const historyPanel = document.getElementById('historyPanel');

  let historyLoaded = false;

  tabSubmittedBtn.addEventListener('click', () => {
    tabSubmittedBtn.classList.add('active');
    tabHistoryBtn.classList.remove('active');
    submittedPanel.classList.add('active');
    historyPanel.classList.remove('active');
  });

  tabHistoryBtn.addEventListener('click', () => {
    tabHistoryBtn.classList.add('active');
    tabSubmittedBtn.classList.remove('active');
    historyPanel.classList.add('active');
    submittedPanel.classList.remove('active');
    if (!historyLoaded) {
      historyLoaded = true;
      loadHistoryTickets();
    }
  });

  // ---------- Load lists ----------
  const submittedEmptyMsg = document.getElementById('submittedEmptyMsg');
  const historyTableBody = document.querySelector('#historyTable tbody');
  const historyEmptyMsg = document.getElementById('historyEmptyMsg');

  async function loadSubmittedTickets() {
    try {
      const res = await fetch(`${TICKETS_API_URL}?status=open`, { headers: { ...authHeaders() } });
      const data = await res.json();
      submittedTableBody.innerHTML = '';
      if (!Array.isArray(data) || data.length === 0) {
        submittedEmptyMsg.style.display = 'block';
        return;
      }
      submittedEmptyMsg.style.display = 'none';
      data.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${t.Subject}</td>
          <td>${t.Category === 'Others' ? (t.OtherCategoryText || 'Others') : t.Category}</td>
          <td>${statusBadge(t.Status)}</td>
          <td>${new Date(t.CreatedAt).toLocaleDateString()}</td>
          <td><button type="button" class="edit-btn" data-id="${t.TicketId}">View</button></td>
        `;
        submittedTableBody.appendChild(row);
      });
    } catch (err) {
      submittedEmptyMsg.textContent = 'Failed to load your tickets.';
      submittedEmptyMsg.style.display = 'block';
    }
  }

  async function loadHistoryTickets() {
    try {
      const res = await fetch(`${TICKETS_API_URL}?status=closed`, { headers: { ...authHeaders() } });
      const data = await res.json();
      historyTableBody.innerHTML = '';
      if (!Array.isArray(data) || data.length === 0) {
        historyEmptyMsg.style.display = 'block';
        return;
      }
      historyEmptyMsg.style.display = 'none';
      data.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${t.Subject}</td>
          <td>${t.Category === 'Others' ? (t.OtherCategoryText || 'Others') : t.Category}</td>
          <td>${statusBadge(t.Status)}</td>
          <td>${t.history ? new Date(t.history.CompletedAt).toLocaleDateString() : '-'}</td>
          <td><button type="button" class="edit-btn" data-id="${t.TicketId}">View</button></td>
        `;
        historyTableBody.appendChild(row);
      });
    } catch (err) {
      historyEmptyMsg.textContent = 'Failed to load your ticket history.';
      historyEmptyMsg.style.display = 'block';
    }
  }

  submittedTableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.classList.contains('edit-btn')) {
      openViewModal(Number(target.dataset.id));
    }
  });
  historyTableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.classList.contains('edit-btn')) {
      openViewModal(Number(target.dataset.id));
    }
  });

  // ---------- New Ticket modal ----------
  const newTicketModal = document.getElementById('newTicketModal');
  const newTicketBtn = document.getElementById('newTicketBtn');
  const closeNewTicketBtn = document.getElementById('closeNewTicketBtn');
  const cancelNewTicketBtn = document.getElementById('cancelNewTicketBtn');
  const newTicketForm = document.getElementById('newTicketForm');
  const ticketFormMsg = document.getElementById('ticketFormMsg');
  const categorySelect = document.getElementById('Category');
  const otherCategoryField = document.getElementById('otherCategoryField');
  const otherCategoryInput = document.getElementById('OtherCategoryText');
  const hawkerSelect = document.getElementById('HawkerId');
  const attachmentsInput = document.getElementById('attachmentsInput');
  const fileList = document.getElementById('fileList');

  let selectedFiles = [];

  async function loadHawkerCentres() {
    try {
      const res = await fetch(`${TICKETS_API_URL}/centres`, { headers: { ...authHeaders() } });
      const centres = await res.json();
      hawkerSelect.innerHTML = Array.isArray(centres)
        ? centres.map(c => `<option value="${c.HawkerId}">${c.Name}</option>`).join('')
        : '';
    } catch (err) {
      hawkerSelect.innerHTML = '';
    }
  }

  categorySelect.addEventListener('change', () => {
    otherCategoryField.style.display = categorySelect.value === 'Others' ? 'block' : 'none';
  });

  function renderFileList() {
    fileList.innerHTML = '';
    selectedFiles.forEach((file, index) => {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.innerHTML = `
        <span>${file.name} (${(file.size / (1024 * 1024)).toFixed(2)}MB)</span>
        <button type="button" class="file-chip-remove" data-index="${index}">Remove</button>
      `;
      fileList.appendChild(chip);
    });
  }

  fileList.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.classList.contains('file-chip-remove')) {
      selectedFiles.splice(Number(target.dataset.index), 1);
      renderFileList();
    }
  });

  attachmentsInput.addEventListener('change', () => {
    ticketFormMsg.textContent = '';
    ticketFormMsg.className = 'msg';

    for (const file of attachmentsInput.files) {
      const isImage = isImageType(file.type);
      const isVideo = isVideoType(file.type);
      if (!isImage && !isVideo) {
        ticketFormMsg.textContent = `${file.name} is not a supported file type (jpg, png, mp4, mov only).`;
        ticketFormMsg.classList.add('error');
        continue;
      }
      const limit = isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
      if (file.size > limit) {
        ticketFormMsg.textContent = `${file.name} is too large. Images must be under 5MB, videos under 50MB.`;
        ticketFormMsg.classList.add('error');
        continue;
      }
      selectedFiles.push(file);
    }
    attachmentsInput.value = '';
    renderFileList();
  });

  function openNewTicketModal() {
    newTicketForm.reset();
    selectedFiles = [];
    renderFileList();
    otherCategoryField.style.display = 'none';
    ticketFormMsg.textContent = '';
    ticketFormMsg.className = 'msg';
    loadHawkerCentres();
    newTicketModal.classList.add('show');
  }

  function closeNewTicketModal() {
    newTicketModal.classList.remove('show');
  }

  newTicketBtn.addEventListener('click', openNewTicketModal);
  closeNewTicketBtn.addEventListener('click', closeNewTicketModal);
  cancelNewTicketBtn.addEventListener('click', closeNewTicketModal);
  newTicketModal.addEventListener('click', (e) => {
    if (e.target === newTicketModal) closeNewTicketModal();
  });

  newTicketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    ticketFormMsg.textContent = '';
    ticketFormMsg.className = 'msg';

    if (categorySelect.value === 'Others' && !otherCategoryInput.value.trim()) {
      ticketFormMsg.textContent = 'Please describe the category.';
      ticketFormMsg.classList.add('error');
      return;
    }

    const formData = new FormData();
    formData.append('HawkerId', hawkerSelect.value);
    formData.append('Category', categorySelect.value);
    formData.append('OtherCategoryText', otherCategoryInput.value.trim());
    formData.append('Subject', document.getElementById('Subject').value);
    formData.append('Description', document.getElementById('Description').value);
    selectedFiles.forEach(file => formData.append('attachments', file));

    try {
      const res = await fetch(TICKETS_API_URL, {
        method: 'POST',
        headers: { ...authHeaders() }, // no Content-Type: browser sets the multipart boundary
        body: formData,
      });
      const result = await res.json();

      if (!res.ok) {
        ticketFormMsg.textContent = result.error || 'Failed to submit ticket.';
        ticketFormMsg.classList.add('error');
        return;
      }

      closeNewTicketModal();
      await loadSubmittedTickets();
    } catch (err) {
      ticketFormMsg.textContent = 'Network error. Please try again.';
      ticketFormMsg.classList.add('error');
    }
  });

  // ---------- View Ticket modal ----------
  const viewTicketModal = document.getElementById('viewTicketModal');
  const closeViewTicketBtn = document.getElementById('closeViewTicketBtn');
  const viewTicketTitle = document.getElementById('viewTicketTitle');
  const viewTicketDetails = document.getElementById('viewTicketDetails');

  function attachmentHtml(att) {
    const url = `${BACKEND_BASE_URL}${att.StoragePath}`;
    const isVideo = isVideoType(att.FileType);
    const media = isVideo
      ? `<video src="${url}" muted></video>`
      : `<img src="${url}" alt="${att.FileName}">`;
    return `<a class="attachment-thumb" href="${url}" target="_blank" rel="noopener">${media}<span class="file-label">${att.FileName}</span></a>`;
  }

  async function openViewModal(ticketId) {
    try {
      const res = await fetch(`${TICKETS_API_URL}/${ticketId}`, { headers: { ...authHeaders() } });
      const t = await res.json();
      if (!res.ok) {
        alert(t.error || 'Failed to load ticket.');
        return;
      }

      viewTicketTitle.textContent = t.Subject;

      let rowsHtml = `
        <div class="detail-row"><span>Status</span><strong>${statusBadge(t.Status)}</strong></div>
        <div class="detail-row"><span>Category</span><strong>${t.Category}${t.Category === 'Others' && t.OtherCategoryText ? ` (${t.OtherCategoryText})` : ''}</strong></div>
        <div class="detail-row"><span>Submitted</span><strong>${new Date(t.CreatedAt).toLocaleString()}</strong></div>
        <div class="detail-row detail-row-block"><span>Description</span><p>${t.Description}</p></div>
      `;

      if (t.attachments && t.attachments.length) {
        rowsHtml += `<div class="detail-row-block"><span>Attachments</span><div class="attachment-grid">${t.attachments.map(attachmentHtml).join('')}</div></div>`;
      }

      if (t.history) {
        rowsHtml += `
          <div class="detail-row"><span>Resolved By</span><strong>${t.history.ResolvedByUserName || 'Operator'}</strong></div>
          <div class="detail-row"><span>Closed</span><strong>${new Date(t.history.CompletedAt).toLocaleString()}</strong></div>
          <div class="detail-row detail-row-block"><span>Resolution Message</span><p>${t.history.Message}</p></div>
        `;
      }

      viewTicketDetails.innerHTML = rowsHtml;
      viewTicketModal.classList.add('show');
    } catch (err) {
      alert('Network error loading ticket.');
    }
  }

  closeViewTicketBtn.addEventListener('click', () => viewTicketModal.classList.remove('show'));
  viewTicketModal.addEventListener('click', (e) => {
    if (e.target === viewTicketModal) viewTicketModal.classList.remove('show');
  });

  loadSubmittedTickets();
})();
