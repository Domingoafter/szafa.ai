const admin = require("./firebaseAdmin");
const { pool } = require("./db");
module.exports = async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Brak tokenu" });

  try {
  const decoded = await admin.auth().verifyIdToken(token);

  req.user = decoded;

  await pool.query(
    `insert into users (id, email)
     values ($1, $2)
     on conflict (id) do update set email = excluded.email`,
    [decoded.uid, decoded.email || null]
  );

  next();

} catch (e) {
  return res.status(401).json({ error: "Zły token" });
}
};
