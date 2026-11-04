const sql = require('mssql');
const dbConfig = require('../dbConfig');
const PromotionModel = require('./promotionModel');
const { pendingGradeFor } = require('../utils/grading');

// Applies any active promotion discount to each menu item's price
async function withPromotionPricing(stall) {
    if (!stall.menu_items || stall.menu_items.length === 0) return stall;
    const activePromotions = await PromotionModel.getActivePromotionsForStall(stall.stall_id);
    if (activePromotions.length === 0) return stall;

    return {
        ...stall,
        menu_items: stall.menu_items.map(item =>
            PromotionModel.applyPromotionPricing({ ...item, menuId: item.menu_id }, activePromotions)
        )
    };
}

class StallModel {
    static async findAll(filters = {}) {
        const { hawker_id } = filters;
        const pool = await sql.connect(dbConfig);

        let query = `
            SELECT
                s.stallId AS stall_id,
                s.centreId AS hawker_id,
                s.stallName AS stall_name,
                s.imageUrl AS image_url,
                s.unitNumber AS stall_number,
                s.cuisineType AS cuisine_type,
                s.description,
                s.contactNumber AS contact_number,
                s.isActive AS is_active,
                s.currentGrade AS nea_grade,
                s.performanceStartDate AS performance_start_date,
                h.centreName AS hawker_name,
                (
                    SELECT
                        m.menuId AS menu_id,
                        m.itemName AS item_name,
                        m.category,
                        m.price,
                        m.available AS is_available,
                        s.centreId AS hawker_id,
                        s.stallId AS stall_id
                    FROM Menus m
                    WHERE m.stallId = s.stallId AND m.available = 1
                    FOR JSON PATH
                ) AS menu_items
            FROM Stalls s
            JOIN HawkerCentres h ON s.centreId = h.centreId
            WHERE s.isActive = 1
        `;

        if (hawker_id) {
            query += ` AND s.centreId = @hawkerId`;
        }

        query += ` ORDER BY s.stallName`;

        const request = pool.request();
        if (hawker_id) {
            request.input('hawkerId', sql.Int, hawker_id);
        }

        const result = await request.query(query);

        const stalls = result.recordset.map(stall => ({
            ...stall,
            pending_grade: pendingGradeFor({
                neaGrade: stall.nea_grade,
                performanceStartDate: stall.performance_start_date
            }),
            menu_items: stall.menu_items ? JSON.parse(stall.menu_items) : []
        }));

        return Promise.all(stalls.map(withPromotionPricing));
    }

    static async findById(stallId, hawkerId = null) {
        const pool = await sql.connect(dbConfig);

        let query = `
            SELECT
                s.stallId AS stall_id,
                s.centreId AS hawker_id,
                s.stallName AS stall_name,
                s.imageUrl AS image_url,
                s.unitNumber AS stall_number,
                s.cuisineType AS cuisine_type,
                s.description,
                s.contactNumber AS contact_number,
                s.isActive AS is_active,
                s.currentGrade AS nea_grade,
                s.performanceStartDate AS performance_start_date,
                h.centreName AS hawker_name,
                (
                    SELECT
                        m.menuId AS menu_id,
                        m.itemName AS item_name,
                        m.category,
                        m.price,
                        m.available AS is_available,
                        s.centreId AS hawker_id,
                        s.stallId AS stall_id
                    FROM Menus m
                    WHERE m.stallId = s.stallId AND m.available = 1
                    FOR JSON PATH
                ) AS menu_items
            FROM Stalls s
            JOIN HawkerCentres h ON s.centreId = h.centreId
            WHERE s.stallId = @stallId AND s.isActive = 1
        `;

        if (hawkerId) {
            query += ` AND s.centreId = @hawkerId`;
        }

        const request = pool.request();
        request.input('stallId', sql.Int, stallId);
        if (hawkerId) {
            request.input('hawkerId', sql.Int, hawkerId);
        }

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return null;
        }

        const stall = {
            ...result.recordset[0],
            pending_grade: pendingGradeFor({
                neaGrade: result.recordset[0].nea_grade,
                performanceStartDate: result.recordset[0].performance_start_date
            }),
            menu_items: result.recordset[0].menu_items ? JSON.parse(result.recordset[0].menu_items) : []
        };

        return withPromotionPricing(stall);
    }

    static async findByCompositeKey(hawkerId, stallId) {
        return this.findById(stallId, hawkerId);
    }
}

module.exports = StallModel;
