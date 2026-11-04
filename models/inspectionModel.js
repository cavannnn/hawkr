const sql = require('mssql');
const dbConfig = require('../dbConfig');

const STATUS = {
    SCHEDULED: 'Scheduled',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed'
};

async function getOpenInspectionByStall(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('scheduled', sql.VarChar, STATUS.SCHEDULED)
        .input('inProgress', sql.VarChar, STATUS.IN_PROGRESS)
        .query(`SELECT TOP 1 inspectionId, inspectionDate, status
                FROM Inspections
                WHERE stallId = @stallId AND status IN (@scheduled, @inProgress)
                ORDER BY inspectionDate ASC, inspectionId ASC`);
    return result.recordset[0] || null;
}

async function createInspection(data) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, data.stallId)
        .input('officerId', sql.Int, data.officerId)
        .input('date', sql.Date, data.date)
        .input('isAutoScheduled', sql.Bit, data.isAutoScheduled ? 1 : 0)
        .input('scheduled', sql.VarChar, STATUS.SCHEDULED)
        .input('inProgress', sql.VarChar, STATUS.IN_PROGRESS)
        .query(`INSERT INTO Inspections (stallId, officerId, inspectionDate, status, isAutoScheduled)
                SELECT @stallId, @officerId, @date, @scheduled, @isAutoScheduled
                WHERE NOT EXISTS (
                    SELECT 1 FROM Inspections WITH (UPDLOCK, HOLDLOCK)
                    WHERE stallId = @stallId AND status IN (@scheduled, @inProgress)
                );
                SELECT SCOPE_IDENTITY() AS inspectionId;`);
    return result.recordset[0].inspectionId ?? null;
}

async function createWalkInInspection(stallId, officerId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('officerId', sql.Int, officerId)
        .input('scheduled', sql.VarChar, STATUS.SCHEDULED)
        .input('inProgress', sql.VarChar, STATUS.IN_PROGRESS)
        .query(`INSERT INTO Inspections (stallId, officerId, inspectionDate, status)
                SELECT @stallId, @officerId, CAST(GETDATE() AS DATE), @inProgress
                WHERE NOT EXISTS (
                    SELECT 1 FROM Inspections WITH (UPDLOCK, HOLDLOCK)
                    WHERE stallId = @stallId AND status IN (@scheduled, @inProgress)
                );
                SELECT SCOPE_IDENTITY() AS inspectionId;`);
    return result.recordset[0].inspectionId ?? null;
}

async function getUnassignedStalls() {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .query(`SELECT s.stallId, s.stallName, s.unitNumber,
                       h.centreId, h.centreName, h.address, h.postalCode
                FROM Stalls s
                INNER JOIN HawkerCentres h ON s.centreId = h.centreId
                WHERE NOT EXISTS (SELECT 1 FROM Inspections i WHERE i.stallId = s.stallId)
                ORDER BY h.centreName, s.stallName`);
    return result.recordset;
}

async function getStallDetailForOfficer(stallId) {
    const pool = await sql.connect(dbConfig);

    const stallResult = await pool.request()
        .input('stallId', sql.Int, stallId)
        .query(`SELECT s.stallId, s.stallName, s.unitNumber, s.currentGrade,
                       s.preIssueGrade, s.probationStartDate, s.autoSchedule,
                       h.centreId, h.centreName, h.address, h.postalCode
                FROM Stalls s
                INNER JOIN HawkerCentres h ON s.centreId = h.centreId
                WHERE s.stallId = @stallId`);

    const stall = stallResult.recordset[0];
    if (!stall) return null;

    const inspectionsResult = await pool.request()
        .input('stallId', sql.Int, stallId)
        .query(`SELECT inspectionId, inspectionDate, status, hygieneScore, isMajorIssue, remarks, isAutoScheduled
                FROM Inspections
                WHERE stallId = @stallId
                ORDER BY inspectionDate DESC, inspectionId DESC`);

    const inspections = inspectionsResult.recordset;
    const openInspection = inspections.find(
        (i) => i.status === STATUS.SCHEDULED || i.status === STATUS.IN_PROGRESS
    ) || null;

    return { stall, inspections, openInspection };
}

