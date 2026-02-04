import { createToken, validateCredentials } from "../_lib/auth.js";
import { readJsonBody } from "../_lib/request.js";
import { getRequestIp, verifyTurnstileToken } from "../_lib/turnstile.js";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const body = await readJsonBody(req);
  if (!body) {
    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { username = "", password = "", turnstileToken = "" } = body;

  const verification = await verifyTurnstileToken({
    token: String(turnstileToken),
    ip: getRequestIp(req),
  });

  if (verification.error === "Missing secret") {
    res.status(500).json({ error: "Missing captcha secret" });
    return;
  }

  if (!verification.ok) {
    res.status(401).json({ error: "Captcha invalid" });
    return;
  }

  if (!validateCredentials(String(username), String(password))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!process.env.ADMIN_TOKEN_SECRET) {
    res.status(500).json({ error: "Missing token secret" });
    return;
  }

  const { token, expiresAt } = createToken(String(username));
  res.status(200).json({ token, expiresAt });
}
