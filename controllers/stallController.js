const fs = require("fs");
const Stall = require("../models/stallModel");
const Promotion = require("../models/promotionModel");
const Voucher = require("../models/voucherModel");
const RentalAgreement = require("../models/rentalAgreementModel");
const RentalRenewal = require("../models/rentalRenewalModel");
const Review = require("../models/reviewModel");
const { streamAgreementPdf } = require("../utils/rentalAgreementPdf");

// ---------- Vendor side ----------

// GET the hawker centres shown in the request form
async function getCentres(req, res) {
  try {
    const centres = await Stall.getCentres();
    res.json(centres);
  } catch (err) {
    console.error("Error fetching centres:", err);
    res.status(500).json({ message: err.message });
  }
}

// GET everything the My Stall page needs such as approved stalls and past requests
async function getMyStalls(req, res) {
  const vendorId = req.params.id;
  try {
    const stalls = await Stall.getStallsByVendor(vendorId);
    const requests = await Stall.getRequestsByVendor(vendorId);
    res.json({ stalls, requests });
  } catch (err) {
    console.error("Error fetching stall data:", err);
    res.status(500).json({ message: err.message });
  }
}

const { DECLARABLE_GRADES } = require("../utils/grading");

// POST a new stall request (multipart/form-data: text fields with a stallImage file)
async function createRequest(req, res) {
  const vendorId = req.params.id;
  const { centreId, stallName, unitNumber, description, openingTime, closingTime, hygieneGrade } = req.body;

  if (!centreId || !stallName || !unitNumber || !openingTime || !closingTime || !req.file) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      message: "Hawker centre, stall name, unit number, opening/closing time and a stall image are required."
    });
  }

  if (hygieneGrade && !DECLARABLE_GRADES.includes(hygieneGrade)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ message: "Declared grade must be A or B, or left blank if not yet graded." });
  }

  try {
    const imageUrl = `/uploads/stalls/${req.file.filename}`;
    await Stall.createRequest(vendorId, {
      centreId,
      stallName: stallName.trim(),
      unitNumber: unitNumber.trim(),
      description: description ? description.trim() : null,
      operatingHours: openingTime + " - " + closingTime,
      hygieneGrade: hygieneGrade || null,
      imageUrl
    });
    res.status(201).json({ message: "Request sent. An operator will review it soon." });
  } catch (err) {
    console.error("Error creating request:", err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ message: err.message });
  }
}

// GET the Store Detail page: stall info, owner info, order stats, top sellers, menu
async function getStallDetail(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  try {
    const stall = await Stall.getStallForVendor(vendorId, stallId);
    if (!stall) return res.status(404).json({ message: "Store not found." });

    const [stats, topItems, menu, stock, target, promotions, vouchers] = await Promise.all([
      Stall.getStallStats(stallId),
      Stall.getTopSellingItems(stallId),
      Stall.getStallMenu(stallId),
      Stall.getStallStock(stallId),
      Stall.getMonthlyTarget(stallId),
      Promotion.getPromotionsByStall(stallId),
      Voucher.getVouchersByStall(stallId)
    ]);

    res.json({ ...stall, ...stats, topItems, menu, stock, target, promotions, vouchers });
  } catch (err) {
    console.error("Error fetching store detail:", err);
    res.status(500).json({ message: err.message });
  }
}

async function deleteStall(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  try {
    const result = await Stall.deleteStall(vendorId, stallId);
    if (result === "not found") return res.status(404).json({ message: "Store not found." });
    res.json({ message: "Store deleted." });
  } catch (err) {
    console.error("Error deleting store:", err);
    res.status(500).json({ message: err.message });
  }
}

async function addMenuItem(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  const { itemName, price, category, description } = req.body;

  if (!itemName || !price) {
    return res.status(400).json({ message: "Item name and price are required." });
  }

  try {
    await Stall.addMenuItem(vendorId, stallId, {
      itemName: itemName.trim(),
      price,
      category: category ? category.trim() : null,
      description: description ? description.trim() : null
    });
    res.status(201).json({ message: "Menu item added." });
  } catch (err) {
    console.error("Error adding menu item:", err);
    res.status(500).json({ message: err.message });
  }
}

