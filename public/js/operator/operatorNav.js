


function renderOperatorNavbar(activePage) {
  const username = localStorage.getItem('username');

  document.querySelectorAll('.sidebarNav .navItem').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === activePage);
  });

  const nameEl = document.querySelector('.sidebarProfile__name');
  if (nameEl && username) nameEl.textContent = username;

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      window.location.href = '/auth/login.html';
    });
  }
}

function renderBottomPillNav(activeTab) {
  document.querySelectorAll('[data-bottom-nav] .bottomPillNav__item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.tab === activeTab);
  });
}
