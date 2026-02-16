import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const buildDefaultPersonForm = () => ({
  name: "",
  group: "",
  designation: "Publicador",
});

const CONFIG_TABLE_SKELETON_ROWS = Array.from({ length: 5 }, (_, index) => index);
const CONFIG_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-lg",
  "skeleton-sm",
  "skeleton-sm",
  "skeleton-md",
];

export default function ConfigView({
  authToken,
  onLogout,
  theme = "dark",
  onThemeChange = () => {},
}) {
  const [people, setPeople] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(buildDefaultPersonForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const isAuthenticated = Boolean(authToken);

  const loadPeople = async () => {
    if (!isAuthenticated) {
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const response = await fetch("/api/people", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        setLoadError("Su sesión expiró. Inicie sesión de nuevo.");
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

  useEffect(() => {
    loadPeople();
  }, [authToken]);

  const resetForm = () => {
    setFormState(buildDefaultPersonForm());
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

    if (formState.group.trim().length > 0 && Number.isNaN(Number(formState.group))) {
      nextErrors.group = "Ingrese un número válido.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEdit = (person) => {
    setEditingId(person.id);
    setFormState({
      name: person.name || "",
      group: person.groupNumber ? String(person.groupNumber) : "",
      designation: person.designation || "Publicador",
    });
    setSubmitStatus("idle");
    setSubmitMessage("");
    setIsModalOpen(true);
  };

  const handleDelete = async (personId) => {
    if (!window.confirm("¿Desea eliminar esta persona?")) {
      return;
    }

    setSubmitStatus("loading");
    setSubmitMessage("");

    try {
      const response = await fetch(`/api/people?id=${personId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.status === 401) {
        onLogout();
        setSubmitStatus("error");
        setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to delete person");
      }

      setSubmitStatus("success");
      setSubmitMessage("La persona fue eliminada.");
      await loadPeople();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage("No se pudo eliminar la persona.");
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
      groupNumber: formState.group.trim() ? Number(formState.group) : null,
      designation: formState.designation,
    };

    try {
      const response = await fetch(
        editingId ? `/api/people?id=${editingId}` : "/api/people",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
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
        throw new Error("Failed to save person");
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
      setSubmitMessage("No se pudo guardar la persona.");
    }
  };

  const handleThemeSelect = (event) => {
    const value = event.target.value;

    if (value !== "dark" && value !== "light") {
      return;
    }

    onThemeChange(value);
  };

  if (!isAuthenticated) {
    return (
      <section>
        <h1 className="title">Acceso requerido</h1>
        <p className="subtitle">Debe iniciar sesión para ver configuraciones.</p>
        <Link className="nav-link" to="/login">
          Ir al inicio de sesión
        </Link>
      </section>
    );
  }

  return (
    <section className="admin config">
      <div className="admin-header">
        <div>
          <p className="brand">Configuraciones</p>
          <h1 className="title">Personas registradas</h1>
          <p className="subtitle">
            Administre la lista de personas para comparar pendientes de informes.
          </p>
        </div>
      </div>

      <section className="config-theme">
        <h2 className="config-section-title">Tema</h2>
        <p className="config-section-description">
          Defina si desea usar tema oscuro o claro en esta aplicación.
        </p>
        <div className="field">
          <label htmlFor="config-theme">Tema predeterminado</label>
          <select
            id="config-theme"
            name="config-theme"
            value={theme}
            onChange={handleThemeSelect}
          >
            <option value="dark">Oscuro (predeterminado)</option>
            <option value="light">Claro</option>
          </select>
        </div>
      </section>

      <div className="admin-toolbar config-toolbar">
        <div className="admin-toolbar-left">
          <span className="month-caption">Total: {people.length}</span>
        </div>
        <div className="admin-toolbar-right">
          <button className="secondary-button" type="button" onClick={openNewModal}>
            Agregar persona
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Nombre</th>
              <th>Grupo</th>
              <th>Designación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? CONFIG_TABLE_SKELETON_ROWS.map((rowIndex) => (
                  <tr key={`config-skeleton-${rowIndex}`} className="table-skeleton">
                    {CONFIG_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                      <td key={`config-skeleton-cell-${rowIndex}-${cellIndex}`}>
                        <span className={`skeleton-line ${size}`} />
                      </td>
                    ))}
                  </tr>
                ))
              : null}
            {!isLoading && loadError ? (
              <tr>
                <td colSpan={5}>{loadError}</td>
              </tr>
            ) : null}
            {!isLoading && !loadError && people.length === 0 ? (
              <tr>
                <td colSpan={5}>No hay personas registradas.</td>
              </tr>
            ) : null}
            {!isLoading &&
              !loadError &&
              people.map((person, index) => (
                <tr key={person.id}>
                  <td>{index + 1}</td>
                  <td>{person.name}</td>
                  <td>{person.groupNumber ?? "-"}</td>
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

      <div className="config-spacer" />

      {isModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="brand">Configuraciones</p>
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

              <div className="field">
                <label htmlFor="person-group">Grupo</label>
                <input
                  id="person-group"
                  name="person-group"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={formState.group}
                  onChange={(event) => updateForm("group", event.target.value)}
                  aria-invalid={Boolean(formErrors.group)}
                  aria-describedby={formErrors.group ? "person-group-error" : undefined}
                />
                {formErrors.group ? (
                  <span id="person-group-error" className="error">
                    {formErrors.group}
                  </span>
                ) : null}
              </div>

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
                <button className="secondary-button" type="button" onClick={closeModal}>
                  Cancelar
                </button>
              </div>

              {submitMessage ? (
                <div
                  className={`feedback ${
                    submitStatus === "success" ? "success" : "error"
                  }`}
                  role="status"
                >
                  {submitMessage}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
