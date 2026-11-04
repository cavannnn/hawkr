-- Support tickets: customer/vendor -> operator -> back to customer/vendor.
-- Every hawker-centre reference below points at HawkerCentres(centreId), the
-- same table OperatorHawkerAssignments already joins against.

CREATE TABLE Tickets (
    TicketId INT IDENTITY(1,1) PRIMARY KEY,
    HawkerId INT NOT NULL,
    UserId INT NOT NULL,
    UserRole NVARCHAR(20) NOT NULL,
    Category NVARCHAR(30) NOT NULL,
    OtherCategoryText NVARCHAR(100) NULL,
    Subject NVARCHAR(150) NOT NULL,
    Description NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'Open',
    AssignedOperatorId INT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_Tickets_HawkerCentres FOREIGN KEY (HawkerId) REFERENCES HawkerCentres(centreId),
    CONSTRAINT FK_Tickets_Submitter FOREIGN KEY (UserId) REFERENCES UserAccounts(userId),
    CONSTRAINT FK_Tickets_AssignedOperator FOREIGN KEY (AssignedOperatorId) REFERENCES UserAccounts(userId)
);

CREATE TABLE TicketAttachments (
    AttachmentId INT IDENTITY(1,1) PRIMARY KEY,
    TicketId INT NOT NULL,
    FileName NVARCHAR(255) NOT NULL,
    FileType NVARCHAR(20) NOT NULL,
    FileSizeBytes INT NOT NULL,
    StoragePath NVARCHAR(500) NOT NULL,
    UploadedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_TicketAttachments_Ticket FOREIGN KEY (TicketId) REFERENCES Tickets(TicketId)
);

-- One row per closed ticket: the operator's reply/resolution, kept alongside
-- a copy of the original request so history reads standalone even if the
-- ticket itself is ever pruned.
CREATE TABLE TicketHistory (
    TicketHistoryId INT IDENTITY(1,1) PRIMARY KEY,
    TicketId INT NOT NULL,
    UserId INT NOT NULL,
    UserRole NVARCHAR(20) NOT NULL,
    Category NVARCHAR(30) NOT NULL,
    TicketDescription NVARCHAR(MAX) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(20) NOT NULL,
    ResolvedByUserId INT NOT NULL,
    CompletedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_TicketHistory_Ticket FOREIGN KEY (TicketId) REFERENCES Tickets(TicketId),
    CONSTRAINT FK_TicketHistory_Submitter FOREIGN KEY (UserId) REFERENCES UserAccounts(userId),
    CONSTRAINT FK_TicketHistory_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES UserAccounts(userId)
);

CREATE INDEX IX_Tickets_HawkerId_Status ON Tickets(HawkerId, Status);
CREATE INDEX IX_Tickets_UserId ON Tickets(UserId);
CREATE INDEX IX_TicketHistory_UserId ON TicketHistory(UserId);
