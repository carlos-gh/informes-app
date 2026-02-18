import {
  ensureIdentitySchema,
  isSuperAdmin,
  refreshAuthFromDatabase,
  requireAuth,
} from "./_lib/auth.js";
import { sql } from "./_lib/db.js";
import { readJsonBody } from "./_lib/request.js";
import { getFormOpenDays } from "./_lib/settings.js";

export const config = {
  runtime: "nodejs",
};

const ensureReportsTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      report_month_key TEXT NOT NULL,
      report_month_label TEXT NOT NULL,
      group_number INTEGER,
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
  await sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS group_number INTEGER;`;
  await sql`ALTER TABLE reports ALTER COLUMN designation SET DEFAULT 'Publicador';`;
  await sql`UPDATE reports SET designation = 'Publicador' WHERE designation IS NULL OR designation = '';`;
};

const ensureReportPeriodsTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS report_periods_by_group (
      report_month_key TEXT NOT NULL,
      group_number INTEGER NOT NULL,
      report_month_label TEXT NOT NULL,
      is_closed BOOLEAN NOT NULL DEFAULT FALSE,
      closed_at TIMESTAMPTZ,
      PRIMARY KEY (report_month_key, group_number)
    );
  `;

  await sql`ALTER TABLE report_periods_by_group ADD COLUMN IF NOT EXISTS report_month_label TEXT;`;
  await sql`ALTER TABLE report_periods_by_group ADD COLUMN IF NOT EXISTS is_closed BOOLEAN NOT NULL DEFAULT FALSE;`;
  await sql`ALTER TABLE report_periods_by_group ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE report_periods_by_group ADD COLUMN IF NOT EXISTS group_number INTEGER;`;
  await sql`CREATE INDEX IF NOT EXISTS report_periods_by_group_month_idx ON report_periods_by_group (report_month_key);`;
  await sql`CREATE INDEX IF NOT EXISTS report_periods_by_group_group_idx ON report_periods_by_group (group_number);`;

  const legacyTable = await sql`
    SELECT to_regclass('public.report_periods') IS NOT NULL AS "exists";
  `;

  if (true !== Boolean(legacyTable.rows[0]?.exists)) {
    return;
  }

  await sql`
    INSERT INTO report_periods_by_group (
      report_month_key,
      group_number,
      report_month_label,
      is_closed,
      closed_at
    )
    SELECT
      legacy.report_month_key,
      grouped.group_number,
      legacy.report_month_label,
      legacy.is_closed,
      legacy.closed_at
    FROM report_periods legacy
    INNER JOIN (
      SELECT DISTINCT
        report_month_key,
        group_number
      FROM reports
      WHERE group_number IS NOT NULL
    ) grouped
      ON grouped.report_month_key = legacy.report_month_key
    WHERE legacy.is_closed = TRUE
    ON CONFLICT (report_month_key, group_number)
    DO NOTHING;
  `;
};

