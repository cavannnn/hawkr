const sql = require('mssql');
const dbConfig = require('../dbConfig');
const MenuModel = require('./menuModel');
const StallModel = require('./customerStallModel');
const VoucherModel = require('./voucherModel');
const NotificationModel = require('./notificationModel');

class OrderModel {
    static async create(orderData) {
        try {
            console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

            const {
                stall_id,
                hawker_id,
                customer_id,
                customer_name,
                customer_phone,
                items,
                payment_method,
                special_instructions,
                voucher_code,
                round_up
            } = orderData;

            const pool = await sql.connect(dbConfig);

            // Validate stall exists
            const stall = await StallModel.findByCompositeKey(hawker_id, stall_id);
            if (!stall) {
                throw new Error(`Stall ${stall_id} not found in hawker ${hawker_id}`);
            }

            const stallRow = await pool.request()
                .input('stallId', sql.Int, stall_id)
                .query('SELECT vendorId FROM Stalls WHERE stallId = @stallId');
            const vendorId = stallRow.recordset[0] ? stallRow.recordset[0].vendorId : null;

            // Calculate total and validate items
            let totalAmount = 0;
            const orderItems = [];

            for (const item of items) {
                const menuItem = await MenuModel.findByCompositeKey(
                    hawker_id,
                    stall_id,
                    item.menu_id
                );

                if (!menuItem) {
                    throw new Error(`Menu item ${item.menu_id} not found in stall ${stall_id}`);
                }

                if (!menuItem.is_available) {
                    throw new Error(`Menu item "${menuItem.item_name}" is currently not available`);
                }

                // menuItem.price already reflects any active promotion (see MenuModel.findByCompositeKey)
                const subtotal = parseFloat(menuItem.price) * parseInt(item.quantity);
                totalAmount += subtotal;

                orderItems.push({
                    menu_id: parseInt(item.menu_id),
                    item_name: menuItem.item_name,
                    quantity: parseInt(item.quantity),
                    unit_price: parseFloat(menuItem.price),
                    original_unit_price: menuItem.original_price ? parseFloat(menuItem.original_price) : null,
                    promotion_id: menuItem.promotion_id || null,
                    subtotal: subtotal,
                    special_requests: item.special_requests || null
                });
            }

            // A voucher code must re-validate server-side; if it doesn't, the order is rejected
            // rather than silently placed without the discount the customer expected.
            let discountAmount = 0;
            let voucherId = null;
            if (voucher_code) {
                const voucherResult = await VoucherModel.validateVoucher(voucher_code, stall_id, totalAmount);
                if (!voucherResult.valid) {
                    const voucherError = new Error(voucherResult.message);
                    voucherError.statusCode = 400;
                    throw voucherError;
                }
                discountAmount = voucherResult.discountAmount;
                voucherId = voucherResult.voucher.voucherId;
            }
            const afterDiscount = Math.round((totalAmount - discountAmount) * 100) / 100;

            const requestedRoundUp = Math.round((Number(round_up) || 0) * 100) / 100;
            const maxRoundUp = Math.round((Math.ceil(afterDiscount) - afterDiscount) * 100) / 100;
            const roundUpAmount = requestedRoundUp > 0 ? Math.min(requestedRoundUp, maxRoundUp) : 0;

            const finalTotal = Math.round((afterDiscount + roundUpAmount) * 100) / 100;

            console.log('Order items:', orderItems);
            console.log('Total amount:', totalAmount, 'Discount:', discountAmount, 'Final:', finalTotal);

            // Insert order
            const orderResult = await pool.request()
                .input('stallId', sql.Int, parseInt(stall_id))
                .input('vendorId', sql.Int, vendorId)
                .input('customerId', sql.Int, customer_id || null)
                .input('customerName', sql.NVarChar(100), customer_name)
                .input('customerPhone', sql.NVarChar(20), customer_phone || null)
                .input('totalAmount', sql.Decimal(10, 2), finalTotal)
                .input('paymentMethod', sql.NVarChar(20), payment_method || 'cash')
                .input('specialInstructions', sql.NVarChar(500), special_instructions || null)
                .input('voucherId', sql.Int, voucherId)
                .input('discountAmount', sql.Decimal(10, 2), discountAmount)
                .input('roundUpAmount', sql.Decimal(10, 2), roundUpAmount)
                .query(`
                    INSERT INTO Orders (
                        stallId, vendorId, customerId, customerName, customerPhone,
                        totalAmount, paymentMethod, specialInstructions,
                        orderDate, status, paymentStatus, voucherId, discountAmount, roundUpAmount
                    ) VALUES (
                        @stallId, @vendorId, @customerId, @customerName, @customerPhone,
                        @totalAmount, @paymentMethod, @specialInstructions,
                        GETDATE(), 'pending', 'pending', @voucherId, @discountAmount, @roundUpAmount
                    );
                    SELECT SCOPE_IDENTITY() AS order_id;
                `);

            const orderId = orderResult.recordset[0].order_id;
            console.log('Order created with ID:', orderId);

            for (const item of orderItems) {
                console.log('Inserting order item:', item);
                await pool.request()
                    .input('orderId', sql.Int, orderId)
                    .input('menuId', sql.Int, item.menu_id)
                    .input('itemName', sql.NVarChar(200), item.item_name)
                    .input('quantity', sql.Int, item.quantity)
                    .input('unitPrice', sql.Decimal(10, 2), item.unit_price)
                    .input('subtotal', sql.Decimal(10, 2), item.subtotal)
                    .input('specialRequests', sql.NVarChar(500), item.special_requests)
                    .input('originalUnitPrice', sql.Decimal(10, 2), item.original_unit_price)
                    .input('promotionId', sql.Int, item.promotion_id)
                    .query(`
                        INSERT INTO OrderItems (
                            orderId, menuId, itemName, quantity, unitPrice, subtotal, specialRequests,
                            originalUnitPrice, promotionId
                        ) VALUES (
                            @orderId, @menuId, @itemName, @quantity, @unitPrice, @subtotal, @specialRequests,
                            @originalUnitPrice, @promotionId
                        )
                    `);
            }

            if (voucherId) {
                await VoucherModel.redeemVoucher(voucherId, orderId, discountAmount);
            }

            if (vendorId) {
                await NotificationModel.createNotification(
                    vendorId, "order",
                    "New order received",
                    `${stall.stall_name}: order #${orderId} from ${customer_name} (${orderItems.length} item${orderItems.length === 1 ? "" : "s"}).`,
                    "orders.html",
                    "order", orderId
                );
            }

            return orderId;
        } catch (error) {
            console.error('Error in OrderModel.create:', error);
            throw error;
        }
    }

