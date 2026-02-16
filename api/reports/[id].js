import { sql } from "../_lib/db.js";
import { requireAuth } from "../_lib/auth.js";
import { readJsonBody } from "../_lib/request.js";

export const config = {
  runtime: "nodejs",
};

const ensureReportsTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      report_month_key TEXT NOT NULL,
      report_month_label TEXT NOT NULL,
      name TEXT NOT NULL,
      participation TEXT NOT NULL,
      designation TEXT,
      hours TEXT,
      courses TEXT,
      comments TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS designation TEXT;`;
  await sql`ALTER TABLE reports ALTER COLUMN designation SET DEFAULT 'Publicador';`;
  await sql`UPDATE reports SET designation = 'Publicador' WHERE designation IS NULL OR designation = '';`;
};

const ensureReportPeriodsTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS report_periods (
      report_month_key TEXT PRIMARY KEY,
      report_month_label TEXT NOT NULL,
      is_closed BOOLEAN NOT NULL DEFAULT FALSE,
      closed_at TIMESTAMPTZ
    );
  `;

  await sql`ALTER TABLE report_periods ADD COLUMN IF NOT EXISTS report_month_label TEXT;`;
  await sql`ALTER TABLE report_periods ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE report_periods ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;`;
};

const ensureReportSchema = async () => {
  await ensureReportsTable();
  await ensureReportPeriodsTable();
};

const getReportDateFromKey = (monthKey) => {
  if (!monthKey) {
    return null;
  }

  const [yearValue, monthValue] = monthKey.split("-");
  const year = Number(yearValue);
  const month = Number(monthValue);

  if (!year || !month || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
};

const getReportMonthLabel = (monthKey) => {
  const date = getReportDateFromKey(monthKey);

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(
    date
  );
};

const isReportPeriodClosed = async (reportMonthKey) => {
  if (!reportMonthKey) {
    return false;
  }

  const result = await sql`
    SELECT
      is_closed AS "isClosed"
    FROM report_periods
    WHERE report_month_key = ${reportMonthKey}
    LIMIT 1;
  `;

  return true === Boolean(result.rows[0]?.isClosed);
};

export default async function handler(req, res) {
  try {
    if (req.method !== "PUT" && req.method !== "DELETE") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const reportId = Number(req.query.id);
    if (!reportId) {
      res.status(400).json({ error: "Invalid report id" });
      return;
    }

    await ensureReportSchema();

    if (req.method === "DELETE") {
      const currentReport = await sql`
        SELECT report_month_key AS "reportMonthKey"
        FROM reports
        WHERE id = ${reportId}
        LIMIT 1;
      `;

      if (0 === currentReport.rows.length) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const currentReportMonthKey = String(
        currentReport.rows[0]?.reportMonthKey || ""
      );

      if (await isReportPeriodClosed(currentReportMonthKey)) {
        res.status(409).json({ error: "Report period is closed" });
        return;
      }

      const result = await sql`
        DELETE FROM reports
        WHERE id = ${reportId}
        RETURNING id;
      `;

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      res.status(200).json({ ok: true, id: result.rows[0].id });
      return;
    }

    const body = await readJsonBody(req);
    if (!body) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    const reportMonthKey = String(body.reportMonthKey || "").trim();
    const reportMonthLabel = getReportMonthLabel(reportMonthKey);

    if (!reportMonthLabel) {
      res.status(400).json({ error: "Invalid report month" });
      return;
    }

    const name = String(body.name || "").trim();
    const participation = String(body.participation || "").trim();
    const designation = String(body.designation || "").trim() || "Publicador";
    const hours = String(body.hours || "").trim();
    const courses = String(body.courses || "").trim();
    const comments = String(body.comments || "").trim();

    if (!name) {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    if (!participation) {
      res.status(400).json({ error: "Participation is required" });
      return;
    }

    const currentReport = await sql`
      SELECT report_month_key AS "reportMonthKey"
      FROM reports
      WHERE id = ${reportId}
      LIMIT 1;
    `;

    if (0 === currentReport.rows.length) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const currentReportMonthKey = String(currentReport.rows[0]?.reportMonthKey || "");

    if (await isReportPeriodClosed(currentReportMonthKey)) {
      res.status(409).json({ error: "Report period is closed" });
      return;
    }

    if (await isReportPeriodClosed(reportMonthKey)) {
      res.status(409).json({ error: "Report period is closed" });
      return;
    }

    const result = await sql`
      UPDATE reports
      SET
        report_month_key = ${reportMonthKey},
        report_month_label = ${reportMonthLabel},
        name = ${name},
        participation = ${participation},
        designation = ${designation},
        hours = ${hours},
        courses = ${courses},
        comments = ${comments}
      WHERE id = ${reportId}
      RETURNING id;
    `;

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    res.status(200).json({ ok: true, id: result.rows[0].id });
  } catch (error) {
    res.status(500).json({ error: "Database error", detail: String(error) });
  }
}
