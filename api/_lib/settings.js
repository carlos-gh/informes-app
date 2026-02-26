import { sql } from "./db.js";

const SETTINGS_KEY_FORM_OPEN_DAYS = "form_open_days";
const SETTINGS_KEY_PUBLIC_THEME = "public_theme";
const DEFAULT_FORM_OPEN_DAYS = 10;
const DEFAULT_PUBLIC_THEME = "light";
const MIN_FORM_OPEN_DAYS = 1;
const MAX_FORM_OPEN_DAYS = 31;

const normalizeFormOpenDays = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < MIN_FORM_OPEN_DAYS || parsed > MAX_FORM_OPEN_DAYS) {
    return null;
  }

  return parsed;
};

const normalizeTheme = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "dark" || normalized === "light" ? normalized : null;
};

export const ensureSettingsTable = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS key TEXT;`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS value TEXT;`;
  await sql`ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
};

export const getFormOpenDays = async () => {
  await ensureSettingsTable();

  const result = await sql`
    SELECT value
    FROM app_settings
    WHERE key = ${SETTINGS_KEY_FORM_OPEN_DAYS}
    LIMIT 1;
  `;

  const storedValue = result.rows[0]?.value;
  const normalized = normalizeFormOpenDays(storedValue);

  if (normalized !== null) {
    return normalized;
  }

  await sql`
    INSERT INTO app_settings (
      key,
      value,
      updated_at
    )
    VALUES (
      ${SETTINGS_KEY_FORM_OPEN_DAYS},
      ${String(DEFAULT_FORM_OPEN_DAYS)},
      NOW()
    )
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW();
  `;

  return DEFAULT_FORM_OPEN_DAYS;
};

export const setFormOpenDays = async (value) => {
  const normalized = normalizeFormOpenDays(value);

  if (normalized === null) {
    return null;
  }

  await ensureSettingsTable();

  await sql`
    INSERT INTO app_settings (
      key,
      value,
      updated_at
    )
    VALUES (
      ${SETTINGS_KEY_FORM_OPEN_DAYS},
      ${String(normalized)},
      NOW()
    )
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW();
  `;

  return normalized;
};

export const getPublicTheme = async () => {
  await ensureSettingsTable();

  const result = await sql`
    SELECT value
    FROM app_settings
    WHERE key = ${SETTINGS_KEY_PUBLIC_THEME}
    LIMIT 1;
  `;

  const storedValue = result.rows[0]?.value;
  const normalized = normalizeTheme(storedValue);

  if (normalized !== null) {
    return normalized;
  }

  await sql`
    INSERT INTO app_settings (
      key,
      value,
      updated_at
    )
    VALUES (
      ${SETTINGS_KEY_PUBLIC_THEME},
      ${DEFAULT_PUBLIC_THEME},
      NOW()
    )
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW();
  `;

  return DEFAULT_PUBLIC_THEME;
};

export const setPublicTheme = async (value) => {
  const normalized = normalizeTheme(value);

  if (normalized === null) {
    return null;
  }

  await ensureSettingsTable();

  await sql`
    INSERT INTO app_settings (
      key,
      value,
      updated_at
    )
    VALUES (
      ${SETTINGS_KEY_PUBLIC_THEME},
      ${normalized},
      NOW()
    )
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW();
  `;

  return normalized;
};
