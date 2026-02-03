const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const verifyTurnstileToken = async ({ token, ip }) => {
  const secret = process.env.TURNSTILE_SECRET_KEY || "";

  if (!secret) {
    return { ok: false, error: "Missing secret" };
  }

  if (!token) {
    return { ok: false, error: "Missing token" };
  }

  const payload = new URLSearchParams();
  payload.append("secret", secret);
  payload.append("response", token);

  if (ip) {
    payload.append("remoteip", ip);
  }

  const response = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    body: payload,
  });

  if (!response.ok) {
    return { ok: false, error: "Verification failed" };
  }

  const data = await response.json();

  return { ok: Boolean(data.success), data };
};

export const getRequestIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return "";
};
