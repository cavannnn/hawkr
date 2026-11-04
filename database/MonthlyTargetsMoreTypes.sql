USE HawkerDatabase;
GO

/* ===========================================================
   Monthly Target: widen targetType beyond revenue/orders so
   vendors can also target items sold or new customers reached.
   =========================================================== */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkMonthlyTargetsType')
    ALTER TABLE MonthlyTargets DROP CONSTRAINT CkMonthlyTargetsType;
GO

ALTER TABLE MonthlyTargets ADD CONSTRAINT CkMonthlyTargetsType
    CHECK (targetType IN ('revenue', 'orders', 'items', 'customers'));
GO
