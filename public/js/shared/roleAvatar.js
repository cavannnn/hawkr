

import { getSession } from "../../data/session.js";
import { getMyProfile } from "../../data/centresData.js";

const CACHE_PREFIX = "roleAvatar:";
const SAFE_PATH = /^\/uploads\/[A-Za-z0-9._\-/]+$/;

function isUsablePath(path) {
  return typeof path === "string" && SAFE_PATH.test(path) && !path.includes("..");
}


function applyPhoto(path) {
  const root = document.documentElement;
  if (isUsablePath(path)) {
    root.style.setProperty("--role-photo", `url("${path}")`);
    root.setAttribute("data-role-photo", "");
  } else {
    root.style.removeProperty("--role-photo");
    root.removeAttribute("data-role-photo");
  }
}

function readCache(userId) {
  try {
    return sessionStorage.getItem(CACHE_PREFIX + userId);
  } catch {
    return null;
  }
}

function writeCache(userId, path) {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_PREFIX + userId) {
        sessionStorage.removeItem(key);
      }
    }
    if (path) sessionStorage.setItem(CACHE_PREFIX + userId, path);
    else sessionStorage.removeItem(CACHE_PREFIX + userId);
  } catch {
    
  }
}









export function setRoleAvatarPhoto(path) {
  const session = getSession();
  if (session) writeCache(session.userId, isUsablePath(path) ? path : null);
  applyPhoto(path);
}








export async function initRoleAvatar() {
  const session = getSession();
  if (!session) return;

  

  const cached = readCache(session.userId);
  if (cached) applyPhoto(cached);

  try {
    const profile = await getMyProfile();
    const path = profile && profile.ProfilePhotoPath ? profile.ProfilePhotoPath : null;
    


    writeCache(session.userId, isUsablePath(path) ? path : null);
    applyPhoto(path);
  } catch (error) {
    

    console.error("Could not read your profile photo:", error);
  }
}

initRoleAvatar();
