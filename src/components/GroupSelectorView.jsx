import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const GROUP_SKELETON_ITEMS = Array.from({ length: 6 }, (_, index) => index);

export default function GroupSelectorView() {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadGroups = async () => {
      try {
        const response = await fetch("/api/groups");

        if (!response.ok) {
          throw new Error("Failed to load groups");
        }

        const data = await response.json();

        if (isMounted) {
          setGroups(data.items || []);
          setLoadError("");
        }
      } catch (error) {
        if (isMounted) {
          setGroups([]);
          setLoadError("No se pudieron cargar los grupos. Inténtelo más tarde.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedGroups = useMemo(() => {
    return [...groups].sort(
      (a, b) => Number(a.groupNumber || 0) - Number(b.groupNumber || 0)
    );
  }, [groups]);

  return (
    <section className="group-selector-view">
      <h1 className="title">Seleccione su grupo</h1>
      <p className="subtitle">
        Elija su grupo para abrir el formulario correspondiente.
      </p>

      <div className="group-selector-grid">
        {isLoading
          ? GROUP_SKELETON_ITEMS.map((item) => (
              <div
                key={`group-skeleton-${item}`}
                className="group-selector-card group-selector-card-skeleton"
              >
                <span className="skeleton-line skeleton-sm" />
                <span className="skeleton-line skeleton-md" />
              </div>
            ))
          : null}

        {!isLoading &&
          sortedGroups.map((group) => (
            <Link
              key={group.groupNumber}
              className="group-selector-card"
              to={`/grupo-${group.groupNumber}`}
            >
              <span className="group-selector-card-number">
                Grupo {group.groupNumber}
              </span>
              <span className="group-selector-card-name">
                {group.name || `Grupo ${group.groupNumber}`}
              </span>
            </Link>
          ))}
      </div>

      {!isLoading && 0 === sortedGroups.length ? (
        <div className="closed">
          <p className="closed-title">No hay grupos registrados.</p>
          <p className="closed-message">
            Contacte al superadmin para crear grupos.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div className="feedback error" role="status">
          {loadError}
        </div>
      ) : null}
    </section>
  );
}
