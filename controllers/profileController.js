const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');

const profileModel = require('../models/profileModel');

const UPLOAD_ROOT = path.join(__dirname, '..', 'public', 'uploads', 'profile-photos');

function currentUserId(req) {
  return req.user.id ?? req.user.UserId;
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

async function getProfile(req, res) {
  try {
    const profile = await profileModel.getProfileById(currentUserId(req));
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

async function updateProfile(req, res) {
  const userId = currentUserId(req);
  const { UserName, Email, PhoneNumber } = req.body;

  try {
    if (await profileModel.isUsernameTaken(UserName, userId)) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    if (Email && (await profileModel.isEmailTaken(Email, userId))) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    await profileModel.updateProfile(userId, { UserName, Email, PhoneNumber });
    const profile = await profileModel.getProfileById(userId);
    res.json({ message: 'Profile updated', profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

async function uploadPhoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo file was uploaded' });
  }

  const userId = currentUserId(req);
  try {
    const userDir = path.join(UPLOAD_ROOT, String(userId));
    await fs.mkdir(userDir, { recursive: true });

    const safeName = `${Date.now()}-${sanitizeFileName(req.file.originalname)}`;
    await fs.writeFile(path.join(userDir, safeName), req.file.buffer);

    const storagePath = `/uploads/profile-photos/${userId}/${safeName}`;
    await profileModel.updateProfilePhoto(userId, storagePath);

    res.json({ message: 'Profile photo updated', ProfilePhotoPath: storagePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
}

async function changePassword(req, res) {
  const userId = currentUserId(req);
  const { currentPassword, newPassword } = req.body;

  try {
    const existingHash = await profileModel.getPasswordHash(userId);
    if (!existingHash) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, existingHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await profileModel.updatePasswordHash(userId, newHash);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to change password' });
  }
}

async function deleteAccount(req, res) {
  const userId = currentUserId(req);
  try {
    await profileModel.deleteAccount(userId);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    if (err.number === 547) {
      return res.status(409).json({
        error: 'This account has records linked to it and cannot be deleted. Please contact an administrator.',
      });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
}

// ---------- Hawker centre assignments ----------

async function updateAssignments(req, res) {
  const userId = currentUserId(req);
  try {
    await profileModel.setAssignedHawkerIds(userId, req.body.hawkerIds);
    res.json({ message: 'Hawker centre assignments updated', hawkerIds: req.body.hawkerIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update hawker centre assignments' });
  }
}

async function getAllCentres(req, res) {
  try {
    const centres = await profileModel.getAllHawkerCentres();
    res.json(centres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hawker centres' });
  }
}

async function getMyCentres(req, res) {
  try {
    const centres = await profileModel.getAssignedHawkerCentres(currentUserId(req));
    res.json(centres);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch your hawker centres' });
  }
}

module.exports = {
  getProfile,
  updateProfile,
  uploadPhoto,
  changePassword,
  deleteAccount,
  updateAssignments,
  getAllCentres,
  getMyCentres,
};
