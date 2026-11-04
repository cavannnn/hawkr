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
