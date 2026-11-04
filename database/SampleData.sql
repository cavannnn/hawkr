USE HawkerDatabase;
GO

DELETE FROM VoucherRedemptions;
DELETE FROM StallReviews;
DELETE FROM OrderItems;
DELETE FROM Orders;
DELETE FROM Vouchers;
DELETE FROM PromotionItems;
DELETE FROM Promotions;
DELETE FROM Notifications;
DELETE FROM Favorites;
DELETE FROM MonthlyTargets;
DELETE FROM StockItems;
DELETE FROM RentalRenewalRequests;
DELETE FROM RentalAgreements;
DELETE FROM StallRequests;
DELETE FROM HawkerFeedback;
DELETE FROM CentrePromotionStall;
DELETE FROM CentrePromotion;
DELETE FROM CentreClosure;
DELETE FROM OperatorHawkerAssignments;
DELETE FROM GradeHistory;
DELETE FROM Inspections;
DELETE FROM Menus;
DELETE FROM Stalls;
DELETE FROM UserAccounts;
DELETE FROM HawkerCentres;
GO

-- Reset generated identifiers
DBCC CHECKIDENT ('HawkerCentres', RESEED, 0);
DBCC CHECKIDENT ('UserAccounts', RESEED, 0);
DBCC CHECKIDENT ('Stalls', RESEED, 0);
DBCC CHECKIDENT ('Menus', RESEED, 0);
DBCC CHECKIDENT ('Orders', RESEED, 0);
DBCC CHECKIDENT ('OrderItems', RESEED, 0);
DBCC CHECKIDENT ('Inspections', RESEED, 0);
DBCC CHECKIDENT ('RentalAgreements', RESEED, 0);
DBCC CHECKIDENT ('Promotions', RESEED, 0);
DBCC CHECKIDENT ('Vouchers', RESEED, 0);
DBCC CHECKIDENT ('StallReviews', RESEED, 0);
DBCC CHECKIDENT ('HawkerFeedback', RESEED, 0);
DBCC CHECKIDENT ('OperatorHawkerAssignments', RESEED, 0);
GO

-- ============================================================
-- Table: HawkerCentres
-- ============================================================
INSERT INTO HawkerCentres (centreName, address, postalCode, operatingHours, isActive) VALUES
(N'Tiong Bahru Hawker Centre', N'30 Seng Poh Road', N'168898', N'6:00 AM - 10:00 PM', 1),
(N'Old Airport Road Hawker Centre', N'51 Old Airport Road', N'390051', N'6:00 AM - 11:00 PM', 1),
(N'Chinatown Complex Food Centre', N'335 Smith Street', N'050335', N'7:00 AM - 10:00 PM', 1),
(N'Newton Food Centre', N'500 Clemenceau Avenue North', N'229495', N'6:00 PM - 2:00 AM', 1),
(N'Maxwell Food Centre', N'1 Kadayanallur Street', N'069184', N'8:00 AM - 9:00 PM', 1);
GO

-- ============================================================
-- Table: UserAccounts
-- Role must be one of: vendor, customer, nea, operator, guest
-- passwordHash values below are real bcrypt hashes (cost 10) for the shared
-- would just fail bcrypt.compare() against any password.
-- ============================================================
SET IDENTITY_INSERT UserAccounts ON;
INSERT INTO UserAccounts (userId, username, passwordHash, email, role, contactNumber, gender, profilePicture, createdAt) VALUES
(1, N'ahhockvendor', N'$2b$10$bFtMLPyVCeWmyW.bWgnVre.4ZTQV5o2jxzE.7Fq4sqBb1T7i/R0AW', N'ahhock@example.com', N'vendor', N'91234567', N'Male', N'/uploads/avatars/vendor1.jpg', '2026-01-01T09:00:00'),
(2, N'lormeevendor', N'$2b$10$AVFfa69CFZ31RVEoiJVjbuVIKaB9RuUANFLOm8VcWNpvwwAMbVfPi', N'lormee@example.com', N'vendor', N'92345678', N'Female', NULL, '2026-01-01T09:05:00'),
(3, N'rojakvendor', N'$2b$10$4US7tHYsehpFJhY0U7FsK..HPkQmrCylftkKFQpJv5RYDlBZSvX0O', N'rojak@example.com', N'vendor', N'93456789', N'Male', NULL, '2026-01-01T09:10:00'),
(4, N'johncustomer', N'$2b$10$NVUllwom14EyWZFiNI7pUOpiqogF7vx4.BRe5PfXcTb2JTZPXq6K.', N'john.tan@example.com', N'customer', N'91234567', N'Male', NULL, '2026-01-02T10:00:00'),
(5, N'neaofficer', N'$2b$10$GL9xalVHuDSGOoImJqRoqOM.YjIWz7CVxW.1/XHy78T1mlIRncvyW', N'aisha.rahman@example.com', N'nea', N'81112222', N'Female', NULL, '2026-01-02T10:30:00'),
(6, N'marycustomer', N'$2b$10$x6lQRaNyLiky2a7PCqkI6OjcAb8oq16fAKqq/acXyxOUf959Di3fO', N'mary.lim@example.com', N'customer', N'92345678', N'Female', NULL, '2026-01-02T11:00:00'),
(7, N'davidcustomer', N'$2b$10$oZtX0iPMj6NKYJm0/DvS9ugDTyLr6ZjbvysmCDsXYf/EsPQQPwile', N'david.lee@example.com', N'customer', N'93456789', N'Male', NULL, '2026-01-02T11:30:00'),
(8, N'sarahcustomer', N'$2b$10$d6wI2zx2G0PU0252RE.y0OvyNvU7Qvf.wgPWoBTcoA.AuWb5EHN1u', N'sarah.ong@example.com', N'customer', N'94567890', N'Female', NULL, '2026-01-02T12:00:00'),
(9, N'jamescustomer', N'$2b$10$OWNPEJEqcQ3Qxqg/KA9GAO58dtaycPY/zHpE0MZsdps4HdbOpljce', N'james.wong@example.com', N'customer', N'95678901', N'Male', NULL, '2026-01-02T12:30:00'),
(10, N'operator1', N'$2b$10$pr89O/7Vs2jI4CCS1Jt.reasmIO22BVEEffIu1u4R0.Tx/IdEY3Z2', N'operator1@example.com', N'operator', NULL, NULL, NULL, '2026-01-01T08:00:00');
SET IDENTITY_INSERT UserAccounts OFF;
GO

