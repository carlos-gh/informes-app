import {
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
} from "./_lib/auth.js";
import { readJsonBody } from "./_lib/request.js";
import { getFormOpenDays, setFormOpenDays } from "./_lib/settings.js";

export const config = {
  runtime: "nodejs",
};

const getCurrentAuth = async (req) => {
  const auth = requireAuth(req);

  if (!auth) {
    return null;
  }

  return refreshAuthFromDatabase(auth);
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const formOpenDays = await getFormOpenDays();
      res.status(200).json({ formOpenDays });
      return;
    }

    if (req.method !== "PUT") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const auth = await getCurrentAuth(req);

    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!isSuperAdmin(auth)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const body = await readJsonBody(req);

    if (!body) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const formOpenDays = await setFormOpenDays(body.formOpenDays);

    if (formOpenDays === null) {
      res.status(400).json({ error: "Invalid form open days" });
      return;
    }

    res.status(200).json({ ok: true, formOpenDays });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
}
