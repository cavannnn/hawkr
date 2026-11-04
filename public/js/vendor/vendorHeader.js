(function () {
  const userId = localStorage.getItem("userId");
  const token = localStorage.getItem("authToken");
  if (!userId || !token) return;

  function authHeaders() {
    return { "Authorization": "Bearer " + token };
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text == null ? "" : text;
    return div.innerHTML;
  }

  

  const searchInput = document.getElementById("globalSearchInput");
  const searchResults = document.getElementById("globalSearchResults");
  let searchDebounce = null;

  function closeSearchResults() {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
  }

  function renderSearchResults(results) {
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-empty">No matches.</div>';
      searchResults.hidden = false;
      return;
    }

    searchResults.innerHTML = results.map(r => `
      <button type="button" class="search-result-item" data-url="${escapeHtml(r.url)}">
        <div class="search-result-type">${escapeHtml(r.type)}</div>
        <div class="search-result-label">${escapeHtml(r.label)}</div>
        <div class="search-result-sublabel">${escapeHtml(r.sublabel || "")}</div>
      </button>
    `).join("");
    searchResults.hidden = false;

    searchResults.querySelectorAll(".search-result-item").forEach(btn => {
      btn.addEventListener("click", () => {
        window.location.href = btn.dataset.url;
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim();
      clearTimeout(searchDebounce);

      if (q.length < 2) {
        closeSearchResults();
        return;
      }

      searchDebounce = setTimeout(async () => {
        try {
          const res = await fetch(`/vendor/${userId}/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
          if (!res.ok) return;
          const data = await res.json();
          renderSearchResults(data.results || []);
        } catch (err) {
          console.error("Error searching:", err);
        }
      }, 250);
    });

    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim().length >= 2 && searchResults.innerHTML) searchResults.hidden = false;
    });
  }

  

  const bellBtn = document.getElementById("bellBtn");
  const bellBadge = document.getElementById("bellBadge");
  const notificationPanel = document.getElementById("notificationPanel");
  const notificationList = document.getElementById("notificationList");
  const markAllReadBtn = document.getElementById("markAllReadBtn");

  
  
  
  
  let positionPanel = () => {};
  if (notificationPanel && bellBtn) {
    document.body.appendChild(notificationPanel);
    notificationPanel.classList.add("notification-panel--detached");

    positionPanel = () => {
      const rect = bellBtn.getBoundingClientRect();
      notificationPanel.style.top = (rect.bottom + 10) + "px";
      notificationPanel.style.right = (window.innerWidth - rect.right) + "px";
    };

    window.addEventListener("resize", () => {
      if (!notificationPanel.hidden) positionPanel();
    });
  }

  function timeAgo(value) {
    const diffMs = Date.now() - new Date(value).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.floor(hours / 24);
    return days + "d ago";
  }

  function updateBadge(count) {
    if (count > 0) {
      bellBadge.textContent = count > 99 ? "99+" : count;
      bellBadge.hidden = false;
      bellBtn.classList.add("has-unread");
    } else {
      bellBadge.hidden = true;
      bellBtn.classList.remove("has-unread");
    }
  }

  function renderNotifications(notifications) {
    if (notifications.length === 0) {
      notificationList.innerHTML = '<div class="search-empty">No notifications yet.</div>';
      return;
    }

    notificationList.innerHTML = notifications.map(n => `
      <div class="notification-item ${n.isRead ? "" : "unread"}" data-id="${n.notificationId}" data-url="${escapeHtml(n.linkUrl || "")}" role="button" tabindex="0">
        <button type="button" class="notification-dismiss" data-dismiss-id="${n.notificationId}" title="Remove">&times;</button>
        <div class="notification-title">${escapeHtml(n.title)}</div>
        ${n.message ? '<div class="notification-message">' + escapeHtml(n.message) + '</div>' : ""}
        <div class="notification-time">${timeAgo(n.createdAt)}</div>
      </div>
    `).join("");

    notificationList.querySelectorAll(".notification-item").forEach(item => {
      const activate = async () => {
        const id = item.dataset.id;
        try {
          await fetch(`/vendor/${userId}/notifications/${id}/read`, { method: "PUT", headers: authHeaders() });
        } catch (err) {
          console.error("Error marking notification read:", err);
        }
        if (item.dataset.url) window.location.href = item.dataset.url;
      };
      item.addEventListener("click", activate);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
    });

    notificationList.querySelectorAll(".notification-dismiss").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.dataset.dismissId;
        try {
          await fetch(`/vendor/${userId}/notifications/${id}`, { method: "DELETE", headers: authHeaders() });
          await loadNotifications();
        } catch (err) {
          console.error("Error dismissing notification:", err);
        }
      });
    });
  }

  async function loadNotifications() {
    try {
      const res = await fetch(`/vendor/${userId}/notifications`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      updateBadge(data.unreadCount || 0);
      renderNotifications(data.notifications || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  }

  if (bellBtn) {
    bellBtn.addEventListener("click", () => {
      const opening = notificationPanel.hidden;
      if (opening) positionPanel();
      notificationPanel.hidden = !opening;
      closeSearchResults();
      if (opening) loadNotifications();
    });
  }

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", async () => {
      try {
        await fetch(`/vendor/${userId}/notifications/read-all`, { method: "PUT", headers: authHeaders() });
        await loadNotifications();
      } catch (err) {
        console.error("Error marking all notifications read:", err);
      }
    });
  }

  
  
  document.addEventListener("click", (e) => {
    if (searchInput && !e.target.closest("#globalSearch")) closeSearchResults();
    if (bellBtn && !e.target.closest("#notificationBell") && !e.target.closest("#notificationPanel")) {
      notificationPanel.hidden = true;
    }
  });

  
  loadNotifications();
  setInterval(loadNotifications, 30000);
})();
