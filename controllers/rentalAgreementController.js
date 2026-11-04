const rentalAgreementModel = require('../models/rentalAgreementModel');
const { streamAgreementPdf } = require('../utils/rentalAgreementPdf');

async function getAllRentalAgreements(req, res) {
  try {
    const agreements = await rentalAgreementModel.getAllRentalAgreements();
    res.json(agreements);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rental agreements' });
  }
}

async function getRentalAgreementById(req, res) {
  try {
    const agreement = await rentalAgreementModel.getRentalAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Rental agreement not found' });
    }
    res.json(agreement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rental agreement' });
  }
}

async function downloadAgreementPdf(req, res) {
  try {
    const agreement = await rentalAgreementModel.getRentalAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Rental agreement not found' });
    }
    streamAgreementPdf(res, agreement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate rental agreement PDF' });
  }
}

async function createRentalAgreement(req, res) {
  try {
    const newId = await rentalAgreementModel.createRentalAgreement(req.body);
    res.status(201).json({ message: 'Rental agreement created', AgreementId: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create rental agreement' });
  }
}

async function updateRentalAgreement(req, res) {
  try {
    const existing = await rentalAgreementModel.getRentalAgreementById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Rental agreement not found' });
    }
    await rentalAgreementModel.updateRentalAgreement(req.params.id, req.body);
    res.json({ message: 'Rental agreement updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update rental agreement' });
  }
}

async function deleteRentalAgreement(req, res) {
  try {
    const existing = await rentalAgreementModel.getRentalAgreementById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Rental agreement not found' });
    }
    await rentalAgreementModel.deleteRentalAgreement(req.params.id);
    res.json({ message: 'Rental agreement deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete rental agreement' });
  }
}

module.exports = {
  getAllRentalAgreements,
  getRentalAgreementById,
  downloadAgreementPdf,
  createRentalAgreement,
  updateRentalAgreement,
  deleteRentalAgreement,
};