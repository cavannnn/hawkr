USE HawkerDatabase;
GO

SET QUOTED_IDENTIFIER ON;
GO

/* ===========================================================
   Rental renewals: contract type/name on RentalAgreements, and
   the RentalRenewalRequests workflow table (vendor requests a
   renewal, operator sets a new price and approves/rejects it).
   =========================================================== */

IF COL_LENGTH('RentalAgreements', 'ContractType') IS NULL
  ALTER TABLE RentalAgreements ADD ContractType VARCHAR(30) NOT NULL CONSTRAINT DfRentalAgreementsContractType DEFAULT 'Fixed Price';
GO

IF COL_LENGTH('RentalAgreements', 'ContractName') IS NULL
  ALTER TABLE RentalAgreements ADD ContractName VARCHAR(100) NULL;
GO

UPDATE ra SET ContractName = u.username
FROM RentalAgreements ra
JOIN UserAccounts u ON u.userId = ra.OwnerId
WHERE ra.ContractName IS NULL;
GO

IF OBJECT_ID('RentalRenewalRequests', 'U') IS NULL
CREATE TABLE RentalRenewalRequests (
    RenewalRequestId INT IDENTITY(1,1) PRIMARY KEY,
    AgreementId INT NOT NULL FOREIGN KEY REFERENCES RentalAgreements(AgreementId),
    StallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    VendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    Status VARCHAR(20) NOT NULL CONSTRAINT DfRentalRenewalRequestsStatus DEFAULT 'pending'
        CHECK (Status IN ('pending', 'approved', 'rejected')),
    ProposedRentalPrice DECIMAL(10,2) NULL,
    ReviewedBy INT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    ReviewNote VARCHAR(255) NULL,
    RequestedAt DATETIME NOT NULL CONSTRAINT DfRentalRenewalRequestsRequestedAt DEFAULT GETDATE(),
    ReviewedAt DATETIME NULL,
    NewAgreementId INT NULL FOREIGN KEY REFERENCES RentalAgreements(AgreementId)
);
GO

-- Only one open renewal request per agreement at a time
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UqRentalRenewalRequestsPendingPerAgreement')
CREATE UNIQUE INDEX UqRentalRenewalRequestsPendingPerAgreement
    ON RentalRenewalRequests(AgreementId) WHERE Status = 'pending';
GO
