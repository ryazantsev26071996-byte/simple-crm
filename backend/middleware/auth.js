function getUserFromHeaders(req) {
  const role = (req.headers["x-user-role"] || "").toString().trim();
  const name = (req.headers["x-user-name"] || "").toString().trim();
  if (!role || !name) return null;

  // Normalize to canonical role values.
  const normalizedRole =
    role.toLowerCase() === "manager"
      ? "Manager"
      : role.toLowerCase() === "teacher"
        ? "Teacher"
        : role;

  return { role: normalizedRole, name };
}

function requireRole(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    const user = getUserFromHeaders(req);
    if (!user) {
      return res.status(401).json({ error: "Missing x-user-role/x-user-name headers" });
    }
    if (!normalizedAllowed.includes(user.role.toLowerCase())) {
      return res.status(403).json({ error: "Forbidden: insufficient role" });
    }
    req.user = user;
    return next();
  };
}

module.exports = {
  getUserFromHeaders,
  requireRole,
};

