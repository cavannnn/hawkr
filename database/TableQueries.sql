USE master;
GO

IF DB_ID(N'HawkerDatabase') IS NOT NULL
BEGIN
    ALTER DATABASE HawkerDatabase SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE HawkerDatabase;
END;
GO

CREATE DATABASE HawkerDatabase;
GO

USE HawkerDatabase;
GO

-- Table: Hawkers
CREATE TABLE Hawkers (
    HawkerId INT IDENTITY(1,1) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Address NVARCHAR(500) NOT NULL,
    PostalCode NVARCHAR(10) NOT NULL,
    OperatingHours NVARCHAR(100) NOT NULL,
    Latitude DECIMAL(9,6) NULL,
    Longitude DECIMAL(9,6) NULL,
    IsActive BIT NOT NULL CONSTRAINT DfHawkersIsActive DEFAULT 1,
    CONSTRAINT PkHawkers PRIMARY KEY (HawkerId)
);
GO

-- Table: Customers
CREATE TABLE Customers (
    CustomerId SMALLINT NOT NULL,
    CustomerNric CHAR(9) NULL,
    CustomerName VARCHAR(100) NOT NULL,
    CustomerContactNumber CHAR(8) NOT NULL,
    CustomerEmail VARCHAR(254) NOT NULL,
    CONSTRAINT PkCustomers PRIMARY KEY (CustomerId),
    CONSTRAINT UqCustomersNric UNIQUE (CustomerNric),
    CONSTRAINT UqCustomersContactNumber UNIQUE (CustomerContactNumber),
    CONSTRAINT UqCustomersEmail UNIQUE (CustomerEmail),
    CONSTRAINT CkCustomersNric CHECK (CustomerNric LIKE '[STFGM][0-9][0-9][0-9][0-9][0-9][0-9][0-9][A-Z]'),
    CONSTRAINT CkCustomersContactNumber CHECK (CustomerContactNumber NOT LIKE '%[^0-9]%'),
    CONSTRAINT CkCustomersEmail CHECK (CustomerEmail LIKE '%_@_%._%')
);
GO

-- Table: NeaOfficers
CREATE TABLE NeaOfficers (
    OfficerId SMALLINT NOT NULL,
    OfficerName VARCHAR(100) NOT NULL,
    OfficerContactNumber CHAR(8) NOT NULL,
    CONSTRAINT PkNeaOfficers PRIMARY KEY (OfficerId),
    CONSTRAINT UqNeaOfficersContactNumber UNIQUE (OfficerContactNumber),
    CONSTRAINT CkNeaOfficersContactNumber CHECK (OfficerContactNumber NOT LIKE '%[^0-9]%')
);
GO

-- Table: StallOwners
CREATE TABLE StallOwners (
    OwnerId SMALLINT NOT NULL,
    OwnerName VARCHAR(100) NOT NULL,
    OwnerNric CHAR(9) NOT NULL,
    OwnerContactNumber CHAR(8) NOT NULL,
    CONSTRAINT PkStallOwners PRIMARY KEY (OwnerId),
    CONSTRAINT UqStallOwnersNric UNIQUE (OwnerNric),
    CONSTRAINT UqStallOwnersContactNumber UNIQUE (OwnerContactNumber),
    CONSTRAINT CkStallOwnersNric CHECK (OwnerNric LIKE '[STFGM][0-9][0-9][0-9][0-9][0-9][0-9][0-9][A-Z]'),
    CONSTRAINT CkStallOwnersContactNumber CHECK (OwnerContactNumber NOT LIKE '%[^0-9]%')
);
GO

-- Table: Operators
CREATE TABLE Operators (
    OperatorId INT IDENTITY(1,1) PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL
);
GO