    static async findById(orderId) {
        const pool = await sql.connect(dbConfig);

        const result = await pool.request()
            .input('orderId', sql.Int, orderId)
            .query(`
                SELECT
                    o.orderId AS order_id,
                    s.centreId AS hawker_id,
                    o.stallId AS stall_id,
                    o.customerId AS customer_id,
                    o.customerName AS customer_name,
                    o.customerPhone AS customer_phone,
                    o.orderDate AS order_date,
                    o.status AS order_status,
                    o.totalAmount AS total_amount,
                    o.discountAmount AS discount_amount,
                    o.roundUpAmount AS round_up_amount,
                    o.paymentMethod AS payment_method,
                    o.paymentStatus AS payment_status,
                    o.specialInstructions AS special_instructions,
                    s.stallName AS stall_name,
                    h.centreName AS hawker_name,
                    (
                        SELECT
                            oi.orderItemId AS order_item_id,
                            oi.menuId AS menu_id,
                            oi.itemName AS item_name,
                            oi.quantity,
                            oi.unitPrice AS unit_price,
                            oi.originalUnitPrice AS original_unit_price,
                            oi.promotionId AS promotion_id,
                            oi.subtotal,
                            oi.specialRequests AS special_requests,
                            COALESCE(ms.stallId, o.stallId) AS stall_id,
                            COALESCE(ms.stallName, s.stallName) AS stall_name,
                            COALESCE(mh.centreName, h.centreName) AS centre_name
                        FROM OrderItems oi
                        LEFT JOIN Menus m ON m.menuId = oi.menuId
                        LEFT JOIN Stalls ms ON ms.stallId = m.stallId
                        LEFT JOIN HawkerCentres mh ON mh.centreId = ms.centreId
                        WHERE oi.orderId = o.orderId
                        ORDER BY oi.orderItemId
                        FOR JSON PATH
                    ) AS items
                FROM Orders o
                JOIN Stalls s ON o.stallId = s.stallId
                JOIN HawkerCentres h ON s.centreId = h.centreId
                WHERE o.orderId = @orderId
            `);

        if (result.recordset.length === 0) {
            return null;
        }

        const order = result.recordset[0];
        return {
            ...order,
            items: order.items ? JSON.parse(order.items) : []
        };
    }

