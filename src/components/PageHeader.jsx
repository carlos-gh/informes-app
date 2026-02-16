import { Link } from "react-router-dom";

export default function PageHeader({ isAuthenticated, isLoginRoute, onLogout }) {
  return (
    <header className="page-header">
      <nav className="header-nav" aria-label="Navegación principal">
        {isAuthenticated ? (
          <>
            <Link className="header-item header-link" to="/">
              Inicio
            </Link>
            <Link className="header-item header-link" to="/admin">
              Administrar Informes
            </Link>
            <Link className="header-item header-link" to="/config">
              Configuración
            </Link>
            <button
              className="header-item header-button"
              type="button"
              onClick={onLogout}
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            {isLoginRoute ? (
              <Link className="header-item header-link" to="/">
                Inicio
              </Link>
            ) : null}
            <Link className="header-item header-link" to="/login">
              Acceso
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