-- Table: UserAccounts
CREATE TABLE UserAccounts (
    UserId INT IDENTITY(1,1) NOT NULL,
    UserName NVARCHAR(50) NOT NULL,
    PasswordHash NVARCHAR(255) NOT NULL,
    Email NVARCHAR(100) NULL,
    Role NVARCHAR(20) NOT NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DfUserAccountsCreatedAt DEFAULT SYSDATETIME(),
    CONSTRAINT PkUserAccounts PRIMARY KEY (UserId),
    CONSTRAINT UqUserAccountsUserName UNIQUE (UserName),
    CONSTRAINT CkUserAccountsRole CHECK (Role IN ('vendor', 'customer', 'nea', 'admin', 'guest', 'operator'))
);
GO

-- Table: Stalls
CREATE TABLE Stalls (
    StallId INT IDENTITY(1,1) NOT NULL,
    HawkerId INT NOT NULL,
    StallName NVARCHAR(200) NOT NULL,
    StallNumber NVARCHAR(50) NOT NULL,
    CuisineType NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500) NULL,
    ContactNumber NVARCHAR(20) NULL,
    IsHalal BIT NOT NULL CONSTRAINT DfStallsIsHalal DEFAULT 0, -- Added IsHalal column (1 = True, 0 = False)
    IsActive BIT NOT NULL CONSTRAINT DfStallsIsActive DEFAULT 1,
    CONSTRAINT PkStalls PRIMARY KEY (StallId),
    CONSTRAINT UqStallsHawkerIdStallNumber UNIQUE (HawkerId, StallNumber),
    CONSTRAINT FkStallsHawkers FOREIGN KEY (HawkerId) REFERENCES Hawkers (HawkerId) ON DELETE CASCADE
);
GO

-- Table: Inspections
CREATE TABLE Inspections (
    InspectionId INT IDENTITY(1,1) NOT NULL,
    StallId INT NOT NULL,
    OfficerId SMALLINT NOT NULL,
    InspectionDate DATE NOT NULL,
    Status VARCHAR(20) NOT NULL CONSTRAINT DfInspectionsStatus DEFAULT 'Scheduled',
    Grade CHAR(1) NULL CONSTRAINT CkInspectionsGrade CHECK (Grade IN ('A', 'B', 'C')),
    CONSTRAINT PkInspections PRIMARY KEY (InspectionId),
    CONSTRAINT FkInspectionsStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId),
    CONSTRAINT FkInspectionsNeaOfficers FOREIGN KEY (OfficerId) REFERENCES NeaOfficers (OfficerId)
);
GO

-- Table: InspectionRemarks
CREATE TABLE InspectionRemarks (
    InspectionId INT NOT NULL,
    Remark VARCHAR(150) NOT NULL,
    CONSTRAINT PkInspectionRemarks PRIMARY KEY (InspectionId, Remark),
    CONSTRAINT FkInspectionRemarksInspections FOREIGN KEY (InspectionId) REFERENCES Inspections (InspectionId)
);
GO

-- Table: Complaints
CREATE TABLE Complaints (
    ComplaintId SMALLINT NOT NULL,
    Category VARCHAR(50) NOT NULL,
    StallId INT NOT NULL,
    CONSTRAINT PkComplaints PRIMARY KEY (ComplaintId),
    CONSTRAINT FkComplaintsStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId)
);
GO

-- Table: Feedback
CREATE TABLE Feedback (
    FeedbackId SMALLINT NOT NULL,
    FeedbackComment VARCHAR(150) NULL,
    FeedbackDateTime DATETIME2 NOT NULL,
    FeedbackRating TINYINT NOT NULL,
    CustomerId SMALLINT NOT NULL,
    StallId INT NOT NULL,
    CONSTRAINT PkFeedback PRIMARY KEY (FeedbackId),
    CONSTRAINT CkFeedbackRating CHECK (FeedbackRating IN (1, 2, 3, 4, 5)),
    CONSTRAINT FkFeedbackCustomers FOREIGN KEY (CustomerId) REFERENCES Customers (CustomerId),
    CONSTRAINT FkFeedbackStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId)
);
GO

