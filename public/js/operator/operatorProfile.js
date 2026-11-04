const BACKEND_BASE_URL = window.location.port === '3000' ? '' : 'http://localhost:3000';
const PROFILE_API_URL = `${BACKEND_BASE_URL}/api/profile`;
const CENTRES_API_URL = `${BACKEND_BASE_URL}/api/profile/centres`;

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];

function authHeaders() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearOperatorSession() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userId');
  localStorage.removeItem('username');
}

(function initOperatorProfilePage() {
  const detailsForm = document.getElementById('detailsForm');
  if (!detailsForm) return; 

  const token = localStorage.getItem('authToken');
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (!token || role !== 'operator') {
    window.location.href = '/auth/login.html';
    return;
  }

  const photoPreview = document.getElementById('photoPreview');
  const photoInput = document.getElementById('photoInput');
  const photoMsg = document.getElementById('photoMsg');

  const detailsMsg = document.getElementById('detailsMsg');
  const passwordForm = document.getElementById('passwordForm');
  const passwordMsg = document.getElementById('passwordMsg');

  const centreChecklist = document.getElementById('centreChecklist');
  const centresMsg = document.getElementById('centresMsg');
  const saveCentresBtn = document.getElementById('saveCentresBtn');

  function renderPhoto(photoPath) {
    if (photoPath) {
      photoPreview.innerHTML = `<img src="${BACKEND_BASE_URL}${photoPath}" alt="">`;
    } else {
      const username = localStorage.getItem('username') || '?';
      photoPreview.textContent = username.charAt(0).toUpperCase();
    }
  }

  const profileSummaryLine = document.getElementById('profileSummaryLine');
  function renderSummaryLine(profile) {
    const parts = [profile.UserName];
    if (profile.Email) parts.push(profile.Email);
    if (profile.PhoneNumber) parts.push(profile.PhoneNumber);
    profileSummaryLine.innerHTML = parts.map(p => `<span>${p}</span>`).join('');
  }

  async function loadProfile() {
    try {
      const res = await fetch(PROFILE_API_URL, { headers: { ...authHeaders() } });
      const profile = await res.json();
      if (!res.ok) {
        detailsMsg.textContent = profile.error || 'Failed to load profile.';
        detailsMsg.classList.add('error');
        return;
      }

      document.getElementById('UserName').value = profile.UserName || '';
      document.getElementById('Email').value = profile.Email || '';
      document.getElementById('PhoneNumber').value = profile.PhoneNumber || '';
      document.getElementById('v_UserId').textContent = profile.UserId;
      document.getElementById('v_CreatedAt').textContent = profile.CreatedAt
        ? new Date(profile.CreatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '-';
      renderPhoto(profile.ProfilePhotoPath);
      renderSummaryLine(profile);
    } catch (err) {
      detailsMsg.textContent = 'Network error loading profile.';
      detailsMsg.classList.add('error');
    }
  }

  
  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    photoInput.value = '';
    if (!file) return;

    photoMsg.textContent = '';
    photoMsg.className = 'msg';

    if (!PHOTO_TYPES.includes(file.type)) {
      photoMsg.textContent = 'Only JPG or PNG images are allowed.';
      photoMsg.classList.add('error');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      photoMsg.textContent = 'Photo must be under 5MB.';
      photoMsg.classList.add('error');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await fetch(`${PROFILE_API_URL}/photo`, {
        method: 'POST',
        headers: { ...authHeaders() },
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        photoMsg.textContent = result.error || 'Failed to upload photo.';
        photoMsg.classList.add('error');
        return;
      }

      renderPhoto(result.ProfilePhotoPath);
      renderOperatorNavbar('profile');
      photoMsg.textContent = 'Photo updated.';
      photoMsg.classList.add('success');
    } catch (err) {
      photoMsg.textContent = 'Network error. Please try again.';
      photoMsg.classList.add('error');
    }
  });

  
  detailsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    detailsMsg.textContent = '';
    detailsMsg.className = 'msg';

    const payload = {
      UserName: document.getElementById('UserName').value.trim(),
      Email: document.getElementById('Email').value.trim(),
      PhoneNumber: document.getElementById('PhoneNumber').value.trim(),
    };

    try {
      const res = await fetch(PROFILE_API_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        detailsMsg.textContent = result.error || 'Failed to update profile.';
        detailsMsg.classList.add('error');
        return;
      }

      localStorage.setItem('username', payload.UserName);
      renderOperatorNavbar('profile');
      renderSummaryLine(result.profile || payload);
      detailsMsg.textContent = 'Profile updated.';
      detailsMsg.classList.add('success');
    } catch (err) {
      detailsMsg.textContent = 'Network error. Please try again.';
      detailsMsg.classList.add('error');
    }
  });

  
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordMsg.textContent = '';
    passwordMsg.className = 'msg';

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
      passwordMsg.textContent = 'New password and confirmation do not match.';
      passwordMsg.classList.add('error');
      return;
    }

    try {
      const res = await fetch(`${PROFILE_API_URL}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const result = await res.json();
      if (!res.ok) {
        passwordMsg.textContent = result.error || 'Failed to change password.';
        passwordMsg.classList.add('error');
        return;
      }

      passwordForm.reset();
      passwordMsg.textContent = 'Password changed successfully.';
      passwordMsg.classList.add('success');
    } catch (err) {
      passwordMsg.textContent = 'Network error. Please try again.';
      passwordMsg.classList.add('error');
    }
  });

  
  async function loadCentres() {
    try {
      const [allRes, mineRes] = await Promise.all([
        fetch(`${CENTRES_API_URL}/all`, { headers: { ...authHeaders() } }),
        fetch(`${CENTRES_API_URL}/mine`, { headers: { ...authHeaders() } }),
      ]);
      const all = await allRes.json();
      const mine = await mineRes.json();
      const mineIds = new Set((Array.isArray(mine) ? mine : []).map(c => c.HawkerId));

      centreChecklist.innerHTML = (Array.isArray(all) ? all : []).map(c => `
        <label class="checkbox-item">
          <input type="checkbox" value="${c.HawkerId}" ${mineIds.has(c.HawkerId) ? 'checked' : ''}>
          <span>${c.Name}</span>
        </label>
      `).join('');
    } catch (err) {
      centresMsg.textContent = 'Failed to load hawker centres.';
      centresMsg.classList.add('error');
    }
  }

  saveCentresBtn.addEventListener('click', async () => {
    centresMsg.textContent = '';
    centresMsg.className = 'msg';

    const hawkerIds = Array.from(centreChecklist.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => Number(cb.value));

    try {
      const res = await fetch(`${PROFILE_API_URL}/centres`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ hawkerIds }),
      });
      const result = await res.json();
      if (!res.ok) {
        centresMsg.textContent = result.error || 'Failed to update assignments.';
        centresMsg.classList.add('error');
        return;
      }

      centresMsg.textContent = 'Hawker centre assignments updated.';
      centresMsg.classList.add('success');
    } catch (err) {
      centresMsg.textContent = 'Network error. Please try again.';
      centresMsg.classList.add('error');
    }
  });

  
  document.getElementById('logoutBtn').addEventListener('click', () => {
    clearOperatorSession();
    window.location.href = '/auth/login.html';
  });

  document.getElementById('dangerLogoutBtn').addEventListener('click', () => {
    clearOperatorSession();
    window.location.href = '/auth/login.html';
  });

  const deleteModal = document.getElementById('deleteModal');
  document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    deleteModal.classList.add('show');
  });
  document.getElementById('modalCancelBtn').addEventListener('click', () => {
    deleteModal.classList.remove('show');
  });
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) deleteModal.classList.remove('show');
  });
  document.getElementById('modalConfirmBtn').addEventListener('click', async () => {
    try {
      const res = await fetch(PROFILE_API_URL, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      const result = await res.json();
      deleteModal.classList.remove('show');

      if (!res.ok) {
        alert(result.error || 'Failed to delete account.');
        return;
      }

      clearOperatorSession();
      window.location.href = '/auth/login.html';
    } catch (err) {
      deleteModal.classList.remove('show');
      alert('Network error. Please try again.');
    }
  });

  loadProfile();
  loadCentres();
})();
