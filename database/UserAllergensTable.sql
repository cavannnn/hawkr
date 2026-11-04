/* USE, LIKE EVERY OTHER FILE IN THIS FOLDER. Without it, running this through sqlcmd
   without -d creates the table in [master] and the app then fails with
   "Invalid object name". The header used to argue the database name was unsettled;
   RUN_ORDER.md's first line commits to HawkerDatabase, so it is settled. */
USE HawkerDatabase;
GO

/* =============================================================================
   UserAllergensTable.sql — a customer's saved allergens.

   PROPOSAL FOR THE SCHEMA REVAMP, not another standalone script. The repo already has
   20 DDL files with Stalls, RentalAgreements, Promotions, OrderItems and Inspections
   each defined twice; adding a twenty-first in the same week the team is consolidating
   would be the same mistake again. Kept as one idempotent block so it lifts straight
   into whatever canonical script the revamp produces.

   THE FK IS THE ONLY LINE THE REVAMP DECIDES. It points at UserAccounts because that is
   where 10 of the schema's 12 identity foreign keys already point (Favorites, Inventory,
   Notifications, Promotions, RentalAgreements, RentalRenewals, StallRequests,
   VendorDashboards). Only Feedback and Likes still hang off Customers. If the revamp
   lands somewhere else, this one line changes and nothing else in the allergens code
   does — the model, controller, routes and validation are identifier-agnostic apart
   from the table and column names in two queries.

   No USE <database> — the database name is one of the things not yet settled.

   WHY ONE TABLE AND NOT THREE. The obvious modelling is a reference table of allergens,
   a join table, and a third for free-text customs. This stores one row per "this user is
   allergic to X" and decides standard-vs-custom by testing membership of the vocabulary
   in code, so the two can never disagree. A stored isCustom flag can drift from the list;
   a derived one can't.

   The vocabulary itself lives in middleware/validate.js (server-side, authoritative) and
   mirrors hawkr2/allergens.js, which is the front end's single source for the same seven
   ids plus their presentation. Those two lists must stay in step — see the comment in
   both files.
   ========================================================================== */

IF OBJECT_ID('dbo.UserAllergens', 'U') IS NULL
BEGIN
    CREATE TABLE UserAllergens (
        userAllergenId INT IDENTITY(1,1) NOT NULL,
        userId         INT NOT NULL,
        allergenName   NVARCHAR(50) NOT NULL,
        createdAt      DATETIME2 NOT NULL CONSTRAINT DfUserAllergensCreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PkUserAllergens PRIMARY KEY (userAllergenId),
        -- One row per allergen per person. Makes the replace idempotent and stops a
        -- double-submit storing "nuts" twice.
        CONSTRAINT UqUserAllergens UNIQUE (userId, allergenName),
        CONSTRAINT FkUserAllergensUserAccounts FOREIGN KEY (userId)
            REFERENCES UserAccounts (userId) ON DELETE CASCADE
    );
END
GO

/* The only read is "every allergen for one user", so the unique constraint above already
   serves it — userId is its leading column. No extra index. */
