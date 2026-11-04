USE HawkerDatabase;
GO

/* ===========================================================
   Adds a per-vendor monthly revenue goal, used by the "Order
   Summary" gauge on the vendor dashboard (revenue vs goal %).
   =========================================================== */

IF COL_LENGTH('VendorDashboard', 'monthlyGoal') IS NULL
  ALTER TABLE VendorDashboard ADD monthlyGoal DECIMAL(12,2) NOT NULL CONSTRAINT DfVendorDashboardMonthlyGoal DEFAULT 100000;
GO
