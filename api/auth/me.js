import {
  getSafeAuthUser,
  refreshAuthFromDatabase,
  requireAuth,
} from "../_lib/auth.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
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

  res.status(200).json({ user: getSafeAuthUser(freshAuth) });
}
