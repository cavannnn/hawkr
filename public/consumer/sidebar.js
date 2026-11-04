/* sidebar.js — the push drawer's open/close. */
(function () {
  "use strict";

  var body = document.body;
  var sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  function setOpen(open) {
    body.classList.toggle("drawer-open", open);
    sidebar.setAttribute("aria-hidden", String(!open));
  }
  var open = function () { setOpen(true); };
  var close = function () { setOpen(false); };

  document.addEventListener("DOMContentLoaded", function () {
    setOpen(false); // closed by default

    var doOpen = open, doClose = close;

    document.querySelectorAll('button[aria-label="Menu"]').forEach(function (btn) {
      btn.addEventListener("click", function () { doOpen(); });
    });

    var scrim = document.querySelector(".app-shell__scrim");
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && body.classList.contains("drawer-open")) doClose();
    });

    var shell = document.querySelector(".app-shell");
    if (scrim && shell) {
      var REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;
      var band = function (v, cap) { return cap * Math.tanh(v / cap); }; // same clamp as liquidGlass.js

      var down = false, engaged = false, pid = null;
      var startX = 0, startY = 0, lastX = 0, lastT = 0, vel = 0;
      var openShift = 0, curX = 0, suppressClick = false;

      // paint the shell at x px of translate, interpolating radius + wash by progress
      var paint = function (x) {
        curX = x;
        var p = openShift > 0 ? (openShift - x) / openShift : 0; // 0 = open, 1 = closed
        shell.style.transform = "translateX(" + x.toFixed(1) + "px)";
        shell.style.borderRadius = (48 * (1 - p)).toFixed(1) + "px";
        scrim.style.opacity = (1 - p).toFixed(3);
      };
      var clearInline = function () {
        shell.style.transform = shell.style.borderRadius = scrim.style.opacity = "";
      };
      var finish = function (isOpen) {
        setOpen(isOpen);                          // CSS target = where we settled (transitions still OFF)…
        clearInline();                            // …drop inline while OFF so no ease kicks in…
        body.classList.remove("drawer-dragging"); // …then re-enable transitions with nothing pending
      };
      // velocity-seeded spring from curX → target (0 = closed, openShift = open)
      var settle = function (target, v0) {
        var isOpen = target > 0;
        if (REDUCE) { finish(isOpen); return; } // no decorative motion — jump to the committed state
        var x = curX, v = v0 * 16.67, K = 0.16, D = 0.62; // v: px/ms → px/frame (lower D = less bounce)
        (function tick() {
          v = (v + (target - x) * K) * D; x += v;
          if (Math.abs(target - x) < 0.5 && Math.abs(v) < 0.4) { finish(isOpen); return; }
          paint(x); requestAnimationFrame(tick);
        })();
      };

      scrim.addEventListener("pointerdown", function (e) {
        if (!body.classList.contains("drawer-open")) return;
        down = true; engaged = false; pid = e.pointerId;
        startX = lastX = e.clientX; startY = e.clientY; lastT = e.timeStamp; vel = 0;
        openShift = 0.77 * shell.getBoundingClientRect().width; // matches --drawer-shift (77%)
        curX = openShift;
      });
      scrim.addEventListener("pointermove", function (e) {
        if (!down) return;
        var dx = e.clientX - startX, dy = e.clientY - startY;
        if (!engaged) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;           // wait for intent
          if (Math.abs(dx) <= Math.abs(dy)) { down = false; return; } // vertical → not our gesture
          engaged = true;
          body.classList.add("drawer-dragging");                      // kill transitions → track 1:1
          try { scrim.setPointerCapture(pid); } catch (_) {}
        }
        var dt = e.timeStamp - lastT;
        if (dt > 0) { vel = vel * 0.7 + ((e.clientX - lastX) / dt) * 0.3; lastX = e.clientX; lastT = e.timeStamp; }
        var x = openShift + dx;                                        // dx<0 (drag left) → toward closed
        if (x > openShift) x = openShift + band(x - openShift, 60);    // resist over-open (drag right)
        else if (x < 0) x = 0;                                         // can't pass fully closed
        paint(x);
      });
      var release = function () {
        if (!down) return;
        down = false;
        if (pid != null) { try { scrim.releasePointerCapture(pid); } catch (_) {} pid = null; }
        if (!engaged) return;                        // a tap → let the existing click handler close it
        suppressClick = true;                        // a real drag must NOT also fire the tap-close
        var projected = curX + vel * 100;            // where it lands given ~100ms of momentum
        settle(projected < openShift * 0.5 ? 0 : openShift, vel);
      };
      scrim.addEventListener("pointerup", release);
      scrim.addEventListener("pointercancel", release);
      scrim.addEventListener("lostpointercapture", release);
      var animateOpen = function () {
        if (body.classList.contains("drawer-open")) return;
        openShift = 0.77 * shell.getBoundingClientRect().width;
        body.classList.add("drawer-dragging");   // no CSS ease; the spring drives the inline transform
        paint(0);                                  // start at the closed edge…
        body.classList.add("drawer-open");         // …reveal the sidebar (visibility) + arm the scrim
        sidebar.setAttribute("aria-hidden", "false");
        settle(openShift, 0);                      // …and spring open
      };
      var animateClose = function () {
        if (!body.classList.contains("drawer-open")) return;
        openShift = 0.77 * shell.getBoundingClientRect().width;
        curX = openShift;
        body.classList.add("drawer-dragging");     // spring's inline transform drives it (no CSS ease)
        settle(0, 0);                              // fully-open → closed, no initial velocity
      };
      scrim.addEventListener("click", function () {
        if (suppressClick) { suppressClick = false; return; } // drag already decided → ignore the tap
        animateClose();
      });

      var edge = document.createElement("div");
      edge.className = "drawer-edge";
      edge.setAttribute("aria-hidden", "true");
      body.appendChild(edge);
      var hasVisibleMenu = function () {
        var b = document.querySelectorAll('button[aria-label="Menu"]');
        for (var i = 0; i < b.length; i++) if (b[i].offsetParent !== null) return true;
        return false;
      };
      var od = { down: false, engaged: false, pid: null, sx: 0, sy: 0, lx: 0, lt: 0, v: 0 };
      edge.addEventListener("pointerdown", function (e) {
        if (body.classList.contains("drawer-open")) return;
        od.down = true; od.engaged = false; od.pid = e.pointerId;
        od.sx = od.lx = e.clientX; od.sy = e.clientY; od.lt = e.timeStamp; od.v = 0;
        openShift = 0.77 * shell.getBoundingClientRect().width;
      });
      edge.addEventListener("pointermove", function (e) {
        if (!od.down) return;
        var dx = e.clientX - od.sx, dy = e.clientY - od.sy;
        if (!od.engaged) {
          if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;                   // wait for intent
          if (dx <= Math.abs(dy) || !hasVisibleMenu()) { od.down = false; return; } // not a rightward open-swipe
          od.engaged = true;
          body.classList.add("drawer-dragging");
          body.classList.add("drawer-open");                                  // reveal the sidebar as we pull it out
          sidebar.setAttribute("aria-hidden", "false");
          try { edge.setPointerCapture(od.pid); } catch (_) {}
        }
        var dt = e.timeStamp - od.lt;
        if (dt > 0) { od.v = od.v * 0.7 + ((e.clientX - od.lx) / dt) * 0.3; od.lx = e.clientX; od.lt = e.timeStamp; }
        var x = dx;                                                            // 0 (closed) → openShift (open)
        if (x < 0) x = 0;
        else if (x > openShift) x = openShift + band(x - openShift, 60);       // resist over-open
        paint(x);
      });
      var orelease = function (e) {
        if (!od.down) return;
        od.down = false;
        if (od.pid != null) { try { edge.releasePointerCapture(od.pid); } catch (_) {} od.pid = null; }
        if (!od.engaged) {                                                     // a tap in the strip → forward it
          if (e && e.type === "pointerup") {
            edge.style.pointerEvents = "none";
            var under = document.elementFromPoint(e.clientX, e.clientY);
            edge.style.pointerEvents = "";
            if (under && under.click) under.click();
          }
          return;
        }
        var projected = curX + od.v * 100;                                     // past half / flicked right → open
        settle(projected > openShift * 0.5 ? openShift : 0, od.v);
      };
      edge.addEventListener("pointerup", orelease);
      edge.addEventListener("pointercancel", orelease);
      edge.addEventListener("lostpointercapture", orelease);

      doOpen = animateOpen; doClose = animateClose; // upgrade every trigger to the spring animation
    }

    sidebar.querySelectorAll("[data-nav]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        doClose();
        if (typeof navigate === "function") navigate(el.getAttribute("data-nav"));
      });
    });

    sidebar.querySelectorAll("[data-sidebar-stub]").forEach(function (el) {
      el.addEventListener("click", function () {
        doClose();
        if (el.getAttribute("data-sidebar-stub") === "favourites" &&
            typeof window.openFavourites === "function") {
          window.openFavourites();
        }
      });
    });

    sidebar.querySelectorAll("[data-sidebar-settings]").forEach(function (el) {
      el.addEventListener("click", function () {
        doClose();
        var pr = window.hawkrProfile && hawkrProfile.get();
        if (typeof navigate === "function") navigate(pr && pr.signedUp ? "settings" : "profile");
      });
    });
  });
})();
