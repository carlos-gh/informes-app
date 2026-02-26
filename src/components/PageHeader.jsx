import { useState } from "react";
import { NavLink } from "react-router-dom";

const GreetingPeriodIcon = ({ period }) => {
  if (period === "morning") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M4 16a8 8 0 0 1 16 0M12 3v3M5.64 6.64l2.12 2.12M18.36 6.64l-2.12 2.12M3 12h3M18 12h3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (period === "afternoon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M20 15.5A8.5 8.5 0 1 1 8.5 4a7 7 0 0 0 11.5 11.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const LogoutIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function PageHeader({
  isAuthenticated,
  isLoginRoute,
  authUser,
  onLogout,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSuperAdmin = true === Boolean(authUser?.isSuperAdmin);
  const displayName = String(authUser?.fullName || authUser?.username || "").trim();
  const hour = new Date().getHours();
  const greetingPeriod =
    hour >= 5 && hour <= 11 ? "morning" : hour >= 12 && hour <= 18 ? "afternoon" : "night";
  const greetingPrefix =
    greetingPeriod === "morning"
      ? "Buenos días"
      : greetingPeriod === "afternoon"
      ? "Buenas tardes"
      : "Buenas noches";
  const greetingMessage = displayName
    ? `${greetingPrefix}, ${displayName}!`
    : `${greetingPrefix}!`;

  const toggleMenu = () => {
    setIsMenuOpen((previous) => !previous);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };
  const getHeaderLinkClassName = ({ isActive }) =>
    `header-item header-link${isActive ? " header-link-active" : ""}`;

  return (
    <header className="page-header">
      <div className="header-shell">
        {isAuthenticated ? (
          <div className="header-greeting">
            <span className="header-greeting-icon" aria-hidden="true">
              <GreetingPeriodIcon period={greetingPeriod} />
            </span>
            <span className="header-greeting-text">{greetingMessage}</span>
          </div>
        ) : null}

        <button
          className="header-menu-toggle"
          type="button"
          onClick={toggleMenu}
          aria-expanded={isMenuOpen}
          aria-controls="header-navigation"
        >
          {isMenuOpen ? "Cerrar menú" : "Menú"}
        </button>

        <nav
          id="header-navigation"
          className={`header-nav ${isMenuOpen ? "open" : ""}`}
          aria-label="Navegación principal"
        >
          {isAuthenticated ? (
            <>
              <NavLink className={getHeaderLinkClassName} to="/" end onClick={closeMenu}>
                Inicio
              </NavLink>
              <NavLink
                className={getHeaderLinkClassName}
                to="/admin"
                onClick={closeMenu}
              >
                Administrar Informes
              </NavLink>
              <NavLink
                className={getHeaderLinkClassName}
                to="/config"
                onClick={closeMenu}
              >
                Configuración
              </NavLink>
              {isSuperAdmin ? (
                <NavLink
                  className={getHeaderLinkClassName}
                  to="/users"
                  onClick={closeMenu}
                >
                  Usuarios
                </NavLink>
              ) : null}
              <NavLink
                className={getHeaderLinkClassName}
                to="/profile"
                onClick={closeMenu}
              >
                Perfil
              </NavLink>
              <button
                className="header-item header-button"
                type="button"
                onClick={() => {
                  closeMenu();
                  onLogout();
                }}
              >
                <span className="header-item-icon" aria-hidden="true">
                  <LogoutIcon />
                </span>
                <span>Cerrar sesión</span>
              </button>
            </>
          ) : (
            <>
              {isLoginRoute ? (
                <NavLink className={getHeaderLinkClassName} to="/" end onClick={closeMenu}>
                  Inicio
                </NavLink>
              ) : null}
              <NavLink className={getHeaderLinkClassName} to="/login" end onClick={closeMenu}>
                Acceso
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