async function getAllInspections(officerId, statusFilter = null) {
    const pool = await sql.connect(dbConfig);
    const query = `
        SELECT i.inspectionId, i.inspectionDate, i.status, i.isAutoScheduled, i.createdAt,
               s.stallId, s.stallName, s.unitNumber, s.currentGrade,
               h.centreName, h.address, h.postalCode,
               CASE
                   WHEN i.status = @completed AND i.inspectionId = (
                       SELECT TOP 1 i2.inspectionId
                       FROM Inspections i2
                       WHERE i2.stallId = i.stallId AND i2.status = @completed
                       ORDER BY i2.inspectionDate DESC, i2.inspectionId DESC
                   ) THEN 1
                   ELSE 0
               END AS isLatestCompletedAssessment,
               CASE
                   WHEN i.status = @inProgress
                   THEN DATEDIFF(day, CAST(i.inspectionDate AS DATE), CAST(GETDATE() AS DATE))
                   ELSE NULL
               END AS daysOverdue
        FROM Inspections i
        INNER JOIN Stalls s ON i.stallId = s.stallId
        INNER JOIN HawkerCentres h ON s.centreId = h.centreId
        WHERE i.officerId = @officerId
        ${statusFilter ? "AND i.status = @statusFilter" : "AND i.status <> @completed"}
        ORDER BY
            CASE i.status
                WHEN 'In Progress' THEN 0
                WHEN 'Scheduled' THEN 1
                WHEN 'Completed' THEN 2
                ELSE 3
            END,
            CASE
                WHEN i.status = 'Scheduled' THEN i.inspectionDate
                ELSE NULL
            END ASC,
            i.inspectionDate DESC,
            i.inspectionId DESC`;

    const request = pool.request()
        .input('officerId', sql.Int, officerId)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .input('inProgress', sql.VarChar, STATUS.IN_PROGRESS);
    if (statusFilter) request.input('statusFilter', sql.VarChar, statusFilter);

    const result = await request.query(query);
    return result.recordset;
}

async function promoteScheduledToInProgress(officerId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('officerId', sql.Int, officerId)
        .input('scheduled', sql.VarChar, STATUS.SCHEDULED)
        .input('inProgress', sql.VarChar, STATUS.IN_PROGRESS)
        .query(`DECLARE @promoted TABLE (inspectionId INT);

                UPDATE Inspections
                SET status = @inProgress
                OUTPUT inserted.inspectionId INTO @promoted
                WHERE officerId = @officerId
                AND status = @scheduled
                AND CAST(inspectionDate AS DATE) <= CAST(GETDATE() AS DATE);

                SELECT i.inspectionId, i.inspectionDate, i.stallId, i.isAutoScheduled, i.createdAt,
                       s.stallName, s.unitNumber,
                       h.centreName, h.address, h.postalCode
                FROM Inspections i
                INNER JOIN Stalls s ON i.stallId = s.stallId
                INNER JOIN HawkerCentres h ON s.centreId = h.centreId
                WHERE i.inspectionId IN (SELECT inspectionId FROM @promoted)
                ORDER BY i.inspectionDate ASC;`);
    return result.recordset;
}

