import {
  ensureIdentitySchema,
  getSafeAuthUser,
  refreshAuthFromDatabase,
  requireAuth,
  validateFullNameInput,
} from "../_lib/auth.js";
import { sql } from "../_lib/db.js";
import { readJsonBody } from "../_lib/request.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "PUT") {
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

  if (req.method === "GET") {
    res.status(200).json({ user: getSafeAuthUser(freshAuth) });
    return;
  }

  const body = await readJsonBody(req);

  if (!body) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const fullName = validateFullNameInput(body.fullName);

  if (!fullName) {
    res.status(400).json({ error: "Invalid full name" });
    return;
  }

  await ensureIdentitySchema();
  await sql`
    UPDATE users
    SET
      full_name = ${fullName},
      updated_at = NOW()
    WHERE id = ${freshAuth.userId};
  `;

  const updatedAuth = await refreshAuthFromDatabase(freshAuth);

  if (!updatedAuth) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.status(200).json({ ok: true, user: getSafeAuthUser(updatedAuth) });
}
