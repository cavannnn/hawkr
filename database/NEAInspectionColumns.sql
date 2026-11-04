USE HawkerDatabase;
GO

IF COL_LENGTH('Inspections', 'isAutoScheduled') IS NULL
    ALTER TABLE Inspections ADD isAutoScheduled BIT NOT NULL
        CONSTRAINT DfInspectionsIsAutoScheduled DEFAULT 0;
GO

IF COL_LENGTH('Inspections', 'createdAt') IS NULL
    ALTER TABLE Inspections ADD createdAt DATETIME2 NOT NULL
        CONSTRAINT DfInspectionsCreatedAt DEFAULT GETDATE();
GO
