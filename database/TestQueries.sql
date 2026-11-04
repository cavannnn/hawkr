USE HawkerDatabase;
GO

-- Table: Hawkers
SELECT * FROM Hawkers ORDER BY HawkerId;
GO

-- Table: Customers
SELECT * FROM Customers ORDER BY CustomerId;
GO

-- Table: NeaOfficers
SELECT * FROM NeaOfficers ORDER BY OfficerId;
GO

-- Table: StallOwners
SELECT * FROM StallOwners ORDER BY OwnerId;
GO

-- Table: UserAccounts
SELECT * FROM UserAccounts ORDER BY UserId;
GO

-- Table: Stalls
SELECT * FROM Stalls ORDER BY StallId;
GO

-- Table: Inspections
SELECT * FROM Inspections ORDER BY InspectionId;
GO

-- Table: InspectionRemarks
SELECT * FROM InspectionRemarks ORDER BY InspectionId;
GO

-- Table: Complaints
SELECT * FROM Complaints ORDER BY ComplaintId;
GO

-- Table: Feedback
SELECT * FROM Feedback ORDER BY FeedbackId;
GO

-- Table: Cuisines
SELECT * FROM Cuisines ORDER BY CuisineId;
GO

-- Table: MenuItems
SELECT * FROM MenuItems ORDER BY StallId, ItemCode;
GO

-- Table: MenuItemCuisines
SELECT * FROM MenuItemCuisines ORDER BY StallId, ItemCode, CuisineId;
GO

-- Table: Likes
SELECT * FROM Likes ORDER BY CustomerId, StallId, ItemCode;
GO

-- Table: Orders
SELECT * FROM Orders ORDER BY OrderId;
GO

-- Table: OrderItems
SELECT * FROM OrderItems ORDER BY OrderId, OrderItemId;
GO

-- Table: VendorDashboards
SELECT * FROM VendorDashboards ORDER BY DashboardId;
GO

-- Table: Promotions
SELECT * FROM Promotions ORDER BY PromotionId;
GO

-- Table: RentalAgreements
SELECT * FROM RentalAgreements ORDER BY AgreementId;
GO
