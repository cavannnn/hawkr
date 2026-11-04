USE HawkerDatabase;
GO

/* ===========================================================
   Extra stall details: operating hours, hygiene grade, and a
   photo. Vendors fill these in on the request form; once
   approved the same details are copied onto the live Stalls row.
   =========================================================== */

IF COL_LENGTH('StallRequests', 'operatingHours') IS NULL
    ALTER TABLE StallRequests ADD operatingHours VARCHAR(50) NULL;
GO
IF COL_LENGTH('StallRequests', 'hygieneGrade') IS NULL
    ALTER TABLE StallRequests ADD hygieneGrade CHAR(1) NULL
        CONSTRAINT CkStallRequestsHygieneGrade CHECK (hygieneGrade IN ('A', 'B'));
GO
IF COL_LENGTH('StallRequests', 'imageUrl') IS NULL
    ALTER TABLE StallRequests ADD imageUrl VARCHAR(500) NULL;
GO

IF COL_LENGTH('Stalls', 'operatingHours') IS NULL
    ALTER TABLE Stalls ADD operatingHours VARCHAR(50) NULL;
GO
IF COL_LENGTH('Stalls', 'imageUrl') IS NULL
    ALTER TABLE Stalls ADD imageUrl VARCHAR(500) NULL;
GO
