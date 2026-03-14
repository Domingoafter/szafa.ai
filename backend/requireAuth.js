const admin = require("./firebaseAdmin");

module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Brak tokenu" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (e) {
    console.error("Błąd verifyIdToken:", e);
    return res.status(401).json({ error: "Zły token" });
  }
};