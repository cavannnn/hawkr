

export function isMacPlatform() {
  const uad = navigator.userAgentData;
  if (uad && typeof uad.platform === "string") return uad.platform === "macOS";
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
}


export function modifierLabel() {
  return isMacPlatform() ? "⌘" : "CTRL";
}


export function hasModifier(e) {
  return e.ctrlKey || e.metaKey;
}
