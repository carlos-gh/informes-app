import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import AdminView from "./components/AdminView.jsx";
import LoginView from "./components/LoginView.jsx";
import NotFoundView from "./components/NotFoundView.jsx";
import PageFooter from "./components/PageFooter.jsx";
import ReportFormView from "./components/ReportFormView.jsx";
import { clearToken, getStoredToken, storeToken } from "./utils/authStorage.js";

export default function App() {
  const [authToken, setAuthToken] = useState("");
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isLoginRoute = location.pathname === "/login";
  const isAuthenticated = Boolean(authToken);

  useEffect(() => {
    setAuthToken(getStoredToken());
  }, []);

  const handleLogin = (token) => {
    storeToken(token);
    setAuthToken(token);
  };

  const handleLogout = () => {
    clearToken();
    setAuthToken("");
  };

  return (
    <div className="page">
      <div className="page-main">
        <main className={`card ${isAdminRoute ? "card-wide" : ""}`}>
          <Routes>
            <Route path="/" element={<ReportFormView />} />
            <Route path="/login" element={<LoginView onLogin={handleLogin} />} />
            <Route
              path="/admin"
              element={<AdminView authToken={authToken} onLogout={handleLogout} />}
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
