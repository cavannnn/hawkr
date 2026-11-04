USE HawkerDatabase;
GO

/* ===========================================================
   Operator Profile + Centre Management (adapted from jay_branch)
   jay_branch's own tables/queries were written against a sibling
   schema (PascalCase UserAccounts.UserId/UserName/PhoneNumber/
   ProfilePhotoPath, a Hawkers table, a separate Operators table)
   that doesn't exist on this live database. The tables below use
   jay's own PascalCase naming for their OWN columns (matching the
   precedent already set by RentalAgreements/RentalRenewalRequests
   in this schema), but every FOREIGN KEY points at this database's
   real tables: UserAccounts(userId), HawkerCentres(centreId),
   Stalls(stallId), Promotions(promotionId).
   =========================================================== */

-- Many-to-many: which hawker centres an operator manages.
IF OBJECT_ID('OperatorHawkerAssignments', 'U') IS NULL
CREATE TABLE OperatorHawkerAssignments (
    AssignmentId INT IDENTITY(1,1) PRIMARY KEY,
    OperatorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    HawkerId INT NOT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    CONSTRAINT UqOperatorHawkerAssignments UNIQUE (OperatorId, HawkerId)
);
GO

-- One row per scheduled/active/completed centre closure.
IF OBJECT_ID('CentreClosure', 'U') IS NULL
CREATE TABLE CentreClosure (
    ClosureId INT IDENTITY(1,1) PRIMARY KEY,
    HawkerId INT NOT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    Reason NVARCHAR(30) NOT NULL CONSTRAINT CkCentreClosureReason CHECK (Reason IN (
        'Cleaning', 'Maintenance', 'Public Holiday', 'Special Event', 'Other'
    )),
    StartDateTime DATETIME2 NOT NULL,
    EndDateTime DATETIME2 NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DfCentreClosureStatus DEFAULT ('Scheduled')
        CONSTRAINT CkCentreClosureStatus CHECK (Status IN ('Scheduled', 'Active', 'Completed', 'Cancelled')),
    CreatedByOperatorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    Notes NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DfCentreClosureCreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CkCentreClosureDates CHECK (EndDateTime > StartDateTime)
);
GO

-- Centre-level amenity feedback (cleanliness, seating, toilets, etc.),
-- distinct from a stall's own review. No submission UI exists yet in this
-- app (that's a separate, unbuilt feature) — this table just backs the
-- Satisfaction tab so it has somewhere real to read from once one exists.
IF OBJECT_ID('HawkerFeedback', 'U') IS NULL
CREATE TABLE HawkerFeedback (
    FeedbackId INT IDENTITY(1,1) PRIMARY KEY,
    HawkerId INT NOT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    CustomerId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    Rating INT NOT NULL CONSTRAINT CkHawkerFeedbackRating CHECK (Rating BETWEEN 1 AND 5),
    FacilityTag NVARCHAR(30) NOT NULL CONSTRAINT CkHawkerFeedbackFacilityTag CHECK (FacilityTag IN (
        'Cleanliness', 'Seating', 'Toilets', 'Ventilation', 'Queue', 'Other'
    )),
    Comment NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DfHawkerFeedbackCreatedAt DEFAULT SYSDATETIME()
);
GO

-- Operator-created, centre-wide promotional campaign — distinct from the
-- existing Promotions table, which is a single stall's own promotion.
IF OBJECT_ID('CentrePromotion', 'U') IS NULL
CREATE TABLE CentrePromotion (
    PromotionId INT IDENTITY(1,1) PRIMARY KEY,
    HawkerId INT NOT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    DiscountType NVARCHAR(20) NOT NULL CONSTRAINT CkCentrePromotionDiscountType CHECK (DiscountType IN ('Percentage', 'FixedAmount')),
    DiscountValue DECIMAL(6, 2) NOT NULL,
    StartDateTime DATETIME2 NOT NULL,
    EndDateTime DATETIME2 NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DfCentrePromotionStatus DEFAULT ('Upcoming')
        CONSTRAINT CkCentrePromotionStatus CHECK (Status IN ('Upcoming', 'Active', 'Archived')),
    CreatedByOperatorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DfCentrePromotionCreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT CkCentrePromotionDates CHECK (EndDateTime > StartDateTime)
);
GO

-- Junction table: which stalls a centre-wide promotion targets.
IF OBJECT_ID('CentrePromotionStall', 'U') IS NULL
CREATE TABLE CentrePromotionStall (
    PromotionId INT NOT NULL FOREIGN KEY REFERENCES CentrePromotion(PromotionId),
    StallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    CONSTRAINT PkCentrePromotionStall PRIMARY KEY (PromotionId, StallId)
);
GO

-- A vendor's own Promotions row that breaches an operator rule is routed
-- here for review instead of publishing directly. Nothing in this pull
-- currently inserts into this queue (that hook lives in the vendor-side
-- promotion creation flow, which this change intentionally leaves
-- untouched) — it's wired up and ready, just starts empty.
IF OBJECT_ID('PromotionApprovalQueue', 'U') IS NULL
CREATE TABLE PromotionApprovalQueue (
    ApprovalId INT IDENTITY(1,1) PRIMARY KEY,
    StallPromotionId INT NOT NULL FOREIGN KEY REFERENCES Promotions(promotionId),
    Status NVARCHAR(20) NOT NULL CONSTRAINT DfPromotionApprovalQueueStatus DEFAULT ('Pending')
        CONSTRAINT CkPromotionApprovalQueueStatus CHECK (Status IN ('Pending', 'Approved', 'Rejected')),
    ReviewedByOperatorId INT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    ReviewNotes NVARCHAR(500) NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DfPromotionApprovalQueueCreatedAt DEFAULT SYSDATETIME(),
    ReviewedAt DATETIME2 NULL
);
GO
