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
