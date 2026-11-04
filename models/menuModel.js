const sql = require('mssql');
const dbConfig = require('../dbConfig');
const PromotionModel = require('./promotionModel');

class MenuModel {
    static async findByStallId(stallId, hawkerId = null) {
        const pool = await sql.connect(dbConfig);

        let query = `
            SELECT
                m.menuId AS menu_id,
                m.stallId AS stall_id,
                s.centreId AS hawker_id,
                m.itemName AS item_name,
                m.category,
                m.price,
                m.available AS is_available,
                s.stallName AS stall_name
            FROM Menus m
            JOIN Stalls s ON m.stallId = s.stallId
            WHERE m.stallId = @stallId AND m.available = 1
        `;

        if (hawkerId) {
            query += ` AND s.centreId = @hawkerId`;
        }

        query += ` ORDER BY m.category, m.itemName`;

        const request = pool.request();
        request.input('stallId', sql.Int, stallId);
        if (hawkerId) {
            request.input('hawkerId', sql.Int, hawkerId);
        }

        try {
            const result = await request.query(query);
            const items = result.recordset;
            if (items.length === 0) return items;

            const activePromotions = await PromotionModel.getActivePromotionsForStall(stallId);
            if (activePromotions.length === 0) return items;

            return items.map(item =>
                PromotionModel.applyPromotionPricing({ ...item, menuId: item.menu_id }, activePromotions)
            );
        } catch (error) {
            console.error('Database error in findByStallId:', error.message);
            throw new Error('Database error occurred');
        }
    }

    static async findById(menuId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('menuId', sql.Int, menuId)
            .query(`
                SELECT
                    m.menuId AS menu_id,
                    m.stallId AS stall_id,
                    s.centreId AS hawker_id,
                    m.itemName AS item_name,
                    m.category,
                    m.price,
                    m.available AS is_available
                FROM Menus m
                LEFT JOIN Stalls s ON m.stallId = s.stallId
                WHERE m.menuId = @menuId
            `);

        return result.recordset[0] || null;
    }

    static async findByCompositeKey(hawkerId, stallId, menuId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('hawkerId', sql.Int, hawkerId)
            .input('stallId', sql.Int, stallId)
            .input('menuId', sql.Int, menuId)
            .query(`
                SELECT
                    m.menuId AS menu_id,
                    m.stallId AS stall_id,
                    s.centreId AS hawker_id,
                    m.itemName AS item_name,
                    m.category,
                    m.price,
                    m.available AS is_available
                FROM Menus m
                JOIN Stalls s ON m.stallId = s.stallId
                WHERE s.centreId = @hawkerId
                  AND m.stallId = @stallId
                  AND m.menuId = @menuId
            `);

        const menuItem = result.recordset[0];
        if (!menuItem) return null;

        // Authoritative price for order creation: apply any active promotion here too,
        // so what the customer is charged always matches what they were shown.
        const activePromotions = await PromotionModel.getActivePromotionsForStall(stallId);
        if (activePromotions.length === 0) return menuItem;

        return PromotionModel.applyPromotionPricing({ ...menuItem, menuId: menuItem.menu_id }, activePromotions);
    }
}

module.exports = MenuModel;
