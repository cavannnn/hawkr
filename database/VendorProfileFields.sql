/* ===========================================================
   Vendor profile fields
   Adds the optional fields a vendor can fill in from the
   Profile page (contact number, gender, profile picture).
   profilePicture stores the uploaded file's path under
   public/uploads/avatars/,
   set via POST /vendor/:id/profile/picture
   =========================================================== */

IF COL_LENGTH('UserAccounts', 'contactNumber') IS NULL
    ALTER TABLE UserAccounts ADD contactNumber NVARCHAR(20) NULL;
GO

IF COL_LENGTH('UserAccounts', 'gender') IS NULL
    ALTER TABLE UserAccounts ADD gender NVARCHAR(20) NULL;
GO

IF COL_LENGTH('UserAccounts', 'profilePicture') IS NULL
    ALTER TABLE UserAccounts ADD profilePicture NVARCHAR(500) NULL;
GO
