import {
  ensureIdentitySchema,
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
  ROLE_NAMES,
} from "./_lib/auth.js";
import { sql } from "./_lib/db.js";
import { readJsonBody } from "./_lib/request.js";

export const config = {
  runtime: "nodejs",
};

const parseGroupNumber = (value) => {
  const groupNumber = Number(value);

  if (!Number.isInteger(groupNumber) || groupNumber < 1) {
    return 0;
  }

  return groupNumber;
};

const parseSuperintendentUserId = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const userId = Number(value);

  if (!Number.isInteger(userId) || userId < 1) {
    return null;
  }

  return userId;
};

const getAuthContext = async (req) => {
  const hasAuthHeader = Boolean(req.headers.authorization);

  if (!hasAuthHeader) {
    return null;
  }

  const auth = requireAuth(req);

  if (!auth) {
    return undefined;
  }

  const freshAuth = await refreshAuthFromDatabase(auth);

  if (!freshAuth) {
    return undefined;
  }

  return freshAuth;
};

const validateSuperintendent = async (userId) => {
  if (userId === null) {
    return true;
  }

  const result = await sql`
    SELECT
      id,
      role,
      is_active AS "isActive"
    FROM users
    WHERE id = ${userId}
    LIMIT 1;
  `;

  const user = result.rows[0] || null;

  if (!user) {
    return false;
  }

  if (ROLE_NAMES.groupAdmin !== String(user.role || "")) {
    return false;
  }

  return true === Boolean(user.isActive);
};

export default async function handler(req, res) {
  try {
    await ensureIdentitySchema();

    if (req.method === "GET") {
      const auth = await getAuthContext(req);

      if (auth === undefined) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const result = await sql`
        SELECT
          g.group_number AS "groupNumber",
          g.name,
          g.superintendent_user_id AS "superintendentUserId",
          u.username AS "superintendentUsername"
        FROM groups g
        LEFT JOIN users u ON u.id = g.superintendent_user_id
        ORDER BY g.group_number ASC;
      `;

      if (!auth || !isSuperAdmin(auth)) {
        const publicItems = result.rows.map((item) => ({
          groupNumber: item.groupNumber,
          name: item.name,
        }));

        res.status(200).json({ items: publicItems });
        return;
      }

      res.status(200).json({ items: result.rows });
      return;
    }

    if (req.method !== "POST" && req.method !== "PUT") {
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

    const body = await readJsonBody(req);

    if (!body) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const groupNumber = parseGroupNumber(body.groupNumber);
    const name = String(body.name || "").trim();
    const superintendentUserId = parseSuperintendentUserId(body.superintendentUserId);

    if (!groupNumber) {
      res.status(400).json({ error: "Invalid group number" });
      return;
    }

    if (name.length < 2 || name.length > 120) {
      res.status(400).json({ error: "Invalid group name" });
      return;
    }

    if (!(await validateSuperintendent(superintendentUserId))) {
      res.status(400).json({ error: "Invalid superintendent user" });
      return;
    }

    if (req.method === "POST") {
      const existsResult = await sql`
        SELECT group_number
        FROM groups
        WHERE group_number = ${groupNumber}
        LIMIT 1;
      `;

      if (0 < existsResult.rows.length) {
        res.status(409).json({ error: "Group already exists" });
        return;
      }

      await sql`
        INSERT INTO groups (
          group_number,
          name,
          superintendent_user_id
        )
        VALUES (
          ${groupNumber},
          ${name},
          ${superintendentUserId}
        );
      `;

      if (superintendentUserId !== null) {
        await sql`
          UPDATE groups
          SET
            superintendent_user_id = NULL,
            updated_at = NOW()
          WHERE superintendent_user_id = ${superintendentUserId}
            AND group_number <> ${groupNumber};
        `;

        await sql`
          UPDATE users
          SET
            group_number = ${groupNumber},
            updated_at = NOW()
          WHERE id = ${superintendentUserId};
        `;
      }

      res.status(200).json({ ok: true, groupNumber });
      return;
    }

    const existsResult = await sql`
      SELECT group_number
      FROM groups
      WHERE group_number = ${groupNumber}
      LIMIT 1;
    `;

    if (0 === existsResult.rows.length) {
      res.status(404).json({ error: "Group not found" });
      return;
    }

    await sql`
      UPDATE groups
      SET
        name = ${name},
        superintendent_user_id = ${superintendentUserId},
        updated_at = NOW()
      WHERE group_number = ${groupNumber};
    `;

    if (superintendentUserId !== null) {
      await sql`
        UPDATE groups
        SET
          superintendent_user_id = NULL,
          updated_at = NOW()
        WHERE superintendent_user_id = ${superintendentUserId}
          AND group_number <> ${groupNumber};
      `;

      await sql`
        UPDATE users
        SET
          group_number = ${groupNumber},
          updated_at = NOW()
        WHERE id = ${superintendentUserId};
      `;
    }

    res.status(200).json({ ok: true, groupNumber });
  } catch (error) {
    if (String(error?.code || "") === "23505") {
      res.status(409).json({ error: "Superintendent already assigned" });
      return;
    }

    res.status(500).json({ error: "Database error", detail: String(error) });
  }
}