async function getCompletedInspections(officerId) {
    const pool = await sql.connect(dbConfig);
    const query = `
        SELECT i.inspectionId, i.inspectionDate, i.status, i.isAutoScheduled, i.createdAt,
               i.hygieneScore, i.isMajorIssue, i.remarks, i.assessmentUpdatedAt,
               i.personalHygiene, i.foodStorage, i.pestControl,
               s.stallId, s.stallName, s.unitNumber,
               gh.grade AS gradeAtTime, gh.isRevised, gh.revisedAt,
               h.centreName, h.address, h.postalCode,
               CASE
                   WHEN i.inspectionId = (
                       SELECT TOP 1 i2.inspectionId
                       FROM Inspections i2
                       WHERE i2.stallId = i.stallId AND i2.status = @completed
                       ORDER BY i2.inspectionDate DESC, i2.inspectionId DESC
                   ) THEN 1
                   ELSE 0
               END AS isLatestCompletedAssessment
        FROM Inspections i
        INNER JOIN Stalls s ON i.stallId = s.stallId
        INNER JOIN HawkerCentres h ON s.centreId = h.centreId
        LEFT JOIN GradeHistory gh ON i.inspectionId = gh.inspectionId
        WHERE i.officerId = @officerId
        AND i.status = @completed
        ORDER BY i.inspectionDate DESC, i.inspectionId DESC`;

    const result = await pool.request()
        .input('officerId', sql.Int, officerId)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(query);
    return result.recordset;
}

async function getInspectionById(inspectionId) {
    const pool = await sql.connect(dbConfig);
    const query = `
        SELECT i.inspectionId, i.stallId, i.officerId, i.inspectionDate, i.createdAt,
               i.status, i.isAutoScheduled, i.hygieneScore, i.remarks, i.personalHygiene,
               i.foodStorage, i.pestControl, i.isMajorIssue, i.assessmentUpdatedAt,
               s.stallName, s.unitNumber, s.currentGrade,
               h.centreName, h.address, h.postalCode
        FROM Inspections i
        INNER JOIN Stalls s ON i.stallId = s.stallId
        INNER JOIN HawkerCentres h ON s.centreId = h.centreId
        WHERE i.inspectionId = @id`;

    const result = await pool.request()
        .input('id', sql.Int, inspectionId)
        .query(query);
    return result.recordset[0];
}

async function updateInspectionSchedule(inspectionId, officerId, date) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('id', sql.Int, inspectionId)
        .input('officerId', sql.Int, officerId)
        .input('date', sql.Date, date)
        .input('scheduled', sql.VarChar, STATUS.SCHEDULED)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(`UPDATE Inspections
                SET inspectionDate = @date,
                    status = CASE
                                WHEN @date > CAST(GETDATE() AS DATE) THEN @scheduled
                                ELSE status
                             END
                WHERE inspectionId = @id
                AND officerId = @officerId
                AND status <> @completed;
                SELECT @@ROWCOUNT AS affectedRows;`);
    return result.recordset[0].affectedRows > 0;
}

async function updateAssessment(inspectionId, officerId, data) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('id', sql.Int, inspectionId)
        .input('officerId', sql.Int, officerId)
        .input('hygieneScore', sql.Int, data.hygieneScore)
        .input('remarks', sql.VarChar(sql.MAX), data.remarks ?? null)
        .input('personalHygiene', sql.Bit, data.personalHygiene ? 1 : 0)
        .input('foodStorage', sql.Bit, data.foodStorage ? 1 : 0)
        .input('pestControl', sql.Bit, data.pestControl ? 1 : 0)
        .input('isMajorIssue', sql.Bit, data.isMajorIssue ? 1 : 0)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(`UPDATE Inspections SET
                hygieneScore = @hygieneScore,
                remarks = @remarks,
                personalHygiene = @personalHygiene,
                foodStorage = @foodStorage,
                pestControl = @pestControl,
                isMajorIssue = @isMajorIssue,
                assessmentUpdatedAt = GETDATE()
                WHERE inspectionId = @id
                AND officerId = @officerId
                AND status = @completed;
                SELECT @@ROWCOUNT AS affectedRows;`);
    return result.recordset[0].affectedRows > 0;
}