-- Table: Cuisines
CREATE TABLE Cuisines (
    CuisineId SMALLINT NOT NULL,
    CuisineDescription VARCHAR(50) NOT NULL,
    StallId INT NOT NULL,
    CONSTRAINT PkCuisines PRIMARY KEY (CuisineId),
    CONSTRAINT UqCuisinesCuisineIdStallId UNIQUE (CuisineId, StallId),
    CONSTRAINT FkCuisinesStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId)
);
GO

-- Table: MenuItems
CREATE TABLE MenuItems (
    StallId INT NOT NULL,
    ItemCode VARCHAR(10) NOT NULL,
    ItemName VARCHAR(50) NOT NULL,
    ItemDescription VARCHAR(150) NOT NULL,
    ItemPrice DECIMAL(10,2) NOT NULL,
    ItemCategory VARCHAR(25) NOT NULL,
    CONSTRAINT PkMenuItems PRIMARY KEY (StallId, ItemCode),
    CONSTRAINT CkMenuItemsPrice CHECK (ItemPrice > 0),
    CONSTRAINT FkMenuItemsStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId)
);
GO

-- Table: MenuItemCuisines
CREATE TABLE MenuItemCuisines (
    CuisineId SMALLINT NOT NULL,
    StallId INT NOT NULL,
    ItemCode VARCHAR(10) NOT NULL,
    CONSTRAINT PkMenuItemCuisines PRIMARY KEY (CuisineId, StallId, ItemCode),
    CONSTRAINT FkMenuItemCuisinesCuisines FOREIGN KEY (CuisineId, StallId) REFERENCES Cuisines (CuisineId, StallId),
    CONSTRAINT FkMenuItemCuisinesMenuItems FOREIGN KEY (StallId, ItemCode) REFERENCES MenuItems (StallId, ItemCode)
);
GO

-- Table: Likes
CREATE TABLE Likes (
    CustomerId SMALLINT NOT NULL,
    StallId INT NOT NULL,
    ItemCode VARCHAR(10) NOT NULL,
    CONSTRAINT PkLikes PRIMARY KEY (CustomerId, StallId, ItemCode),
    CONSTRAINT FkLikesCustomers FOREIGN KEY (CustomerId) REFERENCES Customers (CustomerId),
    CONSTRAINT FkLikesMenuItems FOREIGN KEY (StallId, ItemCode) REFERENCES MenuItems (StallId, ItemCode)
);
GO

-- Table: Orders
CREATE TABLE Orders (
    OrderId INT IDENTITY(1,1) NOT NULL,
    StallId INT NOT NULL,
    CustomerId INT NULL, -- Added to track repeat customers
    CustomerName NVARCHAR(100) NOT NULL,
    CustomerPhone NVARCHAR(20) NULL,
    OrderDate DATETIME2 NOT NULL CONSTRAINT DfOrdersOrderDate DEFAULT SYSDATETIME(),
    OrderStatus NVARCHAR(20) NOT NULL CONSTRAINT DfOrdersOrderStatus DEFAULT 'pending',
    TotalAmount DECIMAL(10,2) NOT NULL,
    PaymentMethod NVARCHAR(20) NOT NULL CONSTRAINT DfOrdersPaymentMethod DEFAULT 'cash',
    PaymentStatus NVARCHAR(20) NOT NULL CONSTRAINT DfOrdersPaymentStatus DEFAULT 'pending',
    SpecialInstructions NVARCHAR(500) NULL,
    CONSTRAINT PkOrders PRIMARY KEY (OrderId),
    CONSTRAINT UqOrdersOrderIdStallId UNIQUE (OrderId, StallId),
    CONSTRAINT CkOrdersTotalAmount CHECK (TotalAmount >= 0),
    CONSTRAINT FkOrdersStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId) ON DELETE CASCADE
);
GO

