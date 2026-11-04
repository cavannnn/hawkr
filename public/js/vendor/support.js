const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const TICKETS_API_URL = `${BACKEND_BASE_URL}/api/tickets`;

const token = localStorage.getItem('authToken');

function authHeaders() {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}

function showBanner(id, message) {
  const banner = document.getElementById(id);
  banner.textContent = message;
  banner.classList.add('show');
  if (id === 'successBanner') setTimeout(() => banner.classList.remove('show'), 4000);
}

function hideBanners() {
  document.getElementById('errorBanner').classList.remove('show');
  document.getElementById('successBanner').classList.remove('show');
}

let ticketFilter = 'open';

function ticketStatusClass(status) {
  if (status === 'Completed') return 'ticket-status--done';
  if (status === 'Unresolvable') return 'ticket-status--unresolvable';
  if (['In Progress', 'Finding Solution', 'Testing', 'Awaiting Response'].includes(status)) return 'ticket-status--inflight';
  return 'ticket-status--open';
}

function ticketCardHtml(t) {
  const category = t.Category === 'Others' && t.OtherCategoryText ? t.OtherCategoryText : t.Category;
  const date = new Date(t.CreatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const reply = t.history
    ? `<div class="ticket-card__reply"><span class="ticket-card__reply-label">Reply</span><p>${escapeHtml(t.history.Message)}</p></div>`
    : '';
  return `
    <div class="card ticket-card">
      <div class="ticket-card__head">
        <span class="ticket-card__subject">${escapeHtml(t.Subject)}</span>
        <span class="ticket-status ${ticketStatusClass(t.Status)}">${escapeHtml(t.Status)}</span>
      </div>
      <div class="ticket-card__meta">${escapeHtml(category)} · ${escapeHtml(t.HawkerName || '')} · ${date}</div>
      <p class="ticket-card__desc">${escapeHtml(t.Description)}</p>
      ${reply}
    </div>
  `;
}

function renderEmpty(container, title, sub) {
  container.innerHTML = `
    <div class="card support-empty">
      <p class="support-empty__title">${escapeHtml(title)}</p>
      <p class="support-empty__sub">${escapeHtml(sub)}</p>
    </div>
  `;
}

async function loadTickets() {
  const container = document.getElementById('ticketsOutput');
  if (!token) {
    container.innerHTML = '';
    return;
  }

  try {
    const res = await fetch(`${TICKETS_API_URL}?status=${ticketFilter === 'answered' ? 'closed' : 'open'}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    const tickets = await res.json();

    if (!Array.isArray(tickets) || tickets.length === 0) {
      renderEmpty(
        container,
        ticketFilter === 'answered' ? 'No answered tickets yet' : 'No open tickets',
        ticketFilter === 'answered' ? "Once an operator replies, it'll show up here." : 'Raise one if something\'s wrong at a centre.'
      );
      return;
    }

    container.innerHTML = `<div class="ticket-list">${tickets.map(ticketCardHtml).join('')}</div>`;
  } catch (err) {
    renderEmpty(container, "Couldn't load your tickets", err.message);
  }
}

document.querySelectorAll('.support-seg__btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.support-seg__btn').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    ticketFilter = btn.dataset.ticketFilter;
    loadTickets();
  });
});



const newTicketModal = document.getElementById('newTicketModal');
const ticketForm = document.getElementById('ticketForm');
const ticketFormError = document.getElementById('ticketFormError');
const categorySelect = document.getElementById('ticketCategory');
const otherCategoryField = document.getElementById('ticketOtherCategoryField');
const hawkerSelect = document.getElementById('ticketHawkerId');

async function populateHawkerOptions() {
  hawkerSelect.innerHTML = '<option value="" disabled selected>Loading centres…</option>';
  try {
    const res = await fetch(`${TICKETS_API_URL}/centres`, { headers: authHeaders() });
    if (!res.ok) throw new Error('failed');
    const centres = await res.json();
    hawkerSelect.innerHTML = '<option value="" disabled selected>Choose a centre</option>' +
      centres.map((c) => `<option value="${c.HawkerId}">${escapeHtml(c.Name)}</option>`).join('');
  } catch (err) {
    hawkerSelect.innerHTML = '<option value="" disabled selected>Couldn\'t load centres</option>';
  }
}

categorySelect.addEventListener('change', () => {
  otherCategoryField.hidden = categorySelect.value !== 'Others';
});

function openNewTicketModal() {
  ticketForm.reset();
  otherCategoryField.hidden = true;
  ticketFormError.hidden = true;
  populateHawkerOptions();
  newTicketModal.classList.add('show');
}

function closeNewTicketModal() {
  newTicketModal.classList.remove('show');
}

document.getElementById('newTicketBtn').addEventListener('click', openNewTicketModal);
document.getElementById('cancelTicketBtn').addEventListener('click', closeNewTicketModal);
newTicketModal.addEventListener('click', (e) => {
  if (e.target === newTicketModal) closeNewTicketModal();
});

ticketForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  ticketFormError.hidden = true;
  hideBanners();

  if (categorySelect.value === 'Others' && !document.getElementById('ticketOtherCategory').value.trim()) {
    ticketFormError.textContent = 'Please describe the category.';
    ticketFormError.hidden = false;
    return;
  }

  const formData = new FormData();
  formData.append('HawkerId', hawkerSelect.value);
  formData.append('Category', categorySelect.value);
  formData.append('OtherCategoryText', document.getElementById('ticketOtherCategory').value.trim());
  formData.append('Subject', document.getElementById('ticketSubject').value);
  formData.append('Description', document.getElementById('ticketDescription').value);
  Array.from(document.getElementById('ticketFiles').files).forEach((f) => formData.append('attachments', f));

  const submitBtn = document.getElementById('submitTicketBtn');
  submitBtn.disabled = true;

  try {
    const res = await fetch(TICKETS_API_URL, { method: 'POST', headers: authHeaders(), body: formData });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to submit ticket.');

    closeNewTicketModal();
    showBanner('successBanner', 'Ticket submitted.');
    document.querySelectorAll('.support-seg__btn').forEach((b) => b.classList.toggle('is-active', b.dataset.ticketFilter === 'open'));
    ticketFilter = 'open';
    loadTickets();
  } catch (err) {
    ticketFormError.textContent = err.message;
    ticketFormError.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  window.location.href = '/auth/login.html';
});

loadTickets();