async function completeAssessment(inspectionId, officerId, data) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('id', sql.Int, inspectionId)
        .input('officerId', sql.Int, officerId)
        .input('hygieneScore', sql.Int, data.hygieneScore)
        .input('remarks', sql.VarChar(sql.MAX), data.remarks ?? null)
        .input('personalHygiene', sql.Bit, data.personalHygiene ? 1 : 0)
        .input('foodStorage', sql.Bit, data.foodStorage ? 1 : 0)
        .input('pestControl', sql.Bit, data.pestControl ? 1 : 0)
        .input('isMajorIssue', sql.Bit, data.isMajorIssue ? 1 : 0)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .input('inProgress', sql.VarChar, STATUS.IN_PROGRESS)
        .query(`UPDATE Inspections SET
                hygieneScore = @hygieneScore,
                remarks = @remarks,
                personalHygiene = @personalHygiene,
                foodStorage = @foodStorage,
                pestControl = @pestControl,
                isMajorIssue = @isMajorIssue,
                status = @completed,
                assessmentUpdatedAt = GETDATE()
                WHERE inspectionId = @id
                AND officerId = @officerId
                AND status = @inProgress;
                SELECT @@ROWCOUNT AS affectedRows;`);
    return result.recordset[0].affectedRows > 0;
}

async function updateStallPerformance(stallId, performance) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('grade', sql.VarChar, performance.grade)
        .input('majorIssueCount', sql.Int, performance.majorIssueCount)
        .input('preIssueGrade', sql.VarChar, performance.preIssueGrade ?? null)
        .input('probationStartDate', sql.Date, performance.probationStartDate ?? null)
        .input('probationInspectionId', sql.Int, performance.probationInspectionId ?? null)
        .query(`UPDATE Stalls
                SET currentGrade = @grade,
                    majorIssueCount = @majorIssueCount,
                    preIssueGrade = @preIssueGrade,
                    probationStartDate = @probationStartDate,
                    probationInspectionId = @probationInspectionId
                WHERE stallId = @stallId;
                SELECT @@ROWCOUNT AS affectedRows;`);
    return result.recordset[0].affectedRows > 0;
}

async function getStallById(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .query("SELECT * FROM Stalls WHERE stallId = @stallId");
    return result.recordset[0];
}

async function getStallAutoSchedule(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .query("SELECT autoSchedule FROM Stalls WHERE stallId = @stallId");
    const row = result.recordset[0];
    if (!row || row.autoSchedule === null || row.autoSchedule === undefined) return null;
    return row.autoSchedule === true || row.autoSchedule === 1;
}

async function setStallAutoSchedule(stallId, enabled) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('enabled', sql.Bit, enabled ? 1 : 0)
        .query(`UPDATE Stalls SET autoSchedule = @enabled
                WHERE stallId = @stallId;
                SELECT @@ROWCOUNT AS affectedRows;`);
    return result.recordset[0].affectedRows > 0;
}

async function getLatestCompletedInspectionByStall(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(`SELECT TOP 1 * FROM Inspections
                WHERE stallId = @stallId AND status = @completed
                ORDER BY inspectionDate DESC, inspectionId DESC`);
    return result.recordset[0];
}

async function getLatestMajorIssueInspectionByStall(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(`SELECT TOP 1 * FROM Inspections
                WHERE stallId = @stallId AND status = @completed AND isMajorIssue = 1
                ORDER BY inspectionDate DESC, inspectionId DESC`);
    return result.recordset[0];
}

async function countMajorIssuesByStall(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(`SELECT COUNT(*) AS majorCount FROM Inspections
                WHERE stallId = @stallId AND status = @completed AND isMajorIssue = 1`);
    return result.recordset[0].majorCount;
}

async function countCleanInspectionsSince(stallId, sinceDate, sinceInspectionId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('sinceDate', sql.Date, sinceDate)
        .input('sinceInspectionId', sql.Int, sinceInspectionId)
        .input('completed', sql.VarChar, STATUS.COMPLETED)
        .query(`SELECT COUNT(*) AS cleanCount FROM Inspections
                WHERE stallId = @stallId
                AND status = @completed
                AND isMajorIssue = 0
                AND (inspectionDate > @sinceDate
                     OR (inspectionDate = @sinceDate AND inspectionId > @sinceInspectionId))`);
    return result.recordset[0].cleanCount;
}

