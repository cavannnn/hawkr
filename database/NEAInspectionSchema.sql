USE HawkerDatabase;
GO

/* ===========================================================
   NEA Inspection feature — the actual columns/tables the ported
   code (models/inspectionModel.js) needs, added incrementally to
   the real shared schema.
   =========================================================== */

-- Stalls: grading fields the inspection flow reads/writes
IF COL_LENGTH('Stalls', 'currentGrade') IS NULL
    ALTER TABLE Stalls ADD currentGrade VARCHAR(10) NULL;
GO
IF COL_LENGTH('Stalls', 'majorIssueCount') IS NULL
    ALTER TABLE Stalls ADD majorIssueCount INT NOT NULL CONSTRAINT DfStallsMajorIssueCount DEFAULT 0;
GO
-- Existing stalls start their grading clock from today rather than NULL (which would
-- parse as 1970 and instantly qualify every stall for grade A).
IF COL_LENGTH('Stalls', 'performanceStartDate') IS NULL
    ALTER TABLE Stalls ADD performanceStartDate DATE NOT NULL CONSTRAINT DfStallsPerformanceStartDate DEFAULT GETDATE();
GO

-- Inspections: the assessment fields filled in when an officer completes an inspection
IF COL_LENGTH('Inspections', 'hygieneScore') IS NULL
    ALTER TABLE Inspections ADD hygieneScore INT NULL;
GO
IF COL_LENGTH('Inspections', 'remarks') IS NULL
    ALTER TABLE Inspections ADD remarks VARCHAR(MAX) NULL;
GO
IF COL_LENGTH('Inspections', 'personalHygiene') IS NULL
    ALTER TABLE Inspections ADD personalHygiene BIT NOT NULL CONSTRAINT DfInspectionsPersonalHygiene DEFAULT 0;
GO
IF COL_LENGTH('Inspections', 'foodStorage') IS NULL
    ALTER TABLE Inspections ADD foodStorage BIT NOT NULL CONSTRAINT DfInspectionsFoodStorage DEFAULT 0;
GO
IF COL_LENGTH('Inspections', 'pestControl') IS NULL
    ALTER TABLE Inspections ADD pestControl BIT NOT NULL CONSTRAINT DfInspectionsPestControl DEFAULT 0;
GO
IF COL_LENGTH('Inspections', 'isMajorIssue') IS NULL
    ALTER TABLE Inspections ADD isMajorIssue BIT NOT NULL CONSTRAINT DfInspectionsIsMajorIssue DEFAULT 0;
GO

-- New: one row per grade change, so grades.html can show a stall's grading history
IF OBJECT_ID('GradeHistory', 'U') IS NULL
CREATE TABLE GradeHistory (
    historyId INT IDENTITY(1,1) PRIMARY KEY,
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    grade VARCHAR(10) NOT NULL,
    effectiveDate DATE NOT NULL CONSTRAINT DfGradeHistoryEffectiveDate DEFAULT GETDATE(),
    inspectionId INT NOT NULL UNIQUE FOREIGN KEY REFERENCES Inspections(inspectionId)
);
GO
