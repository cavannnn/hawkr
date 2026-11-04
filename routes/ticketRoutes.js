const express = require('express');
const router = express.Router();

const ticketController = require('../controllers/ticketController');
const { handleTicketUpload } = require('../middleware/ticketUpload');
const { validateCreateTicket, validateStatusUpdate, validateCompleteTicket } = require('../middleware/ticketValidation');
const { verifyToken, requireRole, requireAnyRole } = require('../middleware/authMiddleware');

// Static/filter routes first, so they aren't swallowed by the /:id param route below.
router.get('/centres', verifyToken, ticketController.getCentres);
router.get('/centres/mine', verifyToken, requireRole('operator'), ticketController.getMyAssignedCentres);
router.get('/history', verifyToken, requireRole('operator'), ticketController.getOperatorHistory);

router.post(
  '/',
  verifyToken,
  requireAnyRole(['customer', 'vendor']),
  handleTicketUpload,
  validateCreateTicket,
  ticketController.createTicket
);
router.get('/', verifyToken, ticketController.getTickets);
router.get('/:id', verifyToken, ticketController.getTicketById);

router.patch('/:id/claim', verifyToken, requireRole('operator'), ticketController.claimTicket);
router.patch('/:id/status', verifyToken, requireRole('operator'), validateStatusUpdate, ticketController.updateTicketStatus);
router.post('/:id/complete', verifyToken, requireRole('operator'), validateCompleteTicket, ticketController.completeTicket);

module.exports = router;
