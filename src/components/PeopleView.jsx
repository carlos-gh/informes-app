import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "./ConfirmModal.jsx";
import Pagination from "./Pagination.jsx";

const buildDefaultPersonForm = () => ({
  name: "",
  group: "",
  designation: "Publicador",
});

const PEOPLE_TABLE_SKELETON_ROWS = Array.from({ length: 5 }, (_, index) => index);
const PEOPLE_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-lg",
  "skeleton-sm",
  "skeleton-md",
];

const PAGINATION_PAGE_SIZE = 10;

const getErrorMessageFromResponse = async (response, fallbackMessage) => {
  try {
    const data = await response.json();
    const apiError = String(data?.error || "").trim();
    return apiError || fallbackMessage;
  } catch (error) {
    return fallbackMessage;
  }
};

const PeopleSectionIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function PeopleView({ authToken, authUser, onLogout }) {
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(buildDefaultPersonForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const [peoplePageByGroup, setPeoplePageByGroup] = useState({});
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "Confirmar acción",
    message: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
  });
  const [confirmResolver, setConfirmResolver] = useState(null);

  const isAuthenticated = Boolean(authToken);
  const isSuperAdmin = true === Boolean(authUser?.isSuperAdmin);
  const managedGroupNumber = authUser?.groupNumber ? String(authUser.groupNumber) : "";
  const canManagePeople = isSuperAdmin || Boolean(managedGroupNumber);

  const loadPeople = async () => {
    if (!isAuthenticated || !canManagePeople) {
      setPeople([]);
      setPeoplePageByGroup({});
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/people");

      if (response.status === 401) {
        onLogout();
        setLoadError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (response.status === 403) {
        setPeople([]);
        setPeoplePageByGroup({});
        setLoadError("No tiene permisos para gestionar personas.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load people");
      }

      const data = await response.json();
      setPeople(data.items || []);
    } catch (error) {
      setLoadError("No se pudieron cargar las personas.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    if (!isAuthenticated || !isSuperAdmin) {
      setGroups([]);
      return;
    }

    try {
      const response = await fetch("/api/groups");

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load groups");
      }

      const data = await response.json();
      setGroups(data.items || []);
    } catch (error) {
      setGroups([]);
    }
  };

  useEffect(() => {
    loadPeople();
    loadGroups();
  }, [authToken, canManagePeople, isSuperAdmin]);

  const resetForm = () => {
    setFormState({
      ...buildDefaultPersonForm(),
      group: isSuperAdmin ? "" : managedGroupNumber,
    });
    setEditingId(null);
    setFormErrors({});
  };

  const openNewModal = () => {
    resetForm();
    setSubmitStatus("idle");
    setSubmitMessage("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setSubmitStatus("idle");
    setSubmitMessage("");
    setIsModalOpen(false);
  };

  const updateForm = (field, value) => {
    setFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (formState.name.trim().length === 0) {
      nextErrors.name = "El nombre es obligatorio.";
    }

    if (isSuperAdmin) {
      if (
        formState.group.trim().length === 0 ||
        Number.isNaN(Number(formState.group)) ||
        Number(formState.group) < 1
      ) {
        nextErrors.group = "Seleccione un grupo válido.";
      }
    } else if (
      managedGroupNumber.trim().length === 0 ||
      Number.isNaN(Number(managedGroupNumber)) ||
      Number(managedGroupNumber) < 1
    ) {
      nextErrors.group = "No tiene un grupo válido asignado.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEdit = (person) => {
    setEditingId(person.id);
    setFormState({
      name: person.name || "",
      group: isSuperAdmin
        ? person.groupNumber
          ? String(person.groupNumber)
          : ""
        : managedGroupNumber,
      designation: person.designation || "Publicador",
    });
    setSubmitStatus("idle");
    setSubmitMessage("");
    setIsModalOpen(true);
  };

  const handleDelete = async (personId) => {
    const isConfirmed = await new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: "Eliminar persona",
        message: "¿Desea eliminar esta persona?",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
      });
      setConfirmResolver(() => resolve);
    });

    if (!isConfirmed) {
      return;
    }

    setSubmitStatus("loading");
    setSubmitMessage("");

    try {
      const response = await fetch(`/api/people?id=${personId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo eliminar la persona."
        );
        throw new Error(errorMessage);
      }

      setSubmitStatus("success");
      setSubmitMessage("La persona fue eliminada.");
      await loadPeople();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo eliminar la persona."));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (!validateForm()) {
      setSubmitStatus("error");
      setSubmitMessage("Revise los campos marcados en el formulario.");
      return;
    }

    setSubmitStatus("loading");

    const payload = {
      name: formState.name.trim(),
      groupNumber: isSuperAdmin
        ? formState.group.trim()
          ? Number(formState.group)
          : null
        : Number(managedGroupNumber),
      designation: formState.designation,
    };

    try {
      const response = await fetch(
        editingId ? `/api/people?id=${editingId}` : "/api/people",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo guardar la persona."
        );
        throw new Error(errorMessage);
      }

      setSubmitStatus("success");
      setSubmitMessage(
        editingId ? "La persona fue actualizada." : "La persona fue agregada."
      );
      resetForm();
      setIsModalOpen(false);
      await loadPeople();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo guardar la persona."));
    }
  };

  const peopleByGroup = useMemo(() => {
    const groupMap = new Map();

    people.forEach((person) => {
      const groupValue = Number(person.groupNumber);
      const groupNumber = Number.isInteger(groupValue) && groupValue > 0 ? groupValue : 0;

      if (!groupMap.has(groupNumber)) {
        groupMap.set(groupNumber, []);
      }

      groupMap.get(groupNumber).push(person);
    });

    return Array.from(groupMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([groupNumber, items]) => ({
        groupNumber,
        items,
      }));
  }, [people]);

  useEffect(() => {
    setPeoplePageByGroup((previous) => {
      const next = {};

      peopleByGroup.forEach((groupBlock) => {
        const key = String(groupBlock.groupNumber);
        const totalPages = Math.max(
          1,
          Math.ceil(groupBlock.items.length / PAGINATION_PAGE_SIZE)
        );
        const previousPage = Number(previous[key] || 1);
        const normalizedPage =
          Number.isInteger(previousPage) && previousPage > 0 ? previousPage : 1;

        next[key] = Math.min(normalizedPage, totalPages);
      });

      return next;
    });
  }, [peopleByGroup]);

  const getPeoplePage = (groupNumber, groupItemsCount) => {
    const key = String(groupNumber);
    const requestedPage = Number(peoplePageByGroup[key] || 1);
    const totalPages = Math.max(1, Math.ceil(groupItemsCount / PAGINATION_PAGE_SIZE));
    const normalizedPage =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

    return Math.min(normalizedPage, totalPages);
  };

  const handlePeoplePageChange = (groupNumber, nextPage) => {
    const key = String(groupNumber);

    setPeoplePageByGroup((previous) => ({
      ...previous,
      [key]: nextPage,
    }));
  };

  if (!isAuthenticated) {
    return (
      <section>
        <h1 className="title">Acceso requerido</h1>
        <p className="subtitle">Debe iniciar sesión para ver personas.</p>
        <Link className="nav-link" to="/login">
          Ir al inicio de sesión
        </Link>
      </section>
    );
  }

  if (!canManagePeople) {
    return (
      <section>
        <h1 className="title">Sin permisos</h1>
        <p className="subtitle">
          No tiene permisos para gestionar personas. Esta sección está disponible para
          superintendentes de grupo y superadmin.
        </p>
      </section>
    );
  }

  return (
    <section className="admin config">
      <div className="admin-header">
        <div>
          <p className="brand brand-with-icon">
            <span className="brand-icon" aria-hidden="true">
              <PeopleSectionIcon />
            </span>
            <span>Personas</span>
          </p>
          <h1 className="title">Personas registradas</h1>
          <p className="subtitle">
            {isSuperAdmin
              ? "Administre la lista de personas agrupadas por número de grupo."
              : `Administre las personas registradas del Grupo ${managedGroupNumber}.`}
          </p>
        </div>
        <div className="admin-header-actions">
          <span className="config-total">Total: {people.length}</span>
          <button className="secondary-button" type="button" onClick={openNewModal}>
            Agregar persona
          </button>
        </div>
      </div>

      <div className="config-grouped-people">
        {isLoading ? (
          <div className="table-wrapper">
            <table className="table">
              <tbody>
                {PEOPLE_TABLE_SKELETON_ROWS.map((rowIndex) => (
                  <tr key={`people-skeleton-${rowIndex}`} className="table-skeleton">
                    {PEOPLE_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                      <td key={`people-skeleton-cell-${rowIndex}-${cellIndex}`}>
                        <span className={`skeleton-line ${size}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && loadError ? (
          <div className="feedback error" role="status">
            {loadError}
          </div>
        ) : null}
        {!isLoading && !loadError && peopleByGroup.length === 0 ? (
          <div className="table-wrapper">
            <table className="table">
              <tbody>
                <tr>
                  <td>No hay personas registradas.</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
        {!isLoading && !loadError
          ? peopleByGroup.map((groupBlock) => {
              const groupInfo = groups.find(
                (group) => Number(group.groupNumber) === Number(groupBlock.groupNumber)
              );
              const groupTitle =
                groupBlock.groupNumber > 0
                  ? `${groupInfo?.name || `Grupo ${groupBlock.groupNumber}`} (Grupo ${groupBlock.groupNumber})`
                  : "Sin grupo";
              const groupCurrentPage = getPeoplePage(
                groupBlock.groupNumber,
                groupBlock.items.length
              );
              const groupPageStartIndex = (groupCurrentPage - 1) * PAGINATION_PAGE_SIZE;
              const pagedPeopleItems = groupBlock.items.slice(
                groupPageStartIndex,
                groupPageStartIndex + PAGINATION_PAGE_SIZE
              );

              return (
                <div
                  className="closed-periods"
                  key={`people-group-${groupBlock.groupNumber}`}
                >
                  <div className="config-section-head">
                    <h3 className="config-section-title">{groupTitle}</h3>
                    <span className="config-total">
                      Total: {groupBlock.items.length}
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Nombre</th>
                          <th>Designación</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedPeopleItems.map((person, index) => (
                          <tr key={person.id}>
                            <td>{groupPageStartIndex + index + 1}</td>
                            <td>{person.name}</td>
                            <td>{person.designation || "Publicador"}</td>
                            <td>
                              <div className="table-actions">
                                <button
                                  className="table-button"
                                  type="button"
                                  onClick={() => handleEdit(person)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="table-button danger"
                                  type="button"
                                  onClick={() => handleDelete(person.id)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    ariaLabel={`Paginación de personas ${groupTitle}`}
                    totalItems={groupBlock.items.length}
                    pageSize={PAGINATION_PAGE_SIZE}
                    currentPage={groupCurrentPage}
                    onPageChange={(nextPage) =>
                      handlePeoplePageChange(groupBlock.groupNumber, nextPage)
                    }
                  />
                </div>
              );
            })
          : null}
      </div>

      {submitMessage ? (
        <div
          className={`feedback ${submitStatus === "success" ? "success" : "error"}`}
          role="status"
        >
          {submitMessage}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="brand">Personas</p>
                <h2 className="modal-title">
                  {editingId ? "Editar persona" : "Agregar persona"}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal}>
                Cerrar
              </button>
            </div>

            <form className="form modal-body" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="person-name">
                  Nombre <span className="required">*</span>
                </label>
                <input
                  id="person-name"
                  name="person-name"
                  type="text"
                  value={formState.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? "person-name-error" : undefined}
                  required
                />
                {formErrors.name ? (
                  <span id="person-name-error" className="error">
                    {formErrors.name}
                  </span>
                ) : null}
              </div>

              {isSuperAdmin ? (
                <div className="field">
                  <label htmlFor="person-group">
                    Grupo <span className="required">*</span>
                  </label>
                  <select
                    id="person-group"
                    name="person-group"
                    value={formState.group}
                    onChange={(event) => updateForm("group", event.target.value)}
                    aria-invalid={Boolean(formErrors.group)}
                    aria-describedby={
                      formErrors.group ? "person-group-error" : undefined
                    }
                  >
                    <option value="">Seleccione</option>
                    {groups.map((group) => (
                      <option key={group.groupNumber} value={group.groupNumber}>
                        {group.name} (Grupo {group.groupNumber})
                      </option>
                    ))}
                  </select>
                  {formErrors.group ? (
                    <span id="person-group-error" className="error">
                      {formErrors.group}
                    </span>
                  ) : null}
                </div>
              ) : (
                <input type="hidden" name="person-group" value={managedGroupNumber} />
              )}

              <div className="field">
                <label htmlFor="person-designation">Designación</label>
                <select
                  id="person-designation"
                  name="person-designation"
                  value={formState.designation}
                  onChange={(event) => updateForm("designation", event.target.value)}
                >
                  <option value="Publicador">Publicador</option>
                  <option value="Precursor Auxiliar">Precursor Auxiliar</option>
                  <option value="Precursor Regular">Precursor Regular</option>
                </select>
              </div>

              <div className="form-actions">
                <button
                  className="submit"
                  type="submit"
                  disabled={submitStatus === "loading"}
                >
                  {submitStatus === "loading"
                    ? "Guardando..."
                    : editingId
                    ? "Actualizar persona"
                    : "Agregar persona"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeModal}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onConfirm={() => {
          if (confirmResolver) {
            confirmResolver(true);
          }
          setConfirmResolver(null);
          setConfirmState((previous) => ({
            ...previous,
            isOpen: false,
          }));
        }}
        onCancel={() => {
          if (confirmResolver) {
            confirmResolver(false);
          }
          setConfirmResolver(null);
          setConfirmState((previous) => ({
            ...previous,
            isOpen: false,
          }));
        }}
      />
    </section>
  );
}
