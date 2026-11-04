USE HawkerDatabase;
GO

UPDATE Stalls SET currentGrade = 'NEW' WHERE currentGrade IS NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkStallsHygieneGrade')
    ALTER TABLE Stalls DROP CONSTRAINT CkStallsHygieneGrade;
GO
IF COL_LENGTH('Stalls', 'hygieneGrade') IS NOT NULL
    ALTER TABLE Stalls DROP COLUMN hygieneGrade;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkStallRequestsHygieneGrade')
    ALTER TABLE StallRequests DROP CONSTRAINT CkStallRequestsHygieneGrade;
GO
UPDATE StallRequests SET hygieneGrade = NULL
WHERE hygieneGrade IS NOT NULL AND hygieneGrade NOT IN ('A', 'B');
GO
ALTER TABLE StallRequests ADD CONSTRAINT CkStallRequestsHygieneGrade
    CHECK (hygieneGrade IN ('A', 'B'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DfStallsCurrentGrade')
    ALTER TABLE Stalls ADD CONSTRAINT DfStallsCurrentGrade DEFAULT 'NEW' FOR currentGrade;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkStallsCurrentGrade')
    ALTER TABLE Stalls ADD CONSTRAINT CkStallsCurrentGrade
        CHECK (currentGrade IN ('A', 'B', 'C', 'NEW'));
GO
