const icons = {
  error: `<svg class="toastIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eb001b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  success: `<svg class="toastIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34C759" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  info: `<svg class="toastIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#913b9f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

function getOrCreateContainer() {
  let container = document.querySelector(".toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.className = "toastContainer";
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = "info") {
  const container = getOrCreateContainer();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span class="toastMessage">${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toastExiting");
    toast.addEventListener("animationend", () => toast.remove());
  }, 4000);
}

/**
 * Liquid glass confirm dialog — returns a Promise<boolean>
 * Usage: const ok = await showConfirm("Are you sure?", "This cannot be undone.");
 */
export function showConfirm(title, message, options = {}) {
  const confirmLabel = options.confirmLabel || "Confirm";
  const destructive = options.destructive || false;

  return new Promise((resolve) => {
    // Overlay
    const overlay = document.createElement("div");
    overlay.className = "confirmOverlay";

    // Dialog
    const dialog = document.createElement("div");
    dialog.className = "confirmDialog";
    dialog.innerHTML = `
      <p class="confirmTitle">${title}</p>
      ${message ? `<p class="confirmMessage">${message}</p>` : ""}
      <div class="confirmActions">
        <button class="confirmBtn confirmBtnCancel">Cancel</button>
        <button class="confirmBtn confirmBtnConfirm${destructive ? " destructive" : ""}">${confirmLabel}</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Trigger animation on next frame
    requestAnimationFrame(() => overlay.classList.add("active"));

    function close(result) {
      overlay.classList.remove("active");
      overlay.addEventListener("transitionend", () => overlay.remove());
      resolve(result);
    }

    dialog
      .querySelector(".confirmBtnCancel")
      .addEventListener("click", () => close(false));
    dialog
      .querySelector(".confirmBtnConfirm")
      .addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });

    // ESC to cancel
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        document.removeEventListener("keydown", onKey);
        close(false);
      }
    }
    document.addEventListener("keydown", onKey);
  });
}
