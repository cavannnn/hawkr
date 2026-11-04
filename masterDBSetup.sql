/* ===========================================================================
   masterDBSetup.sql

   The whole HawkerDatabase build in one file: every .sql migration in
   database\ that the app actually needs, concatenated in the order
   database\setup-database.ps1 runs them, with that script's inline patches
   folded in at the same points.

   DESTRUCTIVE: section 1 drops and recreates HawkerDatabase.

   Run it:
       sqlcmd -S localhost\SQLEXPRESS -E -b -I -i masterDBSetup.sql
   or open it in SSMS and Execute (SSMS sets QUOTED_IDENTIFIER ON already;
   sqlcmd does not, hence -I -- without it the filtered index on
   RentalRenewalRequests makes every later write fail with Msg 1934).

   The source files are left untouched; this is a flattened copy of them.
   Three edits were needed to make the concatenation run clean end to end:
     - a hawker_user LOGIN is created first, because HawkerDatabase.sql maps
       a database user to a login that must already exist;
     - VendorProfileFields.sql has no USE of its own (setup-database.ps1
       supplied the database via sqlcmd -d), and a stray leading "1"
       character before its comment block, so both are corrected here;
     - SampleData.sql's closing row-count report aliases a column as
       RowCount, a reserved word, which is a syntax error; it is quoted as
       [RowCount] here so the file no longer ends in an error.

   ONE GRADE, NOT TWO. Stalls.hygieneGrade is gone from this build. It was a
   value the VENDOR picked on their own stall request form, copied onto the live
   stall at approval and never updated again, while Stalls.currentGrade -- the
   one an NEA inspection actually writes -- sat beside it. The vendor and
   operator screens read the vendor's own letter, so nine of the fifteen seeded
   stalls displayed a better grade than the inspector had recorded.

   StallRequests.hygieneGrade IS KEPT, narrowed to A or B. On an application it
   is an honest claim about a stall that traded before this system existed, and
   the operator reviewing the request should see it. Approval converts it into
   Stalls.performanceStartDate, so it decides how the FIRST inspection grades
   the stall rather than granting a grade on its own. Until that inspection the
   stall reads NEW and sits in the officer's ungraded queue.

   StallGradeConsolidation.sql is therefore no longer excluded -- its Stalls
   drop, its DEFAULT and its CHECK are folded in at sections 10 and 23. Only its
   StallRequests drop is omitted, for the reason above.
   =========================================================================== */

/* ###########################################################################
   0. SERVER LOGIN
   HawkerDatabase.sql runs CREATE USER [hawker_user] FOR LOGIN [hawker_user],
   which fails if the server-level login does not exist yet. Password matches
   the default in setup-database.ps1 / the app's db config.
   ########################################################################### */
USE master;
GO
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'hawker_user')
    CREATE LOGIN [hawker_user] WITH PASSWORD = 'hawker123', CHECK_POLICY = OFF;
GO

/* ###########################################################################
   1. BASE SCHEMA   (from HawkerDatabase.sql)
   Drops and recreates HawkerDatabase, then creates the core and
   business tables: UserAccounts, HawkerCentres, Stalls, Inspections,
   Menus, Orders, VendorDashboard, plus their indexes.
   ########################################################################### */
/* ===========================
   DROP & RECREATE DATABASE
   =========================== */
USE master;
GO

IF EXISTS (SELECT * FROM sys.databases WHERE name = 'HawkerDatabase')
    DROP DATABASE HawkerDatabase;
GO

CREATE DATABASE HawkerDatabase;
GO

USE HawkerDatabase;
GO

/* ===========================
   CREATE USER LOGIN
   =========================== */
-- The server-level LOGIN is created in section 0 above
CREATE USER [hawker_user] FOR LOGIN [hawker_user] WITH DEFAULT_SCHEMA=[dbo];
GO
ALTER ROLE [db_datareader] ADD MEMBER [hawker_user];
GO
ALTER ROLE [db_datawriter] ADD MEMBER [hawker_user];
GO

/* ===========================
   CORE TABLES
   =========================== */
-- UserAccounts must come first
CREATE TABLE [dbo].[UserAccounts] (
    userId INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    passwordHash NVARCHAR(255) NOT NULL,
    email NVARCHAR(100),
    role NVARCHAR(20) NOT NULL CHECK (role IN ('vendor','customer','nea','guest')),
    createdAt DATETIME DEFAULT GETDATE()
);
GO

CREATE TABLE [dbo].[HawkerCentres] (
    centreId INT IDENTITY(1,1) PRIMARY KEY,
    centreName VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    postalCode VARCHAR(10) NOT NULL
);
GO

CREATE TABLE [dbo].[Stalls] (
    stallId INT IDENTITY(1,1) PRIMARY KEY,
    centreId INT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    vendorId INT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    stallName VARCHAR(100) NOT NULL,
    unitNumber VARCHAR(20) NOT NULL
);
GO

CREATE TABLE [dbo].[Inspections] (
    inspectionId INT IDENTITY(1,1) PRIMARY KEY,
    stallId INT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    officerId INT NOT NULL,
    inspectionDate DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
);
GO

/* ===========================
   BUSINESS TABLES
   =========================== */
CREATE TABLE [dbo].[Menus] (
    menuId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT FOREIGN KEY REFERENCES UserAccounts(userId),
    itemName NVARCHAR(100),
    price DECIMAL(18,2),
    available BIT DEFAULT 1
);
GO

CREATE TABLE [dbo].[Orders] (
    orderId INT IDENTITY(1,1) PRIMARY KEY,
    customerId INT FOREIGN KEY REFERENCES UserAccounts(userId),
    vendorId INT FOREIGN KEY REFERENCES UserAccounts(userId),
    orderDate DATETIME DEFAULT GETDATE(),
    status NVARCHAR(20) DEFAULT 'pending',
    totalAmount DECIMAL(18,2)
);
GO

CREATE TABLE [dbo].[VendorDashboard] (
    dashboardId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT FOREIGN KEY REFERENCES UserAccounts(userId),
    totalRevenue DECIMAL(18,2) DEFAULT 0,
    totalOrders INT DEFAULT 0,
    totalCustomers INT DEFAULT 0,
    monthlySalesTrend NVARCHAR(MAX),
    revenueSplit NVARCHAR(MAX),
    topSellingItems NVARCHAR(MAX),
    lastUpdated DATETIME DEFAULT GETDATE()
);
GO

/* ===========================
   INDEXES FOR PERFORMANCE
   =========================== */
CREATE INDEX IX_UserAccounts_Username ON UserAccounts(username);
CREATE INDEX IX_UserAccounts_Role ON UserAccounts(role);
CREATE INDEX IX_Orders_VendorId ON Orders(vendorId);
CREATE INDEX IX_Orders_CustomerId ON Orders(customerId);
CREATE INDEX IX_Menus_VendorId ON Menus(vendorId);
GO


/* ###########################################################################
   2. USERACCOUNTS ROLE CONSTRAINT   (from UserAccountsRoleConstraint.sql)
   Widens the allowed roles to include 'operator'.
   ########################################################################### */
/* ===========================================================
   UserAccounts.Role — allowed roles
   Valid roles: vendor, customer, nea, operator, guest.
   =========================================================== */

USE HawkerDatabase;
GO

UPDATE UserAccounts SET role = 'operator' WHERE role = 'admin';
GO

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CkUserAccountsRole' AND parent_object_id = OBJECT_ID('UserAccounts')
)
    ALTER TABLE UserAccounts DROP CONSTRAINT CkUserAccountsRole;
GO

ALTER TABLE UserAccounts
    ADD CONSTRAINT CkUserAccountsRole CHECK (role IN ('vendor','customer','nea','operator','guest'));
GO

/* --- patch: drop the leftover 4-role CHECK on UserAccounts.role -------------
   HawkerDatabase.sql declares the role check INLINE, so on a fresh build it is
   auto-named (CK__UserAccoun__role__xxxxxxxx) and still lists only
   vendor/customer/nea/guest. The file above only drops 'CkUserAccountsRole' by
   name, so it misses that one and its own 5-role constraint ends up ANDed with
   the old 4-role one -- every 'operator' insert in the sample data would then
   fail with Msg 547. */
DECLARE @drop NVARCHAR(MAX) = N'';
SELECT @drop = @drop + N'ALTER TABLE UserAccounts DROP CONSTRAINT ' + QUOTENAME(cc.name) + N';'
FROM sys.check_constraints cc
LEFT JOIN sys.columns c ON c.object_id = cc.parent_object_id AND c.column_id = cc.parent_column_id
WHERE cc.parent_object_id = OBJECT_ID('UserAccounts')
  AND cc.name <> 'CkUserAccountsRole'
  AND (c.name = 'role' OR cc.definition LIKE '%[[]role]%');
EXEC sp_executesql @drop;
ALTER TABLE UserAccounts WITH CHECK CHECK CONSTRAINT ALL;
GO

/* ###########################################################################
   3. VENDOR PROFILE FIELDS   (from VendorProfileFields.sql)
   contactNumber / gender / profilePicture on UserAccounts.
   USE added here: the original file has none.
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Vendor profile fields
   Adds the optional fields a vendor can fill in from the
   Profile page (contact number, gender, profile picture).
   profilePicture stores the uploaded file's path under
   public/uploads/avatars/,
   set via POST /vendor/:id/profile/picture
   =========================================================== */

IF COL_LENGTH('UserAccounts', 'contactNumber') IS NULL
    ALTER TABLE UserAccounts ADD contactNumber NVARCHAR(20) NULL;
GO

IF COL_LENGTH('UserAccounts', 'gender') IS NULL
    ALTER TABLE UserAccounts ADD gender NVARCHAR(20) NULL;
GO

IF COL_LENGTH('UserAccounts', 'profilePicture') IS NULL
    ALTER TABLE UserAccounts ADD profilePicture NVARCHAR(500) NULL;
GO


/* ###########################################################################
   4. CUSTOMER MODULE MERGE   (from CustomerModuleMerge.sql)
   Customer-facing columns on Stalls/HawkerCentres/Menus/Orders,
   plus the OrderItems and Favorites tables.
   ########################################################################### */
USE HawkerDatabase;
GO

-- Stalls: customer-facing catalog metadata that only existed in HawkerCentreDB.Stalls
IF COL_LENGTH('Stalls', 'cuisineType') IS NULL ALTER TABLE Stalls ADD cuisineType NVARCHAR(50) NULL;
IF COL_LENGTH('Stalls', 'description') IS NULL ALTER TABLE Stalls ADD description NVARCHAR(500) NULL;
IF COL_LENGTH('Stalls', 'contactNumber') IS NULL ALTER TABLE Stalls ADD contactNumber NVARCHAR(20) NULL;
IF COL_LENGTH('Stalls', 'isActive') IS NULL ALTER TABLE Stalls ADD isActive BIT NOT NULL CONSTRAINT DfStallsIsActive DEFAULT 1;
GO

-- HawkerCentres: fields the customer module tracked that the vendor side never needed
IF COL_LENGTH('HawkerCentres', 'operatingHours') IS NULL ALTER TABLE HawkerCentres ADD operatingHours NVARCHAR(100) NULL;
IF COL_LENGTH('HawkerCentres', 'isActive') IS NULL ALTER TABLE HawkerCentres ADD isActive BIT NOT NULL CONSTRAINT DfHawkerCentresIsActive DEFAULT 1;
GO

