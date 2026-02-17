import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const GROUP_SKELETON_ITEMS = Array.from({ length: 6 }, (_, index) => index);

const GroupIcon = () => {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 13c-2.76 0-5 2.01-5 4.5V19h10v-1.5C13 15.01 10.76 13 8 13ZM16 13c-.76 0-1.48.15-2.13.42A5.96 5.96 0 0 1 15 17.5V19h6v-1.5c0-2.49-2.24-4.5-5-4.5Z"
        fill="currentColor"
      />
    </svg>
  );
};

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
              <div className="group-selector-card-head">
                <span className="group-selector-card-icon" aria-hidden="true">
                  <GroupIcon />
                </span>
                <span className="group-selector-card-number">Grupo {group.groupNumber}</span>
              </div>
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
