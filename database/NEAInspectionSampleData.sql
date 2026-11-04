USE HawkerDatabase;
GO

DECLARE @Officer INT;
DECLARE @StallA INT, @StallB INT, @StallC INT, @StallD INT, @StallE INT,
        @StallF INT, @StallG INT;
DECLARE @I1 INT, @I2 INT, @I3 INT, @I4 INT, @I5 INT, @I6 INT,
        @I7 INT, @I8 INT, @I9 INT, @I10 INT, @I11 INT, @I12 INT,
        @I13 INT, @I14 INT, @I15 INT, @I16 INT;

SELECT @Officer = userId FROM UserAccounts WHERE username = N'neaofficer';

SELECT @StallA = stallId FROM Stalls WHERE stallName = N'Jian Bo Shui Kueh';
SELECT @StallB = stallId FROM Stalls WHERE stallName = N'Tiong Bahru Fried Carrot Cake';
SELECT @StallC = stallId FROM Stalls WHERE stallName = N'Rojak Jin Long';
SELECT @StallD = stallId FROM Stalls WHERE stallName = N'Lao Fu Zi Fried Kway Teow';
SELECT @StallE = stallId FROM Stalls WHERE stallName = N'To-Ricos Curry Puff';
SELECT @StallF = stallId FROM Stalls WHERE stallName = N'Tiong Bahru Lor Mee';
SELECT @StallG = stallId FROM Stalls WHERE stallName = N'Liang Kee Roasted Meat';

UPDATE Stalls SET performanceStartDate = CAST(DATEADD(YEAR, -4, GETDATE()) AS DATE) WHERE stallId = @StallA;
UPDATE Stalls SET performanceStartDate = CAST(DATEADD(YEAR, -2, GETDATE()) AS DATE) WHERE stallId = @StallB;
UPDATE Stalls SET performanceStartDate = CAST(DATEADD(YEAR, -3, GETDATE()) AS DATE) WHERE stallId = @StallC;
UPDATE Stalls SET performanceStartDate = CAST(DATEADD(YEAR, -5, GETDATE()) AS DATE) WHERE stallId = @StallD;
UPDATE Stalls SET performanceStartDate = CAST(DATEADD(MONTH, -18, GETDATE()) AS DATE) WHERE stallId = @StallE;
UPDATE Stalls SET performanceStartDate = CAST(DATEADD(YEAR, -6, GETDATE()) AS DATE) WHERE stallId = @StallF;
UPDATE Stalls SET performanceStartDate = CAST(DATEADD(YEAR, -2, GETDATE()) AS DATE) WHERE stallId = @StallG;

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallA, @Officer, CAST(DATEADD(MONTH, -26, GETDATE()) AS DATE), 'Completed', 4, N'Premises clean. Chiller temperature logged correctly.', 1, 1, 1, 0, DATEADD(MONTH, -27, GETDATE()));
SET @I1 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, assessmentUpdatedAt, createdAt)
VALUES (@StallA, @Officer, CAST(DATEADD(MONTH, -1, GETDATE()) AS DATE), 'Completed', 5, N'Excellent standards throughout. Score revised up after review of the chiller logs.', 1, 1, 1, 0, DATEADD(DAY, -20, GETDATE()), DATEADD(MONTH, -2, GETDATE()));
SET @I2 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'A', majorIssueCount = 0,
                  preIssueGrade = NULL, probationStartDate = NULL, probationInspectionId = NULL
WHERE stallId = @StallA;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallA, 'B', CAST(DATEADD(MONTH, -26, GETDATE()) AS DATE), @I1, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallA, 'A', CAST(DATEADD(MONTH, -1, GETDATE()) AS DATE), @I2, 1, DATEADD(DAY, -20, GETDATE()));

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallB, @Officer, CAST(DATEADD(MONTH, -9, GETDATE()) AS DATE), 'Completed', 4, N'Satisfactory. Minor housekeeping advice given.', 1, 1, 1, 0, DATEADD(MONTH, -10, GETDATE()));
SET @I3 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallB, @Officer, CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE), 'Completed', 2, N'Live pest activity observed in the dry store. Immediate rectification ordered.', 0, 0, 0, 1, DATEADD(MONTH, -3, GETDATE()));
SET @I4 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'C', majorIssueCount = 1,
                  preIssueGrade = 'B',
                  probationStartDate = CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE),
                  probationInspectionId = @I4