-- Menus: a menu item now optionally belongs to a specific stall (customer catalog items),
-- in addition to the existing vendorId link (a real vendor's own menu management).
IF COL_LENGTH('Menus', 'stallId') IS NULL ALTER TABLE Menus ADD stallId INT NULL FOREIGN KEY REFERENCES Stalls(stallId);
IF COL_LENGTH('Menus', 'category') IS NULL ALTER TABLE Menus ADD category NVARCHAR(50) NULL;
IF COL_LENGTH('Menus', 'description') IS NULL ALTER TABLE Menus ADD description NVARCHAR(500) NULL;
GO

-- Orders: link an order to the stall it was placed at, plus payment/fulfilment metadata
-- that only existed in HawkerCentreDB.Orders.
IF COL_LENGTH('Orders', 'stallId') IS NULL ALTER TABLE Orders ADD stallId INT NULL FOREIGN KEY REFERENCES Stalls(stallId);
IF COL_LENGTH('Orders', 'paymentMethod') IS NULL ALTER TABLE Orders ADD paymentMethod NVARCHAR(20) NULL;
IF COL_LENGTH('Orders', 'paymentStatus') IS NULL ALTER TABLE Orders ADD paymentStatus NVARCHAR(20) NULL;
IF COL_LENGTH('Orders', 'specialInstructions') IS NULL ALTER TABLE Orders ADD specialInstructions NVARCHAR(500) NULL;
-- customerId is nullable and meant to reference UserAccounts, but the customer module
-- doesn't have a real login wired in yet (see public/js/customer/customer.js's hardcoded
-- currentUserId). Until that's built, orders keep the free-text name/phone they always had.
IF COL_LENGTH('Orders', 'customerName') IS NULL ALTER TABLE Orders ADD customerName NVARCHAR(100) NULL;
IF COL_LENGTH('Orders', 'customerPhone') IS NULL ALTER TABLE Orders ADD customerPhone NVARCHAR(20) NULL;
GO

-- New: line items for an order (HawkerDatabase had no equivalent to HawkerCentreDB.Order_Items)
IF OBJECT_ID('OrderItems', 'U') IS NULL
CREATE TABLE OrderItems (
    orderItemId INT IDENTITY(1,1) PRIMARY KEY,
    orderId INT NOT NULL FOREIGN KEY REFERENCES Orders(orderId),
    menuId INT NULL FOREIGN KEY REFERENCES Menus(menuId),
    itemName NVARCHAR(200) NOT NULL,
    quantity INT NOT NULL,
    unitPrice DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    specialRequests NVARCHAR(500) NULL
);
GO

-- New: a customer can favorite a hawker centre, a stall, or a specific menu item
IF OBJECT_ID('Favorites', 'U') IS NULL
CREATE TABLE Favorites (
    favoriteId INT IDENTITY(1,1) PRIMARY KEY,
    userId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    centreId INT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    stallId INT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    menuId INT NULL FOREIGN KEY REFERENCES Menus(menuId),
    createdAt DATETIME NOT NULL CONSTRAINT DfFavoritesCreatedAt DEFAULT GETDATE()
);
GO


/* ###########################################################################
   5. NOTIFICATIONS   (from Notifications.sql)
   Must exist before NEAInspectionMerge.sql alters it.
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Notification bell: new order, monthly target hit, low stock,
   promotion ending, voucher expiring. Each underlying event is
   only ever inserted once (deduped by type + reference), so the
   generator can be safely re-run on every notification fetch.
   =========================================================== */

IF OBJECT_ID('Notifications', 'U') IS NULL
CREATE TABLE Notifications (
    notificationId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    type NVARCHAR(30) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    message NVARCHAR(500) NULL,
    linkUrl NVARCHAR(300) NULL,
    referenceType NVARCHAR(30) NULL,
    referenceId INT NULL,
    isRead BIT NOT NULL CONSTRAINT DfNotificationsIsRead DEFAULT 0,
    createdAt DATETIME2 NOT NULL CONSTRAINT DfNotificationsCreatedAt DEFAULT GETDATE()
);
GO


/* ###########################################################################
   6. NEA INSPECTION SCHEMA   (from NEAInspectionSchema.sql)
   Grading columns on Stalls, assessment columns on Inspections,
   and the GradeHistory table.
   ########################################################################### */
USE HawkerDatabase;
GO

-- Stalls: grading fields the inspection flow reads/writes
IF COL_LENGTH('Stalls', 'currentGrade') IS NULL
    ALTER TABLE Stalls ADD currentGrade VARCHAR(10) NULL;
GO
IF COL_LENGTH('Stalls', 'majorIssueCount') IS NULL
    ALTER TABLE Stalls ADD majorIssueCount INT NOT NULL CONSTRAINT DfStallsMajorIssueCount DEFAULT 0;
GO
-- Existing stalls start their grading clock from today rather than NULL (which would
-- parse as 1970 and instantly qualify every stall for grade A).
IF COL_LENGTH('Stalls', 'performanceStartDate') IS NULL
    ALTER TABLE Stalls ADD performanceStartDate DATE NOT NULL CONSTRAINT DfStallsPerformanceStartDate DEFAULT GETDATE();
GO

-- Inspections: the assessment fields filled in when an officer completes an inspection
IF COL_LENGTH('Inspections', 'hygieneScore') IS NULL
    ALTER TABLE Inspections ADD hygieneScore INT NULL;
GO
IF COL_LENGTH('Inspections', 'remarks') IS NULL
    ALTER TABLE Inspections ADD remarks VARCHAR(MAX) NULL;
GO
IF COL_LENGTH('Inspections', 'personalHygiene') IS NULL
    ALTER TABLE Inspections ADD personalHygiene BIT NOT NULL CONSTRAINT DfInspectionsPersonalHygiene DEFAULT 0;
GO
IF COL_LENGTH('Inspections', 'foodStorage') IS NULL
    ALTER TABLE Inspections ADD foodStorage BIT NOT NULL CONSTRAINT DfInspectionsFoodStorage DEFAULT 0;
GO
IF COL_LENGTH('Inspections', 'pestControl') IS NULL
    ALTER TABLE Inspections ADD pestControl BIT NOT NULL CONSTRAINT DfInspectionsPestControl DEFAULT 0;
GO
IF COL_LENGTH('Inspections', 'isMajorIssue') IS NULL
    ALTER TABLE Inspections ADD isMajorIssue BIT NOT NULL CONSTRAINT DfInspectionsIsMajorIssue DEFAULT 0;
GO

-- New: one row per grade change, so grades.html can show a stall's grading history
IF OBJECT_ID('GradeHistory', 'U') IS NULL
CREATE TABLE GradeHistory (
    historyId INT IDENTITY(1,1) PRIMARY KEY,
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    grade VARCHAR(10) NOT NULL,
    effectiveDate DATE NOT NULL CONSTRAINT DfGradeHistoryEffectiveDate DEFAULT GETDATE(),
    inspectionId INT NOT NULL UNIQUE FOREIGN KEY REFERENCES Inspections(inspectionId)
);
GO


/* ###########################################################################
   7. NEA INSPECTION COLUMNS   (from NEAInspectionColumns.sql)
   ########################################################################### */
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


/* ###########################################################################
   8. NEA INSPECTION MERGE   (from NEAInspectionMerge.sql)
   ########################################################################### */
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

/* --- patch: lift CkInspectionsStatus for seeding ---------------------------
   The constraint above allows Scheduled / In Progress / Completed, but the
   sample data predates it and still seeds inspection 3 as 'Follow-up Required'.
   Section 23 is what corrects that row, so the constraint comes off here and
   goes back on after it -- which also re-validates every seeded row. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkInspectionsStatus')
    ALTER TABLE Inspections DROP CONSTRAINT CkInspectionsStatus;
GO

/* ###########################################################################
   9. STALL REQUESTS   (from StallRequests.sql)
   ########################################################################### */
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


/* ###########################################################################
   10. STALL DETAILS   (from StallDetails.sql)
   Adds columns to StallRequests and Stalls, so it follows section 9.
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Extra stall details: operating hours, a declared grade, and a
   photo. Vendors fill these in on the request form.

   THE DECLARED GRADE STAYS ON StallRequests AND IS NEVER COPIED TO Stalls.
   It is what an applicant CLAIMS about a stall that traded before this system
   existed, so an operator reviewing the application can see it. A stall's live
   grade is Stalls.currentGrade, which only an NEA inspection writes. Approval
   converts the claim into Stalls.performanceStartDate (see section 20's patch),
   so the claim decides how the FIRST inspection grades the stall and never
   grades it by itself.

   A AND B ONLY. C is a sanction, not a claim -- it is what a major issue gives
   you, and it carries probation state plus a recovery path. baseGrade() in
   utils/grading.js returns only A/B/NEW, so there is no start date that could
   produce a C. A blank declaration means NEW.
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


/* ###########################################################################
   11. PROMOTIONS AND VOUCHERS   (from PromotionsAndVouchers.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Add Promotion: a vendor-created discount on some or all of a
   stall's menu, shown to customers as a struck-through original
   price next to the discounted price.
   =========================================================== */

IF OBJECT_ID('Promotions', 'U') IS NULL
CREATE TABLE Promotions (
    promotionId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500) NULL,
    discountType NVARCHAR(20) NOT NULL CONSTRAINT CkPromotionsDiscountType CHECK (discountType IN ('percentage', 'fixed')),
    discountValue DECIMAL(10,2) NOT NULL,
    scopeType NVARCHAR(20) NOT NULL CONSTRAINT CkPromotionsScopeType CHECK (scopeType IN ('all', 'category', 'item')) CONSTRAINT DfPromotionsScopeType DEFAULT 'all',
    scopeCategory NVARCHAR(50) NULL,
    scopeMenuId INT NULL FOREIGN KEY REFERENCES Menus(menuId),
    isActive BIT NOT NULL CONSTRAINT DfPromotionsIsActive DEFAULT 1,
    startDate DATETIME2 NOT NULL,
    endDate DATETIME2 NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DfPromotionsCreatedAt DEFAULT GETDATE(),
    updatedAt DATETIME2 NOT NULL CONSTRAINT DfPromotionsUpdatedAt DEFAULT GETDATE(),
    CONSTRAINT CkPromotionsEndDate CHECK (endDate > startDate)
);
GO

/* ===========================================================
   Vouchers: vendor-created codes a customer enters at checkout.
   Validity (active, date window, usage limit, min order amount)
   is always re-checked server-side before a discount is applied.
   =========================================================== */

IF OBJECT_ID('Vouchers', 'U') IS NULL
CREATE TABLE Vouchers (
    voucherId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    code NVARCHAR(30) NOT NULL,
    description NVARCHAR(500) NULL,
    discountType NVARCHAR(20) NOT NULL CONSTRAINT CkVouchersDiscountType CHECK (discountType IN ('percentage', 'fixed')),
    discountValue DECIMAL(10,2) NOT NULL,
    minOrderAmount DECIMAL(10,2) NULL,
    usageLimit INT NULL,
    usageCount INT NOT NULL CONSTRAINT DfVouchersUsageCount DEFAULT 0,
    isActive BIT NOT NULL CONSTRAINT DfVouchersIsActive DEFAULT 1,
    startDate DATETIME2 NOT NULL,
    endDate DATETIME2 NOT NULL,
    createdAt DATETIME2 NOT NULL CONSTRAINT DfVouchersCreatedAt DEFAULT GETDATE(),
    CONSTRAINT CkVouchersEndDate CHECK (endDate > startDate),
    CONSTRAINT UqVouchersStallCode UNIQUE (stallId, code)
);
GO

