import { sql } from "./_lib/db.js";
import { requireAuth } from "./_lib/auth.js";
import { readJsonBody } from "./_lib/request.js";

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
      hours TEXT,
      courses TEXT,
      comments TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
};

const getReportMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getPreviousMonthKey = (date) => {
  const previousMonthDate = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return getReportMonthKey(previousMonthDate);
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

const getReportIdFromRequest = (req) => {
  if (req.query && req.query.id) {
    const idValue = Number(req.query.id);
    return idValue || 0;
  }

  const url = req.url || "";
  const match = url.match(/\/reports\/(\d+)/);

  if (match && match[1]) {
    const idValue = Number(match[1]);
    return idValue || 0;
  }

  return 0;
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const auth = requireAuth(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        await ensureReportsTable();

        const result = await sql`
          SELECT
            id,
            report_month_key AS "reportMonthKey",
            report_month_label AS "reportMonthLabel",
            name,
            participation,
            hours,
            courses,
            comments,
            submitted_at AS "submittedAt"
          FROM reports
          ORDER BY submitted_at DESC;
        `;

        res.status(200).json({ items: result.rows });
      } catch (error) {
        res.status(500).json({ error: "Database error", detail: String(error) });
      }
      return;
    }

    if (req.method === "POST") {
      const auth = requireAuth(req);
      const body = await readJsonBody(req);

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const name = String(body.name || "").trim();
      const participation = String(body.participation || "").trim();
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

      const monthKeyFromBody = String(body.reportMonthKey || "").trim();
      const reportMonthKey =
        auth && monthKeyFromBody ? monthKeyFromBody : getPreviousMonthKey(new Date());
      const reportMonthLabel = getReportMonthLabel(reportMonthKey);

      if (!reportMonthLabel) {
        res.status(400).json({ error: "Invalid report month" });
        return;
      }

      try {
        await ensureReportsTable();

        const result = await sql`
          INSERT INTO reports (
            report_month_key,
            report_month_label,
            name,
            participation,
            hours,
            courses,
            comments
          )
          VALUES (
            ${reportMonthKey},
            ${reportMonthLabel},
            ${name},
            ${participation},
            ${hours},
            ${courses},
            ${comments}
          )
          RETURNING id;
        `;

        res.status(200).json({ ok: true, id: result.rows[0]?.id });
      } catch (error) {
        res.status(500).json({ error: "Database error", detail: String(error) });
      }
      return;
    }

    if (req.method === "PUT") {
      const auth = requireAuth(req);
      const reportId = getReportIdFromRequest(req);
      const body = await readJsonBody(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!reportId) {
        res.status(400).json({ error: "Invalid report id" });
        return;
      }

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

      try {
        await ensureReportsTable();

        const result = await sql`
          UPDATE reports
          SET
            report_month_key = ${reportMonthKey},
            report_month_label = ${reportMonthLabel},
            name = ${name},
            participation = ${participation},
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
      return;
    }

    if (req.method === "DELETE") {
      const auth = requireAuth(req);
      const reportId = getReportIdFromRequest(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!reportId) {
        res.status(400).json({ error: "Invalid report id" });
        return;
      }

      try {
        await ensureReportsTable();

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
      } catch (error) {
        res.status(500).json({ error: "Database error", detail: String(error) });
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: "Server error", detail: String(error) });
  }
}
