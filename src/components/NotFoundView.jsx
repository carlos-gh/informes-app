import { Link } from "react-router-dom";

export default function NotFoundView() {
  return (
    <section>
      <h1 className="title">Página no encontrada</h1>
      <p className="subtitle">La ruta solicitada no existe.</p>
      <Link className="nav-link" to="/">
        Volver al formulario
      </Link>
    </section>
  );
}