WHERE stallId = @StallB;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallB, 'B', CAST(DATEADD(MONTH, -9, GETDATE()) AS DATE), @I3, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallB, 'C', CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE), @I4, 0, NULL);

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallC, @Officer, CAST(DATEADD(MONTH, -10, GETDATE()) AS DATE), 'Completed', 2, N'Raw and cooked food stored together. Major hygiene lapse.', 0, 0, 1, 1, DATEADD(MONTH, -11, GETDATE()));
SET @I5 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallC, @Officer, CAST(DATEADD(MONTH, -8, GETDATE()) AS DATE), 'Completed', 3, N'Separation corrected. Follow-up visit.', 1, 1, 1, 0, DATEADD(MONTH, -10, GETDATE()));
SET @I6 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallC, @Officer, CAST(DATEADD(MONTH, -6, GETDATE()) AS DATE), 'Completed', 4, N'Standards maintained.', 1, 1, 1, 0, DATEADD(MONTH, -8, GETDATE()));
SET @I7 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallC, @Officer, CAST(DATEADD(MONTH, -4, GETDATE()) AS DATE), 'Completed', 4, N'Standards maintained.', 1, 1, 1, 0, DATEADD(MONTH, -6, GETDATE()));
SET @I8 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallC, @Officer, CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE), 'Completed', 5, N'Consistently clean across all areas.', 1, 1, 1, 0, DATEADD(MONTH, -4, GETDATE()));
SET @I9 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallC, @Officer, CAST(DATEADD(DAY, -14, GETDATE()) AS DATE), 'Completed', 5, N'Fifth consecutive clean inspection. Probation lifted.', 1, 1, 1, 0, DATEADD(MONTH, -2, GETDATE()));
SET @I10 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'B', majorIssueCount = 1,
                  preIssueGrade = NULL, probationStartDate = NULL, probationInspectionId = NULL
WHERE stallId = @StallC;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallC, 'C', CAST(DATEADD(MONTH, -10, GETDATE()) AS DATE), @I5, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallC, 'C', CAST(DATEADD(MONTH, -8, GETDATE()) AS DATE), @I6, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallC, 'C', CAST(DATEADD(MONTH, -6, GETDATE()) AS DATE), @I7, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallC, 'C', CAST(DATEADD(MONTH, -4, GETDATE()) AS DATE), @I8, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallC, 'C', CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE), @I9, 0, NULL);
INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallC, 'B', CAST(DATEADD(DAY, -14, GETDATE()) AS DATE), @I10, 0, NULL);

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallD, @Officer, CAST(DATEADD(DAY, 10, GETDATE()) AS DATE), 'Scheduled', 0, 0, 0, 0, DATEADD(DAY, -5, GETDATE()));
SET @I11 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallE, @Officer, CAST(GETDATE() AS DATE), 'In Progress', 0, 0, 0, 0, DATEADD(DAY, -21, GETDATE()));
SET @I12 = SCOPE_IDENTITY();

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallD, @Officer, CAST(DATEADD(MONTH, -3, GETDATE()) AS DATE), 'Completed', 5, N'Long-standing stall, consistently well run.', 1, 1, 1, 0, DATEADD(MONTH, -4, GETDATE()));
SET @I13 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'A', majorIssueCount = 0 WHERE stallId = @StallD;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallD, 'A', CAST(DATEADD(MONTH, -3, GETDATE()) AS DATE), @I13, 0, NULL);

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallE, @Officer, CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE), 'Completed', 4, N'Clean throughout. Still building its record.', 1, 1, 1, 0, DATEADD(MONTH, -3, GETDATE()));
SET @I14 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'B', majorIssueCount = 0 WHERE stallId = @StallE;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallE, 'B', CAST(DATEADD(MONTH, -2, GETDATE()) AS DATE), @I14, 0, NULL);

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallF, @Officer, CAST(DATEADD(MONTH, -5, GETDATE()) AS DATE), 'Completed', 5, N'Six years without a lapse.', 1, 1, 1, 0, DATEADD(MONTH, -6, GETDATE()));
SET @I15 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'A', majorIssueCount = 0 WHERE stallId = @StallF;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallF, 'A', CAST(DATEADD(MONTH, -5, GETDATE()) AS DATE), @I15, 0, NULL);

INSERT INTO Inspections (stallId, officerId, inspectionDate, status, hygieneScore, remarks, personalHygiene, foodStorage, pestControl, isMajorIssue, createdAt)
VALUES (@StallG, @Officer, CAST(DATEADD(MONTH, -4, GETDATE()) AS DATE), 'Completed', 4, N'Satisfactory across all areas.', 1, 1, 1, 0, DATEADD(MONTH, -5, GETDATE()));
SET @I16 = SCOPE_IDENTITY();

UPDATE Stalls SET currentGrade = 'B', majorIssueCount = 0 WHERE stallId = @StallG;

INSERT INTO GradeHistory (stallId, grade, effectiveDate, inspectionId, isRevised, revisedAt)
VALUES (@StallG, 'B', CAST(DATEADD(MONTH, -4, GETDATE()) AS DATE), @I16, 0, NULL);

UPDATE Stalls SET autoSchedule = 1 WHERE stallId = @StallB;
GO
