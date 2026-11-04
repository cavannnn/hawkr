const inspectionModel = require('../models/inspectionModel');
const { getOfficerId } = require('./authMiddleware');

const authorizeInspectionOwner = async (req, res, next) => {
    const inspectionId = Number(req.params.id);

    if (!Number.isInteger(inspectionId) || inspectionId < 1) {
        return res.status(400).json({ error: "Invalid inspection id." });
    }

    try {
        const inspection = await inspectionModel.getInspectionById(inspectionId);
        if (!inspection) {
            return res.status(404).json({ error: "Inspection not found" });
        }

        if (Number(inspection.officerId) !== Number(getOfficerId(req))) {
            return res.status(403).json({
                error: "You can only manage inspections that you created."
            });
        }

        req.inspectionId = inspectionId;
        req.inspection = inspection;
        next();
    } catch (err) {
        console.error("Inspection ownership check failed:", err);
        res.status(500).json({ error: "Error retrieving inspection" });
    }
};

module.exports = { authorizeInspectionOwner };
