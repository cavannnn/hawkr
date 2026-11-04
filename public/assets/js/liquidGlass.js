/* liquidGlass.js — the interactive liquid-glass primitive. */

const REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;

// soft rubber-band clamp: eases toward ±cap, never exceeds it
function band(v, cap) {
  return cap * Math.tanh(v / cap);
}

export function makeLiquidGlass(el, opts = {}) {
  if (!el || el.__lg) return el; // idempotent — never double-wire
  el.__lg = true;

  const drag = !!opts.drag;
  const surface = opts.surface || el;

  el.classList.add("lg");

  const glow = document.createElement("span");
  glow.className = "lg__glow";
  surface.insertBefore(glow, surface.firstChild); // behind the content

  let down = false,
    sx = 0,
    sy = 0,
    moved = 0,
    suppressClick = false,
    capturedId = null;

  function moveGlow(e) {
    const r = surface.getBoundingClientRect();
    surface.style.setProperty("--lg-x", (e.clientX - r.left).toFixed(1) + "px");
    surface.style.setProperty("--lg-y", (e.clientY - r.top).toFixed(1) + "px");
  }

  function stretch(dx, dy) {
    if (REDUCE) return;
    const tx = band(dx * 0.15, 14).toFixed(2);
    const ty = band(dy * 0.15, 14).toFixed(2);
    const ex = band(Math.abs(dx), 200) / 200;
    const ey = band(Math.abs(dy), 200) / 200;
    const sc =
      "scale(" +
      (1.05 + ex * 0.075 - ey * 0.028).toFixed(3) +
      "," +
      (1.05 + ey * 0.075 - ex * 0.028).toFixed(3) +
      ")";
    if (surface === el) {
      // surface IS the element → combine, or scale would clobber translate
      el.style.transform = "translate(" + tx + "px," + ty + "px) " + sc;
    } else {
      el.style.transform = "translate(" + tx + "px," + ty + "px)"; // whole control drifts
      surface.style.transform = sc; // icons stay put — only the glass deforms
    }
  }

  function settle(target) {
    const from = target.style.transform;
    target.style.transform = "";
    if (REDUCE || !from) return;
    target.animate([{ transform: from }, { transform: "none" }], {
      duration: 500,
      easing: "cubic-bezier(0.33, 1, 0.68, 1)", // matches --lg-smooth
    });
  }

  el.addEventListener("pointerdown", (e) => {
    // reset suppressClick each press so a previous drag can never swallow this tap
    down = true;
    moved = 0;
    suppressClick = false;
    sx = e.clientX;
    sy = e.clientY;
    moveGlow(e);
    el.classList.add("is-pressing");
    if (drag) {
      el.classList.add("is-dragging");
      stretch(0, 0);
    }
  });

  el.addEventListener("pointermove", (e) => {
    if (!down) return;
    moveGlow(e);
    if (!drag) return;
    moved = Math.max(moved, Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy));
    stretch(e.clientX - sx, e.clientY - sy);

    if (capturedId == null && moved > 6) {
      try {
        el.setPointerCapture(e.pointerId);
        capturedId = e.pointerId;
      } catch (_) {}
    }
  });

  function release() {
    if (!down) return;
    down = false;
    if (drag && moved > 6) suppressClick = true; // a real drag must NOT fire the action
    el.classList.remove("is-pressing", "is-dragging");
    if (drag) {
      settle(el);
      if (surface !== el) settle(surface); // spring home + un-stretch
      if (capturedId != null) {
        try {
          el.releasePointerCapture(capturedId);
        } catch (_) {}
        capturedId = null;
      }
    }
  }

  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", () => {
    if (!drag) release();
  });

  el.addEventListener("lostpointercapture", (e) => {
    capturedId = null;
    if (!down || !drag) return;
    try {
      el.setPointerCapture(e.pointerId);
      capturedId = e.pointerId;
    } catch (_) {}
  });

  // swallow the click that follows a drag
  el.addEventListener(
    "click",
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick = false;
      }
    },
    true,
  );

  return el;
}

export function initLiquidGlass(root) {
  (root || document).querySelectorAll("[data-liquid-glass]").forEach((el) => {
    makeLiquidGlass(el, { drag: el.getAttribute("data-liquid-glass") === "drag" });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initLiquidGlass(document));
} else {
  initLiquidGlass(document);
}
