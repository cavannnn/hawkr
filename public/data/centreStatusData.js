import { request } from "./shared.js";

/* ================================================================= the reads -- */

// GET `/api/centre-management/centres/${hawkerId}/status`
export async function getCentreStatus(hawkerId) {
  return request(`/api/centre-management/centres/${hawkerId}/status`);
}

// GET `/api/centre-management/stalls/${stallId}/centre-status`
export async function getStallCentreStatus(stallId) {
  return request(`/api/centre-management/stalls/${stallId}/centre-status`);
}

export function closureState(closure, now = new Date(), soonDays = 7) {
  if (!closure || closure.Status === "Cancelled") return null;
  const start = new Date(closure.StartDateTime);
  const end = new Date(closure.EndDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const t = now.getTime();
  if (t >= start.getTime() && t < end.getTime()) return "closed";
  if (start.getTime() > t && start.getTime() - t <= soonDays * 86400000) return "soon";
  return null;
}

export function currentClosure(closures, now = new Date(), soonDays = 7) {
  let best = null;
  (closures || []).forEach((c) => {
    const state = closureState(c, now, soonDays);
    if (!state) return;
    if (!best) { best = { closure: c, state }; return; }
    if (best.state === "soon" && state === "closed") { best = { closure: c, state }; return; }
    if (best.state === state && new Date(c.StartDateTime) < new Date(best.closure.StartDateTime)) {
      best = { closure: c, state };
    }
  });
  return best;
}

export function livePromotions(promotions, now = new Date()) {
  const t = now.getTime();
  return (promotions || []).filter((p) => {
    if (!p || p.Status === "Archived") return false;
    const start = new Date(p.StartDateTime).getTime();
    const end = new Date(p.EndDateTime).getTime();
    return !Number.isNaN(start) && !Number.isNaN(end) && t >= start && t < end;
  });
}

export function discountLabel(promotion) {
  if (!promotion) return "";
  const value = Number(promotion.DiscountValue || 0);
  return promotion.DiscountType === "Percentage"
    ? `${value}% off`
    : `$${value.toFixed(2)} off`;
}

export function promotionDiscountCents(promotion, lines) {
  if (!promotion || !Array.isArray(lines) || !lines.length) return 0;
  const value = Number(promotion.DiscountValue || 0);
  if (!value) return 0;

  const subtotal = lines.reduce((n, l) => n + Math.max(0, l.unit || 0) * Math.max(0, l.qty || 0), 0);
  if (subtotal <= 0) return 0;

  const raw = promotion.DiscountType === "Percentage"
    ? Math.round((subtotal * value) / 100)
    : lines.reduce((n, l) => {
        const unit = Math.max(0, l.unit || 0);
        const qty = Math.max(0, l.qty || 0);
        return n + Math.min(unit, Math.round(value * 100)) * qty; // capped per item, then per unit
      }, 0);

  return Math.max(0, Math.min(subtotal, raw));
}

// GET `/api/stalls/${stallId}/promotions`
export async function getStallVendorPromotions(stallId) {
  const id = Number(stallId);
  try {
    const body = await request(`/api/stalls/${encodeURIComponent(id)}/promotions`);
    return { stallId: id, promotions: (body && body.promotions) || [] };
  } catch (err) {
    return { stallId: id, promotions: [] };
  }
}

export function liveVendorPromotions(promotions, now = new Date()) {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(now);
  return (promotions || [])
    .filter((p) => {
      if (!p || !p.isActive) return false;
      const start = new Date(p.startDate);
      const end = new Date(p.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      return startOfDay(start) <= today && startOfDay(end) >= today;
    })
    .slice()
    .sort((a, b) => Number(a.promotionId) - Number(b.promotionId));
}

export function vendorDiscountLabel(promotion) {
  if (!promotion) return "";
  const value = Number(promotion.discountValue || 0);
  return promotion.discountType === "percentage"
    ? `${value}% off`
    : `$${value.toFixed(2)} off`;
}

export function promotionCoversItem(promotion, item) {
  if (!promotion || !item) return false;
  if (promotion.scopeType === "all") return true;

  if (promotion.scopeType === "items") {
    if (item.menuId == null) return false;
    return (promotion.scopeMenuIds || []).some((id) => Number(id) === Number(item.menuId));
  }

  if (promotion.scopeType === "category") {
    if (!promotion.scopeCategory || !item.category) return false;
    return String(promotion.scopeCategory).toLowerCase() === String(item.category).toLowerCase();
  }

  return false;
}

const SCOPE_PRIORITY = { items: 3, category: 2, all: 1 };

export function vendorPromotionForItem(item, activePromotions) {
  let best = null;
  let bestAmount = -1;

  for (const promotion of activePromotions || []) {
    if (!promotionCoversItem(promotion, item)) continue;

    const unit = Math.max(0, Number(item.unitCents) || 0);
    const value = Number(promotion.discountValue) || 0;
    const amount = promotion.discountType === "percentage"
      ? Math.round((unit * value) / 100)
      : Math.min(unit, Math.round(value * 100));

    const morePrecise = !best
      || SCOPE_PRIORITY[promotion.scopeType] > SCOPE_PRIORITY[best.scopeType];
    const equallyPreciseAndBigger = best
      && SCOPE_PRIORITY[promotion.scopeType] === SCOPE_PRIORITY[best.scopeType]
      && amount > bestAmount;

    if (morePrecise || equallyPreciseAndBigger) {
      best = promotion;
      bestAmount = amount;
    }
  }

  return best;
}

export function remainingUnitCents(line, promotion) {
  const unit = Math.max(0, (line && line.unit) || 0);
  if (!promotion) return unit;

  const value = Number(promotion.DiscountValue || 0);
  if (!value) return unit;

  const taken = promotion.DiscountType === "Percentage"
    ? Math.min(unit, Math.floor((unit * value) / 100))
    : Math.min(unit, Math.round(value * 100));

  return Math.max(0, unit - taken);
}

export function vendorDiscountCents(promotion, group) {
  const value = Number((promotion && promotion.discountValue) || 0);
  if (!value) return 0;

  const base = (group || []).reduce((sum, entry) => sum + entry.remaining * entry.qty, 0);
  if (base <= 0) return 0;

  const raw = promotion.discountType === "percentage"
    ? Math.round((base * value) / 100)
    : group.reduce(
      (sum, entry) => sum + Math.min(entry.remaining, Math.round(value * 100)) * entry.qty,
      0,
    );

  return Math.max(0, Math.min(base, raw));
}

export function voucherDiscountCents(voucher, baseCents) {
  if (!voucher) return 0;

  const base = Math.max(0, baseCents || 0);
  if (base <= 0) return 0;

  const value = Number(voucher.discountValue || 0);
  if (!value) return 0;

  const raw = voucher.discountType === "percentage"
    ? Math.round((base * value) / 100)
    : Math.round(value * 100);

  return Math.max(0, Math.min(base, raw));
}

export function priceStallLines(lines, centrePromotion, voucher) {
  const rows = lines || [];
  const subtotal = rows.reduce(
    (sum, l) => sum + Math.max(0, l.unit || 0) * Math.max(0, l.qty || 0),
    0,
  );
  const discounts = [];

  const centreDiscount = promotionDiscountCents(centrePromotion, rows);
  if (centreDiscount > 0) {
    discounts.push({
      source: "centre-promotion",
      promotionId: centrePromotion.PromotionId,
      name: centrePromotion.Name,
      label: discountLabel(centrePromotion),
      amountCents: centreDiscount,
    });
  }

  /* SECOND: the vendor's, each against what its own lines have left. */
  const groups = new Map();
  for (const line of rows) {
    const vendorPromotion = line.vendorPromotion;
    if (!vendorPromotion) continue;

    if (!groups.has(vendorPromotion.promotionId)) {
      groups.set(vendorPromotion.promotionId, { promotion: vendorPromotion, entries: [] });
    }
    groups.get(vendorPromotion.promotionId).entries.push({
      remaining: remainingUnitCents(line, centrePromotion),
      qty: Math.max(0, line.qty || 0),
    });
  }

  for (const group of groups.values()) {
    const amount = vendorDiscountCents(group.promotion, group.entries);
    if (amount > 0) {
      discounts.push({
        source: "vendor-promotion",
        promotionId: group.promotion.promotionId,
        name: group.promotion.name,
        label: vendorDiscountLabel(group.promotion),
        amountCents: amount,
      });
    }
  }

  const promotionsTotal = discounts.reduce((sum, d) => sum + d.amountCents, 0);
  const voucherAmount = voucherDiscountCents(voucher, Math.max(0, subtotal - promotionsTotal));
  if (voucherAmount > 0) {
    discounts.push({
      source: "voucher",
      voucherId: voucher.voucherId != null ? voucher.voucherId : null,
      name: voucher.code,
      label: voucher.discountType === "percentage"
        ? `${Number(voucher.discountValue)}% off`
        : `$${Number(voucher.discountValue).toFixed(2)} off`,
      amountCents: voucherAmount,
    });
  }

  const discountCents = Math.min(
    subtotal,
    discounts.reduce((sum, d) => sum + d.amountCents, 0),
  );

  return {
    subtotalCents: subtotal,
    discounts,
    discountCents,
    totalCents: Math.max(0, subtotal - discountCents),
    voucherDiscountCents: voucherAmount,
  };
}

/* ---------------------------------------------------------------- dates -- */

export function closureDayLabel(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return date.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" });
}

export function closureTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date
    .toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s?(AM|PM)/i, (m) => m.trim().toLowerCase());
}