async function updateMenuItem(req, res) {
  const { stallId, menuId } = req.params;
  const { itemName, price, category, description, available } = req.body;

  if (!itemName || !price) {
    return res.status(400).json({ message: "Item name and price are required." });
  }

  try {
    const updated = await Stall.updateMenuItem(stallId, menuId, {
      itemName: itemName.trim(),
      price,
      category: category ? category.trim() : null,
      description: description ? description.trim() : null,
      available
    });
    if (!updated) return res.status(404).json({ message: "Menu item not found." });
    res.json({ message: "Menu item updated." });
  } catch (err) {
    console.error("Error updating menu item:", err);
    res.status(500).json({ message: err.message });
  }
}

async function deleteMenuItem(req, res) {
  const { stallId, menuId } = req.params;
  try {
    const deleted = await Stall.deleteMenuItem(stallId, menuId);
    if (!deleted) return res.status(404).json({ message: "Menu item not found." });
    res.json({ message: "Menu item removed." });
  } catch (err) {
    console.error("Error deleting menu item:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- Track Inventory (stock items) ----------

async function addStockItem(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  const { itemName, quantity, unit, category, description } = req.body;

  if (!itemName || quantity === undefined || quantity === null || quantity === "") {
    return res.status(400).json({ message: "Item name and quantity are required." });
  }

  try {
    await Stall.addStockItem(vendorId, stallId, {
      itemName: itemName.trim(),
      quantity,
      unit: unit ? unit.trim() : null,
      category: category ? category.trim() : null,
      description: description ? description.trim() : null
    });
    res.status(201).json({ message: "Stock item added." });
  } catch (err) {
    console.error("Error adding stock item:", err);
    res.status(500).json({ message: err.message });
  }
}

async function updateStockItem(req, res) {
  const { stallId, stockItemId } = req.params;
  const { itemName, quantity, unit, category, description, inStock } = req.body;

  if (!itemName || quantity === undefined || quantity === null || quantity === "") {
    return res.status(400).json({ message: "Item name and quantity are required." });
  }

  try {
    const updated = await Stall.updateStockItem(stallId, stockItemId, {
      itemName: itemName.trim(),
      quantity,
      unit: unit ? unit.trim() : null,
      category: category ? category.trim() : null,
      description: description ? description.trim() : null,
      inStock
    });
    if (!updated) return res.status(404).json({ message: "Stock item not found." });
    res.json({ message: "Stock item updated." });
  } catch (err) {
    console.error("Error updating stock item:", err);
    res.status(500).json({ message: err.message });
  }
}

async function deleteStockItem(req, res) {
  const { stallId, stockItemId } = req.params;
  try {
    const deleted = await Stall.deleteStockItem(stallId, stockItemId);
    if (!deleted) return res.status(404).json({ message: "Stock item not found." });
    res.json({ message: "Stock item removed." });
  } catch (err) {
    console.error("Error deleting stock item:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- Monthly Target ----------

const TARGET_TYPES = ["revenue", "orders", "items", "customers"];

async function setMonthlyTarget(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  const { targetType, targetValue } = req.body;

  if (!TARGET_TYPES.includes(targetType) || !targetValue || Number(targetValue) <= 0) {
    return res.status(400).json({ message: "A valid target type and a target value greater than 0 are required." });
  }

  try {
    await Stall.setMonthlyTarget(vendorId, stallId, { targetType, targetValue });
    const target = await Stall.getMonthlyTarget(stallId);
    res.json({ message: "Monthly target saved.", target });
  } catch (err) {
    console.error("Error saving monthly target:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- Rental Agreement (vendor side) ----------

function rentalStatus(agreement) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(agreement.AgreementStartDate);
  const end = new Date(agreement.AgreementEndDate);
  if (start > today) return "Upcoming";
  if (end < today) return "Expired";
  return "Active";
}

// GET the current + upcoming agreement (if a renewal has been approved) for a stall
async function getStallRental(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  try {
    const stall = await Stall.getStallForVendor(vendorId, stallId);
    if (!stall) return res.status(404).json({ message: "Store not found." });

    const agreements = await RentalAgreement.getAgreementsByStall(stallId);
    const today = new Date();
    const current = agreements.find(a => new Date(a.AgreementStartDate) <= today && new Date(a.AgreementEndDate) >= today) || null;
    const upcoming = agreements
      .filter(a => new Date(a.AgreementStartDate) > today)
      .sort((a, b) => new Date(a.AgreementStartDate) - new Date(b.AgreementStartDate))[0] || null;

    const pendingRenewal = current ? await RentalRenewal.hasPendingRenewal(current.AgreementId) : false;

    res.json({ current, upcoming, pendingRenewal });
  } catch (err) {
    console.error("Error fetching stall rental:", err);
    res.status(500).json({ message: err.message });
  }
}

// GET this stall's customer reviews - vendor-only, so a review a customer leaves
async function getStallReviews(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  try {
    const stall = await Stall.getStallForVendor(vendorId, stallId);
    if (!stall) return res.status(404).json({ message: "Store not found." });

    const [summary, reviews] = await Promise.all([
      Review.getStallSummary(stallId),
      Review.findByStall(stallId)
    ]);

    res.json({ summary, reviews });
  } catch (err) {
    console.error("Error fetching stall reviews:", err);
    res.status(500).json({ message: err.message });
  }
}

// GET every rental agreement this stall has, most recent first
async function getStallRentalHistory(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  try {
    const stall = await Stall.getStallForVendor(vendorId, stallId);
    if (!stall) return res.status(404).json({ message: "Store not found." });

    const agreements = await RentalAgreement.getAgreementsByStall(stallId);
    res.json(agreements.map(a => ({ ...a, status: rentalStatus(a) })));
  } catch (err) {
    console.error("Error fetching rental history:", err);
    res.status(500).json({ message: err.message });
  }
}

// POST a renewal request for this stall's current agreement
async function requestRentalRenewal(req, res) {
  const vendorId = req.params.id;
  const { stallId } = req.params;
  try {
    const stall = await Stall.getStallForVendor(vendorId, stallId);
    if (!stall) return res.status(404).json({ message: "Store not found." });

    const agreements = await RentalAgreement.getAgreementsByStall(stallId);
    const today = new Date();
    const current = agreements.find(a => new Date(a.AgreementStartDate) <= today && new Date(a.AgreementEndDate) >= today);
    if (!current) return res.status(400).json({ message: "There's no active rental agreement to renew." });

    const upcoming = agreements.some(a => new Date(a.AgreementStartDate) > today);
    if (upcoming) return res.status(400).json({ message: "An upcoming agreement already exists for this stall." });

    if (await RentalRenewal.hasPendingRenewal(current.AgreementId)) {
      return res.status(400).json({ message: "A renewal request is already pending review." });
    }

    await RentalRenewal.createRenewalRequest(current.AgreementId, stallId, vendorId);
    res.status(201).json({ message: "Renewal request sent. Your operator will review it soon." });
  } catch (err) {
    console.error("Error requesting rental renewal:", err);
    res.status(500).json({ message: err.message });
  }
}

// GET a PDF of the stall's agreements (current, upcoming, or past)
async function downloadRentalAgreementPdf(req, res) {
  const vendorId = req.params.id;
  const { stallId, agreementId } = req.params;
  try {
    const stall = await Stall.getStallForVendor(vendorId, stallId);
    if (!stall) return res.status(404).json({ message: "Store not found." });

    const agreement = await RentalAgreement.getRentalAgreementById(agreementId);
    if (!agreement || String(agreement.StallId) !== String(stallId)) {
      return res.status(404).json({ message: "Rental agreement not found for this store." });
    }

    streamAgreementPdf(res, agreement, stall.stallName);
  } catch (err) {
    console.error("Error generating rental agreement PDF:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- Operator side ----------

// GET requests waiting for a decision
async function getPendingRequests(req, res) {
  try {
    const requests = await Stall.getPendingRequests();
    res.json(requests);
  } catch (err) {
    console.error("Error fetching pending requests:", err);
    res.status(500).json({ message: err.message });
  }
}

// Give the right response
function sendResult(res, result, okMessage) {
  if (result === "not found") return res.status(404).json({ message: "Request not found." });
  if (result === "already reviewed") return res.status(400).json({ message: "This request was already reviewed." });
  if (result === "unit taken") return res.status(400).json({ message: "That unit number is already used in this hawker centre." });
  res.json({ message: okMessage });
}

async function approveRequest(req, res) {
  const { rentalPrice } = req.body;
  if (!rentalPrice || Number(rentalPrice) <= 0) {
    return res.status(400).json({ message: "A monthly rental rate is required to approve this request." });
  }

  try {
    const result = await Stall.approveRequest(req.params.requestId, req.user.id, rentalPrice);
    sendResult(res, result, "Request approved. The stall and a 6-month rental agreement have been created.");
  } catch (err) {
    console.error("Error approving request:", err);
    res.status(500).json({ message: err.message });
  }
}

async function rejectRequest(req, res) {
  try {
    const note = req.body.reviewNote ? req.body.reviewNote.trim() : null;
    const result = await Stall.rejectRequest(req.params.requestId, note);
    sendResult(res, result, "Request rejected.");
  } catch (err) {
    console.error("Error rejecting request:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- Rental Renewals (operator side) ----------

function sendRenewalResult(res, result, okMessage) {
  if (result === "not found") return res.status(404).json({ message: "Renewal request not found." });
  if (result === "already reviewed") return res.status(400).json({ message: "This renewal request was already reviewed." });
  res.json({ message: okMessage });
}

async function getPendingRenewals(req, res) {
  try {
    const requests = await RentalRenewal.getPendingRenewalRequests();
    res.json(requests);
  } catch (err) {
    console.error("Error fetching pending renewals:", err);
    res.status(500).json({ message: err.message });
  }
}

async function approveRenewal(req, res) {
  const { rentalPrice } = req.body;
  if (!rentalPrice || Number(rentalPrice) <= 0) {
    return res.status(400).json({ message: "A monthly rental rate is required to approve this renewal." });
  }

  try {
    const result = await RentalRenewal.approveRenewalRequest(req.params.renewalId, req.user.id, rentalPrice);
    sendRenewalResult(res, result, "Renewal approved. The vendor now has an upcoming rental agreement.");
  } catch (err) {
    console.error("Error approving renewal:", err);
    res.status(500).json({ message: err.message });
  }
}

async function rejectRenewal(req, res) {
  try {
    const note = req.body.reviewNote ? req.body.reviewNote.trim() : null;
    const result = await RentalRenewal.rejectRenewalRequest(req.params.renewalId, req.user.id, note);
    sendRenewalResult(res, result, "Renewal rejected.");
  } catch (err) {
    console.error("Error rejecting renewal:", err);
    res.status(500).json({ message: err.message });
  }
}

// ---------- My Children (operator side) ----------

// GET every stall this operator has personally approved
async function getMyChildren(req, res) {
  try {
    const stalls = await Stall.getStallsByOperator(req.user.id);
    res.json(stalls);
  } catch (err) {
    console.error("Error fetching operator's stalls:", err);
    res.status(500).json({ message: err.message });
  }
}

// GET one child stall's full detail, including its real order stats — reuses the
// same Stall.getStallStats/getTopSellingItems the vendor dashboard already relies on
async function getChildDetail(req, res) {
  const { stallId } = req.params;
  try {
    const stall = await Stall.getStallForOperator(req.user.id, stallId);
    if (!stall) return res.status(404).json({ message: "Stall not found, or you did not approve it." });

    const stats = await Stall.getStallStats(stallId);
    const topItems = await Stall.getTopSellingItems(stallId);
    res.json({ ...stall, stats, topItems });
  } catch (err) {
    console.error("Error fetching child stall detail:", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getCentres,
  getMyStalls,
  createRequest,
  getStallDetail,
  deleteStall,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  addStockItem,
  updateStockItem,
  deleteStockItem,
  setMonthlyTarget,
  getStallRental,
  getStallRentalHistory,
  getStallReviews,
  requestRentalRenewal,
  downloadRentalAgreementPdf,
  getPendingRequests,
  approveRequest,
  rejectRequest,
  getPendingRenewals,
  approveRenewal,
  rejectRenewal,
  getMyChildren,
  getChildDetail
};
