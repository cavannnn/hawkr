import { signOut } from "../../data/session.js";

function initSettingsDropdown() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    
    
    logoutBtn.addEventListener("click", () => signOut("/auth/login.html"));
  }
}

document.addEventListener("DOMContentLoaded", initSettingsDropdown);