-- ============================================================
-- Table: Stalls (with all columns from various migrations)
-- ============================================================
SET IDENTITY_INSERT Stalls ON;
INSERT INTO Stalls (stallId, centreId, vendorId, stallName, unitNumber, cuisineType, description, contactNumber, isActive, operatingHours, imageUrl) VALUES
(1, 1, 1, N'Ah Hock Teochew Fishball', N'01-01', N'Chinese', N'Famous for springy fishballs and homemade noodles', N'91234567', 1, N'8:00 AM - 8:00 PM', N'/uploads/stalls/stall1.jpg'),
(2, 1, 2, N'Tiong Bahru Lor Mee', N'01-02', N'Chinese', N'Authentic lor mee with thick gravy', N'92345678', 1, N'9:00 AM - 7:00 PM', NULL),
(3, 1, 3, N'Liang Kee Roasted Meat', N'01-03', N'Chinese', N'Crispy roasted duck and char siew', N'93456789', 1, N'10:00 AM - 8:00 PM', NULL),
(4, 1, NULL, N'Jian Bo Shui Kueh', N'01-04', N'Chinese', N'Traditional Teochew steamed rice cakes', N'94567890', 1, N'7:00 AM - 6:00 PM', NULL),
(5, 1, NULL, N'Tiong Bahru Fried Carrot Cake', N'01-05', N'Chinese', N'Black and white carrot cake', N'95678901', 1, N'8:00 AM - 7:00 PM', NULL),
(6, 2, 3, N'Rojak Jin Long', N'01-01', N'Chinese', N'Famous rojak with thick prawn paste', N'94567890', 1, N'11:00 AM - 9:00 PM', NULL),
(7, 2, 2, N'Dong Li Fried Hokkien Mee', N'01-02', N'Chinese', N'Wok hei fried hokkien mee', N'95678901', 1, N'12:00 PM - 10:00 PM', NULL),
(8, 2, NULL, N'Lao Fu Zi Fried Kway Teow', N'01-03', N'Chinese', N'Char kway teow with fresh cockles', N'96789012', 1, N'11:00 AM - 9:00 PM', NULL),
(9, 2, NULL, N'To-Ricos Curry Puff', N'01-04', N'Chinese', N'Crispy curry puffs with chicken and potato', N'97890123', 1, N'8:00 AM - 6:00 PM', NULL),
(10, 2, NULL, N'Rong Xing Bak Kut Teh', N'01-05', N'Chinese', N'Peppery pork rib soup', N'98901234', 1, N'10:00 AM - 8:00 PM', NULL),
(11, 3, NULL, N'Outram Park Fried Kway Teow', N'01-01', N'Chinese', N'Char kway teow with fresh cockles', N'96789012', 1, N'11:00 AM - 9:00 PM', NULL),
(12, 3, NULL, N'Xing Ji Rou Gu Cha', N'01-02', N'Chinese', N'Bak kut teh with rich herbal broth', N'97890123', 1, N'10:00 AM - 8:00 PM', NULL),
(13, 3, NULL, N'Tanglin Halt Western Food', N'01-03', N'Western', N'Classic chicken chop and fish and chips', N'98901234', 1, N'11:00 AM - 9:00 PM', NULL),
(14, 3, NULL, N'Soon Heng Rojak', N'01-04', N'Chinese', N'Traditional rojak with home-made sauce', N'99012345', 1, N'12:00 PM - 8:00 PM', NULL),
(15, 3, NULL, N'Ah Chew Desserts', N'01-05', N'Desserts', N'Traditional Chinese desserts and sweet soups', N'90123456', 1, N'12:00 PM - 10:00 PM', NULL);
SET IDENTITY_INSERT Stalls OFF;
GO

