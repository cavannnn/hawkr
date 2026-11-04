const fs = require('fs/promises');
const path = require('path');

const ticketModel = require('../models/ticketModel');
const ticketHistoryModel = require('../models/ticketHistoryModel');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads', 'tickets');
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB
const IMAGE_TYPES = ['image/jpeg', 'image/png'];

function currentUserId(req) {
  return req.user.id ?? req.user.UserId;
}

function currentUserRole(req) {
  return (req.user.role || req.user.Role || '').toLowerCase();
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

async function attachHistoryIfClosed(ticket) {
  if (ticketModel.TERMINAL_STATUSES.includes(ticket.Status)) {
    ticket.history = await ticketHistoryModel.getLatestHistoryForTicket(ticket.TicketId);
  }
  return ticket;
}

// ---------- Hawker centres ----------

async function getCentres(req, res) {
  try {
    const centres = await ticketModel.getHawkerCentres();
    res.json(centres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hawker centres' });
  }
}

async function getMyAssignedCentres(req, res) {
  try {
    const centres = await ticketModel.getAssignedHawkerCentres(currentUserId(req));
    res.json(centres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assigned hawker centres' });
  }
}

// ---------- Create ----------

async function createTicket(req, res) {
  const files = req.files || [];

  for (const file of files) {
    const isImage = IMAGE_TYPES.includes(file.mimetype);
    const limit = isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > limit) {
      return res.status(400).json({
        error: `${file.originalname} is too large. Images must be under 5MB, videos under 50MB.`,
      });
    }
  }

  try {
    const ticketId = await ticketModel.createTicket({
      HawkerId: req.body.HawkerId,
      UserId: currentUserId(req),
      UserRole: currentUserRole(req),
      Category: req.body.Category,
      OtherCategoryText: req.body.OtherCategoryText,
      Subject: req.body.Subject,
      Description: req.body.Description,
    });

    if (files.length) {
      const ticketDir = path.join(UPLOAD_ROOT, String(ticketId));
      await fs.mkdir(ticketDir, { recursive: true });

      const attachments = [];
      for (const file of files) {
        const safeName = `${Date.now()}-${sanitizeFileName(file.originalname)}`;
        await fs.writeFile(path.join(ticketDir, safeName), file.buffer);
        attachments.push({
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSizeBytes: file.size,
          storagePath: `/uploads/tickets/${ticketId}/${safeName}`,
        });
      }
      await ticketModel.addAttachments(ticketId, attachments);
    }

    res.status(201).json({ message: 'Ticket submitted', TicketId: ticketId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit ticket' });
  }
}

// ---------- List ----------

async function getTickets(req, res) {
  const role = currentUserRole(req);
  const statusGroup = req.query.status === 'closed' ? 'closed' : 'open';

  try {
    if (role === 'customer' || role === 'vendor') {
      const tickets = await ticketModel.getTicketsForSubmitter(currentUserId(req), statusGroup);
      if (statusGroup === 'closed') {
        const history = await ticketHistoryModel.getHistoryForSubmitter(currentUserId(req));
        const historyByTicketId = new Map(history.map(h => [h.TicketId, h]));
        tickets.forEach(t => { t.history = historyByTicketId.get(t.TicketId) || null; });
      }
      return res.json(tickets);
    }

    if (role === 'operator') {
      const hawkerIds = await ticketModel.getAssignedHawkerIds(currentUserId(req));
      const tickets = await ticketModel.getTicketsForOperator({
        hawkerIds,
        statusGroup,
        category: req.query.category || null,
        hawkerId: req.query.hawkerId ? Number(req.query.hawkerId) : null,
        status: req.query.exactStatus || null,
      });
      return res.json(tickets);
    }

    res.status(403).json({ error: 'Only customers, vendors, or operators can view tickets' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
}

async function getOperatorHistory(req, res) {
  try {
    const hawkerIds = await ticketModel.getAssignedHawkerIds(currentUserId(req));
    const history = await ticketHistoryModel.getHistoryForOperator({
      hawkerIds,
      category: req.query.category || null,
      outcome: req.query.outcome || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ticket history' });
  }
}

// ---------- Detail ----------

async function getTicketById(req, res) {
  try {
    const ticket = await ticketModel.getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const role = currentUserRole(req);
    const userId = currentUserId(req);

    if (role === 'operator') {
      const assigned = await ticketModel.isOperatorAssignedToHawker(userId, ticket.HawkerId);
      if (!assigned) {
        return res.status(403).json({ error: 'You are not assigned to this ticket\'s hawker centre' });
      }
    } else if (String(ticket.UserId) !== String(userId)) {
      return res.status(403).json({ error: 'You can only view your own tickets' });
    }

    ticket.attachments = await ticketModel.getAttachmentsByTicketId(ticket.TicketId);
    await attachHistoryIfClosed(ticket);

    res.json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
}

// ---------- Operator actions ----------

async function claimTicket(req, res) {
  try {
    const ticket = await ticketModel.getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const operatorId = currentUserId(req);
    const assigned = await ticketModel.isOperatorAssignedToHawker(operatorId, ticket.HawkerId);
    if (!assigned) {
      return res.status(403).json({ error: 'You are not assigned to this ticket\'s hawker centre' });
    }

    const claimed = await ticketModel.claimTicket(ticket.TicketId, operatorId);
    if (!claimed) {
      return res.status(409).json({ error: 'Ticket has already been claimed' });
    }

    res.json({ message: 'Ticket claimed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim ticket' });
  }
}

async function updateTicketStatus(req, res) {
  try {
    const ticket = await ticketModel.getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updated = await ticketModel.updateStatus(ticket.TicketId, currentUserId(req), req.body.Status);
    if (!updated) {
      return res.status(403).json({ error: 'Only the operator assigned to this ticket can update its status' });
    }

    res.json({ message: 'Ticket status updated', Status: req.body.Status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
}

async function completeTicket(req, res) {
  try {
    const ticket = await ticketModel.getTicketById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const operatorId = currentUserId(req);
    if (String(ticket.AssignedOperatorId) !== String(operatorId)) {
      return res.status(403).json({ error: 'Only the operator assigned to this ticket can close it' });
    }

    await ticketHistoryModel.insertHistory({
      TicketId: ticket.TicketId,
      UserId: ticket.UserId,
      UserRole: ticket.UserRole,
      Category: ticket.Category,
      TicketDescription: ticket.Description,
      Message: req.body.Message,
      Status: req.body.Outcome,
      ResolvedByUserId: operatorId,
    });
    await ticketModel.closeTicket(ticket.TicketId, req.body.Outcome);

    res.json({ message: `Ticket marked as ${req.body.Outcome}`, Status: req.body.Outcome });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to close ticket' });
  }
}

module.exports = {
  getCentres,
  getMyAssignedCentres,
  createTicket,
  getTickets,
  getOperatorHistory,
  getTicketById,
  claimTicket,
  updateTicketStatus,
  completeTicket,
};
