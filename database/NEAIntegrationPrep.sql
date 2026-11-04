USE HawkerDatabase;
GO

UPDATE Inspections SET status = 'Completed' WHERE inspectionId = 3;
GO

UPDATE UserAccounts SET passwordHash = '$2b$10$iulnFzHVgQowTpYFD1g0iuMiXzIgJfMgaJwDWbk.X9SJLHdECSbSS'
WHERE username IN (N'neaofficer', N'lormeevendor', N'rojakvendor');
GO
