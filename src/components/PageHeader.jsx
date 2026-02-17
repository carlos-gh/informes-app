import { useState } from "react";
import { Link } from "react-router-dom";

export default function PageHeader({
  isAuthenticated,
  isLoginRoute,
  authUser,
  onLogout,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isSuperAdmin = true === Boolean(authUser?.isSuperAdmin);
  const displayName = String(authUser?.fullName || authUser?.username || "").trim();
  const greetingPrefix = (() => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour <= 11) {
      return "Buenos días";
    }

    if (hour >= 12 && hour <= 18) {
      return "Buenas tardes";
    }

    return "Buenas noches";
  })();
  const greetingMessage = displayName
    ? `${greetingPrefix} ${displayName}!`
    : `${greetingPrefix}!`;

  const toggleMenu = () => {
    setIsMenuOpen((previous) => !previous);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="page-header">
      <div className="header-shell">
        {isAuthenticated ? <div className="header-greeting">{greetingMessage}</div> : null}

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
              <Link className="header-item header-link" to="/" onClick={closeMenu}>
                Inicio
              </Link>
              <Link className="header-item header-link" to="/admin" onClick={closeMenu}>
                Administrar Informes
              </Link>
              <Link className="header-item header-link" to="/config" onClick={closeMenu}>
                Configuración
              </Link>
              {isSuperAdmin ? (
                <Link className="header-item header-link" to="/users" onClick={closeMenu}>
                  Usuarios
                </Link>
              ) : null}
              <Link className="header-item header-link" to="/profile" onClick={closeMenu}>
                Perfil
              </Link>
              <button
                className="header-item header-button"
                type="button"
                onClick={() => {
                  closeMenu();
                  onLogout();
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              {isLoginRoute ? (
                <Link className="header-item header-link" to="/" onClick={closeMenu}>
                  Inicio
                </Link>
              ) : null}
              <Link className="header-item header-link" to="/login" onClick={closeMenu}>
                Acceso
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
