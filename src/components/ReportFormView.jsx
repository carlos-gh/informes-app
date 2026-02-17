import { useEffect, useMemo, useState } from "react";
import {
  getMonthNameInSpanish,
  getReportDate,
  getReportMonthKey,
  isFormWindowOpen,
  isNumericValue,
} from "../utils/reporting.js";

export default function ReportFormView({
  isAuthenticated = false,
  authUser = null,
  authToken = "",
  forcedGroupNumber = "",
}) {
  const currentDate = useMemo(() => new Date(), []);
  const reportDate = useMemo(() => getReportDate(currentDate), [currentDate]);
  const reportMonthName = useMemo(
    () => getMonthNameInSpanish(reportDate),
    [reportDate]
  );
  const reportMonthKey = useMemo(() => getReportMonthKey(reportDate), [reportDate]);
  const isOpen = useMemo(() => isFormWindowOpen(currentDate), [currentDate]);
  const canSubmit = isOpen || isAuthenticated;
  const isGroupUser = useMemo(() => {
    return !authUser?.isSuperAdmin && Boolean(authUser?.groupNumber);
  }, [authUser?.groupNumber, authUser?.isSuperAdmin]);
  const defaultGroupNumber = useMemo(() => {
    if (!isGroupUser) {
      return "";
    }

    return String(authUser?.groupNumber || "");
  }, [authUser?.groupNumber, isGroupUser]);
  const normalizedForcedGroupNumber = useMemo(() => {
    const normalized = String(forcedGroupNumber || "").trim();

    if (!normalized) {
      return "";
    }

    const parsed = Number(normalized);

    if (!Number.isInteger(parsed) || parsed < 1) {
      return "";
    }

    return String(parsed);
  }, [forcedGroupNumber]);
  const hasInvalidForcedGroup = useMemo(() => {
    return String(forcedGroupNumber || "").trim() !== "" && !normalizedForcedGroupNumber;
  }, [forcedGroupNumber, normalizedForcedGroupNumber]);
  const isFixedGroupRoute = normalizedForcedGroupNumber !== "";
  const lockedGroupNumber = useMemo(() => {
    if (isGroupUser && defaultGroupNumber) {
      return defaultGroupNumber;
    }

    if (isFixedGroupRoute) {
      return normalizedForcedGroupNumber;
    }

    return "";
  }, [
    defaultGroupNumber,
    isFixedGroupRoute,
    isGroupUser,
    normalizedForcedGroupNumber,
  ]);
  const isGroupSelectionLocked = isGroupUser || isFixedGroupRoute;

  const [formData, setFormData] = useState({
    groupNumber: lockedGroupNumber,
    name: "",
    participation: "",
    hours: "",
    courses: "",
    comments: "",
  });
  const [groups, setGroups] = useState([]);
  const [groupsLoadError, setGroupsLoadError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");
  const activeGroupTitle = useMemo(() => {
    const activeGroupNumber = String(
      formData.groupNumber || lockedGroupNumber || ""
    ).trim();

    if (!activeGroupNumber) {
      return "";
    }

    const matchedGroup = groups.find(
      (group) => Number(group.groupNumber) === Number(activeGroupNumber)
    );

    if (matchedGroup?.name) {
      return matchedGroup.name;
    }

    return `Grupo ${activeGroupNumber}`;
  }, [formData.groupNumber, groups, lockedGroupNumber]);

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
          setGroupsLoadError("");
        }
      } catch (error) {
        if (isMounted) {
          setGroups([]);
          setGroupsLoadError("No se pudieron cargar los grupos.");
        }
      }
    };

    loadGroups();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!lockedGroupNumber) {
      return;
    }

    setFormData((previous) => ({
      ...previous,
      groupNumber: lockedGroupNumber,
    }));
  }, [lockedGroupNumber]);

  const updateFormData = (field, value) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleParticipationChange = (value) => {
    setFormData((previous) => ({
      ...previous,
      participation: value,
      hours: value === "Sí participé." ? previous.hours : "",
    }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (formData.name.trim().length === 0) {
      nextErrors.name = "El nombre es obligatorio.";
    }

    const selectedGroup = Number(formData.groupNumber);

    if (!formData.groupNumber || Number.isNaN(selectedGroup) || selectedGroup < 1) {
      nextErrors.groupNumber = "Seleccione un grupo válido.";
    } else if (
      groups.length > 0 &&
      !groups.some((group) => Number(group.groupNumber) === selectedGroup)
    ) {
      nextErrors.groupNumber = "El grupo seleccionado no está registrado.";
    }

    if (formData.participation.trim().length === 0) {
      nextErrors.participation = "Seleccione una opción de participación.";
    }

    if (!isNumericValue(formData.hours)) {
      nextErrors.hours = "Ingrese un número válido.";
    }

    if (!isNumericValue(formData.courses)) {
      nextErrors.courses = "Ingrese un número válido.";
    }

    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      groupNumber: lockedGroupNumber,
      name: "",
      participation: "",
      hours: "",
      courses: "",
      comments: "",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitMessage("");

    if (hasInvalidForcedGroup) {
      setSubmitStatus("error");
      setSubmitMessage("La ruta del grupo no es válida.");
      return;
    }

    if (!validateForm()) {
      setSubmitStatus("error");
      setSubmitMessage("Revise los campos marcados en el formulario.");
      return;
    }

    const payload = {
      reportMonthKey,
      groupNumber: Number(formData.groupNumber),
      name: formData.name.trim(),
      participation: formData.participation,
      hours: formData.hours.trim(),
      courses: formData.courses.trim(),
      comments: formData.comments.trim(),
    };

    setSubmitStatus("loading");

    try {
      const headers = {
        "Content-Type": "application/json",
      };

      if (isAuthenticated && authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 401 && isAuthenticated) {
          setSubmitStatus("error");
          setSubmitMessage("Su sesión expiró. Inicie sesión de nuevo.");
          return;
        }

        if (response.status === 409) {
          setSubmitStatus("error");
          setSubmitMessage(
            "El periodo de este mes ya está cerrado. Contacte a su superintendente de grupo."
          );
          return;
        }

        throw new Error("Network response was not ok");
      }

      setSubmitStatus("success");
      setSubmitMessage("Su informe fue enviado correctamente.");
      resetForm();
    } catch (error) {
      setSubmitStatus("error");
      setSubmitMessage(
        "No se pudo enviar el informe. Inténtelo de nuevo más tarde."
      );
    }
  };

  return (
    <section>
      <h1 className="title">
        Informe mensual de actividades
        {activeGroupTitle ? ` - ${activeGroupTitle}` : ""}
      </h1>

      {isOpen ? (
        <p className="subtitle">
          Ya puede enviar sus informes predicacion del mes de{" "}
          <span className="month-highlight">{reportMonthName}</span>
        </p>
      ) : isAuthenticated ? (
        <p className="subtitle">
          El periodo para enviar informes ha terminado, pero puede enviar un informe
          porque ha iniciado sesión.
        </p>
      ) : (
        <div className="closed">
          <p className="closed-title">El periodo para enviar informes ha terminado.</p>
          <p className="closed-message">
            El formulario solo está disponible los primeros dias del mes. Si desea enviar un informe tardío, contacte a
            su superintendente de grupo.
          </p>
        </div>
      )}

      {canSubmit ? (
        <form className="form" onSubmit={handleSubmit} noValidate>
          {isGroupSelectionLocked ? (
            <input type="hidden" name="groupNumber" value={formData.groupNumber} />
          ) : (
            <div className="field">
              <label htmlFor="groupNumber">
                Grupo <span className="required">*</span>
              </label>
              <select
                id="groupNumber"
                name="groupNumber"
                value={formData.groupNumber}
                onChange={(event) => updateFormData("groupNumber", event.target.value)}
                aria-invalid={Boolean(formErrors.groupNumber)}
                aria-describedby={formErrors.groupNumber ? "group-error" : undefined}
                required
              >
                <option value="">Seleccione un grupo</option>
                {groups.map((group) => (
                  <option key={group.groupNumber} value={group.groupNumber}>
                    {group.name} (Grupo {group.groupNumber})
                  </option>
                ))}
              </select>
              {formErrors.groupNumber ? (
                <span id="group-error" className="error">
                  {formErrors.groupNumber}
                </span>
              ) : null}
              {groupsLoadError ? <span className="error">{groupsLoadError}</span> : null}
            </div>
          )}

          <div className="field">
            <label htmlFor="name">
              Nombre <span className="required">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={(event) => updateFormData("name", event.target.value)}
              aria-invalid={Boolean(formErrors.name)}
              aria-describedby={formErrors.name ? "name-error" : undefined}
              required
            />
            {formErrors.name ? (
              <span id="name-error" className="error">
                {formErrors.name}
              </span>
            ) : null}
          </div>

          <fieldset className="field">
            <legend>
              Participación <span className="required">*</span>
            </legend>
            <div className="options">
              <label
                className={`option-card ${
                  formData.participation === "Sí participé." ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="participation"
                  value="Sí participé."
                  checked={formData.participation === "Sí participé."}
                  onChange={(event) => handleParticipationChange(event.target.value)}
                  required
                />
                <span className="option-text">Sí participé.</span>
              </label>
              <label
                className={`option-card ${
                  formData.participation === "No participé." ? "active" : ""
                }`}
              >
                <input
                  type="radio"
                  name="participation"
                  value="No participé."
                  checked={formData.participation === "No participé."}
                  onChange={(event) => handleParticipationChange(event.target.value)}
                  required
                />
                <span className="option-text">No participé.</span>
              </label>
            </div>
            {formErrors.participation ? (
              <span className="error">{formErrors.participation}</span>
            ) : null}
          </fieldset>

          <div className="field">
            <label htmlFor="hours">
              Horas (para precursores auxiliares y regulares)
            </label>
            <input
              id="hours"
              name="hours"
              type="number"
              min="0"
              inputMode="numeric"
              value={formData.hours}
              onChange={(event) => updateFormData("hours", event.target.value)}
              aria-invalid={Boolean(formErrors.hours)}
              aria-describedby={formErrors.hours ? "hours-error" : undefined}
              disabled={formData.participation !== "Sí participé."}
            />
            {formErrors.hours ? (
              <span id="hours-error" className="error">
                {formErrors.hours}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="courses">Número de diferentes cursos bíblicos dirigidos</label>
            <input
              id="courses"
              name="courses"
              type="number"
              min="0"
              inputMode="numeric"
              value={formData.courses}
              onChange={(event) => updateFormData("courses", event.target.value)}
              aria-invalid={Boolean(formErrors.courses)}
              aria-describedby={formErrors.courses ? "courses-error" : undefined}
              disabled={formData.participation !== "Sí participé."}
            />
            {formErrors.courses ? (
              <span id="courses-error" className="error">
                {formErrors.courses}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="comments">Comentarios</label>
            <textarea
              id="comments"
              name="comments"
              rows="4"
              value={formData.comments}
              onChange={(event) => updateFormData("comments", event.target.value)}
            />
          </div>

          <button className="submit" type="submit" disabled={submitStatus === "loading"}>
            {submitStatus === "loading" ? "Enviando..." : "Enviar informe"}
          </button>

          {submitMessage ? (
            <div
              className={`feedback ${
                submitStatus === "success" ? "success report-success" : "error"
              }`}
              role="status"
            >
              {submitMessage}
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
