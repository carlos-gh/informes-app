import {
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
} from "./_lib/auth.js";
import { readJsonBody } from "./_lib/request.js";
import {
  getFormOpenDays,
  getPublicTheme as readPublicTheme,
  setFormOpenDays,
  setPublicTheme,
} from "./_lib/settings.js";

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
      const publicTheme = await readPublicTheme();
      res.status(200).json({ formOpenDays, publicTheme });
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
    const hasFormOpenDays = Object.prototype.hasOwnProperty.call(body, "formOpenDays");
    const hasPublicTheme = Object.prototype.hasOwnProperty.call(body, "publicTheme");

    if (!hasFormOpenDays && !hasPublicTheme) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const formOpenDays = hasFormOpenDays
      ? await setFormOpenDays(body.formOpenDays)
      : await getFormOpenDays();
    const publicTheme = hasPublicTheme
      ? await setPublicTheme(body.publicTheme)
      : await readPublicTheme();

    if (formOpenDays === null) {
      res.status(400).json({ error: "Invalid form open days" });
      return;
    }

    if (publicTheme === null) {
      res.status(400).json({ error: "Invalid public theme" });
      return;
    }

    res.status(200).json({ ok: true, formOpenDays, publicTheme });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
}
