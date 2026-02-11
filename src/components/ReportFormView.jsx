import { useMemo, useState } from "react";
import {
  getMonthNameInSpanish,
  getReportDate,
  getReportMonthKey,
  isFormWindowOpen,
  isNumericValue,
} from "../utils/reporting.js";

export default function ReportFormView({ isAuthenticated = false }) {
  const currentDate = useMemo(() => new Date(), []);
  const reportDate = useMemo(() => getReportDate(currentDate), [currentDate]);
  const reportMonthName = useMemo(
    () => getMonthNameInSpanish(reportDate),
    [reportDate]
  );
  const reportMonthKey = useMemo(() => getReportMonthKey(reportDate), [reportDate]);
  const isOpen = useMemo(() => isFormWindowOpen(currentDate), [currentDate]);
  const canSubmit = isOpen || isAuthenticated;

  const [formData, setFormData] = useState({
    name: "",
    participation: "",
    hours: "",
    courses: "",
    comments: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitStatus, setSubmitStatus] = useState("idle");
  const [submitMessage, setSubmitMessage] = useState("");

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

    if (!validateForm()) {
      setSubmitStatus("error");
      setSubmitMessage("Revise los campos marcados en el formulario.");
      return;
    }

    const payload = {
      reportMonthKey,
      name: formData.name.trim(),
      participation: formData.participation,
      hours: formData.hours.trim(),
      courses: formData.courses.trim(),
      comments: formData.comments.trim(),
    };

    setSubmitStatus("loading");

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
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
      <h1 className="title">Informe mensual de actividades</h1>

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
