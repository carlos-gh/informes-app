import {
  hashPassword,
  refreshAuthFromDatabase,
  requireAuth,
  validatePasswordInput,
  verifyPasswordHash,
} from "../_lib/auth.js";
import { sql } from "../_lib/db.js";
import { readJsonBody } from "../_lib/request.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = requireAuth(req);

  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const freshAuth = await refreshAuthFromDatabase(auth);

  if (!freshAuth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const body = await readJsonBody(req);

  if (!body) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required" });
    return;
  }

  if (!validatePasswordInput(newPassword)) {
    res.status(400).json({ error: "Password does not meet policy" });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({ error: "New password must be different" });
    return;
  }

  const userResult = await sql`
    SELECT
      id,
      password_hash AS "passwordHash",
      is_active AS "isActive"
    FROM users
    WHERE id = ${freshAuth.userId}
    LIMIT 1;
  `;

  const user = userResult.rows[0] || null;

  if (!user || true !== Boolean(user.isActive)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!verifyPasswordHash(currentPassword, user.passwordHash)) {
    res.status(401).json({ error: "Current password is invalid" });
    return;
  }

  const nextPasswordHash = hashPassword(newPassword);

  await sql`
    UPDATE users
    SET
      password_hash = ${nextPasswordHash},
      updated_at = NOW()
    WHERE id = ${freshAuth.userId};
  `;

  res.status(200).json({ ok: true });
}
