import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import AdminView from "./components/AdminView.jsx";
import ConfigView from "./components/ConfigView.jsx";
import GroupSelectorView from "./components/GroupSelectorView.jsx";
import LoginView from "./components/LoginView.jsx";
import NotFoundView from "./components/NotFoundView.jsx";
import PageFooter from "./components/PageFooter.jsx";
import PageHeader from "./components/PageHeader.jsx";
import ProfileView from "./components/ProfileView.jsx";
import ReportFormView from "./components/ReportFormView.jsx";
import UsersView from "./components/UsersView.jsx";
import { clearToken, getStoredToken, storeToken } from "./utils/authStorage.js";
import { getReportingLabelFromKey } from "./utils/reporting.js";
import { getStoredTheme, storeTheme } from "./utils/themeStorage.js";

function GroupSlugRoute({ isAuthenticated, authUser, authToken }) {
  const { groupSlug = "" } = useParams();
  const groupMatch = String(groupSlug).match(/^grupo-(\d+)$/);

  if (!groupMatch || !groupMatch[1]) {
    return <NotFoundView />;
  }

  return (
    <ReportFormView
      isAuthenticated={isAuthenticated}
      authUser={authUser}
      authToken={authToken}
      forcedGroupNumber={groupMatch[1]}
    />
  );
}

export default function App() {
  const [authToken, setAuthToken] = useState("");
  const [authUser, setAuthUser] = useState(null);
  const [theme, setTheme] = useState("dark");
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isConfigRoute = location.pathname.startsWith("/config");
  const isUsersRoute = location.pathname.startsWith("/users");
  const isProfileRoute = location.pathname.startsWith("/profile");
  const isLoginRoute = location.pathname === "/login";
  const isAuthenticated = Boolean(authToken);

  useEffect(() => {
    setAuthToken(getStoredToken());
  }, []);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    if (!authToken) {
      setAuthUser(null);
      return;
    }

    let isMounted = true;

    const loadCurrentUser = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unauthorized");
        }

        const data = await response.json();

        if (isMounted) {
          setAuthUser(data.user || null);
        }
      } catch (error) {
        if (isMounted) {
          clearToken();
          setAuthToken("");
          setAuthUser(null);
        }
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [authToken]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const monthDetailMatch = location.pathname.match(/^\/admin\/(\d{4}-\d{2})$/);
    const groupFormMatch = location.pathname.match(/^\/grupo-(\d+)\/?$/);

    if ("/" === location.pathname) {
      document.title = "Seleccione grupo | Congregación El Puente Monte Tabor";
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

    if ("/users" === location.pathname) {
      document.title = "Usuarios | Congregación El Puente Monte Tabor";
      return;
    }

    if ("/profile" === location.pathname) {
      document.title = "Perfil | Congregación El Puente Monte Tabor";
      return;
    }

    if (groupFormMatch && groupFormMatch[1]) {
      document.title = `Formulario Grupo ${groupFormMatch[1]} | Congregación El Puente Monte Tabor`;
      return;
    }

    document.title = "Congregación El Puente Monte Tabor";
  }, [location.pathname]);

  const handleLogin = (session) => {
    const token =
      typeof session === "string" ? session : String(session?.token || "").trim();

    if (!token) {
      return;
    }

    storeToken(token);
    setAuthToken(token);
    setAuthUser(session?.user || null);
  };

  const handleLogout = () => {
    clearToken();
    setAuthToken("");
    setAuthUser(null);
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
          authUser={authUser}
          onLogout={handleLogout}
        />
      ) : null}

      <div className="page-main">
        <main
          className={`card ${
            isAdminRoute || isConfigRoute || isUsersRoute || isProfileRoute
              ? "card-wide"
              : ""
          }`}
        >
          <Routes>
            <Route
              path="/"
              element={
                <GroupSelectorView />
              }
            />
            <Route
              path="/:groupSlug"
              element={
                <GroupSlugRoute
                  isAuthenticated={isAuthenticated}
                  authUser={authUser}
                  authToken={authToken}
                />
              }
            />
            <Route path="/login" element={<LoginView onLogin={handleLogin} />} />
            <Route
              path="/admin"
              element={
                <AdminView
                  authToken={authToken}
                  authUser={authUser}
                  onLogout={handleLogout}
                />
              }
            />
            <Route
              path="/admin/:monthKey"
              element={
                <AdminView
                  authToken={authToken}
                  authUser={authUser}
                  onLogout={handleLogout}
                />
              }
            />
            <Route
              path="/config"
              element={
                <ConfigView
                  authToken={authToken}
                  authUser={authUser}
                  onLogout={handleLogout}
                  theme={theme}
                  onThemeChange={handleThemeChange}
                />
              }
            />
            <Route
              path="/users"
              element={
                <UsersView
                  authToken={authToken}
                  authUser={authUser}
                  onLogout={handleLogout}
                />
              }
            />
            <Route
              path="/profile"
              element={<ProfileView authToken={authToken} onLogout={handleLogout} />}
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
