import {
  getCentreStatus,
  currentClosure,
  livePromotions,
  discountLabel,
  closureDayLabel,
  closureTimeLabel,
  getStallVendorPromotions,
  liveVendorPromotions,
  vendorDiscountLabel,
  vendorPromotionForItem,
  priceStallLines,
  voucherDiscountCents,
} from "../data/centreStatusData.js";

const byCentre = new Map();
const byStall = new Map();
let loaded = false;
const readyFns = [];

function centreRecord(name) {
  if (!name) return null;
  try {
    return (typeof CENTRES !== "undefined" && CENTRES[name]) || null;
  } catch (_) {
    return null;
  }
}
function centreIdFor(name) {
  const rec = centreRecord(name);
  return rec && rec.hawkerId != null ? Number(rec.hawkerId) : null;
}

/* ---------------- load ---------------- */

async function loadCentre(name, hawkerId) {
  const status = await getCentreStatus(hawkerId);
  const live = livePromotions(status.promotions);
  const stallsByPromotion = new Map(
    live.map((p) => [p.PromotionId, (p.StallIds || []).map(Number)])
  );
  byCentre.set(name, {
    name,
    hawkerId,
    closure: currentClosure(status.closures),
    promotions: live,
    stallsByPromotion,
  });
}

async function loadStall(stallId) {
  const data = await getStallVendorPromotions(stallId);
  byStall.set(Number(stallId), {
    stallId: Number(stallId),
    promotions: liveVendorPromotions(data.promotions),
  });
}

async function load() {
  try { if (window.hawkrCatalog) await window.hawkrCatalog.ready(); } catch (_) {}

  let names = [];
  try {
    names = typeof CENTRES !== "undefined" ? Object.keys(CENTRES) : [];
  } catch (_) {
    names = [];
  }
  let stallIds = [];
  try {
    stallIds = (typeof STORES !== "undefined" ? STORES : [])
      .map((s) => s.stallId)
      .filter((id) => id != null);
  } catch (_) {
    stallIds = [];
  }

  await Promise.all([
    ...names.map(async (name) => {
      const hawkerId = centreIdFor(name);
      if (hawkerId == null) return;
      try {
        await loadCentre(name, hawkerId);
      } catch (_) {
      }
    }),
    ...stallIds.map(async (stallId) => {
      try {
        await loadStall(stallId);
      } catch (_) {
      }
    }),
  ]);
  loaded = true;
  readyFns.forEach((fn) => { try { fn(); } catch (_) {} });
}

/* ---------------- reads ---------------- */

function forCentre(name) {
  return byCentre.get(name) || null;
}

function storeByName(name) {
  try {
    return (typeof STORES !== "undefined" ? STORES : []).filter((s) => s.name === name)[0] || null;
  } catch (_) {
    return null;
  }
}

function forStore(store) {
  const s = typeof store === "string" ? storeByName(store) : store;
  if (!s) return null;
  return forCentre(s.location);
}

function isClosed(store) {
  const st = forStore(store);
  return !!(st && st.closure && st.closure.state === "closed");
}

function promotionFor(store) {
  const s = typeof store === "string" ? storeByName(store) : store;
  const st = forStore(s);
  if (!st || !s || s.stallId == null) return null;
  const id = Number(s.stallId);
  return st.promotions.filter((p) => (st.stallsByPromotion.get(p.PromotionId) || []).includes(id))[0] || null;
}

function vendorPromotionsFor(store) {
  const s = typeof store === "string" ? storeByName(store) : store;
  if (!s || s.stallId == null) return [];
  const rec = byStall.get(Number(s.stallId));
  return rec ? rec.promotions : [];
}

function priceStall(store, lines, voucher) {
  const centrePromotion = promotionFor(store);
  const vendorPromotions = vendorPromotionsFor(store);
  const priced = (lines || []).map((l) => ({
    unit: l.unit,
    qty: l.qty,
    vendorPromotion: vendorPromotionForItem(
      { menuId: l.menuId, category: l.category, unitCents: l.unit },
      vendorPromotions,
    ),
  }));
  return priceStallLines(priced, centrePromotion, voucher);
}

/* ---------------- words ---------------- */

function closureLine(store) {
  const st = forStore(store);
  if (!st || !st.closure) return null;
  const { closure, state } = st.closure;
  if (state === "closed") {
    return {
      state: "closed",
      short: `${st.name} is closed`,
      long: `${st.name} is closed until ${closureDayLabel(closure.EndDateTime)}, ` +
        `${closureTimeLabel(closure.EndDateTime)}. You cannot order from here until it reopens.`,
      reason: closure.Reason,
    };
  }
  return {
    state: "soon",
    short: `${st.name} closes ${closureDayLabel(closure.StartDateTime)}`,
    long: `${st.name} closes ${closureDayLabel(closure.StartDateTime)} at ` +
      `${closureTimeLabel(closure.StartDateTime)}, reopening ${closureDayLabel(closure.EndDateTime)}.`,
    reason: closure.Reason,
  };
}

function promotionLine(store) {
  const promotion = promotionFor(store);
  if (!promotion) return null;
  return {
    short: `${discountLabel(promotion)} — ${promotion.Name}`,
    name: promotion.Name,
    label: discountLabel(promotion),
    description: promotion.Description || null,
  };
}

function scopeWords(promotion) {
  if (promotion.scopeType === "category" && promotion.scopeCategory) return ` on ${promotion.scopeCategory}`;
  if (promotion.scopeType === "items") return " on selected dishes";
  return "";
}

function vendorPromotionLine(store) {
  const promotions = vendorPromotionsFor(store);
  if (!promotions.length) return null;
  const promotion = promotions[0];
  const label = vendorDiscountLabel(promotion) + scopeWords(promotion);
  const more = promotions.length - 1;
  return {
    short: `${label} — ${promotion.name}${more > 0 ? ` +${more} more` : ""}`,
    name: promotion.name,
    label,
    description: promotion.description || null,
    count: promotions.length,
    all: promotions.map((p) => ({
      name: p.name,
      label: vendorDiscountLabel(p) + scopeWords(p),
      description: p.description || null,
    })),
  };
}

window.hawkrCentre = {
  forCentre,
  forStore,
  isClosed,
  promotionFor,
  vendorPromotionsFor,
  priceStall,
  voucherDiscountCents,
  closureLine,
  promotionLine,
  vendorPromotionLine,
  isLoaded: () => loaded,
  onReady: (fn) => {
    if (typeof fn !== "function") return;
    if (loaded) fn();
    else readyFns.push(fn);
  },
};

window.hawkrCentre.onReady(function () {
  try { if (typeof window.renderFyp === "function") window.renderFyp(); } catch (_) {}
  try { if (typeof window.renderResultsFeed === "function") window.renderResultsFeed(); } catch (_) {}
  try {
    if (document.body.dataset.view === "store" && typeof window.currentStoreName === "function" &&
        typeof window.renderStoreProfile === "function") {
      const s = storeByName(window.currentStoreName());
      if (s) window.renderStoreProfile(s);
    }
  } catch (_) {}
  try { if (typeof window.hawkrCartRefresh === "function") window.hawkrCartRefresh(); } catch (_) {}
});

load();
