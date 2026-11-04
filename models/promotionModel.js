const sql = require("mssql");

// ---------- Vendor CRUD (Add Promotion page) ----------

async function getPromotionsByStall(stallId) {
  const result = await sql.query`
    SELECT promotionId, name, description, discountType, discountValue,
           scopeType, scopeCategory, isActive, startDate, endDate,
           (
             SELECT menuId FROM PromotionItems pi WHERE pi.promotionId = p.promotionId
             FOR JSON PATH
           ) AS scopeMenuIds
    FROM Promotions p
    WHERE stallId = ${stallId}
    ORDER BY startDate DESC
  `;
  return result.recordset.map(promo => ({
    ...promo,
    scopeMenuIds: promo.scopeMenuIds ? JSON.parse(promo.scopeMenuIds).map(r => r.menuId) : []
  }));
}

// Only links items that actually belong to this stall's menu
async function setPromotionItems(promotionId, stallId, menuIds) {
  await sql.query`DELETE FROM PromotionItems WHERE promotionId = ${promotionId}`;
  if (!menuIds || menuIds.length === 0) return;

  for (const menuId of menuIds) {
    await sql.query`
      INSERT INTO PromotionItems (promotionId, menuId)
      SELECT ${promotionId}, ${menuId}
      WHERE EXISTS (SELECT 1 FROM Menus WHERE menuId = ${menuId} AND stallId = ${stallId})
    `;
  }
}

async function addPromotion(vendorId, stallId, data) {
  const result = await sql.query`
    INSERT INTO Promotions
      (vendorId, stallId, name, description, discountType, discountValue,
       scopeType, scopeCategory, isActive, startDate, endDate)
    VALUES
      (${vendorId}, ${stallId}, ${data.name}, ${data.description || null}, ${data.discountType}, ${data.discountValue},
       ${data.scopeType}, ${data.scopeCategory || null}, ${data.isActive ? 1 : 0},
       ${data.startDate}, ${data.endDate});
    SELECT SCOPE_IDENTITY() AS promotionId;
  `;
  const promotionId = result.recordset[0].promotionId;

  if (data.scopeType === "items") {
    await setPromotionItems(promotionId, stallId, data.scopeMenuIds);
  }
  return true;
}

async function updatePromotion(stallId, promotionId, data) {
  const result = await sql.query`
    UPDATE Promotions
    SET name = ${data.name}, description = ${data.description || null},
        discountType = ${data.discountType}, discountValue = ${data.discountValue},
        scopeType = ${data.scopeType}, scopeCategory = ${data.scopeCategory || null},
        isActive = ${data.isActive ? 1 : 0}, startDate = ${data.startDate}, endDate = ${data.endDate},
        updatedAt = GETDATE()
    WHERE promotionId = ${promotionId} AND stallId = ${stallId}
  `;
  if (result.rowsAffected[0] === 0) return false;

  await setPromotionItems(promotionId, stallId, data.scopeType === "items" ? data.scopeMenuIds : []);
  return true;
}

async function deletePromotion(stallId, promotionId) {
  await sql.query`DELETE FROM PromotionItems WHERE promotionId = ${promotionId}`;
  // Past order items keep their history; they just lose the promotion reference.
  await sql.query`UPDATE OrderItems SET promotionId = NULL WHERE promotionId = ${promotionId}`;

  const result = await sql.query`
    DELETE FROM Promotions WHERE promotionId = ${promotionId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0;
}

// ---------- Customer-facing pricing ----------

// Promotions that are switched on and inside their date window, right now
async function getActivePromotionsForStall(stallId) {
  const result = await sql.query`
    SELECT promotionId, name, description, discountType, discountValue, scopeType, scopeCategory,
           isActive, startDate, endDate,
           (
             SELECT menuId FROM PromotionItems pi WHERE pi.promotionId = p.promotionId
             FOR JSON PATH
           ) AS scopeMenuIds
    FROM Promotions p
    WHERE stallId = ${stallId} AND isActive = 1
      AND CAST(startDate AS DATE) <= CAST(GETDATE() AS DATE)
      AND CAST(endDate AS DATE) >= CAST(GETDATE() AS DATE)
  `;
  return result.recordset.map(promo => ({
    ...promo,
    scopeMenuIds: promo.scopeMenuIds ? JSON.parse(promo.scopeMenuIds).map(r => r.menuId) : []
  }));
}

// Finds the best-matching active promotion for one menu item
function findBestPromotion(menuItem, activePromotions) {
  const priority = { items: 3, category: 2, all: 1 };
  let best = null;
  let bestDiscount = -1;

  for (const promo of activePromotions) {
    const matches =
      (promo.scopeType === "items" && promo.scopeMenuIds.map(Number).includes(Number(menuItem.menuId))) ||
      (promo.scopeType === "category" && promo.scopeCategory && menuItem.category &&
        promo.scopeCategory.toLowerCase() === menuItem.category.toLowerCase()) ||
      promo.scopeType === "all";
    if (!matches) continue;

    const discountAmount = promo.discountType === "percentage"
      ? (Number(menuItem.price) * Number(promo.discountValue)) / 100
      : Number(promo.discountValue);

    if (
      !best ||
      priority[promo.scopeType] > priority[best.scopeType] ||
      (priority[promo.scopeType] === priority[best.scopeType] && discountAmount > bestDiscount)
    ) {
      best = promo;
      bestDiscount = discountAmount;
    }
  }

  return best;
}

// Attaches original_price/price/discount_percent/promotion_name to a menu item
// when an active promotion applies; leaves it untouched otherwise.
function applyPromotionPricing(menuItem, activePromotions) {
  const originalPrice = Number(menuItem.price);
  const promo = findBestPromotion(menuItem, activePromotions);
  if (!promo) return menuItem;

  const discountAmount = promo.discountType === "percentage"
    ? (originalPrice * Number(promo.discountValue)) / 100
    : Number(promo.discountValue);
  const discountedPrice = Math.max(0, Math.round((originalPrice - discountAmount) * 100) / 100);
  const discountPercent = Math.round((1 - discountedPrice / originalPrice) * 100);

  return {
    ...menuItem,
    price: discountedPrice,
    original_price: originalPrice,
    discount_percent: discountPercent,
    promotion_id: promo.promotionId,
    promotion_name: promo.name
  };
}

module.exports = {
  getPromotionsByStall,
  addPromotion,
  updatePromotion,
  deletePromotion,
  getActivePromotionsForStall,
  applyPromotionPricing
};