IF OBJECT_ID('VoucherRedemptions', 'U') IS NULL
CREATE TABLE VoucherRedemptions (
    redemptionId INT IDENTITY(1,1) PRIMARY KEY,
    voucherId INT NOT NULL FOREIGN KEY REFERENCES Vouchers(voucherId),
    orderId INT NOT NULL FOREIGN KEY REFERENCES Orders(orderId),
    discountAmount DECIMAL(10,2) NOT NULL,
    redeemedAt DATETIME2 NOT NULL CONSTRAINT DfVoucherRedemptionsRedeemedAt DEFAULT GETDATE()
);
GO

-- Orders: record which voucher (if any) was applied and how much it saved
IF COL_LENGTH('Orders', 'voucherId') IS NULL ALTER TABLE Orders ADD voucherId INT NULL FOREIGN KEY REFERENCES Vouchers(voucherId);
IF COL_LENGTH('Orders', 'discountAmount') IS NULL ALTER TABLE Orders ADD discountAmount DECIMAL(10,2) NULL CONSTRAINT DfOrdersDiscountAmount DEFAULT 0;
IF COL_LENGTH('Orders', 'roundUpAmount') IS NULL ALTER TABLE Orders ADD roundUpAmount DECIMAL(10,2) NOT NULL CONSTRAINT DfOrdersRoundUpAmount DEFAULT 0;
GO

-- OrderItems: keep the pre-promotion price too, so order history can show "you saved $X"
IF COL_LENGTH('OrderItems', 'originalUnitPrice') IS NULL ALTER TABLE OrderItems ADD originalUnitPrice DECIMAL(10,2) NULL;
IF COL_LENGTH('OrderItems', 'promotionId') IS NULL ALTER TABLE OrderItems ADD promotionId INT NULL FOREIGN KEY REFERENCES Promotions(promotionId);
GO


/* ###########################################################################
   12. PROMOTION MULTI-ITEM SCOPE   (from PromotionMultiItemScope.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Promotions could only target "all items" or a single item.
   Widen scopeType to allow selecting several specific items via
   a join table, same as a category can already cover several items.
   =========================================================== */

IF OBJECT_ID('PromotionItems', 'U') IS NULL
CREATE TABLE PromotionItems (
    promotionItemId INT IDENTITY(1,1) PRIMARY KEY,
    promotionId INT NOT NULL FOREIGN KEY REFERENCES Promotions(promotionId),
    menuId INT NOT NULL FOREIGN KEY REFERENCES Menus(menuId),
    CONSTRAINT UqPromotionItemsPromotionMenu UNIQUE (promotionId, menuId)
);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkPromotionsScopeType')
    ALTER TABLE Promotions DROP CONSTRAINT CkPromotionsScopeType;
GO

ALTER TABLE Promotions ADD CONSTRAINT CkPromotionsScopeType
    CHECK (scopeType IN ('all', 'category', 'items'));
GO

-- Any existing single-item promotions will become multi-item promotions with one item
IF COL_LENGTH('Promotions', 'scopeMenuId') IS NOT NULL
BEGIN
    INSERT INTO PromotionItems (promotionId, menuId)
    SELECT promotionId, scopeMenuId FROM Promotions
    WHERE scopeType = 'item' AND scopeMenuId IS NOT NULL;

    UPDATE Promotions SET scopeType = 'items' WHERE scopeType = 'item';
END
GO


/* ###########################################################################
   13. INVENTORY AND MONTHLY TARGETS   (from InventoryAndTargets.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Track Inventory: a stall's stock items (ingredients/supplies),
   managed the same way as Menus but for stock instead of food.
   =========================================================== */

IF OBJECT_ID('StockItems', 'U') IS NULL
CREATE TABLE StockItems (
    stockItemId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    itemName NVARCHAR(100) NOT NULL,
    quantity DECIMAL(18,2) NOT NULL CONSTRAINT DfStockItemsQuantity DEFAULT 0,
    unit NVARCHAR(20) NULL,
    category NVARCHAR(50) NULL,
    description NVARCHAR(500) NULL,
    inStock BIT NOT NULL CONSTRAINT DfStockItemsInStock DEFAULT 1
);
GO

/* ===========================================================
   Monthly Target: one row per stall per calendar month. Progress
   is computed on read from Orders, so it naturally "resets" as
   soon as the calendar rolls into a month with no target row yet.
   =========================================================== */

IF OBJECT_ID('MonthlyTargets', 'U') IS NULL
CREATE TABLE MonthlyTargets (
    targetId INT IDENTITY(1,1) PRIMARY KEY,
    vendorId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    targetType NVARCHAR(20) NOT NULL CONSTRAINT CkMonthlyTargetsType CHECK (targetType IN ('revenue', 'orders')),
    targetValue DECIMAL(18,2) NOT NULL,
    targetMonth INT NOT NULL,
    targetYear INT NOT NULL,
    createdAt DATETIME NOT NULL CONSTRAINT DfMonthlyTargetsCreatedAt DEFAULT GETDATE(),
    updatedAt DATETIME NOT NULL CONSTRAINT DfMonthlyTargetsUpdatedAt DEFAULT GETDATE(),
    CONSTRAINT UqMonthlyTargetsStallMonth UNIQUE (stallId, targetMonth, targetYear)
);
GO


/* ###########################################################################
   14. MONTHLY TARGETS - MORE TYPES   (from MonthlyTargetsMoreTypes.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Monthly Target: widen targetType beyond revenue/orders so
   vendors can also target items sold or new customers reached.
   =========================================================== */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkMonthlyTargetsType')
    ALTER TABLE MonthlyTargets DROP CONSTRAINT CkMonthlyTargetsType;
GO

ALTER TABLE MonthlyTargets ADD CONSTRAINT CkMonthlyTargetsType
    CHECK (targetType IN ('revenue', 'orders', 'items', 'customers'));
GO


/* ###########################################################################
   15. VENDOR DASHBOARD GOAL   (from VendorDashboardGoal.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

/* ===========================================================
   Adds a per-vendor monthly revenue goal, used by the "Order
   Summary" gauge on the vendor dashboard (revenue vs goal %).
   =========================================================== */

IF COL_LENGTH('VendorDashboard', 'monthlyGoal') IS NULL
  ALTER TABLE VendorDashboard ADD monthlyGoal DECIMAL(12,2) NOT NULL CONSTRAINT DfVendorDashboardMonthlyGoal DEFAULT 100000;
GO


/* ###########################################################################
   16. RENTAL AGREEMENTS   (from RentalAgreements.sql)
   ########################################################################### */
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


/* ###########################################################################
   17. RENTAL RENEWALS   (from RentalRenewals.sql)
   Alters RentalAgreements, so it follows section 16.
   ########################################################################### */
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


/* ###########################################################################
   18. CUSTOMER REVIEWS   (from CustomerReviews.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

-- New: a customer can rate & review a stall, tied to the specific completed order
-- they ate. One review per order (not per customer/stall) so a customer can leave
-- fresh feedback each time they order again, but can't spam the same order twice.
IF OBJECT_ID('StallReviews', 'U') IS NULL
CREATE TABLE StallReviews (
    reviewId INT IDENTITY(1,1) PRIMARY KEY,
    orderId INT NOT NULL UNIQUE FOREIGN KEY REFERENCES Orders(orderId),
    stallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    customerId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    customerName NVARCHAR(100) NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment NVARCHAR(1000) NULL,
    createdAt DATETIME NOT NULL CONSTRAINT DfStallReviewsCreatedAt DEFAULT GETDATE()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StallReviews_StallId')
CREATE INDEX IX_StallReviews_StallId ON StallReviews(stallId);
GO


/* ###########################################################################
   19. USER ALLERGENS   (from UserAllergensTable.sql)
   ########################################################################### */
/* USE, LIKE EVERY OTHER FILE IN THIS FOLDER. Without it, running this through sqlcmd
   without -d creates the table in [master] and the app then fails with
   "Invalid object name". The header used to argue the database name was unsettled;
   RUN_ORDER.md's first line commits to HawkerDatabase, so it is settled. */
USE HawkerDatabase;
GO

/* =============================================================================
   UserAllergensTable.sql — a customer's saved allergens.

   PROPOSAL FOR THE SCHEMA REVAMP, not another standalone script. The repo already has
   20 DDL files with Stalls, RentalAgreements, Promotions, OrderItems and Inspections
   each defined twice; adding a twenty-first in the same week the team is consolidating
   would be the same mistake again. Kept as one idempotent block so it lifts straight
   into whatever canonical script the revamp produces.

   THE FK IS THE ONLY LINE THE REVAMP DECIDES. It points at UserAccounts because that is
   where 10 of the schema's 12 identity foreign keys already point (Favorites, Inventory,
   Notifications, Promotions, RentalAgreements, RentalRenewals, StallRequests,
   VendorDashboards). Only Feedback and Likes still hang off Customers. If the revamp
   lands somewhere else, this one line changes and nothing else in the allergens code
   does — the model, controller, routes and validation are identifier-agnostic apart
   from the table and column names in two queries.

   No USE <database> — the database name is one of the things not yet settled.

   WHY ONE TABLE AND NOT THREE. The obvious modelling is a reference table of allergens,
   a join table, and a third for free-text customs. This stores one row per "this user is
   allergic to X" and decides standard-vs-custom by testing membership of the vocabulary
   in code, so the two can never disagree. A stored isCustom flag can drift from the list;
   a derived one can't.

   The vocabulary itself lives in middleware/validate.js (server-side, authoritative) and
   mirrors hawkr2/allergens.js, which is the front end's single source for the same seven
   ids plus their presentation. Those two lists must stay in step — see the comment in
   both files.
   ========================================================================== */

IF OBJECT_ID('dbo.UserAllergens', 'U') IS NULL
BEGIN
    CREATE TABLE UserAllergens (
        userAllergenId INT IDENTITY(1,1) NOT NULL,
        userId         INT NOT NULL,
        allergenName   NVARCHAR(50) NOT NULL,
        createdAt      DATETIME2 NOT NULL CONSTRAINT DfUserAllergensCreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PkUserAllergens PRIMARY KEY (userAllergenId),
        -- One row per allergen per person. Makes the replace idempotent and stops a
        -- double-submit storing "nuts" twice.
        CONSTRAINT UqUserAllergens UNIQUE (userId, allergenName),
        CONSTRAINT FkUserAllergensUserAccounts FOREIGN KEY (userId)
            REFERENCES UserAccounts (userId) ON DELETE CASCADE
    );
END
GO

/* The only read is "every allergen for one user", so the unique constraint above already
   serves it — userId is its leading column. No extra index. */


/* ###########################################################################
   20. OPERATOR CENTRE MANAGEMENT   (from CentreManagementAndProfile.sql)
   Has FKs into Promotions, so it follows section 11.
   ########################################################################### */
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

/* --- patch: defer Orders foreign keys across the seed ----------------------
   PromotionsAndVouchers.sql adds Orders.voucherId -> Vouchers(voucherId), but
   SampleData.sql inserts its Orders block (with voucherId 1) ~50 lines BEFORE
   its Vouchers block, so the FK would fire mid-file. The rows are consistent by
   the end of the seed, just not in the middle of it, so the FKs are deferred
   here and re-validated with WITH CHECK right after -- which still fails loudly
   if the data really is wrong. */
ALTER TABLE Orders NOCHECK CONSTRAINT ALL;
GO

/* ###########################################################################
   21. SAMPLE DATA   (from SampleData.sql)
   Wipes and reseeds every table created above.
   ########################################################################### */
USE HawkerDatabase;
GO

