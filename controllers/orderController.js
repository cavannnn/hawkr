const OrderModel = require('../models/orderModel');

class OrderController {
    static async createOrder(req, res, next) {
        try {
            console.log('Order data received:', JSON.stringify(req.body, null, 2));

            const role = String(req.user?.role || req.user?.Role || '').toLowerCase();
            const payload = role === 'customer'
                ? { ...req.body, customer_id: req.user.id }
                : req.body;

            const orderId = await OrderModel.create(payload);
            const order = await OrderModel.findById(orderId);

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: order
            });
        } catch (error) {
            console.error('Order creation error:', error);
            if (error.statusCode) {
                return res.status(error.statusCode).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    static async getOrder(req, res, next) {
        try {
            const { orderId } = req.params;
            const order = await OrderModel.findById(orderId);

            if (!order) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            const role = String(req.user?.role || req.user?.Role || '').toLowerCase();
            if (role === 'customer' && Number(order.customer_id) !== Number(req.user.id)) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            res.json({
                success: true,
                data: order
            });
        } catch (error) {
            next(error);
        }
    }

    static async getUserOrders(req, res, next) {
        try {
            const { userId } = req.params;
            const { hawker_id, stall_id } = req.query;

            const orders = await OrderModel.findAll({
                customer_id: parseInt(userId),
                hawker_id,
                stall_id
            });

            res.json({
                success: true,
                data: orders,
                count: orders.length
            });
        } catch (error) {
            console.error('Error in getUserOrders:', error);
            next(error);
        }
    }

    static async getOrders(req, res, next) {
        try {
            const { customer_name, hawker_id, stall_id } = req.query;
            const role = String(req.user?.role || req.user?.Role || '').toLowerCase();

            if (!req.user || role === 'guest') {
                return res.json({ success: true, data: [] });
            }

            const orders = await OrderModel.findAll({
                customer_id: role === 'customer' ? req.user.id : undefined,
                customer_name,
                hawker_id,
                stall_id
            });
            
            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            next(error);
        }
    }

    static async updateOrderStatus(req, res, next) {
        try {
            const { orderId } = req.params;
            const { order_status } = req.body;

            const result = await OrderModel.updateStatus(orderId, order_status);
            
            if (result === null) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            const updatedOrder = await OrderModel.findById(orderId);

            res.json({
                success: true,
                message: 'Order status updated successfully',
                data: updatedOrder
            });
        } catch (error) {
            next(error);
        }
    }

    static async deleteOrder(req, res, next) {
        try {
            const { orderId } = req.params;
            
            const result = await OrderModel.delete(orderId);
            
            if (result === null) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            res.json({
                success: true,
                message: 'Order deleted successfully'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = OrderController;