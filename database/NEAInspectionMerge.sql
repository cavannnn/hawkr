USE HawkerDatabase;
GO

IF COL_LENGTH('Stalls', 'autoSchedule') IS NULL
    ALTER TABLE Stalls ADD autoSchedule BIT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DfStallsAutoSchedule')
BEGIN
    ALTER TABLE Stalls DROP CONSTRAINT DfStallsAutoSchedule;
    ALTER TABLE Stalls ALTER COLUMN autoSchedule BIT NULL;
    UPDATE Stalls SET autoSchedule = NULL WHERE autoSchedule = 0;
END
GO
IF COL_LENGTH('Stalls', 'preIssueGrade') IS NULL
    ALTER TABLE Stalls ADD preIssueGrade VARCHAR(10) NULL;
GO
IF COL_LENGTH('Stalls', 'probationStartDate') IS NULL
    ALTER TABLE Stalls ADD probationStartDate DATE NULL;
GO
IF COL_LENGTH('Stalls', 'probationInspectionId') IS NULL
    ALTER TABLE Stalls ADD probationInspectionId INT NULL;
GO

IF COL_LENGTH('Inspections', 'assessmentUpdatedAt') IS NULL
    ALTER TABLE Inspections ADD assessmentUpdatedAt DATETIME NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkInspectionsStatus')
    ALTER TABLE Inspections ADD CONSTRAINT CkInspectionsStatus
        CHECK (status IN ('Scheduled', 'In Progress', 'Completed'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkInspectionsHygieneScore')
    ALTER TABLE Inspections ADD CONSTRAINT CkInspectionsHygieneScore
        CHECK (hygieneScore BETWEEN 1 AND 5);
GO

IF COL_LENGTH('GradeHistory', 'isRevised') IS NULL
    ALTER TABLE GradeHistory ADD isRevised BIT NOT NULL CONSTRAINT DfGradeHistoryIsRevised DEFAULT 0;
GO
IF COL_LENGTH('GradeHistory', 'revisedAt') IS NULL
    ALTER TABLE GradeHistory ADD revisedAt DATETIME NULL;
GO

IF COL_LENGTH('Notifications', 'stallId') IS NULL
    ALTER TABLE Notifications ADD stallId INT NULL FOREIGN KEY REFERENCES Stalls(stallId);
GO
IF COL_LENGTH('Notifications', 'inspectionDate') IS NULL
    ALTER TABLE Notifications ADD inspectionDate DATE NULL;
GO
