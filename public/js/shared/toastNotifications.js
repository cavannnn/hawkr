import { getNotifications } from "../../data/shared.js";

let toastContainerInjected = false;
let toastUnsubscribe = null;
let knownNotificationIds = new Set();
let isFirstSnapshot = true;

function injectToastStyles() {
  if (document.getElementById("hawkrToastStyles")) return;

  const style = document.createElement("style");
  style.id = "hawkrToastStyles";
  style.textContent = `
    #hawkrToastContainer {
      position: fixed;
      top: 100px;
      right: 24px;
      z-index: 100;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: 380px;
      width: calc(100% - 48px);
    }
    .hawkrToast {
      pointer-events: auto;
      background: rgba(200, 150, 210, 0.15);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px;
      box-shadow:
        0 8px 32px rgba(52, 21, 57, 0.1),
        inset 0 1px 1px rgba(255, 255, 255, 0.6),
        inset 0 -1px 1px rgba(0, 0, 0, 0.05);
      padding: 24px;
      cursor: pointer;
      opacity: 0;
      transform: translateX(100%);
      animation: hawkrToastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .hawkrToast.dismissing {
      animation: hawkrToastSlideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .hawkrToastTitle {
      font-family: "Source Serif", Georgia, serif;
      font-size: 20px;
      font-weight: 600;
      color: #341539;
      margin-bottom: 4px;
    }
    .hawkrToastMessage {
      font-family: Aptos, system-ui, sans-serif;
      font-size: 16px;
      color: #341539;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .hawkrToastTime {
      font-family: Aptos, system-ui, sans-serif;
      font-size: 14px;
      color: #808080;
      margin-top: 6px;
    }
    @keyframes hawkrToastSlideIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes hawkrToastSlideOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100%); }
    }
    @media (max-width: 768px) {
      #hawkrToastContainer {
        top: 80px;
        right: 12px;
        max-width: calc(100% - 24px);
        width: calc(100% - 24px);
      }
    }
  `;
  document.head.appendChild(style);
}

export function initToastContainer() {
  if (toastContainerInjected) return;

  injectToastStyles();

  const container = document.createElement("div");
  container.id = "hawkrToastContainer";
  document.body.appendChild(container);

  toastContainerInjected = true;
}

export function showNotificationToast({ title, message, link = null, duration = 5000 }) {
  const container = document.getElementById("hawkrToastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "hawkrToast";
  if (link) toast.dataset.link = link;

  toast.innerHTML = `
    <div class="hawkrToastTitle">${escapeHtml(title)}</div>
    <div class="hawkrToastMessage">${escapeHtml(message)}</div>
    <div class="hawkrToastTime">Just now</div>
  `;

  
  toast.addEventListener("click", () => {
    if (link) {
      window.location.href = link;
    } else {
      dismissToast(toast);
    }
  });

  container.appendChild(toast);

  
  const timeout = setTimeout(() => dismissToast(toast), duration);
  toast._dismissTimeout = timeout;
}

function dismissToast(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;

  if (toast._dismissTimeout) clearTimeout(toast._dismissTimeout);

  toast.classList.add("dismissing");
  toast.addEventListener("animationend", () => {
    toast.remove();
  });

  
  setTimeout(() => toast.remove(), 400);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

const POLL_MS = 30000;

export function subscribeToNewNotifications() {
  cleanupToastNotifications();

  knownNotificationIds = new Set();
  isFirstSnapshot = true;

  async function poll() {
    try {
      const notifications = await getNotifications();

      if (isFirstSnapshot) {
        notifications.forEach((n) => knownNotificationIds.add(n.id));
        isFirstSnapshot = false;
        return;
      }

      notifications.forEach((n) => {
        if (!knownNotificationIds.has(n.id)) {
          knownNotificationIds.add(n.id);
          showNotificationToast({
            title: n.title || "Notification",
            message: n.message || "",
            link: getNotificationLink(n),
          });
        }
      });
    } catch (error) {
      console.error("Notification poll failed:", error);
    }
  }

  poll();
  toastUnsubscribe = setInterval(poll, POLL_MS);
}


function getNotificationLink(notification) {
  if (notification.linkUrl) return notification.linkUrl;

  const type = notification.type;

  if (type === "order_status" || type === "refund_processed") {
    return null;
  }

  if (type === "new_order" && notification.orderId) {
    return "/vendor/Order/vendorOrder.html";
  }
  if (type === "operator_linked" || type === "operator_unlinked") {
    return "/vendor/Tenancy/vendorTenancy.html";
  }

  return null;
}

export function cleanupToastNotifications() {
  if (toastUnsubscribe) {
    clearInterval(toastUnsubscribe);
    toastUnsubscribe = null;
  }
  knownNotificationIds.clear();
  isFirstSnapshot = true;
}
