const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const HISTORY_API_URL = `${BACKEND_BASE_URL}/api/rental-agreement-history`;

(function initHistoryPage() {
  const tableBody = document.querySelector('#historyTable tbody');
  if (!tableBody) return; 

  const filterInput = document.getElementById('filterHistoryId');
  const clearFilterBtn = document.getElementById('clearHistoryFilterBtn');
  const emptyMsg = document.getElementById('historyEmptyMsg');

  const viewModal = document.getElementById('viewHistoryModal');
  const closeViewModalBtn = document.getElementById('closeViewModalBtn');
  const viewModalTitle = document.getElementById('viewModalTitle');

  let allHistory = [];

  function statusBadge(status) {
    const cls = status === 'Expired' ? 'status-expired' : 'status-cancelled';
    return `<span class="status-badge ${cls}">${status}</span>`;
  }

  function renderRows(data) {
    tableBody.innerHTML = '';
    if (data.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';
    data.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.AgreementId}</td>
        <td>${item.StallId}</td>
        <td>${item.OwnerId}</td>
        <td>${new Date(item.AgreementStartDate).toLocaleDateString()}</td>
        <td>${new Date(item.AgreementEndDate).toLocaleDateString()}</td>
        <td>$${Number(item.RentalPrice).toFixed(2)}</td>
        <td>${statusBadge(item.Status)}</td>
        <td>${new Date(item.ArchivedAt).toLocaleDateString()}</td>
        <td><button type="button" class="edit-btn" data-id="${item.HistoryId}">View</button></td>
      `;
      tableBody.appendChild(row);
    });
  }

  function applyFilter() {
    const val = filterInput.value.trim();
    if (!val) {
      renderRows(allHistory);
      return;
    }
    const id = Number(val);
    renderRows(allHistory.filter(item => item.AgreementId === id));
  }

  async function loadHistory() {
    try {
      const res = await fetch(HISTORY_API_URL);
      const data = await res.json();
      allHistory = data;
      applyFilter();
    } catch (err) {
      emptyMsg.textContent = 'Failed to load rental agreement history.';
      emptyMsg.style.display = 'block';
    }
  }

  function openViewModal(item) {
    viewModalTitle.textContent = `Agreement #${item.AgreementId}`;
    document.getElementById('v_Status').innerHTML = statusBadge(item.Status);
    document.getElementById('v_StallId').textContent = item.StallId;
    document.getElementById('v_OwnerId').textContent = item.OwnerId;
    document.getElementById('v_AgreementStartDate').textContent = new Date(item.AgreementStartDate).toLocaleString();
    document.getElementById('v_AgreementEndDate').textContent = new Date(item.AgreementEndDate).toLocaleString();
    document.getElementById('v_RentalPrice').textContent = `$${Number(item.RentalPrice).toFixed(2)}`;
    document.getElementById('v_ArchivedAt').textContent = new Date(item.ArchivedAt).toLocaleString();
    document.getElementById('v_AgreementTermsAndConditions').textContent = item.AgreementTermsAndConditions;
    viewModal.classList.add('show');
  }

  filterInput.addEventListener('input', applyFilter);
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      filterInput.value = '';
      applyFilter();
    });
  }

  tableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('edit-btn')) return;
    const id = Number(target.dataset.id);
    const item = allHistory.find(h => h.HistoryId === id);
    if (item) openViewModal(item);
  });

  closeViewModalBtn.addEventListener('click', () => viewModal.classList.remove('show'));
  viewModal.addEventListener('click', (e) => {
    if (e.target === viewModal) viewModal.classList.remove('show');
  });

  loadHistory();
})();
