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

const getGroupNumberFromRequest = (req) => {
  if (req.query && req.query.groupNumber) {
    return parseGroupNumber(req.query.groupNumber);
  }

  const url = req.url || "";
  const match = url.match(/\/groups\/(\d+)/);

  if (match && match[1]) {
    return parseGroupNumber(match[1]);
  }

  return 0;
};

const tableExists = async (tableName) => {
  const tableRef = `public.${String(tableName || "").trim()}`;

  if (!tableRef || tableRef === "public.") {
    return false;
  }

  const result = await sql`
    SELECT to_regclass(${tableRef}) IS NOT NULL AS "exists";
  `;

  return true === Boolean(result.rows[0]?.exists);
};

const parseResponsibleUserId = (value) => {
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
  const auth = requireAuth(req);

  if (!auth) {
    return null;
  }

  const freshAuth = await refreshAuthFromDatabase(auth);

  if (!freshAuth) {
    return null;
  }

  return freshAuth;
};

const validateGroupManagerUser = async (userId) => {
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

  const role = String(user.role || "");

  if (role !== ROLE_NAMES.groupAdmin && role !== ROLE_NAMES.superadmin) {
    return false;
  }

  return true === Boolean(user.isActive);
};

export default async function handler(req, res) {
  try {
    await ensureIdentitySchema();

    if (req.method === "GET") {
      const auth = await getAuthContext(req);

      const result = await sql`
        SELECT
          g.group_number AS "groupNumber",
          g.name,
          g.superintendent_user_id AS "superintendentUserId",
          g.assistant_user_id AS "assistantUserId",
          su.username AS "superintendentUsername",
          au.username AS "assistantUsername"
        FROM groups g
        LEFT JOIN users su ON su.id = g.superintendent_user_id
        LEFT JOIN users au ON au.id = g.assistant_user_id
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

    if (req.method !== "POST" && req.method !== "PUT" && req.method !== "DELETE") {
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

    if (req.method === "DELETE") {
      const groupNumber = getGroupNumberFromRequest(req);

      if (!groupNumber) {
        res.status(400).json({ error: "Invalid group number" });
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

      const assignedUsers = await sql`
        SELECT id
        FROM users
        WHERE group_number = ${groupNumber}
        LIMIT 1;
      `;

      if (0 < assignedUsers.rows.length) {
        res.status(409).json({ error: "Group has assigned users" });
        return;
      }

      if (await tableExists("people")) {
        const relatedPeople = await sql`
          SELECT id
          FROM people
          WHERE group_number = ${groupNumber}
          LIMIT 1;
        `;

        if (0 < relatedPeople.rows.length) {
          res.status(409).json({ error: "Group has registered people" });
          return;
        }
      }

      if (await tableExists("reports")) {
        const relatedReports = await sql`
          SELECT id
          FROM reports
          WHERE group_number = ${groupNumber}
          LIMIT 1;
        `;

        if (0 < relatedReports.rows.length) {
          res.status(409).json({ error: "Group has related reports" });
          return;
        }
      }

      if (await tableExists("report_periods_by_group")) {
        const relatedPeriods = await sql`
          SELECT report_month_key
          FROM report_periods_by_group
          WHERE group_number = ${groupNumber}
          LIMIT 1;
        `;

        if (0 < relatedPeriods.rows.length) {
          res.status(409).json({ error: "Group has related periods" });
          return;
        }
      }

      await sql`
        DELETE FROM groups
        WHERE group_number = ${groupNumber};
      `;

      res.status(200).json({ ok: true, groupNumber });
      return;
    }

    const body = await readJsonBody(req);

    if (!body) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const groupNumber = parseGroupNumber(body.groupNumber);
    const name = String(body.name || "").trim();
    const superintendentUserId = parseResponsibleUserId(body.superintendentUserId);
    const assistantUserId = parseResponsibleUserId(body.assistantUserId);

    if (!groupNumber) {
      res.status(400).json({ error: "Invalid group number" });
      return;
    }

    if (name.length < 2 || name.length > 120) {
      res.status(400).json({ error: "Invalid group name" });
      return;
    }

    if (
      superintendentUserId !== null &&
      assistantUserId !== null &&
      superintendentUserId === assistantUserId
    ) {
      res.status(400).json({ error: "Superintendent and assistant must be different users" });
      return;
    }

    if (!(await validateGroupManagerUser(superintendentUserId))) {
      res.status(400).json({ error: "Invalid superintendent user" });
      return;
    }

    if (!(await validateGroupManagerUser(assistantUserId))) {
      res.status(400).json({ error: "Invalid assistant user" });
      return;
    }

    const synchronizeAssignedUsers = async () => {
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
          UPDATE groups
          SET
            assistant_user_id = NULL,
            updated_at = NOW()
          WHERE assistant_user_id = ${superintendentUserId}
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

      if (assistantUserId !== null) {
        await sql`
          UPDATE groups
          SET
            superintendent_user_id = NULL,
            updated_at = NOW()
          WHERE superintendent_user_id = ${assistantUserId}
            AND group_number <> ${groupNumber};
        `;

        await sql`
          UPDATE groups
          SET
            assistant_user_id = NULL,
            updated_at = NOW()
          WHERE assistant_user_id = ${assistantUserId}
            AND group_number <> ${groupNumber};
        `;

        await sql`
          UPDATE users
          SET
            group_number = ${groupNumber},
            updated_at = NOW()
          WHERE id = ${assistantUserId};
        `;
      }
    };

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
          superintendent_user_id,
          assistant_user_id
        )
        VALUES (
          ${groupNumber},
          ${name},
          ${superintendentUserId},
          ${assistantUserId}
        );
      `;

      await synchronizeAssignedUsers();

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
        assistant_user_id = ${assistantUserId},
        updated_at = NOW()
      WHERE group_number = ${groupNumber};
    `;

    await synchronizeAssignedUsers();

    res.status(200).json({ ok: true, groupNumber });
  } catch (error) {
    if (String(error?.code || "") === "23505") {
      res.status(409).json({ error: "Responsible user already assigned to another group" });
      return;
    }

    res.status(500).json({ error: "Database error" });
  }
}
