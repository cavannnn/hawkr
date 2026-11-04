function go(el) {
  const href = el.getAttribute("data-href");
  if (href) window.location.href = href;
}

export function initTopBar(root) {
  (root || document).querySelectorAll(".topBarAction[data-href]").forEach((el) => {
    if (el.__topbar) return; // idempotent — never double-wire
    el.__topbar = true;
    el.addEventListener("click", () => go(el));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initTopBar(document));
} else {
  initTopBar(document);
}
