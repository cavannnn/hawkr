const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const sql = require('mssql');
const dbConfig = require('../dbConfig');

// Secret key used to "seal" the JWT  (must be kept private, stored in .env)
const JWT_SECRET = process.env.JWT_SECRET;

// Handles operator login: checks credentials, then issues a signed JWT
async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const pool = await sql.connect(dbConfig);

    // Look up the operator by username
    const result = await pool
      .request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM Operators WHERE Username = @username');

    const operator = result.recordset[0];

    // If no matching operator found, reject
    if (!operator) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Compare the entered password against the hashed password stored in DB
    const isPasswordValid = await bcrypt.compare(password, operator.PasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Build the "payload" (the info we want stamped onto the wristband (JWT))
    const payload = {
      OperatorId: operator.OperatorId,
      Username: operator.Username,
      Role: 'Operator',
    };

    // Sign the token: encodes payload and seals it with our secret key
    // expiresIn: token automatically becomes invalid after 1 hour (forces re-login)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    // Send the token back to the client — they'll attach it to future requests
    res.json({ message: 'Login successful', token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed due to server error' });
  }
}

module.exports = { login };