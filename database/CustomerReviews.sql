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
