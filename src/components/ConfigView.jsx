import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmModal from "./ConfirmModal.jsx";
import Pagination from "./Pagination.jsx";
import { formatDateTime } from "../utils/reporting.js";

const buildDefaultPersonForm = () => ({
  name: "",
  group: "",
  designation: "Publicador",
});

const buildDefaultGroupForm = () => ({
  groupNumber: "",
  name: "",
  superintendentUserId: "",
  assistantUserId: "",
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
  "skeleton-md",
];

const ACTIVITY_TABLE_SKELETON_ROWS = Array.from({ length: 5 }, (_, index) => index);
const ACTIVITY_TABLE_SKELETON_COLUMNS = [
  "skeleton-xs",
  "skeleton-md",
  "skeleton-lg",
  "skeleton-sm",
  "skeleton-sm",
  "skeleton-md",
  "skeleton-md",
];

const PAGINATION_PAGE_SIZE = 10;

const getActivityDetailLabel = (detail) => {
  const value = String(detail || "").trim();

  if ("success" === value) {
    return "Inicio de sesión correcto.";
  }

  if ("invalid_credentials" === value) {
    return "Credenciales inválidas.";
  }

  if ("captcha_invalid" === value) {
    return "Captcha inválido.";
  }

  if ("invalid_payload" === value) {
    return "Solicitud inválida.";
  }

  if ("captcha_missing_secret" === value) {
    return "Captcha no configurado en el servidor.";
  }

  if ("token_secret_missing" === value) {
    return "Token de sesión no configurado.";
  }

  if ("authentication_error" === value) {
    return "Error interno de autenticación.";
  }

  if ("rate_limited" === value) {
    return "Intentos bloqueados temporalmente por exceso de solicitudes.";
  }

  return value || "-";
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

const getDeviceLabelFromUserAgent = (userAgent) => {
  const value = String(userAgent || "").toLowerCase();

  if (!value) {
    return "-";
  }

  if (value.includes("iphone")) {
    return "iPhone";
  }

  if (value.includes("ipad")) {
    return "iPad";
  }

  if (value.includes("android")) {
    return value.includes("mobile") ? "Android (móvil)" : "Android";
  }

  if (value.includes("windows")) {
    return "Windows";
  }

  if (value.includes("macintosh") || value.includes("mac os")) {
    return "Mac";
  }

  if (value.includes("linux")) {
    return "Linux";
  }

  if (value.includes("mobile")) {
    return "Móvil";
  }

  return "Otro";
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
  const [activityItems, setActivityItems] = useState([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [activityLoadError, setActivityLoadError] = useState("");
  const [formOpenDays, setFormOpenDays] = useState(10);
  const [settingsSubmitStatus, setSettingsSubmitStatus] = useState("idle");
  const [settingsSubmitMessage, setSettingsSubmitMessage] = useState("");
  const [activityPage, setActivityPage] = useState(1);
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
      setGroupUsers([]);
      setIsGroupsLoading(false);
      setGroupsLoadError("");
      return;
    }

    setIsGroupsLoading(true);
    setGroupsLoadError("");

    try {
      const [groupsResponse, usersResponse] = await Promise.all([
        fetch("/api/groups"),
        fetch("/api/users"),
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

      const superintendentCandidates = (usersData.items || []).filter((user) => {
        const role = String(user.role || "");

        return (
          (role === "group_admin" || role === "superadmin") &&
          true === user.isActive
        );
      });

      setGroups(groupsData.items || []);
      setGroupUsers(superintendentCandidates);
    } catch (error) {
      setGroupsLoadError("No se pudieron cargar los grupos.");
    } finally {
      setIsGroupsLoading(false);
    }
  };

  const loadActivity = async () => {
    if (!isAuthenticated || !isSuperAdmin) {
      setActivityItems([]);
      setActivityPage(1);
      setIsActivityLoading(false);
      setActivityLoadError("");
      return;
    }

    setIsActivityLoading(true);
    setActivityLoadError("");

    try {
      const response = await fetch("/api/auth/activity?limit=200");

      if (response.status === 401) {
        onLogout();
        setActivityLoadError("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (response.status === 403) {
        setActivityItems([]);
        setActivityPage(1);
        setActivityLoadError("No tiene permisos para ver la actividad.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load activity");
      }

      const data = await response.json();
      setActivityItems(data.items || []);
    } catch (error) {
      setActivityLoadError("No se pudo cargar la actividad de usuarios.");
    } finally {
      setIsActivityLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!isAuthenticated || !isSuperAdmin) {
      setFormOpenDays(10);
      return;
    }

    try {
      const response = await fetch("/api/settings");

      if (response.status === 401) {
        onLogout();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await response.json();
      const parsedFormOpenDays = Number(data?.formOpenDays);

      if (
        Number.isInteger(parsedFormOpenDays) &&
        parsedFormOpenDays >= 1 &&
        parsedFormOpenDays <= 31
      ) {
        setFormOpenDays(parsedFormOpenDays);
        return;
      }
    } catch (error) {
      setSettingsSubmitStatus("error");
      setSettingsSubmitMessage("No se pudieron cargar los parámetros del formulario.");
    }
  };

  useEffect(() => {
    loadPeople();
    loadGroups();
    loadActivity();
    loadSettings();
  }, [authToken, canManagePeople, isSuperAdmin]);

  const handleFormOpenDaysSubmit = async (event) => {
    event.preventDefault();
    setSettingsSubmitMessage("");

    const parsedFormOpenDays = Number(formOpenDays);

    if (
      !Number.isInteger(parsedFormOpenDays) ||
      parsedFormOpenDays < 1 ||
      parsedFormOpenDays > 31
    ) {
      setSettingsSubmitStatus("error");
      setSettingsSubmitMessage("Defina un valor válido entre 1 y 31 días.");
      return;
    }

    setSettingsSubmitStatus("loading");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formOpenDays: parsedFormOpenDays,
        }),
      });

      if (response.status === 401) {
        onLogout();
        setSettingsSubmitStatus("error");
        setSettingsSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
        return;
      }

      if (!response.ok) {
        const errorMessage = await getErrorMessageFromResponse(
          response,
          "No se pudo guardar esta configuración."
        );
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const savedValue = Number(data?.formOpenDays);

      if (Number.isInteger(savedValue) && savedValue >= 1 && savedValue <= 31) {
        setFormOpenDays(savedValue);
      }

      setSettingsSubmitStatus("success");
      setSettingsSubmitMessage("Configuración actualizada.");
    } catch (error) {
      setSettingsSubmitStatus("error");
      setSettingsSubmitMessage(
        String(error.message || "No se pudo guardar esta configuración.")
      );
    }
  };

  const resetForm = () => {
    setFormState((previous) => ({
      ...buildDefaultPersonForm(),
      group: isSuperAdmin ? "" : managedGroupNumber,
    }));
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

    if (
      groupFormState.assistantUserId &&
      Number.isNaN(Number(groupFormState.assistantUserId))
    ) {
      nextErrors.assistantUserId = "Seleccione un auxiliar válido.";
    }

    if (
      groupFormState.superintendentUserId &&
      groupFormState.assistantUserId &&
      String(groupFormState.superintendentUserId) ===
        String(groupFormState.assistantUserId)
    ) {
      nextErrors.assistantUserId =
        "El auxiliar debe ser una persona distinta al superintendente.";
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
      assistantUserId: group.assistantUserId ? String(group.assistantUserId) : "",
    });
    setGroupSubmitStatus("idle");
    setGroupSubmitMessage("");
    setGroupFormErrors({});
    setIsGroupModalOpen(true);
  };

  const handleDeleteGroup = async (groupNumber) => {
    const isConfirmed = await new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        title: "Eliminar grupo",
        message: "¿Desea eliminar este grupo?",
        confirmLabel: "Eliminar",
        cancelLabel: "Cancelar",
      });
      setConfirmResolver(() => resolve);
    });

    if (!isConfirmed) {
      return;
    }

    setGroupSubmitStatus("loading");
    setGroupSubmitMessage("");

    try {
      const response = await fetch(`/api/groups?groupNumber=${groupNumber}`, {
        method: "DELETE",
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
          "No se pudo eliminar el grupo."
        );
        throw new Error(errorMessage);
      }

      setGroupSubmitStatus("success");
      setGroupSubmitMessage("Grupo eliminado.");
      await loadGroups();
    } catch (error) {
      setGroupSubmitStatus("error");
      setGroupSubmitMessage(String(error.message || "No se pudo eliminar el grupo."));
    }
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
      assistantUserId: groupFormState.assistantUserId
        ? Number(groupFormState.assistantUserId)
        : null,
    };

    try {
      const response = await fetch("/api/groups", {
        method: editingGroupNumber ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
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

  const activityTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(activityItems.length / PAGINATION_PAGE_SIZE));
  }, [activityItems.length]);

  const safeActivityPage = useMemo(() => {
    if (activityPage > activityTotalPages) {
      return activityTotalPages;
    }

    if (activityPage < 1) {
      return 1;
    }

    return activityPage;
  }, [activityPage, activityTotalPages]);

  const activityPageStartIndex = useMemo(() => {
    return (safeActivityPage - 1) * PAGINATION_PAGE_SIZE;
  }, [safeActivityPage]);

  const pagedActivityItems = useMemo(() => {
    return activityItems.slice(
      activityPageStartIndex,
      activityPageStartIndex + PAGINATION_PAGE_SIZE
    );
  }, [activityItems, activityPageStartIndex]);

  useEffect(() => {
    if (activityPage !== safeActivityPage) {
      setActivityPage(safeActivityPage);
    }
  }, [activityPage, safeActivityPage]);

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
        const normalizedPage = Number.isInteger(previousPage) && previousPage > 0
          ? previousPage
          : 1;

        next[key] = Math.min(normalizedPage, totalPages);
      });

      return next;
    });
  }, [peopleByGroup]);

  const getPeoplePage = (groupNumber, groupItemsCount) => {
    const key = String(groupNumber);
    const requestedPage = Number(peoplePageByGroup[key] || 1);
    const totalPages = Math.max(1, Math.ceil(groupItemsCount / PAGINATION_PAGE_SIZE));
    const normalizedPage = Number.isInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;

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
        <section className="config-theme">
          <h2 className="config-section-title">Recopilación de informes</h2>
          <p className="config-section-description">
            Defina cuántos días estará abierto el formulario público cada mes.
          </p>

          <form className="form" onSubmit={handleFormOpenDaysSubmit} noValidate>
            <div className="field">
              <label htmlFor="config-form-open-days">
                Días abiertos del formulario <span className="required">*</span>
              </label>
              <input
                id="config-form-open-days"
                name="config-form-open-days"
                type="number"
                min="1"
                max="31"
                inputMode="numeric"
                value={formOpenDays}
                onChange={(event) => setFormOpenDays(event.target.value)}
                required
              />
            </div>

            <div className="form-actions">
              <button
                className="submit"
                type="submit"
                disabled={settingsSubmitStatus === "loading"}
              >
                {settingsSubmitStatus === "loading"
                  ? "Guardando..."
                  : "Guardar configuración"}
              </button>
            </div>
          </form>

          {settingsSubmitMessage ? (
            <div
              className={`feedback ${settingsSubmitStatus === "success" ? "success" : "error"}`}
              role="status"
            >
              {settingsSubmitMessage}
            </div>
          ) : null}
        </section>
      ) : null}

      {isSuperAdmin ? (
        <section className="config-people">
          <div className="config-section-head">
            <div>
              <h2 className="config-section-title">Grupos</h2>
              <p className="config-section-description">
                Cree grupos y asigne su superintendente y auxiliar responsables.
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
                  <th>Auxiliar</th>
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
                    <td colSpan={6}>{groupsLoadError}</td>
                  </tr>
                ) : null}
                {!isGroupsLoading && !groupsLoadError && groups.length === 0 ? (
                  <tr>
                    <td colSpan={6}>No hay grupos registrados.</td>
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
                      <td>{group.assistantUsername || "-"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="table-button"
                            type="button"
                            onClick={() => handleEditGroup(group)}
                          >
                            Editar
                          </button>
                          <button
                            className="table-button danger"
                            type="button"
                            onClick={() => handleDeleteGroup(group.groupNumber)}
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

          {groupSubmitMessage ? (
            <div
              className={`feedback ${groupSubmitStatus === "success" ? "success" : "error"}`}
              role="status"
            >
              {groupSubmitMessage}
            </div>
          ) : null}
        </section>
      ) : null}

      {isSuperAdmin ? (
        <section className="config-people">
          <div className="config-section-head">
            <div>
              <h2 className="config-section-title">Actividad de accesos</h2>
              <p className="config-section-description">
                Supervise inicios de sesión recientes para detectar actividad sospechosa.
              </p>
            </div>
            <div className="config-section-actions">
              <span className="config-total">Total: {activityItems.length}</span>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Resultado</th>
                  <th>Detalle</th>
                  <th>Dispositivo</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {isActivityLoading
                  ? ACTIVITY_TABLE_SKELETON_ROWS.map((rowIndex) => (
                      <tr key={`activity-skeleton-${rowIndex}`} className="table-skeleton">
                        {ACTIVITY_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                          <td key={`activity-skeleton-cell-${rowIndex}-${cellIndex}`}>
                            <span className={`skeleton-line ${size}`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : null}
                {!isActivityLoading && activityLoadError ? (
                  <tr>
                    <td colSpan={7}>{activityLoadError}</td>
                  </tr>
                ) : null}
                {!isActivityLoading && !activityLoadError && activityItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No hay eventos de acceso registrados.</td>
                  </tr>
                ) : null}
                {!isActivityLoading &&
                  !activityLoadError &&
                  pagedActivityItems.map((item, index) => {
                    const username = String(
                      item.resolvedUsername || item.username || "Usuario desconocido"
                    ).trim();
                    const fullName = String(item.fullName || "").trim();
                    const displayUser = fullName ? `${fullName} (${username})` : username;

                    return (
                      <tr key={item.id || `${item.createdAt}-${index}`}>
                        <td>{activityPageStartIndex + index + 1}</td>
                        <td>{formatDateTime(item.createdAt) || "-"}</td>
                        <td>{displayUser}</td>
                        <td>
                          {"login_success" === item.eventType
                            ? "Acceso correcto"
                            : "Acceso fallido"}
                        </td>
                        <td>{getActivityDetailLabel(item.detail)}</td>
                        <td title={item.userAgent || ""}>
                          {getDeviceLabelFromUserAgent(item.userAgent)}
                        </td>
                        <td>{item.ipAddress || "-"}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <Pagination
            ariaLabel="Paginación de actividad de accesos"
            totalItems={activityItems.length}
            pageSize={PAGINATION_PAGE_SIZE}
            currentPage={safeActivityPage}
            onPageChange={setActivityPage}
          />
        </section>
      ) : null}

      {canManagePeople ? (
        <section className="config-people">
          <div className="config-section-head">
            <div>
              <h2 className="config-section-title">Personas registradas</h2>
              <p className="config-section-description">
                {isSuperAdmin
                  ? "Administre la lista de personas agrupadas por número de grupo."
                  : `Administre las personas registradas del Grupo ${managedGroupNumber}.`}
              </p>
            </div>
            <div className="config-section-actions">
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
                    {CONFIG_TABLE_SKELETON_ROWS.map((rowIndex) => (
                      <tr key={`config-skeleton-${rowIndex}`} className="table-skeleton">
                        {CONFIG_TABLE_SKELETON_COLUMNS.map((size, cellIndex) => (
                          <td key={`config-skeleton-cell-${rowIndex}-${cellIndex}`}>
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
                  const groupPageStartIndex =
                    (groupCurrentPage - 1) * PAGINATION_PAGE_SIZE;
                  const pagedPeopleItems = groupBlock.items.slice(
                    groupPageStartIndex,
                    groupPageStartIndex + PAGINATION_PAGE_SIZE
                  );

                  return (
                    <div className="closed-periods" key={`people-group-${groupBlock.groupNumber}`}>
                      <div className="config-section-head">
                        <h3 className="config-section-title">{groupTitle}</h3>
                        <span className="config-total">Total: {groupBlock.items.length}</span>
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
        </section>
      ) : (
        <section className="config-theme">
          <h2 className="config-section-title">Permisos</h2>
          <p className="config-section-description">
            La gestión de personas está disponible para superintendentes de grupo y superadmin.
          </p>
        </section>
      )}

      {isSuperAdmin ? <div className="config-spacer" /> : null}

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

              {isSuperAdmin ? (
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
                      {user.role === "superadmin" ? " (Superadmin)" : ""}
                    </option>
                  ))}
                </select>
                {groupFormErrors.superintendentUserId ? (
                  <span id="group-superintendent-error" className="error">
                    {groupFormErrors.superintendentUserId}
                  </span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="group-assistant">Auxiliar asignado</label>
                <select
                  id="group-assistant"
                  name="group-assistant"
                  value={groupFormState.assistantUserId}
                  onChange={(event) => updateGroupForm("assistantUserId", event.target.value)}
                  aria-invalid={Boolean(groupFormErrors.assistantUserId)}
                  aria-describedby={
                    groupFormErrors.assistantUserId ? "group-assistant-error" : undefined
                  }
                >
                  <option value="">Sin asignar</option>
                  {groupUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                      {user.role === "superadmin" ? " (Superadmin)" : ""}
                    </option>
                  ))}
                </select>
                {groupFormErrors.assistantUserId ? (
                  <span id="group-assistant-error" className="error">
                    {groupFormErrors.assistantUserId}
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