-- ============================================================
-- Table: Menus (Menus table from CustomerModuleMerge)
-- Note: The table is called 'Menus' not 'MenuItems'
-- ============================================================
SET IDENTITY_INSERT Menus ON;
INSERT INTO Menus (menuId, vendorId, stallId, itemName, price, category, description, available) VALUES
(1, 1, 1, N'Fishball Noodles (Dry)', 4.50, N'Noodles', N'Springy fishball noodles with chili sauce', 1),
(2, 1, 1, N'Fishball Noodles (Soup)', 4.50, N'Noodles', N'Springy fishball noodles in clear broth', 1),
(3, 1, 1, N'Extra Fishballs', 2.00, N'Add-ons', N'5 extra fishballs', 1),
(4, 1, 1, N'Fishball Noodles Combo', 6.00, N'Noodles', N'Fishball noodles with extra fish cake', 1),
(5, 2, 2, N'Lor Mee', 5.00, N'Noodles', N'Thick noodle with braised gravy and pork', 1),
(6, 2, 2, N'Lor Mee with Extra Ingredients', 6.50, N'Noodles', N'Lor mee with extra fish and pork', 1),
(7, 2, 2, N'Fried Fish Cake', 2.50, N'Add-ons', N'Homemade fried fish cake', 1),
(8, 3, 3, N'Roasted Duck Rice', 6.00, N'Rice', N'Crispy roasted duck with fragrant rice', 1),
(9, 3, 3, N'Char Siew Rice', 5.00, N'Rice', N'Sweet roasted pork with rice', 1),
(10, 3, 3, N'Roasted Meat Combo', 7.50, N'Rice', N'Combination of duck and char siew', 1),
(11, 3, 3, N'Roasted Pork Belly Rice', 6.50, N'Rice', N'Crispy roasted pork belly with rice', 1),
(12, 3, 6, N'Rojak', 5.00, N'Snacks', N'Mixed fruits and vegetables with prawn paste', 1),
(13, 3, 6, N'Rojak with Extra Ingredients', 6.50, N'Snacks', N'Rojak with added youtiao and egg', 1),
(14, 2, 7, N'Fried Hokkien Mee', 6.00, N'Noodles', N'Wok-fried noodles with prawns and squid', 1),
(15, 2, 7, N'Fried Hokkien Mee (Large)', 8.00, N'Noodles', N'Large portion of fried hokkien mee', 1),
(16, 2, 7, N'Fried Hokkien Mee with Extra Prawns', 8.50, N'Noodles', N'Hokkien mee with extra fresh prawns', 1),
(17, NULL, 11, N'Fried Kway Teow', 5.50, N'Noodles', N'Char kway teow with cockles and Chinese sausage', 1),
(18, NULL, 11, N'Fried Kway Teow with Extra Cockles', 7.50, N'Noodles', N'Kway teow with extra fresh cockles', 1);
SET IDENTITY_INSERT Menus OFF;
GO

-- ============================================================
-- Table: Inspections
-- ============================================================
SET IDENTITY_INSERT Inspections ON;
INSERT INTO Inspections (inspectionId, stallId, officerId, inspectionDate, status) VALUES
(1, 1, 5, '2026-03-10', N'Completed'),
(2, 7, 5, '2026-03-15', N'Completed'),
(3, 13, 5, '2026-03-20', N'Follow-up Required'),
(4, 1, 5, '2026-07-19', N'In Progress'),
(5, 7, 5, '2026-07-25', N'Scheduled');
SET IDENTITY_INSERT Inspections OFF;
GO

