const sql = require("mssql");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

// GET vendor profile
async function getVendorProfile(req, res) {
  const { id } = req.params;
  try {
    const result = await sql.query`
      SELECT UserId, UserName, Email, Role, CreatedAt, ContactNumber, Gender, ProfilePicture
      FROM UserAccounts
      WHERE UserId = ${id} AND Role = 'vendor'
    `;
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    console.error("Error fetching vendor profile:", err);
    res.status(500).json({ message: err.message });
  }
}

// PUT vendor profile (text fields only, profile picture is uploaded separately)
async function updateVendorProfile(req, res) {
  const { id } = req.params;
  const { email, password, contactNumber, gender } = req.body;
  try {
    const hashed = password ? await bcrypt.hash(password, 10) : null;

    const request = new sql.Request();
    request.input("id", sql.Int, id);
    request.input("email", sql.NVarChar, email);
    request.input("contactNumber", sql.NVarChar, contactNumber || null);
    request.input("gender", sql.NVarChar, gender || null);
    if (hashed) request.input("passwordHash", sql.NVarChar, hashed);

    let query = `
      UPDATE UserAccounts
      SET Email = @email,
          ContactNumber = @contactNumber,
          Gender = @gender
    `;
    if (hashed) query += ", PasswordHash = @passwordHash";
    query += " WHERE UserId = @id AND Role = 'vendor'";

    await request.query(query);
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.error("Error updating vendor profile:", err);
    res.status(500).json({ message: err.message });
  }
}

// POST vendor profile picture
async function uploadProfilePicture(req, res) {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: "No image file was uploaded." });
  }

  const newPictureUrl = `/uploads/avatars/${req.file.filename}`;

  try {
    const existing = await sql.query`
      SELECT ProfilePicture FROM UserAccounts WHERE UserId = ${id} AND Role = 'vendor'
    `;
    if (existing.recordset.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "Vendor not found" });
    }

    await sql.query`
      UPDATE UserAccounts SET ProfilePicture = ${newPictureUrl}
      WHERE UserId = ${id} AND Role = 'vendor'
    `;

    // Clean up the old file on disk
    const oldPicture = existing.recordset[0].ProfilePicture;
    if (oldPicture && oldPicture.startsWith("/uploads/avatars/")) {
      const oldPath = path.join(__dirname, "..", "public", oldPicture);
      fs.unlink(oldPath, () => {});
    }

    res.json({ message: "Profile picture updated successfully", profilePicture: newPictureUrl });
  } catch (err) {
    console.error("Error uploading profile picture:", err);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getVendorProfile, updateVendorProfile, uploadProfilePicture };
