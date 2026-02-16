import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AdminView from "./components/AdminView.jsx";
import ConfigView from "./components/ConfigView.jsx";
import LoginView from "./components/LoginView.jsx";
import NotFoundView from "./components/NotFoundView.jsx";
import PageFooter from "./components/PageFooter.jsx";
import PageHeader from "./components/PageHeader.jsx";
import ReportFormView from "./components/ReportFormView.jsx";
import { clearToken, getStoredToken, storeToken } from "./utils/authStorage.js";
import { getReportingLabelFromKey } from "./utils/reporting.js";
import { getStoredTheme, storeTheme } from "./utils/themeStorage.js";

export default function App() {
  const [authToken, setAuthToken] = useState("");
  const [theme, setTheme] = useState("dark");
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isConfigRoute = location.pathname.startsWith("/config");
  const isLoginRoute = location.pathname === "/login";
  const isAuthenticated = Boolean(authToken);

  useEffect(() => {
    setAuthToken(getStoredToken());
  }, []);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const monthDetailMatch = location.pathname.match(/^\/admin\/(\d{4}-\d{2})$/);

    if ("/" === location.pathname) {
      document.title = "Informe mensual | Congregación El Puente Monte Tabor";
      return;
    }

    if ("/login" === location.pathname) {
      document.title = "Acceso | Congregación El Puente Monte Tabor";
      return;
    }

    if ("/admin" === location.pathname) {
      document.title = "Registros de informes | Congregación El Puente Monte Tabor";
      return;
    }

    if (monthDetailMatch && monthDetailMatch[1]) {
      const monthLabel = getReportingLabelFromKey(monthDetailMatch[1]);

      document.title = monthLabel
        ? `Detalle ${monthLabel} | Congregación El Puente Monte Tabor`
        : "Detalle de informes | Congregación El Puente Monte Tabor";
      return;
    }

    if ("/config" === location.pathname) {
      document.title = "Configuraciones | Congregación El Puente Monte Tabor";
      return;
    }

    document.title = "Congregación El Puente Monte Tabor";
  }, [location.pathname]);

  const handleLogin = (token) => {
    storeToken(token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    clearToken();
    setAuthToken("");
  };

  const handleThemeChange = (nextTheme) => {
    if (nextTheme !== "dark" && nextTheme !== "light") {
      return;
    }

    setTheme(nextTheme);
    storeTheme(nextTheme);
  };

  return (
    <div className="page">
      {isAuthenticated ? (
        <PageHeader
          isAuthenticated={isAuthenticated}
          isLoginRoute={isLoginRoute}
          onLogout={handleLogout}
        />
      ) : null}

      <div className="page-main">
        <main className={`card ${isAdminRoute || isConfigRoute ? "card-wide" : ""}`}>
          <Routes>
            <Route path="/" element={<ReportFormView isAuthenticated={isAuthenticated} />} />
            <Route path="/login" element={<LoginView onLogin={handleLogin} />} />
            <Route
              path="/admin"
              element={<AdminView authToken={authToken} onLogout={handleLogout} />}
            />
            <Route
              path="/admin/:monthKey"
              element={<AdminView authToken={authToken} onLogout={handleLogout} />}
            />
            <Route
              path="/config"
              element={
                <ConfigView
                  authToken={authToken}
                  onLogout={handleLogout}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                />
              }
            />
            <Route path="*" element={<NotFoundView />} />
          </Routes>
        </main>
      </div>

      <PageFooter
        isAuthenticated={isAuthenticated}
        isLoginRoute={isLoginRoute}
        onLogout={handleLogout}
      />
    </div>
  );
}
