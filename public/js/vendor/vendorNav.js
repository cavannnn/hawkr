
function renderBottomPillNav(activeTab) {
  document.querySelectorAll('[data-bottom-nav] .bottomPillNav__item').forEach((item) => {
    item.classList.toggle('is-active', item.dataset.tab === activeTab);
  });
}
