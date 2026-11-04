USE HawkerDatabase;
GO

/* ===========================================================
   Stall requests
   A vendor fills in a form to ask for a stall. An admin
   approves or rejects it. Once approved the stall is added to
   the Stalls table and belongs to that vendor.
   =========================================================== */

IF OBJECT_ID('dbo.StallRequests', 'U') IS NOT NULL
    DROP TABLE dbo.StallRequests;
GO

CREATE TABLE StallRequests (
    requestId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    centreId INT NOT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    stallName VARCHAR(100) NOT NULL,
    unitNumber VARCHAR(20) NOT NULL,
    description VARCHAR(255) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewNote VARCHAR(255) NULL,
    requestedAt DATETIME DEFAULT GETDATE(),
    reviewedAt DATETIME NULL
);
GO

/* The hawker centres a vendor can choose from in the form. */
IF NOT EXISTS (SELECT 1 FROM HawkerCentres)
BEGIN
    INSERT INTO HawkerCentres (centreName, address, postalCode) VALUES
    ('East Coast Lagoon Food Village', '1220 East Coast Parkway', '468960'),
    ('Tekka Centre', '665 Buffalo Road', '210665'),
    ('Tiong Bahru Market', '30 Seng Poh Road', '168898'),
    ('Old Airport Road Food Centre', '51 Old Airport Road', '390051'),
    ('Maxwell Food Centre', '1 Kadayanallur Street', '069184');
END;
GO
