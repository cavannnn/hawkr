/* USE, LIKE EVERY OTHER FILE IN THIS FOLDER. Without it, running this through sqlcmd
   without -d creates the table in [master] and the app then fails with
   "Invalid object name". The header used to argue the database name was unsettled;
   RUN_ORDER.md's first line commits to HawkerDatabase, so it is settled. */
USE HawkerDatabase;
GO

/* =============================================================================
   UserCuisinesTable.sql — a customer's My Palette: the cuisines they like.

   COPIED FROM UserAllergensTable.sql ON PURPOSE, line for line where it can be. The two
   features are the same shape — one row per choice, read whole, replaced whole, scoped to
   one person — so the two tables should be recognisably the same table with one word
   changed. Anyone who has read the allergens schema has already read this one.

   THE FK POINTS AT UserAccounts, for the reason the allergens file sets out at length:
   that is where 10 of the schema's 12 identity foreign keys already point. If the schema
   revamp lands somewhere else, this one line changes and nothing else in the cuisines code
   does.

   ON DELETE CASCADE, again matching allergens. A palette is meaningless without the person
   whose palette it is, so it goes when the account goes rather than being left as an
   orphan row pointing at a userId nobody owns any more.

   NO USE <database> — the database name is one of the things not yet settled.

   WHAT THIS TABLE CANNOT DO, AND IT MATTERS. The product rule is "up to five". A CHECK
   constraint cannot express it: the rule counts OTHER rows, and counting other rows needs a
   subquery in the CHECK or a trigger, and this module covers neither. So the cap is not in
   the schema — it is enforced in middleware/cuisineValidation.js before the write, and
   again in models/cuisineModel.js as the last line before the INSERT loop. The UNIQUE
   constraint below holds the half of the rule the database CAN hold: you cannot like Thai
   food twice.

   WHY NOT A REFERENCE TABLE OF CUISINES PLUS A JOIN TABLE. Same answer as allergens. The
   vocabulary is fixed, maintained by us in config/cuisines.js, and never edited by a user —
   so a Cuisines table would be a second copy of a list that already exists in code, with
   nothing to add but the chance of the two disagreeing. One row per "this user likes X",
   validated against the list in code.

   NOTHING READS THIS YET. It is a stored preference, by design — there is no
   recommendation model in this app and this table is not pretending to feed one. It exists
   so that the day somebody builds that, the answer is already collected.
   ========================================================================== */

IF OBJECT_ID('dbo.UserCuisines', 'U') IS NULL
BEGIN
    CREATE TABLE UserCuisines (
        userCuisineId INT IDENTITY(1,1) NOT NULL,
        userId        INT NOT NULL,
        cuisineName   NVARCHAR(50) NOT NULL,
        createdAt     DATETIME2 NOT NULL CONSTRAINT DfUserCuisinesCreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PkUserCuisines PRIMARY KEY (userCuisineId),
        -- One row per cuisine per person. Makes the replace idempotent and stops a
        -- double-submit storing "Thai" twice. It is also the only part of the "up to
        -- five" rule the schema can enforce — see the header.
        CONSTRAINT UqUserCuisines UNIQUE (userId, cuisineName),
        CONSTRAINT FkUserCuisinesUserAccounts FOREIGN KEY (userId)
            REFERENCES UserAccounts (userId) ON DELETE CASCADE
    );
END
GO

/* The only read is "every cuisine for one user", so the unique constraint above already
   serves it — userId is its leading column. No extra index. */

/* ===========================================================
   Sample rows
   ===========================================================
   Three of the five customers OperatorSampleData.sql creates get a palette, chosen to
   cover the three cases a screen has to draw:

     chloelim   5 cuisines — AT THE CAP. Opening My Palette on this account shows every
                remaining plate refusing to be picked, which is the rule made visible.
     ravikumar  3 cuisines — the ordinary middle.
     gracetoh   1 cuisine  — under the onboarding minimum of three, which is legal: the
                minimum gates the onboarding Next button, the server has never had one, and
                a person editing their palette in Settings is allowed to end up with one.

   ravikumar and sitinur deliberately share Indian and Thai, so "how many people like this
   cuisine" is a question with a non-trivial answer the first time anyone asks it.
   benyeo has no rows at all — the empty palette is a real state and needs testing too.

   Every name here is in config/cuisines.js. If you add a row, check it against that list:
   the API would refuse the same value, and sample data that the API would reject is a
   trap for whoever tries to reproduce it through the app.

   THE userId IS LOOKED UP BY USERNAME, never hard-coded, so it does not matter what ids
   the earlier scripts handed out. Same idiom as OperatorSampleData.sql.

   PLAIN INSERT WITH NO GUARDS — run this file once. Running it twice fails on
   UqUserCuisines, which is the constraint doing its job rather than a bug. */

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Japanese' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Korean' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Thai' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Chinese' FROM UserAccounts u WHERE u.username = N'chloelim';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Western' FROM UserAccounts u WHERE u.username = N'chloelim';

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Indian' FROM UserAccounts u WHERE u.username = N'ravikumar';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Thai' FROM UserAccounts u WHERE u.username = N'ravikumar';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Malay' FROM UserAccounts u WHERE u.username = N'ravikumar';

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Malay' FROM UserAccounts u WHERE u.username = N'sitinur';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Indian' FROM UserAccounts u WHERE u.username = N'sitinur';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Thai' FROM UserAccounts u WHERE u.username = N'sitinur';
INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Western' FROM UserAccounts u WHERE u.username = N'sitinur';

INSERT INTO UserCuisines (userId, cuisineName)
SELECT u.userId, N'Pizza' FROM UserAccounts u WHERE u.username = N'gracetoh';
GO
