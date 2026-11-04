USE [HawkerDatabase];
GO

-- only login/permissions here
CREATE USER [hawker_user] FOR LOGIN [hawker_user] WITH DEFAULT_SCHEMA=[dbo];
GO
ALTER ROLE [db_datareader] ADD MEMBER [hawker_user];
GO
ALTER ROLE [db_datawriter] ADD MEMBER [hawker_user];
GO
