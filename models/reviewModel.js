const sql = require('mssql');
const dbConfig = require('../dbConfig');
const NotificationModel = require('./notificationModel');

const REVIEWABLE_STATUSES = ['pending', 'preparing', 'ready', 'completed'];

class ReviewModel {
    // A review must be tied to a real order that (a) belongs to this customer and
    // (b) was not cancelled — you can't review a stall you never actually bought from.
    static async create({ order_id, stall_id, customer_id, rating, comment }) {
        const pool = await sql.connect(dbConfig);

        const orderResult = await pool.request()
            .input('orderId', sql.Int, order_id)
            .query(`
                SELECT o.orderId, o.customerId, o.status, o.customerName, o.stallId, s.vendorId, s.stallName
                FROM Orders o
                JOIN Stalls s ON s.stallId = o.stallId
                WHERE o.orderId = @orderId
            `);

        if (orderResult.recordset.length === 0) {
            const err = new Error('Order not found');
            err.statusCode = 404;
            throw err;
        }

        const order = orderResult.recordset[0];

        if (Number(order.customerId) !== Number(customer_id)) {
            const err = new Error('You can only review your own orders');
            err.statusCode = 403;
            throw err;
        }

        if (!REVIEWABLE_STATUSES.includes(order.status)) {
            const err = new Error('A cancelled order cannot be reviewed');
            err.statusCode = 400;
            throw err;
        }

        if (stall_id != null && Number(stall_id) !== Number(order.stallId)) {
            const err = new Error('That order has nothing from this stall');
            err.statusCode = 400;
            throw err;
        }

        if (order.stallId == null) {
            const err = new Error('That order is not linked to a stall, so it cannot be reviewed');
            err.statusCode = 400;
            throw err;
        }

        const existing = await pool.request()
            .input('orderId', sql.Int, order_id)
            .query('SELECT reviewId FROM StallReviews WHERE orderId = @orderId');

        if (existing.recordset.length > 0) {
            const err = new Error('You have already reviewed this order');
            err.statusCode = 409;
            throw err;
        }

        const result = await pool.request()
            .input('orderId', sql.Int, order_id)
            .input('stallId', sql.Int, order.stallId)
            .input('customerId', sql.Int, customer_id)
            .input('customerName', sql.NVarChar(100), order.customerName || null)
            .input('rating', sql.Int, rating)
            .input('comment', sql.NVarChar(1000), comment || null)
            .query(`
                INSERT INTO StallReviews (orderId, stallId, customerId, customerName, rating, comment)
                VALUES (@orderId, @stallId, @customerId, @customerName, @rating, @comment);
                SELECT SCOPE_IDENTITY() AS review_id;
            `);

        const reviewId = result.recordset[0].review_id;

        if (order.vendorId) {
            await NotificationModel.createNotification(
                order.vendorId, 'review',
                'New customer review',
                `${order.stallName}: ${rating}★ review from ${order.customerName || 'a customer'} on order #${order_id}.`,
                'storeDetail.html?stallId=' + order.stallId,
                'review', reviewId
            );
        }

        return reviewId;
    }

    static async findByStall(stallId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('stallId', sql.Int, stallId)
            .query(`
                SELECT
                    reviewId AS review_id,
                    orderId AS order_id,
                    stallId AS stall_id,
                    customerId AS customer_id,
                    customerName AS customer_name,
                    rating,
                    comment,
                    createdAt AS created_at
                FROM StallReviews
                WHERE stallId = @stallId
                ORDER BY createdAt DESC
            `);

        return result.recordset;
    }

    static async getStallSummary(stallId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('stallId', sql.Int, stallId)
            .query(`
                SELECT
                    COUNT(*) AS review_count,
                    AVG(CAST(rating AS DECIMAL(3,2))) AS average_rating
                FROM StallReviews
                WHERE stallId = @stallId
            `);

        const row = result.recordset[0];
        return {
            stall_id: Number(stallId),
            review_count: row.review_count || 0,
            average_rating: row.average_rating ? Math.round(row.average_rating * 10) / 10 : null
        };
    }

    static async findByCustomer(customerId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT orderId AS order_id, reviewId AS review_id, rating, comment, createdAt AS created_at
                FROM StallReviews
                WHERE customerId = @customerId
            `);

        return result.recordset;
    }

    // Rating and comment only — orderId and stallId are what tie a review to a real order.
    // Ownership is in the WHERE, so another customer's review matches no row.
    static async findByOrderForCustomer(orderId, customerId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('orderId', sql.Int, orderId)
            .input('customerId', sql.Int, customerId)
            .query(`
                SELECT
                    reviewId AS FeedbackId,
                    orderId AS OrderId,
                    stallId AS StallId,
                    rating AS FeedbackRating,
                    comment AS FeedbackComment,
                    createdAt AS FeedbackDateTime,
                    CAST(NULL AS DATETIME) AS FeedbackUpdatedAt
                FROM StallReviews
                WHERE orderId = @orderId AND customerId = @customerId
            `);

        return result.recordset;
    }

    static async updateOwn(reviewId, customerId, { rating, comment }) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('reviewId', sql.Int, reviewId)
            .input('customerId', sql.Int, customerId)
            .input('rating', sql.Int, rating)
            .input('comment', sql.NVarChar(1000), comment || null)
            .query(`
                UPDATE StallReviews
                SET rating = @rating, comment = @comment
                WHERE reviewId = @reviewId AND customerId = @customerId
            `);

        return result.rowsAffected[0] > 0;
    }

    static async deleteOwn(reviewId, customerId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('reviewId', sql.Int, reviewId)
            .input('customerId', sql.Int, customerId)
            .query('DELETE FROM StallReviews WHERE reviewId = @reviewId AND customerId = @customerId');

        return result.rowsAffected[0] > 0;
    }
}

module.exports = ReviewModel;
