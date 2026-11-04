const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { validateOrder, validateOrderStatus } = require('../middleware/validate');
const { attachUser } = require('../middleware/authMiddleware');

// CREATE order. attachUser, not verifyToken: a signed-in customer's order is stamped with
// their id (which is what lets them see and review it later), while a vendor ringing up a
// walk-in at the counter has no customer account to name and must still get through.
router.post('/', attachUser, validateOrder, orderController.createOrder);

// GET all orders for one user (the customer's own "My Orders" list)
router.get('/user/:userId', orderController.getUserOrders);

// GET all orders. attachUser rather than verifyToken because two different callers use this:
// a vendor asking for a stall's orders, and a customer asking for their own history (the
// review screen's order picker). The controller scopes a customer's token to their own rows.
router.get('/', attachUser, orderController.getOrders);

// GET order by ID — same reasoning as the list above: attachUser so the controller can hold
// a customer to their own order without shutting the route to vendors.
router.get('/:orderId', attachUser, orderController.getOrder);

// UPDATE order status
router.put('/:orderId/status', validateOrderStatus, orderController.updateOrderStatus);

// DELETE cancelled order
router.delete('/:orderId', orderController.deleteOrder);

module.exports = router;
