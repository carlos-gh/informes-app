import {
  authenticateUser,
  clearAuthTokenCookie,
  createToken,
  ensureIdentitySchema,
  getSafeAuthUser,
  logAuthActivity,
  setAuthTokenCookie,
} from "../_lib/auth.js";
import { consumeRateLimit } from "../_lib/rate-limit.js";
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
    res.status(500).json({ error: "Database error" });
    return;
  }

  const requestIp = getRequestIp(req) || "unknown";
  const requestUserAgent = getRequestUserAgent(req);
  const ipRateLimit = consumeRateLimit({
    key: `login:ip:${requestIp}`,
    limit: 25,
    windowMs: 15 * 60 * 1000,
    blockMs: 15 * 60 * 1000,
  });

  if (!ipRateLimit.allowed) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(ipRateLimit.retryAfterMs / 1000))));
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  const body = await readJsonBody(req);
  if (!body) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        detail: "invalid_payload",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.status(400).json({ error: "Invalid payload" });
    return;
  }

  const { username = "", password = "", turnstileToken = "" } = body;
  const normalizedUsername = String(username || "")
    .trim()
    .toLowerCase();
  const accountRateLimit = consumeRateLimit({
    key: `login:user:${normalizedUsername || "unknown"}:${requestIp}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  });

  if (!accountRateLimit.allowed) {
    try {
      await logAuthActivity({
        eventType: "login_failure",
        username: normalizedUsername,
        detail: "rate_limited",
        ipAddress: requestIp,
        userAgent: requestUserAgent,
      });
    } catch (error) {
      // Ignore logging failures to avoid blocking authentication flow.
    }

    res.setHeader("Retry-After", String(Math.max(1, Math.ceil(accountRateLimit.retryAfterMs / 1000))));
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

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

    res.status(500).json({ error: "Authentication error" });
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
  clearAuthTokenCookie(req, res);
  setAuthTokenCookie(req, res, token);

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

  res.status(200).json({ ok: true, expiresAt, user: getSafeAuthUser(authUser) });
}
