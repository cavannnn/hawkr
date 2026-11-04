const sql = require("mssql");

// Searches everything this vendor owns: stalls, menu items, stock items,
// promotions, vouchers, and orders. Every result carries a page to jump to.
async function search(vendorId, query) {
  const like = "%" + query + "%";
  const results = [];

  const stalls = await sql.query`
    SELECT stallId, stallName, unitNumber FROM Stalls
    WHERE vendorId = ${vendorId} AND (stallName LIKE ${like} OR unitNumber LIKE ${like})
  `;
  stalls.recordset.forEach(s => results.push({
    type: "Stall", label: s.stallName, sublabel: "Unit " + s.unitNumber,
    url: "storeDetail.html?stallId=" + s.stallId
  }));

  const menu = await sql.query`
    SELECT m.menuId, m.itemName, m.stallId, s.stallName FROM Menus m
    JOIN Stalls s ON s.stallId = m.stallId
    WHERE m.vendorId = ${vendorId} AND m.itemName LIKE ${like}
  `;
  menu.recordset.forEach(m => results.push({
    type: "Menu Item", label: m.itemName, sublabel: m.stallName,
    url: "storeMenu.html?stallId=" + m.stallId
  }));

  const stock = await sql.query`
    SELECT si.stockItemId, si.itemName, si.stallId, s.stallName FROM StockItems si
    JOIN Stalls s ON s.stallId = si.stallId
    WHERE si.vendorId = ${vendorId} AND si.itemName LIKE ${like}
  `;
  stock.recordset.forEach(i => results.push({
    type: "Stock Item", label: i.itemName, sublabel: i.stallName,
    url: "storeStock.html?stallId=" + i.stallId
  }));

  const promotions = await sql.query`
    SELECT p.promotionId, p.name, p.stallId, s.stallName FROM Promotions p
    JOIN Stalls s ON s.stallId = p.stallId
    WHERE p.vendorId = ${vendorId} AND p.name LIKE ${like}
  `;
  promotions.recordset.forEach(p => results.push({
    type: "Promotion", label: p.name, sublabel: p.stallName,
    url: "storePromotions.html?stallId=" + p.stallId
  }));

  const vouchers = await sql.query`
    SELECT v.voucherId, v.code, v.stallId, s.stallName FROM Vouchers v
    JOIN Stalls s ON s.stallId = v.stallId
    WHERE v.vendorId = ${vendorId} AND v.code LIKE ${like}
  `;
  vouchers.recordset.forEach(v => results.push({
    type: "Voucher", label: v.code, sublabel: v.stallName,
    url: "storePromotions.html?stallId=" + v.stallId
  }));

  const orders = await sql.query`
    SELECT TOP 10 o.orderId, o.customerName, s.stallId, s.stallName FROM Orders o
    JOIN Stalls s ON s.stallId = o.stallId
    WHERE s.vendorId = ${vendorId} AND (o.customerName LIKE ${like} OR CAST(o.orderId AS NVARCHAR) LIKE ${like})
  `;
  orders.recordset.forEach(o => results.push({
    type: "Order", label: "Order #" + o.orderId, sublabel: (o.customerName || "Unknown customer") + " · " + o.stallName,
    url: "orders.html"
  }));

  return results;
}

module.exports = { search };
