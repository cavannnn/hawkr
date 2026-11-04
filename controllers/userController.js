const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function register(req, res) {
  const { username, password, email, role, phone } = req.body;
  try {
    // Same phone format the order validation enforces, so a number saved at sign-up is
    // always usable as the customer's contact number at checkout.
    if (phone && !/^[0-9]{8,12}$/.test(phone)) {
      return res.status(400).json({ message: "Phone number must be 8 to 12 digits." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const success = await User.createUser(username, hashed, email, role, phone);
    if (success) {
      res.status(201).json({ message: "User registered successfully" });
    } else {
      res.status(400).json({ message: "Registration failed" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function login(req, res) {
  const { username, password } = req.body;
  try {
    const user = await User.findUserByUsername(username);
    if (!user) return res.status(404).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user.userId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.json({ token, role: user.role, userId: user.userId, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function guestLogin(req, res) {
  const token = jwt.sign(
    { id: "guest", role: "guest" },
    process.env.JWT_SECRET,
    { expiresIn: "30m" }
  );
  res.json({ token, role: "guest" });
}

module.exports = { register, login, guestLogin };
