/* consumer/session.js — a SHIM, not an implementation. */
import { login, getSession, authHeaders, getRole, signOut } from "../data/session.js";
import { createAccount } from "../data/accountData.js";

window.hawkrSession = {
  login: login,
  createAccount: createAccount,
  getSession: getSession,
  authHeaders: authHeaders,
  getRole: getRole,
  signOut: function (path) { return signOut(path || "/auth/login.html"); },
};
