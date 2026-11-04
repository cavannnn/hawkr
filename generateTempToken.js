const jwt = require('jsonwebtoken');
require('dotenv').config();

// This payload must match what your middleware expects
const payload = {
    userId: 5,
    role: 'NEA_officer'
};

// Sign the token using the secret from your .env
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

console.log("--- COPY THIS TOKEN INTO POSTMAN ---");
console.log(token);
