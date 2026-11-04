/* sidebarResponsive.js — the mobile drawer. */

(function () {
    var body = document.body;

    var MOBILE =
        parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--bp-mobile")
        ) || 768;

    var hamburger = document.querySelector(".sidebarHamburger");
    var overlay = document.querySelector(".sidebarOverlay");
    var sidebar = document.querySelector(".sidebar");
    var shell = document.querySelector(".mainContent");
    if (!hamburger || !overlay || !sidebar || !shell) return;

    var isMobile = function () {
        return window.innerWidth <= MOBILE;
    };
    var isOpen = function () {
        return body.classList.contains("sidebarOpen");
    };

    var shiftPx = function () {
        var v = getComputedStyle(document.documentElement).getPropertyValue("--drawer-shift");
        return parseFloat(v) || 280;
    };
    var radiusPx = function () {
        var v = getComputedStyle(document.documentElement).getPropertyValue("--drawer-radius");
        return parseFloat(v) || 32;
    };

    var REDUCE = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    var band = function (v, cap) {
        return cap * Math.tanh(v / cap);
    };

    var openShift = 0;
    var curX = 0;
    var suppressClick = false;

    function paint(x) {
        curX = x;
        var p = openShift > 0 ? (openShift - x) / openShift : 0;
        shell.style.transform = "translateX(" + x.toFixed(1) + "px)";
        shell.style.borderRadius = (radiusPx() * (1 - p)).toFixed(1) + "px";
        overlay.style.transform = shell.style.transform;
        overlay.style.borderRadius = shell.style.borderRadius;
        overlay.style.opacity = (1 - p).toFixed(3);
    }

    function clearInline() {
        shell.style.transform = "";
        shell.style.borderRadius = "";
        overlay.style.transform = "";
        overlay.style.borderRadius = "";
        overlay.style.opacity = "";
    }

    /* Order matters — see the header note. */
    function finish(open) {
        body.classList.toggle("sidebarOpen", open);
        clearInline();
        body.classList.remove("sidebarDragging");
        sidebar.setAttribute("aria-hidden", open || !isMobile() ? "false" : "true");
        hamburger.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function settle(target, v0) {
        var open = target > 0;
        if (REDUCE) {
            finish(open);
            return;
        }
        var x = curX;
        var v = v0 * 16.67; /* px/ms -> px/frame */
        var K = 0.16;
        var D = 0.62; /* lower damping = less bounce; matches the consumer drawer */
        (function tick() {
            v = (v + (target - x) * K) * D;
            x += v;
            if (Math.abs(target - x) < 0.5 && Math.abs(v) < 0.4) {
                finish(open);
                return;
            }
            paint(x);
            requestAnimationFrame(tick);
        });
    }

    function animateOpen() {
        if (isOpen() || !isMobile()) return;
        openShift = shiftPx();
        body.classList.add("sidebarDragging");
        paint(0);
        body.classList.add("sidebarOpen");
        sidebar.setAttribute("aria-hidden", "false");
        settle(openShift, 0);
    }

    function animateClose() {
        if (!isOpen()) return;
        openShift = shiftPx();
        curX = openShift;
        body.classList.add("sidebarDragging");
        settle(0, 0);
    }

    hamburger.addEventListener("click", function () {
        if (isOpen()) animateClose();
        else animateOpen();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && isOpen()) animateClose();
    });

    /* ---- Drag the shoved card left to close ---- */
    var d = { down: false, engaged: false, pid: null, sx: 0, sy: 0, lx: 0, lt: 0, v: 0 };

    overlay.addEventListener("pointerdown", function (e) {
        if (!isOpen() || !isMobile()) return;
        d.down = true;
        d.engaged = false;
        d.pid = e.pointerId;
        d.sx = d.lx = e.clientX;
        d.sy = e.clientY;
        d.lt = e.timeStamp;
        d.v = 0;
        openShift = shiftPx();
        curX = openShift;
    });

    overlay.addEventListener("pointermove", function (e) {
        if (!d.down) return;
        var dx = e.clientX - d.sx;
        var dy = e.clientY - d.sy;
        if (!d.engaged) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (Math.abs(dx) <= Math.abs(dy)) {
                d.down = false;
                return;
            }
            d.engaged = true;
            body.classList.add("sidebarDragging");
            try {
                overlay.setPointerCapture(d.pid);
            } catch (_) {}
        }
        var dt = e.timeStamp - d.lt;
        if (dt > 0) {
            d.v = d.v * 0.7 + ((e.clientX - d.lx) / dt) * 0.3;
            d.lx = e.clientX;
            d.lt = e.timeStamp;
        }
        var x = openShift + dx;
        if (x > openShift) x = openShift + band(x - openShift, 60);
        else if (x < 0) x = 0;
        paint(x);
    });

    function release() {
        if (!d.down) return;
        d.down = false;
        if (d.pid != null) {
            try {
                overlay.releasePointerCapture(d.pid);
            } catch (_) {}
            d.pid = null;
        }
        if (!d.engaged) return; /* a tap — the click handler below closes it */
        suppressClick = true; /* a real drag must not also fire the tap-to-close */
        var projected = curX + d.v * 100;
        settle(projected < openShift * 0.5 ? 0 : openShift, d.v);
    }

    overlay.addEventListener("pointerup", release);
    overlay.addEventListener("pointercancel", release);
    overlay.addEventListener("lostpointercapture", release);

    overlay.addEventListener("click", function () {
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        animateClose();
    });

    /* ---- Swipe right from the left edge to open ---- */
    var edge = document.createElement("div");
    edge.className = "drawerEdge";
    edge.setAttribute("aria-hidden", "true");
    body.appendChild(edge);

    var o = { down: false, engaged: false, pid: null, sx: 0, sy: 0, lx: 0, lt: 0, v: 0 };

    edge.addEventListener("pointerdown", function (e) {
        if (isOpen() || !isMobile()) return;
        o.down = true;
        o.engaged = false;
        o.pid = e.pointerId;
        o.sx = o.lx = e.clientX;
        o.sy = e.clientY;
        o.lt = e.timeStamp;
        o.v = 0;
        openShift = shiftPx();
    });

    edge.addEventListener("pointermove", function (e) {
        if (!o.down) return;
        var dx = e.clientX - o.sx;
        var dy = e.clientY - o.sy;
        if (!o.engaged) {
            if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
            if (dx <= Math.abs(dy)) {
                o.down = false;
                return;
            }
            o.engaged = true;
            body.classList.add("sidebarDragging");
            body.classList.add("sidebarOpen"); /* reveal the drawer as it is pulled out */
            sidebar.setAttribute("aria-hidden", "false");
            try {
                edge.setPointerCapture(o.pid);
            } catch (_) {}
        }
        var dt = e.timeStamp - o.lt;
        if (dt > 0) {
            o.v = o.v * 0.7 + ((e.clientX - o.lx) / dt) * 0.3;
            o.lx = e.clientX;
            o.lt = e.timeStamp;
        }
        var x = dx;
        if (x < 0) x = 0;
        else if (x > openShift) x = openShift + band(x - openShift, 60);
        paint(x);
    });

    function orelease(e) {
        if (!o.down) return;
        o.down = false;
        if (o.pid != null) {
            try {
                edge.releasePointerCapture(o.pid);
            } catch (_) {}
            o.pid = null;
        }
        if (!o.engaged) {
            /* Never swallow a tap meant for something beneath the strip. */
            if (e && e.type === "pointerup") {
                edge.style.pointerEvents = "none";
                var under = document.elementFromPoint(e.clientX, e.clientY);
                edge.style.pointerEvents = "";
                if (under && under.click) under.click;
            }
            return;
        }
        var projected = curX + o.v * 100;
        settle(projected > openShift * 0.5 ? openShift : 0, o.v);
    }

    edge.addEventListener("pointerup", orelease);
    edge.addEventListener("pointercancel", orelease);
    edge.addEventListener("lostpointercapture", orelease);

    /* ---- The top bar's actions move into the drawer ---- */
    function mirrorActionsIntoDrawer() {
        var nav = sidebar.querySelector(".sidebarNav");
        var pill = document.querySelector(".topBarActions");
        if (!nav || !pill || nav.querySelector("[data-mirrored]")) return;

        var wanted = [
            { match: "[data-notification-bell]", label: "Alerts" },
            { match: "#logoutBtn", label: "Log out", destructive: true },
        ];

        wanted.forEach(function (spec) {
            var source = pill.querySelector(spec.match);
            if (!source) return;

            var row = document.createElement("button");
            row.type = "button";
            row.className = "navItem navItem--mirrored";
            row.setAttribute("data-mirrored", "");
            if (spec.destructive) row.setAttribute("data-destructive", "");

            var glyph = source.querySelector(".icon");
            if (glyph) row.appendChild(glyph.cloneNode(true));

            var text = document.createElement("span");
            text.textContent = spec.label;
            row.appendChild(text);

            row.addEventListener("click", function () {
                source.click();
            });

            nav.appendChild(row);
        });

        var card = sidebar.querySelector(".sidebarProfile");
        var settings = pill.querySelector('[aria-label="Settings"]');
        if (card && settings && !card.hasAttribute("data-mirrored")) {
            card.setAttribute("data-mirrored", "");
            card.setAttribute("role", "button");
            card.setAttribute("tabindex", "0");
            card.setAttribute("aria-label", "Settings");
            var go = function () {
                if (isMobile()) settings.click();
            };
            card.addEventListener("click", go);
            card.addEventListener("keydown", function (e) {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    go();
                }
            });
        }
    }

    mirrorActionsIntoDrawer();

    sidebar.querySelectorAll(".navItem").forEach(function (link) {
        link.addEventListener("click", function () {
            if (isMobile()) animateClose();
        });
    });

    window.addEventListener("resize", function () {
        if (!isMobile() && isOpen()) finish(false);
    });

    hamburger.setAttribute("aria-expanded", "false");
    sidebar.setAttribute("aria-hidden", isMobile() ? "true" : "false");
});
