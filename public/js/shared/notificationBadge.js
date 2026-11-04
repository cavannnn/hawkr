import { getUnreadNotificationCount } from "../../data/shared.js";

function updateBadge(count) {
  const bells = document.querySelectorAll("[data-notification-bell]");

  bells.forEach((bell) => {
    
    const existing = bell.querySelector(".notifBadge");
    if (existing) existing.remove();

    if (count > 0) {
      const badge = document.createElement("span");
      badge.className = "notifBadge";
      const display = count > 99 ? "99+" : count;
      badge.textContent = display;
      if (count >= 10) badge.classList.add("multi-digit");
      bell.appendChild(badge);
    }
  });
}


const NOTIFICATION_COUNT_ENDPOINT_EXISTS = true;

export async function initNotificationBadge() {
  cleanupNotificationBadge();

  
  if (!NOTIFICATION_COUNT_ENDPOINT_EXISTS) return;

  try {
    updateBadge(await getUnreadNotificationCount());
  } catch (error) {
    console.error("Notification badge error:", error);
    updateBadge(0);
  }
}


export function cleanupNotificationBadge() {
  updateBadge(0);
}
