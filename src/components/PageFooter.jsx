import { Link } from "react-router-dom";

export default function PageFooter({ isAuthenticated, isLoginRoute, onLogout }) {
  return (
    <footer className="page-footer">
      <span className="footer-item">© Congregación El Puente Monte Tabor</span>
      {isAuthenticated ? (
        <>
          <button
            className="footer-item footer-link footer-button"
            type="button"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </>
      ) : (
        <>
          {isLoginRoute ? (
            <Link className="footer-item footer-link" to="/">
              Inicio
            </Link>
          ) : null}
          <Link className="footer-item footer-link" to="/login">
            Acceso
          </Link>
        </>
      )}
    </footer>
  );
}
