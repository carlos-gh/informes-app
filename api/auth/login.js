import {
  authenticateUser,
  createToken,
  ensureIdentitySchema,
  getSafeAuthUser,
  logAuthActivity,
} from "../_lib/auth.js";
import { readJsonBody } from "../_lib/request.js";
import { getRequestIp, verifyTurnstileToken } from "../_lib/turnstile.js";

export const config = {
  runtime: "nodejs",
};

const getRequestUserAgent = (req) => {
  const userAgent = req.headers["user-agent"];
  return typeof userAgent === "string" ? userAgent : "";
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    await ensureIdentitySchema();
  } catch (error) {
    res.status(500).json({ error: "Database error", detail: String(error) });
    return;
  }

  const body = await readJsonBody(req);
  if (!body) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        detail: "invalid_payload",
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { username = "", password = "", turnstileToken = "" } = body;
  const requestIp = getRequestIp(req);
  const requestUserAgent = getRequestUserAgent(req);

  const verification = await verifyTurnstileToken({
    token: String(turnstileToken),
    ip: requestIp,
  });

  if (verification.error === "Missing secret") {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        username: String(username),
        detail: "captcha_missing_secret",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(500).json({ error: "Missing captcha secret" });
    return;
  }

  if (!verification.ok) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        username: String(username),
        detail: "captcha_invalid",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(401).json({ error: "Captcha invalid" });
    return;
  }

  let authUser = null;

  try {
    authUser = await authenticateUser(String(username), String(password));
  } catch (error) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        username: String(username),
        detail: "authentication_error",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (logError) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(500).json({ error: "Authentication error", detail: String(error) });
    return;
  }

  if (!authUser) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        username: String(username),
        detail: "invalid_credentials",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!process.env.ADMIN_TOKEN_SECRET) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        userId: authUser.userId,
        username: authUser.username,
        detail: "token_secret_missing",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(500).json({ error: "Missing token secret" });
    return;
  }

  const { token, expiresAt } = createToken(authUser);

  try {
    await logAuthActivity({
      eventType: "login_success",
      userId: authUser.userId,
      username: authUser.username,
      detail: "success",
      ipAddress: requestIp,
      userAgent: requestUserAgent,
    });
  } catch (error) {
    // Ignore logging failures to avoid blocking authentication flow.
  }

  res.status(200).json({ token, expiresAt, user: getSafeAuthUser(authUser) });
}
