import { useMemo, useState } from "react";

// The report always targets the previous month relative to today.
const getReportDate = (currentDate) => {
  return new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
};

const getMonthNameInSpanish = (date) => {
  return new Intl.DateTimeFormat("es-ES", { month: "long" }).format(date);
};

const getReportingLabel = (date) => {
  const monthName = getMonthNameInSpanish(date);
  const year = date.getFullYear();
  return `${monthName} ${year}`;
};

const isFormWindowOpen = (currentDate) => {
  const dayOfMonth = currentDate.getDate();
  return dayOfMonth >= 1 && dayOfMonth <= 10;
};

export default function App() {
  const currentDate = useMemo(() => new Date(), []);
  const reportDate = useMemo(() => getReportDate(currentDate), [currentDate]);
  const reportMonthName = useMemo(
    () => getMonthNameInSpanish(reportDate),
    [reportDate]
  );
  const reportMonthLabel = useMemo(
    () => getReportingLabel(reportDate),
    [reportDate]
  );

  const isOpen = useMemo(() => isFormWindowOpen(currentDate), [currentDate]);

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

  // Google Apps Script Web App endpoint configured via Vercel env variables.
  const endpointUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

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

    if (formData.hours.trim().length > 0 && Number.isNaN(Number(formData.hours))) {
      nextErrors.hours = "Ingrese un número válido.";
    }

    if (
      formData.courses.trim().length > 0 &&
      Number.isNaN(Number(formData.courses))
    ) {
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

    if (!endpointUrl) {
      setSubmitStatus("error");
      setSubmitMessage(
        "Falta configurar el enlace de envío. Contacte al administrador."
      );
      return;
    }

    // Payload fields align with the expected Google Sheets columns.
    const payload = {
      reportMonth: reportMonthLabel,
      name: formData.name.trim(),
      participation: formData.participation,
      hours: formData.hours.trim() === "" ? "" : Number(formData.hours),
      courses: formData.courses.trim() === "" ? "" : Number(formData.courses),
      comments: formData.comments.trim(),
    };

    setSubmitStatus("loading");

    try {
      const response = await fetch(endpointUrl, {
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
    <div className="page">
      <main className="card">
        <h1 className="title">Informe mensual de actividades</h1>

        {isOpen ? (
          <p className="subtitle">
            Ya puede enviar sus informes predicacion del mes de{" "}
            <span className="month-highlight">{reportMonthName}</span>
          </p>
        ) : (
          <div className="closed">
            <p className="closed-title">El periodo para enviar informes está cerrado.</p>
            <p className="closed-message">
              El formulario solo está disponible los primeros dias del mes. Regrese el proximo mes para enviar su informe. Si desea enviar un informe, contacte a su superintendente de grupo.
            </p>
          </div>
        )}

        {isOpen ? (
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
                <label className="option">
                  <input
                    type="radio"
                    name="participation"
                    value="Sí participé."
                    checked={formData.participation === "Sí participé."}
                    onChange={(event) => handleParticipationChange(event.target.value)}
                    required
                  />
                  Sí participé.
                </label>
                <label className="option">
                  <input
                    type="radio"
                    name="participation"
                    value="No participé."
                    checked={formData.participation === "No participé."}
                    onChange={(event) => handleParticipationChange(event.target.value)}
                    required
                  />
                  No participé.
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

            <button
              className="submit"
              type="submit"
              disabled={submitStatus === "loading"}
            >
              {submitStatus === "loading" ? "Enviando..." : "Enviar informe"}
            </button>

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
        ) : null}
        <p className="footer-note">Congregación El Puente Monte Tabor</p>
      </main>
    </div>
  );
}