DELETE FROM VoucherRedemptions;
DELETE FROM StallReviews;
DELETE FROM OrderItems;
DELETE FROM Orders;
DELETE FROM Vouchers;
DELETE FROM PromotionItems;
DELETE FROM Promotions;
DELETE FROM Notifications;
DELETE FROM Favorites;
DELETE FROM MonthlyTargets;
DELETE FROM StockItems;
DELETE FROM RentalRenewalRequests;
DELETE FROM RentalAgreements;
DELETE FROM StallRequests;
DELETE FROM HawkerFeedback;
DELETE FROM CentrePromotionStall;
DELETE FROM CentrePromotion;
DELETE FROM CentreClosure;
DELETE FROM OperatorHawkerAssignments;
DELETE FROM GradeHistory;
DELETE FROM Inspections;
DELETE FROM Menus;
DELETE FROM Stalls;
DELETE FROM UserAccounts;
DELETE FROM HawkerCentres;
GO

-- Reset generated identifiers
DBCC CHECKIDENT ('HawkerCentres', RESEED, 0);
DBCC CHECKIDENT ('UserAccounts', RESEED, 0);
DBCC CHECKIDENT ('Stalls', RESEED, 0);
DBCC CHECKIDENT ('Menus', RESEED, 0);
DBCC CHECKIDENT ('Orders', RESEED, 0);
DBCC CHECKIDENT ('OrderItems', RESEED, 0);
DBCC CHECKIDENT ('Inspections', RESEED, 0);
DBCC CHECKIDENT ('RentalAgreements', RESEED, 0);
DBCC CHECKIDENT ('Promotions', RESEED, 0);
DBCC CHECKIDENT ('Vouchers', RESEED, 0);
DBCC CHECKIDENT ('StallReviews', RESEED, 0);
DBCC CHECKIDENT ('HawkerFeedback', RESEED, 0);
DBCC CHECKIDENT ('OperatorHawkerAssignments', RESEED, 0);
GO

-- ============================================================
-- Table: HawkerCentres
-- ============================================================
INSERT INTO HawkerCentres (centreName, address, postalCode, operatingHours, isActive) VALUES
(N'Tiong Bahru Hawker Centre', N'30 Seng Poh Road', N'168898', N'6:00 AM - 10:00 PM', 1),
(N'Old Airport Road Hawker Centre', N'51 Old Airport Road', N'390051', N'6:00 AM - 11:00 PM', 1),
(N'Chinatown Complex Food Centre', N'335 Smith Street', N'050335', N'7:00 AM - 10:00 PM', 1),
(N'Newton Food Centre', N'500 Clemenceau Avenue North', N'229495', N'6:00 PM - 2:00 AM', 1),
(N'Maxwell Food Centre', N'1 Kadayanallur Street', N'069184', N'8:00 AM - 9:00 PM', 1);
GO

-- ============================================================
-- Table: UserAccounts
-- Role must be one of: vendor, customer, nea, operator, guest
-- passwordHash values below are real bcrypt hashes (cost 10) for the shared
-- would just fail bcrypt.compare() against any password.
-- ============================================================
SET IDENTITY_INSERT UserAccounts ON;
INSERT INTO UserAccounts (userId, username, passwordHash, email, role, contactNumber, gender, profilePicture, createdAt) VALUES
(1, N'ahhockvendor', N'$2b$10$bFtMLPyVCeWmyW.bWgnVre.4ZTQV5o2jxzE.7Fq4sqBb1T7i/R0AW', N'ahhock@example.com', N'vendor', N'91234567', N'Male', N'/uploads/avatars/vendor1.jpg', '2026-01-01T09:00:00'),
(2, N'lormeevendor', N'$2b$10$AVFfa69CFZ31RVEoiJVjbuVIKaB9RuUANFLOm8VcWNpvwwAMbVfPi', N'lormee@example.com', N'vendor', N'92345678', N'Female', NULL, '2026-01-01T09:05:00'),
(3, N'rojakvendor', N'$2b$10$4US7tHYsehpFJhY0U7FsK..HPkQmrCylftkKFQpJv5RYDlBZSvX0O', N'rojak@example.com', N'vendor', N'93456789', N'Male', NULL, '2026-01-01T09:10:00'),
(4, N'johncustomer', N'$2b$10$NVUllwom14EyWZFiNI7pUOpiqogF7vx4.BRe5PfXcTb2JTZPXq6K.', N'john.tan@example.com', N'customer', N'91234567', N'Male', NULL, '2026-01-02T10:00:00'),
(5, N'neaofficer', N'$2b$10$GL9xalVHuDSGOoImJqRoqOM.YjIWz7CVxW.1/XHy78T1mlIRncvyW', N'aisha.rahman@example.com', N'nea', N'81112222', N'Female', NULL, '2026-01-02T10:30:00'),
(6, N'marycustomer', N'$2b$10$x6lQRaNyLiky2a7PCqkI6OjcAb8oq16fAKqq/acXyxOUf959Di3fO', N'mary.lim@example.com', N'customer', N'92345678', N'Female', NULL, '2026-01-02T11:00:00'),
(7, N'davidcustomer', N'$2b$10$oZtX0iPMj6NKYJm0/DvS9ugDTyLr6ZjbvysmCDsXYf/EsPQQPwile', N'david.lee@example.com', N'customer', N'93456789', N'Male', NULL, '2026-01-02T11:30:00'),
(8, N'sarahcustomer', N'$2b$10$d6wI2zx2G0PU0252RE.y0OvyNvU7Qvf.wgPWoBTcoA.AuWb5EHN1u', N'sarah.ong@example.com', N'customer', N'94567890', N'Female', NULL, '2026-01-02T12:00:00'),
(9, N'jamescustomer', N'$2b$10$OWNPEJEqcQ3Qxqg/KA9GAO58dtaycPY/zHpE0MZsdps4HdbOpljce', N'james.wong@example.com', N'customer', N'95678901', N'Male', NULL, '2026-01-02T12:30:00'),
(10, N'operator1', N'$2b$10$pr89O/7Vs2jI4CCS1Jt.reasmIO22BVEEffIu1u4R0.Tx/IdEY3Z2', N'operator1@example.com', N'operator', NULL, NULL, NULL, '2026-01-01T08:00:00');
SET IDENTITY_INSERT UserAccounts OFF;
GO

-- ============================================================
-- Table: Stalls (with all columns from various migrations)
-- ============================================================
SET IDENTITY_INSERT Stalls ON;
INSERT INTO Stalls (stallId, centreId, vendorId, stallName, unitNumber, cuisineType, description, contactNumber, isActive, operatingHours, imageUrl) VALUES
(1, 1, 1, N'Ah Hock Teochew Fishball', N'01-01', N'Chinese', N'Famous for springy fishballs and homemade noodles', N'91234567', 1, N'8:00 AM - 8:00 PM', N'/uploads/stalls/stall1.jpg'),
(2, 1, 2, N'Tiong Bahru Lor Mee', N'01-02', N'Chinese', N'Authentic lor mee with thick gravy', N'92345678', 1, N'9:00 AM - 7:00 PM', NULL),
(3, 1, 3, N'Liang Kee Roasted Meat', N'01-03', N'Chinese', N'Crispy roasted duck and char siew', N'93456789', 1, N'10:00 AM - 8:00 PM', NULL),
(4, 1, NULL, N'Jian Bo Shui Kueh', N'01-04', N'Chinese', N'Traditional Teochew steamed rice cakes', N'94567890', 1, N'7:00 AM - 6:00 PM', NULL),
(5, 1, NULL, N'Tiong Bahru Fried Carrot Cake', N'01-05', N'Chinese', N'Black and white carrot cake', N'95678901', 1, N'8:00 AM - 7:00 PM', NULL),
(6, 2, 3, N'Rojak Jin Long', N'01-01', N'Chinese', N'Famous rojak with thick prawn paste', N'94567890', 1, N'11:00 AM - 9:00 PM', NULL),
(7, 2, 2, N'Dong Li Fried Hokkien Mee', N'01-02', N'Chinese', N'Wok hei fried hokkien mee', N'95678901', 1, N'12:00 PM - 10:00 PM', NULL),
(8, 2, NULL, N'Lao Fu Zi Fried Kway Teow', N'01-03', N'Chinese', N'Char kway teow with fresh cockles', N'96789012', 1, N'11:00 AM - 9:00 PM', NULL),
(9, 2, NULL, N'To-Ricos Curry Puff', N'01-04', N'Chinese', N'Crispy curry puffs with chicken and potato', N'97890123', 1, N'8:00 AM - 6:00 PM', NULL),
(10, 2, NULL, N'Rong Xing Bak Kut Teh', N'01-05', N'Chinese', N'Peppery pork rib soup', N'98901234', 1, N'10:00 AM - 8:00 PM', NULL),
(11, 3, NULL, N'Outram Park Fried Kway Teow', N'01-01', N'Chinese', N'Char kway teow with fresh cockles', N'96789012', 1, N'11:00 AM - 9:00 PM', NULL),
(12, 3, NULL, N'Xing Ji Rou Gu Cha', N'01-02', N'Chinese', N'Bak kut teh with rich herbal broth', N'97890123', 1, N'10:00 AM - 8:00 PM', NULL),
(13, 3, NULL, N'Tanglin Halt Western Food', N'01-03', N'Western', N'Classic chicken chop and fish and chips', N'98901234', 1, N'11:00 AM - 9:00 PM', NULL),
(14, 3, NULL, N'Soon Heng Rojak', N'01-04', N'Chinese', N'Traditional rojak with home-made sauce', N'99012345', 1, N'12:00 PM - 8:00 PM', NULL),
(15, 3, NULL, N'Ah Chew Desserts', N'01-05', N'Desserts', N'Traditional Chinese desserts and sweet soups', N'90123456', 1, N'12:00 PM - 10:00 PM', NULL);
SET IDENTITY_INSERT Stalls OFF;
GO

-- ============================================================
-- Table: Menus (Menus table from CustomerModuleMerge)
-- Note: The table is called 'Menus' not 'MenuItems'
-- ============================================================
SET IDENTITY_INSERT Menus ON;
INSERT INTO Menus (menuId, vendorId, stallId, itemName, price, category, description, available) VALUES
(1, 1, 1, N'Fishball Noodles (Dry)', 4.50, N'Noodles', N'Springy fishball noodles with chili sauce', 1),
(2, 1, 1, N'Fishball Noodles (Soup)', 4.50, N'Noodles', N'Springy fishball noodles in clear broth', 1),
(3, 1, 1, N'Extra Fishballs', 2.00, N'Add-ons', N'5 extra fishballs', 1),
(4, 1, 1, N'Fishball Noodles Combo', 6.00, N'Noodles', N'Fishball noodles with extra fish cake', 1),
(5, 2, 2, N'Lor Mee', 5.00, N'Noodles', N'Thick noodle with braised gravy and pork', 1),
(6, 2, 2, N'Lor Mee with Extra Ingredients', 6.50, N'Noodles', N'Lor mee with extra fish and pork', 1),
(7, 2, 2, N'Fried Fish Cake', 2.50, N'Add-ons', N'Homemade fried fish cake', 1),
(8, 3, 3, N'Roasted Duck Rice', 6.00, N'Rice', N'Crispy roasted duck with fragrant rice', 1),
(9, 3, 3, N'Char Siew Rice', 5.00, N'Rice', N'Sweet roasted pork with rice', 1),
(10, 3, 3, N'Roasted Meat Combo', 7.50, N'Rice', N'Combination of duck and char siew', 1),
(11, 3, 3, N'Roasted Pork Belly Rice', 6.50, N'Rice', N'Crispy roasted pork belly with rice', 1),
(12, 3, 6, N'Rojak', 5.00, N'Snacks', N'Mixed fruits and vegetables with prawn paste', 1),
(13, 3, 6, N'Rojak with Extra Ingredients', 6.50, N'Snacks', N'Rojak with added youtiao and egg', 1),
(14, 2, 7, N'Fried Hokkien Mee', 6.00, N'Noodles', N'Wok-fried noodles with prawns and squid', 1),
(15, 2, 7, N'Fried Hokkien Mee (Large)', 8.00, N'Noodles', N'Large portion of fried hokkien mee', 1),
(16, 2, 7, N'Fried Hokkien Mee with Extra Prawns', 8.50, N'Noodles', N'Hokkien mee with extra fresh prawns', 1),
(17, NULL, 11, N'Fried Kway Teow', 5.50, N'Noodles', N'Char kway teow with cockles and Chinese sausage', 1),
(18, NULL, 11, N'Fried Kway Teow with Extra Cockles', 7.50, N'Noodles', N'Kway teow with extra fresh cockles', 1);
SET IDENTITY_INSERT Menus OFF;
GO

