const sql = require('mssql');
const dbConfig = require('../dbConfig');

const FACILITY_TAGS = ['Cleanliness', 'Seating', 'Toilets', 'Ventilation', 'Queue', 'Other'];

class HawkerFeedbackModel {
    static get FACILITY_TAGS() {
        return FACILITY_TAGS;
    }

    static async submitFeedback({ hawkerId, customerId, rating, facilityTag, comment }) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('HawkerId', sql.Int, hawkerId)
            .input('CustomerId', sql.Int, customerId)
            .input('Rating', sql.Int, rating)
            .input('FacilityTag', sql.NVarChar(30), facilityTag)
            .input('Comment', sql.NVarChar(sql.MAX), comment || null)
            .query(`
                INSERT INTO HawkerFeedback (HawkerId, CustomerId, Rating, FacilityTag, Comment)
                VALUES (@HawkerId, @CustomerId, @Rating, @FacilityTag, @Comment);
                SELECT SCOPE_IDENTITY() AS FeedbackId;
            `);

        return result.recordset[0].FeedbackId;
    }

    static async hawkerExists(hawkerId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('HawkerId', sql.Int, hawkerId)
            .query('SELECT 1 FROM HawkerCentres WHERE centreId = @HawkerId');

        return result.recordset.length > 0;
    }

    static async findByCustomer(customerId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('CustomerId', sql.Int, customerId)
            .query(`
                SELECT
                    hf.FeedbackId AS feedback_id,
                    hf.HawkerId AS hawker_id,
                    h.centreName AS hawker_name,
                    hf.Rating AS rating,
                    hf.FacilityTag AS facility_tag,
                    hf.Comment AS comment,
                    hf.CreatedAt AS created_at
                FROM HawkerFeedback hf
                JOIN HawkerCentres h ON h.centreId = hf.HawkerId
                WHERE hf.CustomerId = @CustomerId
                ORDER BY hf.CreatedAt DESC
            `);

        return result.recordset;
    }
}

module.exports = HawkerFeedbackModel;