async function getAllStallsWithGrades() {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .query(`SELECT s.stallId, s.stallName, s.unitNumber, s.currentGrade,
                       s.preIssueGrade, s.probationStartDate, s.autoSchedule,
                       s.performanceStartDate, s.imageUrl,
                       h.centreId, h.centreName, h.address, h.postalCode
                FROM Stalls s
                INNER JOIN HawkerCentres h ON s.centreId = h.centreId
                ORDER BY h.centreName, s.unitNumber, s.stallName`);
    return result.recordset;
}

async function getGradeHistoryWithDates(stallId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('stallId', sql.Int, stallId)
        .query(`SELECT gh.historyId, gh.grade, gh.effectiveDate, gh.isRevised, gh.revisedAt,
                       i.inspectionDate, i.inspectionId, i.officerId
                FROM GradeHistory gh
                LEFT JOIN Inspections i ON gh.inspectionId = i.inspectionId
                WHERE gh.stallId = @stallId
                ORDER BY gh.effectiveDate DESC, gh.historyId DESC`);
    return result.recordset;
}

async function gradeHistoryExists(inspectionId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('inspectionId', sql.Int, inspectionId)
        .query("SELECT COUNT(*) AS rowCountFound FROM GradeHistory WHERE inspectionId = @inspectionId");
    return result.recordset[0].rowCountFound > 0;
}

async function logGradeHistory(stallId, grade, inspectionId, isRevision = false) {
    const pool = await sql.connect(dbConfig);
    await pool.request()
        .input('stallId', sql.Int, stallId)
        .input('grade', sql.VarChar, grade)
        .input('inspectionId', sql.Int, inspectionId)
        .input('isRevision', sql.Bit, isRevision ? 1 : 0)
        .query(`IF EXISTS (SELECT 1 FROM GradeHistory WHERE inspectionId = @inspectionId)
                    UPDATE GradeHistory
                    SET grade = @grade,
                        isRevised = 1,
                        revisedAt = GETDATE()
                    WHERE inspectionId = @inspectionId
                ELSE
                    INSERT INTO GradeHistory (stallId, grade, inspectionId, isRevised, revisedAt)
                    VALUES (@stallId, @grade, @inspectionId, @isRevision,
                            CASE WHEN @isRevision = 1 THEN GETDATE() ELSE NULL END);`);
}

async function deleteInspection(inspectionId, officerId) {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        await new sql.Request(transaction)
            .input('id', sql.Int, inspectionId)
            .query(`UPDATE Notifications
                    SET referenceType = NULL, referenceId = NULL
                    WHERE referenceType = 'inspection' AND referenceId = @id`);

        const result = await new sql.Request(transaction)
            .input('id', sql.Int, inspectionId)
            .input('officerId', sql.Int, officerId)
            .input('completed', sql.VarChar, STATUS.COMPLETED)
            .query(`DELETE FROM Inspections
                    WHERE inspectionId = @id
                    AND officerId = @officerId
                    AND status <> @completed;
                    SELECT @@ROWCOUNT AS affectedRows;`);

        const deleted = result.recordset[0].affectedRows > 0;

        if (!deleted) {
            await transaction.rollback();
            return false;
        }

        await transaction.commit();
        return true;
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error("Rollback failed:", rollbackErr);
        }
        throw err;
    }
}

module.exports = {
    STATUS,
    createInspection,
    createWalkInInspection,
    getOpenInspectionByStall,
    getUnassignedStalls,
    getStallDetailForOfficer,
    getAllInspections,
    promoteScheduledToInProgress,
    getCompletedInspections,
    getInspectionById,
    updateInspectionSchedule,
    updateAssessment,
    completeAssessment,
    updateStallPerformance,
    getStallById,
    getStallAutoSchedule,
    setStallAutoSchedule,
    getLatestCompletedInspectionByStall,
    getLatestMajorIssueInspectionByStall,
    countMajorIssuesByStall,
    countCleanInspectionsSince,
    getAllStallsWithGrades,
    getGradeHistoryWithDates,
    gradeHistoryExists,
    logGradeHistory,
    deleteInspection
};
