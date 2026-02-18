import { sql } from "./_lib/db.js";

export const config = {
  runtime: "nodejs",
};

const escapeHtml = (value) => {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const parseGroupNumber = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 0;
  }

  return parsed;
};

const resolveOrigin = (req) => {
  const protocol = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const hostHeader = String(
    req.headers["x-forwarded-host"] || req.headers.host || ""
  )
    .split(",")[0]
    .trim();

  if (!hostHeader) {
    return "";
  }

  return `${protocol}://${hostHeader}`;
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

const renderHtml = ({ title, description, canonicalUrl, imageUrl }) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(canonicalUrl);
  const safeImageUrl = escapeHtml(imageUrl);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeUrl}" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Congregación El Puente Monte Tabor" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImageUrl}" />
    <meta property="og:image:secure_url" content="${safeImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Vista previa del formulario de informes por grupo" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImageUrl}" />
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeDescription}</p>
      <p><a href="${safeUrl}">Abrir formulario</a></p>
    </main>
  </body>
</html>`;
};

export default async function handler(req, res) {
  try {
    const groupNumber = parseGroupNumber(req.query?.groupNumber);

    if (!groupNumber) {
      res.status(404).send("Not found");
      return;
    }

    const groupName = await loadGroupName(groupNumber);
    const groupLabel = groupName ? `${groupName} (Grupo ${groupNumber})` : `Grupo ${groupNumber}`;
    const origin = resolveOrigin(req);
    const canonicalUrl = origin
      ? `${origin}/grupo-${groupNumber}`
      : `/grupo-${groupNumber}`;
    const imageUrl = origin
      ? `${origin}/share-preview.png`
      : `/share-preview.png`;
    const title = `Informe mensual de actividades - ${groupLabel}`;
    const description = `Acceso oficial al formulario de recopilación de informes para ${groupLabel}. Comparta este enlace con su grupo para registrar actividades mensuales.`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
    res.status(200).send(
      renderHtml({
        title,
        description,
        canonicalUrl,
        imageUrl,
      })
    );
  } catch (error) {
    res.status(500).send("Server error");
  }
}
