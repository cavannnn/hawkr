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
