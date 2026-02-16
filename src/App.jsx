import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AdminView from "./components/AdminView.jsx";
import ConfigView from "./components/ConfigView.jsx";
import LoginView from "./components/LoginView.jsx";
import NotFoundView from "./components/NotFoundView.jsx";
import PageFooter from "./components/PageFooter.jsx";
import ReportFormView from "./components/ReportFormView.jsx";
import { clearToken, getStoredToken, storeToken } from "./utils/authStorage.js";
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