-- Table: OrderItems
CREATE TABLE OrderItems (
    OrderId INT NOT NULL,
    OrderItemId INT NOT NULL,
    StallId INT NOT NULL,
    ItemCode VARCHAR(10) NOT NULL,
    ItemName NVARCHAR(200) NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(10,2) NOT NULL,
    Subtotal DECIMAL(10,2) NOT NULL,
    SpecialRequests NVARCHAR(500) NULL,
    CONSTRAINT PkOrderItems PRIMARY KEY (OrderId, OrderItemId),
    CONSTRAINT CkOrderItemsQuantity CHECK (Quantity > 0),
    CONSTRAINT CkOrderItemsUnitPrice CHECK (UnitPrice >= 0),
    CONSTRAINT CkOrderItemsSubtotal CHECK (Subtotal >= 0),
    CONSTRAINT FkOrderItemsOrders FOREIGN KEY (OrderId, StallId) REFERENCES Orders (OrderId, StallId) ON DELETE CASCADE,
    CONSTRAINT FkOrderItemsMenuItems FOREIGN KEY (StallId, ItemCode) REFERENCES MenuItems (StallId, ItemCode)
);
GO

-- Table: VendorDashboards
CREATE TABLE VendorDashboards (
    DashboardId INT IDENTITY(1,1) NOT NULL,
    VendorId INT NOT NULL,
    TotalRevenue DECIMAL(18,2) NOT NULL CONSTRAINT DfVendorDashboardsTotalRevenue DEFAULT 0,
    TotalOrders INT NOT NULL CONSTRAINT DfVendorDashboardsTotalOrders DEFAULT 0,
    TotalCustomers INT NOT NULL CONSTRAINT DfVendorDashboardsTotalCustomers DEFAULT 0,
    MonthlySalesTrend NVARCHAR(MAX) NULL,
    RevenueSplit NVARCHAR(MAX) NULL,
    TopSellingItems NVARCHAR(MAX) NULL,
    LastUpdated DATETIME2 NOT NULL CONSTRAINT DfVendorDashboardsLastUpdated DEFAULT SYSDATETIME(),
    CONSTRAINT PkVendorDashboards PRIMARY KEY (DashboardId),
    CONSTRAINT FkVendorDashboardsUserAccounts FOREIGN KEY (VendorId) REFERENCES UserAccounts (UserId)
);
GO

-- Table: Promotions
CREATE TABLE Promotions (
    PromotionId SMALLINT NOT NULL,
    PromotionDescription VARCHAR(150) NOT NULL,
    PromotionStartDate DATETIME2 NOT NULL,
    PromotionEndDate DATETIME2 NOT NULL,
    StallId INT NOT NULL,
    CONSTRAINT PkPromotions PRIMARY KEY (PromotionId),
    CONSTRAINT CkPromotionsEndDate CHECK (PromotionEndDate > PromotionStartDate),
    CONSTRAINT FkPromotionsStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId)
);
GO

-- Table: RentalAgreements
CREATE TABLE RentalAgreements (
    AgreementId SMALLINT IDENTITY(1,1) NOT NULL,
    AgreementStartDate DATETIME2 NOT NULL,
    AgreementEndDate DATETIME2 NOT NULL,
    AgreementTermsAndConditions VARCHAR(MAX) NOT NULL,
    RentalPrice DECIMAL(10,2) NOT NULL,
    OwnerId SMALLINT NOT NULL,
    StallId INT NOT NULL,
    CONSTRAINT PkRentalAgreements PRIMARY KEY (AgreementId),
    CONSTRAINT CkRentalAgreementsEndDate CHECK (AgreementEndDate > AgreementStartDate),
    CONSTRAINT CkRentalAgreementsRentalPrice CHECK (RentalPrice > 0),
    CONSTRAINT FkRentalAgreementsStallOwners FOREIGN KEY (OwnerId) REFERENCES StallOwners (OwnerId),
    CONSTRAINT FkRentalAgreementsStalls FOREIGN KEY (StallId) REFERENCES Stalls (StallId)
);
GO