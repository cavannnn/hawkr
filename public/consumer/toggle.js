/* consumer/toggle.js — a SHIM, not an implementation. */
import {
  initLiquidGlassToggle,
  initAllLiquidGlassToggles,
  setToggleState,
} from "../assets/js/liquidGlassToggle.js";

window.hawkrToggle = {
  init: initLiquidGlassToggle,
  initAll: initAllLiquidGlassToggles,
  setState: setToggleState,
};
