const HawkerModel = require('../models/neaHawkerModel');

async function getHawkerCentres(req, res) {
    try {
        const centres = await HawkerModel.getAllHawkerCentres();
        res.json(centres);
    } catch (err) {
        console.error("Error fetching hawker centres:", err);
        res.status(500).json({ error: "Failed to fetch hawker centres." });
    }
}

async function getStalls(req, res) {
    try {
        const stalls = await HawkerModel.getStallsByCentre(req.params.centreId);
        res.json(stalls);
    } catch (err) {
        console.error("Error fetching stalls:", err);
        res.status(500).json({ error: "Failed to fetch stalls." });
    }
}

module.exports = { getHawkerCentres, getStalls };
