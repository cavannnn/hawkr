const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  // if No Authorization header sent at all
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided. Please log in." });
  }

  // if Header exists but doesn't contain an actual token after "Bearer "
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Malformed token. Please log in again." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    // Case 3: Token exists but is invalid, tampered, or expired
    if (err.name === "TokenExpiredError") {
      return res.status(403).json({ message: "Session expired. Please log in again." });
    }
    return res.status(403).json({ message: "Invalid token. Please log in again." });
  }
}

// only allow users whose token role matches what's required
function requireRole(role) {
  return (req, res, next) => {
    const tokenRole = req.user.role || req.user.Role;
    if (!tokenRole || tokenRole.toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({ message: `Access denied. ${role} role required.` });
    }
    next();
  };
}

// only allow a user to act on their own :id route param,
// so one vendor can't view/edit another vendor's data by changing the URL/id.
function requireOwnId(paramName = "id") {
  return (req, res, next) => {
    const tokenUserId = req.user.id ?? req.user.UserId ?? req.user.OperatorId;
    if (tokenUserId === undefined || String(tokenUserId) !== String(req.params[paramName])) {
      return res.status(403).json({ message: "Access denied. You can only access your own account." });
    }
    next();
  };
}

// like requireRole, but passes if the token role matches ANY of the given roles —
// for endpoints shared by more than one role (e.g. tickets: customer or vendor)
function requireAnyRole(roles) {
  const allowed = roles.map(r => r.toLowerCase());
  return (req, res, next) => {
    const tokenRole = req.user.role || req.user.Role;
    if (!tokenRole || !allowed.includes(tokenRole.toLowerCase())) {
      return res.status(403).json({ message: `Access denied. One of these roles required: ${roles.join(", ")}.` });
    }
    next();
  };
}

function getOfficerId(req) {
  return req.user?.userId ?? req.user?.id;
}

function attachUser(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // An unreadable token is the same as no token here — the guarded routes still refuse it.
  }
  next();
}

module.exports = { verifyToken, attachUser, requireRole, requireAnyRole, requireOwnId, getOfficerId };