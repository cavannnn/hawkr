const REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;

const DRAG_THRESHOLD = 6;

function geom(bar) {
    const cs = getComputedStyle(bar);
    const n = (prop, fallback) => {
        const v = parseFloat(cs.getPropertyValue(prop));
        return isNaN(v) ? fallback : v;
    };
    return {
        over: n("--bn-over", 25), // horizontal overhang each side, at rest
        padY: n("--bn-pad-y", 6), // vertical padding around the item, at rest
        inset: n("--bn-inset", 3), // closest the stadium may come to the bar's cap
        grow: n("--bn-grow", 6), // extra all round while materialised
    };
}

function deriveCurrent(items) {
    if (!items.every((i) => i.href)) return null;

    const norm = (p) => p.replace(/\/+$/, "").toLowerCase();
    const here = norm(location.pathname);

    return items.find((i) => norm(new URL(i.href).pathname) === here) || null;
}

function spanFor(bar, item, g, grown) {
    const extra = grown ? g.grow : 0;
    const left = Math.max(item.offsetLeft - g.over, g.inset);
    const right = Math.min(item.offsetLeft + item.offsetWidth + g.over, bar.clientWidth - g.inset);
    return {
        x: left - extra,
        w: right - left + extra * 2,
        h: item.offsetHeight + g.padY * 2 + extra * 2,
        y: item.offsetTop - g.padY - extra,
    };
}

/**
 * Wire one dock.
 * @param {HTMLElement} bar - the dock element
 * @param {object} [opts]
 * @param {string} [opts.item] - selector for its items
 * @param {Function} [opts.onChange] - called with the newly current item
 */
export function initBottomNav(bar, opts = {}) {
    if (!bar || bar.__bn) return bar;
    const itemSel = opts.item || ".bottomNav__item";
    const items = [...bar.querySelectorAll(itemSel)];
    if (items.length < 2) return bar;
    bar.__bn = true;

    const marked = items.find((i) => i.getAttribute("aria-current") === "true");
    let current = marked || deriveCurrent(items);

    if (!current) {
        return bar;
    }

    const thumb = document.createElement("span");
    thumb.className = "bottomNav__thumb";
    thumb.setAttribute("aria-hidden", "true");
    bar.insertBefore(thumb, bar.firstChild);

    let g = geom(bar);
    if (!marked) {
        items.forEach((i) => i.setAttribute("aria-current", i === current ? "true" : "false"));
    }

    const paint = (s, animate) => {
        thumb.style.transition = animate ? "" : "none";
        thumb.style.left = s.x + "px";
        thumb.style.top = s.y + "px";
        thumb.style.width = s.w + "px";
        thumb.style.height = s.h + "px";
    };

    const settle = (item) => {
        current = item;
        items.forEach((i) => i.setAttribute("aria-current", i === item ? "true" : "false"));
        bar.classList.remove("is-morphing");
        paint(spanFor(bar, item, g, false), true);
    };

    /** Which item is the stadium's centre currently over? */
    const nearest = () => {
        const centre = parseFloat(thumb.style.left) + parseFloat(thumb.style.width) / 2;
        let best = current;
        let bestD = Infinity;
        for (const i of items) {
            const d = Math.abs(i.offsetLeft + i.offsetWidth / 2 - centre);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    };

    /* Tap: expand → slide → settle. */
    function morphTo(item) {
        if (item === current) return;
        g = geom(bar);
        if (REDUCE) { settle(item); return; }
        bar.classList.add("is-morphing");
        paint(spanFor(bar, current, g, true), false);
        setTimeout(() => {
            // let the expand paint before the slide starts
            paint(spanFor(bar, item, g, true), true);
            setTimeout(() => settle(item), 300);
        }, 50);
    }

    /* ---- drag --------------------------------------------------------------- */
    let down = false, sx = 0, moved = 0, capturedId = null, suppressClick = false, origin = null;

    function onDown(e) {
        if (e.currentTarget !== current) return;
        down = true;
        moved = 0;
        suppressClick = false;
        sx = e.clientX;
        g = geom(bar);
        origin = spanFor(bar, current, g, true);
        e.stopPropagation();

        paint(origin, false);
        bar.classList.add("is-morphing");
    }

    function onMove(e) {
        if (!down || REDUCE) return;
        const dx = e.clientX - sx;
        moved = Math.max(moved, Math.abs(dx));
        if (moved <= DRAG_THRESHOLD) return;

        if (capturedId == null) {
            try { e.currentTarget.setPointerCapture(e.pointerId); capturedId = e.pointerId; } catch (_) {}
            bar.classList.add("is-morphing");
        }
        const maxX = bar.clientWidth - g.inset - origin.w + g.grow;
        const x = Math.max(g.inset - g.grow, Math.min(maxX, origin.x + dx));
        paint({ x, y: origin.y, w: origin.w, h: origin.h }, false);
    }

    function onUp(e) {
        if (!down) return;
        down = false;
        if (capturedId != null) {
            try { e.currentTarget.releasePointerCapture(capturedId); } catch (_) {}
            capturedId = null;
        }
        if (moved <= DRAG_THRESHOLD) {
            settle(current);
            return; // still let the click run
        }
        suppressClick = true; // a real drag must not also fire the action
        settle(nearest());
    }

    items.forEach((item) => {
        item.addEventListener("pointerdown", onDown);
        item.addEventListener("pointermove", onMove);
        item.addEventListener("pointerup", onUp);
        item.addEventListener("pointercancel", onUp);
        item.addEventListener("click", (e) => {
            if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
            morphTo(item);
        });
    });

    const resync = () => {
        if (!bar.clientWidth) return; // still hidden — nothing meaningful to measure yet
        g = geom(bar);
        paint(spanFor(bar, current, g, false), false);
        bar.classList.add("bottomNav--ready");
    };

    if (typeof ResizeObserver === "function") {
        new ResizeObserver(resync).observe(bar);
    } else {
        addEventListener("resize", resync);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resync);

    resync(); // no animation on init — the stadium simply appears under the current item

    return bar;
}

/** Wire every `[data-bottom-nav]` under `root`. */
export function initAllBottomNavs(root) {
    (root || document).querySelectorAll("[data-bottom-nav]").forEach((el) =>
        initBottomNav(el, { item: el.getAttribute("data-bottom-nav-item") || undefined }),
    );
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAllBottomNavs(document));
} else {
    initAllBottomNavs(document);
}
