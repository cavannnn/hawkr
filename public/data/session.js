/* session.js — who's signed in. */

const TOKEN_KEY = "authToken";
const USER_KEY = "userId";
const ROLE_KEY = "userRole";
const NAME_KEY = "username";
const GUEST_PROFILE_KEY = "hawkr.guest";

export function getSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userId = localStorage.getItem(USER_KEY);
  if (!token || !userId) return null;
  return { uid: userId, userId: Number(userId), token };
}

/**
 * Drop-in for onAuthStateChanged(auth, cb).
 * Calls onUser(user) when signed in; redirects to login when not.
 */
export function requireSession(onUser, loginPath = "/auth/login.html") {
  const user = getSession();
  if (!user) {
    window.location.href = loginPath;
    return;
  }
  onUser(user);
}

export function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: "Bearer " + token } : {}),
  };
}

// POST `/user/login`
export async function login(username, password) {
  const res = await fetch("/user/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = new Error(res.status === 404 || res.status === 401
      ? "Incorrect username or password."
      : "Could not sign in. Please try again.");
    err.status = res.status;
    throw err;
  }

  const { token, role, userId, username: name } = await res.json();
  if (!token || userId === undefined) {
    throw new Error("Sign-in succeeded but the server did not return a usable session.");
  }

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, String(userId));
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(NAME_KEY, name || username);
  if (String(role).toLowerCase() === "customer") markGuestProfileSignedIn(name || username);
  return { uid: String(userId), userId, role, token, username: name };
}

export function getRole() {
  return localStorage.getItem(ROLE_KEY);
}

const LANDING_BY_ROLE = {
  vendor: "/html/vendor/dashboard.html",
  customer: "/consumer/index.html",
  operator: "/html/operator/operatorHome.html",
  nea: "/authority/index.html",
  guest: "/consumer/index.html",
};

export function landingFor(role) {
  return LANDING_BY_ROLE[role] || LANDING_BY_ROLE.customer;
}

// POST `/user/guest`
export async function guestLogin() {
  const res = await fetch("/user/guest", { method: "POST" });
  if (!res.ok) throw new Error("Could not continue as a guest. Please try again.");

  const { token, role } = await res.json();
  if (!token) throw new Error("The server did not return a usable guest session.");

  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, "guest");
  localStorage.setItem(ROLE_KEY, role || "guest");
  localStorage.setItem(NAME_KEY, "Guest");
  return { uid: "guest", userId: "guest", role: role || "guest", token };
}

function newProfileId() {
  try {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  } catch (_) {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function prettyName(username) {
  const base = String(username || "").split("@")[0].replace(/[._-]+/g, " ").trim();
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : "Member";
}

function markGuestProfileSignedIn(username) {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(GUEST_PROFILE_KEY) || "null");
  } catch (_) {
    stored = null;
  }
  localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify({
    id: (stored && stored.id) || newProfileId(),
    name: prettyName(username),
    signedUp: true,
    orders: (stored && stored.orders) || 0,
    since: String(new Date().getFullYear()),
  }));
}

function resetGuestProfile() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(GUEST_PROFILE_KEY) || "null");
  } catch (_) {
    stored = null;
  }
  if (!stored || !stored.id) return;
  localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify({
    id: stored.id,
    name: null,
    signedUp: false,
    orders: stored.orders || 0,
    since: null,
  }));
}

export function signOut(loginPath = "/auth/login.html") {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(NAME_KEY);
  resetGuestProfile();
  window.location.href = loginPath;
}