-- ============================================================
-- Table: Inspections
-- ============================================================
SET IDENTITY_INSERT Inspections ON;
INSERT INTO Inspections (inspectionId, stallId, officerId, inspectionDate, status) VALUES
(1, 1, 5, '2026-03-10', N'Completed'),
(2, 7, 5, '2026-03-15', N'Completed'),
(3, 13, 5, '2026-03-20', N'Follow-up Required'),
(4, 1, 5, '2026-07-19', N'In Progress'),
(5, 7, 5, '2026-07-25', N'Scheduled');
SET IDENTITY_INSERT Inspections OFF;
GO

-- ============================================================
-- Table: Orders (with all columns from CustomerModuleMerge)
-- vendorId is set to match each order's stall's actual vendor (Stalls.vendorId
-- above) - every vendor-facing page (dashboard, order queue, notifications)
-- ============================================================
SET IDENTITY_INSERT Orders ON;
INSERT INTO Orders (orderId, stallId, vendorId, customerId, customerName, customerPhone, orderDate, status, totalAmount, paymentMethod, paymentStatus, specialInstructions, voucherId, discountAmount) VALUES
(1, 1, 1, 4, N'John Tan', N'91234567', '2026-05-01T12:15:00', N'completed', 9.90, N'cash', N'paid', N'Extra chili sauce', 1, 1.10),
(2, 2, 2, 6, N'Mary Lim', N'92345678', '2026-05-02T12:30:00', N'preparing', 14.00, N'nets', N'pending', N'No pork', NULL, 0),
(3, 3, 3, 7, N'David Lee', N'93456789', '2026-05-03T13:00:00', N'pending', 18.50, N'cash', N'pending', N'Extra crispy duck', NULL, 0),
(4, 7, 2, 8, N'Sarah Ong', N'94567890', '2026-05-04T13:15:00', N'ready', 14.00, N'paynow', N'paid', N'Extra prawns', NULL, 0),
(5, 11, NULL, 9, N'James Wong', N'95678901', '2026-05-05T13:30:00', N'preparing', 12.50, N'card', N'pending', N'Less spicy', NULL, 0),
(6, 1, 1, 4, N'John Tan', N'91234567', DATEADD(HOUR, 12, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 4.50, N'cash', N'paid', NULL, NULL, 0),
(7, 1, 1, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 12, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 9.00, N'paynow', N'paid', NULL, NULL, 0),
(8, 1, 1, 7, N'David Lee', N'93456789', DATEADD(HOUR, 19, DATEADD(DAY, -3, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'preparing', 2.00, N'cash', N'pending', NULL, NULL, 0),
(9, 2, 2, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 13, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'nets', N'paid', NULL, NULL, 0),
(10, 2, 2, 9, N'James Wong', N'95678901', DATEADD(HOUR, 12, DATEADD(DAY, -4, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.50, N'card', N'paid', NULL, NULL, 0),
(11, 2, 2, 4, N'John Tan', N'91234567', DATEADD(HOUR, 18, DATEADD(DAY, -10, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'ready', 5.00, N'cash', N'paid', NULL, NULL, 0),
(12, 3, 3, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 19, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.00, N'paynow', N'paid', NULL, NULL, 0),
(13, 3, 3, 7, N'David Lee', N'93456789', DATEADD(HOUR, 12, DATEADD(DAY, -5, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'cash', N'paid', NULL, NULL, 0),
(14, 3, 3, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 20, DATEADD(DAY, -15, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'pending', 7.50, N'card', N'pending', NULL, NULL, 0),
(15, 1, 1, 9, N'James Wong', N'95678901', DATEADD(HOUR, 12, DATEADD(DAY, -20, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.00, N'cash', N'paid', NULL, NULL, 0),
(16, 6, 3, 4, N'John Tan', N'91234567', DATEADD(HOUR, 18, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'nets', N'paid', NULL, NULL, 0),
(17, 6, 3, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 19, DATEADD(DAY, -3, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.50, N'cash', N'paid', NULL, NULL, 0),
(18, 6, 3, 7, N'David Lee', N'93456789', DATEADD(HOUR, 12, DATEADD(DAY, -7, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'preparing', 10.00, N'paynow', N'pending', NULL, NULL, 0),
(19, 7, 2, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 12, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.00, N'card', N'paid', NULL, NULL, 0),
(20, 7, 2, 9, N'James Wong', N'95678901', DATEADD(HOUR, 13, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 8.00, N'cash', N'paid', NULL, NULL, 0),
(21, 7, 2, 4, N'John Tan', N'91234567', DATEADD(HOUR, 19, DATEADD(DAY, -6, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'ready', 8.50, N'nets', N'paid', NULL, NULL, 0),
(22, 6, 3, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 18, DATEADD(DAY, -12, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.50, N'cash', N'paid', NULL, NULL, 0),
(23, 7, 2, 7, N'David Lee', N'93456789', DATEADD(HOUR, 20, DATEADD(DAY, -14, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'pending', 6.00, N'paynow', N'pending', NULL, NULL, 0),
(24, 6, 3, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 12, DATEADD(DAY, -25, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'card', N'paid', NULL, NULL, 0),
(25, 7, 2, 9, N'James Wong', N'95678901', DATEADD(HOUR, 19, DATEADD(DAY, -28, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 8.00, N'cash', N'paid', NULL, NULL, 0),
(26, 11, NULL, 4, N'John Tan', N'91234567', DATEADD(HOUR, 12, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.50, N'nets', N'paid', NULL, NULL, 0),
(27, 11, NULL, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 13, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'cash', N'paid', NULL, NULL, 0),
(28, 11, NULL, 7, N'David Lee', N'93456789', DATEADD(HOUR, 19, DATEADD(DAY, -4, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'preparing', 11.00, N'paynow', N'pending', NULL, NULL, 0),
(29, 11, NULL, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 12, DATEADD(DAY, -6, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'card', N'paid', NULL, NULL, 0),
(30, 11, NULL, 9, N'James Wong', N'95678901', DATEADD(HOUR, 18, DATEADD(DAY, -9, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'pending', 5.50, N'cash', N'pending', NULL, NULL, 0),
(31, 11, NULL, 4, N'John Tan', N'91234567', DATEADD(HOUR, 12, DATEADD(DAY, -13, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'nets', N'paid', NULL, NULL, 0),
(32, 11, NULL, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 19, DATEADD(DAY, -18, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.50, N'cash', N'paid', NULL, NULL, 0),
(33, 11, NULL, 7, N'David Lee', N'93456789', DATEADD(HOUR, 12, DATEADD(DAY, -22, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'ready', 7.50, N'paynow', N'paid', NULL, NULL, 0),
(34, 11, NULL, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 18, DATEADD(DAY, -26, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.50, N'card', N'paid', NULL, NULL, 0),
(35, 11, NULL, 9, N'James Wong', N'95678901', DATEADD(HOUR, 20, DATEADD(DAY, -29, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'cash', N'paid', NULL, NULL, 0);
SET IDENTITY_INSERT Orders OFF;
GO

-- ============================================================
-- Table: OrderItems (with promotion columns from PromotionsAndVouchers)
-- ============================================================
SET IDENTITY_INSERT OrderItems ON;
INSERT INTO OrderItems (orderItemId, orderId, menuId, itemName, quantity, unitPrice, subtotal, originalUnitPrice, promotionId, specialRequests) VALUES
(1, 1, 1, N'Fishball Noodles (Dry)', 2, 4.50, 9.00, 4.50, NULL, N'Extra chili'),
(2, 1, 3, N'Extra Fishballs', 1, 2.00, 2.00, 2.00, NULL, NULL),
(3, 2, 5, N'Lor Mee', 1, 5.00, 5.00, 5.00, NULL, NULL),
(4, 2, 7, N'Fried Fish Cake', 1, 2.50, 2.50, 2.50, NULL, N'Extra crispy'),
(5, 2, 6, N'Lor Mee with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(6, 3, 8, N'Roasted Duck Rice', 1, 6.00, 6.00, 6.00, NULL, N'Extra crispy duck'),
(7, 3, 9, N'Char Siew Rice', 1, 5.00, 5.00, 5.00, NULL, NULL),
(8, 3, 10, N'Roasted Meat Combo', 1, 7.50, 7.50, 7.50, NULL, NULL),
(9, 4, 14, N'Fried Hokkien Mee', 1, 6.00, 6.00, 6.00, NULL, N'Extra prawns'),
(10, 4, 15, N'Fried Hokkien Mee (Large)', 1, 8.00, 8.00, 8.00, NULL, NULL),
(11, 6, 1, N'Fishball Noodles (Dry)', 1, 4.50, 4.50, 4.50, NULL, NULL),
(12, 7, 2, N'Fishball Noodles (Soup)', 2, 4.50, 9.00, 4.50, NULL, NULL),
(13, 8, 3, N'Extra Fishballs', 1, 2.00, 2.00, 2.00, NULL, NULL),
(14, 9, 5, N'Lor Mee', 1, 5.00, 5.00, 5.00, NULL, NULL),
(15, 10, 6, N'Lor Mee with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(16, 11, 7, N'Fried Fish Cake', 2, 2.50, 5.00, 2.50, NULL, NULL),
(17, 12, 8, N'Roasted Duck Rice', 1, 6.00, 6.00, 6.00, NULL, NULL),
(18, 13, 9, N'Char Siew Rice', 1, 5.00, 5.00, 5.00, NULL, NULL),
(19, 14, 10, N'Roasted Meat Combo', 1, 7.50, 7.50, 7.50, NULL, NULL),
(20, 15, 4, N'Fishball Noodles Combo', 1, 6.00, 6.00, 6.00, NULL, NULL),
(21, 16, 12, N'Rojak', 1, 5.00, 5.00, 5.00, NULL, NULL),
(22, 17, 13, N'Rojak with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(23, 18, 12, N'Rojak', 2, 5.00, 10.00, 5.00, NULL, NULL),
(24, 19, 14, N'Fried Hokkien Mee', 1, 6.00, 6.00, 6.00, NULL, NULL),
(25, 20, 15, N'Fried Hokkien Mee (Large)', 1, 8.00, 8.00, 8.00, NULL, NULL),
(26, 21, 16, N'Fried Hokkien Mee with Extra Prawns', 1, 8.50, 8.50, 8.50, NULL, NULL),
(27, 22, 13, N'Rojak with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(28, 23, 14, N'Fried Hokkien Mee', 1, 6.00, 6.00, 6.00, NULL, NULL),
(29, 24, 12, N'Rojak', 1, 5.00, 5.00, 5.00, NULL, NULL),
(30, 25, 15, N'Fried Hokkien Mee (Large)', 1, 8.00, 8.00, 8.00, NULL, NULL),
(31, 26, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(32, 27, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(33, 28, 17, N'Fried Kway Teow', 2, 5.50, 11.00, 5.50, NULL, NULL),
(34, 29, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(35, 30, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(36, 31, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(37, 32, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(38, 33, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(39, 34, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(40, 35, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL);
SET IDENTITY_INSERT OrderItems OFF;
GO

-- ============================================================
-- Table: Promotions (from PromotionsAndVouchers)
-- ============================================================
SET IDENTITY_INSERT Promotions ON;
INSERT INTO Promotions (promotionId, vendorId, stallId, name, description, discountType, discountValue, scopeType, scopeCategory, scopeMenuId, isActive, startDate, endDate, createdAt, updatedAt) VALUES
(1, 1, 1, N'Fishball Special', N'Free extra fishballs with two noodle bowls.', N'percentage', 15.00, N'all', NULL, NULL, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE(), GETDATE()),
(2, 2, 2, N'Lor Mee Afternoon Special', N'One dollar off Lor Mee after 2 PM.', N'fixed', 1.00, N'all', NULL, NULL, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE(), GETDATE()),
(3, 3, 13, N'Western Combo', N'Free drink with Chicken Chop.', N'percentage', 10.00, N'all', NULL, NULL, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE(), GETDATE());
SET IDENTITY_INSERT Promotions OFF;
GO

-- ============================================================
-- Table: PromotionItems (from PromotionMultiItemScope)
-- ============================================================
INSERT INTO PromotionItems (promotionId, menuId) VALUES
(1, 1),
(1, 2),
(2, 5);
GO

-- ============================================================
-- Table: Vouchers (from PromotionsAndVouchers)
-- ============================================================
SET IDENTITY_INSERT Vouchers ON;
INSERT INTO Vouchers (voucherId, vendorId, stallId, code, description, discountType, discountValue, minOrderAmount, usageLimit, usageCount, isActive, startDate, endDate, createdAt) VALUES
(1, 1, 1, N'WELCOME10', N'10% off for new customers', N'percentage', 10.00, 10.00, 50, 1, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE()),
(2, 2, 2, N'LORMEEMAY', N'$2 off Lor Mee orders', N'fixed', 2.00, 5.00, 30, 0, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE()),
(3, 3, 3, N'ROASTED5', N'$5 off any roasted meat combo', N'fixed', 5.00, 15.00, 20, 0, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE());
SET IDENTITY_INSERT Vouchers OFF;
GO

-- ============================================================
-- Table: VoucherRedemptions (from PromotionsAndVouchers)
-- ============================================================
INSERT INTO VoucherRedemptions (voucherId, orderId, discountAmount, redeemedAt) VALUES
(1, 1, 1.10, '2026-05-01T12:15:00');
GO

-- ============================================================
-- Table: Favorites (from CustomerModuleMerge)
-- ============================================================
INSERT INTO Favorites (userId, centreId, stallId, menuId, createdAt) VALUES
(4, 1, NULL, NULL, GETDATE()),  -- John Tan favorites Tiong Bahru Hawker Centre
(4, NULL, 1, NULL, GETDATE()),  -- John Tan favorites Ah Hock stall
(4, NULL, NULL, 1, GETDATE()),  -- John Tan favorites Fishball Noodles
(6, 1, 2, NULL, GETDATE()),     -- Mary Lim favorites Lor Mee stall
(6, NULL, NULL, 5, GETDATE()),  -- Mary Lim favorites Lor Mee item
(7, 2, 7, NULL, GETDATE()),     -- David Lee favorites Hokkien Mee stall
(8, 3, 13, NULL, GETDATE()),    -- Sarah Ong favorites Western Food stall
(9, 1, 3, NULL, GETDATE());     -- James Wong favorites Roasted Meat stall
GO

-- ============================================================
-- Table: Notifications (from Notifications.sql)
-- vendorId here already matched each order's stall's real vendor — it's what
-- gave away that the Orders insert above was missing vendorId in the first place.
-- ============================================================
INSERT INTO Notifications (vendorId, type, title, message, linkUrl, referenceType, referenceId, isRead, createdAt) VALUES
(1, N'new_order', N'New Order Received', N'You have a new order #1 from John Tan', N'/vendor/orders/1', N'order', 1, 0, GETDATE()),
(2, N'new_order', N'New Order Received', N'You have a new order #2 from Mary Lim', N'/vendor/orders/2', N'order', 2, 0, GETDATE()),
(3, N'new_order', N'New Order Received', N'You have a new order #3 from David Lee', N'/vendor/orders/3', N'order', 3, 0, GETDATE()),
(2, N'new_order', N'New Order Received', N'You have a new order #4 from Sarah Ong', N'/vendor/orders/4', N'order', 4, 0, GETDATE());
GO

-- ============================================================
-- Table: StockItems (from InventoryAndTargets.sql)
-- ============================================================
INSERT INTO StockItems (vendorId, stallId, itemName, quantity, unit, category, description, inStock) VALUES
(1, 1, N'Fishballs', 50.00, N'pieces', N'Ingredients', N'Fresh fishballs for noodle dishes', 1),
(1, 1, N'Noodles', 20.00, N'kg', N'Ingredients', N'Fresh egg noodles', 1),
(1, 1, N'Chili Sauce', 5.00, N'liters', N'Sauces', N'House-made spicy chili sauce', 1),
(2, 2, N'Lor Mee Gravy', 10.00, N'liters', N'Sauces', N'Thick braised gravy', 1),
(2, 2, N'Pork Slices', 15.00, N'kg', N'Ingredients', N'Sliced pork for lor mee', 1),
(2, 7, N'Prawns', 10.00, N'kg', N'Ingredients', N'Fresh prawns for Hokkien mee', 1),
(3, 3, N'Duck', 10.00, N'kg', N'Ingredients', N'Roasted duck', 1),
(3, 3, N'Char Siew', 8.00, N'kg', N'Ingredients', N'Roasted char siew', 1);
GO

-- ============================================================
-- Table: MonthlyTargets (from InventoryAndTargets.sql)
-- ============================================================
INSERT INTO MonthlyTargets (vendorId, stallId, targetType, targetValue, targetMonth, targetYear, createdAt, updatedAt) VALUES
(1, 1, N'revenue', 5000.00, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE()),
(2, 2, N'revenue', 4500.00, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE()),
(3, 3, N'revenue', 6000.00, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE()),
(2, 7, N'orders', 120, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE());
GO

-- ============================================================
-- Table: RentalAgreements (from RentalAgreements.sql + RentalRenewals.sql)
-- ============================================================
SET IDENTITY_INSERT RentalAgreements ON;
INSERT INTO RentalAgreements (AgreementId, StallId, OwnerId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions, RentalPrice, ContractType, ContractName) VALUES
(1, 1, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1800.00, N'Fixed Price', N'operator1'),
(2, 2, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1750.00, N'Fixed Price', N'operator1'),
(3, 3, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1900.00, N'Fixed Price', N'operator1'),
(4, 7, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1850.00, N'Fixed Price', N'operator1'),
(5, 13, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 2100.00, N'Fixed Price', N'operator1'),
(6, 2, 10, '2027-01-01T00:00:00', '2027-06-30T23:59:59', N'Monthly rental paid by the first day of each month.', 1850.00, N'Fixed Price', N'operator1');
SET IDENTITY_INSERT RentalAgreements OFF;
GO

-- ============================================================
-- Table: RentalRenewalRequests (from RentalRenewals.sql)
-- ============================================================
INSERT INTO RentalRenewalRequests (AgreementId, StallId, VendorId, Status, ProposedRentalPrice, ReviewedBy, ReviewNote, RequestedAt, ReviewedAt, NewAgreementId) VALUES
(1, 1, 1, N'pending', 1900.00, NULL, NULL, GETDATE(), NULL, NULL),
(2, 2, 2, N'approved', 1850.00, 10, N'Approved with new price', GETDATE(), GETDATE(), 6);
GO

-- ============================================================
-- Table: StallRequests (from StallRequests.sql)
-- ============================================================
INSERT INTO StallRequests (vendorId, centreId, stallName, unitNumber, description, status, reviewNote, requestedAt, reviewedAt, operatingHours, hygieneGrade, imageUrl) VALUES
(1, 2, N'New Fishball Stall', N'02-01', N'Requesting for additional stall', N'approved', N'Approved', '2026-05-01T10:00:00', '2026-05-05T14:00:00', N'8:00 AM - 8:00 PM', N'A', NULL),
(3, 3, N'New Rojak Stall', N'03-02', N'Requesting for stall at Chinatown', N'pending', NULL, '2026-06-01T11:00:00', NULL, NULL, NULL, NULL);
GO

-- ============================================================
-- Table: OperatorHawkerAssignments
-- ============================================================
SET IDENTITY_INSERT OperatorHawkerAssignments ON;
INSERT INTO OperatorHawkerAssignments (AssignmentId, OperatorId, HawkerId) VALUES
(1, 10, 1),
(2, 10, 2),
(3, 10, 3);
SET IDENTITY_INSERT OperatorHawkerAssignments OFF;
GO

-- ============================================================
-- Table: StallReviews (from CustomerReviews.sql)
-- ============================================================
SET IDENTITY_INSERT StallReviews ON;
INSERT INTO StallReviews (reviewId, orderId, stallId, customerId, customerName, rating, comment, createdAt) VALUES
(1, 1, 1, 4, N'John Tan', 5, N'Amazing fishball noodles, springy and fresh!', DATEADD(DAY, -1, GETDATE())),
(2, 7, 1, 6, N'Mary Lim', 2, N'Noodles arrived cold, disappointing.', DATEADD(DAY, -2, GETDATE())),
(3, 9, 2, 8, N'Sarah Ong', 4, N'Lor mee was tasty, generous portion.', DATEADD(DAY, -1, GETDATE())),
(4, 10, 2, 9, N'James Wong', 5, N'Best lor mee in the centre!', DATEADD(DAY, -4, GETDATE())),
(5, 12, 3, 6, N'Mary Lim', 3, N'Decent roasted duck, a bit dry.', DATEADD(DAY, -2, GETDATE())),
(6, 13, 3, 7, N'David Lee', 1, N'Too salty, would not recommend.', DATEADD(DAY, -5, GETDATE())),
(7, 16, 6, 4, N'John Tan', 5, N'Great rojak, generous prawn paste.', DATEADD(DAY, -1, GETDATE())),
(8, 19, 7, 8, N'Sarah Ong', 4, N'Solid hokkien mee with good wok hei.', DATEADD(DAY, -1, GETDATE())),
(9, 26, 11, 4, N'John Tan', 5, N'Fried kway teow was excellent, lots of cockles.', DATEADD(DAY, -1, GETDATE())),
(10, 27, 11, 6, N'Mary Lim', 2, N'Portion felt small for the price.', DATEADD(DAY, -2, GETDATE()));
SET IDENTITY_INSERT StallReviews OFF;
GO

-- ============================================================
-- Table: HawkerFeedback (from CentreManagementAndProfile.sql)
-- ============================================================
SET IDENTITY_INSERT HawkerFeedback ON;
INSERT INTO HawkerFeedback (FeedbackId, HawkerId, CustomerId, Rating, FacilityTag, Comment, CreatedAt) VALUES
(1, 1, 4, 5, N'Cleanliness', N'Tables were spotless.', DATEADD(DAY, -2, GETDATE())),
(2, 1, 6, 2, N'Toilets', N'Toilets need more frequent attention.', DATEADD(DAY, -5, GETDATE())),
(3, 1, 7, 4, N'Seating', N'Enough seats even during lunch rush.', DATEADD(DAY, -35, GETDATE())),
(4, 1, 8, 3, N'Queue', N'Long queues at some stalls during peak hours.', DATEADD(DAY, -40, GETDATE())),
(5, 2, 8, 5, N'Ventilation', N'Good airflow, not too hot.', DATEADD(DAY, -3, GETDATE())),
(6, 2, 9, 1, N'Cleanliness', N'Floor was sticky and dirty near the entrance.', DATEADD(DAY, -10, GETDATE())),
(7, 2, 4, 4, N'Seating', NULL, DATEADD(DAY, -20, GETDATE())),
(8, 2, 6, 3, N'Toilets', N'Could be cleaner in the afternoons.', DATEADD(DAY, -45, GETDATE())),
(9, 3, 7, 5, N'Cleanliness', N'Spotless as always.', DATEADD(DAY, -1, GETDATE())),
(10, 3, 9, 2, N'Queue', N'Queue management could improve during dinner.', DATEADD(DAY, -8, GETDATE())),
(11, 3, 8, 4, N'Ventilation', NULL, DATEADD(DAY, -25, GETDATE())),
(12, 3, 4, 3, N'Other', N'Signage to the stalls could be clearer.', DATEADD(DAY, -50, GETDATE()));
SET IDENTITY_INSERT HawkerFeedback OFF;
GO

-- ============================================================
-- Verify the data was inserted correctly
-- ============================================================
SELECT 'HawkerCentres' as TableName, COUNT(*) AS [RowCount] FROM HawkerCentres
UNION ALL
SELECT 'UserAccounts', COUNT(*) FROM UserAccounts
UNION ALL
SELECT 'Stalls', COUNT(*) FROM Stalls
UNION ALL
SELECT 'Menus', COUNT(*) FROM Menus
UNION ALL
SELECT 'Orders', COUNT(*) FROM Orders
UNION ALL
SELECT 'OrderItems', COUNT(*) FROM OrderItems
UNION ALL
SELECT 'Promotions', COUNT(*) FROM Promotions
UNION ALL
SELECT 'PromotionItems', COUNT(*) FROM PromotionItems
UNION ALL
SELECT 'Vouchers', COUNT(*) FROM Vouchers
UNION ALL
SELECT 'VoucherRedemptions', COUNT(*) FROM VoucherRedemptions
UNION ALL
SELECT 'RentalAgreements', COUNT(*) FROM RentalAgreements
UNION ALL
SELECT 'RentalRenewalRequests', COUNT(*) FROM RentalRenewalRequests
UNION ALL
SELECT 'Favorites', COUNT(*) FROM Favorites
UNION ALL
SELECT 'Notifications', COUNT(*) FROM Notifications
UNION ALL
SELECT 'StockItems', COUNT(*) FROM StockItems
UNION ALL
SELECT 'MonthlyTargets', COUNT(*) FROM MonthlyTargets
UNION ALL
SELECT 'StallRequests', COUNT(*) FROM StallRequests
UNION ALL
SELECT 'Inspections', COUNT(*) FROM Inspections
UNION ALL
SELECT 'GradeHistory', COUNT(*) FROM GradeHistory
UNION ALL
SELECT 'StallReviews', COUNT(*) FROM StallReviews
UNION ALL
SELECT 'HawkerFeedback', COUNT(*) FROM HawkerFeedback
UNION ALL
SELECT 'OperatorHawkerAssignments', COUNT(*) FROM OperatorHawkerAssignments;
GO

/* --- patch: re-validate Orders foreign keys -------------------------------- */
ALTER TABLE Orders WITH CHECK CHECK CONSTRAINT ALL;
GO

/* ###########################################################################
   22. NEA INSPECTION SAMPLE DATA   (from NEAInspectionSampleData.sql)
   ########################################################################### */
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


/* ###########################################################################
   23. NEA INTEGRATION PREP   (from NEAIntegrationPrep.sql)
   ########################################################################### */
USE HawkerDatabase;
GO

UPDATE Inspections SET status = 'Completed' WHERE inspectionId = 3;
GO

UPDATE UserAccounts SET passwordHash = '$2b$10$iulnFzHVgQowTpYFD1g0iuMiXzIgJfMgaJwDWbk.X9SJLHdECSbSS'
WHERE username IN (N'neaofficer', N'lormeevendor', N'rojakvendor');
GO

/* --- patch: restore CkInspectionsStatus ------------------------------------ */
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkInspectionsStatus')
    ALTER TABLE Inspections WITH CHECK ADD CONSTRAINT CkInspectionsStatus
        CHECK (status IN ('Scheduled', 'In Progress', 'Completed'));
GO

/* --- patch: default Stalls.currentGrade to NEW -----------------------------
   NEAInspectionSchema.sql adds Stalls.currentGrade as NULL with no default and
   the sample data never sets it, so every stall would read back with no NEA
   grade. Section 22 sets it explicitly for the seven stalls it gives real
   inspections to; everything left over has never been inspected, and a stall
   nobody has inspected is NEW.

   THIS USED TO READ `SET currentGrade = hygieneGrade`, which is the bug this
   whole change removes: it seeded the NEA grade from a value the vendor chose
   for themselves on their own application form. Nine of the fifteen seeded
   stalls then disagreed with what the inspector had actually recorded, always
   flattering -- a stall on probation for live pest activity still advertised B.

   The DEFAULT and CHECK come from StallGradeConsolidation.sql, which is now
   folded in here rather than excluded (see the header). */
UPDATE Stalls SET currentGrade = 'NEW' WHERE currentGrade IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DfStallsCurrentGrade')
    ALTER TABLE Stalls ADD CONSTRAINT DfStallsCurrentGrade DEFAULT 'NEW' FOR currentGrade;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkStallsCurrentGrade')
    ALTER TABLE Stalls WITH CHECK ADD CONSTRAINT CkStallsCurrentGrade
        CHECK (currentGrade IN ('A', 'B', 'C', 'NEW'));
GO

/* ###########################################################################
   24. USER CUISINES   (from UserCuisinesTable.sql)
   Looks users up by name, so it needs section 21's accounts.
   ########################################################################### */
/* USE, LIKE EVERY OTHER FILE IN THIS FOLDER. Without it, running this through sqlcmd
   without -d creates the table in [master] and the app then fails with
   "Invalid object name". The header used to argue the database name was unsettled;
   RUN_ORDER.md's first line commits to HawkerDatabase, so it is settled. */
USE HawkerDatabase;
GO

/* =============================================================================
   UserCuisinesTable.sql — a customer's My Palette: the cuisines they like.

   COPIED FROM UserAllergensTable.sql ON PURPOSE, line for line where it can be. The two
   features are the same shape — one row per choice, read whole, replaced whole, scoped to
   one person — so the two tables should be recognisably the same table with one word
   changed. Anyone who has read the allergens schema has already read this one.

   THE FK POINTS AT UserAccounts, for the reason the allergens file sets out at length:
   that is where 10 of the schema's 12 identity foreign keys already point. If the schema
   revamp lands somewhere else, this one line changes and nothing else in the cuisines code
   does.

   ON DELETE CASCADE, again matching allergens. A palette is meaningless without the person
   whose palette it is, so it goes when the account goes rather than being left as an
   orphan row pointing at a userId nobody owns any more.

   NO USE <database> — the database name is one of the things not yet settled.

   WHAT THIS TABLE CANNOT DO, AND IT MATTERS. The product rule is "up to five". A CHECK
   constraint cannot express it: the rule counts OTHER rows, and counting other rows needs a
   subquery in the CHECK or a trigger, and this module covers neither. So the cap is not in
   the schema — it is enforced in middleware/cuisineValidation.js before the write, and
   again in models/cuisineModel.js as the last line before the INSERT loop. The UNIQUE
   constraint below holds the half of the rule the database CAN hold: you cannot like Thai
   food twice.

   WHY NOT A REFERENCE TABLE OF CUISINES PLUS A JOIN TABLE. Same answer as allergens. The
   vocabulary is fixed, maintained by us in config/cuisines.js, and never edited by a user —
   so a Cuisines table would be a second copy of a list that already exists in code, with
   nothing to add but the chance of the two disagreeing. One row per "this user likes X",
   validated against the list in code.

   NOTHING READS THIS YET. It is a stored preference, by design — there is no
   recommendation model in this app and this table is not pretending to feed one. It exists
   so that the day somebody builds that, the answer is already collected.
   ========================================================================== */

IF OBJECT_ID('dbo.UserCuisines', 'U') IS NULL
BEGIN
    CREATE TABLE UserCuisines (
        userCuisineId INT IDENTITY(1,1) NOT NULL,
        userId        INT NOT NULL,
        cuisineName   NVARCHAR(50) NOT NULL,
        createdAt     DATETIME2 NOT NULL CONSTRAINT DfUserCuisinesCreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PkUserCuisines PRIMARY KEY (userCuisineId),
        -- One row per cuisine per person. Makes the replace idempotent and stops a
        -- double-submit storing "Thai" twice. It is also the only part of the "up to
        -- five" rule the schema can enforce — see the header.
        CONSTRAINT UqUserCuisines UNIQUE (userId, cuisineName),
        CONSTRAINT FkUserCuisinesUserAccounts FOREIGN KEY (userId)
            REFERENCES UserAccounts (userId) ON DELETE CASCADE
    );
END
GO

/* The only read is "every cuisine for one user", so the unique constraint above already
   serves it — userId is its leading column. No extra index. */

/* ===========================================================
   Sample rows
   ===========================================================
   Three of the five customers OperatorSampleData.sql creates get a palette, chosen to
   cover the three cases a screen has to draw:

     chloelim   5 cuisines — AT THE CAP. Opening My Palette on this account shows every
                remaining plate refusing to be picked, which is the rule made visible.
     ravikumar  3 cuisines — the ordinary middle.
     gracetoh   1 cuisine  — under the onboarding minimum of three, which is legal: the
                minimum gates the onboarding Next button, the server has never had one, and
                a person editing their palette in Settings is allowed to end up with one.

   ravikumar and sitinur deliberately share Indian and Thai, so "how many people like this
   cuisine" is a question with a non-trivial answer the first time anyone asks it.
   benyeo has no rows at all — the empty palette is a real state and needs testing too.

   Every name here is in config/cuisines.js. If you add a row, check it against that list:
   the API would refuse the same value, and sample data that the API would reject is a
   trap for whoever tries to reproduce it through the app.

   THE userId IS LOOKED UP BY USERNAME, never hard-coded, so it does not matter what ids
   the earlier scripts handed out. Same idiom as OperatorSampleData.sql.

   PLAIN INSERT WITH NO GUARDS — run this file once. Running it twice fails on
   UqUserCuisines, which is the constraint doing its job rather than a bug. */

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Japanese' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Korean' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Thai' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Chinese' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Western' FROM UserAccounts u WHERE u.username = N'chloelim';

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Indian' FROM UserAccounts u WHERE u.username = N'ravikumar';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Thai' FROM UserAccounts u WHERE u.username = N'ravikumar';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Malay' FROM UserAccounts u WHERE u.username = N'ravikumar';

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Malay' FROM UserAccounts u WHERE u.username = N'sitinur';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Indian' FROM UserAccounts u WHERE u.username = N'sitinur';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Thai' FROM UserAccounts u WHERE u.username = N'sitinur';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Western' FROM UserAccounts u WHERE u.username = N'sitinur';

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Pizza' FROM UserAccounts u WHERE u.username = N'gracetoh';
GO

/* --- patch: assign operator1 to every hawker centre ------------------------
   The sample data creates operator1 but assigns them no centre, and every
   operator endpoint scopes its reads through OperatorHawkerAssignments
   (profileModel, centreClosureModel, centrePromotionModel). Without a row here
   those endpoints return empty and look broken. Looked up by username so it
   survives a reseed. */
INSERT INTO OperatorHawkerAssignments (OperatorId, HawkerId)
SELECT u.userId, c.centreId
FROM UserAccounts u CROSS JOIN HawkerCentres c
WHERE u.username = N'operator1'
  AND NOT EXISTS (SELECT 1 FROM OperatorHawkerAssignments a
                  WHERE a.OperatorId = u.userId AND a.HawkerId = c.centreId);
GO

/* ###########################################################################
   25. SUPPORT TICKETS
   ###########################################################################
   No .sql file in database\ ever created these, so routes\ticketRoutes.js and
   its models were unreachable. Columns are taken from what models\ticketModel.js
   and models\ticketHistoryModel.js actually read and write.
   ########################################################################### */

/* Hawkers is a VIEW, not a table.

   ticketModel.js queries `Hawkers (HawkerId, Name, IsActive)`, which is the
   naming from a sibling schema this database never adopted -- here the same
   rows live in HawkerCentres (centreId, centreName, isActive). A view renames
   the columns without duplicating the data, so the ticket module reads the one
   real centre list rather than a second copy that could drift out of step.

   This also makes the existing OperatorHawkerAssignments.HawkerId join line up:
   that column already points at HawkerCentres(centreId). */
IF OBJECT_ID('dbo.Hawkers', 'V') IS NOT NULL
    DROP VIEW dbo.Hawkers;
GO
CREATE VIEW dbo.Hawkers AS
SELECT centreId       AS HawkerId,
       centreName     AS Name,
       address        AS Address,
       postalCode     AS PostalCode,
       operatingHours AS OperatingHours,
       isActive       AS IsActive
FROM HawkerCentres;
GO

/* One row per support ticket raised by a customer or vendor.

   Status starts at 'Open' because ticketModel.claimTicket only claims a ticket
   `WHERE Status = 'Open' AND AssignedOperatorId IS NULL` -- any other default
   would make every new ticket unclaimable.

   The status list is the union of the two vocabularies the code enforces:
   middleware\ticketValidation.js IN_FLIGHT_STATUSES, plus the TERMINAL_STATUSES
   in ticketModel.js. Category matches that file's CATEGORIES list. */
IF OBJECT_ID('dbo.Tickets', 'U') IS NULL
CREATE TABLE Tickets (
    TicketId INT IDENTITY(1,1) PRIMARY KEY,
    HawkerId INT NOT NULL FOREIGN KEY REFERENCES HawkerCentres(centreId),
    UserId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    UserRole NVARCHAR(20) NOT NULL,
    Category NVARCHAR(30) NOT NULL CONSTRAINT CkTicketsCategory CHECK (Category IN (
        'Facility Issue', 'Cleanliness', 'Account Issue', 'Billing/Rental',
        'Order/Payment', 'Queue/Crowd', 'Safety Concern', 'Others'
    )),
    OtherCategoryText NVARCHAR(100) NULL,
    Subject NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT DfTicketsStatus DEFAULT ('Open')
        CONSTRAINT CkTicketsStatus CHECK (Status IN (
            'Open', 'In Progress', 'Finding Solution', 'Testing',
            'Awaiting Response', 'Completed', 'Unresolvable'
        )),
    AssignedOperatorId INT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DfTicketsCreatedAt DEFAULT SYSDATETIME(),
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DfTicketsUpdatedAt DEFAULT SYSDATETIME()
);
GO

-- Photos/videos attached to a ticket. The file itself is written to
-- uploads\tickets\<TicketId>\ by controllers\ticketController.js; only the
-- path is stored here.
IF OBJECT_ID('dbo.TicketAttachments', 'U') IS NULL
CREATE TABLE TicketAttachments (
    AttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    TicketId INT NOT NULL FOREIGN KEY REFERENCES Tickets(TicketId),
    FileName NVARCHAR(255) NOT NULL,
    FileType NVARCHAR(20) NOT NULL,
    FileSizeBytes INT NOT NULL,
    StoragePath NVARCHAR(500) NOT NULL,
    UploadedAt DATETIME2 NOT NULL CONSTRAINT DfTicketAttachmentsUploadedAt DEFAULT SYSDATETIME()
);
GO

/* The resolution record written when an operator closes a ticket.

   It duplicates Category/Description from Tickets on purpose: this is an
   archive row, and the point is what the ticket said AT THE MOMENT it was
   closed, not what it might be edited to afterwards. */
IF OBJECT_ID('dbo.TicketHistory', 'U') IS NULL
CREATE TABLE TicketHistory (
    TicketHistoryId INT IDENTITY(1,1) PRIMARY KEY,
    TicketId INT NOT NULL FOREIGN KEY REFERENCES Tickets(TicketId),
    UserId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    UserRole NVARCHAR(20) NULL,
    Category NVARCHAR(30) NULL,
    TicketDescription NVARCHAR(MAX) NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL CONSTRAINT CkTicketHistoryStatus
        CHECK (Status IN ('Completed', 'Unresolvable')),
    ResolvedByUserId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    CompletedAt DATETIME2 NOT NULL CONSTRAINT DfTicketHistoryCompletedAt DEFAULT SYSDATETIME()
);
GO

-- The operator queue reads by centre then status; the submitter's list reads by user.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_HawkerId_Status')
    CREATE INDEX IX_Tickets_HawkerId_Status ON Tickets(HawkerId, Status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_UserId')
    CREATE INDEX IX_Tickets_UserId ON Tickets(UserId);
GO

/* Sample tickets, one per state the operator queue has to draw: unclaimed,
   claimed and in flight, and closed with a history row. Ids are looked up by
   username/centre name so this survives a reseed. */
DECLARE @cust INT = (SELECT userId FROM UserAccounts WHERE username = N'johncustomer');
DECLARE @vend INT = (SELECT userId FROM UserAccounts WHERE username = N'rojakvendor');
DECLARE @oper INT = (SELECT userId FROM UserAccounts WHERE username = N'operator1');
DECLARE @centre INT = (SELECT MIN(centreId) FROM HawkerCentres);

IF NOT EXISTS (SELECT 1 FROM Tickets)
BEGIN
    INSERT INTO Tickets (HawkerId, UserId, UserRole, Category, Subject, Description, Status)
    VALUES (@centre, @cust, N'customer', N'Cleanliness',
            N'Tray return station overflowing',
            N'The tray return near the drinks stall has been full since lunchtime.', N'Open');

    INSERT INTO Tickets (HawkerId, UserId, UserRole, Category, Subject, Description, Status, AssignedOperatorId)
    VALUES (@centre, @vend, N'vendor', N'Facility Issue',
            N'Exhaust fan not working',
            N'The extractor above my wok station stopped overnight.', N'In Progress', @oper);

    INSERT INTO Tickets (HawkerId, UserId, UserRole, Category, Subject, Description, Status, AssignedOperatorId)
    VALUES (@centre, @cust, N'customer', N'Order/Payment',
            N'Charged twice for one order',
            N'PayNow took payment twice for order #1.', N'Completed', @oper);

    DECLARE @closed INT = (SELECT TicketId FROM Tickets WHERE Status = N'Completed');
    INSERT INTO TicketHistory (TicketId, UserId, UserRole, Category, TicketDescription, Message, Status, ResolvedByUserId)
    VALUES (@closed, @cust, N'customer', N'Order/Payment',
            N'PayNow took payment twice for order #1.',
            N'Duplicate charge refunded to the original payment method.', N'Completed', @oper);
END
GO


/* ###########################################################################
   26. RENTAL AGREEMENT HISTORY
   ###########################################################################
   Backs routes\rentalAgreementHistoryRoutes.js. Column names and types are
   taken from models\rentalAgreementHistoryModel.js's INSERT, which binds
   AgreementId and OwnerId as SmallInt -- widened to INT here to match the
   RentalAgreements table those values are copied from (section 16). SmallInt
   inputs widen to INT without loss, so the model needs no change.

   No FK on AgreementId: this is an archive, and its whole purpose is to
   outlive the RentalAgreements row it was copied from.
   ########################################################################### */
IF OBJECT_ID('dbo.RentalAgreementHistory', 'U') IS NULL
CREATE TABLE RentalAgreementHistory (
    HistoryId INT IDENTITY(1,1) PRIMARY KEY,
    AgreementId INT NOT NULL,
    AgreementStartDate DATETIME2 NOT NULL,
    AgreementEndDate DATETIME2 NOT NULL,
    AgreementTermsAndConditions NVARCHAR(MAX) NULL,
    RentalPrice DECIMAL(10,2) NOT NULL,
    OwnerId INT NOT NULL FOREIGN KEY REFERENCES UserAccounts(userId),
    StallId INT NOT NULL FOREIGN KEY REFERENCES Stalls(stallId),
    Status VARCHAR(20) NOT NULL CONSTRAINT CkRentalAgreementHistoryStatus
        CHECK (Status IN ('Expired', 'Cancelled')),
    ArchivedAt DATETIME2 NOT NULL CONSTRAINT DfRentalAgreementHistoryArchivedAt DEFAULT SYSDATETIME()
);
GO

-- One archived agreement so the endpoint returns something on a fresh build.
IF NOT EXISTS (SELECT 1 FROM RentalAgreementHistory)
INSERT INTO RentalAgreementHistory
    (AgreementId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions,
     RentalPrice, OwnerId, StallId, Status)
SELECT TOP 1
    a.AgreementId,
    DATEADD(YEAR, -1, a.AgreementStartDate),
    DATEADD(YEAR, -1, a.AgreementEndDate),
    a.AgreementTermsAndConditions,
    a.RentalPrice,
    a.OwnerId,
    a.StallId,
    'Expired'
FROM RentalAgreements a
ORDER BY a.AgreementId;
GO


/* ###########################################################################
   27. KNOWN PASSWORDS FOR THE SEEDED ACCOUNTS
   ###########################################################################
   The bcrypt hashes in section 22's sample data are real, but the plaintext
   they were generated from is not recorded anywhere -- the comment above them
   is cut off mid-sentence. That made every seeded account impossible to log
   into, so the only way in was to register a fresh user.

   This resets every seeded account to one shared password:

       Password123!

   The hash below is bcrypt cost 10, which is what controllers\userController.js
   hashes with and what bcryptjs compares against. See README.md for the
   full username list.

   ONLY the ten seeded usernames are touched -- anyone registered through the
   API keeps their own password.
   ########################################################################### */
UPDATE UserAccounts
SET passwordHash = '$2b$10$v9DzjRMq1ElsKXQmjgat.eDf1eLURxLMQEQkDJwHFA71CM9SXhNl.'
WHERE username IN (
    N'ahhockvendor', N'lormeevendor', N'rojakvendor', N'johncustomer', N'neaofficer',
    N'marycustomer', N'davidcustomer', N'sarahcustomer', N'jamescustomer', N'operator1'
);
GO


/* ###########################################################################
   28. VERIFY
   ########################################################################### */
SET NOCOUNT ON;
GO
SELECT COUNT(*) AS tables_created FROM sys.tables;
SELECT role, COUNT(*) AS accounts FROM UserAccounts GROUP BY role;
SELECT (SELECT COUNT(*) FROM Stalls) AS stalls,
       (SELECT COUNT(*) FROM Orders) AS orders,
       (SELECT COUNT(*) FROM Inspections) AS inspections,
       (SELECT COUNT(*) FROM Promotions) AS promotions,
       (SELECT COUNT(*) FROM RentalAgreements) AS rentals,
       (SELECT COUNT(*) FROM OperatorHawkerAssignments) AS operator_assignments,
       (SELECT COUNT(*) FROM Tickets) AS tickets,
       (SELECT COUNT(*) FROM TicketHistory) AS ticket_history,
       (SELECT COUNT(*) FROM RentalAgreementHistory) AS rental_history;
GO