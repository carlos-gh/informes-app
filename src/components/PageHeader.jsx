import { useState } from "react";
import { Link } from "react-router-dom";

export default function PageHeader({ isAuthenticated, isLoginRoute, onLogout }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen((previous) => !previous);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="page-header">
      <div className="header-shell">
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
