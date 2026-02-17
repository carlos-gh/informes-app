import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const buildDefaultPersonForm = () => ({
  name: "",
  group: "",
  designation: "Publicador",
});

const buildDefaultGroupForm = () => ({
  groupNumber: "",
  name: "",
  superintendentUserId: "",
});

const CONFIG_TABLE_SKELETON_ROWS = Array.from({ length: 5 }, (_, index) => index);
const CONFIG_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-lg",
  "skeleton-sm",
  "skeleton-sm",
  "skeleton-md",
];

const GROUP_TABLE_SKELETON_ROWS = Array.from({ length: 4 }, (_, index) => index);
const GROUP_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-sm",
  "skeleton-lg",
  "skeleton-md",
  "skeleton-md",
];

const getErrorMessageFromResponse = async (response, fallbackMessage) => {
  try {
    const data = await response.json();
    const apiError = String(data?.error || "").trim();

    return apiError || fallbackMessage;
  } catch (error) {
    return fallbackMessage;
  }
};

export default function ConfigView({
  authToken,
  authUser,
  onLogout,
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

  const [groups, setGroups] = useState([]);
  const [groupUsers, setGroupUsers] = useState([]);
  const [isGroupsLoading, setIsGroupsLoading] = useState(false);
  const [groupsLoadError, setGroupsLoadError] = useState("");
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroupNumber, setEditingGroupNumber] = useState("");
  const [groupFormState, setGroupFormState] = useState(buildDefaultGroupForm());
  const [groupFormErrors, setGroupFormErrors] = useState({});
  const [groupSubmitStatus, setGroupSubmitStatus] = useState("idle");
  const [groupSubmitMessage, setGroupSubmitMessage] = useState("");

  const isAuthenticated = Boolean(authToken);
  const isSuperAdmin = true === Boolean(authUser?.isSuperAdmin);

  const loadPeople = async () => {
    if (!isAuthenticated || !isSuperAdmin) {
      setPeople([]);
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

  const loadGroups = async () => {
    if (!isAuthenticated || !isSuperAdmin) {
      setGroups([]);
      setGroupUsers([]);
      return;
    }

    setIsGroupsLoading(true);
    setGroupsLoadError("");

    try {
      const [groupsResponse, usersResponse] = await Promise.all([
        fetch("/api/groups", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
        fetch("/api/users", {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }),
      ]);

      if (groupsResponse.status === 401 || usersResponse.status === 401) {
        onLogout();
        setGroupsLoadError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!groupsResponse.ok || !usersResponse.ok) {
        throw new Error("Failed to load groups");
      }

      const groupsData = await groupsResponse.json();
      const usersData = await usersResponse.json();

      const superintendentCandidates = (usersData.items || []).filter(
        (user) => user.role === "group_admin" && true === user.isActive
      );

      setGroups(groupsData.items || []);
      setGroupUsers(superintendentCandidates);
    } catch (error) {
      setGroupsLoadError("No se pudieron cargar los grupos.");
    } finally {
      setIsGroupsLoading(false);
    }
  };

  useEffect(() => {
    loadPeople();
    loadGroups();
  }, [authToken, isSuperAdmin]);

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

    if (
      formState.group.trim().length === 0 ||
      Number.isNaN(Number(formState.group)) ||
      Number(formState.group) < 1
    ) {
      nextErrors.group = "Seleccione un grupo válido.";
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

  const resetGroupForm = () => {
    setGroupFormState(buildDefaultGroupForm());
    setEditingGroupNumber("");
    setGroupFormErrors({});
  };

  const openNewGroupModal = () => {
    resetGroupForm();
    setGroupSubmitStatus("idle");
    setGroupSubmitMessage("");
    setIsGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    resetGroupForm();
    setGroupSubmitStatus("idle");
    setGroupSubmitMessage("");
    setIsGroupModalOpen(false);
  };

  const updateGroupForm = (field, value) => {
    setGroupFormState((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateGroupForm = () => {
    const nextErrors = {};

    if (
      groupFormState.groupNumber.trim().length === 0 ||
      Number.isNaN(Number(groupFormState.groupNumber)) ||
      Number(groupFormState.groupNumber) < 1
    ) {
      nextErrors.groupNumber = "Ingrese un número de grupo válido.";
    }

    if (groupFormState.name.trim().length < 2) {
      nextErrors.name = "El nombre del grupo debe tener al menos 2 caracteres.";
    }

    if (
      groupFormState.superintendentUserId &&
      Number.isNaN(Number(groupFormState.superintendentUserId))
    ) {
      nextErrors.superintendentUserId = "Seleccione un superintendente válido.";
    }

    setGroupFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEditGroup = (group) => {
    setEditingGroupNumber(String(group.groupNumber));
    setGroupFormState({
      groupNumber: String(group.groupNumber),
      name: group.name || "",
      superintendentUserId: group.superintendentUserId
        ? String(group.superintendentUserId)
        : "",
    });
    setGroupSubmitStatus("idle");
    setGroupSubmitMessage("");
    setGroupFormErrors({});
    setIsGroupModalOpen(true);
  };

  const handleGroupSubmit = async (event) => {
    event.preventDefault();
    setGroupSubmitMessage("");

    if (!validateGroupForm()) {
      setGroupSubmitStatus("error");
      setGroupSubmitMessage("Revise los campos marcados en el formulario.");
      return;
    }

    setGroupSubmitStatus("loading");

    const payload = {
      groupNumber: Number(groupFormState.groupNumber),
      name: groupFormState.name.trim(),
      superintendentUserId: groupFormState.superintendentUserId
        ? Number(groupFormState.superintendentUserId)
        : null,
    };

    try {
      const response = await fetch("/api/groups", {
        method: editingGroupNumber ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        onLogout();
        setGroupSubmitStatus("error");
        setGroupSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo guardar el grupo."
        );
        throw new Error(errorMessage);
      }

      setGroupSubmitStatus("success");
      setGroupSubmitMessage(
        editingGroupNumber ? "Grupo actualizado." : "Grupo creado."
      );
      closeGroupModal();
      await loadGroups();
    } catch (error) {
      setGroupSubmitStatus("error");
      setGroupSubmitMessage(String(error.message || "No se pudo guardar el grupo."));
    }
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
          <h1 className="title">Configuraciones</h1>
          <p className="subtitle">
            Administre los parámetros del sistema.
          </p>
        </div>
      </div>

      {isSuperAdmin ? (
        <>
          <section className="config-people">
            <div className="config-section-head">
              <div>
                <h2 className="config-section-title">Grupos</h2>
                <p className="config-section-description">
                  Cree grupos y asigne su superintendente responsable.
                </p>
              </div>
              <div className="config-section-actions">
                <span className="config-total">Total: {groups.length}</span>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={openNewGroupModal}
                >
                  Agregar grupo
                </button>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Grupo</th>
                    <th>Nombre</th>
                    <th>Superintendente</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {isGroupsLoading
                    ? GROUP_TABLE_SKELETON_ROWS.map((rowIndex) => (
                        <tr key={`group-skeleton-${rowIndex}`} className="table-skeleton">
                          {GROUP_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                            <td key={`group-skeleton-cell-${rowIndex}-${cellIndex}`}>
                              <span className={`skeleton-line ${size}`} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : null}
                  {!isGroupsLoading && groupsLoadError ? (
                    <tr>
                      <td colSpan={5}>{groupsLoadError}</td>
                    </tr>
                  ) : null}
                  {!isGroupsLoading && !groupsLoadError && groups.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No hay grupos registrados.</td>
                    </tr>
                  ) : null}
                  {!isGroupsLoading &&
                    !groupsLoadError &&
                    groups.map((group, index) => (
                      <tr key={group.groupNumber}>
                        <td>{index + 1}</td>
                        <td>{group.groupNumber}</td>
                        <td>{group.name}</td>
                        <td>{group.superintendentUsername || "-"}</td>
                        <td>
                          <button
                            className="table-button"
                            type="button"
                            onClick={() => handleEditGroup(group)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {groupSubmitMessage ? (
              <div
                className={`feedback ${groupSubmitStatus === "success" ? "success" : "error"}`}
                role="status"
              >
                {groupSubmitMessage}
              </div>
            ) : null}
          </section>

          <section className="config-people">
            <div className="config-section-head">
              <div>
                <h2 className="config-section-title">Personas registradas</h2>
                <p className="config-section-description">
                  Administre la lista de personas para comparar pendientes de informes.
                </p>
              </div>
              <div className="config-section-actions">
                <span className="config-total">Total: {people.length}</span>
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
          </section>

          <div className="config-spacer" />
        </>
      ) : (
        <section className="config-theme">
          <h2 className="config-section-title">Permisos</h2>
          <p className="config-section-description">
            La gestión de grupos y personas está disponible solo para el superadmin.
          </p>
        </section>
      )}

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
                <select
                  id="person-group"
                  name="person-group"
                  value={formState.group}
                  onChange={(event) => updateForm("group", event.target.value)}
                  aria-invalid={Boolean(formErrors.group)}
                  aria-describedby={formErrors.group ? "person-group-error" : undefined}
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
            </form>
          </div>
        </div>
      ) : null}

      {isGroupModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-header">
              <div>
                <p className="brand">Configuraciones</p>
                <h2 className="modal-title">
                  {editingGroupNumber ? "Editar grupo" : "Agregar grupo"}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={closeGroupModal}>
                Cerrar
              </button>
            </div>

            <form className="form modal-body" onSubmit={handleGroupSubmit} noValidate>
              <div className="field">
                <label htmlFor="group-number">
                  Número de grupo <span className="required">*</span>
                </label>
                <input
                  id="group-number"
                  name="group-number"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={groupFormState.groupNumber}
                  onChange={(event) => updateGroupForm("groupNumber", event.target.value)}
                  aria-invalid={Boolean(groupFormErrors.groupNumber)}
                  aria-describedby={
                    groupFormErrors.groupNumber ? "group-number-error" : undefined
                  }
                  disabled={Boolean(editingGroupNumber)}
                  required
                />
                {groupFormErrors.groupNumber ? (
                  <span id="group-number-error" className="error">
                    {groupFormErrors.groupNumber}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="group-name">
                  Nombre del grupo <span className="required">*</span>
                </label>
                <input
                  id="group-name"
                  name="group-name"
                  type="text"
                  value={groupFormState.name}
                  onChange={(event) => updateGroupForm("name", event.target.value)}
                  aria-invalid={Boolean(groupFormErrors.name)}
                  aria-describedby={groupFormErrors.name ? "group-name-error" : undefined}
                  required
                />
                {groupFormErrors.name ? (
                  <span id="group-name-error" className="error">
                    {groupFormErrors.name}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="group-superintendent">Superintendente asignado</label>
                <select
                  id="group-superintendent"
                  name="group-superintendent"
                  value={groupFormState.superintendentUserId}
                  onChange={(event) =>
                    updateGroupForm("superintendentUserId", event.target.value)
                  }
                  aria-invalid={Boolean(groupFormErrors.superintendentUserId)}
                  aria-describedby={
                    groupFormErrors.superintendentUserId
                      ? "group-superintendent-error"
                      : undefined
                  }
                >
                  <option value="">Sin asignar</option>
                  {groupUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
                {groupFormErrors.superintendentUserId ? (
                  <span id="group-superintendent-error" className="error">
                    {groupFormErrors.superintendentUserId}
                  </span>
                ) : null}
              </div>

              <div className="form-actions">
                <button
                  className="submit"
                  type="submit"
                  disabled={groupSubmitStatus === "loading"}
                >
                  {groupSubmitStatus === "loading"
                    ? "Guardando..."
                    : editingGroupNumber
                    ? "Actualizar grupo"
                    : "Crear grupo"}
                </button>
                <button className="secondary-button" type="button" onClick={closeGroupModal}>
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
