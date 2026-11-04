const REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;

function geom(el) {
    const cs = getComputedStyle(el);
    const n = (prop, fallback) => {
        const v = parseFloat(cs.getPropertyValue(prop));
        return isNaN(v) ? fallback : v;
    };
    const track = n("--lgt-track-w", 72);
    const thumb = n("--lgt-thumb-w", 40);
    const glass = n("--lgt-glass-w", 64);
    const pad = n("--lgt-pad", 3);
    const over = n("--lgt-overhang", 16); 
    return {
        track, thumb, glass, pad,
        maxLeft: track - thumb - pad, 
        minGlass: -over,
        maxGlass: track - glass + over,
        half: track / 2,
    };
}

export function initLiquidGlassToggle(root, onChange = null) {
    if (!root || root.__lgt) return root;
    const input = root.querySelector('input[type="checkbox"]');
    const track = root.querySelector(".lg-toggle__track");
    const thumb = root.querySelector(".lg-toggle__thumb");
    if (!input || !track || !thumb) return root;
    root.__lgt = true;
    let g = geom(root);
    let left = input.checked ? g.maxLeft : g.pad;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let originLeft = 0;

    const paint = (x, animate) => {
        
        thumb.style.transition = animate ? "" : "left 0s";
        thumb.style.left = x + "px";
    };


    const release = () => {
        thumb.style.transition = "";
        thumb.style.left = "";
    };
    const greenAt = (x, isGlass) => {
        const centre = x + (isGlass ? g.glass : g.thumb) / 2;
        track.classList.toggle("is-on", centre > g.half);
    };
    
    const reflectAria = () => input.setAttribute("aria-checked", String(input.checked));

    function commit(on, fire) {
        const changed = input.checked !== on;
        input.checked = on;
        reflectAria();
        root.classList.remove("is-dragging");
        track.classList.toggle("is-on", on);
        
        left = on ? g.maxLeft : g.pad;
        release();
        if (!changed || !fire) return;
        




        input.dispatchEvent(new Event("change", { bubbles: true }));
        if (onChange) onChange(on);
    }

    
    function morphTo(on) {
        if (input.checked === on) return;
        g = geom(root);
        left = input.checked ? g.maxLeft : g.pad;
        if (REDUCE) {
            commit(on, true);
            return;
        }
        root.classList.add("is-dragging"); 
        const from = Math.max(g.minGlass, Math.min(g.maxGlass, left + g.thumb / 2 - g.glass / 2));
        paint(from, false);
        setTimeout(() => {
            
            paint(on ? g.maxGlass : g.minGlass, true);
            track.classList.toggle("is-on", on);
            setTimeout(() => commit(on, true), 300);
        }, 50);
    }

    
    thumb.addEventListener("pointerdown", (e) => {
        if (input.disabled) return;
        g = geom(root);
        left = input.checked ? g.maxLeft : g.pad;
        dragging = true;
        moved = false;
        startX = e.clientX;
        thumb.setPointerCapture(e.pointerId);
        if (!REDUCE) {
            root.classList.add("is-dragging");
            originLeft = Math.max(g.minGlass, Math.min(g.maxGlass, left + g.thumb / 2 - g.glass / 2));
            paint(originLeft, false);
        } else {
            originLeft = left;
        }
        e.preventDefault();
    });

    thumb.addEventListener("pointermove", (e) => {
        if (!dragging || REDUCE) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 3) moved = true;
        const x = Math.max(g.minGlass, Math.min(g.maxGlass, originLeft + dx));
        paint(x, false);
        greenAt(x, true);
    });

    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try {
            thumb.releasePointerCapture(e.pointerId);
        } catch (_) {}
        if (!moved) return; 
        const x = parseFloat(thumb.style.left);
        commit(x + g.glass / 2 > g.half, true);
    }
    thumb.addEventListener("pointerup", endDrag);
    thumb.addEventListener("pointercancel", endDrag);

    
    root.addEventListener("click", (e) => {
        if (input.disabled) return;
        e.preventDefault();
        if (moved) {
            moved = false;
            return;
        } 
        morphTo(!input.checked);
    });

    
    input.addEventListener("keydown", (e) => {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        morphTo(!input.checked);
    });

    reflectAria();
    track.classList.toggle("is-on", input.checked);
    

    return root;
}

export function setToggleState(root, on) {
    const input = root && root.querySelector('input[type="checkbox"]');
    const track = root && root.querySelector(".lg-toggle__track");
    const thumb = root && root.querySelector(".lg-toggle__thumb");
    if (!input || !track || !thumb) return;
    input.checked = !!on;
    input.setAttribute("aria-checked", String(!!on));
    track.classList.toggle("is-on", !!on);
    thumb.style.transition = "left 0s";
    thumb.style.left = "";
    void thumb.offsetWidth;
    thumb.style.transition = "";
}


export function initAllLiquidGlassToggles(root, onChange = null) {
    (root || document).querySelectorAll(".lg-toggle").forEach((el) => initLiquidGlassToggle(el, onChange));
}

export const initMiniLiquidGlassToggle = initLiquidGlassToggle;
