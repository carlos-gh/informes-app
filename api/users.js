import {
  ensureIdentitySchema,
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
  ROLE_NAMES,
  validatePasswordInput,
  validateUsernameInput,
  hashPassword,
} from "./_lib/auth.js";
import { sql } from "./_lib/db.js";
import { readJsonBody } from "./_lib/request.js";

export const config = {
  runtime: "nodejs",
};

const getUserIdFromRequest = (req) => {
  if (req.query && req.query.id) {
    const idValue = Number(req.query.id);
    return Number.isInteger(idValue) && idValue > 0 ? idValue : 0;
  }

  const url = req.url || "";
  const match = url.match(/\/users\/(\d+)/);

  if (match && match[1]) {
    const idValue = Number(match[1]);
    return Number.isInteger(idValue) && idValue > 0 ? idValue : 0;
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

const requireSuperAdminAuth = async (req, res) => {
  const auth = requireAuth(req);

  if (!auth) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const freshAuth = await refreshAuthFromDatabase(auth);

  if (!freshAuth) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  if (!isSuperAdmin(freshAuth)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }

  return freshAuth;
};

export default async function handler(req, res) {
  try {
    await ensureIdentitySchema();

    if (req.method === "GET") {
      const auth = await requireSuperAdminAuth(req, res);

      if (!auth) {
        return;
      }

      const result = await sql`
        SELECT
          u.id,
          u.username,
          u.role,
          u.group_number AS "groupNumber",
          u.is_active AS "isActive",
          u.created_at AS "createdAt",
          u.updated_at AS "updatedAt",
          g.name AS "groupName"
        FROM users u
        LEFT JOIN groups g ON g.group_number = u.group_number
        ORDER BY u.created_at DESC;
      `;

      res.status(200).json({ items: result.rows });
      return;
    }

    if (req.method === "POST") {
      const auth = await requireSuperAdminAuth(req, res);

      if (!auth) {
        return;
      }

      const body = await readJsonBody(req);

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const username = validateUsernameInput(body.username || "");
      const password = String(body.password || "");
      const groupNumber = parseGroupNumber(body.groupNumber);

      if (!username) {
        res.status(400).json({ error: "Invalid username" });
        return;
      }

      if (!validatePasswordInput(password)) {
        res.status(400).json({ error: "Password does not meet policy" });
        return;
      }

      if (groupNumber === null || !(await ensureGroupExists(groupNumber))) {
        res.status(400).json({ error: "Invalid group" });
        return;
      }

      const passwordHash = hashPassword(password);

      try {
        const result = await sql`
          INSERT INTO users (
            username,
            password_hash,
            role,
            group_number,
            is_active
          )
          VALUES (
            ${username},
            ${passwordHash},
            ${ROLE_NAMES.groupAdmin},
            ${groupNumber},
            TRUE
          )
          RETURNING id;
        `;

        res.status(200).json({ ok: true, id: result.rows[0]?.id });
      } catch (error) {
        if (String(error?.code || "") === "23505") {
          res.status(409).json({ error: "Username already exists" });
          return;
        }

        throw error;
      }
      return;
    }

    if (req.method === "PUT") {
      const auth = await requireSuperAdminAuth(req, res);

      if (!auth) {
        return;
      }

      const userId = getUserIdFromRequest(req);
      const body = await readJsonBody(req);

      if (!userId) {
        res.status(400).json({ error: "Invalid user id" });
        return;
      }

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const currentUserResult = await sql`
        SELECT
          id,
          role,
          group_number AS "groupNumber"
        FROM users
        WHERE id = ${userId}
        LIMIT 1;
      `;

      const currentUser = currentUserResult.rows[0] || null;

      if (!currentUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (ROLE_NAMES.superadmin === String(currentUser.role || "")) {
        res.status(403).json({ error: "Superadmin user cannot be edited here" });
        return;
      }

      const username = validateUsernameInput(body.username || "");
      const groupNumber = parseGroupNumber(body.groupNumber);
      const isActive = true === body.isActive || false === body.isActive ? body.isActive : true;
      const nextPassword = String(body.password || "");

      if (!username) {
        res.status(400).json({ error: "Invalid username" });
        return;
      }

      if (groupNumber === null || !(await ensureGroupExists(groupNumber))) {
        res.status(400).json({ error: "Invalid group" });
        return;
      }

      if (nextPassword && !validatePasswordInput(nextPassword)) {
        res.status(400).json({ error: "Password does not meet policy" });
        return;
      }

      const nextPasswordHash = nextPassword ? hashPassword(nextPassword) : null;

      try {
        await sql`
          UPDATE users
          SET
            username = ${username},
            group_number = ${groupNumber},
            is_active = ${isActive},
            password_hash = COALESCE(${nextPasswordHash}, password_hash),
            updated_at = NOW()
          WHERE id = ${userId};
        `;

        await sql`
          UPDATE groups
          SET
            superintendent_user_id = CASE
              WHEN superintendent_user_id = ${userId} THEN NULL
              ELSE superintendent_user_id
            END,
            assistant_user_id = CASE
              WHEN assistant_user_id = ${userId} THEN NULL
              ELSE assistant_user_id
            END,
            updated_at = NOW()
          WHERE group_number <> ${groupNumber}
            AND (
              superintendent_user_id = ${userId}
              OR assistant_user_id = ${userId}
            );
        `;

        if (!isActive) {
          await sql`
            UPDATE groups
            SET
              superintendent_user_id = CASE
                WHEN superintendent_user_id = ${userId} THEN NULL
                ELSE superintendent_user_id
              END,
              assistant_user_id = CASE
                WHEN assistant_user_id = ${userId} THEN NULL
                ELSE assistant_user_id
              END,
              updated_at = NOW()
            WHERE superintendent_user_id = ${userId}
               OR assistant_user_id = ${userId};
          `;
        }

        res.status(200).json({ ok: true, id: userId });
      } catch (error) {
        if (String(error?.code || "") === "23505") {
          res.status(409).json({ error: "Username already exists" });
          return;
        }

        throw error;
      }
      return;
    }

    if (req.method === "DELETE") {
      const auth = await requireSuperAdminAuth(req, res);

      if (!auth) {
        return;
      }

      const userId = getUserIdFromRequest(req);

      if (!userId) {
        res.status(400).json({ error: "Invalid user id" });
        return;
      }

      const currentUserResult = await sql`
        SELECT
          id,
          role
        FROM users
        WHERE id = ${userId}
        LIMIT 1;
      `;

      const currentUser = currentUserResult.rows[0] || null;

      if (!currentUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      if (ROLE_NAMES.superadmin === String(currentUser.role || "")) {
        res.status(403).json({ error: "Superadmin user cannot be deleted here" });
        return;
      }

      await sql`
        UPDATE groups
        SET
          superintendent_user_id = CASE
            WHEN superintendent_user_id = ${userId} THEN NULL
            ELSE superintendent_user_id
          END,
          assistant_user_id = CASE
            WHEN assistant_user_id = ${userId} THEN NULL
            ELSE assistant_user_id
          END,
          updated_at = NOW()
        WHERE superintendent_user_id = ${userId}
           OR assistant_user_id = ${userId};
      `;

      const deleteResult = await sql`
        DELETE FROM users
        WHERE id = ${userId}
        RETURNING id;
      `;

      if (0 === deleteResult.rows.length) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.status(200).json({ ok: true, id: userId });
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
}
