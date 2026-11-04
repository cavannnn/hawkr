USE HawkerDatabase;
GO

/* ===========================================================
   Promotions could only target "all items" or a single item.
   Widen scopeType to allow selecting several specific items via
   a join table, same as a category can already cover several items.
   =========================================================== */

IF OBJECT_ID('PromotionItems', 'U') IS NULL
CREATE TABLE PromotionItems (
    promotionItemId INT IDENTITY(1,1) PRIMARY KEY,
    promotionId INT NOT NULL FOREIGN KEY REFERENCES Promotions(promotionId),
    menuId INT NOT NULL FOREIGN KEY REFERENCES Menus(menuId),
    CONSTRAINT UqPromotionItemsPromotionMenu UNIQUE (promotionId, menuId)
);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CkPromotionsScopeType')
    ALTER TABLE Promotions DROP CONSTRAINT CkPromotionsScopeType;
GO

ALTER TABLE Promotions ADD CONSTRAINT CkPromotionsScopeType
    CHECK (scopeType IN ('all', 'category', 'items'));
GO

-- Any existing single-item promotions will become multi-item promotions with one item
IF COL_LENGTH('Promotions', 'scopeMenuId') IS NOT NULL
BEGIN
    INSERT INTO PromotionItems (promotionId, menuId)
    SELECT promotionId, scopeMenuId FROM Promotions
    WHERE scopeType = 'item' AND scopeMenuId IS NOT NULL;

    UPDATE Promotions SET scopeType = 'items' WHERE scopeType = 'item';
END
GO
