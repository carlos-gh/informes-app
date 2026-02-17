const THEME_KEY = "reports_ui_theme";

const isValidTheme = (value) => value === "dark" || value === "light";

export const getStoredTheme = () => {
  const value = localStorage.getItem(THEME_KEY);
  return isValidTheme(value) ? value : "light";
};

export const storeTheme = (theme) => {
  if (!isValidTheme(theme)) {
    return;
  }

  localStorage.setItem(THEME_KEY, theme);
};