const ensureReportSchema = async () => {
  await ensureIdentitySchema();
  await ensureReportsTable();
  await ensureReportPeriodsTable();
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

const isFormWindowOpen = (currentDate, formOpenDays) => {
  const dayOfMonth = currentDate.getDate();
  const parsedDays = Number(formOpenDays);
  const safeDays = Number.isInteger(parsedDays) && parsedDays > 0 ? parsedDays : 10;

  return dayOfMonth >= 1 && dayOfMonth <= safeDays;
};

const getReportDateFromKey = (monthKey) => {
  if (!monthKey) {
    return null;
  }

  const [yearValue, monthValue] = String(monthKey).split("-");
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

const parseGroupNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const groupNumber = Number(value);

  if (!Number.isInteger(groupNumber) || groupNumber < 1) {
    return null;
  }

  return groupNumber;
};

const getCurrentAuth = async (req) => {
  const auth = requireAuth(req);

  if (!auth) {
    return null;
  }

  return refreshAuthFromDatabase(auth);
};

const hasAuthHeader = (req) => {
  return Boolean(req.headers.authorization);
};

const isReportPeriodClosed = async (reportMonthKey, groupNumber) => {
  if (!reportMonthKey || groupNumber === null) {
    return false;
  }

  const result = await sql`
    SELECT
      is_closed AS "isClosed"
    FROM report_periods_by_group
    WHERE report_month_key = ${reportMonthKey}
      AND group_number = ${groupNumber}
    LIMIT 1;
  `;

  return true === Boolean(result.rows[0]?.isClosed);
};

const getClosedReportPeriods = async (groupNumber = null) => {
  if (groupNumber !== null) {
    const scopedResult = await sql`
      SELECT
        report_month_key AS "reportMonthKey",
        report_month_label AS "reportMonthLabel",
        group_number AS "groupNumber",
        is_closed AS "isClosed",
        closed_at AS "closedAt"
      FROM report_periods_by_group
      WHERE is_closed = TRUE
        AND group_number = ${groupNumber}
      ORDER BY report_month_key DESC;
    `;

    return scopedResult.rows;
  }

  const result = await sql`
    SELECT
      report_month_key AS "reportMonthKey",
      report_month_label AS "reportMonthLabel",
      group_number AS "groupNumber",
      is_closed AS "isClosed",
      closed_at AS "closedAt"
    FROM report_periods_by_group
    WHERE is_closed = TRUE
    ORDER BY report_month_key DESC;
  `;

  return result.rows;
};

const getActionGroupNumber = (auth, bodyGroupNumber) => {
  if (!auth) {
    return null;
  }

  if (isSuperAdmin(auth)) {
    return parseGroupNumber(bodyGroupNumber);
  }

  return parseGroupNumber(auth.groupNumber);
};

const ensureGroupExists = async (groupNumber) => {
  if (groupNumber === null) {
    return false;
  }

  const result = await sql`
    SELECT group_number
    FROM groups
    WHERE group_number = ${groupNumber}
    LIMIT 1;
  `;

  return 0 < result.rows.length;
};

const canAccessReportGroup = (auth, reportGroupNumber) => {
  if (!auth) {
    return false;
  }

  if (isSuperAdmin(auth)) {
    return true;
  }

  if (auth.groupNumber === null || auth.groupNumber === undefined) {
    return false;
  }

  return Number(reportGroupNumber) === Number(auth.groupNumber);
};

export default async function handler(req, res) {
  try {
    await ensureReportSchema();

    if (req.method === "GET") {
      const auth = await getCurrentAuth(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      try {
        let reportsResult;

        if (isSuperAdmin(auth)) {
          reportsResult = await sql`
            SELECT
              id,
              report_month_key AS "reportMonthKey",
              report_month_label AS "reportMonthLabel",
              group_number AS "groupNumber",
              name,
              participation,
              designation,
              hours,
              courses,
              comments,
              submitted_at AS "submittedAt"
            FROM reports
            ORDER BY submitted_at DESC;
          `;
        } else if (auth.groupNumber === null || auth.groupNumber === undefined) {
          reportsResult = { rows: [] };
        } else {
          reportsResult = await sql`
            SELECT
              id,
              report_month_key AS "reportMonthKey",
              report_month_label AS "reportMonthLabel",
              group_number AS "groupNumber",
              name,
              participation,
              designation,
              hours,
              courses,
              comments,
              submitted_at AS "submittedAt"
            FROM reports
            WHERE group_number = ${auth.groupNumber}
            ORDER BY submitted_at DESC;
          `;
        }

        let closedPeriods = [];

        if (isSuperAdmin(auth)) {
          closedPeriods = await getClosedReportPeriods();
        } else {
          const scopedGroupNumber = parseGroupNumber(auth.groupNumber);
          closedPeriods =
            scopedGroupNumber === null
              ? []
              : await getClosedReportPeriods(scopedGroupNumber);
        }

        res.status(200).json({ items: reportsResult.rows, periods: closedPeriods });
      } catch (error) {
        res.status(500).json({ error: "Database error", detail: String(error) });
      }
      return;
    }

    if (req.method === "POST") {
      const body = await readJsonBody(req);

      if (!body) {
        res.status(400).json({ error: "Invalid payload" });
        return;
      }

      const auth = await getCurrentAuth(req);

      if (hasAuthHeader(req) && !auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const action = String(body.action || "").trim();

      if ("closePeriod" === action || "reopenPeriod" === action) {
        if (!auth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const actionGroupNumber = getActionGroupNumber(auth, body.groupNumber);

        if (actionGroupNumber === null || !(await ensureGroupExists(actionGroupNumber))) {
          res.status(400).json({ error: "Invalid group" });
          return;
        }

        if (!isSuperAdmin(auth) && Number(auth.groupNumber) !== Number(actionGroupNumber)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }

        const reportMonthKey = String(body.reportMonthKey || "").trim();
        const reportMonthLabel = getReportMonthLabel(reportMonthKey);

        if (!reportMonthLabel) {
          res.status(400).json({ error: "Invalid report month" });
          return;
        }

        if ("closePeriod" === action) {
          const monthReports = await sql`
            SELECT COUNT(*)::int AS total
            FROM reports
            WHERE report_month_key = ${reportMonthKey}
              AND group_number = ${actionGroupNumber};
          `;

          const totalReports = Number(monthReports.rows[0]?.total || 0);

          if (0 === totalReports) {
            res.status(400).json({ error: "Cannot close period without reports" });
            return;
          }

          await sql`
            INSERT INTO report_periods_by_group (
              report_month_key,
              group_number,
              report_month_label,
              is_closed,
              closed_at
            )
            VALUES (
              ${reportMonthKey},
              ${actionGroupNumber},
              ${reportMonthLabel},
              TRUE,
              NOW()
            )
            ON CONFLICT (report_month_key, group_number)
            DO UPDATE SET
              report_month_label = EXCLUDED.report_month_label,
              is_closed = TRUE,
              closed_at = COALESCE(report_periods_by_group.closed_at, NOW());
          `;

          res.status(200).json({ ok: true, reportMonthKey, groupNumber: actionGroupNumber });
          return;
        }

        const periodResult = await sql`
          SELECT
            is_closed AS "isClosed"
          FROM report_periods_by_group
          WHERE report_month_key = ${reportMonthKey}
            AND group_number = ${actionGroupNumber}
          LIMIT 1;
        `;

        if (true !== Boolean(periodResult.rows[0]?.isClosed)) {
          res.status(400).json({ error: "Report period is already open" });
          return;
        }

        await sql`
          UPDATE report_periods_by_group
          SET
            report_month_label = ${reportMonthLabel},
            is_closed = FALSE,
            closed_at = NULL
          WHERE report_month_key = ${reportMonthKey}
            AND group_number = ${actionGroupNumber};
        `;

        res.status(200).json({ ok: true, reportMonthKey, groupNumber: actionGroupNumber });
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

      const monthKeyFromBody = String(body.reportMonthKey || "").trim();
      const reportMonthKey =
        auth && monthKeyFromBody ? monthKeyFromBody : getPreviousMonthKey(new Date());
      const reportMonthLabel = getReportMonthLabel(reportMonthKey);

      if (!reportMonthLabel) {
        res.status(400).json({ error: "Invalid report month" });
        return;
      }

      let reportGroupNumber = null;

      if (auth) {
        if (isSuperAdmin(auth)) {
          reportGroupNumber = parseGroupNumber(body.groupNumber);
        } else {
          reportGroupNumber = parseGroupNumber(auth.groupNumber);
        }
      } else {
        reportGroupNumber = parseGroupNumber(body.groupNumber);
      }

      if (reportGroupNumber === null || !(await ensureGroupExists(reportGroupNumber))) {
        res.status(400).json({ error: "Invalid group" });
        return;
      }

      if (!auth && (await isReportPeriodClosed(reportMonthKey, reportGroupNumber))) {
        res.status(409).json({ error: "Report period is closed" });
        return;
      }

      if (!auth) {
        const formOpenDays = await getFormOpenDays();

        if (!isFormWindowOpen(new Date(), formOpenDays)) {
          res.status(403).json({ error: "Form window is closed" });
          return;
        }
      }

      const result = await sql`
        INSERT INTO reports (
          report_month_key,
          report_month_label,
          group_number,
          name,
          participation,
          designation,
          hours,
          courses,
          comments
        )
        VALUES (
          ${reportMonthKey},
          ${reportMonthLabel},
          ${reportGroupNumber},
          ${name},
          ${participation},
          ${designation},
          ${hours},
          ${courses},
          ${comments}
        )
        RETURNING id;
      `;

      res.status(200).json({ ok: true, id: result.rows[0]?.id });
      return;
    }

    if (req.method === "PUT") {
      const auth = await getCurrentAuth(req);
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
        SELECT
          report_month_key AS "reportMonthKey",
          group_number AS "groupNumber"
        FROM reports
        WHERE id = ${reportId}
        LIMIT 1;
      `;

      const existingReport = currentReport.rows[0] || null;

      if (!existingReport) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      if (!canAccessReportGroup(auth, existingReport.groupNumber)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      let reportGroupNumber = null;

      if (isSuperAdmin(auth)) {
        reportGroupNumber = parseGroupNumber(body.groupNumber);
      } else {
        reportGroupNumber = parseGroupNumber(auth.groupNumber);
      }

      if (reportGroupNumber === null || !(await ensureGroupExists(reportGroupNumber))) {
        res.status(400).json({ error: "Invalid group" });
        return;
      }

      if (
        await isReportPeriodClosed(
          String(existingReport.reportMonthKey || ""),
          parseGroupNumber(existingReport.groupNumber)
        )
      ) {
        res.status(409).json({ error: "Report period is closed" });
        return;
      }

      if (await isReportPeriodClosed(reportMonthKey, reportGroupNumber)) {
        res.status(409).json({ error: "Report period is closed" });
        return;
      }

      const result = await sql`
        UPDATE reports
        SET
          report_month_key = ${reportMonthKey},
          report_month_label = ${reportMonthLabel},
          group_number = ${reportGroupNumber},
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
      return;
    }

    if (req.method === "DELETE") {
      const auth = await getCurrentAuth(req);
      const reportId = getReportIdFromRequest(req);

      if (!auth) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (!reportId) {
        res.status(400).json({ error: "Invalid report id" });
        return;
      }

      const currentReport = await sql`
        SELECT
          report_month_key AS "reportMonthKey",
          group_number AS "groupNumber"
        FROM reports
        WHERE id = ${reportId}
        LIMIT 1;
      `;

      const existingReport = currentReport.rows[0] || null;

      if (!existingReport) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      if (!canAccessReportGroup(auth, existingReport.groupNumber)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (
        await isReportPeriodClosed(
          String(existingReport.reportMonthKey || ""),
          parseGroupNumber(existingReport.groupNumber)
        )
      ) {
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

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: "Server error", detail: String(error) });
  }
}
