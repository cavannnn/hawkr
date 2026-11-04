const sql = require('mssql');
const dbConfig = require('../dbConfig');

class FavoriteModel {
    static async toggleFavorite(userId, hawkerId, stallId = null, menuId = null) {
        const pool = await sql.connect(dbConfig);

        const checkResult = await pool.request()
            .input('userId', sql.Int, userId)
            .input('centreId', sql.Int, hawkerId)
            .input('stallId', sql.Int, stallId)
            .input('menuId', sql.Int, menuId)
            .query(`
                SELECT favoriteId FROM Favorites
                WHERE userId = @userId
                  AND centreId = @centreId
                  AND (stallId = @stallId OR (stallId IS NULL AND @stallId IS NULL))
                  AND (menuId = @menuId OR (menuId IS NULL AND @menuId IS NULL))
            `);

        if (checkResult.recordset.length > 0) {
            await pool.request()
                .input('favoriteId', sql.Int, checkResult.recordset[0].favoriteId)
                .query('DELETE FROM Favorites WHERE favoriteId = @favoriteId');

            return { favorited: false, action: 'removed' };
        } else {
            const result = await pool.request()
                .input('userId', sql.Int, userId)
                .input('centreId', sql.Int, hawkerId)
                .input('stallId', sql.Int, stallId)
                .input('menuId', sql.Int, menuId)
                .query(`
                    INSERT INTO Favorites (userId, centreId, stallId, menuId)
                    VALUES (@userId, @centreId, @stallId, @menuId);
                    SELECT SCOPE_IDENTITY() AS favorite_id;
                `);

            return {
                favorited: true,
                action: 'added',
                favorite_id: result.recordset[0].favorite_id
            };
        }
    }

    static async getUserFavorites(userId, type = null) {
        const pool = await sql.connect(dbConfig);

        let query = `
            SELECT
                f.favoriteId AS favorite_id,
                f.userId AS user_id,
                f.centreId AS hawker_id,
                f.stallId AS stall_id,
                f.menuId AS menu_id,
                f.createdAt AS created_at,
                h.centreName AS hawker_name,
                s.stallName AS stall_name,
                m.itemName AS menu_item_name,
                m.price AS menu_item_price,
                m.available AS menu_item_available
            FROM Favorites f
            JOIN HawkerCentres h ON f.centreId = h.centreId
            LEFT JOIN Stalls s ON f.stallId = s.stallId
            LEFT JOIN Menus m ON f.menuId = m.menuId
            WHERE f.userId = @userId
        `;

        if (type === 'hawker') {
            query += ` AND f.stallId IS NULL AND f.menuId IS NULL`;
        } else if (type === 'stall') {
            query += ` AND f.stallId IS NOT NULL AND f.menuId IS NULL`;
        } else if (type === 'menu') {
            query += ` AND f.menuId IS NOT NULL`;
        }

        query += ` ORDER BY f.createdAt DESC`;

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query(query);

        return result.recordset;
    }

    static async getFavoriteCounts(hawkerId, stallId = null, menuId = null) {
        const pool = await sql.connect(dbConfig);

        let query = `
            SELECT COUNT(*) AS favorite_count
            FROM Favorites
            WHERE centreId = @centreId
        `;

        if (stallId !== null && stallId !== undefined) {
            query += ` AND stallId = @stallId`;
        } else if (stallId === null) {
            query += ` AND stallId IS NULL`;
        }

        if (menuId !== null && menuId !== undefined) {
            query += ` AND menuId = @menuId`;
        } else if (menuId === null) {
            query += ` AND menuId IS NULL`;
        }

        const request = pool.request()
            .input('centreId', sql.Int, hawkerId);

        if (stallId !== null && stallId !== undefined) {
            request.input('stallId', sql.Int, stallId);
        }
        if (menuId !== null && menuId !== undefined) {
            request.input('menuId', sql.Int, menuId);
        }

        const result = await request.query(query);
        return result.recordset[0].favorite_count;
    }

    static async isFavorited(userId, hawkerId, stallId = null, menuId = null) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .input('centreId', sql.Int, hawkerId)
            .input('stallId', sql.Int, stallId)
            .input('menuId', sql.Int, menuId)
            .query(`
                SELECT favoriteId FROM Favorites
                WHERE userId = @userId
                  AND centreId = @centreId
                  AND (stallId = @stallId OR (stallId IS NULL AND @stallId IS NULL))
                  AND (menuId = @menuId OR (menuId IS NULL AND @menuId IS NULL))
            `);

        return result.recordset.length > 0;
    }

    static async deleteUserFavorites(userId, hawkerId = null, stallId = null, menuId = null) {
        const pool = await sql.connect(dbConfig);

        let query = `DELETE FROM Favorites WHERE userId = @userId`;
        const request = pool.request().input('userId', sql.Int, userId);

        if (hawkerId) {
            query += ` AND centreId = @centreId`;
            request.input('centreId', sql.Int, hawkerId);
        }
        if (stallId !== null && stallId !== undefined) {
            query += ` AND stallId = @stallId`;
            request.input('stallId', sql.Int, stallId);
        }
        if (menuId !== null && menuId !== undefined) {
            query += ` AND menuId = @menuId`;
            request.input('menuId', sql.Int, menuId);
        }

        const result = await request.query(query);
        return result.rowsAffected[0];
    }
}

module.exports = FavoriteModel;
