const rentalAgreementHistoryModel = require('../models/rentalAgreementHistoryModel');

async function getAllHistory(req, res) {
  try {
    const history = await rentalAgreementHistoryModel.getAllHistory();
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rental agreement history' });
  }
}

async function getHistoryById(req, res) {
  try {
    const entry = await rentalAgreementHistoryModel.getHistoryById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch history entry' });
  }
}

module.exports = { getAllHistory, getHistoryById };
