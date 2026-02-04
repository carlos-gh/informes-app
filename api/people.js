import { sql } from "./_lib/db.js";
import { requireAuth } from "./_lib/auth.js";
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

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const auth = requireAuth(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      await ensurePeopleTable();

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

    if (req.method === "POST") {
      const auth = requireAuth(req);
      const body = await readJsonBody(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const name = String(body.name || "").trim();
      const groupNumber =
        body.groupNumber === null || body.groupNumber === undefined
          ? null
          : Number(body.groupNumber);
      const designation = String(body.designation || "").trim() || "Publicador";

      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      if (groupNumber !== null && Number.isNaN(groupNumber)) {
        res.status(400).json({ error: "Invalid group number" });
        return;
      }

      await ensurePeopleTable();

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
      const auth = requireAuth(req);
      const personId = getPersonIdFromRequest(req);
      const body = await readJsonBody(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!personId) {
        res.status(400).json({ error: "Invalid person id" });
        return;
      }

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const name = String(body.name || "").trim();
      const groupNumber =
        body.groupNumber === null || body.groupNumber === undefined
          ? null
          : Number(body.groupNumber);
      const designation = String(body.designation || "").trim() || "Publicador";

      if (!name) {
        res.status(400).json({ error: "Name is required" });
        return;
      }

      if (groupNumber !== null && Number.isNaN(groupNumber)) {
        res.status(400).json({ error: "Invalid group number" });
        return;
      }

      await ensurePeopleTable();

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
      const auth = requireAuth(req);
      const personId = getPersonIdFromRequest(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!personId) {
        res.status(400).json({ error: "Invalid person id" });
        return;
      }

      await ensurePeopleTable();

      const result = await sql`
        DELETE FROM people
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

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: "Database error", detail: String(error) });
  }
}