    // customer_id scopes the result to the account that placed the orders — the customer's
    // own order history always passes it, so one customer never sees another's orders.
    static async findAll(filters = {}) {
        const { customer_id, customer_name, hawker_id, stall_id } = filters;
        const pool = await sql.connect(dbConfig);

        let query = `
            SELECT
                o.orderId AS order_id,
                s.centreId AS hawker_id,
                o.stallId AS stall_id,
                o.customerId AS customer_id,
                o.customerName AS customer_name,
                o.customerPhone AS customer_phone,
                o.orderDate AS order_date,
                o.status AS order_status,
                o.totalAmount AS total_amount,
                o.discountAmount AS discount_amount,
                o.roundUpAmount AS round_up_amount,
                o.paymentMethod AS payment_method,
                o.paymentStatus AS payment_status,
                s.stallName AS stall_name,
                h.centreName AS hawker_name,
                COUNT(oi.orderItemId) AS item_count
            FROM Orders o
            JOIN Stalls s ON o.stallId = s.stallId
            JOIN HawkerCentres h ON s.centreId = h.centreId
            LEFT JOIN OrderItems oi ON o.orderId = oi.orderId
            WHERE 1=1
        `;

        if (customer_id) {
            query += ` AND o.customerId = @customerId`;
        }
        if (customer_name) {
            query += ` AND o.customerName LIKE @customerName`;
        }
        if (hawker_id) {
            query += ` AND s.centreId = @hawkerId`;
        }
        if (stall_id) {
            query += ` AND o.stallId = @stallId`;
        }

        query += ` GROUP BY
            o.orderId, s.centreId, o.stallId, o.customerId, o.customerName, o.customerPhone,
            o.orderDate, o.status, o.totalAmount, o.discountAmount, o.roundUpAmount, o.paymentMethod,
            o.paymentStatus, s.stallName, h.centreName
            ORDER BY o.orderDate DESC`;

        const request = pool.request();
        if (customer_id) {
            request.input('customerId', sql.Int, customer_id);
        }
        if (customer_name) {
            request.input('customerName', sql.NVarChar(100), `%${customer_name}%`);
        }
        if (hawker_id) {
            request.input('hawkerId', sql.Int, hawker_id);
        }
        if (stall_id) {
            request.input('stallId', sql.Int, stall_id);
        }

        const result = await request.query(query);
        return result.recordset;
    }

    // Every order across every stall that this vendor owns
    static async findByVendor(vendorId, statuses = null) {
        const pool = await sql.connect(dbConfig);
        const request = pool.request().input('vendorId', sql.Int, vendorId);

        let statusClause = '';
        if (statuses && statuses.length > 0) {
            const placeholders = statuses.map((status, i) => {
                request.input('status' + i, sql.NVarChar(20), status);
                return '@status' + i;
            }).join(', ');
            statusClause = `AND o.status IN (${placeholders})`;
        }

        const result = await request.query(`
            SELECT
                o.orderId AS order_id,
                o.stallId AS stall_id,
                s.stallName AS stall_name,
                s.unitNumber AS stall_unit_number,
                o.customerName AS customer_name,
                o.customerPhone AS customer_phone,
                o.orderDate AS order_date,
                o.status AS order_status,
                o.totalAmount AS total_amount,
                o.paymentMethod AS payment_method,
                o.paymentStatus AS payment_status,
                o.discountAmount AS discount_amount,
                o.roundUpAmount AS round_up_amount,
                o.specialInstructions AS special_instructions,
                (
                    SELECT
                        oi.itemName AS item_name,
                        oi.quantity,
                        oi.unitPrice AS unit_price,
                        oi.originalUnitPrice AS original_unit_price,
                        oi.promotionId AS promotion_id,
                        oi.subtotal,
                        oi.specialRequests AS special_requests
                    FROM OrderItems oi
                    WHERE oi.orderId = o.orderId
                    ORDER BY oi.orderItemId
                    FOR JSON PATH
                ) AS items
            FROM Orders o
            JOIN Stalls s ON s.stallId = o.stallId
            WHERE s.vendorId = @vendorId ${statusClause}
            ORDER BY o.orderDate DESC
        `);

        return result.recordset.map(order => ({
            ...order,
            items: order.items ? JSON.parse(order.items) : []
        }));
    }

