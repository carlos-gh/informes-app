import {
  ensureIdentitySchema,
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
} from "./_lib/auth.js";
import { sql } from "./_lib/db.js";
import { readJsonBody } from "./_lib/request.js";

export const config = {
  runtime: "nodejs",
};

const ensurePeopleTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS people (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      group_number INTEGER,
      designation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE people ADD COLUMN IF NOT EXISTS group_number INTEGER;`;
  await sql`ALTER TABLE people ADD COLUMN IF NOT EXISTS designation TEXT;`;
  await sql`ALTER TABLE people ALTER COLUMN designation SET DEFAULT 'Publicador';`;
  await sql`UPDATE people SET designation = 'Publicador' WHERE designation IS NULL OR designation = '';`;
};

const getPersonIdFromRequest = (req) => {
  if (req.query && req.query.id) {
    const idValue = Number(req.query.id);
    return idValue || 0;
  }

  const url = req.url || "";
  const match = url.match(/\/people\/(\d+)/);

  if (match && match[1]) {
    const idValue = Number(match[1]);
    return idValue || 0;
  }

  return 0;
};

const parseGroupNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const groupNumber = Number(value);

  if (!Number.isInteger(groupNumber) || groupNumber < 1) {
    return null;
  }

  return groupNumber;
};

const getCurrentAuth = async (req) => {
  const auth = requireAuth(req);

  if (!auth) {
    return null;
  }

  return refreshAuthFromDatabase(auth);
};

const ensureGroupExists = async (groupNumber) => {
  if (groupNumber === null) {
    return false;
  }

  const result = await sql`
    SELECT group_number
    FROM groups
    WHERE group_number = ${groupNumber}
    LIMIT 1;
  `;

  return 0 < result.rows.length;
};

const isGroupSuperintendent = async (auth) => {
  if (!auth || isSuperAdmin(auth)) {
    return false;
  }

  const authGroupNumber = parseGroupNumber(auth.groupNumber);

  if (authGroupNumber === null || !auth.userId) {
    return false;
  }

  const result = await sql`
    SELECT group_number
    FROM groups
    WHERE group_number = ${authGroupNumber}
      AND superintendent_user_id = ${auth.userId}
    LIMIT 1;
  `;

  return 0 < result.rows.length;
};

export default async function handler(req, res) {
  try {
    await ensureIdentitySchema();
    await ensurePeopleTable();

    const auth = await getCurrentAuth(req);

    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.method === "GET") {
      if (isSuperAdmin(auth)) {
        const result = await sql`
          SELECT
            id,
            name,
            group_number AS "groupNumber",
            designation,
            created_at AS "createdAt"
          FROM people
          ORDER BY name ASC;
        `;

        res.status(200).json({ items: result.rows });
        return;
      }

      const authGroupNumber = parseGroupNumber(auth.groupNumber);

      if (authGroupNumber === null) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (!(await isGroupSuperintendent(auth))) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const result = await sql`
        SELECT
          id,
          name,
          group_number AS "groupNumber",
          designation,
          created_at AS "createdAt"
        FROM people
        WHERE group_number = ${authGroupNumber}
        ORDER BY name ASC;
      `;

      res.status(200).json({ items: result.rows });
      return;
    }

    const canManageAsSuperintendent = await isGroupSuperintendent(auth);

    if (req.method === "POST") {
      const body = await readJsonBody(req);

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const name = String(body.name || "").trim();
      let groupNumber = parseGroupNumber(body.groupNumber);
      const designation = String(body.designation || "").trim() || "Publicador";

      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      if (isSuperAdmin(auth)) {
        if (groupNumber === null || !(await ensureGroupExists(groupNumber))) {
          res.status(400).json({ error: "Invalid group number" });
          return;
        }
      } else {
        if (!canManageAsSuperintendent) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        groupNumber = parseGroupNumber(auth.groupNumber);

        if (groupNumber === null || !(await ensureGroupExists(groupNumber))) {
          res.status(400).json({ error: "Invalid group number" });
          return;
        }
      }

      const result = await sql`
        INSERT INTO people (
          name,
          group_number,
          designation
        )
        VALUES (
          ${name},
          ${groupNumber},
          ${designation}
        )
        RETURNING id;
      `;

      res.status(200).json({ ok: true, id: result.rows[0]?.id });
      return;
    }

    if (req.method === "PUT") {
      const personId = getPersonIdFromRequest(req);
      const body = await readJsonBody(req);

      if (!personId) {
        res.status(400).json({ error: "Invalid person id" });
        return;
      }

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const name = String(body.name || "").trim();
      let groupNumber = parseGroupNumber(body.groupNumber);
      const designation = String(body.designation || "").trim() || "Publicador";

      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      const currentPerson = await sql`
        SELECT group_number AS "groupNumber"
        FROM people
        WHERE id = ${personId}
        LIMIT 1;
      `;

      const existingPerson = currentPerson.rows[0] || null;

      if (!existingPerson) {
        res.status(404).json({ error: "Person not found" });
        return;
      }

      if (isSuperAdmin(auth)) {
        if (groupNumber === null || !(await ensureGroupExists(groupNumber))) {
          res.status(400).json({ error: "Invalid group number" });
          return;
        }
      } else {
        if (!canManageAsSuperintendent) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const authGroupNumber = parseGroupNumber(auth.groupNumber);

        if (
          authGroupNumber === null ||
          Number(existingPerson.groupNumber) !== Number(authGroupNumber)
        ) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        groupNumber = authGroupNumber;
      }

      const result = await sql`
        UPDATE people
        SET
          name = ${name},
          group_number = ${groupNumber},
          designation = ${designation}
        WHERE id = ${personId}
        RETURNING id;
      `;

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Person not found" });
        return;
      }

      res.status(200).json({ ok: true, id: result.rows[0].id });
      return;
    }

    if (req.method === "DELETE") {
      const personId = getPersonIdFromRequest(req);

      if (!personId) {
        res.status(400).json({ error: "Invalid person id" });
        return;
      }

      let result = { rows: [] };

      if (isSuperAdmin(auth)) {
        result = await sql`
          DELETE FROM people
          WHERE id = ${personId}
          RETURNING id;
        `;
      } else {
        if (!canManageAsSuperintendent) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const authGroupNumber = parseGroupNumber(auth.groupNumber);

        if (authGroupNumber === null) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        result = await sql`
          DELETE FROM people
          WHERE id = ${personId}
            AND group_number = ${authGroupNumber}
          RETURNING id;
        `;
      }

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Person not found" });
        return;
      }

      res.status(200).json({ ok: true, id: result.rows[0].id });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: "Database error", detail: String(error) });
  }
}
