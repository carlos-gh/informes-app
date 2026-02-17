import {
  ensureIdentitySchema,
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
} from "../_lib/auth.js";
import { sql } from "../_lib/db.js";

export const config = {
  runtime: "nodejs",
};

const parseLimit = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 50;
  }

  if (parsed > 200) {
    return 200;
  }

  return parsed;
};

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
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

    if (!isSuperAdmin(freshAuth)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await ensureIdentitySchema();

    const limit = parseLimit(req.query?.limit);

    const result = await sql`
      SELECT
        a.id,
        a.event_type AS "eventType",
        a.user_id AS "userId",
        a.username,
        a.ip_address AS "ipAddress",
        a.user_agent AS "userAgent",
        a.detail,
        a.created_at AS "createdAt",
        u.full_name AS "fullName",
        u.username AS "resolvedUsername"
      FROM auth_activity a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT ${limit};
    `;

    res.status(200).json({ items: result.rows });
  } catch (error) {
    res.status(500).json({ error: "Database error", detail: String(error) });
  }
}
