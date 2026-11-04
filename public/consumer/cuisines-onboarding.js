/* cuisines-onboarding.js — onboarding cuisine picker (#view-cuisines). */
(function () {
  "use strict";

  /* ---- Tuning knobs ---- */
  const MIN_PICK = 3, MAX_PICK = 5;
  const R_REST = 55, R_SELECTED = 75; // radii: 110px / 150px plates
  const SPRING = 0.012;   // anchor pull (lower = looser, floatier)
  const REPULSE = 2.0;    // field strength — a selection displaces its nearest neighbour ~22px
  const RANGE_MULT = 1.7; // field reach = (rA + rB) × this
  const DAMP = 0.92;      // velocity kept per frame (higher = glides longer)
  const VEL_DECAY = 0.6;  // scroll-velocity decay between scroll events
  const LAG_GAIN = 0.9;   // px of lean per px/frame of scroll speed
  const LAG_MAX = 18;     // lean cap — a fling never throws further than this
  const LAG_EASE = 0.12;  // how quickly the lean catches up / settles back
  const PAD_X = 90;       // first anchor's inset from the canvas edge
  const STEP_X = 118;     // anchor rhythm — rims ~8px apart at rest, so the fields
                          // genuinely overlap and a selection visibly displaces neighbours
  const LABEL_H = 34;     // label zone under each disc (12px gap + ~22px text)

  document.addEventListener("DOMContentLoaded", () => {
    const view = document.getElementById("view-cuisines");
    if (!view) return;
    const scroller = view.querySelector(".palate-scroll");
    const canvas = view.querySelector(".palate-track");
    const next = view.querySelector(".cuisines-next");
    const plates = [...view.querySelectorAll(".palate-plate")];
    const selected = new Set();

    const bodies = plates.map((el) => ({ el, ax: 0, ay: 0, x: 0, y: 0, vx: 0, vy: 0, r: R_REST }));
    let H = 0;   // field height; 0 = not laid out yet (a hidden scroller measures 0)
    let lag = 0; // scroll-parallax lean, applied at render time

    const place = (b) => {
      b.el.style.transform = `translate(${b.x + lag * (R_REST / b.r)}px,${b.y}px) translate(-50%,-50%)`;
    };

    /* ---- Layout: home anchors on a sine-wave scatter along the canvas ---- */
    function layout() {
      H = scroller.clientHeight;
      if (!H) return false;
      const midY = H / 2 - LABEL_H / 2;
      bodies.forEach((b, i) => {
        const wave = Math.sin(i * 1.7) * (H * 0.22);        // tall-ish sine scatter
        const drift = (i % 2 ? 1 : -1) * 7 * ((i % 3) + 1); // break the wave's regularity
        b.ax = PAD_X + i * STEP_X;
        b.ay = midY + wave + drift;
        b.x = b.ax; b.y = b.ay; b.vx = 0; b.vy = 0;
        place(b);
      });
      canvas.style.width = bodies[bodies.length - 1].ax + PAD_X + 40 + "px"; // +40: room for a grown end plate
      return true;
    }

    /* ---- Selection: the sim reacts via the radius ---- */
    canvas.addEventListener("click", (e) => {
      const plate = e.target.closest(".palate-plate");
      if (!plate) return;
      const name = plate.dataset.cuisine;
      const on = !selected.has(name);
      if (on && selected.size >= MAX_PICK) return; // full — "up to five"
      selected[on ? "add" : "delete"](name);
      plate.classList.toggle("is-selected", on);
      plate.setAttribute("aria-pressed", String(on));
      bodies[plates.indexOf(plate)].r = on ? R_SELECTED : R_REST; // bigger footprint = the shove
      next.disabled = selected.size < MIN_PICK;
    });

    /* ---- Scroll → the parallax lean's input ---- */
    let lastScroll = 0, scrollVel = 0;
    scroller.addEventListener("scroll", () => {
      scrollVel = scroller.scrollLeft - lastScroll;
      lastScroll = scroller.scrollLeft;
    }, { passive: true });

    /* ---- The sim ---- */
    let running = false;
    function tick() {
      if (document.body.dataset.view !== "cuisines" || (!H && !layout())) {
        running = false; // pause — the data-view observer resumes us
        return;
      }
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        a.vx += (a.ax - a.x) * SPRING; // anchor spring — still at rest, yields when pushed
        a.vy += (a.ay - a.y) * SPRING;
        for (let j = i + 1; j < bodies.length; j++) { // soft-field repulsion, quadratic falloff
          const b = bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const range = (a.r + b.r) * RANGE_MULT;
          if (dist >= range) continue;
          const f = 1 - dist / range;
          const push = f * f * REPULSE;
          const ux = dx / dist, uy = dy / dist;
          a.vx -= ux * push; a.vy -= uy * push;
          b.vx += ux * push; b.vy += uy * push;
        }
      }
      lag += (Math.max(-LAG_MAX, Math.min(LAG_MAX, scrollVel * LAG_GAIN)) - lag) * LAG_EASE;
      scrollVel *= VEL_DECAY;
      for (const a of bodies) {
        a.vx *= DAMP; a.vy *= DAMP;
        a.x += a.vx; a.y += a.vy;
        a.y = Math.max(a.r, Math.min(H - a.r - LABEL_H, a.y)); // keep discs inside the field
        place(a);
      }
      requestAnimationFrame(tick);
    }
    function start() {
      if (running) return;
      running = true;
      requestAnimationFrame(tick);
    }

    new MutationObserver(() => {
      if (document.body.dataset.view !== "cuisines") return;
      if (!H) layout();
      start();
    }).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
    window.addEventListener("resize", () => {
      if (document.body.dataset.view === "cuisines") layout();
      else H = 0; // stale after resizing while away — re-measure on next activation
    });
    if (document.body.dataset.view === "cuisines") { layout(); start(); } // direct #cuisines load

    view.querySelector("[data-cuisines-back]").addEventListener("click", () => history.back());

    /* ---- Storing the answer ---- */
    function storeAnswer() {
      if (!window.hawkrPrefs || !hawkrPrefs.isMember()) return;
      hawkrPrefs.saveCuisines([...selected]).catch((err) => {
        // The screen has already moved on; left findable rather than swallowed.
        console.warn("Onboarding: palette not saved to the account —", err && err.message);
      });
    }

    // Onboarding order: cuisines → allergies → home.
    next.addEventListener("click", () => {
      if (next.disabled) return;
      storeAnswer();
      navigate("allergies");
    });
    view.querySelector(".cuisines-skip").addEventListener("click", () => navigate("allergies"));
  });
})();