-- ============================================================
-- Table: Orders (with all columns from CustomerModuleMerge)
-- vendorId is set to match each order's stall's actual vendor (Stalls.vendorId
-- above) - every vendor-facing page (dashboard, order queue, notifications)
-- ============================================================
SET IDENTITY_INSERT Orders ON;
INSERT INTO Orders (orderId, stallId, vendorId, customerId, customerName, customerPhone, orderDate, status, totalAmount, paymentMethod, paymentStatus, specialInstructions, voucherId, discountAmount) VALUES
(1, 1, 1, 4, N'John Tan', N'91234567', '2026-05-01T12:15:00', N'completed', 9.90, N'cash', N'paid', N'Extra chili sauce', 1, 1.10),
(2, 2, 2, 6, N'Mary Lim', N'92345678', '2026-05-02T12:30:00', N'preparing', 14.00, N'nets', N'pending', N'No pork', NULL, 0),
(3, 3, 3, 7, N'David Lee', N'93456789', '2026-05-03T13:00:00', N'pending', 18.50, N'cash', N'pending', N'Extra crispy duck', NULL, 0),
(4, 7, 2, 8, N'Sarah Ong', N'94567890', '2026-05-04T13:15:00', N'ready', 14.00, N'paynow', N'paid', N'Extra prawns', NULL, 0),
(5, 11, NULL, 9, N'James Wong', N'95678901', '2026-05-05T13:30:00', N'preparing', 12.50, N'card', N'pending', N'Less spicy', NULL, 0),
(6, 1, 1, 4, N'John Tan', N'91234567', DATEADD(HOUR, 12, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 4.50, N'cash', N'paid', NULL, NULL, 0),
(7, 1, 1, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 12, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 9.00, N'paynow', N'paid', NULL, NULL, 0),
(8, 1, 1, 7, N'David Lee', N'93456789', DATEADD(HOUR, 19, DATEADD(DAY, -3, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'preparing', 2.00, N'cash', N'pending', NULL, NULL, 0),
(9, 2, 2, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 13, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'nets', N'paid', NULL, NULL, 0),
(10, 2, 2, 9, N'James Wong', N'95678901', DATEADD(HOUR, 12, DATEADD(DAY, -4, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.50, N'card', N'paid', NULL, NULL, 0),
(11, 2, 2, 4, N'John Tan', N'91234567', DATEADD(HOUR, 18, DATEADD(DAY, -10, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'ready', 5.00, N'cash', N'paid', NULL, NULL, 0),
(12, 3, 3, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 19, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.00, N'paynow', N'paid', NULL, NULL, 0),
(13, 3, 3, 7, N'David Lee', N'93456789', DATEADD(HOUR, 12, DATEADD(DAY, -5, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'cash', N'paid', NULL, NULL, 0),
(14, 3, 3, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 20, DATEADD(DAY, -15, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'pending', 7.50, N'card', N'pending', NULL, NULL, 0),
(15, 1, 1, 9, N'James Wong', N'95678901', DATEADD(HOUR, 12, DATEADD(DAY, -20, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.00, N'cash', N'paid', NULL, NULL, 0),
(16, 6, 3, 4, N'John Tan', N'91234567', DATEADD(HOUR, 18, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'nets', N'paid', NULL, NULL, 0),
(17, 6, 3, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 19, DATEADD(DAY, -3, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.50, N'cash', N'paid', NULL, NULL, 0),
(18, 6, 3, 7, N'David Lee', N'93456789', DATEADD(HOUR, 12, DATEADD(DAY, -7, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'preparing', 10.00, N'paynow', N'pending', NULL, NULL, 0),
(19, 7, 2, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 12, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.00, N'card', N'paid', NULL, NULL, 0),
(20, 7, 2, 9, N'James Wong', N'95678901', DATEADD(HOUR, 13, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 8.00, N'cash', N'paid', NULL, NULL, 0),
(21, 7, 2, 4, N'John Tan', N'91234567', DATEADD(HOUR, 19, DATEADD(DAY, -6, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'ready', 8.50, N'nets', N'paid', NULL, NULL, 0),
(22, 6, 3, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 18, DATEADD(DAY, -12, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 6.50, N'cash', N'paid', NULL, NULL, 0),
(23, 7, 2, 7, N'David Lee', N'93456789', DATEADD(HOUR, 20, DATEADD(DAY, -14, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'pending', 6.00, N'paynow', N'pending', NULL, NULL, 0),
(24, 6, 3, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 12, DATEADD(DAY, -25, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.00, N'card', N'paid', NULL, NULL, 0),
(25, 7, 2, 9, N'James Wong', N'95678901', DATEADD(HOUR, 19, DATEADD(DAY, -28, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 8.00, N'cash', N'paid', NULL, NULL, 0),
(26, 11, NULL, 4, N'John Tan', N'91234567', DATEADD(HOUR, 12, DATEADD(DAY, -1, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.50, N'nets', N'paid', NULL, NULL, 0),
(27, 11, NULL, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 13, DATEADD(DAY, -2, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'cash', N'paid', NULL, NULL, 0),
(28, 11, NULL, 7, N'David Lee', N'93456789', DATEADD(HOUR, 19, DATEADD(DAY, -4, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'preparing', 11.00, N'paynow', N'pending', NULL, NULL, 0),
(29, 11, NULL, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 12, DATEADD(DAY, -6, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'card', N'paid', NULL, NULL, 0),
(30, 11, NULL, 9, N'James Wong', N'95678901', DATEADD(HOUR, 18, DATEADD(DAY, -9, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'pending', 5.50, N'cash', N'pending', NULL, NULL, 0),
(31, 11, NULL, 4, N'John Tan', N'91234567', DATEADD(HOUR, 12, DATEADD(DAY, -13, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'nets', N'paid', NULL, NULL, 0),
(32, 11, NULL, 6, N'Mary Lim', N'92345678', DATEADD(HOUR, 19, DATEADD(DAY, -18, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.50, N'cash', N'paid', NULL, NULL, 0),
(33, 11, NULL, 7, N'David Lee', N'93456789', DATEADD(HOUR, 12, DATEADD(DAY, -22, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'ready', 7.50, N'paynow', N'paid', NULL, NULL, 0),
(34, 11, NULL, 8, N'Sarah Ong', N'94567890', DATEADD(HOUR, 18, DATEADD(DAY, -26, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 5.50, N'card', N'paid', NULL, NULL, 0),
(35, 11, NULL, 9, N'James Wong', N'95678901', DATEADD(HOUR, 20, DATEADD(DAY, -29, CAST(CAST(GETDATE() AS DATE) AS DATETIME2))), N'completed', 7.50, N'cash', N'paid', NULL, NULL, 0);
SET IDENTITY_INSERT Orders OFF;
GO

-- ============================================================
-- Table: OrderItems (with promotion columns from PromotionsAndVouchers)
-- ============================================================
SET IDENTITY_INSERT OrderItems ON;
INSERT INTO OrderItems (orderItemId, orderId, menuId, itemName, quantity, unitPrice, subtotal, originalUnitPrice, promotionId, specialRequests) VALUES
(1, 1, 1, N'Fishball Noodles (Dry)', 2, 4.50, 9.00, 4.50, NULL, N'Extra chili'),
(2, 1, 3, N'Extra Fishballs', 1, 2.00, 2.00, 2.00, NULL, NULL),
(3, 2, 5, N'Lor Mee', 1, 5.00, 5.00, 5.00, NULL, NULL),
(4, 2, 7, N'Fried Fish Cake', 1, 2.50, 2.50, 2.50, NULL, N'Extra crispy'),
(5, 2, 6, N'Lor Mee with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(6, 3, 8, N'Roasted Duck Rice', 1, 6.00, 6.00, 6.00, NULL, N'Extra crispy duck'),
(7, 3, 9, N'Char Siew Rice', 1, 5.00, 5.00, 5.00, NULL, NULL),
(8, 3, 10, N'Roasted Meat Combo', 1, 7.50, 7.50, 7.50, NULL, NULL),
(9, 4, 14, N'Fried Hokkien Mee', 1, 6.00, 6.00, 6.00, NULL, N'Extra prawns'),
(10, 4, 15, N'Fried Hokkien Mee (Large)', 1, 8.00, 8.00, 8.00, NULL, NULL),
(11, 6, 1, N'Fishball Noodles (Dry)', 1, 4.50, 4.50, 4.50, NULL, NULL),
(12, 7, 2, N'Fishball Noodles (Soup)', 2, 4.50, 9.00, 4.50, NULL, NULL),
(13, 8, 3, N'Extra Fishballs', 1, 2.00, 2.00, 2.00, NULL, NULL),
(14, 9, 5, N'Lor Mee', 1, 5.00, 5.00, 5.00, NULL, NULL),
(15, 10, 6, N'Lor Mee with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(16, 11, 7, N'Fried Fish Cake', 2, 2.50, 5.00, 2.50, NULL, NULL),
(17, 12, 8, N'Roasted Duck Rice', 1, 6.00, 6.00, 6.00, NULL, NULL),
(18, 13, 9, N'Char Siew Rice', 1, 5.00, 5.00, 5.00, NULL, NULL),
(19, 14, 10, N'Roasted Meat Combo', 1, 7.50, 7.50, 7.50, NULL, NULL),
(20, 15, 4, N'Fishball Noodles Combo', 1, 6.00, 6.00, 6.00, NULL, NULL),
(21, 16, 12, N'Rojak', 1, 5.00, 5.00, 5.00, NULL, NULL),
(22, 17, 13, N'Rojak with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(23, 18, 12, N'Rojak', 2, 5.00, 10.00, 5.00, NULL, NULL),
(24, 19, 14, N'Fried Hokkien Mee', 1, 6.00, 6.00, 6.00, NULL, NULL),
(25, 20, 15, N'Fried Hokkien Mee (Large)', 1, 8.00, 8.00, 8.00, NULL, NULL),
(26, 21, 16, N'Fried Hokkien Mee with Extra Prawns', 1, 8.50, 8.50, 8.50, NULL, NULL),
(27, 22, 13, N'Rojak with Extra Ingredients', 1, 6.50, 6.50, 6.50, NULL, NULL),
(28, 23, 14, N'Fried Hokkien Mee', 1, 6.00, 6.00, 6.00, NULL, NULL),
(29, 24, 12, N'Rojak', 1, 5.00, 5.00, 5.00, NULL, NULL),
(30, 25, 15, N'Fried Hokkien Mee (Large)', 1, 8.00, 8.00, 8.00, NULL, NULL),
(31, 26, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(32, 27, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(33, 28, 17, N'Fried Kway Teow', 2, 5.50, 11.00, 5.50, NULL, NULL),
(34, 29, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(35, 30, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(36, 31, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(37, 32, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(38, 33, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL),
(39, 34, 17, N'Fried Kway Teow', 1, 5.50, 5.50, 5.50, NULL, NULL),
(40, 35, 18, N'Fried Kway Teow with Extra Cockles', 1, 7.50, 7.50, 7.50, NULL, NULL);
SET IDENTITY_INSERT OrderItems OFF;
GO

-- ============================================================
-- Table: Promotions (from PromotionsAndVouchers)
-- ============================================================
SET IDENTITY_INSERT Promotions ON;
INSERT INTO Promotions (promotionId, vendorId, stallId, name, description, discountType, discountValue, scopeType, scopeCategory, scopeMenuId, isActive, startDate, endDate, createdAt, updatedAt) VALUES
(1, 1, 1, N'Fishball Special', N'Free extra fishballs with two noodle bowls.', N'percentage', 15.00, N'all', NULL, NULL, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE(), GETDATE()),
(2, 2, 2, N'Lor Mee Afternoon Special', N'One dollar off Lor Mee after 2 PM.', N'fixed', 1.00, N'all', NULL, NULL, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE(), GETDATE()),
(3, 3, 13, N'Western Combo', N'Free drink with Chicken Chop.', N'percentage', 10.00, N'all', NULL, NULL, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE(), GETDATE());
SET IDENTITY_INSERT Promotions OFF;
GO

-- ============================================================
-- Table: PromotionItems (from PromotionMultiItemScope)
-- ============================================================
INSERT INTO PromotionItems (promotionId, menuId) VALUES
(1, 1),
(1, 2),
(2, 5);
GO

-- ============================================================
-- Table: Vouchers (from PromotionsAndVouchers)
-- ============================================================
SET IDENTITY_INSERT Vouchers ON;
INSERT INTO Vouchers (voucherId, vendorId, stallId, code, description, discountType, discountValue, minOrderAmount, usageLimit, usageCount, isActive, startDate, endDate, createdAt) VALUES
(1, 1, 1, N'WELCOME10', N'10% off for new customers', N'percentage', 10.00, 10.00, 50, 1, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE()),
(2, 2, 2, N'LORMEEMAY', N'$2 off Lor Mee orders', N'fixed', 2.00, 5.00, 30, 0, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE()),
(3, 3, 3, N'ROASTED5', N'$5 off any roasted meat combo', N'fixed', 5.00, 15.00, 20, 0, 1, DATEADD(DAY, -30, GETDATE()), DATEADD(DAY, 60, GETDATE()), GETDATE());
SET IDENTITY_INSERT Vouchers OFF;
GO

-- ============================================================
-- Table: VoucherRedemptions (from PromotionsAndVouchers)
-- ============================================================
INSERT INTO VoucherRedemptions (voucherId, orderId, discountAmount, redeemedAt) VALUES
(1, 1, 1.10, '2026-05-01T12:15:00');
GO

-- ============================================================
-- Table: Favorites (from CustomerModuleMerge)
-- ============================================================
INSERT INTO Favorites (userId, centreId, stallId, menuId, createdAt) VALUES
(4, 1, NULL, NULL, GETDATE()),  -- John Tan favorites Tiong Bahru Hawker Centre
(4, NULL, 1, NULL, GETDATE()),  -- John Tan favorites Ah Hock stall
(4, NULL, NULL, 1, GETDATE()),  -- John Tan favorites Fishball Noodles
(6, 1, 2, NULL, GETDATE()),     -- Mary Lim favorites Lor Mee stall
(6, NULL, NULL, 5, GETDATE()),  -- Mary Lim favorites Lor Mee item
(7, 2, 7, NULL, GETDATE()),     -- David Lee favorites Hokkien Mee stall
(8, 3, 13, NULL, GETDATE()),    -- Sarah Ong favorites Western Food stall
(9, 1, 3, NULL, GETDATE());     -- James Wong favorites Roasted Meat stall
GO

-- ============================================================
-- Table: Notifications (from Notifications.sql)
-- vendorId here already matched each order's stall's real vendor — it's what
-- gave away that the Orders insert above was missing vendorId in the first place.
-- ============================================================
INSERT INTO Notifications (vendorId, type, title, message, linkUrl, referenceType, referenceId, isRead, createdAt) VALUES
(1, N'new_order', N'New Order Received', N'You have a new order #1 from John Tan', N'/vendor/orders/1', N'order', 1, 0, GETDATE()),
(2, N'new_order', N'New Order Received', N'You have a new order #2 from Mary Lim', N'/vendor/orders/2', N'order', 2, 0, GETDATE()),
(3, N'new_order', N'New Order Received', N'You have a new order #3 from David Lee', N'/vendor/orders/3', N'order', 3, 0, GETDATE()),
(2, N'new_order', N'New Order Received', N'You have a new order #4 from Sarah Ong', N'/vendor/orders/4', N'order', 4, 0, GETDATE());
GO

-- ============================================================
-- Table: StockItems (from InventoryAndTargets.sql)
-- ============================================================
INSERT INTO StockItems (vendorId, stallId, itemName, quantity, unit, category, description, inStock) VALUES
(1, 1, N'Fishballs', 50.00, N'pieces', N'Ingredients', N'Fresh fishballs for noodle dishes', 1),
(1, 1, N'Noodles', 20.00, N'kg', N'Ingredients', N'Fresh egg noodles', 1),
(1, 1, N'Chili Sauce', 5.00, N'liters', N'Sauces', N'House-made spicy chili sauce', 1),
(2, 2, N'Lor Mee Gravy', 10.00, N'liters', N'Sauces', N'Thick braised gravy', 1),
(2, 2, N'Pork Slices', 15.00, N'kg', N'Ingredients', N'Sliced pork for lor mee', 1),
(2, 7, N'Prawns', 10.00, N'kg', N'Ingredients', N'Fresh prawns for Hokkien mee', 1),
(3, 3, N'Duck', 10.00, N'kg', N'Ingredients', N'Roasted duck', 1),
(3, 3, N'Char Siew', 8.00, N'kg', N'Ingredients', N'Roasted char siew', 1);
GO

-- ============================================================
-- Table: MonthlyTargets (from InventoryAndTargets.sql)
-- ============================================================
INSERT INTO MonthlyTargets (vendorId, stallId, targetType, targetValue, targetMonth, targetYear, createdAt, updatedAt) VALUES
(1, 1, N'revenue', 5000.00, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE()),
(2, 2, N'revenue', 4500.00, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE()),
(3, 3, N'revenue', 6000.00, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE()),
(2, 7, N'orders', 120, MONTH(GETDATE()), YEAR(GETDATE()), GETDATE(), GETDATE());
GO

-- ============================================================
-- Table: RentalAgreements (from RentalAgreements.sql + RentalRenewals.sql)
-- ============================================================
SET IDENTITY_INSERT RentalAgreements ON;
INSERT INTO RentalAgreements (AgreementId, StallId, OwnerId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions, RentalPrice, ContractType, ContractName) VALUES
(1, 1, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1800.00, N'Fixed Price', N'operator1'),
(2, 2, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1750.00, N'Fixed Price', N'operator1'),
(3, 3, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1900.00, N'Fixed Price', N'operator1'),
(4, 7, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 1850.00, N'Fixed Price', N'operator1'),
(5, 13, 10, '2026-01-01T00:00:00', '2026-12-31T23:59:59', N'Monthly rental paid by the first day of each month.', 2100.00, N'Fixed Price', N'operator1'),
(6, 2, 10, '2027-01-01T00:00:00', '2027-06-30T23:59:59', N'Monthly rental paid by the first day of each month.', 1850.00, N'Fixed Price', N'operator1');
SET IDENTITY_INSERT RentalAgreements OFF;
GO

-- ============================================================
-- Table: RentalRenewalRequests (from RentalRenewals.sql)
-- ============================================================
INSERT INTO RentalRenewalRequests (AgreementId, StallId, VendorId, Status, ProposedRentalPrice, ReviewedBy, ReviewNote, RequestedAt, ReviewedAt, NewAgreementId) VALUES
(1, 1, 1, N'pending', 1900.00, NULL, NULL, GETDATE(), NULL, NULL),
(2, 2, 2, N'approved', 1850.00, 10, N'Approved with new price', GETDATE(), GETDATE(), 6);
GO

-- ============================================================
-- Table: StallRequests (from StallRequests.sql)
-- ============================================================
INSERT INTO StallRequests (vendorId, centreId, stallName, unitNumber, description, status, reviewNote, requestedAt, reviewedAt, operatingHours, hygieneGrade, imageUrl) VALUES
(1, 2, N'New Fishball Stall', N'02-01', N'Requesting for additional stall', N'approved', N'Approved', '2026-05-01T10:00:00', '2026-05-05T14:00:00', N'8:00 AM - 8:00 PM', N'A', NULL),
(3, 3, N'New Rojak Stall', N'03-02', N'Requesting for stall at Chinatown', N'pending', NULL, '2026-06-01T11:00:00', NULL, NULL, NULL, NULL);
GO

-- ============================================================
-- Table: OperatorHawkerAssignments
-- ============================================================
SET IDENTITY_INSERT OperatorHawkerAssignments ON;
INSERT INTO OperatorHawkerAssignments (AssignmentId, OperatorId, HawkerId) VALUES
(1, 10, 1),
(2, 10, 2),
(3, 10, 3);
SET IDENTITY_INSERT OperatorHawkerAssignments OFF;
GO

-- ============================================================
-- Table: StallReviews (from CustomerReviews.sql)
-- ============================================================
SET IDENTITY_INSERT StallReviews ON;
INSERT INTO StallReviews (reviewId, orderId, stallId, customerId, customerName, rating, comment, createdAt) VALUES
(1, 1, 1, 4, N'John Tan', 5, N'Amazing fishball noodles, springy and fresh!', DATEADD(DAY, -1, GETDATE())),
(2, 7, 1, 6, N'Mary Lim', 2, N'Noodles arrived cold, disappointing.', DATEADD(DAY, -2, GETDATE())),
(3, 9, 2, 8, N'Sarah Ong', 4, N'Lor mee was tasty, generous portion.', DATEADD(DAY, -1, GETDATE())),
(4, 10, 2, 9, N'James Wong', 5, N'Best lor mee in the centre!', DATEADD(DAY, -4, GETDATE())),
(5, 12, 3, 6, N'Mary Lim', 3, N'Decent roasted duck, a bit dry.', DATEADD(DAY, -2, GETDATE())),
(6, 13, 3, 7, N'David Lee', 1, N'Too salty, would not recommend.', DATEADD(DAY, -5, GETDATE())),
(7, 16, 6, 4, N'John Tan', 5, N'Great rojak, generous prawn paste.', DATEADD(DAY, -1, GETDATE())),
(8, 19, 7, 8, N'Sarah Ong', 4, N'Solid hokkien mee with good wok hei.', DATEADD(DAY, -1, GETDATE())),
(9, 26, 11, 4, N'John Tan', 5, N'Fried kway teow was excellent, lots of cockles.', DATEADD(DAY, -1, GETDATE())),
(10, 27, 11, 6, N'Mary Lim', 2, N'Portion felt small for the price.', DATEADD(DAY, -2, GETDATE()));
SET IDENTITY_INSERT StallReviews OFF;
GO

-- ============================================================
-- Table: HawkerFeedback (from CentreManagementAndProfile.sql)
-- ============================================================
SET IDENTITY_INSERT HawkerFeedback ON;
INSERT INTO HawkerFeedback (FeedbackId, HawkerId, CustomerId, Rating, FacilityTag, Comment, CreatedAt) VALUES
(1, 1, 4, 5, N'Cleanliness', N'Tables were spotless.', DATEADD(DAY, -2, GETDATE())),
(2, 1, 6, 2, N'Toilets', N'Toilets need more frequent attention.', DATEADD(DAY, -5, GETDATE())),
(3, 1, 7, 4, N'Seating', N'Enough seats even during lunch rush.', DATEADD(DAY, -35, GETDATE())),
(4, 1, 8, 3, N'Queue', N'Long queues at some stalls during peak hours.', DATEADD(DAY, -40, GETDATE())),
(5, 2, 8, 5, N'Ventilation', N'Good airflow, not too hot.', DATEADD(DAY, -3, GETDATE())),
(6, 2, 9, 1, N'Cleanliness', N'Floor was sticky and dirty near the entrance.', DATEADD(DAY, -10, GETDATE())),
(7, 2, 4, 4, N'Seating', NULL, DATEADD(DAY, -20, GETDATE())),
(8, 2, 6, 3, N'Toilets', N'Could be cleaner in the afternoons.', DATEADD(DAY, -45, GETDATE())),
(9, 3, 7, 5, N'Cleanliness', N'Spotless as always.', DATEADD(DAY, -1, GETDATE())),
(10, 3, 9, 2, N'Queue', N'Queue management could improve during dinner.', DATEADD(DAY, -8, GETDATE())),
(11, 3, 8, 4, N'Ventilation', NULL, DATEADD(DAY, -25, GETDATE())),
(12, 3, 4, 3, N'Other', N'Signage to the stalls could be clearer.', DATEADD(DAY, -50, GETDATE()));
SET IDENTITY_INSERT HawkerFeedback OFF;
GO

-- ============================================================
-- Verify the data was inserted correctly
-- ============================================================
SELECT 'HawkerCentres' as TableName, COUNT(*) as RowCount FROM HawkerCentres
UNION ALL
SELECT 'UserAccounts', COUNT(*) FROM UserAccounts
UNION ALL
SELECT 'Stalls', COUNT(*) FROM Stalls
UNION ALL
SELECT 'Menus', COUNT(*) FROM Menus
UNION ALL
SELECT 'Orders', COUNT(*) FROM Orders
UNION ALL
SELECT 'OrderItems', COUNT(*) FROM OrderItems
UNION ALL
SELECT 'Promotions', COUNT(*) FROM Promotions
UNION ALL
SELECT 'PromotionItems', COUNT(*) FROM PromotionItems
UNION ALL
SELECT 'Vouchers', COUNT(*) FROM Vouchers
UNION ALL
SELECT 'VoucherRedemptions', COUNT(*) FROM VoucherRedemptions
UNION ALL
SELECT 'RentalAgreements', COUNT(*) FROM RentalAgreements
UNION ALL
SELECT 'RentalRenewalRequests', COUNT(*) FROM RentalRenewalRequests
UNION ALL
SELECT 'Favorites', COUNT(*) FROM Favorites
UNION ALL
SELECT 'Notifications', COUNT(*) FROM Notifications
UNION ALL
SELECT 'StockItems', COUNT(*) FROM StockItems
UNION ALL
SELECT 'MonthlyTargets', COUNT(*) FROM MonthlyTargets
UNION ALL
SELECT 'StallRequests', COUNT(*) FROM StallRequests
UNION ALL
SELECT 'Inspections', COUNT(*) FROM Inspections
UNION ALL
SELECT 'GradeHistory', COUNT(*) FROM GradeHistory
UNION ALL
SELECT 'StallReviews', COUNT(*) FROM StallReviews
UNION ALL
SELECT 'HawkerFeedback', COUNT(*) FROM HawkerFeedback
UNION ALL
SELECT 'OperatorHawkerAssignments', COUNT(*) FROM OperatorHawkerAssignments;
GO
