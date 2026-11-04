const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");

let currentProfile = null;

function showBanner(id, message) {
  const banner = document.getElementById(id);
  banner.textContent = message;
  banner.classList.add("show");
  if (id === "successBanner") {
    setTimeout(() => banner.classList.remove("show"), 4000);
  }
}

function hideBanners() {
  document.getElementById("errorBanner").classList.remove("show");
  document.getElementById("successBanner").classList.remove("show");
}

function initials(text) {
  if (!text) return "V";
  return text.trim().charAt(0).toUpperCase();
}

function setDetail(id, value) {
  const el = document.getElementById(id);
  if (value) {
    el.textContent = value;
    el.classList.remove("is-unset");
  } else {
    el.textContent = "Not set — click Edit Profile to add";
    el.classList.add("is-unset");
  }
}


function setAvatar(imgId, textId, pictureUrl, name) {
  const img = document.getElementById(imgId);
  const text = document.getElementById(textId);
  if (pictureUrl) {
    img.src = pictureUrl;
    img.hidden = false;
    text.hidden = true;
  } else {
    img.hidden = true;
    text.hidden = false;
    text.textContent = initials(name);
  }
}

async function loadProfile() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }

  try {
    const res = await fetch(`/vendor/${userId}/profile`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load profile.");

    const data = await res.json();
    currentProfile = data;

    document.getElementById("username").textContent = data.UserName || "N/A";
    document.getElementById("role").textContent = data.Role || "N/A";
    setDetail("email", data.Email);
    setDetail("contactNumber", data.ContactNumber);
    setDetail("gender", data.Gender);
    document.getElementById("createdAt").textContent =
      data.CreatedAt ? new Date(data.CreatedAt).toLocaleString() : "N/A";

    setAvatar("profileAvatarImg", "profileAvatar", data.ProfilePicture, data.UserName);
  } catch (err) {
    console.error("Error loading profile:", err);
    document.getElementById("username").textContent = "Error loading profile";
    showBanner("errorBanner", err.message || "Something went wrong loading your profile.");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

async function loadStall() {
  const section = document.getElementById("stallSection");
  try {
    const res = await fetch(`/vendor/${userId}/my-stalls`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load stall.");

    const data = await res.json();
    const stalls = data.stalls || [];

    if (stalls.length === 0) {
      section.innerHTML = `
        <div class="stall-empty">
          You don't have a stall yet. <a href="stall.html">Request one from the My Stall page</a>.
        </div>
      `;
      return;
    }

    section.innerHTML = `<div class="stall-list">${stalls.map(stall => `
      <div class="stall-card">
        <img class="stall-image" src="${escapeHtml(stall.imageUrl)}" alt="${escapeHtml(stall.stallName)}"
             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2284%22 height=%2284%22%3E%3Crect width=%2284%22 height=%2284%22 fill=%22%23eef2f7%22/%3E%3C/svg%3E'">
        <div class="stall-info">
          <div class="stall-name">${escapeHtml(stall.stallName)}</div>
          <div class="stall-meta">
            <span>📍 ${escapeHtml(stall.centreName)}, Unit ${escapeHtml(stall.unitNumber)}</span>
            ${stall.operatingHours ? `<span>🕒 ${escapeHtml(stall.operatingHours)}</span>` : ""}
            ${stall.neaGrade ? `<span>⭐ Grade ${escapeHtml(stall.neaGrade)}</span>` : ""}
            ${stall.pendingGrade ? `<span class="stall-pending">Declared Grade ${escapeHtml(stall.pendingGrade)} — confirmed at the next inspection</span>` : ""}
          </div>
        </div>
      </div>
    `).join("")}</div>`;
  } catch (err) {
    console.error("Error loading stall:", err);
    section.innerHTML = `<div class="stall-empty">Couldn't load your stall right now.</div>`;
  }
}

const editModal = document.getElementById("editModal");
const avatarPreviewWrap = document.getElementById("avatarPreviewWrap");
const avatarPreview = document.getElementById("avatarPreview");


function updateAvatarPreview() {
  const file = document.getElementById("editProfilePicture").files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = () => {
      avatarPreview.src = reader.result;
      avatarPreviewWrap.hidden = false;
    };
    reader.readAsDataURL(file);
  } else if (currentProfile && currentProfile.ProfilePicture) {
    avatarPreview.src = currentProfile.ProfilePicture;
    avatarPreviewWrap.hidden = false;
  } else {
    avatarPreviewWrap.hidden = true;
  }
}

document.getElementById("editProfilePicture").addEventListener("change", updateAvatarPreview);

function openEditModal() {
  hideBanners();
  document.getElementById("editEmail").value = currentProfile ? currentProfile.Email || "" : "";
  document.getElementById("editContactNumber").value = currentProfile ? currentProfile.ContactNumber || "" : "";
  document.getElementById("editGender").value = currentProfile ? currentProfile.Gender || "" : "";
  document.getElementById("editProfilePicture").value = "";
  document.getElementById("editPassword").value = "";
  updateAvatarPreview();
  editModal.classList.add("show");
}

function closeEditModal() {
  editModal.classList.remove("show");
}

document.getElementById("editProfileBtn").addEventListener("click", openEditModal);
document.getElementById("cancelEditBtn").addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const email = document.getElementById("editEmail").value.trim();
  const contactNumber = document.getElementById("editContactNumber").value.trim();
  const gender = document.getElementById("editGender").value;
  const pictureFile = document.getElementById("editProfilePicture").files[0];
  const password = document.getElementById("editPassword").value;
  const saveBtn = document.getElementById("saveEditBtn");

  if (password && password.length < 8) {
    showBanner("errorBanner", "Password must be at least 8 characters.");
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const body = { email, contactNumber, gender };
    if (password) body.password = password;

    const res = await fetch(`/vendor/${userId}/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to update profile.");

    if (pictureFile) {
      const formData = new FormData();
      formData.append("profilePicture", pictureFile);

      const pictureRes = await fetch(`/vendor/${userId}/profile/picture`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      if (pictureRes.status === 401 || pictureRes.status === 403) {
        throw new Error("Your session is invalid or expired. Please log in again.");
      }
      if (!pictureRes.ok) {
        const pictureData = await pictureRes.json().catch(() => ({}));
        throw new Error(pictureData.message || "Failed to upload profile picture.");
      }
    }

    closeEditModal();
    showBanner("successBanner", "Profile updated successfully.");
    await loadProfile();
  } catch (err) {
    console.error("Error updating profile:", err);
    showBanner("errorBanner", err.message || "Something went wrong updating your profile.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadProfile();
loadStall();
