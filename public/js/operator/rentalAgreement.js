const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const API_URL = `${BACKEND_BASE_URL}/api/rental-agreements`;

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncateTerms(text, maxLength = 80) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}


(function initManagePage() {
  const tableBody = document.querySelector('#agreementTable tbody');
  const form = document.getElementById('agreementForm');
  if (!tableBody || !form) return; 

  const filterInput = document.getElementById('filterId');
  const clearFilterBtn = document.getElementById('clearFilterBtn');
  const emptyMsg = document.getElementById('emptyMsg');
  const authStatus = document.getElementById('authStatus');
  const pageMsg = document.getElementById('pageMsg');
  const newAgreementBtn = document.getElementById('newAgreementBtn');

  const agreementModal = document.getElementById('agreementModal');
  const closeFormModalBtn = document.getElementById('closeFormModalBtn');
  const formTitle = document.getElementById('formTitle');
  const agreementIdField = document.getElementById('AgreementId');
  const startDateField = document.getElementById('AgreementStartDate');
  const startDateNote = document.getElementById('startDateNote');
  const saveBtn = document.getElementById('saveBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const msg = document.getElementById('msg');

  const confirmModal = document.getElementById('confirmModal');
  const confirmModalText = document.getElementById('confirmModalText');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');

  let allAgreements = [];
  let editingId = null;
  let pendingDeleteId = null;

  function showPageMsg(text, isError) {
    pageMsg.textContent = text;
    pageMsg.className = 'msg' + (isError ? ' error' : ' success');
  }

  function updateAuthStatus() {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('userRole');
    if (token && role === 'operator') {
      authStatus.textContent = 'Logged in as operator';
      authStatus.classList.remove('error');
    } else if (token) {
      authStatus.textContent = `Logged in as ${role}. Only operators can create, edit, or delete agreements.`;
      authStatus.classList.add('error');
    } else {
      authStatus.textContent = 'Not logged in as operator. Log in to create, edit, or delete agreements.';
      authStatus.classList.add('error');
    }
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
        <td title="${escapeHtml(item.AgreementTermsAndConditions || '')}">${escapeHtml(truncateTerms(item.AgreementTermsAndConditions))}</td>
        <td>${item.RentalPrice}</td>
        <td>
          <a class="edit-btn" href="${API_URL}/${item.AgreementId}/pdf" target="_blank" rel="noopener">PDF</a>
          <button type="button" class="edit-btn" data-id="${item.AgreementId}">Edit</button>
          <button type="button" class="delete-btn" data-id="${item.AgreementId}">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  function applyFilter() {
    const val = filterInput.value.trim();
    if (!val) {
      renderRows(allAgreements);
      return;
    }
    const id = Number(val);
    renderRows(allAgreements.filter(item => item.AgreementId === id));
  }

  async function loadAgreements() {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      allAgreements = data;
      applyFilter();
    } catch (err) {
      emptyMsg.textContent = 'Failed to load agreements.';
      emptyMsg.style.display = 'block';
    }
  }

  function openFormModal() {
    agreementModal.classList.add('show');
  }

  function closeFormModal() {
    agreementModal.classList.remove('show');
  }

  function openCreateModal() {
    editingId = null;
    form.reset();
    agreementIdField.value = '';
    startDateField.disabled = false;
    startDateNote.style.display = 'none';
    formTitle.textContent = 'Create New Agreement';
    saveBtn.textContent = 'Save';
    msg.textContent = '';
    msg.className = 'msg';
    openFormModal();
  }

  function openEditModal(item) {
    editingId = item.AgreementId;
    agreementIdField.value = item.AgreementId;
    document.getElementById('StallId').value = item.StallId;
    document.getElementById('OwnerId').value = item.OwnerId;
    startDateField.value = toDatetimeLocal(item.AgreementStartDate);
    startDateField.disabled = true; 
    startDateNote.style.display = 'inline';
    document.getElementById('AgreementEndDate').value = toDatetimeLocal(item.AgreementEndDate);
    document.getElementById('AgreementTermsAndConditions').value = item.AgreementTermsAndConditions;
    document.getElementById('RentalPrice').value = item.RentalPrice;

    formTitle.textContent = `Edit Agreement #${item.AgreementId}`;
    saveBtn.textContent = 'Save Changes';
    msg.textContent = '';
    msg.className = 'msg';
    openFormModal();
  }

  filterInput.addEventListener('input', applyFilter);
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', () => {
      filterInput.value = '';
      applyFilter();
    });
  }

  newAgreementBtn.addEventListener('click', openCreateModal);
  cancelEditBtn.addEventListener('click', closeFormModal);
  closeFormModalBtn.addEventListener('click', closeFormModal);

  agreementModal.addEventListener('click', (e) => {
    if (e.target === agreementModal) closeFormModal();
  });

  tableBody.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const id = Number(target.dataset.id);
    if (!id) return;

    if (target.classList.contains('edit-btn')) {
      const item = allAgreements.find(a => a.AgreementId === id);
      if (item) openEditModal(item);
    } else if (target.classList.contains('delete-btn')) {
      pendingDeleteId = id;
      confirmModalText.textContent = `Are you sure you want to delete Agreement ID ${id}? This cannot be undone.`;
      confirmModal.classList.add('show');
    }
  });

  modalCancelBtn.addEventListener('click', () => {
    pendingDeleteId = null;
    confirmModal.classList.remove('show');
  });

  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      pendingDeleteId = null;
      confirmModal.classList.remove('show');
    }
  });

  modalConfirmBtn.addEventListener('click', async () => {
    confirmModal.classList.remove('show');
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    pendingDeleteId = null;

    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      const result = await res.json();

      if (!res.ok) {
        showPageMsg(result.error || result.message || 'Failed to delete agreement.', true);
        return;
      }

      showPageMsg('Agreement deleted successfully.', false);
      if (editingId === id) closeFormModal();
      await loadAgreements();
    } catch (err) {
      showPageMsg('Network error. Please try again.', true);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'msg';

    const isEdit = editingId !== null;

    const payload = {
      StallId: Number(document.getElementById('StallId').value),
      OwnerId: Number(document.getElementById('OwnerId').value),
      AgreementEndDate: document.getElementById('AgreementEndDate').value,
      AgreementTermsAndConditions: document.getElementById('AgreementTermsAndConditions').value,
      RentalPrice: Number(document.getElementById('RentalPrice').value),
    };

    if (isEdit) {
      payload.AgreementId = editingId;
    } else {
      payload.AgreementStartDate = document.getElementById('AgreementStartDate').value;
    }

    try {
      const res = await fetch(isEdit ? `${API_URL}/${editingId}` : API_URL, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok) {
        msg.textContent = result.error || result.message || `Failed to ${isEdit ? 'update' : 'create'} agreement.`;
        msg.classList.add('error');
        return;
      }

      closeFormModal();
      showPageMsg(`Agreement ${isEdit ? 'updated' : 'created'} successfully.`, false);
      await loadAgreements();
    } catch (err) {
      msg.textContent = 'Network error. Please try again.';
      msg.classList.add('error');
    }
  });

  updateAuthStatus();
  loadAgreements();
})();
