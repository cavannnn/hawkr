const Promotion = require("../models/promotionModel");
const Voucher = require("../models/voucherModel");

const DISCOUNT_TYPES = ["percentage", "fixed"];
const SCOPE_TYPES = ["all", "category", "items"];

function validDiscount(discountType, discountValue) {
  if (!DISCOUNT_TYPES.includes(discountType)) return "Discount type must be percentage or fixed.";
  const value = Number(discountValue);
  if (!discountValue || Number.isNaN(value) || value <= 0) return "Discount value must be greater than 0.";
  if (discountType === "percentage" && value > 100) return "A percentage discount can't be more than 100.";
  return null;
}

function validDateRange(startDate, endDate) {
  if (!startDate || !endDate) return "Start date and end date are required.";
  if (new Date(endDate) <= new Date(startDate)) return "End date must be after the start date.";
  return null;
}

// ---------- Promotions ----------

async function getPromotions(req, res) {
  const { stallId } = req.params;
  try {
    const promotions = await Promotion.getPromotionsByStall(stallId);
    res.json(promotions);
  } catch (err) {
    console.error("Error fetching promotions:", err);
    res.status(500).json({ message: err.message });
  }
}

async function addPromotion(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  const { name, description, discountType, discountValue, scopeType, scopeCategory, scopeMenuIds, isActive, startDate, endDate } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ message: "Promotion name is required." });

  const discountError = validDiscount(discountType, discountValue);
  if (discountError) return res.status(400).json({ message: discountError });

  const dateError = validDateRange(startDate, endDate);
  if (dateError) return res.status(400).json({ message: dateError });

  const scope = SCOPE_TYPES.includes(scopeType) ? scopeType : "all";
  if (scope === "category" && !scopeCategory) return res.status(400).json({ message: "Pick a category for this promotion." });
  if (scope === "items" && (!Array.isArray(scopeMenuIds) || scopeMenuIds.length === 0)) {
    return res.status(400).json({ message: "Pick at least one menu item for this promotion." });
  }

  try {
    await Promotion.addPromotion(vendorId, stallId, {
      name: name.trim(),
      description: description ? description.trim() : null,
      discountType,
      discountValue,
      scopeType: scope,
      scopeCategory: scope === "category" ? scopeCategory : null,
      scopeMenuIds: scope === "items" ? scopeMenuIds : [],
      isActive,
      startDate,
      endDate
    });
    res.status(201).json({ message: "Promotion created." });
  } catch (err) {
    console.error("Error adding promotion:", err);
    res.status(500).json({ message: err.message });
  }
}

async function updatePromotion(req, res) {
  const { stallId, promotionId } = req.params;
  const { name, description, discountType, discountValue, scopeType, scopeCategory, scopeMenuIds, isActive, startDate, endDate } = req.body;

  if (!name || !name.trim()) return res.status(400).json({ message: "Promotion name is required." });

  const discountError = validDiscount(discountType, discountValue);
  if (discountError) return res.status(400).json({ message: discountError });

  const dateError = validDateRange(startDate, endDate);
  if (dateError) return res.status(400).json({ message: dateError });

  const scope = SCOPE_TYPES.includes(scopeType) ? scopeType : "all";
  if (scope === "category" && !scopeCategory) return res.status(400).json({ message: "Pick a category for this promotion." });
  if (scope === "items" && (!Array.isArray(scopeMenuIds) || scopeMenuIds.length === 0)) {
    return res.status(400).json({ message: "Pick at least one menu item for this promotion." });
  }

  try {
    const updated = await Promotion.updatePromotion(stallId, promotionId, {
      name: name.trim(),
      description: description ? description.trim() : null,
      discountType,
      discountValue,
      scopeType: scope,
      scopeCategory: scope === "category" ? scopeCategory : null,
      scopeMenuIds: scope === "items" ? scopeMenuIds : [],
      isActive,
      startDate,
      endDate
    });
    if (!updated) return res.status(404).json({ message: "Promotion not found." });
    res.json({ message: "Promotion updated." });
  } catch (err) {
    console.error("Error updating promotion:", err);
    res.status(500).json({ message: err.message });
  }
}

async function deletePromotion(req, res) {
  const { stallId, promotionId } = req.params;
  try {
    const deleted = await Promotion.deletePromotion(stallId, promotionId);
    if (!deleted) return res.status(404).json({ message: "Promotion not found." });
    res.json({ message: "Promotion removed." });
  } catch (err) {
    console.error("Error deleting promotion:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- Vouchers ----------

async function getVouchers(req, res) {
  const { stallId } = req.params;
  try {
    const vouchers = await Voucher.getVouchersByStall(stallId);
    res.json(vouchers);
  } catch (err) {
    console.error("Error fetching vouchers:", err);
    res.status(500).json({ message: err.message });
  }
}

async function addVoucher(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  const { code, description, discountType, discountValue, minOrderAmount, usageLimit, isActive, startDate, endDate } = req.body;

  if (!code || !code.trim()) return res.status(400).json({ message: "Voucher code is required." });

  const discountError = validDiscount(discountType, discountValue);
  if (discountError) return res.status(400).json({ message: discountError });

  const dateError = validDateRange(startDate, endDate);
  if (dateError) return res.status(400).json({ message: dateError });

  try {
    const result = await Voucher.addVoucher(vendorId, stallId, {
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : null,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || null,
      usageLimit: usageLimit || null,
      isActive,
      startDate,
      endDate
    });
    if (result === "duplicate code") return res.status(400).json({ message: "This stall already has a voucher with that code." });
    res.status(201).json({ message: "Voucher created." });
  } catch (err) {
    console.error("Error adding voucher:", err);
    res.status(500).json({ message: err.message });
  }
}

async function updateVoucher(req, res) {
  const { stallId, voucherId } = req.params;
  const { code, description, discountType, discountValue, minOrderAmount, usageLimit, isActive, startDate, endDate } = req.body;

  if (!code || !code.trim()) return res.status(400).json({ message: "Voucher code is required." });

  const discountError = validDiscount(discountType, discountValue);
  if (discountError) return res.status(400).json({ message: discountError });

  const dateError = validDateRange(startDate, endDate);
  if (dateError) return res.status(400).json({ message: dateError });

  try {
    const result = await Voucher.updateVoucher(stallId, voucherId, {
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : null,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || null,
      usageLimit: usageLimit || null,
      isActive,
      startDate,
      endDate
    });
    if (result === "duplicate code") return res.status(400).json({ message: "This stall already has a voucher with that code." });
    if (result === "not found") return res.status(404).json({ message: "Voucher not found." });
    res.json({ message: "Voucher updated." });
  } catch (err) {
    console.error("Error updating voucher:", err);
    res.status(500).json({ message: err.message });
  }
}

async function deleteVoucher(req, res) {
  const { stallId, voucherId } = req.params;
  try {
    const deleted = await Voucher.deleteVoucher(stallId, voucherId);
    if (!deleted) return res.status(404).json({ message: "Voucher not found." });
    res.json({ message: "Voucher removed." });
  } catch (err) {
    console.error("Error deleting voucher:", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getPromotions,
  addPromotion,
  updatePromotion,
  deletePromotion,
  getVouchers,
  addVoucher,
  updateVoucher,
  deleteVoucher
};
