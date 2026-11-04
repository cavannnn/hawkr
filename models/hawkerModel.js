const sql = require('mssql');
const dbConfig = require('../dbConfig');

class HawkerModel {
    static async findAll() {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .query(`
                SELECT
                    h.centreId AS hawker_id,
                    h.centreName AS name,
                    h.address,
                    h.postalCode AS postal_code,
                    h.operatingHours AS operating_hours,
                    h.isActive AS is_active,
                    (
                        SELECT
                            s.stallId AS stall_id,
                            s.stallName AS stall_name,
                            s.imageUrl AS image_url,
                            s.unitNumber AS stall_number,
                            s.cuisineType AS cuisine_type,
                            s.description,
                            s.contactNumber AS contact_number,
                            s.isActive AS is_active,
                            (
                                SELECT
                                    m.menuId AS menu_id,
                                    m.itemName AS item_name,
                                    m.category,
                                    m.price,
                                    m.available AS is_available,
                                    h.centreId AS hawker_id,
                                    s.stallId AS stall_id
                                FROM Menus m
                                WHERE m.stallId = s.stallId AND m.available = 1
                                FOR JSON PATH
                            ) AS menu_items
                        FROM Stalls s
                        WHERE s.centreId = h.centreId AND s.isActive = 1
                        FOR JSON PATH
                    ) AS stalls
                FROM HawkerCentres h
                WHERE h.isActive = 1
                ORDER BY h.centreName
            `);

        return result.recordset.map(hawker => ({
            ...hawker,
            stalls: hawker.stalls ? JSON.parse(hawker.stalls) : []
        }));
    }

    static async findById(hawkerId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('hawkerId', sql.Int, hawkerId)
            .query(`
                SELECT
                    h.centreId AS hawker_id,
                    h.centreName AS name,
                    h.address,
                    h.postalCode AS postal_code,
                    h.operatingHours AS operating_hours,
                    h.isActive AS is_active,
                    (
                        SELECT
                            s.stallId AS stall_id,
                            s.stallName AS stall_name,
                            s.imageUrl AS image_url,
                            s.unitNumber AS stall_number,
                            s.cuisineType AS cuisine_type,
                            s.description,
                            s.contactNumber AS contact_number,
                            s.isActive AS is_active,
                            (
                                SELECT
                                    m.menuId AS menu_id,
                                    m.itemName AS item_name,
                                    m.category,
                                    m.price,
                                    m.available AS is_available,
                                    h.centreId AS hawker_id,
                                    s.stallId AS stall_id
                                FROM Menus m
                                WHERE m.stallId = s.stallId AND m.available = 1
                                FOR JSON PATH
                            ) AS menu_items
                        FROM Stalls s
                        WHERE s.centreId = h.centreId AND s.isActive = 1
                        FOR JSON PATH
                    ) AS stalls
                FROM HawkerCentres h
                WHERE h.centreId = @hawkerId AND h.isActive = 1
            `);

        if (result.recordset.length === 0) {
            return null;
        }

        return {
            ...result.recordset[0],
            stalls: result.recordset[0].stalls ? JSON.parse(result.recordset[0].stalls) : []
        };
    }
}

module.exports = HawkerModel;
