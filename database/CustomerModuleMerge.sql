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
