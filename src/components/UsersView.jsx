import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const buildDefaultForm = () => ({
  username: "",
  password: "",
  groupNumber: "",
  isActive: true,
});

const USERS_TABLE_SKELETON_ROWS = Array.from({ length: 5 }, (_, index) => index);
const USERS_TABLE_SKELETON_COLUMNS = [
  "skeleton-lg",
  "skeleton-sm",
  "skeleton-sm",
  "skeleton-sm",
  "skeleton-md",
];

const normalizeUsername = (value) => {
  return String(value || "").trim().toLowerCase();
};

const getErrorMessageFromResponse = async (response, fallbackMessage) => {
  try {
    const data = await response.json();
    const apiError = String(data?.error || "").trim();

    return apiError || fallbackMessage;
  } catch (error) {
    return fallbackMessage;
  }
};

export default function UsersView({ authToken, authUser, onLogout }) {
  const isAuthenticated = Boolean(authToken);
  const isSuperAdmin = true === Boolean(authUser?.isSuperAdmin);

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formState, setFormState] = useState(buildDefaultForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  const loadData = async () => {
    if (!isAuthenticated || !isSuperAdmin) {
      return;
    }

    setIsLoading(true);
    setLoadError("");

    try {
      const [usersResponse, groupsResponse] = await Promise.all([
        fetch("/api/users", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
        fetch("/api/groups", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
      ]);

      if (usersResponse.status === 401 || groupsResponse.status === 401) {
        onLogout();
        setLoadError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!usersResponse.ok || !groupsResponse.ok) {
        throw new Error("Failed to load users");
      }

      const usersData = await usersResponse.json();
      const groupsData = await groupsResponse.json();
      setUsers(usersData.items || []);
      setGroups(groupsData.items || []);
    } catch (error) {
      setLoadError("No se pudieron cargar los usuarios.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authToken, isSuperAdmin]);

  const resetForm = () => {
    setFormState(buildDefaultForm());
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
    const username = normalizeUsername(formState.username);

    if (!username || !/^[a-z0-9._-]{3,48}$/.test(username)) {
      nextErrors.username =
        "Use entre 3 y 48 caracteres (a-z, 0-9, punto, guion o guion bajo).";
    }

    if (!editingId && String(formState.password || "").length < 10) {
      nextErrors.password = "La contraseña debe tener al menos 10 caracteres.";
    }

    if (editingId && formState.password && String(formState.password).length < 10) {
      nextErrors.password = "Si define una nueva contraseña, debe tener al menos 10 caracteres.";
    }

    if (!formState.groupNumber || Number.isNaN(Number(formState.groupNumber))) {
      nextErrors.groupNumber = "Seleccione un grupo válido.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEdit = (user) => {
    if (user.role === "superadmin") {
      return;
    }

    setEditingId(user.id);
    setFormState({
      username: user.username || "",
      password: "",
      groupNumber: user.groupNumber ? String(user.groupNumber) : "",
      isActive: true === user.isActive,
    });
    setFormErrors({});
    setSubmitStatus("idle");
    setSubmitMessage("");
    setIsModalOpen(true);
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
      username: normalizeUsername(formState.username),
      password: String(formState.password || "").trim(),
      groupNumber: Number(formState.groupNumber),
      isActive: Boolean(formState.isActive),
    };

    if (!payload.password) {
      delete payload.password;
    }

    try {
      const response = await fetch(editingId ? `/api/users?id=${editingId}` : "/api/users", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
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
          "No se pudo guardar el usuario."
        );
        throw new Error(errorMessage);
      }

      setSubmitStatus("success");
      setSubmitMessage(editingId ? "Usuario actualizado." : "Usuario creado.");
      closeModal();
      await loadData();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(String(error.message || "No se pudo guardar el usuario."));
    }
  };

  if (!isAuthenticated) {
    return (
      <section>
        <h1 className="title">Acceso requerido</h1>
        <p className="subtitle">Debe iniciar sesión para ver esta sección.</p>
        <Link className="nav-link" to="/login">
          Ir al inicio de sesión
        </Link>
      </section>
    );
  }

  if (!isSuperAdmin) {
    return (
      <section>
        <h1 className="title">Acceso denegado</h1>
        <p className="subtitle">Solo el superadmin puede gestionar usuarios.</p>
      </section>
    );
  }

  return (
    <section className="admin config">
      <div className="admin-header">
        <div>
          <p className="brand">Administración</p>
          <h1 className="title">Usuarios</h1>
          <p className="subtitle">
            Cree usuarios, asígneles grupo y controle su estado de acceso.
          </p>
        </div>
      </div>

      <section className="config-people">
        <div className="config-section-head">
          <div>
            <h2 className="config-section-title">Usuarios registrados</h2>
            <p className="config-section-description">
              Los usuarios de grupo solo podrán administrar informes de su grupo.
            </p>
          </div>
          <div className="config-section-actions">
            <span className="config-total">Total: {users.length}</span>
            <button className="secondary-button" type="button" onClick={openNewModal}>
              Agregar usuario
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Grupo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? USERS_TABLE_SKELETON_ROWS.map((rowIndex) => (
                    <tr key={`users-skeleton-${rowIndex}`} className="table-skeleton">
                      {USERS_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                        <td key={`users-skeleton-cell-${rowIndex}-${cellIndex}`}>
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
              {!isLoading && !loadError && users.length === 0 ? (
                <tr>
                  <td colSpan={5}>No hay usuarios registrados.</td>
                </tr>
              ) : null}
              {!isLoading &&
                !loadError &&
                users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.role === "superadmin" ? "Superadmin" : "Usuario de grupo"}</td>
                    <td>{user.groupName || (user.groupNumber ? `Grupo ${user.groupNumber}` : "-")}</td>
                    <td>{true === user.isActive ? "Activo" : "Inactivo"}</td>
                    <td>
                      {user.role === "superadmin" ? (
                        <span className="table-preview-tag">Protegido</span>
                      ) : (
                        <button
                          className="table-button"
                          type="button"
                          onClick={() => handleEdit(user)}
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

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
                <p className="brand">Usuarios</p>
                <h2 className="modal-title">
                  {editingId ? "Editar usuario" : "Crear usuario"}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={closeModal}>
                Cerrar
              </button>
            </div>

            <form className="form modal-body" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="user-username">
                  Nombre de usuario <span className="required">*</span>
                </label>
                <input
                  id="user-username"
                  name="user-username"
                  type="text"
                  autoComplete="username"
                  value={formState.username}
                  onChange={(event) => updateForm("username", event.target.value)}
                  aria-invalid={Boolean(formErrors.username)}
                  aria-describedby={formErrors.username ? "user-username-error" : undefined}
                  required
                />
                {formErrors.username ? (
                  <span id="user-username-error" className="error">
                    {formErrors.username}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="user-password">
                  {editingId ? "Nueva contraseña" : "Contraseña"}{" "}
                  <span className="required">*</span>
                </label>
                <input
                  id="user-password"
                  name="user-password"
                  type="password"
                  autoComplete={editingId ? "new-password" : "new-password"}
                  value={formState.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  aria-invalid={Boolean(formErrors.password)}
                  aria-describedby={formErrors.password ? "user-password-error" : undefined}
                  required={!editingId}
                />
                {formErrors.password ? (
                  <span id="user-password-error" className="error">
                    {formErrors.password}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="user-group">
                  Grupo asignado <span className="required">*</span>
                </label>
                <select
                  id="user-group"
                  name="user-group"
                  value={formState.groupNumber}
                  onChange={(event) => updateForm("groupNumber", event.target.value)}
                  aria-invalid={Boolean(formErrors.groupNumber)}
                  aria-describedby={formErrors.groupNumber ? "user-group-error" : undefined}
                  required
                >
                  <option value="">Seleccione</option>
                  {groups.map((group) => (
                    <option key={group.groupNumber} value={group.groupNumber}>
                      {group.name} (Grupo {group.groupNumber})
                    </option>
                  ))}
                </select>
                {formErrors.groupNumber ? (
                  <span id="user-group-error" className="error">
                    {formErrors.groupNumber}
                  </span>
                ) : null}
              </div>

              {editingId ? (
                <label className="option-card">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(event) => updateForm("isActive", event.target.checked)}
                  />
                  <span className="option-text">Usuario activo</span>
                </label>
              ) : null}

              <div className="form-actions">
                <button
                  className="submit"
                  type="submit"
                  disabled={submitStatus === "loading"}
                >
                  {submitStatus === "loading"
                    ? "Guardando..."
                    : editingId
                    ? "Actualizar usuario"
                    : "Crear usuario"}
                </button>
                <button className="secondary-button" type="button" onClick={closeModal}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
