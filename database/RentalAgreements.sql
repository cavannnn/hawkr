USE HawkerDatabase;
GO

IF OBJECT_ID('RentalAgreements', 'U') IS NULL
CREATE TABLE RentalAgreements (
    AgreementId INT IDENTITY(1,1) PRIMARY KEY,
    StallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    OwnerId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    AgreementStartDate DATETIME2 NOT NULL,
    AgreementEndDate DATETIME2 NOT NULL,
    AgreementTermsAndConditions NVARCHAR(MAX) NOT NULL,
    RentalPrice DECIMAL(10,2) NOT NULL,
    CONSTRAINT CkRentalAgreementsEndDate CHECK (AgreementEndDate > AgreementStartDate),
    CONSTRAINT CkRentalAgreementsRentalPrice CHECK (RentalPrice > 0)
);
GO
