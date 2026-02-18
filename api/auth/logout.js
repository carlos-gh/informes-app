import { clearAuthTokenCookie } from "../_lib/auth.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  clearAuthTokenCookie(req, res);
  res.status(200).json({ ok: true });
}