    // Only lets a vendor move the status of an order placed at one of their own stalls
    static async updateStatusForVendor(vendorId, orderId, status) {
        const pool = await sql.connect(dbConfig);

        const owned = await pool.request()
            .input('orderId', sql.Int, orderId)
            .input('vendorId', sql.Int, vendorId)
            .query(`
                SELECT o.orderId FROM Orders o
                JOIN Stalls s ON s.stallId = o.stallId
                WHERE o.orderId = @orderId AND s.vendorId = @vendorId
            `);
        if (owned.recordset.length === 0) return 'not found';

        await pool.request()
            .input('orderId', sql.Int, orderId)
            .input('status', sql.NVarChar(20), status)
            .query('UPDATE Orders SET status = @status WHERE orderId = @orderId');

        return 'ok';
    }

    // Bulk-clears completed/cancelled orders from this vendor's history view
    static async clearCompletedForVendor(vendorId) {
        const pool = await sql.connect(dbConfig);

        const owned = await pool.request()
            .input('vendorId', sql.Int, vendorId)
            .query(`
                SELECT o.orderId FROM Orders o
                JOIN Stalls s ON s.stallId = o.stallId
                WHERE s.vendorId = @vendorId AND o.status IN ('completed', 'cancelled')
            `);
        const orderIds = owned.recordset.map(row => row.orderId);
        if (orderIds.length === 0) return 0;

        // orderIds came straight back from our own parameterized query above, not user input
        const idList = orderIds.join(',');
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await new sql.Request(transaction).query(`DELETE FROM StallReviews WHERE orderId IN (${idList})`);
            await new sql.Request(transaction).query(`DELETE FROM VoucherRedemptions WHERE orderId IN (${idList})`);
            await new sql.Request(transaction).query(`DELETE FROM OrderItems WHERE orderId IN (${idList})`);
            await new sql.Request(transaction).query(`DELETE FROM Orders WHERE orderId IN (${idList})`);
            await transaction.commit();
        } catch (err) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                console.error("Rollback failed:", rollbackErr);
            }
            throw err;
        }

        return orderIds.length;
    }

    static async updateStatus(orderId, status) {
        const pool = await sql.connect(dbConfig);

        const checkResult = await pool.request()
            .input('orderId', sql.Int, orderId)
            .query('SELECT orderId FROM Orders WHERE orderId = @orderId');

        if (checkResult.recordset.length === 0) {
            return null;
        }

        await pool.request()
            .input('orderId', sql.Int, orderId)
            .input('orderStatus', sql.NVarChar(20), status)
            .query(`
                UPDATE Orders
                SET status = @orderStatus
                WHERE orderId = @orderId
            `);

        return true;
    }

    static async delete(orderId) {
        const pool = await sql.connect(dbConfig);

        const checkResult = await pool.request()
            .input('orderId', sql.Int, orderId)
            .query(`
                SELECT orderId, status
                FROM Orders
                WHERE orderId = @orderId
            `);

        if (checkResult.recordset.length === 0) {
            return null;
        }

        const order = checkResult.recordset[0];

        if (order.status !== 'cancelled') {
            throw new Error('Only cancelled orders can be deleted');
        }

        await pool.request()
            .input('orderId', sql.Int, orderId)
            .query('DELETE FROM Orders WHERE orderId = @orderId');

        return true;
    }
}

module.exports = OrderModel;
