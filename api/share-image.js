import { sql } from "./_lib/db.js";

export const config = {
  runtime: "nodejs",
};

const escapeXml = (value) => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const parseGroupNumber = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 0;
  }

  return parsed;
};

const trimLine = (value, maxLength = 56) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
};

const loadGroupName = async (groupNumber) => {
  try {
    const result = await sql`
      SELECT name
      FROM groups
      WHERE group_number = ${groupNumber}
      LIMIT 1;
    `;

    return String(result.rows[0]?.name || "").trim();
  } catch (error) {
    return "";
  }
};

const renderSvg = ({ title, subtitle, badge }) => {
  const safeTitle = escapeXml(title);
  const safeSubtitle = escapeXml(subtitle);
  const safeBadge = escapeXml(badge);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vista previa del formulario de informes">
  <defs>
    <linearGradient id="bgGradient" x1="110" y1="80" x2="1080" y2="560" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0F172A" />
      <stop offset="1" stop-color="#1E293B" />
    </linearGradient>
    <linearGradient id="accentGradient" x1="160" y1="470" x2="840" y2="470" gradientUnits="userSpaceOnUse">
      <stop stop-color="#6366F1" />
      <stop offset="1" stop-color="#8B5CF6" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1200" height="630" fill="#020617" />
  <rect x="45" y="45" width="1110" height="540" rx="32" fill="url(#bgGradient)" stroke="rgba(148,163,184,0.42)" />
  <circle cx="1030" cy="130" r="120" fill="rgba(99,102,241,0.22)" />
  <circle cx="1080" cy="520" r="170" fill="rgba(14,165,233,0.18)" />
  <text x="115" y="145" fill="#94A3B8" font-size="28" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif" letter-spacing="3">CONGREGACION EL PUENTE MONTE TABOR</text>
  <text x="115" y="250" fill="#F8FAFC" font-size="66" font-weight="700" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif">${safeTitle}</text>
  <text x="115" y="315" fill="#CBD5E1" font-size="34" font-weight="500" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif">${safeSubtitle}</text>
  <rect x="115" y="370" width="390" height="76" rx="38" fill="rgba(30,41,59,0.88)" stroke="#818CF8" stroke-width="2" />
  <text x="160" y="418" fill="#C7D2FE" font-size="34" font-weight="700" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif">${safeBadge}</text>
  <rect x="115" y="470" width="740" height="68" rx="34" fill="url(#accentGradient)" />
  <text x="160" y="515" fill="#FFFFFF" font-size="30" font-weight="700" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif">Complete y envie su informe mensual aqui</text>
</svg>`;
};

export default async function handler(req, res) {
  try {
    const groupNumber = parseGroupNumber(req.query?.groupNumber);

    if (!groupNumber) {
      res.status(404).send("Not found");
      return;
    }

    const groupName = await loadGroupName(groupNumber);
    const mainTitle = trimLine("Informe mensual de actividades", 36);
    const subtitle = trimLine(
      groupName ? `${groupName} (Grupo ${groupNumber})` : `Grupo ${groupNumber}`,
      50
    );
    const badge = trimLine(`Formulario oficial - Grupo ${groupNumber}`, 40);

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).send(
      renderSvg({
        title: mainTitle,
        subtitle,
        badge,
      })
    );
  } catch (error) {
    res.status(500).send("Server error");
  }
}
