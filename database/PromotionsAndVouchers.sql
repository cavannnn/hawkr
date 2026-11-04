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
GO

-- OrderItems: keep the pre-promotion price too, so order history can show "you saved $X"
IF COL_LENGTH('OrderItems', 'originalUnitPrice') IS NULL ALTER TABLE OrderItems ADD originalUnitPrice DECIMAL(10,2) NULL;
IF COL_LENGTH('OrderItems', 'promotionId') IS NULL ALTER TABLE OrderItems ADD promotionId INT NULL FOREIGN KEY REFERENCES Promotions(promotionId);
GO
