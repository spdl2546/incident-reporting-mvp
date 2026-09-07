import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import crypto from "node:crypto";

dotenv.config();
const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-this-secret";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

function makeIncidentNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `INC-${date}-${random}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}
function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}
function auth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = verifyToken(token);
  if (!user) return res.status(401).json({ message: "กรุณาเข้าสู่ระบบเจ้าหน้าที่" });
  req.user = user;
  next();
}
function roles(...allowed) {
  return (req, res, next) => allowed.includes(req.user?.role) ? next() : res.status(403).json({ message: "ไม่มีสิทธิ์ดำเนินการ" });
}

const allowedTypes = new Set(["traffic_accident", "fire", "medical", "crime", "other"]);
const allowedStatuses = new Set(["NEW", "IN_PROGRESS", "RESOLVED"]);

app.get("/api/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ ok: true, database: "connected" }); }
  catch { res.status(500).json({ ok: false, database: "error" }); }
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) return res.status(400).json({ message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
  try {
    const result = await pool.query("SELECT id, username, display_name, role, password_hash, active FROM users WHERE username = $1", [username]);
    const user = result.rows[0];
    if (!user || !user.active || !verifyPassword(password, user.password_hash)) return res.status(401).json({ message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    const safeUser = { id: user.id, username: user.username, display_name: user.display_name, role: user.role };
    res.json({ token: signToken(safeUser), user: safeUser });
  } catch (error) { console.error(error); res.status(500).json({ message: "เข้าสู่ระบบไม่สำเร็จ" }); }
});

app.get("/api/auth/me", auth, (req, res) => res.json({ user: req.user }));

app.post("/api/incidents", async (req, res) => {
  const { type, description, latitude, longitude, address } = req.body;
  if (!allowedTypes.has(type)) return res.status(400).json({ message: "ประเภทเหตุไม่ถูกต้อง" });
  if (typeof description !== "string" || description.trim().length < 3) return res.status(400).json({ message: "กรุณากรอกรายละเอียดเหตุ" });
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return res.status(400).json({ message: "พิกัดไม่ถูกต้อง" });
  try {
    const result = await pool.query(`INSERT INTO incidents (incident_number, type, description, latitude, longitude, address) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [makeIncidentNumber(), type, description.trim(), lat, lng, typeof address === "string" ? address.trim() : null]);
    res.status(201).json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: "บันทึกเหตุไม่สำเร็จ" }); }
});

app.get("/api/incidents", auth, async (_req, res) => {
  try { const result = await pool.query("SELECT * FROM incidents ORDER BY created_at DESC LIMIT 200"); res.json(result.rows); }
  catch (error) { console.error(error); res.status(500).json({ message: "ไม่สามารถโหลดรายการเหตุได้" }); }
});

app.patch("/api/incidents/:id/status", auth, roles("ADMIN", "OFFICER"), async (req, res) => {
  const status = String(req.body?.status || "");
  if (!allowedStatuses.has(status)) return res.status(400).json({ message: "สถานะไม่ถูกต้อง" });
  try {
    const result = await pool.query("UPDATE incidents SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *", [status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: "ไม่พบเหตุการณ์" });
    res.json(result.rows[0]);
  } catch (error) { console.error(error); res.status(500).json({ message: "เปลี่ยนสถานะไม่สำเร็จ" }); }
});

app.get("/api/dashboard/summary", auth, async (_req, res) => {
  try {
    const [totals, byType, byDay] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='NEW')::int AS new, COUNT(*) FILTER (WHERE status='IN_PROGRESS')::int AS in_progress, COUNT(*) FILTER (WHERE status='RESOLVED')::int AS resolved FROM incidents`),
      pool.query(`SELECT type, COUNT(*)::int AS count FROM incidents GROUP BY type ORDER BY count DESC`),
      pool.query(`SELECT d::date AS date, COUNT(i.id)::int AS count FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') d LEFT JOIN incidents i ON i.created_at::date = d::date GROUP BY d::date ORDER BY d::date`)
    ]);
    res.json({ ...totals.rows[0], by_type: byType.rows, by_day: byDay.rows });
  } catch (error) { console.error(error); res.status(500).json({ message: "โหลดสถิติไม่สำเร็จ" }); }
});

app.listen(port, () => console.log(`Incident API running at http://localhost:${port}`));
